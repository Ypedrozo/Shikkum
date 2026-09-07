import { onCall, HttpsError, CallableRequest } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { emailProvider, TicketEmailItem, TicketEmailPayload } from './services/emailProvider';
import { issueTicketsForPaidOrder } from './ticketFunctions';

// Inicializar Admin SDK si no ha sido inicializado
if (admin.apps.length === 0) {
  admin.initializeApp();
}

const db = admin.firestore();

/**
 * Validador común de usuario operador activo con roles autorizados
 */
async function validateOperatorUser(callerUid: string, allowedRoles: string[]) {
  const userDoc = await db.collection('users').doc(callerUid).get();
  if (!userDoc.exists) {
    throw new HttpsError('permission-denied', 'El usuario operador no se encuentra registrado en el sistema.');
  }
  const userData = userDoc.data();
  if (!userData || !userData.isActive) {
    throw new HttpsError('permission-denied', 'El usuario operador se encuentra inactivo. Operación denegada.');
  }
  if (!allowedRoles.includes(userData.role)) {
    throw new HttpsError(
      'permission-denied',
      `Rol no autorizado (${userData.role}). Se requiere: ${allowedRoles.join(' o ')}.`
    );
  }
  return {
    uid: callerUid,
    role: userData.role as string,
    displayName: userData.displayName || userData.email || 'Operador SHIKKUM'
  };
}

/**
 * Orquestador server-side de despacho de correos para una orden PAGADA.
 * 
 * Flujo:
 * 1. Verificar estado PAID de la orden.
 * 2. Verificar o emitir tickets idempotentemente.
 * 3. Obtener datos del comprador y evento.
 * 4. Registrar despacho en /email_dispatches con estado SENDING.
 * 5. Enviar paquete mediante el EmailProvider desacoplado.
 * 6. Si tiene éxito: actualizar dispatch a SENT, y registrar metadata.
 * 7. Si falla: actualizar dispatch a FAILED sin alterar los tickets ni la orden.
 */
export async function dispatchTicketsEmailForOrder(
  orderId: string,
  operatorUid: string,
  operatorName: string,
  options?: { isResend?: boolean; customRecipient?: string }
): Promise<{
  success: boolean;
  dispatchId: string;
  recipient: string;
  ticketCount: number;
  message: string;
  errorMessage?: string;
}> {
  const nowIso = new Date().toISOString();
  const orderRef = db.collection('orders').doc(orderId);
  const orderDoc = await orderRef.get();

  if (!orderDoc.exists) {
    throw new HttpsError('not-found', `La orden ${orderId} no existe.`);
  }

  const orderData = orderDoc.data()!;

  // Condición obligatoria: Solo enviar entradas si la orden está PAID
  if (orderData.status !== 'PAID') {
    throw new HttpsError(
      'failed-precondition',
      `No se pueden enviar entradas para órdenes con estado ${orderData.status}. La orden debe estar pagada (PAID).`
    );
  }

  // Si es un reenvío, consultar los tickets existentes (NUNCA duplicar)
  // Si es el primer envío, asegurar la emisión idempotente de los tickets
  let tickets: any[] = [];
  const existingTicketsQuery = await db
    .collection('tickets')
    .where('orderId', '==', orderId)
    .get();

  if (existingTicketsQuery.empty) {
    if (options?.isResend) {
      throw new HttpsError(
        'failed-precondition',
        'No existen boletos generados para esta orden. Emita los boletos primero.'
      );
    }
    // Generación idempotente de boletos
    tickets = await issueTicketsForPaidOrder(orderId, operatorUid, operatorName);
  } else {
    tickets = existingTicketsQuery.docs.map((d) => d.data());
  }

  if (!tickets || tickets.length === 0) {
    throw new HttpsError(
      'failed-precondition',
      `La orden ${orderId} no cuenta con entradas disponibles para envío.`
    );
  }

  // Obtener datos del comprador
  const customerDoc = await db.collection('customers').doc(orderData.customerId).get();
  const customerData = customerDoc.exists ? customerDoc.data()! : {};

  // Determinar destinatario
  let recipientEmail = customerData.email || orderData.customerEmail;
  if (options?.customRecipient && options.customRecipient.trim()) {
    recipientEmail = options.customRecipient.trim();
  }

  if (!recipientEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail)) {
    // Si no hay correo válido, registrar despacho fallido
    const failDispatchRef = db.collection('email_dispatches').doc();
    const failDispatchPayload = {
      id: failDispatchRef.id,
      dispatchId: failDispatchRef.id,
      orderId,
      orderCode: orderData.orderCode || 'ORD',
      customerId: orderData.customerId,
      customerName: customerData.fullName || orderData.customerName || 'Comprador',
      customerEmail: recipientEmail || 'SIN_CORREO',
      eventId: orderData.eventId,
      eventTitle: orderData.eventTitle || 'Evento SHIKKUM',
      ticketIds: tickets.map((t) => t.id),
      ticketCodes: tickets.map((t) => t.ticketCode),
      status: 'FAILED' as const,
      sentAt: null,
      createdAt: nowIso,
      retryCount: options?.isResend ? 1 : 0,
      errorMessage: 'El comprador no posee una dirección de correo electrónico válida.',
      lastAttemptAt: nowIso,
      triggeredBy: operatorUid,
      triggeredByName: operatorName,
      isResend: Boolean(options?.isResend)
    };
    await failDispatchRef.set(failDispatchPayload);

    return {
      success: false,
      dispatchId: failDispatchRef.id,
      recipient: recipientEmail || 'SIN_CORREO',
      ticketCount: tickets.length,
      message: 'Las entradas fueron generadas correctamente, pero no pudimos enviar el correo.',
      errorMessage: failDispatchPayload.errorMessage
    };
  }

  // Obtener datos del evento
  const eventDoc = await db.collection('events').doc(orderData.eventId).get();
  const eventData = eventDoc.exists ? eventDoc.data()! : {};

  // Contar intentos previos para esta orden
  const previousDispatches = await db
    .collection('email_dispatches')
    .where('orderId', '==', orderId)
    .get();
  const retryCount = previousDispatches.size;

  // Registrar inicio de despacho en /email_dispatches
  const dispatchRef = db.collection('email_dispatches').doc();
  const dispatchId = dispatchRef.id;

  const initialDispatchData = {
    id: dispatchId,
    dispatchId,
    orderId,
    orderCode: orderData.orderCode || 'ORD',
    customerId: orderData.customerId,
    customerName: customerData.fullName || orderData.customerName || 'Comprador',
    customerEmail: recipientEmail,
    eventId: orderData.eventId,
    eventTitle: eventData.title || orderData.eventTitle || 'Evento SHIKKUM',
    ticketIds: tickets.map((t) => t.id),
    ticketCodes: tickets.map((t) => t.ticketCode),
    status: 'SENDING' as const,
    sentAt: null,
    createdAt: nowIso,
    retryCount,
    errorMessage: null,
    lastAttemptAt: nowIso,
    triggeredBy: operatorUid,
    triggeredByName: operatorName,
    isResend: Boolean(options?.isResend)
  };

  await dispatchRef.set(initialDispatchData);

  // Mapear items para el payload del correo
  const emailTicketItems: TicketEmailItem[] = tickets.map((t) => ({
    ticketId: t.id,
    ticketCode: t.ticketCode,
    attendeeName: t.attendeeSnapshot?.fullName || 'Asistente',
    ticketType: t.attendeeSnapshot?.ticketType || t.attendeeSnapshot?.priceRuleName || 'General',
    qrToken: t.qrToken
  }));

  const emailPayload: TicketEmailPayload = {
    orderId,
    orderCode: orderData.orderCode || 'ORD',
    recipientEmail,
    buyerName: customerData.fullName || orderData.customerName || 'Comprador',
    eventTitle: eventData.title || orderData.eventTitle || 'Evento SHIKKUM',
    eventDate: eventData.date || eventData.startDate || orderData.createdAt || nowIso,
    eventLocation: eventData.venue || eventData.location || 'Sede Oficial del Evento',
    tickets: emailTicketItems,
    dispatchId,
    isResend: Boolean(options?.isResend)
  };

  // Enviar correo a través del proveedor desacoplado
  const sendResult = await emailProvider.sendTicketsEmail(emailPayload);

  if (sendResult.success) {
    const successSentAt = new Date().toISOString();

    // Actualizar registro de despacho a SENT
    await dispatchRef.update({
      status: 'SENT',
      sentAt: successSentAt,
      lastAttemptAt: successSentAt,
      errorMessage: null
    });

    // Actualizar metadata de entrega en cada ticket sin modificar qrToken ni status
    const batch = db.batch();
    for (const t of tickets) {
      const tRef = db.collection('tickets').doc(t.id);
      const currentResend = t.emailDelivery?.resendCount || 0;
      batch.update(tRef, {
        'emailDelivery.status': 'SENT',
        'emailDelivery.recipient': recipientEmail,
        'emailDelivery.sentAt': successSentAt,
        'emailDelivery.resendCount': options?.isResend ? currentResend + 1 : currentResend,
        'emailDelivery.lastDispatchId': dispatchId,
        updatedAt: successSentAt
      });
    }

    // Actualizar metadata en la orden
    batch.update(orderRef, {
      ticketsEmailSent: true,
      ticketsEmailSentAt: successSentAt,
      lastDispatchId: dispatchId,
      updatedAt: successSentAt
    });

    await batch.commit();

    return {
      success: true,
      dispatchId,
      recipient: recipientEmail,
      ticketCount: tickets.length,
      message: `Entradas enviadas correctamente a: ${recipientEmail}`
    };
  } else {
    // Si el proveedor de correo falla:
    // NO regenerar tickets, NO crear nueva orden, NO cambiar el estado del ticket.
    // Registrar FAILED, errorMessage, lastAttemptAt.
    const failTimestamp = new Date().toISOString();
    await dispatchRef.update({
      status: 'FAILED',
      errorMessage: sendResult.error || 'Error al conectar con el servidor de correo.',
      lastAttemptAt: failTimestamp
    });

    return {
      success: false,
      dispatchId,
      recipient: recipientEmail,
      ticketCount: tickets.length,
      message: 'Las entradas fueron generadas correctamente, pero no pudimos enviar el correo.',
      errorMessage: sendResult.error
    };
  }
}

/**
 * Cloud Function 2nd Gen: generateTicketsForOrder
 * Generación server-side idempotente de boletos para una orden en estado PAID.
 * Si se ejecuta una, dos o diez veces, devuelve exactamente los mismos N tickets.
 * Roles autorizados: admin y cashier.
 */
export const generateTicketsForOrder = onCall<{ orderId: string }>(
  {
    cors: true,
    maxInstances: 10
  },
  async (request: CallableRequest<{ orderId: string }>) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Debe estar autenticado.');
    }
    const operator = await validateOperatorUser(request.auth.uid, ['admin', 'cashier']);
    const { orderId } = request.data;
    if (!orderId || typeof orderId !== 'string') {
      throw new HttpsError('invalid-argument', 'El identificador de la orden es obligatorio.');
    }

    const tickets = await issueTicketsForPaidOrder(orderId, operator.uid, operator.displayName);
    return {
      success: true,
      orderId,
      ticketsIssuedCount: tickets.length,
      tickets,
      message: `Se verificaron y generaron ${tickets.length} entradas satisfactoriamente.`
    };
  }
);

/**
 * Cloud Function 2nd Gen: sendTicketsEmail
 * Genera el paquete de entradas y envía el correo al comprador de una orden PAID.
 * Registra el envío en /email_dispatches con idempotencia.
 * Roles autorizados: admin y cashier.
 */
export const sendTicketsEmail = onCall<{ orderId: string }>(
  {
    cors: true,
    maxInstances: 10
  },
  async (request: CallableRequest<{ orderId: string }>) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Debe estar autenticado para enviar entradas por correo.');
    }
    const operator = await validateOperatorUser(request.auth.uid, ['admin', 'cashier']);
    const { orderId } = request.data;

    if (!orderId || typeof orderId !== 'string') {
      throw new HttpsError('invalid-argument', 'El identificador de la orden es obligatorio.');
    }

    return await dispatchTicketsEmailForOrder(orderId, operator.uid, operator.displayName, {
      isResend: false
    });
  }
);

/**
 * Cloud Function 2nd Gen: resendTicketsEmail
 * Permite a Admin y Cashier reenviar el correo de entradas al comprador.
 * Operador de puerta (gate_operator) DENEGADO.
 * Idempotente: utiliza exactamente los tickets existentes sin duplicar ni modificar QRs.
 */
export const resendTicketsEmail = onCall<{
  orderId: string;
  customRecipient?: string;
}>(
  {
    cors: true,
    maxInstances: 10
  },
  async (request: CallableRequest<{ orderId: string; customRecipient?: string }>) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Debe estar autenticado para reenviar entradas.');
    }

    // Solo admin y cashier. Gate operator DENEGADO.
    const operator = await validateOperatorUser(request.auth.uid, ['admin', 'cashier']);
    const { orderId, customRecipient } = request.data;

    if (!orderId || typeof orderId !== 'string') {
      throw new HttpsError('invalid-argument', 'El identificador de la orden es obligatorio.');
    }

    return await dispatchTicketsEmailForOrder(orderId, operator.uid, operator.displayName, {
      isResend: true,
      customRecipient
    });
  }
);
