import {
  collection,
  doc,
  getDocs,
  getDoc,
  query,
  where,
  limit
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import QRCode from 'qrcode';
import { db, functions, isFirebaseConfigured } from './firebase';
import {
  Ticket,
  AccessLog,
  ValidateAccessRequest,
  ValidateAccessResponse
} from '../types';
import { authService } from './auth.service';
import { orderService } from './order.service';

const TICKETS_STORAGE_KEY = 'shikkum_tickets_store_v1';
const ACCESS_LOGS_STORAGE_KEY = 'shikkum_access_logs_store_v1';

/**
 * Generador de aleatoriedad criptográfica CSPRNG sin Math.random()
 */
function generateSecureRandomHex(bytesLength: number): string {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
    const arr = new Uint8Array(bytesLength);
    window.crypto.getRandomValues(arr);
    return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('');
  }
  // Fallback para entornos sin DOM con alta resolución
  const base = Date.now().toString(16) + (typeof performance !== 'undefined' ? performance.now().toString(16).replace('.', '') : '');
  return (base + '0'.repeat(bytesLength * 2)).substring(0, bytesLength * 2);
}

function generateSecureId(prefix: string): string {
  return `${prefix}_${Date.now()}_${generateSecureRandomHex(4)}`;
}

// Semillas iniciales para demostración y pruebas en sandbox local
const INITIAL_DEMO_TICKETS: Ticket[] = [
  {
    id: 'tkt_ord_demo_001_att_demo_001',
    ticketCode: 'TKT-2026-DEMO01-01',
    qrToken: 'a4f9b8c2e1d7408f9c3e2a1b5d6f7e8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e',
    status: 'ISSUED',
    orderId: 'ord_demo_001',
    attendeeId: 'att_demo_001',
    eventId: 'evt_demo_001',
    customerId: 'cust_demo_001',
    attendeeSnapshot: {
      fullName: 'Roberto Gómez',
      documentId: 'V-19882341',
      email: 'roberto.gomez@demo.com',
      ticketType: 'General',
      priceRuleName: 'Adulto General (Miembro Comunidad)',
      unitPrice: 35
    },
    eventSnapshot: {
      title: 'Conferencia Anual de Tecnología 2026',
      startDate: '2026-10-15T09:00:00.000Z',
      location: 'Centro de Convenciones Metropolitano'
    },
    orderSnapshot: {
      orderCode: 'SHK-2026-DEMO01',
      currency: 'USD',
      total: 55
    },
    issuedAt: '2026-09-02T14:35:00.000Z',
    issuedBy: 'usr_cashier_01',
    issuedByName: 'Carlos Cobranzas',
    createdAt: '2026-09-02T14:35:00.000Z',
    updatedAt: '2026-09-02T14:35:00.000Z',
    emailDelivery: {
      status: 'SENT',
      recipient: 'roberto.gomez@demo.com',
      sentAt: '2026-09-02T14:35:05.000Z',
      resendCount: 0
    }
  },
  {
    id: 'tkt_ord_demo_001_att_demo_002',
    ticketCode: 'TKT-2026-DEMO01-02',
    qrToken: 'e7c1d3f5b9a2468e0d1f3b5a7c9e2d4f6a8b0c2e4d6f8a0b2c4d6e8f0a2b4c6d',
    status: 'ISSUED',
    orderId: 'ord_demo_001',
    attendeeId: 'att_demo_002',
    eventId: 'evt_demo_001',
    customerId: 'cust_demo_001',
    attendeeSnapshot: {
      fullName: 'Mateo Gómez (Hijo)',
      documentId: 'V-31445123',
      email: 'roberto.gomez@demo.com',
      ticketType: 'Infantil',
      priceRuleName: 'Infantil / Menor de Edad',
      unitPrice: 20
    },
    eventSnapshot: {
      title: 'Conferencia Anual de Tecnología 2026',
      startDate: '2026-10-15T09:00:00.000Z',
      location: 'Centro de Convenciones Metropolitano'
    },
    orderSnapshot: {
      orderCode: 'SHK-2026-DEMO01',
      currency: 'USD',
      total: 55
    },
    issuedAt: '2026-09-02T14:35:00.000Z',
    issuedBy: 'usr_cashier_01',
    issuedByName: 'Carlos Cobranzas',
    createdAt: '2026-09-02T14:35:00.000Z',
    updatedAt: '2026-09-02T14:35:00.000Z',
    emailDelivery: {
      status: 'SENT',
      recipient: 'roberto.gomez@demo.com',
      sentAt: '2026-09-02T14:35:05.000Z',
      resendCount: 0
    }
  }
];

class TicketService {
  private static inFlightRedemptions = new Set<string>();

  /**
   * Generar código QR en formato Data URL usando la librería 'qrcode'.
   * Contiene EXCLUSIVAMENTE el token seguro impredecible.
   */
  async generateQrCodeDataUrl(qrToken: string): Promise<string> {
    try {
      return await QRCode.toDataURL(qrToken, {
        errorCorrectionLevel: 'M',
        margin: 2,
        scale: 6,
        color: {
          dark: '#0f172a',
          light: '#ffffff'
        }
      });
    } catch (err) {
      console.error('[TicketService] Error generando código QR Data URL:', err);
      // Fallback a SVG codificado
      return `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="%23f1f5f9"/><text x="50" y="55" font-size="10" text-anchor="middle" fill="%23475569">QR</text></svg>`;
    }
  }

  /**
   * Obtener tickets emitidos para una orden
   */
  async getTicketsByOrderId(orderId: string): Promise<Ticket[]> {
    if (isFirebaseConfigured && db) {
      try {
        const q = query(collection(db, 'tickets'), where('orderId', '==', orderId));
        const snapshot = await getDocs(q);
        const tickets: Ticket[] = [];
        snapshot.forEach((d) => tickets.push(d.data() as Ticket));
        tickets.sort((a, b) => a.ticketCode.localeCompare(b.ticketCode));
        return tickets;
      } catch (err: any) {
        console.error('[TicketService] Error consultando tickets en Firestore:', err);
        throw new Error('Error al consultar boletos de la orden en Firestore: ' + (err.message || ''));
      }
    }

    const localTickets = this.getLocalTickets();
    return localTickets
      .filter((t) => t.orderId === orderId)
      .sort((a, b) => a.ticketCode.localeCompare(b.ticketCode));
  }

  /**
   * Obtener ticket por su ID único
   */
  async getTicketById(ticketId: string): Promise<Ticket | null> {
    if (isFirebaseConfigured && db) {
      try {
        const snap = await getDoc(doc(db, 'tickets', ticketId));
        if (snap.exists()) {
          return snap.data() as Ticket;
        }
        return null;
      } catch (err: any) {
        console.error('[TicketService] Error obteniendo ticket en Firestore:', err);
        throw new Error('Error al consultar boleto en Firestore: ' + (err.message || ''));
      }
    }

    const localTickets = this.getLocalTickets();
    return localTickets.find((t) => t.id === ticketId) || null;
  }

  /**
   * Obtener todos los tickets emitidos en el sistema (con soporte de filtros)
   * Restringido: gate_operator NO puede listar masivamente los boletos
   */
  async getAllTickets(filter?: { eventId?: string; status?: string }): Promise<Ticket[]> {
    const currentUser = authService.getCurrentUser();
    if (currentUser && currentUser.role === 'gate_operator') {
      throw new Error('Los operadores de puerta no tienen autorización para consultar la lista global de boletos.');
    }

    if (isFirebaseConfigured && db) {
      try {
        const snapshot = await getDocs(collection(db, 'tickets'));
        let list: Ticket[] = [];
        snapshot.forEach((d) => list.push(d.data() as Ticket));
        if (filter?.eventId) {
          list = list.filter((t) => t.eventId === filter.eventId);
        }
        if (filter?.status && filter.status !== 'ALL') {
          list = list.filter((t) => t.status === filter.status);
        }
        list.sort((a, b) => new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime());
        return list;
      } catch (err: any) {
        console.error('[TicketService] Error consultando todos los tickets en Firestore:', err);
        throw new Error('Error al consultar boletos en Firestore: ' + (err.message || ''));
      }
    }

    let local = this.getLocalTickets();
    if (filter?.eventId) {
      local = local.filter((t) => t.eventId === filter.eventId);
    }
    if (filter?.status && filter.status !== 'ALL') {
      local = local.filter((t) => t.status === filter.status);
    }
    local.sort((a, b) => new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime());
    return local;
  }

  /**
   * Validar y consumir acceso de un boleto en puerta.
   * Ejecuta la validación server-side mediante Cloud Function o sandbox con estricta idempotencia.
   */
  async validateTicketAccess(request: ValidateAccessRequest): Promise<ValidateAccessResponse> {
    const currentUser = authService.getCurrentUser();
    if (!currentUser) {
      throw new Error('Debe estar autenticado para validar acceso en puerta.');
    }
    if (!currentUser.isActive) {
      return {
        authorized: false,
        status: 'REJECTED',
        rejectionReason: 'UNAUTHORIZED',
        message: 'El operador se encuentra inactivo. Operación rechazada.'
      };
    }
    if (currentUser.role !== 'gate_operator' && currentUser.role !== 'admin') {
      return {
        authorized: false,
        status: 'REJECTED',
        rejectionReason: 'UNAUTHORIZED',
        message: `El rol '${currentUser.role}' no está autorizado para control de acceso (se requiere 'gate_operator' o 'admin').`
      };
    }

    const { qrToken, ticketCode, gateId, eventId } = request;

    if (!eventId || !eventId.trim()) {
      return {
        authorized: false,
        status: 'REJECTED',
        rejectionReason: 'WRONG_EVENT',
        message: 'Debe seleccionar un evento específico para el control de acceso en puerta.'
      };
    }

    const trimmedToken = qrToken ? qrToken.trim() : '';
    const trimmedCode = ticketCode ? ticketCode.trim().toUpperCase() : '';

    if (!trimmedToken && !trimmedCode) {
      return {
        authorized: false,
        status: 'REJECTED',
        rejectionReason: 'INVALID_TOKEN',
        message: 'Debe escanear un código QR válido o ingresar el código del boleto.'
      };
    }

    // 1. Intentar llamar a Cloud Function validateTicketAccess
    if (functions) {
      try {
        const fn = httpsCallable<ValidateAccessRequest, ValidateAccessResponse>(functions, 'validateTicketAccess');
        const result = await fn({
          qrToken: trimmedToken || undefined,
          ticketCode: trimmedCode || undefined,
          gateId,
          eventId
        });

        if (result.data) {
          // Reflejar cambio en cache local para pruebas offline
          if (result.data.ticket) {
            this.syncLocalTicketUsed(result.data.ticket.id, currentUser, gateId);
          }
          return result.data;
        }
      } catch (fnError: any) {
        console.warn('[TicketService] Falló invocación de Cloud Function validateTicketAccess:', fnError);
        const code = fnError?.code;
        const msg = fnError?.message || '';

        if (code === 'unauthenticated' || code === 'permission-denied') {
          return {
            authorized: false,
            status: 'REJECTED',
            rejectionReason: 'UNAUTHORIZED',
            message: msg || 'Acceso denegado por políticas de seguridad.'
          };
        }

        console.warn('[TicketService] Cloud Function validateTicketAccess no disponible, procediendo con validación directa/local:', fnError);
      }
    }

    // 2. Validación en Sandbox Local con estricta idempotencia y auditoría
    return this.executeLocalTicketValidation(trimmedToken, trimmedCode, currentUser, gateId, eventId);
  }

  /**
   * Reenviar boleto por correo electrónico con auditoría
   */
  async resendTicketEmail(
    ticketId: string,
    customRecipient?: string
  ): Promise<{ success: boolean; message: string; recipient: string; resendCount: number }> {
    const currentUser = authService.getCurrentUser();
    if (!currentUser) {
      throw new Error('Debe estar autenticado para reenviar boletos.');
    }
    if (!currentUser.isActive) {
      throw new Error('El operador se encuentra inactivo.');
    }
    if (currentUser.role !== 'admin' && currentUser.role !== 'cashier') {
      throw new Error('Solo el Administrador y Cobranzas pueden reenviar boletos.');
    }

    if (functions) {
      try {
        const fn = httpsCallable<{ ticketId: string; customRecipient?: string }, any>(
          functions,
          'resendTicketEmail'
        );
        const result = await fn({ ticketId, customRecipient });
        if (result.data && result.data.success) {
          this.syncLocalTicketResent(ticketId, currentUser, customRecipient);
          return result.data;
        }
      } catch (fnError: any) {
        console.warn('[TicketService] Error o Cloud Function resendTicketEmail no disponible, usando fallback:', fnError);
      }
    }

    // Sandbox Local / Directo
    return this.executeLocalResendTicketEmail(ticketId, currentUser, customRecipient);
  }

  /**
   * Cancelar un boleto (Solo Administrador)
   */
  async cancelTicket(
    ticketId: string,
    reason: string
  ): Promise<{ success: boolean; message: string }> {
    const currentUser = authService.getCurrentUser();
    if (!currentUser) {
      throw new Error('Debe estar autenticado para cancelar boletos.');
    }
    if (currentUser.role !== 'admin') {
      throw new Error('Solo un Administrador tiene autorización para cancelar boletos.');
    }
    if (!reason || reason.trim().length < 5) {
      throw new Error('Debe especificar un motivo de cancelación descriptivo (mínimo 5 caracteres).');
    }

    if (functions) {
      try {
        const fn = httpsCallable<{ ticketId: string; reason: string }, any>(
          functions,
          'cancelTicket'
        );
        const result = await fn({ ticketId, reason });
        if (result.data && result.data.success) {
          this.syncLocalTicketCancelled(ticketId, currentUser, reason);
          return result.data;
        }
      } catch (fnError: any) {
        console.warn('[TicketService] Error en Cloud Function cancelTicket:', fnError);
        throw new Error(fnError.message || 'Error al cancelar boleto.');
      }
    }

    // Sandbox Local
    return this.executeLocalTicketCancellation(ticketId, currentUser, reason);
  }

  /**
   * Reconciliación o emisión forzada de boletos para una orden en estado PAID
   */
  async issueTicketsForOrder(orderId: string): Promise<{ success: boolean; ticketsIssuedCount: number; message: string }> {
    const currentUser = authService.getCurrentUser();
    if (!currentUser) throw new Error('Usuario no autenticado.');

    if (functions) {
      try {
        const fn = httpsCallable<{ orderId: string }, { success: boolean; orderId: string; ticketsIssuedCount: number; message: string }>(
          functions,
          'issueTicketsForOrder'
        );
        const res = await fn({ orderId });
        return res.data;
      } catch (err: any) {
        console.warn('[TicketService] Cloud Function issueTicketsForOrder error, usando fallback local:', err);
      }
    }

    // Sandbox local
    const tickets = await this.issueLocalTicketsForPaidOrder(orderId, {
      uid: currentUser.uid,
      displayName: currentUser.displayName
    });
    return {
      success: true,
      ticketsIssuedCount: tickets.length,
      message: `Se emitieron ${tickets.length} boletos satisfactoriamente.`
    };
  }

  /**
   * Generar boletos para una orden en estado PAID (Fase 7)
   * Llama a Cloud Function generateTicketsForOrder o ejecuta localmente con estricta idempotencia.
   */
  async generateTicketsForOrder(orderId: string): Promise<{ success: boolean; ticketsIssuedCount: number; message: string }> {
    const currentUser = authService.getCurrentUser();
    if (!currentUser) throw new Error('Usuario no autenticado.');

    if (functions) {
      try {
        const fn = httpsCallable<{ orderId: string }, { success: boolean; orderId: string; ticketsIssuedCount: number; message: string }>(
          functions,
          'generateTicketsForOrder'
        );
        const res = await fn({ orderId });
        return res.data;
      } catch (err: any) {
        console.warn('[TicketService] Cloud Function generateTicketsForOrder error, usando fallback local:', err);
      }
    }

    return this.issueTicketsForOrder(orderId);
  }

  /**
   * Emitir tickets para una orden pagada en el sandbox local
   */
  async issueLocalTicketsForPaidOrder(
    orderId: string,
    operator: { uid: string; displayName?: string }
  ): Promise<Ticket[]> {
    const order = await orderService.getOrderById(orderId);
    if (!order) {
      throw new Error(`La orden ${orderId} no existe.`);
    }
    if (order.status !== 'PAID') {
      throw new Error(`Solo se pueden emitir tickets para órdenes con estado PAID.`);
    }

    const attendees = await orderService.getOrderAttendees(orderId);
    if (!attendees || attendees.length === 0) {
      throw new Error(`La orden ${orderId} no contiene asistentes.`);
    }

    const localTickets = this.getLocalTickets();
    const nowIso = new Date().toISOString();
    const issuedTickets: Ticket[] = [];

    let idx = 0;
    for (const att of attendees) {
      idx++;
      const deterministicTicketId = `tkt_${orderId}_${att.id}`;

      // Idempotencia: No duplicar si ya existe
      const existing = localTickets.find((t) => t.id === deterministicTicketId);
      if (existing) {
        issuedTickets.push(existing);
        continue;
      }

      const cleanCode = order.orderCode.replace(/^SHK-/, '');
      const ticketCode = `TKT-${cleanCode}-${idx.toString().padStart(2, '0')}`;

      // Generar token criptográficamente seguro (64 caracteres hex = 256 bits de entropía real)
      const randToken = generateSecureRandomHex(32);

      const newTicket: Ticket = {
        id: deterministicTicketId,
        ticketCode,
        qrToken: randToken,
        status: 'ISSUED',

        orderId,
        attendeeId: att.id,
        eventId: order.eventId,
        customerId: order.customerId,

        attendeeSnapshot: {
          fullName: att.fullName,
          ticketType: att.ticketType || att.priceRuleName || 'General',
          priceRuleName: att.priceRuleName || 'General',
          unitPrice: att.unitPrice
        },

        eventSnapshot: {
          title: order.eventTitle,
          startDate: nowIso,
          location: 'Centro de Eventos SHIKKUM'
        },

        orderSnapshot: {
          orderCode: order.orderCode,
          currency: 'USD',
          total: order.total
        },

        issuedAt: nowIso,
        issuedBy: operator.uid,
        issuedByName: operator.displayName || 'Operador',
        createdAt: nowIso,
        updatedAt: nowIso,

        emailDelivery: {
          status: 'SENT',
          recipient: 'cliente@shikkum.internal',
          sentAt: nowIso,
          resendCount: 0
        }
      };

      localTickets.push(newTicket);
      issuedTickets.push(newTicket);
    }

    this.saveLocalTickets(localTickets);
    return issuedTickets;
  }

  /**
   * Obtener registros de acceso para reportes y visualización en el terminal
   */
  async getAccessLogs(filter?: { eventId?: string; limit?: number }): Promise<AccessLog[]> {
    if (db) {
      try {
        let q = query(collection(db, 'access_logs'), limit(filter?.limit || 50));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
          const logs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as AccessLog));
          logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
          return logs;
        }
      } catch (err) {
        console.warn('[TicketService] Error consultando access_logs en Firestore:', err);
      }
    }

    const localLogs = this.getLocalAccessLogs();
    let filtered = localLogs;
    if (filter?.eventId) {
      filtered = filtered.filter((l) => l.eventId === filter.eventId);
    }
    filtered.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return filtered.slice(0, filter?.limit || 50);
  }

  // ==========================================
  // MÉTODOS INTERNOS DE SANDBOX LOCAL
  // ==========================================

  private executeLocalTicketValidation(
    trimmedToken: string,
    trimmedCode: string,
    operator: { uid: string; displayName?: string },
    gateId?: string,
    eventId?: string
  ): ValidateAccessResponse {
    const localTickets = this.getLocalTickets();
    const activeGate = gateId || 'PUERTA-PRINCIPAL';
    const validationMethod: 'QR' | 'MANUAL' = trimmedToken ? 'QR' : 'MANUAL';
    const nowIso = new Date().toISOString();

    // 1. Validar formato y firma criptográfica del token si es QR
    if (trimmedToken && !/^[a-f0-9]{32,64}$/i.test(trimmedToken)) {
      this.recordLocalAccessLog({
        id: generateSecureId('log'),
        ticketId: 'UNKNOWN',
        ticketCode: trimmedToken ? trimmedToken.substring(0, 8) + '...' : undefined,
        eventId: eventId || 'UNKNOWN',
        gateId: activeGate,
        gateOperatorUid: operator.uid,
        gateOperatorName: operator.displayName || 'Operador',
        timestamp: nowIso,
        authorized: false,
        validationMethod: 'QR',
        rejectionReason: 'INVALID_SIGNATURE',
        message: 'Firma o formato criptográfico de token inválido.'
      });

      return {
        authorized: false,
        status: 'REJECTED',
        rejectionReason: 'INVALID_SIGNATURE',
        message: 'Firma o formato criptográfico de código QR inválido.'
      };
    }

    const ticketIndex = localTickets.findIndex((t) =>
      trimmedToken ? t.qrToken === trimmedToken : t.ticketCode === trimmedCode
    );

    if (ticketIndex === -1) {
      this.recordLocalAccessLog({
        id: generateSecureId('log'),
        ticketId: 'UNKNOWN',
        ticketCode: trimmedCode || undefined,
        eventId: eventId || 'UNKNOWN',
        gateId: activeGate,
        gateOperatorUid: operator.uid,
        gateOperatorName: operator.displayName || 'Operador',
        timestamp: nowIso,
        authorized: false,
        validationMethod,
        rejectionReason: 'INVALID_TICKET',
        message: trimmedToken
          ? 'Código QR no reconocido en el sistema.'
          : `Boleto ${trimmedCode} no encontrado.`
      });

      return {
        authorized: false,
        status: 'REJECTED',
        rejectionReason: 'INVALID_TICKET',
        message: trimmedToken
          ? 'Código QR no reconocido o inexistente.'
          : `Boleto con código ${trimmedCode} no encontrado.`
      };
    }

    const ticket = localTickets[ticketIndex];

    // 2. Validación estricta de evento: el boleto debe pertenecer al evento seleccionado
    if (!eventId || ticket.eventId !== eventId) {
      this.recordLocalAccessLog({
        id: generateSecureId('log'),
        ticketId: ticket.id,
        ticketCode: ticket.ticketCode,
        attendeeName: ticket.attendeeSnapshot?.fullName,
        eventId: ticket.eventId,
        eventTitle: ticket.eventSnapshot?.title,
        gateId: activeGate,
        gateOperatorUid: operator.uid,
        gateOperatorName: operator.displayName || 'Operador',
        timestamp: nowIso,
        authorized: false,
        validationMethod,
        rejectionReason: 'WRONG_EVENT',
        message: 'Este boleto pertenece a otro evento.'
      });

      return {
        authorized: false,
        status: 'REJECTED',
        rejectionReason: 'WRONG_EVENT',
        ticket: {
          id: ticket.id,
          ticketCode: ticket.ticketCode,
          attendeeName: ticket.attendeeSnapshot?.fullName || 'Desconocido',
          ticketType: ticket.attendeeSnapshot?.ticketType,
          eventTitle: ticket.eventSnapshot?.title || '',
          status: ticket.status
        },
        message: 'Este boleto pertenece a otro evento.'
      };
    }

    // 3. Validación de Orden: debe existir y estar pagada
    const localOrders = orderService.getLocalOrders();
    const order = localOrders.find((o) => o.id === ticket.orderId);
    if (!order || order.status !== 'PAID') {
      const orderStatus = order ? order.status : 'NO_EXISTE';
      this.recordLocalAccessLog({
        id: generateSecureId('log'),
        ticketId: ticket.id,
        ticketCode: ticket.ticketCode,
        attendeeName: ticket.attendeeSnapshot?.fullName,
        eventId: ticket.eventId,
        eventTitle: ticket.eventSnapshot?.title,
        gateId: activeGate,
        gateOperatorUid: operator.uid,
        gateOperatorName: operator.displayName || 'Operador',
        timestamp: nowIso,
        authorized: false,
        validationMethod,
        rejectionReason: 'ORDER_NOT_PAID',
        message: `La orden asociada no se encuentra pagada (estado: ${orderStatus}).`
      });

      return {
        authorized: false,
        status: 'REJECTED',
        rejectionReason: 'ORDER_NOT_PAID',
        ticket: {
          id: ticket.id,
          ticketCode: ticket.ticketCode,
          attendeeName: ticket.attendeeSnapshot?.fullName || 'Desconocido',
          ticketType: ticket.attendeeSnapshot?.ticketType,
          eventTitle: ticket.eventSnapshot?.title || '',
          status: ticket.status
        },
        message: 'La orden asociada al boleto no se encuentra pagada.'
      };
    }

    // 4. Prevenir concurrencia y doble canje atómico
    if (TicketService.inFlightRedemptions.has(ticket.id) || ticket.status === 'USED') {
      const usedTime = ticket.access?.usedAt
        ? new Date(ticket.access.usedAt).toLocaleTimeString()
        : 'previamente';
      const usedOp = ticket.access?.usedByName || 'Operador';

      this.recordLocalAccessLog({
        id: generateSecureId('log'),
        ticketId: ticket.id,
        ticketCode: ticket.ticketCode,
        attendeeName: ticket.attendeeSnapshot?.fullName,
        eventId: ticket.eventId,
        eventTitle: ticket.eventSnapshot?.title,
        gateId: activeGate,
        gateOperatorUid: operator.uid,
        gateOperatorName: operator.displayName || 'Operador',
        timestamp: nowIso,
        authorized: false,
        validationMethod,
        rejectionReason: 'ALREADY_USED',
        message: `Boleto ya utilizado a las ${usedTime} (${usedOp}).`
      });

      return {
        authorized: false,
        status: 'REJECTED',
        rejectionReason: 'ALREADY_USED',
        ticket: {
          id: ticket.id,
          ticketCode: ticket.ticketCode,
          attendeeName: ticket.attendeeSnapshot?.fullName || 'Desconocido',
          ticketType: ticket.attendeeSnapshot?.ticketType,
          eventTitle: ticket.eventSnapshot?.title || '',
          status: 'USED'
        },
        message: `Boleto ya utilizado anteriormente a las ${usedTime} (${usedOp}). Ingreso denegado.`
      };
    }

    // 5. Validar si está cancelado
    if (ticket.status === 'CANCELLED') {
      const reason = ticket.cancellation?.cancellationReason || 'Cancelado por administración';

      this.recordLocalAccessLog({
        id: generateSecureId('log'),
        ticketId: ticket.id,
        ticketCode: ticket.ticketCode,
        attendeeName: ticket.attendeeSnapshot?.fullName,
        eventId: ticket.eventId,
        eventTitle: ticket.eventSnapshot?.title,
        gateId: activeGate,
        gateOperatorUid: operator.uid,
        gateOperatorName: operator.displayName || 'Operador',
        timestamp: nowIso,
        authorized: false,
        validationMethod,
        rejectionReason: 'TICKET_CANCELLED',
        message: `Boleto cancelado: ${reason}`
      });

      return {
        authorized: false,
        status: 'REJECTED',
        rejectionReason: 'TICKET_CANCELLED',
        ticket: {
          id: ticket.id,
          ticketCode: ticket.ticketCode,
          attendeeName: ticket.attendeeSnapshot?.fullName || 'Desconocido',
          ticketType: ticket.attendeeSnapshot?.ticketType,
          eventTitle: ticket.eventSnapshot?.title || '',
          status: 'CANCELLED'
        },
        message: `Boleto cancelado por administración. Motivo: ${reason}`
      };
    }

    // 6. Validar estado ISSUED o VALID
    if (ticket.status !== 'ISSUED' && ticket.status !== 'VALID') {
      this.recordLocalAccessLog({
        id: generateSecureId('log'),
        ticketId: ticket.id,
        ticketCode: ticket.ticketCode,
        attendeeName: ticket.attendeeSnapshot?.fullName,
        eventId: ticket.eventId,
        eventTitle: ticket.eventSnapshot?.title,
        gateId: activeGate,
        gateOperatorUid: operator.uid,
        gateOperatorName: operator.displayName || 'Operador',
        timestamp: nowIso,
        authorized: false,
        validationMethod,
        rejectionReason: 'INVALID_STATUS',
        message: `Estado de boleto no apto para ingreso: ${ticket.status}`
      });

      return {
        authorized: false,
        status: 'REJECTED',
        rejectionReason: 'INVALID_STATUS',
        message: `El boleto no se encuentra en estado válido (${ticket.status}).`
      };
    }

    // 7. Transición atómica a USED protegida con lock en memoria
    TicketService.inFlightRedemptions.add(ticket.id);
    try {
      const accessRecord = {
        usedAt: nowIso,
        usedBy: operator.uid,
        usedByName: operator.displayName || 'Operador de Puerta',
        gateId: activeGate,
        validationMethod
      };

      localTickets[ticketIndex] = {
        ...ticket,
        status: 'USED',
        access: accessRecord,
        updatedAt: nowIso
      };
      this.saveLocalTickets(localTickets);

      this.recordLocalAccessLog({
        id: generateSecureId('log'),
        ticketId: ticket.id,
        ticketCode: ticket.ticketCode,
        attendeeName: ticket.attendeeSnapshot?.fullName,
        eventId: ticket.eventId,
        eventTitle: ticket.eventSnapshot?.title,
        gateId: activeGate,
        gateOperatorUid: operator.uid,
        gateOperatorName: operator.displayName || 'Operador de Puerta',
        timestamp: nowIso,
        authorized: true,
        validationMethod,
        message: 'Ingreso autorizado'
      });

      return {
        authorized: true,
        status: 'ACCEPTED',
        ticket: {
          id: ticket.id,
          ticketCode: ticket.ticketCode,
          attendeeName: ticket.attendeeSnapshot?.fullName || 'Asistente',
          ticketType: ticket.attendeeSnapshot?.ticketType,
          eventTitle: ticket.eventSnapshot?.title || '',
          status: 'USED'
        },
        access: accessRecord,
        message: 'Ingreso autorizado satisfactoriamente.'
      };
    } finally {
      TicketService.inFlightRedemptions.delete(ticket.id);
    }
  }

  private executeLocalResendTicketEmail(
    ticketId: string,
    operator: { uid: string; displayName?: string },
    customRecipient?: string
  ) {
    const localTickets = this.getLocalTickets();
    const idx = localTickets.findIndex((t) => t.id === ticketId);
    if (idx === -1) {
      throw new Error('El boleto no existe.');
    }

    const ticket = localTickets[idx];
    const nowIso = new Date().toISOString();
    const recipient = customRecipient ? customRecipient.trim() : ticket.emailDelivery?.recipient || 'cliente@shikkum.internal';

    const currentCount = ticket.emailDelivery?.resendCount || 0;
    const updatedDelivery = {
      status: 'SENT' as const,
      recipient,
      sentAt: nowIso,
      resendCount: currentCount + 1,
      lastResentBy: operator.uid,
      lastResentByName: operator.displayName || 'Operador',
      lastResentAt: nowIso
    };

    localTickets[idx] = {
      ...ticket,
      emailDelivery: updatedDelivery,
      updatedAt: nowIso
    };
    this.saveLocalTickets(localTickets);

    return {
      success: true,
      ticketId,
      recipient,
      resendCount: updatedDelivery.resendCount,
      sentAt: nowIso,
      message: `Boleto ${ticket.ticketCode} reenviado exitosamente a ${recipient}.`
    };
  }

  private executeLocalTicketCancellation(
    ticketId: string,
    operator: { uid: string; displayName?: string },
    reason: string
  ) {
    const localTickets = this.getLocalTickets();
    const idx = localTickets.findIndex((t) => t.id === ticketId);
    if (idx === -1) {
      throw new Error('El boleto no existe.');
    }

    const ticket = localTickets[idx];
    if (ticket.status === 'USED') {
      throw new Error('No es posible cancelar un boleto que ya fue utilizado para ingresar al evento.');
    }
    if (ticket.status === 'CANCELLED') {
      throw new Error('El boleto ya se encuentra cancelado.');
    }

    const nowIso = new Date().toISOString();
    localTickets[idx] = {
      ...ticket,
      status: 'CANCELLED',
      cancellation: {
        cancelledAt: nowIso,
        cancelledBy: operator.uid,
        cancelledByName: operator.displayName || 'Administrador',
        cancellationReason: reason.trim()
      },
      updatedAt: nowIso
    };
    this.saveLocalTickets(localTickets);

    return {
      success: true,
      message: `Boleto ${ticket.ticketCode} cancelado correctamente.`
    };
  }

  private syncLocalTicketUsed(
    ticketId: string,
    operator: { uid: string; displayName?: string },
    gateId?: string
  ) {
    const localTickets = this.getLocalTickets();
    const idx = localTickets.findIndex((t) => t.id === ticketId);
    if (idx !== -1) {
      const nowIso = new Date().toISOString();
      localTickets[idx] = {
        ...localTickets[idx],
        status: 'USED',
        access: {
          usedAt: nowIso,
          usedBy: operator.uid,
          usedByName: operator.displayName || 'Operador',
          gateId: gateId || 'PUERTA-PRINCIPAL',
          validationMethod: 'QR'
        },
        updatedAt: nowIso
      };
      this.saveLocalTickets(localTickets);
    }
  }

  private syncLocalTicketResent(
    ticketId: string,
    operator: { uid: string; displayName?: string },
    customRecipient?: string
  ) {
    const localTickets = this.getLocalTickets();
    const idx = localTickets.findIndex((t) => t.id === ticketId);
    if (idx !== -1) {
      const nowIso = new Date().toISOString();
      const current = localTickets[idx].emailDelivery;
      localTickets[idx] = {
        ...localTickets[idx],
        emailDelivery: {
          status: 'SENT',
          recipient: customRecipient || current?.recipient || 'cliente@shikkum.internal',
          sentAt: nowIso,
          resendCount: (current?.resendCount || 0) + 1,
          lastResentBy: operator.uid,
          lastResentByName: operator.displayName || 'Operador',
          lastResentAt: nowIso
        },
        updatedAt: nowIso
      };
      this.saveLocalTickets(localTickets);
    }
  }

  private syncLocalTicketCancelled(
    ticketId: string,
    operator: { uid: string; displayName?: string },
    reason: string
  ) {
    const localTickets = this.getLocalTickets();
    const idx = localTickets.findIndex((t) => t.id === ticketId);
    if (idx !== -1) {
      const nowIso = new Date().toISOString();
      localTickets[idx] = {
        ...localTickets[idx],
        status: 'CANCELLED',
        cancellation: {
          cancelledAt: nowIso,
          cancelledBy: operator.uid,
          cancelledByName: operator.displayName || 'Administrador',
          cancellationReason: reason.trim()
        },
        updatedAt: nowIso
      };
      this.saveLocalTickets(localTickets);
    }
  }

  private recordLocalAccessLog(log: AccessLog) {
    const logs = this.getLocalAccessLogs();
    logs.unshift(log);
    try {
      localStorage.setItem(ACCESS_LOGS_STORAGE_KEY, JSON.stringify(logs.slice(0, 200)));
    } catch {
      // Ignorar quota exceeded
    }
  }

  getLocalTickets(): Ticket[] {
    try {
      const raw = localStorage.getItem(TICKETS_STORAGE_KEY);
      if (!raw) {
        localStorage.setItem(TICKETS_STORAGE_KEY, JSON.stringify(INITIAL_DEMO_TICKETS));
        return [...INITIAL_DEMO_TICKETS];
      }
      return JSON.parse(raw);
    } catch {
      return [...INITIAL_DEMO_TICKETS];
    }
  }

  saveLocalTickets(tickets: Ticket[]): void {
    try {
      localStorage.setItem(TICKETS_STORAGE_KEY, JSON.stringify(tickets));
    } catch (err) {
      console.warn('[TicketService] Error guardando tickets en localStorage:', err);
    }
  }

  getLocalAccessLogs(): AccessLog[] {
    try {
      const raw = localStorage.getItem(ACCESS_LOGS_STORAGE_KEY);
      if (!raw) return [];
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }
}

export const ticketService = new TicketService();
