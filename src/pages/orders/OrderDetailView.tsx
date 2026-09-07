import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  User,
  Calendar,
  ShieldCheck,
  AlertTriangle,
  Users,
  XCircle,
  RefreshCw,
  AlertCircle,
  CreditCard,
  CheckCircle2,
  ExternalLink,
  Eye,
  FileText,
  Check,
  X
} from 'lucide-react';
import { Order, OrderAttendee, Payment } from '../../types';
import { orderService } from '../../services/order.service';
import { paymentService } from '../../services/payment.service';
import { useAuth } from '../../context/AuthContext';
import { OrderTicketsList } from '../../components/tickets/OrderTicketsList';

interface OrderDetailViewProps {
  orderId: string;
  onNavigate: (path: string) => void;
  baseRolePath?: '/cashier' | '/admin';
}

export const OrderDetailView: React.FC<OrderDetailViewProps> = ({
  orderId,
  onNavigate,
  baseRolePath = '/cashier'
}) => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const isCashierOrAdmin = user?.role === 'admin' || user?.role === 'cashier';

  const [order, setOrder] = useState<Order | null>(null);
  const [attendees, setAttendees] = useState<OrderAttendee[]>([]);
  const [payment, setPayment] = useState<Payment | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Modal de Cancelación (Solo Admin sobre PENDING_PAYMENT)
  const [isCancelModalOpen, setIsCancelModalOpen] = useState<boolean>(false);
  const [cancelReason, setCancelReason] = useState<string>('');
  const [isCancelling, setIsCancelling] = useState<boolean>(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  // Modal de Rechazo de Pago
  const [isRejectModalOpen, setIsRejectModalOpen] = useState<boolean>(false);
  const [rejectReason, setRejectReason] = useState<string>('');
  const [isRejecting, setIsRejecting] = useState<boolean>(false);
  const [rejectError, setRejectError] = useState<string | null>(null);

  // Estado de confirmación de pago
  const [isConfirmingPayment, setIsConfirmingPayment] = useState<boolean>(false);
  const [paymentActionMessage, setPaymentActionMessage] = useState<string | null>(null);

  // Modal de Visualización de Comprobante
  const [selectedProofUrl, setSelectedProofUrl] = useState<string | null>(null);

  const loadOrderData = async () => {
    try {
      setIsLoading(true);
      setErrorMessage(null);

      const [foundOrder, foundAttendees, orderPayments] = await Promise.all([
        orderService.getOrderById(orderId),
        orderService.getOrderAttendees(orderId),
        paymentService.getPaymentsByOrderId(orderId)
      ]);

      if (!foundOrder) {
        setErrorMessage('La orden solicitada no existe o no fue encontrada.');
        return;
      }

      setOrder(foundOrder);
      setAttendees(foundAttendees);

      // Priorizar el pago confirmado, sino el pendiente más reciente
      const primaryPayment =
        orderPayments.find((p) => p.status === 'CONFIRMED') ||
        orderPayments.find((p) => p.status === 'PENDING') ||
        orderPayments[0] ||
        null;
      setPayment(primaryPayment);
    } catch (err: any) {
      setErrorMessage(err.message || 'Error al cargar los datos de la orden.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadOrderData();
  }, [orderId]);

  const handleCancelOrder = async () => {
    if (!isAdmin || !order) return;
    try {
      setIsCancelling(true);
      setCancelError(null);
      await orderService.cancelOrder(order.id, cancelReason);
      setIsCancelModalOpen(false);
      await loadOrderData();
    } catch (err: any) {
      setCancelError(err.message || 'Error al cancelar la orden.');
    } finally {
      setIsCancelling(false);
    }
  };

  const handleConfirmPayment = async () => {
    if (!payment || !isCashierOrAdmin) return;
    try {
      setIsConfirmingPayment(true);
      setPaymentActionMessage(null);
      await paymentService.confirmPayment({ paymentId: payment.id });
      setPaymentActionMessage('¡Pago confirmado exitosamente! La orden ha pasado a estado PAID.');
      await loadOrderData();
    } catch (err: any) {
      setErrorMessage(err.message || 'Error al confirmar el pago.');
    } finally {
      setIsConfirmingPayment(false);
    }
  };

  const handleRejectPayment = async () => {
    if (!payment || !isCashierOrAdmin) return;
    try {
      setIsRejecting(true);
      setRejectError(null);
      await paymentService.rejectPayment({
        paymentId: payment.id,
        reason: rejectReason
      });
      setIsRejectModalOpen(false);
      setRejectReason('');
      setPaymentActionMessage('El pago ha sido marcado como REJECTED. La orden permanece en PENDING_PAYMENT.');
      await loadOrderData();
    } catch (err: any) {
      setRejectError(err.message || 'Error al rechazar el pago.');
    } finally {
      setIsRejecting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center shadow-xl">
        <RefreshCw className="w-8 h-8 animate-spin text-emerald-400 mx-auto mb-3" />
        <p className="text-sm text-slate-300 font-semibold">Cargando detalle de la orden...</p>
      </div>
    );
  }

  if (errorMessage || !order) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center shadow-xl space-y-4">
        <AlertCircle className="w-10 h-10 text-red-400 mx-auto" />
        <h2 className="text-lg font-bold text-white">Orden no disponible</h2>
        <p className="text-xs text-slate-400">{errorMessage || 'No se pudo encontrar la orden.'}</p>
        <button
          onClick={() => onNavigate(`${baseRolePath}/orders`)}
          className="px-5 py-2 text-xs font-bold bg-slate-800 hover:bg-slate-700 text-white rounded-xl transition"
        >
          Volver a la lista de órdenes
        </button>
      </div>
    );
  }

  const isPending = order.status === 'PENDING_PAYMENT';
  const isPaid = order.status === 'PAID';
  const isCancelled = order.status === 'CANCELLED';

  const formatMethodLabel = (m?: string) => {
    switch (m) {
      case 'CASH':
        return 'Efectivo';
      case 'BANK_TRANSFER':
        return 'Transferencia bancaria';
      case 'CARD':
        return 'Tarjeta';
      case 'OTHER':
        return 'Otro';
      default:
        return m || 'N/A';
    }
  };

  return (
    <div className="space-y-6">
      {/* Barra de Encabezado */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onNavigate(`${baseRolePath}/orders`)}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
              title="Volver a Órdenes"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <h1 className="text-xl sm:text-2xl font-black text-white font-mono tracking-wider">
              {order.orderCode}
            </h1>

            {isPending && (
              <span className="px-2.5 py-0.5 text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-full">
                Pendiente de Pago
              </span>
            )}
            {isPaid && (
              <span className="px-2.5 py-0.5 text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                <span>Pagada</span>
              </span>
            )}
            {isCancelled && (
              <span className="px-2.5 py-0.5 text-[11px] font-bold bg-red-500/20 text-red-400 border border-red-500/30 rounded-full">
                Cancelada
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Registrada el {new Date(order.createdAt).toLocaleString()} por el operador ID:{' '}
            <span className="font-mono text-slate-300">{order.createdBy}</span>
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Botón Registrar Pago si está pendiente */}
          {isPending && isCashierOrAdmin && (
            <button
              onClick={() => onNavigate(`${baseRolePath}/orders/${order.id}/payment`)}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-emerald-600/30 transition"
            >
              <CreditCard className="w-4 h-4" />
              <span>Registrar Pago</span>
            </button>
          )}

          {/* Indicador visual si ya está pagada */}
          {isPaid && (
            <div className="px-3.5 py-1.5 bg-emerald-950/60 border border-emerald-500/40 rounded-xl text-emerald-300 text-xs font-bold flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Pago Confirmado</span>
            </div>
          )}

          {/* Acción administrativa de cancelación (Solo si PENDING_PAYMENT) */}
          {isAdmin && isPending && (
            <button
              onClick={() => {
                setCancelReason('');
                setCancelError(null);
                setIsCancelModalOpen(true);
              }}
              className="px-4 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-300 border border-red-500/30 rounded-xl text-xs font-bold flex items-center gap-1.5 transition"
            >
              <XCircle className="w-4 h-4" />
              <span>Cancelar Orden</span>
            </button>
          )}

          <button
            onClick={() => onNavigate(`${baseRolePath}/orders`)}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 rounded-xl text-xs font-semibold transition"
          >
            Volver a la lista
          </button>
        </div>
      </div>

      {paymentActionMessage && (
        <div className="p-4 bg-emerald-950/60 border border-emerald-500/50 rounded-xl text-emerald-200 text-xs flex items-center gap-2 shadow-lg">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{paymentActionMessage}</span>
        </div>
      )}

      {/* Aviso de congelamiento de precios (Snapshot inmutable) */}
      <div className="p-4 bg-emerald-950/20 border border-emerald-500/30 rounded-xl text-xs text-emerald-200 flex items-start gap-3 shadow-md">
        <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold text-emerald-300">
            Precios Congelados e Inmutables (Snapshot Histórico):
          </span>{' '}
          Los importes y reglas de precio reflejados a continuación fueron registrados y congelados en el
          momento exacto de confirmación de la orden. Ninguna modificación posterior a las reglas de precios del
          evento altera esta orden histórica.
        </div>
      </div>

      {/* Datos si la orden fue cancelada */}
      {isCancelled && (
        <div className="p-4 bg-red-950/30 border border-red-800/60 rounded-xl text-xs text-red-200 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <span className="font-bold text-red-300">Orden Cancelada:</span> Esta orden fue cancelada
            administrativamente el {order.cancelledAt ? new Date(order.cancelledAt).toLocaleString() : 'N/A'}.
            {order.cancellationReason && (
              <p className="text-slate-300 mt-1">
                Motivo: <span className="italic">"{order.cancellationReason}"</span>
              </p>
            )}
          </div>
        </div>
      )}

      {/* Tarjetas Principales: Información General y Evento */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Información del Cliente */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-md space-y-3">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <User className="w-4 h-4 text-emerald-400" />
            <span>Cliente Titular</span>
          </h2>

          <div className="space-y-1.5 text-xs">
            <div className="text-base font-bold text-white">{order.customerName}</div>
            <div className="text-slate-400 font-mono text-[11px]">ID Cliente: {order.customerId}</div>
          </div>
        </div>

        {/* Información del Evento */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-md space-y-3">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-emerald-400" />
            <span>Evento Asociado</span>
          </h2>

          <div className="space-y-1.5 text-xs">
            <div className="text-base font-bold text-white">{order.eventTitle}</div>
            <div className="text-slate-400 font-mono text-[11px]">ID Evento: {order.eventId}</div>
          </div>
        </div>
      </div>

      {/* SECCIÓN OBLIGATORIA: GESTIÓN Y DETALLE DE PAGO (# Pago) */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                <span>Información del Pago</span>
              </h2>
              <p className="text-xs text-slate-400">
                Auditoría financiera, comprobantes bancarios y estado de liquidación.
              </p>
            </div>
          </div>

          {/* Botón o indicador según estado */}
          {payment ? (
            <span
              className={`px-3 py-1 rounded-full text-xs font-bold border self-start sm:self-auto ${
                payment.status === 'CONFIRMED'
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                  : payment.status === 'PENDING'
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                  : 'bg-red-500/20 text-red-300 border-red-500/30'
              }`}
            >
              {payment.status === 'CONFIRMED' && 'Pago Confirmado'}
              {payment.status === 'PENDING' && 'Pago Pendiente de Validación'}
              {payment.status === 'REJECTED' && 'Pago Rechazado'}
            </span>
          ) : isPending && isCashierOrAdmin ? (
            <button
              onClick={() => onNavigate(`${baseRolePath}/orders/${order.id}/payment`)}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-lg shadow-emerald-600/30"
            >
              <CreditCard className="w-4 h-4" />
              <span>Registrar Pago</span>
            </button>
          ) : null}
        </div>

        {payment ? (
          <div className="space-y-5">
            {/* Cuadrícula de datos del pago */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                <span className="text-slate-500 block text-[11px]">Monto del Pago</span>
                <span className="text-lg font-mono font-bold text-emerald-400">
                  ${payment.amount.toFixed(2)} {payment.currency}
                </span>
                <span className="text-[10px] text-slate-500 block">Total de orden: ${order.total.toFixed(2)}</span>
              </div>

              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                <span className="text-slate-500 block text-[11px]">Método de Pago</span>
                <span className="text-sm font-semibold text-white block mt-0.5">
                  {formatMethodLabel(payment.method)}
                </span>
                <span className="text-[10px] text-slate-500 font-mono">
                  Ref: {payment.reference || 'Sin referencia'}
                </span>
              </div>

              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                <span className="text-slate-500 block text-[11px]">Registrado Por</span>
                <span className="text-sm font-semibold text-slate-200 block mt-0.5">
                  {payment.registeredByName || payment.registeredBy}
                </span>
                <span className="text-[10px] text-slate-500 block">
                  {new Date(payment.registeredAt).toLocaleString()}
                </span>
              </div>

              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                <span className="text-slate-500 block text-[11px]">Estado y Auditoría</span>
                {payment.status === 'CONFIRMED' ? (
                  <div className="mt-0.5">
                    <span className="text-emerald-400 font-semibold block text-xs">
                      Confirmado por: {payment.confirmedByName || payment.confirmedBy || 'Sistema'}
                    </span>
                    <span className="text-[10px] text-slate-500 block">
                      {payment.confirmedAt ? new Date(payment.confirmedAt).toLocaleString() : 'N/A'}
                    </span>
                  </div>
                ) : payment.status === 'REJECTED' ? (
                  <div className="mt-0.5">
                    <span className="text-red-400 font-semibold block text-xs">
                      Rechazado por: {payment.rejectedByName || payment.rejectedBy}
                    </span>
                    <span className="text-[10px] text-slate-500 block">
                      {payment.rejectedAt ? new Date(payment.rejectedAt).toLocaleString() : 'N/A'}
                    </span>
                  </div>
                ) : (
                  <div className="mt-0.5">
                    <span className="text-amber-400 font-semibold block text-xs">Pendiente de Aprobación</span>
                    <span className="text-[10px] text-slate-500 block">En espera de validación</span>
                  </div>
                )}
              </div>
            </div>

            {/* Motivo de rechazo si aplica */}
            {payment.status === 'REJECTED' && payment.rejectionReason && (
              <div className="p-3.5 bg-red-950/40 border border-red-800/60 rounded-xl text-xs text-red-200 flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-red-300">Motivo del Rechazo: </span>
                  <span>{payment.rejectionReason}</span>
                </div>
              </div>
            )}

            {/* Observaciones / Notas */}
            {payment.notes && (
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800/80 text-xs text-slate-300 flex items-start gap-2">
                <FileText className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-slate-400">Observaciones del operador: </span>
                  <span>{payment.notes}</span>
                </div>
              </div>
            )}

            {/* Fila de Acciones sobre el Pago: Comprobante, Confirmar y Rechazar */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <div className="flex items-center gap-3">
                {payment.proofUrl ? (
                  <button
                    onClick={() => setSelectedProofUrl(payment.proofUrl || null)}
                    className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold transition flex items-center gap-2 border border-slate-700"
                  >
                    <Eye className="w-4 h-4 text-emerald-400" />
                    <span>Ver Comprobante de Pago</span>
                  </button>
                ) : (
                  <span className="text-xs text-slate-500 italic">Sin archivo de comprobante adjunto.</span>
                )}
              </div>

              {/* Botones de Confirmación y Rechazo para pagos en PENDING */}
              {payment.status === 'PENDING' && isCashierOrAdmin && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setRejectReason('');
                      setRejectError(null);
                      setIsRejectModalOpen(true);
                    }}
                    disabled={isConfirmingPayment}
                    className="px-4 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-300 border border-red-500/30 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Rechazar Pago</span>
                  </button>

                  <button
                    onClick={handleConfirmPayment}
                    disabled={isConfirmingPayment}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-lg shadow-emerald-600/30"
                  >
                    {isConfirmingPayment ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Confirmando...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Confirmar Pago (Pasar a PAID)</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="py-8 text-center text-slate-500 border border-dashed border-slate-800 rounded-xl space-y-3">
            <p className="text-xs">
              {isCancelled
                ? 'Esta orden fue cancelada sin pagos registrados.'
                : 'No se ha registrado ningún comprobante ni pago para esta orden comercial.'}
            </p>
            {isPending && isCashierOrAdmin && (
              <button
                onClick={() => onNavigate(`${baseRolePath}/orders/${order.id}/payment`)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition inline-flex items-center gap-1.5 shadow-lg shadow-emerald-600/30"
              >
                <CreditCard className="w-3.5 h-3.5" />
                <span>Registrar Pago Ahora</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Tabla de Asistentes y Snapshot Histórico */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-emerald-400" />
            <span>Asistentes Registrados ({attendees.length})</span>
          </h2>
          <span className="text-xs text-slate-400 font-mono">
            Subtotal: ${order.subtotal.toFixed(2)} USD
          </span>
        </div>

        {attendees.length === 0 ? (
          <div className="py-8 text-center text-slate-500 border border-dashed border-slate-800 rounded-xl">
            No se encontraron asistentes registrados para esta orden.
          </div>
        ) : (
          <div className="overflow-x-auto border border-slate-800 rounded-xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">#</th>
                  <th className="py-3 px-4">Nombre Completo</th>
                  <th className="py-3 px-4">Edad en Compra</th>
                  <th className="py-3 px-4">Miembro Comunidad</th>
                  <th className="py-3 px-4">Regla Aplicada (Snapshot)</th>
                  <th className="py-3 px-4 text-right">Precio Unitario</th>
                  <th className="py-3 px-4 text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 bg-slate-900/40">
                {attendees.map((att, idx) => (
                  <tr key={att.id || idx} className="hover:bg-slate-800/40 transition">
                    <td className="py-3 px-4 text-slate-500 font-bold">{idx + 1}</td>
                    <td className="py-3 px-4 font-bold text-slate-200">{att.fullName}</td>
                    <td className="py-3 px-4 text-slate-400 font-mono">{att.ageAtPurchase} años</td>
                    <td className="py-3 px-4">
                      {att.isCommunityMemberAtPurchase ? (
                        <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded">
                          Sí
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 text-[10px] font-semibold bg-slate-800 text-slate-400 rounded">
                          No
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-emerald-400">{att.priceRuleName}</div>
                      <div className="text-[10px] text-slate-500 font-mono">ID: {att.priceRuleId}</div>
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-300">
                      ${att.unitPrice.toFixed(2)} USD
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-white">
                      ${att.subtotal.toFixed(2)} USD
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Resumen Financiero al pie de tabla */}
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="text-xs text-slate-400">
            Total de asistentes: <span className="font-bold text-white">{order.attendeeCount}</span> |
            Moneda oficial: <span className="font-bold text-white">{order.currency}</span>
          </div>

          <div className="flex items-center gap-6 self-end sm:self-auto">
            <div className="text-right">
              <span className="text-[11px] text-slate-500 block">Subtotal</span>
              <span className="text-base font-mono font-bold text-slate-300">
                ${order.subtotal.toFixed(2)} USD
              </span>
            </div>

            <div className="text-right border-l border-slate-800 pl-6">
              <span className="text-[11px] text-slate-400 block font-semibold">Total a Pagar</span>
              <span className="text-2xl font-mono font-black text-emerald-400">
                ${order.total.toFixed(2)} USD
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Módulo de Boletos Emitidos y QR (Fase 6) */}
      {order.status === 'PAID' && (
        <OrderTicketsList orderId={order.id} orderStatus={order.status} />
      )}

      {/* Modal de Visualización Segura de Comprobante */}
      {selectedProofUrl && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-white font-bold text-sm">
                <Eye className="w-4 h-4 text-emerald-400" />
                <span>Comprobante de Pago — {order.orderCode}</span>
              </div>
              <button
                onClick={() => setSelectedProofUrl(null)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="max-h-[70vh] overflow-auto flex items-center justify-center bg-slate-950 rounded-xl p-2 border border-slate-800">
              {selectedProofUrl.includes('data:application/pdf') || selectedProofUrl.endsWith('.pdf') ? (
                <div className="py-12 text-center space-y-3">
                  <FileText className="w-12 h-12 text-emerald-400 mx-auto" />
                  <p className="text-xs text-slate-300 font-semibold">Documento PDF del Comprobante</p>
                  <a
                    href={selectedProofUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition"
                  >
                    <span>Abrir PDF en pestaña nueva</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              ) : (
                <img
                  src={selectedProofUrl}
                  alt="Comprobante de Pago"
                  className="max-h-[65vh] w-auto object-contain rounded-lg"
                />
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedProofUrl(null)}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold transition"
              >
                Cerrar Visor
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Rechazo de Pago */}
      {isRejectModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-red-400">
              <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center border border-red-500/30">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Rechazar Pago Registrado</h3>
                <p className="text-xs text-slate-400">Orden: {order.orderCode}</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Indique el motivo de rechazo del pago (ej. referencia bancaria no coincide con el extracto o
              comprobante borroso). La orden continuará en estado <strong className="text-amber-400">PENDING_PAYMENT</strong> para
              permitir al cliente o al personal registrar el pago corregido.
            </p>

            {rejectError && (
              <div className="p-3 bg-red-950/50 border border-red-800/80 rounded-xl text-red-200 text-xs">
                {rejectError}
              </div>
            )}

            <div className="space-y-1.5 text-xs">
              <label className="block text-slate-400 font-semibold">
                Motivo de Rechazo <span className="text-red-400">*</span>
              </label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Ej. El número de comprobante no figura en el estado de cuenta..."
                rows={3}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-red-500"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setIsRejectModalOpen(false)}
                disabled={isRejecting}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-semibold transition"
              >
                Volver
              </button>

              <button
                onClick={handleRejectPayment}
                disabled={isRejecting}
                className="px-5 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-lg shadow-red-600/30"
              >
                {isRejecting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Rechazando...</span>
                  </>
                ) : (
                  <span>Confirmar Rechazo</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Cancelación Administrativa de la Orden */}
      {isCancelModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-red-400">
              <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center border border-red-500/30">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Cancelar Orden Comercial</h3>
                <p className="text-xs text-slate-400">Código: {order.orderCode}</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              ¿Está seguro de que desea cancelar esta orden? Esta acción cambiará el estado a{' '}
              <strong className="text-red-400">Cancelada</strong>, pero conservará intacto todo el registro
              histórico de los asistentes y los precios congelados con fines de auditoría.
            </p>

            {cancelError && (
              <div className="p-3 bg-red-950/50 border border-red-800/80 rounded-xl text-red-200 text-xs">
                {cancelError}
              </div>
            )}

            <div className="space-y-1.5 text-xs">
              <label className="block text-slate-400 font-semibold">
                Motivo de la cancelación (opcional)
              </label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Ej. Solicitud expresa del cliente antes de pagar..."
                rows={3}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-red-500"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setIsCancelModalOpen(false)}
                disabled={isCancelling}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-semibold transition"
              >
                Volver
              </button>

              <button
                onClick={handleCancelOrder}
                disabled={isCancelling}
                className="px-5 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-lg shadow-red-600/30"
              >
                {isCancelling ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Cancelando...</span>
                  </>
                ) : (
                  <span>Confirmar Cancelación</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
