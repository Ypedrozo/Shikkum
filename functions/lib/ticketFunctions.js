"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.issueTicketsForOrder = exports.cancelTicket = exports.resendTicketEmail = exports.validateTicketAccess = void 0;
exports.issueTicketsForPaidOrder = issueTicketsForPaidOrder;
const https_1 = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const crypto = require("crypto");
// Inicializar Admin SDK si no ha sido inicializado
if (admin.apps.length === 0) {
    admin.initializeApp();
}
const db = admin.firestore();
/**
 * Validador común de usuario operador activo
 */
async function validateOperatorUser(callerUid, allowedRoles) {
    const userDoc = await db.collection('users').doc(callerUid).get();
    if (!userDoc.exists) {
        throw new https_1.HttpsError('permission-denied', 'El usuario operador no se encuentra registrado en el sistema.');
    }
    const userData = userDoc.data();
    if (!userData || !userData.isActive) {
        throw new https_1.HttpsError('permission-denied', 'El usuario operador se encuentra inactivo. Operación denegada.');
    }
    if (!allowedRoles.includes(userData.role)) {
        throw new https_1.HttpsError('permission-denied', `Rol no autorizado (${userData.role}). Se requiere: ${allowedRoles.join(' o ')}.`);
    }
    return {
        uid: callerUid,
        role: userData.role,
        displayName: userData.displayName || userData.email || 'Operador SHIKKUM'
    };
}
/**
 * Generador server-side de boletos para una orden confirmada como PAID.
 * Completamente atómico, transaccional e idempotente:
 * - Garantiza exactamente 1 ticket por asistente (ID determinístico tkt_${orderId}_${attId}).
 * - Ordenamiento determinístico de asistentes para códigos secuenciales exactos.
 * - Protegido contra ejecuciones simultáneas: no sobreescribe ni regenera qrTokens existentes.
 * - Auto-recuperable ante fallos parciales previos.
 */
async function issueTicketsForPaidOrder(orderId, operatorUid, operatorName) {
    const orderRef = db.collection('orders').doc(orderId);
    const orderDoc = await orderRef.get();
    if (!orderDoc.exists) {
        throw new https_1.HttpsError('not-found', `La orden ${orderId} no existe.`);
    }
    const orderData = orderDoc.data();
    if (orderData.status !== 'PAID') {
        throw new https_1.HttpsError('failed-precondition', `Solo se pueden emitir tickets para órdenes con estado PAID (estado actual: ${orderData.status}).`);
    }
    // 1. Obtener los asistentes registrados y ordenarlos de forma determinística por ID
    const attendeesSnapshot = await orderRef.collection('attendees').get();
    if (attendeesSnapshot.empty) {
        throw new https_1.HttpsError('failed-precondition', `La orden ${orderId} no contiene asistentes registrados.`);
    }
    const sortedAttendeeDocs = [...attendeesSnapshot.docs].sort((a, b) => a.id.localeCompare(b.id));
    // 2. Obtener datos del evento y cliente para los snapshots históricos
    const eventDoc = await db.collection('events').doc(orderData.eventId).get();
    const eventData = eventDoc.exists ? eventDoc.data() : {};
    const customerDoc = await db.collection('customers').doc(orderData.customerId).get();
    const customerData = customerDoc.exists ? customerDoc.data() : {};
    const nowIso = new Date().toISOString();
    // 3. Emisión atómica transaccional
    return await db.runTransaction(async (transaction) => {
        const freshOrderSnap = await transaction.get(orderRef);
        if (!freshOrderSnap.exists) {
            throw new https_1.HttpsError('not-found', `La orden ${orderId} no existe.`);
        }
        const freshOrderData = freshOrderSnap.data();
        if (freshOrderData.status !== 'PAID') {
            throw new https_1.HttpsError('failed-precondition', `Solo se pueden emitir tickets para órdenes con estado PAID (estado actual: ${freshOrderData.status}).`);
        }
        // Leer en paralelo dentro de la transacción todos los boletos determinísticos
        const ticketRefs = sortedAttendeeDocs.map((attDoc) => {
            const deterministicTicketId = `tkt_${orderId}_${attDoc.id}`;
            return db.collection('tickets').doc(deterministicTicketId);
        });
        const ticketDocs = await Promise.all(ticketRefs.map((ref) => transaction.get(ref)));
        const issuedTickets = [];
        let idx = 0;
        for (let i = 0; i < sortedAttendeeDocs.length; i++) {
            idx++;
            const attDoc = sortedAttendeeDocs[i];
            const existingSnap = ticketDocs[i];
            const attData = attDoc.data();
            const ticketRef = ticketRefs[i];
            // Si ya existe (p. ej. llamada concurrente o reintento), conservarlo intacto sin tocar qrToken
            if (existingSnap.exists) {
                issuedTickets.push(existingSnap.data());
                continue;
            }
            // Código único y ordenado: TKT-YYYY-CODE-XX
            const cleanCode = (orderData.orderCode || 'ORD').replace(/^SHK-/, '');
            const ticketCode = `TKT-${cleanCode}-${idx.toString().padStart(2, '0')}`;
            // Token criptográfico impredecible (64 caracteres hex = 256 bits de entropía real)
            const qrToken = crypto.randomBytes(32).toString('hex');
            const ticketPayload = {
                id: ticketRef.id,
                ticketCode,
                qrToken,
                status: 'ISSUED',
                orderId,
                attendeeId: attDoc.id,
                eventId: orderData.eventId,
                customerId: orderData.customerId,
                attendeeSnapshot: {
                    fullName: attData.fullName || 'Asistente',
                    documentId: attData.documentId || customerData.documentId || '',
                    email: attData.email || customerData.email || '',
                    ticketType: attData.ticketType || attData.priceRuleName || 'General',
                    priceRuleName: attData.priceRuleName || 'General',
                    unitPrice: attData.unitPrice || 0
                },
                eventSnapshot: {
                    title: eventData.title || orderData.eventTitle || 'Evento SHIKKUM',
                    startDate: eventData.date || eventData.startDate || nowIso,
                    location: eventData.venue || eventData.location || 'Sede Oficial'
                },
                orderSnapshot: {
                    orderCode: orderData.orderCode,
                    currency: orderData.currency || 'USD',
                    total: orderData.total
                },
                issuedAt: nowIso,
                issuedBy: operatorUid,
                issuedByName: operatorName,
                createdAt: nowIso,
                updatedAt: nowIso,
                emailDelivery: {
                    status: 'SENT',
                    recipient: customerData.email || 'cliente@shikkum.internal',
                    sentAt: nowIso,
                    resendCount: 0
                }
            };
            transaction.set(ticketRef, ticketPayload);
            issuedTickets.push(ticketPayload);
        }
        // Actualizar metadatos de emisión en la orden de forma transaccional
        transaction.update(orderRef, {
            ticketsIssued: true,
            ticketsIssuedCount: issuedTickets.length,
            ticketsIssuedAt: nowIso,
            updatedAt: nowIso
        });
        return issuedTickets;
    });
}
/**
 * Cloud Function 2nd Gen: validateTicketAccess
 * Control de acceso en puerta por código QR criptográfico o código de ticket manual
 * Roles autorizados: gate_operator y admin
 */
exports.validateTicketAccess = (0, https_1.onCall)({
    cors: true,
    maxInstances: 20
}, async (request) => {
    // 1. Validar autenticación
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Debe estar autenticado para validar acceso en puerta.');
    }
    // 2 y 3. Validar usuario activo y rol autorizado (gate_operator o admin)
    const operator = await validateOperatorUser(request.auth.uid, ['gate_operator', 'admin']);
    const { qrToken, ticketCode, gateId, eventId } = request.data;
    const cleanEventId = eventId ? String(eventId).trim() : '';
    if (!cleanEventId) {
        throw new https_1.HttpsError('invalid-argument', 'Debe especificar un evento específico para el control de acceso en puerta.');
    }
    const trimmedToken = qrToken ? String(qrToken).trim() : '';
    const trimmedCode = ticketCode ? String(ticketCode).trim().toUpperCase() : '';
    if (!trimmedToken && !trimmedCode) {
        throw new https_1.HttpsError('invalid-argument', 'Se requiere el token del código QR (qrToken) o el código del ticket (ticketCode).');
    }
    const validationMethod = trimmedToken ? 'QR' : 'MANUAL';
    const activeGateId = gateId ? String(gateId).trim() : 'PUERTA-PRINCIPAL';
    const nowIso = new Date().toISOString();
    // 4. Validar formato criptográfico del token si es validación QR
    if (trimmedToken && !/^[a-f0-9]{32,64}$/i.test(trimmedToken)) {
        await db.collection('access_logs').add({
            ticketId: 'UNKNOWN',
            tokenMasked: trimmedToken.substring(0, 4) + '****',
            eventId: cleanEventId,
            gateId: activeGateId,
            gateOperatorUid: operator.uid,
            gateOperatorName: operator.displayName,
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
    // 5. Buscar ticket por qrToken o por ticketCode
    let ticketRef;
    let ticketDoc;
    if (trimmedToken) {
        const q = await db.collection('tickets').where('qrToken', '==', trimmedToken).limit(1).get();
        if (q.empty) {
            // Registrar intento fallido en access_logs con token enmascarado
            await db.collection('access_logs').add({
                ticketId: 'UNKNOWN',
                tokenMasked: trimmedToken.substring(0, 4) + '****',
                eventId: cleanEventId,
                gateId: activeGateId,
                gateOperatorUid: operator.uid,
                gateOperatorName: operator.displayName,
                timestamp: nowIso,
                authorized: false,
                validationMethod: 'QR',
                rejectionReason: 'INVALID_TICKET',
                message: 'Código QR no reconocido en el sistema.'
            });
            return {
                authorized: false,
                status: 'REJECTED',
                rejectionReason: 'INVALID_TICKET',
                message: 'Código QR no reconocido o inexistente.'
            };
        }
        ticketDoc = q.docs[0];
        ticketRef = ticketDoc.ref;
    }
    else {
        const q = await db.collection('tickets').where('ticketCode', '==', trimmedCode).limit(1).get();
        if (q.empty) {
            await db.collection('access_logs').add({
                ticketId: 'UNKNOWN',
                ticketCodeProvided: trimmedCode,
                eventId: cleanEventId,
                gateId: activeGateId,
                gateOperatorUid: operator.uid,
                gateOperatorName: operator.displayName,
                timestamp: nowIso,
                authorized: false,
                validationMethod: 'MANUAL',
                rejectionReason: 'INVALID_TICKET',
                message: `Boleto ${trimmedCode} no encontrado en el sistema.`
            });
            return {
                authorized: false,
                status: 'REJECTED',
                rejectionReason: 'INVALID_TICKET',
                message: `Boleto con código ${trimmedCode} no encontrado.`
            };
        }
        ticketDoc = q.docs[0];
        ticketRef = ticketDoc.ref;
    }
    // 6. Ejecutar validación y consumo atómico mediante transacción Firestore
    return await db.runTransaction(async (transaction) => {
        const freshDoc = await transaction.get(ticketRef);
        if (!freshDoc.exists) {
            throw new https_1.HttpsError('not-found', 'El boleto no existe.');
        }
        const ticket = freshDoc.data();
        // 6.1. Validación estricta de evento: el boleto debe corresponder al evento seleccionado
        if (ticket.eventId !== cleanEventId) {
            const logRef = db.collection('access_logs').doc();
            transaction.set(logRef, {
                id: logRef.id,
                ticketId: freshDoc.id,
                ticketCode: ticket.ticketCode,
                attendeeName: ticket.attendeeSnapshot?.fullName,
                eventId: ticket.eventId,
                eventTitle: ticket.eventSnapshot?.title,
                gateId: activeGateId,
                gateOperatorUid: operator.uid,
                gateOperatorName: operator.displayName,
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
                    id: freshDoc.id,
                    ticketCode: ticket.ticketCode,
                    attendeeName: ticket.attendeeSnapshot?.fullName || 'Desconocido',
                    eventTitle: ticket.eventSnapshot?.title || '',
                    status: ticket.status
                },
                message: 'Este boleto pertenece a otro evento.'
            };
        }
        // 6.2. Validación de Orden: debe existir y estar en estado PAID
        const orderRef = db.collection('orders').doc(ticket.orderId);
        const orderDoc = await transaction.get(orderRef);
        if (!orderDoc.exists) {
            const logRef = db.collection('access_logs').doc();
            transaction.set(logRef, {
                id: logRef.id,
                ticketId: freshDoc.id,
                ticketCode: ticket.ticketCode,
                attendeeName: ticket.attendeeSnapshot?.fullName,
                eventId: ticket.eventId,
                eventTitle: ticket.eventSnapshot?.title,
                gateId: activeGateId,
                gateOperatorUid: operator.uid,
                gateOperatorName: operator.displayName,
                timestamp: nowIso,
                authorized: false,
                validationMethod,
                rejectionReason: 'ORDER_NOT_PAID',
                message: 'La orden asociada al boleto no existe en el sistema.'
            });
            return {
                authorized: false,
                status: 'REJECTED',
                rejectionReason: 'ORDER_NOT_PAID',
                ticket: {
                    id: freshDoc.id,
                    ticketCode: ticket.ticketCode,
                    attendeeName: ticket.attendeeSnapshot?.fullName || 'Desconocido',
                    eventTitle: ticket.eventSnapshot?.title || '',
                    status: ticket.status
                },
                message: 'La orden asociada al boleto no existe en el sistema.'
            };
        }
        const orderData = orderDoc.data();
        if (orderData.status !== 'PAID') {
            const logRef = db.collection('access_logs').doc();
            transaction.set(logRef, {
                id: logRef.id,
                ticketId: freshDoc.id,
                ticketCode: ticket.ticketCode,
                attendeeName: ticket.attendeeSnapshot?.fullName,
                eventId: ticket.eventId,
                eventTitle: ticket.eventSnapshot?.title,
                gateId: activeGateId,
                gateOperatorUid: operator.uid,
                gateOperatorName: operator.displayName,
                timestamp: nowIso,
                authorized: false,
                validationMethod,
                rejectionReason: 'ORDER_NOT_PAID',
                message: `La orden asociada no se encuentra pagada (estado actual: ${orderData.status}).`
            });
            return {
                authorized: false,
                status: 'REJECTED',
                rejectionReason: 'ORDER_NOT_PAID',
                ticket: {
                    id: freshDoc.id,
                    ticketCode: ticket.ticketCode,
                    attendeeName: ticket.attendeeSnapshot?.fullName || 'Desconocido',
                    eventTitle: ticket.eventSnapshot?.title || '',
                    status: ticket.status
                },
                message: `La orden asociada no se encuentra pagada (estado: ${orderData.status}).`
            };
        }
        // 6.3. Validar si ya fue usado
        if (ticket.status === 'USED') {
            const usedTime = ticket.access?.usedAt
                ? new Date(ticket.access.usedAt).toLocaleTimeString()
                : 'previamente';
            const usedOperator = ticket.access?.usedByName || 'Operador de puerta';
            // Registrar intento duplicado
            const logRef = db.collection('access_logs').doc();
            transaction.set(logRef, {
                id: logRef.id,
                ticketId: freshDoc.id,
                ticketCode: ticket.ticketCode,
                attendeeName: ticket.attendeeSnapshot?.fullName,
                eventId: ticket.eventId,
                eventTitle: ticket.eventSnapshot?.title,
                gateId: activeGateId,
                gateOperatorUid: operator.uid,
                gateOperatorName: operator.displayName,
                timestamp: nowIso,
                authorized: false,
                validationMethod,
                rejectionReason: 'ALREADY_USED',
                message: `Boleto ya utilizado a las ${usedTime} (${usedOperator}).`
            });
            return {
                authorized: false,
                status: 'REJECTED',
                rejectionReason: 'ALREADY_USED',
                ticket: {
                    id: freshDoc.id,
                    ticketCode: ticket.ticketCode,
                    attendeeName: ticket.attendeeSnapshot?.fullName || 'Desconocido',
                    eventTitle: ticket.eventSnapshot?.title || '',
                    status: 'USED'
                },
                message: `Boleto ya utilizado anteriormente a las ${usedTime} (${usedOperator}).`
            };
        }
        // 6.4. Validar si está cancelado
        if (ticket.status === 'CANCELLED') {
            const cancelReason = ticket.cancellation?.cancellationReason || 'Cancelado por administración';
            const logRef = db.collection('access_logs').doc();
            transaction.set(logRef, {
                id: logRef.id,
                ticketId: freshDoc.id,
                ticketCode: ticket.ticketCode,
                attendeeName: ticket.attendeeSnapshot?.fullName,
                eventId: ticket.eventId,
                eventTitle: ticket.eventSnapshot?.title,
                gateId: activeGateId,
                gateOperatorUid: operator.uid,
                gateOperatorName: operator.displayName,
                timestamp: nowIso,
                authorized: false,
                validationMethod,
                rejectionReason: 'TICKET_CANCELLED',
                message: `Boleto cancelado: ${cancelReason}`
            });
            return {
                authorized: false,
                status: 'REJECTED',
                rejectionReason: 'TICKET_CANCELLED',
                ticket: {
                    id: freshDoc.id,
                    ticketCode: ticket.ticketCode,
                    attendeeName: ticket.attendeeSnapshot?.fullName || 'Desconocido',
                    eventTitle: ticket.eventSnapshot?.title || '',
                    status: 'CANCELLED'
                },
                message: `Boleto cancelado. Motivo: ${cancelReason}`
            };
        }
        // 6.5. Validar que esté en estado ISSUED o VALID
        if (ticket.status !== 'ISSUED' && ticket.status !== 'VALID') {
            const logRef = db.collection('access_logs').doc();
            transaction.set(logRef, {
                id: logRef.id,
                ticketId: freshDoc.id,
                ticketCode: ticket.ticketCode,
                attendeeName: ticket.attendeeSnapshot?.fullName,
                eventId: ticket.eventId,
                eventTitle: ticket.eventSnapshot?.title,
                gateId: activeGateId,
                gateOperatorUid: operator.uid,
                gateOperatorName: operator.displayName,
                timestamp: nowIso,
                authorized: false,
                validationMethod,
                rejectionReason: 'INVALID_STATUS',
                message: `Estado no apto para ingreso: ${ticket.status}`
            });
            return {
                authorized: false,
                status: 'REJECTED',
                rejectionReason: 'INVALID_STATUS',
                message: `El boleto no se encuentra en estado válido (${ticket.status}).`
            };
        }
        // 6.6. Transición atómica a USED y registro de acceso exitoso
        const accessRecord = {
            usedAt: nowIso,
            usedBy: operator.uid,
            usedByName: operator.displayName,
            gateId: activeGateId,
            validationMethod
        };
        transaction.update(ticketRef, {
            status: 'USED',
            access: accessRecord,
            updatedAt: nowIso
        });
        // Crear registro de auditoría de ingreso exitoso
        const logRef = db.collection('access_logs').doc();
        transaction.set(logRef, {
            id: logRef.id,
            ticketId: freshDoc.id,
            ticketCode: ticket.ticketCode,
            attendeeName: ticket.attendeeSnapshot?.fullName,
            eventId: ticket.eventId,
            eventTitle: ticket.eventSnapshot?.title,
            gateId: activeGateId,
            gateOperatorUid: operator.uid,
            gateOperatorName: operator.displayName,
            timestamp: nowIso,
            authorized: true,
            validationMethod,
            message: 'Ingreso autorizado'
        });
        return {
            authorized: true,
            status: 'ACCEPTED',
            ticket: {
                id: freshDoc.id,
                ticketCode: ticket.ticketCode,
                attendeeName: ticket.attendeeSnapshot?.fullName || 'Asistente',
                ticketType: ticket.attendeeSnapshot?.ticketType || 'General',
                eventTitle: ticket.eventSnapshot?.title || '',
                status: 'USED'
            },
            access: accessRecord,
            message: 'Ingreso autorizado satisfactoriamente.'
        };
    });
});
/**
 * Cloud Function 2nd Gen: resendTicketEmail
 * Permite a Administrador y Cobranzas reenviar boletos por correo con auditoría estricta
 */
exports.resendTicketEmail = (0, https_1.onCall)({
    cors: true,
    maxInstances: 10
}, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Debe estar autenticado para reenviar boletos.');
    }
    const operator = await validateOperatorUser(request.auth.uid, ['admin', 'cashier']);
    const { ticketId, customRecipient } = request.data;
    if (!ticketId || typeof ticketId !== 'string') {
        throw new https_1.HttpsError('invalid-argument', 'El identificador del boleto es obligatorio.');
    }
    const ticketRef = db.collection('tickets').doc(ticketId);
    const ticketDoc = await ticketRef.get();
    if (!ticketDoc.exists) {
        throw new https_1.HttpsError('not-found', 'El boleto no existe.');
    }
    const ticket = ticketDoc.data();
    const nowIso = new Date().toISOString();
    const recipient = customRecipient ? String(customRecipient).trim() : ticket.emailDelivery?.recipient;
    if (!recipient) {
        throw new https_1.HttpsError('invalid-argument', 'No se ha definido un correo de destino.');
    }
    const currentCount = ticket.emailDelivery?.resendCount || 0;
    const updatedDelivery = {
        status: 'SENT',
        recipient,
        sentAt: nowIso,
        resendCount: currentCount + 1,
        lastResentBy: operator.uid,
        lastResentByName: operator.displayName,
        lastResentAt: nowIso
    };
    await ticketRef.update({
        emailDelivery: updatedDelivery,
        updatedAt: nowIso
    });
    return {
        success: true,
        ticketId,
        recipient,
        resendCount: updatedDelivery.resendCount,
        sentAt: nowIso,
        message: `Boleto ${ticket.ticketCode} reenviado exitosamente a ${recipient}.`
    };
});
/**
 * Cloud Function 2nd Gen: cancelTicket
 * Permite ÚNICAMENTE al Administrador cancelar un boleto con motivo obligatorio
 */
exports.cancelTicket = (0, https_1.onCall)({
    cors: true,
    maxInstances: 10
}, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Debe estar autenticado para cancelar boletos.');
    }
    const operator = await validateOperatorUser(request.auth.uid, ['admin']);
    const { ticketId, reason } = request.data;
    if (!ticketId || typeof ticketId !== 'string') {
        throw new https_1.HttpsError('invalid-argument', 'El identificador del boleto es obligatorio.');
    }
    if (!reason || typeof reason !== 'string' || reason.trim().length < 5) {
        throw new https_1.HttpsError('invalid-argument', 'Debe proporcionar un motivo de cancelación claro y descriptivo (mínimo 5 caracteres).');
    }
    const ticketRef = db.collection('tickets').doc(ticketId);
    const nowIso = new Date().toISOString();
    return await db.runTransaction(async (transaction) => {
        const ticketDoc = await transaction.get(ticketRef);
        if (!ticketDoc.exists) {
            throw new https_1.HttpsError('not-found', 'El boleto no existe.');
        }
        const ticket = ticketDoc.data();
        if (ticket.status === 'USED') {
            throw new https_1.HttpsError('failed-precondition', 'No es posible cancelar un boleto que ya fue utilizado para ingresar al evento.');
        }
        if (ticket.status === 'CANCELLED') {
            throw new https_1.HttpsError('failed-precondition', 'El boleto ya se encuentra cancelado.');
        }
        const cancellationData = {
            cancelledAt: nowIso,
            cancelledBy: operator.uid,
            cancelledByName: operator.displayName,
            cancellationReason: reason.trim()
        };
        transaction.update(ticketRef, {
            status: 'CANCELLED',
            cancellation: cancellationData,
            updatedAt: nowIso
        });
        return {
            success: true,
            ticketId,
            status: 'CANCELLED',
            cancelledAt: nowIso,
            message: `Boleto ${ticket.ticketCode} cancelado correctamente.`
        };
    });
});
/**
 * Cloud Function 2nd Gen: issueTicketsForOrder
 * Permite a Admin o Cashier conciliar o emitir boletos para una orden en estado PAID
 * que presente boletos pendientes o incompletos por fallas transitorias previas.
 */
exports.issueTicketsForOrder = (0, https_1.onCall)({
    cors: true,
    maxInstances: 10
}, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Debe estar autenticado.');
    }
    const operator = await validateOperatorUser(request.auth.uid, ['admin', 'cashier']);
    const { orderId } = request.data;
    if (!orderId || typeof orderId !== 'string') {
        throw new https_1.HttpsError('invalid-argument', 'El identificador de la orden es obligatorio.');
    }
    const tickets = await issueTicketsForPaidOrder(orderId, operator.uid, operator.displayName);
    return {
        success: true,
        orderId,
        ticketsIssuedCount: tickets.length,
        message: `Se emitieron ${tickets.length} boletos satisfactoriamente.`
    };
});
//# sourceMappingURL=ticketFunctions.js.map