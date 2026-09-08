/**
 * SHIKKUM - Definiciones de Tipos de Dominio
 * Proyecto: shikkum-7a238
 * Autor: Yeiber Pedrozo
 */

export type SystemRole = 'admin' | 'cashier' | 'gate_operator';

export type TicketStatus = 'ISSUED' | 'VALID' | 'CANCELLED' | 'USED';

export type OrderStatus = 'DRAFT' | 'PENDING_PAYMENT' | 'CANCELLED' | 'PAID';

export type EventStatus = 'DRAFT' | 'ACTIVE' | 'CLOSED' | 'CANCELLED';

export type PaymentMethod = 'CASH' | 'BANK_TRANSFER' | 'CARD' | 'OTHER';

export type PaymentStatus = 'PENDING' | 'CONFIRMED' | 'REJECTED';

/**
 * Entidad independiente para registro y auditoría de pagos (Fase 8 Extendido)
 */
export interface Payment {
  id: string;
  paymentId?: string; // Alias de compatibilidad

  orderId: string;
  orderCode: string;

  amount: number;
  currency: 'USD';

  method: PaymentMethod;
  paymentMethod?: PaymentMethod; // Alias de especificación Fase 8
  status: PaymentStatus;

  reference?: string;
  referenceNumber?: string; // Alias Fase 8

  // Metadatos de Comprobante de Pago en Firebase Storage (Fase 8)
  receiptStoragePath?: string;
  receiptFileName?: string;
  receiptContentType?: string;
  receiptSize?: number;
  uploadedAt?: string;
  uploadedBy?: string;
  uploadedByName?: string;
  verifiedAt?: string;
  verifiedBy?: string;
  verifiedByName?: string;

  // Retrocompatibilidad
  proofUrl?: string;
  proofStoragePath?: string;

  notes?: string;

  registeredBy: string;
  registeredByName?: string;
  registeredAt: string;

  confirmedBy?: string;
  confirmedByName?: string;
  confirmedAt?: string;

  rejectedBy?: string;
  rejectedByName?: string;
  rejectedAt?: string;
  rejectionReason?: string;

  createdAt?: string;
  updatedAt?: string;
}

export interface RegisterPaymentRequest {
  orderId: string;
  amount: number;
  method: PaymentMethod;
  paymentMethod?: PaymentMethod;
  reference?: string;
  referenceNumber?: string;
  receiptStoragePath?: string;
  receiptFileName?: string;
  receiptContentType?: string;
  receiptSize?: number;
  proofStoragePath?: string;
  proofUrl?: string;
  notes?: string;
  autoConfirm?: boolean;
}

export interface ConfirmPaymentRequest {
  paymentId: string;
}

export interface RejectPaymentRequest {
  paymentId: string;
  reason: string;
}

export interface PaymentFilterParams {
  searchTerm?: string;
  status?: PaymentStatus;
  method?: PaymentMethod;
  eventId?: string;
  sortByDate?: 'asc' | 'desc';
}

/**
 * Acciones y eventos de auditoría inmutables — SHIKKUM Fase 8
 */
export type AuditAction =
  | 'PAYMENT_REGISTERED'
  | 'RECEIPT_UPLOADED'
  | 'PAYMENT_APPROVED'
  | 'PAYMENT_REJECTED'
  | 'RECEIPT_REPLACED'
  | 'TICKET_GENERATED'
  | 'TICKET_SENT'
  | 'TICKET_RESENT'
  | 'ORDER_CREATED'
  | 'ORDER_CANCELLED';

export interface AuditLog {
  id: string;
  timestamp: string;
  userId: string;
  userEmail?: string;
  userName?: string;
  role: SystemRole;
  action: AuditAction;
  entityType: 'order' | 'payment' | 'ticket' | 'customer' | 'event';
  entityId: string;
  metadata?: Record<string, any>;
}


/**
 * Operador del sistema con credenciales en Firebase Auth
 */
export interface SystemUser {
  uid: string;
  email: string;
  displayName: string;
  role: SystemRole;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
}

/**
 * Cliente / Comprador titular
 */
export interface Customer {
  id: string;
  fullName: string;
  email: string;
  phone?: string;
  documentId?: string;
  isCommunityMember: boolean;
  isActive: boolean;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
}

/**
 * Evento administrado
 */
export interface Event {
  id: string;
  title: string;
  description?: string;
  date: string;
  startTime?: string;
  endTime?: string;
  venue?: string;
  capacity?: number;
  status: EventStatus;
  ticketsSold: number;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
}

// Alias de retrocompatibilidad
export type EventEntity = Event;

/**
 * Regla de cálculo de precio dinámico
 */
export interface PriceRule {
  id: string;
  eventId: string;
  name: string;
  minAge: number;
  maxAge: number | null;
  communityMemberOnly: boolean;
  ticketType?: string;
  price: number;
  currency: 'USD';
  isActive: boolean;
  priority: number;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
}

export interface PricePreviewRequest {
  eventId: string;
  age: number;
  isCommunityMember: boolean;
}

export interface PricePreviewResult {
  matchedRuleId: string | null;
  ruleName: string | null;
  price: number | null;
  currency: 'USD';
  ticketType?: string;
  rejectionReason?: string;
}

/**
 * Registro de compra generado por Cobranzas o Administrador
 */
export interface Order {
  id: string;
  orderCode: string;

  customerId: string;
  customerName: string;

  eventId: string;
  eventTitle: string;

  createdBy: string;
  createdAt: string;
  updatedAt: string;

  status: OrderStatus;

  attendeeCount: number;

  subtotal: number;
  total: number;
  currency: 'USD';

  // Metadatos de auditoría y cancelación
  cancelledAt?: string;
  cancelledBy?: string;
  cancellationReason?: string;
  requestId?: string;
}

/**
 * Asistente individual dentro de la orden con snapshot histórico del precio
 */
export interface OrderAttendee {
  id: string;

  orderId: string;
  customerId: string;
  eventId: string;

  fullName: string;

  ageAtPurchase: number;
  isCommunityMemberAtPurchase: boolean;

  priceRuleId: string;
  priceRuleName: string;

  ticketType?: string;

  unitPrice: number;
  subtotal: number;
  currency: 'USD';

  createdAt: string;
}

export interface AttendeeInput {
  fullName: string;
  ageAtPurchase: number;
  isCommunityMemberAtPurchase: boolean;
  ticketType?: string;
}

export interface CreateOrderRequest {
  requestId: string;
  customerId: string;
  eventId: string;
  attendees: AttendeeInput[];
}

export interface CreateOrderResponse {
  orderId: string;
  orderCode: string;
  subtotal: number;
  total: number;
  status: OrderStatus;
  isIdempotentReplay?: boolean;
}

export interface OrderFilterParams {
  searchTerm?: string;
  eventId?: string;
  status?: OrderStatus;
  sortByDate?: 'asc' | 'desc';
}

export interface TicketAttendeeSnapshot {
  fullName: string;
  documentId?: string;
  email?: string;
  ticketType?: string;
  priceRuleName?: string;
  unitPrice?: number;
}

export interface TicketEventSnapshot {
  title: string;
  startDate: string;
  location?: string;
}

export interface TicketOrderSnapshot {
  orderCode: string;
  currency: 'USD';
  total: number;
}

export interface TicketEmailDelivery {
  status: 'PENDING' | 'SENT' | 'FAILED';
  recipient?: string;
  sentAt?: string;
  lastError?: string;
  resendCount: number;
  lastResentBy?: string;
  lastResentByName?: string;
  lastResentAt?: string;
}

export interface TicketAccess {
  usedAt?: string;
  usedBy?: string;
  usedByName?: string;
  gateId?: string;
  validationMethod?: 'QR' | 'MANUAL';
}

export interface TicketCancellation {
  cancelledAt?: string;
  cancelledBy?: string;
  cancelledByName?: string;
  cancellationReason?: string;
}

/**
 * Boleto individual con código QR criptográfico — SHIKKUM Fase 6
 */
export interface Ticket {
  id: string;
  ticketCode: string;
  qrToken: string;
  status: TicketStatus;

  orderId: string;
  attendeeId: string;
  eventId: string;
  customerId: string;

  attendeeSnapshot: TicketAttendeeSnapshot;
  eventSnapshot: TicketEventSnapshot;
  orderSnapshot: TicketOrderSnapshot;

  issuedAt: string;
  issuedBy: string;
  issuedByName?: string;
  createdAt: string;
  updatedAt: string;

  emailDelivery: TicketEmailDelivery;
  access?: TicketAccess;
  cancellation?: TicketCancellation;
}

export interface ValidateAccessRequest {
  qrToken?: string;
  ticketCode?: string;
  gateId?: string;
  eventId: string; // Obligatorio: la puerta siempre opera bajo un evento específico
}

export interface ValidateAccessResponse {
  authorized: boolean;
  status: 'ACCEPTED' | 'REJECTED';
  ticket?: {
    id: string;
    ticketCode: string;
    attendeeName: string;
    ticketType?: string;
    eventTitle: string;
    status: TicketStatus;
  };
  access?: {
    usedAt: string;
    usedBy: string;
    usedByName?: string;
    gateId: string;
    validationMethod: 'QR' | 'MANUAL';
  };
  rejectionReason?:
    | 'ALREADY_USED'
    | 'TICKET_CANCELLED'
    | 'TICKET_NOT_FOUND'
    | 'INVALID_TICKET'
    | 'INVALID_TOKEN'
    | 'INVALID_SIGNATURE'
    | 'WRONG_EVENT'
    | 'EVENT_NOT_ACTIVE'
    | 'UNAUTHORIZED'
    | 'UNAUTHORIZED_OPERATOR'
    | 'ORDER_NOT_PAID'
    | 'INVALID_STATUS';
  message: string;
}

/**
 * Registro inmutable de auditoría de acceso en puerta
 */
export interface AccessLog {
  id: string;
  ticketId: string;
  ticketCode?: string;
  attendeeName?: string;
  eventId: string;
  eventTitle?: string;
  gateId?: string;
  gateOperatorUid: string;
  gateOperatorName?: string;
  timestamp: string;
  authorized: boolean;
  validationMethod: 'QR' | 'MANUAL';
  rejectionReason?: string;
  message?: string;
}

/**
 * Estado de despacho de correo electrónico — SHIKKUM Fase 7
 */
export type EmailDispatchStatus = 'PENDING' | 'SENDING' | 'SENT' | 'FAILED';

/**
 * Registro inmutable de auditoría de envío y reenvío de entradas — SHIKKUM Fase 7
 * Colección: /email_dispatches/{dispatchId}
 */
export interface EmailDispatch {
  id: string;
  dispatchId: string;
  orderId: string;
  orderCode?: string;
  customerId: string;
  customerName?: string;
  customerEmail: string;
  eventId: string;
  eventTitle?: string;
  ticketIds: string[];
  ticketCodes?: string[];
  status: EmailDispatchStatus;
  sentAt?: string | null;
  createdAt: string;
  retryCount: number;
  errorMessage?: string | null;
  lastAttemptAt: string;
  triggeredBy: string;
  triggeredByName?: string;
  isResend?: boolean;
}

export interface SendTicketsEmailResponse {
  success: boolean;
  orderId: string;
  dispatchId?: string;
  status: EmailDispatchStatus;
  recipient: string;
  ticketCount: number;
  message: string;
  errorMessage?: string;
}
