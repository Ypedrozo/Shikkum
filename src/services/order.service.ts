import {
  collection,
  doc,
  getDocs,
  getDoc,
  writeBatch,
  updateDoc
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions, isFirebaseConfigured, isProductionEnvironment } from './firebase';
import {
  Order,
  OrderAttendee,
  CreateOrderRequest,
  CreateOrderResponse,
  OrderFilterParams,
  PriceRule
} from '../types';
import { authService } from './auth.service';
import { customerService } from './customer.service';
import { eventService } from './event.service';
import { pricingService } from './pricing.service';

const ORDERS_STORAGE_KEY = 'shikkum_orders_store_v1';
const ATTENDEES_STORAGE_KEY = 'shikkum_order_attendees_store_v1';

// Semillas iniciales para demostración y pruebas en sandbox local
const INITIAL_DEMO_ORDERS: Order[] = [
  {
    id: 'ord_demo_001',
    orderCode: 'SHK-2026-DEMO01',
    customerId: 'cust_demo_001',
    customerName: 'Cliente Demo Uno',
    eventId: 'evt_demo_001',
    eventTitle: 'Conferencia Anual de Tecnología 2026',
    createdBy: 'usr_cashier_01',
    createdAt: '2026-09-02T14:30:00.000Z',
    updatedAt: '2026-09-02T14:30:00.000Z',
    status: 'PAID',
    attendeeCount: 2,
    subtotal: 55,
    total: 55,
    currency: 'USD',
    requestId: 'req_seed_demo_001'
  },
  {
    id: 'ord_demo_002',
    orderCode: 'SHK-2026-DEMO02',
    customerId: 'cust_demo_002',
    customerName: 'Cliente Demo Dos (No Miembro)',
    eventId: 'evt_demo_001',
    eventTitle: 'Conferencia Anual de Tecnología 2026',
    createdBy: 'usr_cashier_01',
    createdAt: '2026-09-03T10:15:00.000Z',
    updatedAt: '2026-09-03T10:15:00.000Z',
    status: 'PENDING_PAYMENT',
    attendeeCount: 1,
    subtotal: 45,
    total: 45,
    currency: 'USD',
    requestId: 'req_seed_demo_002'
  }
];

const INITIAL_DEMO_ATTENDEES: OrderAttendee[] = [
  {
    id: 'att_demo_001',
    orderId: 'ord_demo_001',
    customerId: 'cust_demo_001',
    eventId: 'evt_demo_001',
    fullName: 'Roberto Gómez',
    ageAtPurchase: 32,
    isCommunityMemberAtPurchase: true,
    priceRuleId: 'rule_demo_001',
    priceRuleName: 'Adulto General (Miembro Comunidad)',
    ticketType: 'General',
    unitPrice: 35,
    subtotal: 35,
    currency: 'USD',
    createdAt: '2026-09-02T14:30:00.000Z'
  },
  {
    id: 'att_demo_002',
    orderId: 'ord_demo_001',
    customerId: 'cust_demo_001',
    eventId: 'evt_demo_001',
    fullName: 'Lucas Gómez',
    ageAtPurchase: 11,
    isCommunityMemberAtPurchase: true,
    priceRuleId: 'rule_demo_003',
    priceRuleName: 'Menor de Edad (Hasta 12 años)',
    ticketType: 'Menores',
    unitPrice: 20,
    subtotal: 20,
    currency: 'USD',
    createdAt: '2026-09-02T14:30:00.000Z'
  },
  {
    id: 'att_demo_003',
    orderId: 'ord_demo_002',
    customerId: 'cust_demo_002',
    eventId: 'evt_demo_001',
    fullName: 'Mariana López',
    ageAtPurchase: 28,
    isCommunityMemberAtPurchase: false,
    priceRuleId: 'rule_demo_002',
    priceRuleName: 'Adulto General (Público General No Miembro)',
    ticketType: 'General',
    unitPrice: 45,
    subtotal: 45,
    currency: 'USD',
    createdAt: '2026-09-03T10:15:00.000Z'
  }
];

class OrderService {
  private hasLiveFirebase(): boolean {
    return isFirebaseConfigured;
  }

  public getLocalOrders(): Order[] {
    try {
      const raw = localStorage.getItem(ORDERS_STORAGE_KEY);
      if (!raw) {
        localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(INITIAL_DEMO_ORDERS));
        return INITIAL_DEMO_ORDERS;
      }
      return JSON.parse(raw);
    } catch {
      return INITIAL_DEMO_ORDERS;
    }
  }

  private saveLocalOrders(orders: Order[]): void {
    try {
      localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(orders));
    } catch (e) {
      console.error('Error al guardar órdenes locales:', e);
    }
  }

  private getLocalAttendees(): OrderAttendee[] {
    try {
      const raw = localStorage.getItem(ATTENDEES_STORAGE_KEY);
      if (!raw) {
        localStorage.setItem(ATTENDEES_STORAGE_KEY, JSON.stringify(INITIAL_DEMO_ATTENDEES));
        return INITIAL_DEMO_ATTENDEES;
      }
      return JSON.parse(raw);
    } catch {
      return INITIAL_DEMO_ATTENDEES;
    }
  }

  private saveLocalAttendees(attendees: OrderAttendee[]): void {
    try {
      localStorage.setItem(ATTENDEES_STORAGE_KEY, JSON.stringify(attendees));
    } catch (e) {
      console.error('Error al guardar asistentes locales:', e);
    }
  }

  /**
   * Creación y confirmación definitiva de la orden
   * AUTORIDAD DE PRECIOS: Siempre valida y calcula en backend/servicio
   */
  async createOrder(request: CreateOrderRequest): Promise<CreateOrderResponse> {
    const currentUser = authService.getCurrentUser();
    if (!currentUser || !currentUser.isActive) {
      throw new Error('Debe estar autenticado y activo para registrar órdenes.');
    }

    if (currentUser.role !== 'admin' && currentUser.role !== 'cashier') {
      throw new Error('Permisos insuficientes: solo Administrador y Cobranzas pueden registrar órdenes.');
    }

    if (!request.requestId || request.requestId.trim().length < 5) {
      throw new Error('Identificador de idempotencia (requestId) inválido.');
    }

    if (!request.customerId) {
      throw new Error('Debe seleccionar un cliente titular.');
    }

    if (!request.eventId) {
      throw new Error('Debe seleccionar un evento.');
    }

    if (!Array.isArray(request.attendees) || request.attendees.length === 0) {
      throw new Error('Debe registrar al menos un asistente.');
    }

    // Validar datos de cada asistente
    for (let i = 0; i < request.attendees.length; i++) {
      const att = request.attendees[i];
      if (!att.fullName || att.fullName.trim() === '') {
        throw new Error(`El asistente #${i + 1} debe tener un nombre completo.`);
      }
      if (typeof att.ageAtPurchase !== 'number' || isNaN(att.ageAtPurchase) || att.ageAtPurchase < 0) {
        throw new Error(`La edad del asistente #${i + 1} (${att.fullName}) debe ser un número mayor o igual a 0.`);
      }
    }

    // Modo Producción con Firebase en vivo
    if (this.hasLiveFirebase()) {
      // 1. Intentar llamar a Cloud Function 2nd Gen
      if (functions) {
        try {
          const createOrderFn = httpsCallable<CreateOrderRequest, CreateOrderResponse>(functions, 'createOrder');
          const result = await createOrderFn(request);
          return result.data;
        } catch (fnError: any) {
          console.warn('[SHIKKUM] Cloud Function createOrder no disponible o error:', fnError);
          // Si es un error de validación de negocio, relanzarlo directamente
          if (fnError?.code && fnError.code !== 'not-found' && fnError.code !== 'unimplemented') {
            throw new Error(fnError.message || 'Error al procesar orden en Cloud Function.');
          }
          // Si la Cloud Function no está desplegada aún en GCP, fallback atómico con Firestore SDK
        }
      }

      // 2. Ejecución atómica directa contra Firestore verificando reglas del servidor
      return this.executeAtomicFirestoreOrder(request, currentUser.uid);
    }

    // En producción nunca permitimos simulación local si no hay Firebase configurado
    if (isProductionEnvironment) {
      throw new Error(
        'Operación bloqueada: El entorno de producción requiere conexión activa a Firebase y Cloud Functions.'
      );
    }

    // Modo Desarrollo / Sandbox Local
    return this.executeLocalSandboxOrder(request, currentUser.uid);
  }

  /**
   * Ejecución atómica en Firestore con verificación estricta de la BD
   */
  private async executeAtomicFirestoreOrder(
    request: CreateOrderRequest,
    callerUid: string
  ): Promise<CreateOrderResponse> {
    // Control de idempotencia
    const orderQuery = await getDocs(collection(db, 'orders'));
    const existing = orderQuery.docs.find((d) => d.data().requestId === request.requestId.trim());
    if (existing) {
      const data = existing.data();
      return {
        orderId: existing.id,
        orderCode: data.orderCode,
        subtotal: data.subtotal,
        total: data.total,
        status: data.status
      };
    }

    // Validar cliente en Firestore
    const customer = await customerService.getCustomerById(request.customerId);
    if (!customer) {
      throw new Error('El cliente seleccionado no existe.');
    }
    if (!customer.isActive) {
      throw new Error('El cliente seleccionado está inactivo. No se admiten órdenes.');
    }

    // Validar evento en Firestore
    const event = await eventService.getEventById(request.eventId);
    if (!event) {
      throw new Error('El evento seleccionado no existe.');
    }
    if (event.status !== 'ACTIVE') {
      throw new Error(`El evento no está disponible para ventas. Estado actual: ${event.status}.`);
    }

    // Obtener reglas activas del evento
    const activeRules = await pricingService.getRulesByEventId(request.eventId, true);
    if (activeRules.length === 0) {
      throw new Error('El evento no cuenta con reglas de precios activas.');
    }

    // Calcular precios deterministas en servidor
    const evaluatedAttendees = this.calculateAttendeePrices(
      request.attendees,
      request.customerId,
      request.eventId,
      activeRules
    );

    let subtotal = 0;
    for (const a of evaluatedAttendees) {
      subtotal += a.subtotal;
    }
    const total = subtotal;

    // Generar código de orden único
    const randomHex = Math.random().toString(36).substring(2, 8).toUpperCase();
    const orderCode = `SHK-2026-${randomHex}`;

    const orderRef = doc(collection(db, 'orders'));
    const orderId = orderRef.id;
    const nowIso = new Date().toISOString();

    const orderRecord: Order = {
      id: orderId,
      orderCode,
      customerId: customer.id,
      customerName: customer.fullName,
      eventId: event.id,
      eventTitle: event.title,
      createdBy: callerUid,
      createdAt: nowIso,
      updatedAt: nowIso,
      status: 'PENDING_PAYMENT',
      attendeeCount: evaluatedAttendees.length,
      subtotal,
      total,
      currency: 'USD',
      requestId: request.requestId.trim()
    };

    const batch = writeBatch(db);
    batch.set(orderRef, orderRecord);

    for (const att of evaluatedAttendees) {
      const attRef = doc(collection(db, 'orders', orderId, 'attendees'));
      const attRecord: OrderAttendee = {
        ...att,
        id: attRef.id,
        orderId,
        createdAt: nowIso
      };
      batch.set(attRef, attRecord);
    }

    await batch.commit();

    return {
      orderId,
      orderCode,
      subtotal,
      total,
      status: 'PENDING_PAYMENT'
    };
  }

  /**
   * Ejecución atómica en Sandbox Local (Desarrollo / Acceptance Testing)
   */
  private async executeLocalSandboxOrder(
    request: CreateOrderRequest,
    callerUid: string
  ): Promise<CreateOrderResponse> {
    const orders = this.getLocalOrders();

    // Idempotencia: Verificar si el requestId ya fue procesado
    const existing = orders.find((o) => o.requestId === request.requestId.trim());
    if (existing) {
      return {
        orderId: existing.id,
        orderCode: existing.orderCode,
        subtotal: existing.subtotal,
        total: existing.total,
        status: existing.status
      };
    }

    // Validar cliente
    const customer = await customerService.getCustomerById(request.customerId);
    if (!customer) {
      throw new Error('El cliente seleccionado no existe.');
    }
    if (!customer.isActive) {
      throw new Error('El cliente seleccionado está inactivo. No se permiten órdenes.');
    }

    // Validar evento
    const event = await eventService.getEventById(request.eventId);
    if (!event) {
      throw new Error('El evento seleccionado no existe.');
    }
    if (event.status !== 'ACTIVE') {
      throw new Error(`El evento no está disponible para ventas. Estado actual: ${event.status}.`);
    }

    // Obtener reglas activas del evento
    const activeRules = await pricingService.getRulesByEventId(request.eventId, true);
    if (activeRules.length === 0) {
      throw new Error('El evento no cuenta con reglas de precios activas.');
    }

    // Calcular precios deterministas
    const evaluatedAttendees = this.calculateAttendeePrices(
      request.attendees,
      request.customerId,
      request.eventId,
      activeRules
    );

    let subtotal = 0;
    for (const a of evaluatedAttendees) {
      subtotal += a.subtotal;
    }
    const total = subtotal;

    const randomHex = Math.random().toString(36).substring(2, 8).toUpperCase();
    const orderCode = `SHK-2026-${randomHex}`;
    const orderId = `ord_${Date.now()}_${randomHex.toLowerCase()}`;
    const nowIso = new Date().toISOString();

    const newOrder: Order = {
      id: orderId,
      orderCode,
      customerId: customer.id,
      customerName: customer.fullName,
      eventId: event.id,
      eventTitle: event.title,
      createdBy: callerUid,
      createdAt: nowIso,
      updatedAt: nowIso,
      status: 'PENDING_PAYMENT',
      attendeeCount: evaluatedAttendees.length,
      subtotal,
      total,
      currency: 'USD',
      requestId: request.requestId.trim()
    };

    const newAttendees: OrderAttendee[] = evaluatedAttendees.map((att, idx) => ({
      ...att,
      id: `att_${orderId}_${idx + 1}`,
      orderId,
      createdAt: nowIso
    }));

    // Persistencia atómica local
    orders.unshift(newOrder);
    this.saveLocalOrders(orders);

    const allAttendees = this.getLocalAttendees();
    allAttendees.push(...newAttendees);
    this.saveLocalAttendees(allAttendees);

    return {
      orderId,
      orderCode,
      subtotal,
      total,
      status: 'PENDING_PAYMENT'
    };
  }

  /**
   * Motor de precios autoritativo: calcula precios exactos y genera snapshots históricos
   */
  private calculateAttendeePrices(
    attendees: CreateOrderRequest['attendees'],
    customerId: string,
    eventId: string,
    availableRules: PriceRule[]
  ): Array<Omit<OrderAttendee, 'id' | 'orderId' | 'createdAt'>> {
    const results: Array<Omit<OrderAttendee, 'id' | 'orderId' | 'createdAt'>> = [];

    for (let i = 0; i < attendees.length; i++) {
      const att = attendees[i];
      const age = Math.floor(att.ageAtPurchase);
      const isMember = Boolean(att.isCommunityMemberAtPurchase);

      const matchingRules = availableRules.filter((rule) => {
        const matchesMinAge = age >= rule.minAge;
        const matchesMaxAge = rule.maxAge === null || rule.maxAge === undefined || age <= rule.maxAge;
        if (!matchesMinAge || !matchesMaxAge) return false;

        if (!isMember && rule.communityMemberOnly) {
          return false;
        }

        return true;
      });

      if (matchingRules.length === 0) {
        throw new Error(
          `No existe una regla de precio aplicable para el asistente #${i + 1} (${att.fullName}, edad: ${age} años, miembro: ${isMember ? 'Sí' : 'No'}).`
        );
      }

      // Ordenar por prioridad desc, especificidad comunitaria desc, precio asc
      matchingRules.sort((a, b) => {
        if (b.priority !== a.priority) return b.priority - a.priority;
        if (a.communityMemberOnly !== b.communityMemberOnly) {
          return a.communityMemberOnly ? -1 : 1;
        }
        return a.price - b.price;
      });

      const chosenRule = matchingRules[0];

      results.push({
        customerId,
        eventId,
        fullName: att.fullName.trim(),
        ageAtPurchase: age,
        isCommunityMemberAtPurchase: isMember,
        priceRuleId: chosenRule.id,
        priceRuleName: chosenRule.name,
        ticketType: chosenRule.ticketType || undefined,
        unitPrice: chosenRule.price,
        subtotal: chosenRule.price,
        currency: 'USD'
      });
    }

    return results;
  }

  /**
   * Consultar órdenes con filtros y ordenamiento
   */
  async getOrders(params?: OrderFilterParams): Promise<Order[]> {
    let ordersList: Order[] = [];

    if (this.hasLiveFirebase()) {
      try {
        const snap = await getDocs(collection(db, 'orders'));
        snap.forEach((d) => {
          ordersList.push({ id: d.id, ...(d.data() as Omit<Order, 'id'>) });
        });
      } catch (err) {
        console.warn('Error al obtener órdenes desde Firestore, usando cache local:', err);
        ordersList = this.getLocalOrders();
      }
    } else {
      ordersList = this.getLocalOrders();
    }

    if (!params) {
      return ordersList.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    }

    let filtered = [...ordersList];

    if (params.searchTerm && params.searchTerm.trim() !== '') {
      const term = params.searchTerm.trim().toLowerCase();
      filtered = filtered.filter(
        (o) =>
          o.orderCode.toLowerCase().includes(term) ||
          o.customerName.toLowerCase().includes(term) ||
          o.eventTitle.toLowerCase().includes(term)
      );
    }

    if (params.eventId) {
      filtered = filtered.filter((o) => o.eventId === params.eventId);
    }

    if (params.status) {
      filtered = filtered.filter((o) => o.status === params.status);
    }

    const sortDir = params.sortByDate || 'desc';
    filtered.sort((a, b) => {
      const tA = new Date(a.createdAt).getTime();
      const tB = new Date(b.createdAt).getTime();
      return sortDir === 'asc' ? tA - tB : tB - tA;
    });

    return filtered;
  }

  /**
   * Obtener orden por identificador
   */
  async getOrderById(orderId: string): Promise<Order | null> {
    if (this.hasLiveFirebase()) {
      try {
        const snap = await getDoc(doc(db, 'orders', orderId));
        if (snap.exists()) {
          return { id: snap.id, ...(snap.data() as Omit<Order, 'id'>) };
        }
      } catch (e) {
        console.warn('Error al obtener orden de Firestore:', e);
      }
    }

    const localOrders = this.getLocalOrders();
    return localOrders.find((o) => o.id === orderId) || null;
  }

  /**
   * Obtener los asistentes registrados en una orden (con sus snapshots históricos de precio)
   */
  async getOrderAttendees(orderId: string): Promise<OrderAttendee[]> {
    if (this.hasLiveFirebase()) {
      try {
        const snap = await getDocs(collection(db, 'orders', orderId, 'attendees'));
        if (!snap.empty) {
          const list: OrderAttendee[] = [];
          snap.forEach((d) => {
            list.push({ id: d.id, ...(d.data() as Omit<OrderAttendee, 'id'>) });
          });
          return list;
        }
      } catch (e) {
        console.warn('Error al obtener asistentes de subcolección en Firestore:', e);
      }
    }

    const localAttendees = this.getLocalAttendees();
    return localAttendees.filter((a) => a.orderId === orderId);
  }

  /**
   * Cancelación administrativa de la orden
   * Solo disponible para Admin, requiere confirmación y conserva todos los datos históricos
   */
  async cancelOrder(orderId: string, reason?: string): Promise<void> {
    const currentUser = authService.getCurrentUser();
    if (!currentUser || currentUser.role !== 'admin') {
      throw new Error('Solo un Administrador tiene autorización para cancelar órdenes.');
    }

    const existingOrder = await this.getOrderById(orderId);
    if (!existingOrder) {
      throw new Error('La orden no existe.');
    }

    if (existingOrder.status === 'CANCELLED') {
      throw new Error('La orden ya se encuentra cancelada.');
    }

    if (existingOrder.status === 'PAID') {
      throw new Error('Una orden pagada no puede ser cancelada mediante este proceso. Requiere un flujo de devolución o reembolso.');
    }

    if (existingOrder.status !== 'PENDING_PAYMENT') {
      throw new Error(`Solo se pueden cancelar órdenes en estado Pendiente de pago. Estado actual: ${existingOrder.status}.`);
    }

    const nowIso = new Date().toISOString();
    const updatePayload = {
      status: 'CANCELLED' as const,
      updatedAt: nowIso,
      cancelledAt: nowIso,
      cancelledBy: currentUser.uid,
      cancellationReason: reason?.trim() || 'Cancelación administrativa'
    };

    if (this.hasLiveFirebase()) {
      await updateDoc(doc(db, 'orders', orderId), updatePayload);
    }

    // Actualizar almacenamiento local
    const orders = this.getLocalOrders();
    const idx = orders.findIndex((o) => o.id === orderId);
    if (idx !== -1) {
      orders[idx] = {
        ...orders[idx],
        ...updatePayload
      };
      this.saveLocalOrders(orders);
    }
  }
}

export const orderService = new OrderService();
