import { onCall, HttpsError, CallableRequest } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { dispatchTicketsEmailForOrder } from './emailDispatchFunctions';

// Inicializar Admin SDK si no ha sido inicializado
if (admin.apps.length === 0) {
  admin.initializeApp();
}

const db = admin.firestore();

export type PaymentMethod = 'CASH' | 'BANK_TRANSFER' | 'CARD' | 'OTHER';
export type PaymentStatus = 'PENDING' | 'CONFIRMED' | 'REJECTED';

interface RegisterPaymentData {
  orderId: string;
  amount: number;
  method: PaymentMethod;
  reference?: string;
  proofStoragePath?: string;
  proofUrl?: string;
  notes?: string;
  autoConfirm?: boolean;
}

interface ConfirmPaymentData {
  paymentId: string;
}

interface RejectPaymentData {
  paymentId: string;
  reason: string;
}

/**
 * Validador común de usuario operador activo
 */
async function validateOperatorUser(callerUid: string) {
  const userDoc = await db.collection('users').doc(callerUid).get();
  if (!userDoc.exists) {
    throw new HttpsError('permission-denied', 'El usuario operador no se encuentra registrado en el sistema.');
  }
  const userData = userDoc.data();
  if (!userData || !userData.isActive) {
    throw new HttpsError('permission-denied', 'El usuario operador se encuentra inactivo. Operación denegada.');
  }
  if (userData.role !== 'admin' && userData.role !== 'cashier') {
    throw new HttpsError('permission-denied', 'Solo Administrador y Cobranzas tienen autorización para gestionar pagos.');
  }
  return {
    uid: callerUid,
    role: userData.role as string,
    displayName: userData.displayName || userData.email || 'Operador SHIKKUM'
  };
}

/**
 * Cloud Function 2nd Gen: registerPayment
 * Registra un pago vinculado a una orden en estado PENDING_PAYMENT
 */
export const registerPayment = onCall<RegisterPaymentData>(
  {
    cors: true,
    maxInstances: 10
  },
  async (request: CallableRequest<RegisterPaymentData>) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Debe estar autenticado para registrar pagos.');
    }

    const operator = await validateOperatorUser(request.auth.uid);
    const { orderId, amount, method, reference, proofStoragePath, proofUrl, notes, autoConfirm } = request.data;

    if (!orderId || typeof orderId !== 'string') {
      throw new HttpsError('invalid-argument', 'El identificador de la orden (orderId) es obligatorio.');
    }

    const validMethods: PaymentMethod[] = ['CASH', 'BANK_TRANSFER', 'CARD', 'OTHER'];
    if (!method || !validMethods.includes(method)) {
      throw new HttpsError('invalid-argument', 'Método de pago no válido.');
    }

    if (method === 'BANK_TRANSFER' && !proofStoragePath && !proofUrl) {
      throw new HttpsError('invalid-argument', 'El comprobante es obligatorio para transferencias bancarias.');
    }

    const nowIso = new Date().toISOString();

    const result = await db.runTransaction(async (transaction) => {
      const orderRef = db.collection('orders').doc(orderId);
      const orderDoc = await transaction.get(orderRef);

      if (!orderDoc.exists) {
        throw new HttpsError('not-found', 'No se encontró la orden especificada.');
      }

      const orderData = orderDoc.data()!;

      if (orderData.status === 'PAID') {
        throw new HttpsError('failed-precondition', 'La orden ya fue pagada.');
      }

      if (orderData.status === 'CANCELLED') {
        throw new HttpsError('failed-precondition', 'La orden fue cancelada y no admite pagos.');
      }

      if (orderData.status !== 'PENDING_PAYMENT') {
        throw new HttpsError('failed-precondition', `La orden no admite pagos en su estado actual (${orderData.status}).`);
      }

      if (orderData.currency !== 'USD') {
        throw new HttpsError('invalid-argument', 'La moneda de la orden debe ser USD estrictamente.');
      }

      // Validación estricta del total de la orden contra el monto del pago
      if (typeof amount !== 'number' || isNaN(amount) || Math.abs(amount - orderData.total) > 0.001) {
        throw new HttpsError(
          'invalid-argument',
          `El monto del pago ($${amount}) no coincide con el total requerido de la orden ($${orderData.total}).`
        );
      }

      // Verificar si ya existe un pago confirmado para esta orden
      const existingPaymentsQuery = await db
        .collection('payments')
        .where('orderId', '==', orderId)
        .get();

      for (const pDoc of existingPaymentsQuery.docs) {
        const pData = pDoc.data();
        if (pData.status === 'CONFIRMED') {
          throw new HttpsError('failed-precondition', 'La orden ya tiene un pago confirmado registrado.');
        }
      }

      const paymentRef = db.collection('payments').doc();
      const isConfirmed = Boolean(autoConfirm);

      const paymentPayload: any = {
        id: paymentRef.id,
        orderId: orderData.id || orderId,
        orderCode: orderData.orderCode,
        amount: orderData.total,
        currency: 'USD',
        method,
        status: isConfirmed ? 'CONFIRMED' : 'PENDING',
        reference: reference ? String(reference).trim() : '',
        proofStoragePath: proofStoragePath || '',
        proofUrl: proofUrl || '',
        notes: notes ? String(notes).trim() : '',
        registeredBy: operator.uid,
        registeredByName: operator.displayName,
        registeredAt: nowIso,
        updatedAt: nowIso
      };

      if (isConfirmed) {
        paymentPayload.confirmedBy = operator.uid;
        paymentPayload.confirmedByName = operator.displayName;
        paymentPayload.confirmedAt = nowIso;

        // Actualizar la orden a PAID atómicamente
        transaction.update(orderRef, {
          status: 'PAID',
          updatedAt: nowIso
        });
      }

      transaction.set(paymentRef, paymentPayload);

      return {
        success: true,
        paymentId: paymentRef.id,
        orderId,
        orderCode: orderData.orderCode,
        amount: orderData.total,
        status: paymentPayload.status
      };
    });

    // Si el pago fue confirmado automáticamente, emitir boletos y despachar correo server-side
    if (result.status === 'CONFIRMED') {
      try {
        await dispatchTicketsEmailForOrder(result.orderId, operator.uid, operator.displayName);
      } catch (dispatchError) {
        console.error('[SHIKKUM] Error despachando boletos/correo en registerPayment:', dispatchError);
      }
    }

    return result;
  }
);

/**
 * Cloud Function 2nd Gen: confirmPayment
 * Responsabilidad estricta según Prompt 05 Sección 11 y 12:
 * 1. Validar autenticación
 * 2. Validar usuario activo
 * 3. Validar rol
 * 4. Obtener payment
 * 5. Obtener order
 * 6. Verificar que la orden exista
 * 7. Verificar que esté PENDING_PAYMENT
 * 8. Verificar que el pago exista
 * 9. Verificar payment.amount === order.total
 * 10. Validar que el pago esté en estado correcto (Idempotencia)
 * 11. Cambiar payment: CONFIRMED
 * 12. Cambiar order: PAID
 * 13. Guardar confirmedBy, confirmedAt
 * 14. Realizarlo atómicamente
 */
export const confirmPayment = onCall<ConfirmPaymentData>(
  {
    cors: true,
    maxInstances: 10
  },
  async (request: CallableRequest<ConfirmPaymentData>) => {
    // 1. Validar autenticación
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Debe estar autenticado para confirmar pagos.');
    }

    // 2 y 3. Validar usuario activo y rol
    const operator = await validateOperatorUser(request.auth.uid);
    const { paymentId } = request.data;

    if (!paymentId || typeof paymentId !== 'string') {
      throw new HttpsError('invalid-argument', 'El identificador del pago (paymentId) es obligatorio.');
    }

    const nowIso = new Date().toISOString();

    const result = await db.runTransaction(async (transaction) => {
      // 4 y 8. Obtener y verificar que el pago exista
      const paymentRef = db.collection('payments').doc(paymentId);
      const paymentDoc = await transaction.get(paymentRef);

      if (!paymentDoc.exists) {
        throw new HttpsError('not-found', 'No se encontró el registro de pago.');
      }

      const paymentData = paymentDoc.data()!;

      // 10 y 12. Idempotencia: si ya está confirmado, responder de forma controlada
      if (paymentData.status === 'CONFIRMED') {
        return {
          success: true,
          isIdempotentReplay: true,
          message: 'El pago ya fue confirmado previamente.',
          paymentId: paymentDoc.id,
          orderId: paymentData.orderId,
          orderCode: paymentData.orderCode,
          status: 'CONFIRMED'
        };
      }

      if (paymentData.status === 'REJECTED') {
        throw new HttpsError('failed-precondition', 'El pago fue rechazado previamente y no puede ser confirmado.');
      }

      if (paymentData.status !== 'PENDING') {
        throw new HttpsError('failed-precondition', `El estado del pago (${paymentData.status}) no permite confirmación.`);
      }

      // 6. Verificar que la orden exista y corresponda
      const orderRef = db.collection('orders').doc(paymentData.orderId);
      const orderDoc = await transaction.get(orderRef);

      if (!orderDoc.exists) {
        throw new HttpsError('not-found', 'No se encontró la orden vinculada al pago.');
      }

      const orderData = orderDoc.data()!;

      // 9. Verificar coincidencia estricta de orderId
      if (paymentData.orderId !== orderDoc.id) {
        throw new HttpsError('failed-precondition', 'El identificador de la orden no coincide con el registro de pago.');
      }

      // 7. Verificar que la orden esté estrictamente en estado PENDING_PAYMENT
      if (orderData.status === 'PAID') {
        throw new HttpsError('failed-precondition', 'La orden ya se encuentra en estado PAID. No se admite la confirmación de otro pago.');
      }

      if (orderData.status === 'CANCELLED') {
        throw new HttpsError('failed-precondition', 'La orden fue cancelada y no puede ser pagada.');
      }

      if (orderData.status !== 'PENDING_PAYMENT') {
        throw new HttpsError('failed-precondition', `La orden no está pendiente de pago (Estado actual: ${orderData.status}).`);
      }

      // 10. Verificar coincidencia exacta de monto
      if (
        typeof paymentData.amount !== 'number' ||
        isNaN(paymentData.amount) ||
        Math.abs(paymentData.amount - orderData.total) > 0.001
      ) {
        throw new HttpsError(
          'invalid-argument',
          `El monto del pago ($${paymentData.amount}) no coincide con el total de la orden ($${orderData.total}).`
        );
      }

      // 11. Verificar moneda USD
      if (paymentData.currency !== 'USD' || orderData.currency !== 'USD') {
        throw new HttpsError('invalid-argument', 'La moneda de la orden y del pago debe ser USD estrictamente.');
      }

      // 12. Verificar que no exista ya otro pago confirmado para esta orden
      const otherConfirmedQuery = await db
        .collection('payments')
        .where('orderId', '==', orderDoc.id)
        .where('status', '==', 'CONFIRMED')
        .get();

      for (const otherDoc of otherConfirmedQuery.docs) {
        if (otherDoc.id !== paymentDoc.id) {
          throw new HttpsError(
            'failed-precondition',
            `La orden ya cuenta con otro pago confirmado (${otherDoc.id}). No se permiten múltiples pagos confirmados.`
          );
        }
      }

      // 11, 12, 13 y 14. Realizar actualización atómica
      transaction.update(paymentRef, {
        status: 'CONFIRMED',
        confirmedBy: operator.uid,
        confirmedByName: operator.displayName,
        confirmedAt: nowIso,
        updatedAt: nowIso
      });

      transaction.update(orderRef, {
        status: 'PAID',
        updatedAt: nowIso
      });

      return {
        success: true,
        isIdempotentReplay: false,
        paymentId: paymentDoc.id,
        orderId: orderData.id || paymentData.orderId,
        orderCode: orderData.orderCode,
        amount: paymentData.amount,
        status: 'CONFIRMED',
        orderStatus: 'PAID',
        confirmedAt: nowIso
      };
    });

    // Emitir tickets y despachar correo server-side si no es un replay idempotente
    if (!result.isIdempotentReplay && result.status === 'CONFIRMED') {
      try {
        await dispatchTicketsEmailForOrder(result.orderId, operator.uid, operator.displayName);
      } catch (dispatchError) {
        console.error('[SHIKKUM] Error despachando boletos/correo en confirmPayment:', dispatchError);
      }
    }

    return result;
  }
);

/**
 * Cloud Function 2nd Gen: rejectPayment
 * Permite rechazar un pago con motivo documentado de auditoría
 */
export const rejectPayment = onCall<RejectPaymentData>(
  {
    cors: true,
    maxInstances: 10
  },
  async (request: CallableRequest<RejectPaymentData>) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Debe estar autenticado para rechazar pagos.');
    }

    const operator = await validateOperatorUser(request.auth.uid);
    const { paymentId, reason } = request.data;

    if (!paymentId || typeof paymentId !== 'string') {
      throw new HttpsError('invalid-argument', 'El identificador del pago (paymentId) es obligatorio.');
    }

    if (!reason || typeof reason !== 'string' || reason.trim().length < 3) {
      throw new HttpsError('invalid-argument', 'Debe proporcionar un motivo de rechazo válido (mínimo 3 caracteres).');
    }

    const nowIso = new Date().toISOString();

    return await db.runTransaction(async (transaction) => {
      const paymentRef = db.collection('payments').doc(paymentId);
      const paymentDoc = await transaction.get(paymentRef);

      if (!paymentDoc.exists) {
        throw new HttpsError('not-found', 'No se encontró el registro de pago.');
      }

      const paymentData = paymentDoc.data()!;

      // Idempotencia si ya está rechazado
      if (paymentData.status === 'REJECTED') {
        return {
          success: true,
          isIdempotentReplay: true,
          message: 'El pago ya se encuentra rechazado.',
          paymentId: paymentDoc.id,
          status: 'REJECTED'
        };
      }

      if (paymentData.status === 'CONFIRMED') {
        throw new HttpsError('failed-precondition', 'No se puede rechazar un pago que ya fue confirmado.');
      }

      // Actualizar pago a REJECTED conservando el registro
      // La orden permanece en PENDING_PAYMENT (nunca se pasa a PAID)
      transaction.update(paymentRef, {
        status: 'REJECTED',
        rejectedBy: operator.uid,
        rejectedByName: operator.displayName,
        rejectedAt: nowIso,
        rejectionReason: reason.trim(),
        updatedAt: nowIso
      });

      return {
        success: true,
        paymentId: paymentDoc.id,
        orderId: paymentData.orderId,
        status: 'REJECTED',
        rejectionReason: reason.trim(),
        rejectedAt: nowIso
      };
    });
  }
);
