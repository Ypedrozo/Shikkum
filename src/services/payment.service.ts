import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  query,
  where
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, functions, storage, isFirebaseConfigured, isProductionEnvironment } from './firebase';
import {
  Payment,
  RegisterPaymentRequest,
  ConfirmPaymentRequest,
  RejectPaymentRequest,
  PaymentFilterParams
} from '../types';
import { authService } from './auth.service';
import { orderService } from './order.service';
import { ticketService } from './ticket.service';
import { emailDispatchService } from './emailDispatch.service';

const PAYMENTS_STORAGE_KEY = 'shikkum_payments_store_v1';

// Semillas iniciales para entorno de desarrollo / testing
const INITIAL_DEMO_PAYMENTS: Payment[] = [
  {
    id: 'pay_demo_001',
    orderId: 'ord_demo_003',
    orderCode: 'SHK-2026-DEMO03',
    amount: 105,
    currency: 'USD',
    method: 'BANK_TRANSFER',
    status: 'CONFIRMED',
    reference: 'TRF-BANCO-998822',
    proofUrl: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&q=80&w=800',
    proofStoragePath: 'payment_proofs/ord_demo_003/voucher_998822.jpg',
    notes: 'Transferencia confirmada en cuenta corriente corporativa.',
    registeredBy: 'usr_cashier_02',
    registeredByName: 'Personal de Cobranzas 1',
    registeredAt: '2026-09-02T16:00:00.000Z',
    confirmedBy: 'usr_admin_master_01',
    confirmedByName: 'Yeiber Pedrozo (Super Administrador)',
    confirmedAt: '2026-09-02T16:15:00.000Z'
  }
];

class PaymentService {
  private hasLiveFirebase(): boolean {
    return Boolean(isFirebaseConfigured && db);
  }

  private getLocalPayments(): Payment[] {
    try {
      const raw = localStorage.getItem(PAYMENTS_STORAGE_KEY);
      if (!raw) {
        localStorage.setItem(PAYMENTS_STORAGE_KEY, JSON.stringify(INITIAL_DEMO_PAYMENTS));
        return INITIAL_DEMO_PAYMENTS;
      }
      return JSON.parse(raw);
    } catch {
      return INITIAL_DEMO_PAYMENTS;
    }
  }

  private saveLocalPayments(payments: Payment[]): void {
    try {
      localStorage.setItem(PAYMENTS_STORAGE_KEY, JSON.stringify(payments));
    } catch (e) {
      console.error('Error al guardar pagos en almacenamiento local:', e);
    }
  }

  /**
   * Subir comprobante de pago de forma segura a Firebase Storage
   * Valida roles, tipos MIME permitidos y tamaño máximo (5MB)
   */
  async uploadPaymentProof(
    orderId: string,
    file: File
  ): Promise<{ storagePath: string; downloadUrl: string }> {
    const currentUser = authService.getCurrentUser();
    if (!currentUser) {
      throw new Error('Debe iniciar sesión para subir un comprobante de pago.');
    }
    if (currentUser.role !== 'admin' && currentUser.role !== 'cashier') {
      throw new Error('El usuario no tiene autorización para registrar comprobantes.');
    }

    // Validación estricta de tipo MIME
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!allowedMimeTypes.includes(file.type)) {
      throw new Error(
        'El archivo no es válido. Solo se permiten imágenes JPEG, PNG, WEBP o documentos PDF.'
      );
    }

    // Validación estricta de extensiones
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.pdf'];
    const lowerName = file.name.toLowerCase();
    const hasValidExt = allowedExtensions.some((ext) => lowerName.endsWith(ext));
    if (!hasValidExt) {
      throw new Error('La extensión del archivo no es válida. Solo se admiten extensiones .jpg, .jpeg, .png, .webp o .pdf.');
    }

    // Validación de tamaño máximo (5 MB)
    const MAX_SIZE_BYTES = 5 * 1024 * 1024;
    if (file.size > MAX_SIZE_BYTES) {
      throw new Error('El archivo excede el tamaño máximo permitido de 5 MB.');
    }

    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `payment_proofs/${orderId}/${Date.now()}_${sanitizedFileName}`;

    // Si Firebase Storage está configurado en vivo
    if (storage) {
      try {
        const storageReference = ref(storage, storagePath);
        const metadata = {
          contentType: file.type,
          customMetadata: {
            orderId,
            uploadedBy: currentUser.uid,
            uploadedAt: new Date().toISOString()
          }
        };

        const uploadResult = await uploadBytes(storageReference, file, metadata);
        const downloadUrl = await getDownloadURL(uploadResult.ref);

        return { storagePath, downloadUrl };
      } catch (storageError: any) {
        console.warn('[SHIKKUM] Error al subir a Firebase Storage en vivo:', storageError);
        // Si no estamos en producción forzada, procesar fallback seguro
        if (isProductionEnvironment) {
          throw new Error('Error al almacenar comprobante en el servicio de archivos de producción.');
        }
      }
    }

    // Fallback para desarrollo / testing sin credenciales de Storage activas:
    // Creamos una URL de objeto o data URL segura para visualización inmediata en sesión
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        resolve({
          storagePath,
          downloadUrl: reader.result as string
        });
      };
      reader.onerror = () => {
        reject(new Error('Error al procesar el archivo seleccionado.'));
      };
      reader.readAsDataURL(file);
    });
  }

  /**
   * Registro del pago para una orden comercial
   */
  async registerPayment(request: RegisterPaymentRequest): Promise<Payment> {
    const currentUser = authService.getCurrentUser();
    if (!currentUser) {
      throw new Error('El usuario no está autenticado.');
    }
    if (!currentUser.isActive) {
      throw new Error('El usuario operador se encuentra desactivado.');
    }
    if (currentUser.role !== 'admin' && currentUser.role !== 'cashier') {
      throw new Error('Solo Cobranzas y Administradores pueden registrar pagos.');
    }

    const { orderId, amount, method, reference, proofStoragePath, proofUrl, notes, autoConfirm } = request;

    if (!orderId || !orderId.trim()) {
      throw new Error('No se encontró la orden especificada.');
    }

    if (method === 'BANK_TRANSFER' && !proofStoragePath && !proofUrl) {
      throw new Error('El comprobante es obligatorio para transferencia.');
    }

    // 1. Intentar llamar a Cloud Function 2nd Gen registerPayment
    if (functions) {
      try {
        const registerPaymentFn = httpsCallable<any, any>(functions, 'registerPayment');
        const result = await registerPaymentFn({
          orderId,
          amount,
          method,
          reference: reference?.trim(),
          proofStoragePath,
          proofUrl,
          notes: notes?.trim(),
          autoConfirm: Boolean(autoConfirm)
        });

        if (result.data && result.data.success) {
          // Recuperar el pago creado
          const createdPayment = await this.getPaymentById(result.data.paymentId);
          if (createdPayment) return createdPayment;
        }
      } catch (fnError: any) {
        console.warn('[SHIKKUM] Falló invocación de Cloud Function registerPayment:', fnError);
        const code = fnError?.code;
        const msg = fnError?.message || '';

        if (code === 'unauthenticated' || code === 'permission-denied' || code === 'failed-precondition' || code === 'invalid-argument') {
          throw new Error(msg || 'Error de validación en el registro del pago.');
        }

        if (isProductionEnvironment) {
          throw new Error(`Error en el servidor de pagos: ${msg || 'Error desconocido'}`);
        }
      }
    }

    // 2. Ejecución directa contra BD o Sandbox local
    return this.executeLocalOrDirectPaymentRegistration(request, currentUser);
  }

  private async executeLocalOrDirectPaymentRegistration(
    request: RegisterPaymentRequest,
    currentUser: { uid: string; displayName?: string; role: string }
  ): Promise<Payment> {
    const order = await orderService.getOrderById(request.orderId);
    if (!order) {
      throw new Error('No se encontró la orden.');
    }

    if (order.status === 'PAID') {
      throw new Error('La orden ya fue pagada.');
    }

    if (order.status === 'CANCELLED') {
      throw new Error('La orden fue cancelada.');
    }

    if (order.status !== 'PENDING_PAYMENT') {
      throw new Error(`La orden no admite pagos en su estado actual (${order.status}).`);
    }

    // Validación estricta del monto del pago contra el total inmutable de la orden
    if (typeof request.amount !== 'number' || isNaN(request.amount) || Math.abs(request.amount - order.total) > 0.001) {
      throw new Error(
        `El monto del pago no coincide con el total. Esperado: $${order.total.toFixed(2)} USD, Recibido: $${request.amount} USD.`
      );
    }

    // Verificar si ya existe un pago confirmado
    const existingPayments = await this.getPaymentsByOrderId(request.orderId);
    const confirmedPayment = existingPayments.find((p) => p.status === 'CONFIRMED');
    if (confirmedPayment) {
      throw new Error('La orden ya tiene un pago confirmado.');
    }

    const nowIso = new Date().toISOString();
    const isAutoConfirmed = Boolean(request.autoConfirm);
    const paymentId = `pay_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const newPayment: Payment = {
      id: paymentId,
      orderId: order.id,
      orderCode: order.orderCode,
      amount: order.total,
      currency: 'USD',
      method: request.method,
      status: isAutoConfirmed ? 'CONFIRMED' : 'PENDING',
      reference: request.reference ? request.reference.trim() : undefined,
      proofStoragePath: request.proofStoragePath,
      proofUrl: request.proofUrl,
      notes: request.notes ? request.notes.trim() : undefined,
      registeredBy: currentUser.uid,
      registeredByName: currentUser.displayName || 'Operador Cobranzas',
      registeredAt: nowIso
    };

    if (isAutoConfirmed) {
      newPayment.confirmedBy = currentUser.uid;
      newPayment.confirmedByName = currentUser.displayName || 'Operador Cobranzas';
      newPayment.confirmedAt = nowIso;
    }

    if (this.hasLiveFirebase()) {
      try {
        await setDoc(doc(db, 'payments', paymentId), newPayment);
        if (isAutoConfirmed) {
          await updateDoc(doc(db, 'orders', order.id), {
            status: 'PAID',
            updatedAt: nowIso
          });
        }
      } catch (err: any) {
        console.warn('Error al escribir pago en Firestore:', err);
      }
    }

    // Guardar en almacenamiento local
    const localPayments = this.getLocalPayments();
    localPayments.unshift(newPayment);
    this.saveLocalPayments(localPayments);

    // Si fue auto-confirmado, actualizar orden localmente también
    if (isAutoConfirmed) {
      const orders = orderService['getLocalOrders']();
      const oIdx = orders.findIndex((o) => o.id === order.id);
      if (oIdx !== -1) {
        orders[oIdx] = {
          ...orders[oIdx],
          status: 'PAID',
          updatedAt: nowIso
        };
        orderService['saveLocalOrders'](orders);
      }

      // Emisión y preparación de entradas por correo electrónico tras auto-confirmación
      try {
        await ticketService.issueLocalTicketsForPaidOrder(order.id, currentUser);
        await emailDispatchService.sendTicketsEmail(order.id);
      } catch (autoErr) {
        console.warn('[SHIKKUM] Error en emisión/despacho tras auto-confirmación:', autoErr);
      }
    }

    return newPayment;
  }

  /**
   * Confirmación de pago por Backend
   * Cumple con la regla de idempotencia y validación atómica
   */
  async confirmPayment(request: ConfirmPaymentRequest): Promise<{
    success: boolean;
    paymentId: string;
    orderId: string;
    orderStatus: string;
    isIdempotentReplay?: boolean;
  }> {
    const currentUser = authService.getCurrentUser();
    if (!currentUser) {
      throw new Error('El usuario no está autenticado.');
    }
    if (!currentUser.isActive) {
      throw new Error('El usuario operador se encuentra desactivado.');
    }
    if (currentUser.role !== 'admin' && currentUser.role !== 'cashier') {
      throw new Error('El usuario no está autorizado para confirmar pagos.');
    }

    const { paymentId } = request;
    if (!paymentId) {
      throw new Error('No se encontró el pago.');
    }

    // 1. Intentar llamar a Cloud Function confirmPayment
    if (functions) {
      try {
        const confirmPaymentFn = httpsCallable<any, any>(functions, 'confirmPayment');
        const result = await confirmPaymentFn({ paymentId });
        if (result.data && result.data.success) {
          // Reflejar cambio en cache local
          await this.syncLocalPaymentConfirmed(paymentId, currentUser);
          return result.data;
        }
      } catch (fnError: any) {
        console.warn('[SHIKKUM] Falló invocación de Cloud Function confirmPayment:', fnError);
        const code = fnError?.code;
        const msg = fnError?.message || '';

        if (code === 'unauthenticated' || code === 'permission-denied' || code === 'failed-precondition' || code === 'invalid-argument') {
          throw new Error(msg || 'Error al confirmar el pago.');
        }

        if (isProductionEnvironment) {
          throw new Error(`Error en el servidor de pagos: ${msg || 'Error desconocido'}`);
        }
      }
    }

    // 2. Ejecución en Sandbox Local con estricta validación e idempotencia
    return this.executeLocalPaymentConfirmation(paymentId, currentUser);
  }

  private async executeLocalPaymentConfirmation(
    paymentId: string,
    currentUser: { uid: string; displayName?: string }
  ) {
    const payment = await this.getPaymentById(paymentId);
    if (!payment) {
      throw new Error('No se encontró el pago.');
    }

    // Idempotencia: Si ya está confirmado, responder de forma controlada
    if (payment.status === 'CONFIRMED') {
      return {
        success: true,
        isIdempotentReplay: true,
        paymentId: payment.id,
        orderId: payment.orderId,
        orderStatus: 'PAID'
      };
    }

    if (payment.status === 'REJECTED') {
      throw new Error('El pago fue rechazado previamente y no puede ser confirmado.');
    }

    const order = await orderService.getOrderById(payment.orderId);
    if (!order) {
      throw new Error('No se encontró la orden.');
    }

    if (order.status === 'PAID') {
      throw new Error('La orden ya se encuentra en estado PAID. No se puede confirmar otro pago.');
    }

    // Verificar que no exista otro pago confirmado para esta orden
    const localPayments = this.getLocalPayments();
    const otherConfirmed = localPayments.find(
      (p) => p.orderId === order.id && p.status === 'CONFIRMED' && p.id !== payment.id
    );
    if (otherConfirmed) {
      throw new Error('La orden ya cuenta con otro pago confirmado. No se permiten múltiples pagos confirmados.');
    }

    if (order.status === 'CANCELLED') {
      throw new Error('La orden fue cancelada y no puede ser pagada.');
    }

    if (order.status !== 'PENDING_PAYMENT') {
      throw new Error(`La orden no está pendiente de pago (${order.status}).`);
    }

    if (Math.abs(payment.amount - order.total) > 0.001) {
      throw new Error(
        `El monto del pago no coincide con el total. Esperado: $${order.total.toFixed(2)}, Registrado: $${payment.amount.toFixed(2)}.`
      );
    }

    const nowIso = new Date().toISOString();

    // Actualizar local
    await this.syncLocalPaymentConfirmed(paymentId, currentUser, nowIso);

    return {
      success: true,
      isIdempotentReplay: false,
      paymentId: payment.id,
      orderId: order.id,
      orderStatus: 'PAID'
    };
  }

  private async syncLocalPaymentConfirmed(
    paymentId: string,
    operator: { uid: string; displayName?: string },
    timestamp?: string
  ) {
    const nowIso = timestamp || new Date().toISOString();
    const payments = this.getLocalPayments();
    const pIdx = payments.findIndex((p) => p.id === paymentId);

    if (pIdx !== -1) {
      const payment = payments[pIdx];
      payments[pIdx] = {
        ...payment,
        status: 'CONFIRMED',
        confirmedBy: operator.uid,
        confirmedByName: operator.displayName || 'Operador',
        confirmedAt: nowIso
      };
      this.saveLocalPayments(payments);

      // Actualizar orden
      const orders = orderService['getLocalOrders']();
      const oIdx = orders.findIndex((o) => o.id === payment.orderId);
      if (oIdx !== -1) {
        orders[oIdx] = {
          ...orders[oIdx],
          status: 'PAID',
          updatedAt: nowIso
        };
        orderService['saveLocalOrders'](orders);
      }

      // Emisión server-side / sandbox local de boletos (Fase 6)
      try {
        await ticketService.issueLocalTicketsForPaidOrder(payment.orderId, operator);
      } catch (tktErr) {
        console.warn('[SHIKKUM] Nota de emisión local de tickets:', tktErr);
      }

      // Preparación y despacho de entradas por correo electrónico (Fase 7)
      try {
        await emailDispatchService.sendTicketsEmail(payment.orderId);
      } catch (emailErr) {
        console.warn('[SHIKKUM] Nota de despacho de correo tras confirmación de pago:', emailErr);
      }
    }
  }

  /**
   * Rechazo de pago no válido con registro de auditoría
   */
  async rejectPayment(request: RejectPaymentRequest): Promise<{
    success: boolean;
    paymentId: string;
    status: string;
    isIdempotentReplay?: boolean;
  }> {
    const currentUser = authService.getCurrentUser();
    if (!currentUser) {
      throw new Error('El usuario no está autenticado.');
    }
    if (!currentUser.isActive) {
      throw new Error('El usuario operador se encuentra desactivado.');
    }
    if (currentUser.role !== 'admin' && currentUser.role !== 'cashier') {
      throw new Error('El usuario no está autorizado para rechazar pagos.');
    }

    const { paymentId, reason } = request;
    if (!paymentId) {
      throw new Error('No se encontró el pago.');
    }
    if (!reason || reason.trim().length < 3) {
      throw new Error('Debe proporcionar un motivo de rechazo válido (mínimo 3 caracteres).');
    }

    if (functions) {
      try {
        const rejectPaymentFn = httpsCallable<any, any>(functions, 'rejectPayment');
        const result = await rejectPaymentFn({ paymentId, reason: reason.trim() });
        if (result.data && result.data.success) {
          this.syncLocalPaymentRejected(paymentId, currentUser, reason.trim());
          return result.data;
        }
      } catch (fnError: any) {
        console.warn('[SHIKKUM] Falló invocación de Cloud Function rejectPayment:', fnError);
        const code = fnError?.code;
        const msg = fnError?.message || '';

        if (code === 'unauthenticated' || code === 'permission-denied' || code === 'failed-precondition' || code === 'invalid-argument') {
          throw new Error(msg || 'Error al rechazar el pago.');
        }

        if (isProductionEnvironment) {
          throw new Error(`Error en el servidor de pagos: ${msg || 'Error desconocido'}`);
        }
      }
    }

    return this.executeLocalPaymentRejection(paymentId, currentUser, reason.trim());
  }

  private async executeLocalPaymentRejection(
    paymentId: string,
    currentUser: { uid: string; displayName?: string },
    reason: string
  ) {
    const payment = await this.getPaymentById(paymentId);
    if (!payment) {
      throw new Error('No se encontró el pago.');
    }

    if (payment.status === 'REJECTED') {
      return {
        success: true,
        isIdempotentReplay: true,
        paymentId: payment.id,
        status: 'REJECTED'
      };
    }

    if (payment.status === 'CONFIRMED') {
      throw new Error('No se puede rechazar un pago que ya fue confirmado.');
    }

    const nowIso = new Date().toISOString();
    this.syncLocalPaymentRejected(paymentId, currentUser, reason, nowIso);

    return {
      success: true,
      paymentId: payment.id,
      status: 'REJECTED'
    };
  }

  private syncLocalPaymentRejected(
    paymentId: string,
    operator: { uid: string; displayName?: string },
    reason: string,
    timestamp?: string
  ) {
    const nowIso = timestamp || new Date().toISOString();
    const payments = this.getLocalPayments();
    const pIdx = payments.findIndex((p) => p.id === paymentId);

    if (pIdx !== -1) {
      payments[pIdx] = {
        ...payments[pIdx],
        status: 'REJECTED',
        rejectedBy: operator.uid,
        rejectedByName: operator.displayName || 'Operador',
        rejectedAt: nowIso,
        rejectionReason: reason
      };
      this.saveLocalPayments(payments);
    }
  }

  /**
   * Obtener lista de pagos con filtros avanzados
   */
  async getPayments(filters?: PaymentFilterParams): Promise<Payment[]> {
    let payments: Payment[] = [];

    if (this.hasLiveFirebase()) {
      try {
        const snap = await getDocs(collection(db, 'payments'));
        snap.forEach((d) => {
          payments.push({ id: d.id, ...(d.data() as Omit<Payment, 'id'>) });
        });
      } catch (err) {
        console.warn('Error al consultar /payments en Firestore:', err);
      }
    }

    if (payments.length === 0) {
      payments = this.getLocalPayments();
    }

    if (!filters) return payments;

    return payments.filter((p) => {
      if (filters.status && filters.status !== ('ALL' as any) && p.status !== filters.status) {
        return false;
      }
      if (filters.method && filters.method !== ('ALL' as any) && p.method !== filters.method) {
        return false;
      }
      if (filters.searchTerm && filters.searchTerm.trim()) {
        const term = filters.searchTerm.toLowerCase().trim();
        const matchesCode = p.orderCode.toLowerCase().includes(term);
        const matchesRef = p.reference ? p.reference.toLowerCase().includes(term) : false;
        const matchesReg = p.registeredByName ? p.registeredByName.toLowerCase().includes(term) : false;
        if (!matchesCode && !matchesRef && !matchesReg) return false;
      }
      return true;
    });
  }

  /**
   * Obtener todos los pagos vinculados a una orden
   */
  async getPaymentsByOrderId(orderId: string): Promise<Payment[]> {
    if (this.hasLiveFirebase()) {
      try {
        const q = query(collection(db, 'payments'), where('orderId', '==', orderId));
        const snap = await getDocs(q);
        if (!snap.empty) {
          const list: Payment[] = [];
          snap.forEach((d) => {
            list.push({ id: d.id, ...(d.data() as Omit<Payment, 'id'>) });
          });
          return list;
        }
      } catch (err) {
        console.warn('Error al consultar pagos por orderId en Firestore:', err);
      }
    }

    const localPayments = this.getLocalPayments();
    return localPayments.filter((p) => p.orderId === orderId);
  }

  /**
   * Obtener el pago activo o más relevante de una orden:
   * Prioriza el pago CONFIRMED; si no hay, devuelve el más reciente PENDING, o el último registrado
   */
  async getPaymentForOrder(orderId: string): Promise<Payment | null> {
    const list = await this.getPaymentsByOrderId(orderId);
    if (list.length === 0) return null;

    const confirmed = list.find((p) => p.status === 'CONFIRMED');
    if (confirmed) return confirmed;

    const pending = list.find((p) => p.status === 'PENDING');
    if (pending) return pending;

    return list[0];
  }

  /**
   * Obtener pago por ID
   */
  async getPaymentById(paymentId: string): Promise<Payment | null> {
    if (this.hasLiveFirebase()) {
      try {
        const snap = await getDoc(doc(db, 'payments', paymentId));
        if (snap.exists()) {
          return { id: snap.id, ...(snap.data() as Omit<Payment, 'id'>) };
        }
      } catch (err) {
        console.warn('Error al obtener pago en Firestore:', err);
      }
    }

    const localPayments = this.getLocalPayments();
    return localPayments.find((p) => p.id === paymentId) || null;
  }
}

export const paymentService = new PaymentService();
