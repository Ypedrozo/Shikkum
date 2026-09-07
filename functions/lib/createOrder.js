"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createOrder = void 0;
const https_1 = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
// Inicializar Admin SDK si no ha sido inicializado
if (admin.apps.length === 0) {
    admin.initializeApp();
}
const db = admin.firestore();
/**
 * Cloud Function 2nd Gen: createOrder
 * Autoridad definitiva de cálculo de precios y registro atómico de órdenes
 */
exports.createOrder = (0, https_1.onCall)({
    cors: true,
    maxInstances: 10
}, async (request) => {
    // 1. Verificar autenticación
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Debe estar autenticado para registrar órdenes comerciales.');
    }
    const callerUid = request.auth.uid;
    const { requestId, customerId, eventId, attendees } = request.data;
    // Validación básica de entrada
    if (!requestId || typeof requestId !== 'string' || requestId.trim().length < 5) {
        throw new https_1.HttpsError('invalid-argument', 'Se requiere un identificador de idempotencia (requestId) válido.');
    }
    if (!customerId || typeof customerId !== 'string') {
        throw new https_1.HttpsError('invalid-argument', 'El identificador del cliente (customerId) es obligatorio.');
    }
    if (!eventId || typeof eventId !== 'string') {
        throw new https_1.HttpsError('invalid-argument', 'El identificador del evento (eventId) es obligatorio.');
    }
    if (!Array.isArray(attendees) || attendees.length === 0) {
        throw new https_1.HttpsError('invalid-argument', 'La orden debe contener al menos un asistente válido.');
    }
    // 2 y 3. Verificar estado y rol del operador en Firestore
    const userDoc = await db.collection('users').doc(callerUid).get();
    if (!userDoc.exists) {
        throw new https_1.HttpsError('permission-denied', 'El usuario operador no se encuentra registrado en el sistema.');
    }
    const userData = userDoc.data();
    if (!userData || !userData.isActive) {
        throw new https_1.HttpsError('permission-denied', 'El usuario operador se encuentra inactivo. Operación denegada.');
    }
    if (userData.role !== 'admin' && userData.role !== 'cashier') {
        throw new https_1.HttpsError('permission-denied', 'Solo Administrador y Cobranzas tienen autorización para crear órdenes.');
    }
    // 4. Control de idempotencia / duplicados
    const existingOrderQuery = await db
        .collection('orders')
        .where('requestId', '==', requestId.trim())
        .limit(1)
        .get();
    if (!existingOrderQuery.empty) {
        const existingDoc = existingOrderQuery.docs[0];
        const existingData = existingDoc.data();
        return {
            orderId: existingDoc.id,
            orderCode: existingData.orderCode,
            subtotal: existingData.subtotal,
            total: existingData.total,
            status: existingData.status,
            isIdempotentReplay: true
        };
    }
    // 5. Validar Cliente directamente en Firestore
    const customerDoc = await db.collection('customers').doc(customerId).get();
    if (!customerDoc.exists) {
        throw new https_1.HttpsError('not-found', 'El cliente especificado no existe en el sistema.');
    }
    const customerData = customerDoc.data();
    if (!customerData || !customerData.isActive) {
        throw new https_1.HttpsError('failed-precondition', 'El cliente seleccionado está inactivo. No se permiten órdenes para clientes inactivos.');
    }
    const customerName = customerData.fullName || 'Cliente sin nombre';
    // 6. Validar Evento directamente en Firestore
    const eventDoc = await db.collection('events').doc(eventId).get();
    if (!eventDoc.exists) {
        throw new https_1.HttpsError('not-found', 'El evento especificado no existe.');
    }
    const eventData = eventDoc.data();
    if (!eventData) {
        throw new https_1.HttpsError('not-found', 'Información de evento no disponible.');
    }
    if (eventData.status !== 'ACTIVE') {
        throw new https_1.HttpsError('failed-precondition', `El evento no está disponible para ventas. Estado actual: ${eventData.status}. Solo se admiten órdenes para eventos ACTIVE.`);
    }
    const eventTitle = eventData.title || 'Evento sin título';
    // 7. Validar Asistentes (reglas de dominio)
    for (let i = 0; i < attendees.length; i++) {
        const att = attendees[i];
        if (!att.fullName || typeof att.fullName !== 'string' || att.fullName.trim() === '') {
            throw new https_1.HttpsError('invalid-argument', `El asistente #${i + 1} debe tener un nombre completo válido.`);
        }
        if (typeof att.ageAtPurchase !== 'number' || isNaN(att.ageAtPurchase) || att.ageAtPurchase < 0) {
            throw new https_1.HttpsError('invalid-argument', `La edad del asistente "${att.fullName}" debe ser un número entero mayor o igual a 0.`);
        }
    }
    // 8. Obtener reglas de precios vigentes para el evento directamente de Firestore
    const rulesSnapshot = await db
        .collection('price_rules')
        .where('eventId', '==', eventId)
        .where('isActive', '==', true)
        .get();
    if (rulesSnapshot.empty) {
        throw new https_1.HttpsError('failed-precondition', 'El evento no tiene reglas de precios activas configuradas.');
    }
    const availableRules = [];
    rulesSnapshot.forEach((doc) => {
        availableRules.push({
            id: doc.id,
            ...doc.data()
        });
    });
    // 9 y 10. Cálculo definitivo de precios por asistente en Backend
    const nowIso = new Date().toISOString();
    let calculatedSubtotal = 0;
    const evaluatedAttendees = [];
    for (let i = 0; i < attendees.length; i++) {
        const att = attendees[i];
        const age = Math.floor(att.ageAtPurchase);
        const isMember = Boolean(att.isCommunityMemberAtPurchase);
        // Filtrar reglas que cubren la edad y la condición comunitaria
        const eligibleRules = availableRules.filter((rule) => {
            const matchesMinAge = age >= rule.minAge;
            const matchesMaxAge = rule.maxAge === null || rule.maxAge === undefined || age <= rule.maxAge;
            if (!matchesMinAge || !matchesMaxAge)
                return false;
            if (!isMember && rule.communityMemberOnly) {
                return false;
            }
            return true;
        });
        if (eligibleRules.length === 0) {
            throw new https_1.HttpsError('failed-precondition', `No existe una regla de precio aplicable para el asistente #${i + 1} (${att.fullName}, edad: ${age} años, miembro: ${isMember ? 'Sí' : 'No'}).`);
        }
        // Desempate determinista: mayor prioridad, mayor especificidad comunitaria, menor precio
        eligibleRules.sort((a, b) => {
            if (b.priority !== a.priority)
                return b.priority - a.priority;
            if (a.communityMemberOnly !== b.communityMemberOnly) {
                return a.communityMemberOnly ? -1 : 1;
            }
            return a.price - b.price;
        });
        const matchedRule = eligibleRules[0];
        const unitPrice = matchedRule.price;
        const attendeeSubtotal = unitPrice;
        calculatedSubtotal += attendeeSubtotal;
        evaluatedAttendees.push({
            id: db.collection('orders').doc().id, // ID único para el subdocumento
            fullName: att.fullName.trim(),
            ageAtPurchase: age,
            isCommunityMemberAtPurchase: isMember,
            priceRuleId: matchedRule.id,
            priceRuleName: matchedRule.name,
            ticketType: matchedRule.ticketType || undefined,
            unitPrice,
            subtotal: attendeeSubtotal,
            currency: 'USD',
            createdAt: nowIso
        });
    }
    const calculatedTotal = calculatedSubtotal;
    // 11. Generar orderCode único y legible: SHK-2026-XXXXXX
    const randomHex = Math.random().toString(36).substring(2, 8).toUpperCase();
    const orderCode = `SHK-2026-${randomHex}`;
    // 12. Creación atómica de Orden y Asistentes con Batch de Firestore
    const orderRef = db.collection('orders').doc();
    const orderId = orderRef.id;
    const batch = db.batch();
    const orderRecord = {
        id: orderId,
        orderCode,
        customerId,
        customerName,
        eventId,
        eventTitle,
        createdBy: callerUid,
        createdAt: nowIso,
        updatedAt: nowIso,
        status: 'PENDING_PAYMENT',
        attendeeCount: evaluatedAttendees.length,
        subtotal: calculatedSubtotal,
        total: calculatedTotal,
        currency: 'USD',
        requestId: requestId.trim()
    };
    batch.set(orderRef, orderRecord);
    // Guardar cada asistente en la subcolección /orders/{orderId}/attendees/{attendeeId}
    // con el SNAPSHOT HISTÓRICO COMPLETO
    for (const att of evaluatedAttendees) {
        const attendeeRef = orderRef.collection('attendees').doc(att.id);
        batch.set(attendeeRef, {
            id: att.id,
            orderId,
            customerId,
            eventId,
            fullName: att.fullName,
            ageAtPurchase: att.ageAtPurchase,
            isCommunityMemberAtPurchase: att.isCommunityMemberAtPurchase,
            priceRuleId: att.priceRuleId,
            priceRuleName: att.priceRuleName,
            ticketType: att.ticketType || null,
            unitPrice: att.unitPrice,
            subtotal: att.subtotal,
            currency: att.currency,
            createdAt: att.createdAt
        });
    }
    // Ejecución atómica garantizada
    await batch.commit();
    return {
        orderId,
        orderCode,
        subtotal: calculatedSubtotal,
        total: calculatedTotal,
        status: 'PENDING_PAYMENT'
    };
});
//# sourceMappingURL=createOrder.js.map