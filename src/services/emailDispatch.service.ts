import {
  collection,
  getDocs,
  query,
  where,
  limit
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import {
  db,
  functions,
  isFirebaseConfigured,
  isFirestoreHealthy,
  markFirestoreFailure,
  isFunctionsHealthy,
  markFunctionsFailure,
  withTimeout
} from './firebase';
import { EmailDispatch, SendTicketsEmailResponse } from '../types';
import { authService } from './auth.service';
import { orderService } from './order.service';
import { customerService } from './customer.service';
import { ticketService } from './ticket.service';
import { auditService } from './audit.service';

const EMAIL_DISPATCHES_STORAGE_KEY = 'shikkum_email_dispatches_store_v1';

// Semilla inicial de despacho para la orden demo pagada ord_demo_001
const INITIAL_DEMO_DISPATCHES: EmailDispatch[] = [
  {
    id: 'dsp_demo_001',
    dispatchId: 'dsp_demo_001',
    orderId: 'ord_demo_001',
    orderCode: 'SHK-2026-DEMO01',
    customerId: 'cust_demo_001',
    customerName: 'Roberto Gómez',
    customerEmail: 'roberto.gomez@demo.com',
    eventId: 'evt_demo_001',
    eventTitle: 'Conferencia Anual de Tecnología 2026',
    ticketIds: [
      'tkt_ord_demo_001_att_demo_001',
      'tkt_ord_demo_001_att_demo_002'
    ],
    ticketCodes: ['TKT-2026-DEMO01-01', 'TKT-2026-DEMO01-02'],
    status: 'SENT',
    sentAt: '2026-09-02T14:35:05.000Z',
    createdAt: '2026-09-02T14:35:00.000Z',
    retryCount: 0,
    errorMessage: null,
    lastAttemptAt: '2026-09-02T14:35:05.000Z',
    triggeredBy: 'usr_cashier_01',
    triggeredByName: 'Carlos Cobranzas',
    isResend: false
  }
];

class EmailDispatchService {
  /**
   * Obtener todos los despachos de correo registrados para una orden
   */
  async getDispatchesByOrderId(orderId: string): Promise<EmailDispatch[]> {
    if (isFirebaseConfigured && db && isFirestoreHealthy()) {
      try {
        const q = query(
          collection(db, 'email_dispatches'),
          where('orderId', '==', orderId)
        );
        const snapshot = await withTimeout(getDocs(q), 800);
        const list: EmailDispatch[] = [];
        snapshot.forEach((d) => list.push(d.data() as EmailDispatch));
        if (list.length > 0) {
          list.sort(
            (a, b) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
          return list;
        }
      } catch (err: any) {
        markFirestoreFailure(err);
      }
    }

    const localDispatches = this.getLocalDispatches();
    return localDispatches
      .filter((d) => d.orderId === orderId)
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
  }

  /**
   * Obtener el despacho más reciente para una orden
   */
  async getLatestDispatchForOrder(orderId: string): Promise<EmailDispatch | null> {
    const list = await this.getDispatchesByOrderId(orderId);
    return list.length > 0 ? list[0] : null;
  }

  /**
   * Obtener todos los despachos para módulo de control de correos
   */
  async getAllDispatches(limitCount = 100): Promise<EmailDispatch[]> {
    if (isFirebaseConfigured && db && isFirestoreHealthy()) {
      try {
        const q = query(collection(db, 'email_dispatches'), limit(limitCount));
        const snapshot = await withTimeout(getDocs(q), 800);
        if (!snapshot.empty) {
          const list: EmailDispatch[] = [];
          snapshot.forEach((d) => list.push(d.data() as EmailDispatch));
          list.sort(
            (a, b) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
          return list;
        }
      } catch (err: any) {
        markFirestoreFailure(err);
      }
    }

    const localDispatches = this.getLocalDispatches();
    return [...localDispatches]
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
      .slice(0, limitCount);
  }

  /**
   * Enviar correo con el paquete de entradas al comprador de una orden pagada
   */
  async sendTicketsEmail(orderId: string): Promise<SendTicketsEmailResponse> {
    const currentUser = authService.getCurrentUser();
    if (!currentUser) {
      throw new Error('Debe estar autenticado para enviar entradas por correo.');
    }
    if (!currentUser.isActive) {
      throw new Error('El operador se encuentra inactivo.');
    }
    if (currentUser.role !== 'admin' && currentUser.role !== 'cashier') {
      throw new Error(
        `Rol no autorizado (${currentUser.role}). Se requiere rol de Administrador o Cobranzas.`
      );
    }

    // 1. Intentar llamar a Cloud Function 2nd Gen si está disponible
    if (functions && isFunctionsHealthy()) {
      try {
        const fn = httpsCallable<{ orderId: string }, SendTicketsEmailResponse>(
          functions,
          'sendTicketsEmail'
        );
        const res = await withTimeout(fn({ orderId }), 12000);
        if (res?.data) {
          // Sincronizar estado local con resultado real del servidor
          this.syncLocalAfterDispatch(orderId, res.data);
          return res.data;
        }
      } catch (fnError: any) {
        markFunctionsFailure(fnError);
        if (isFirebaseConfigured) {
          return {
            success: false,
            orderId,
            dispatchId: `dsp_fail_${Date.now()}`,
            status: 'FAILED',
            recipient: 'desconocido@shikkum.internal',
            ticketCount: 0,
            message: 'Las entradas están vigentes pero no se pudo contactar el servicio de correo.',
            errorMessage: fnError?.message || 'Error en Cloud Function sendTicketsEmail.'
          };
        }
      }
    }

    if (isFirebaseConfigured) {
      return {
        success: false,
        orderId,
        dispatchId: `dsp_fail_${Date.now()}`,
        status: 'FAILED',
        recipient: 'desconocido@shikkum.internal',
        ticketCount: 0,
        message: 'Servicio de correo de Firebase no disponible.',
        errorMessage: 'Functions no disponibles.'
      };
    }

    // 2. Sandbox Local / Directo (Solo si Firebase no está configurado)
    return this.executeLocalSendTicketsEmail(orderId, currentUser, false);
  }

  /**
   * Reenviar el correo de entradas al comprador con estricta idempotencia y auditoría
   */
  async resendTicketsEmail(
    orderId: string,
    customRecipient?: string
  ): Promise<SendTicketsEmailResponse> {
    const currentUser = authService.getCurrentUser();
    if (!currentUser) {
      throw new Error('Debe estar autenticado para reenviar entradas.');
    }
    if (!currentUser.isActive) {
      throw new Error('El operador se encuentra inactivo.');
    }
    if (currentUser.role !== 'admin' && currentUser.role !== 'cashier') {
      throw new Error(
        `Rol no autorizado (${currentUser.role}). El Operador de Puerta no puede reenviar correos.`
      );
    }

    // 1. Intentar llamar a Cloud Function 2nd Gen si está disponible
    if (functions && isFunctionsHealthy()) {
      try {
        const fn = httpsCallable<
          { orderId: string; customRecipient?: string },
          SendTicketsEmailResponse
        >(functions, 'resendTicketsEmail');
        const res = await withTimeout(fn({ orderId, customRecipient }), 12000);
        if (res?.data) {
          this.syncLocalAfterDispatch(orderId, res.data, true);
          return res.data;
        }
      } catch (fnError: any) {
        markFunctionsFailure(fnError);
        if (isFirebaseConfigured) {
          return {
            success: false,
            orderId,
            dispatchId: `dsp_fail_${Date.now()}`,
            status: 'FAILED',
            recipient: customRecipient || 'desconocido@shikkum.internal',
            ticketCount: 0,
            message: 'No se pudo completar el reenvío del correo.',
            errorMessage: fnError?.message || 'Error en Cloud Function resendTicketsEmail.'
          };
        }
      }
    }

    if (isFirebaseConfigured) {
      return {
        success: false,
        orderId,
        dispatchId: `dsp_fail_${Date.now()}`,
        status: 'FAILED',
        recipient: customRecipient || 'desconocido@shikkum.internal',
        ticketCount: 0,
        message: 'Servicio de reenvío de correo de Firebase no disponible.',
        errorMessage: 'Functions no disponibles.'
      };
    }

    // 2. Sandbox Local / Directo (Solo si Firebase no está configurado)
    return this.executeLocalSendTicketsEmail(orderId, currentUser, true, customRecipient);
  }

  /**
   * Ejecución en sandbox local con auditoría completa e idempotencia
   */
  private async executeLocalSendTicketsEmail(
    orderId: string,
    operator: { uid: string; displayName?: string },
    isResend: boolean,
    customRecipient?: string
  ): Promise<SendTicketsEmailResponse> {
    const order = await orderService.getOrderById(orderId);
    if (!order) {
      throw new Error(`La orden ${orderId} no existe.`);
    }

    // Regla de condición estricta: Solo enviar entradas para PAID
    if (order.status !== 'PAID') {
      throw new Error(
        `No se pueden enviar entradas para órdenes en estado ${order.status}. La orden debe estar PAGADA.`
      );
    }

    // Obtener tickets existentes
    let tickets = await ticketService.getTicketsByOrderId(orderId);

    if (tickets.length === 0) {
      if (isResend) {
        throw new Error('No existen boletos generados para esta orden.');
      }
      // Emitir boletos idempotentemente
      tickets = await ticketService.issueLocalTicketsForPaidOrder(orderId, operator);
    }

    // Obtener datos del cliente comprador
    const customer = await customerService.getCustomerById(order.customerId);
    const recipientEmail = customRecipient
      ? customRecipient.trim()
      : customer?.email || 'cliente@shikkum.internal';

    const nowIso = new Date().toISOString();
    const localDispatches = this.getLocalDispatches();
    const previousAttempts = localDispatches.filter((d) => d.orderId === orderId);
    const retryCount = previousAttempts.length;

    // Validar formato de email
    const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail);

    const dispatchId = `dsp_${orderId}_${Date.now()}`;

    if (!isValidEmail) {
      // Registro FAILED sin tocar los tickets ni la orden
      const failedDispatch: EmailDispatch = {
        id: dispatchId,
        dispatchId,
        orderId,
        orderCode: order.orderCode,
        customerId: order.customerId,
        customerName: customer?.fullName || order.customerName || 'Comprador',
        customerEmail: recipientEmail,
        eventId: order.eventId,
        eventTitle: order.eventTitle,
        ticketIds: tickets.map((t) => t.id),
        ticketCodes: tickets.map((t) => t.ticketCode),
        status: 'FAILED',
        sentAt: null,
        createdAt: nowIso,
        retryCount: retryCount + 1,
        errorMessage: `Dirección de correo inválida: '${recipientEmail}'`,
        lastAttemptAt: nowIso,
        triggeredBy: operator.uid,
        triggeredByName: operator.displayName || 'Operador',
        isResend
      };

      localDispatches.unshift(failedDispatch);
      this.saveLocalDispatches(localDispatches);

      return {
        success: false,
        orderId,
        dispatchId,
        status: 'FAILED',
        recipient: recipientEmail,
        ticketCount: tickets.length,
        message: 'Las entradas fueron generadas correctamente, pero no pudimos enviar el correo.',
        errorMessage: failedDispatch.errorMessage || undefined
      };
    }

    // Envío Exitoso: Registrar dispatch SENT
    const successfulDispatch: EmailDispatch = {
      id: dispatchId,
      dispatchId,
      orderId,
      orderCode: order.orderCode,
      customerId: order.customerId,
      customerName: customer?.fullName || order.customerName || 'Comprador',
      customerEmail: recipientEmail,
      eventId: order.eventId,
      eventTitle: order.eventTitle,
      ticketIds: tickets.map((t) => t.id),
      ticketCodes: tickets.map((t) => t.ticketCode),
      status: 'SENT',
      sentAt: nowIso,
      createdAt: nowIso,
      retryCount: isResend ? retryCount + 1 : 0,
      errorMessage: null,
      lastAttemptAt: nowIso,
      triggeredBy: operator.uid,
      triggeredByName: operator.displayName || 'Operador',
      isResend
    };

    localDispatches.unshift(successfulDispatch);
    this.saveLocalDispatches(localDispatches);

    // Actualizar metadata de entrega en cada ticket sin modificar status ni qrToken
    const allLocalTickets = ticketService.getLocalTickets();
    for (const t of tickets) {
      const idx = allLocalTickets.findIndex((item) => item.id === t.id);
      if (idx !== -1) {
        const currentResend = allLocalTickets[idx].emailDelivery?.resendCount || 0;
        allLocalTickets[idx] = {
          ...allLocalTickets[idx],
          emailDelivery: {
            status: 'SENT',
            recipient: recipientEmail,
            sentAt: nowIso,
            resendCount: isResend ? currentResend + 1 : currentResend,
            lastResentBy: isResend ? operator.uid : undefined,
            lastResentByName: isResend ? operator.displayName : undefined,
            lastResentAt: isResend ? nowIso : undefined
          },
          updatedAt: nowIso
        };
      }
    }
    ticketService.saveLocalTickets(allLocalTickets);

    try {
      await auditService.logEvent({
        action: isResend ? 'TICKET_RESENT' : 'TICKET_SENT',
        entityType: 'order',
        entityId: orderId,
        metadata: {
          dispatchId,
          orderCode: order.orderCode,
          recipient: recipientEmail,
          ticketCount: tickets.length,
          isResend
        }
      });
    } catch (e) {
      console.warn('[EmailDispatchService] Error al registrar evento de auditoría:', e);
    }

    return {
      success: true,
      orderId,
      dispatchId,
      status: 'SENT',
      recipient: recipientEmail,
      ticketCount: tickets.length,
      message: `Entradas enviadas correctamente a: ${recipientEmail}`
    };
  }

  private syncLocalAfterDispatch(
    orderId: string,
    res: SendTicketsEmailResponse,
    isResend = false
  ) {
    const localDispatches = this.getLocalDispatches();
    const nowIso = new Date().toISOString();
    const currentUser = authService.getCurrentUser();

    const dispatchRecord: EmailDispatch = {
      id: res.dispatchId || `dsp_${orderId}_${Date.now()}`,
      dispatchId: res.dispatchId || `dsp_${orderId}_${Date.now()}`,
      orderId,
      customerId: 'cust_synced',
      customerEmail: res.recipient,
      eventId: 'evt_synced',
      ticketIds: [],
      status: res.status,
      sentAt: res.status === 'SENT' ? nowIso : null,
      createdAt: nowIso,
      retryCount: isResend ? 1 : 0,
      errorMessage: res.errorMessage || null,
      lastAttemptAt: nowIso,
      triggeredBy: currentUser?.uid || 'usr_synced',
      triggeredByName: currentUser?.displayName || 'Operador',
      isResend
    };

    localDispatches.unshift(dispatchRecord);
    this.saveLocalDispatches(localDispatches);
  }

  getLocalDispatches(): EmailDispatch[] {
    try {
      const raw = localStorage.getItem(EMAIL_DISPATCHES_STORAGE_KEY);
      if (!raw) {
        localStorage.setItem(
          EMAIL_DISPATCHES_STORAGE_KEY,
          JSON.stringify(INITIAL_DEMO_DISPATCHES)
        );
        return [...INITIAL_DEMO_DISPATCHES];
      }
      return JSON.parse(raw);
    } catch {
      return [...INITIAL_DEMO_DISPATCHES];
    }
  }

  saveLocalDispatches(dispatches: EmailDispatch[]): void {
    try {
      localStorage.setItem(
        EMAIL_DISPATCHES_STORAGE_KEY,
        JSON.stringify(dispatches)
      );
    } catch (err) {
      console.warn(
        '[EmailDispatchService] Error guardando email_dispatches en localStorage:',
        err
      );
    }
  }
}

export const emailDispatchService = new EmailDispatchService();
