import React, { useState, useEffect } from 'react';
import {
  Ticket as TicketIcon,
  QrCode,
  Mail,
  CheckCircle2,
  Clock,
  XCircle,
  RefreshCw,
  AlertCircle,
  Send,
  Eye,
  ChevronDown,
  ChevronUp,
  History,
  AlertTriangle
} from 'lucide-react';
import { Ticket, Order, EmailDispatch, Event } from '../../types';
import { ticketService } from '../../services/ticket.service';
import { orderService } from '../../services/order.service';
import { customerService } from '../../services/customer.service';
import { eventService } from '../../services/event.service';
import { emailDispatchService } from '../../services/emailDispatch.service';
import { TicketModal } from './TicketModal';
import { TicketPackageModal } from './TicketPackageModal';
import { ResendEmailConfirmModal } from './ResendEmailConfirmModal';
import { useAuth } from '../../context/AuthContext';

interface OrderTicketsListProps {
  orderId: string;
  orderStatus: string;
}

export const OrderTicketsList: React.FC<OrderTicketsListProps> = ({
  orderId,
  orderStatus
}) => {
  const { user } = useAuth();
  const isCashierOrAdmin = user?.role === 'admin' || user?.role === 'cashier';

  const [order, setOrder] = useState<Order | null>(null);
  const [event, setEvent] = useState<Event | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [dispatches, setDispatches] = useState<EmailDispatch[]>([]);
  const [customerEmail, setCustomerEmail] = useState<string>('');
  
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [isSingleModalOpen, setIsSingleModalOpen] = useState<boolean>(false);
  const [isPackageModalOpen, setIsPackageModalOpen] = useState<boolean>(false);
  const [isResendModalOpen, setIsResendModalOpen] = useState<boolean>(false);
  
  const [isSending, setIsSending] = useState<boolean>(false);
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showHistory, setShowHistory] = useState<boolean>(false);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [ordData, ticketsData, dispatchesData] = await Promise.all([
        orderService.getOrderById(orderId),
        ticketService.getTicketsByOrderId(orderId),
        emailDispatchService.getDispatchesByOrderId(orderId)
      ]);

      setOrder(ordData);
      setTickets(ticketsData);
      setDispatches(dispatchesData);

      if (ordData) {
        // Cargar datos del evento
        if (ordData.eventId) {
          const evt = await eventService.getEventById(ordData.eventId);
          setEvent(evt);
        }
        // Cargar correo del cliente
        if (ordData.customerId) {
          const cust = await customerService.getCustomerById(ordData.customerId);
          if (cust?.email) {
            setCustomerEmail(cust.email);
          }
        }
      }
    } catch (err) {
      console.warn('[OrderTicketsList] Error cargando datos de entradas y despachos:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (orderStatus === 'PAID') {
      loadData();
    }
  }, [orderId, orderStatus]);

  if (orderStatus !== 'PAID') {
    return null;
  }

  const latestDispatch = dispatches.length > 0 ? dispatches[0] : null;
  const isEmailSent = latestDispatch?.status === 'SENT';
  const isEmailFailed = latestDispatch?.status === 'FAILED';
  const totalResends = dispatches.filter((d) => d.isResend).length;

  const handleFirstSend = async () => {
    try {
      setIsSending(true);
      setFeedbackMessage(null);
      const res = await emailDispatchService.sendTicketsEmail(orderId);
      if (res.success) {
        setFeedbackMessage({
          type: 'success',
          text: res.message || 'Entradas enviadas por correo exitosamente.'
        });
      } else {
        setFeedbackMessage({
          type: 'error',
          text: res.message || res.errorMessage || 'No pudimos enviar el correo.'
        });
      }
      await loadData();
    } catch (err: any) {
      setFeedbackMessage({
        type: 'error',
        text: err.message || 'Error al procesar el envío de entradas.'
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleConfirmResend = async (recipientEmail: string) => {
    const res = await emailDispatchService.resendTicketsEmail(orderId, recipientEmail);
    if (res.success) {
      setFeedbackMessage({
        type: 'success',
        text: res.message || `Entradas reenviadas con éxito a: ${recipientEmail}`
      });
    } else {
      setFeedbackMessage({
        type: 'error',
        text: res.message || res.errorMessage || 'No se pudo reenviar el correo.'
      });
    }
    await loadData();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ISSUED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[11px] font-bold rounded-full">
            <CheckCircle2 className="w-3 h-3" />
            EMITIDO
          </span>
        );
      case 'USED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[11px] font-bold rounded-full">
            <Clock className="w-3 h-3" />
            UTILIZADO
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[11px] font-bold rounded-full">
            <XCircle className="w-3 h-3" />
            CANCELADO
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-slate-800 text-slate-400 text-[11px] font-bold rounded-full">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
      
      {/* 1. Encabezado de la Sección ENTRADAS y Botones de Acción */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <TicketIcon className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-white tracking-tight uppercase">
                Entradas
              </h2>
              <span className="px-2.5 py-0.5 bg-slate-800 text-slate-300 rounded-full text-xs font-mono font-bold">
                {tickets.length} {tickets.length === 1 ? 'entrada' : 'entradas'}
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Gestión de emisión de boletos, códigos QR individuales y despacho por correo.
            </p>
          </div>
        </div>

        {/* Acciones Principales Requeridas: [ Ver entradas ] y [ Reenviar entradas ] */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setIsPackageModalOpen(true)}
            disabled={tickets.length === 0}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 border border-slate-700 disabled:opacity-50"
            title="Ver paquete completo de entradas con QR e imprimir"
          >
            <Eye className="w-4 h-4 text-emerald-400" />
            <span>Ver entradas</span>
          </button>

          {isCashierOrAdmin && (
            <button
              onClick={() => setIsResendModalOpen(true)}
              disabled={tickets.length === 0 || isSending}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-lg shadow-emerald-600/30 disabled:opacity-50"
              title="Reenviar el paquete de entradas al comprador"
            >
              <Mail className="w-4 h-4" />
              <span>Reenviar entradas</span>
            </button>
          )}

          <button
            onClick={loadData}
            disabled={isLoading}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition"
            title="Actualizar estado de boletos y envíos"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-emerald-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* 2. Mensajes de Feedback */}
      {feedbackMessage && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-center gap-2.5 ${
            feedbackMessage.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/20 text-rose-300'
          }`}
        >
          {feedbackMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          )}
          <span>{feedbackMessage.text}</span>
        </div>
      )}

      {/* 3. Panel de Estado Visible del Envío (Requerimientos 22 y 23) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        {/* Estado de Generación */}
        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0 mt-0.5">
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div className="flex-1">
            <span className="text-[10px] text-slate-500 block uppercase font-bold tracking-wider">
              Estado de Generación
            </span>
            <span className="text-sm font-bold text-white flex items-center gap-1.5 mt-0.5">
              <span>✓ Entradas generadas</span>
            </span>
            <p className="text-xs text-slate-400 mt-1">
              {tickets.length} {tickets.length === 1 ? 'boleto individual generado' : 'boletos individuales generados'} con QR único e irrepetible.
            </p>
          </div>
        </div>

        {/* Estado del Correo */}
        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex items-start gap-3">
          {isEmailSent ? (
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0 mt-0.5">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          ) : isEmailFailed ? (
            <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 shrink-0 mt-0.5">
              <XCircle className="w-4 h-4" />
            </div>
          ) : (
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0 mt-0.5">
              <AlertTriangle className="w-4 h-4" />
            </div>
          )}

          <div className="flex-1">
            <span className="text-[10px] text-slate-500 block uppercase font-bold tracking-wider">
              Estado del Correo
            </span>

            {isEmailSent ? (
              <div>
                <span className="text-sm font-bold text-emerald-400 block mt-0.5">
                  ✓ Correo enviado
                </span>
                <div className="text-xs text-slate-300 mt-1 space-y-0.5">
                  <div>
                    Destinatario: <strong className="text-white font-mono">{latestDispatch?.customerEmail}</strong>
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Fecha de entrega: {latestDispatch?.sentAt ? new Date(latestDispatch.sentAt).toLocaleString() : 'Recientemente'}
                  </div>
                  {totalResends > 0 && (
                    <div className="text-[10px] text-emerald-400 font-semibold">
                      Reenvíos realizados: {totalResends}
                    </div>
                  )}
                </div>
              </div>
            ) : isEmailFailed ? (
              <div>
                <div className="flex items-center justify-between gap-2 mt-0.5">
                  <span className="text-sm font-bold text-rose-400">
                    ✕ Error de envío
                  </span>
                  {isCashierOrAdmin && (
                    <button
                      onClick={handleFirstSend}
                      disabled={isSending}
                      className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-[11px] font-bold transition flex items-center gap-1 disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3 h-3 ${isSending ? 'animate-spin' : ''}`} />
                      <span>Reintentar</span>
                    </button>
                  )}
                </div>
                <div className="text-xs text-rose-300 mt-1">
                  Motivo: {latestDispatch?.errorMessage || 'Fallo de conexión con el proveedor.'}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  Último intento: {latestDispatch?.lastAttemptAt ? new Date(latestDispatch.lastAttemptAt).toLocaleString() : 'N/A'}
                </div>
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between gap-2 mt-0.5">
                  <span className="text-sm font-bold text-amber-400">
                    ⚠ Correo pendiente
                  </span>
                  {isCashierOrAdmin && (
                    <button
                      onClick={handleFirstSend}
                      disabled={isSending}
                      className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[11px] font-bold transition flex items-center gap-1 disabled:opacity-50 shadow-md"
                    >
                      <Send className="w-3 h-3" />
                      <span>Enviar ahora</span>
                    </button>
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  El paquete está listo para ser despachado a <strong className="text-slate-300">{customerEmail || 'correo del comprador'}</strong>.
                </p>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* 4. Historial de Despachos de Correo (Auditoría) */}
      {dispatches.length > 0 && (
        <div className="bg-slate-950/60 border border-slate-800 rounded-xl overflow-hidden text-xs">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="w-full p-3 flex items-center justify-between text-slate-400 hover:text-white transition"
          >
            <div className="flex items-center gap-2 font-semibold">
              <History className="w-4 h-4 text-emerald-400" />
              <span>Historial de Envíos y Auditoría ({dispatches.length})</span>
            </div>
            {showHistory ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {showHistory && (
            <div className="p-3 border-t border-slate-800 space-y-2 bg-slate-950">
              {dispatches.map((dsp, i) => (
                <div
                  key={dsp.id || i}
                  className="p-2.5 bg-slate-900/80 rounded-lg border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          dsp.status === 'SENT'
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : dsp.status === 'FAILED'
                            ? 'bg-rose-500/20 text-rose-300'
                            : 'bg-amber-500/20 text-amber-300'
                        }`}
                      >
                        {dsp.status}
                      </span>
                      <span className="font-semibold text-white">
                        {dsp.customerEmail}
                      </span>
                      {dsp.isResend && (
                        <span className="text-[10px] text-indigo-400 font-mono">
                          [Reenvío #{dsp.retryCount}]
                        </span>
                      )}
                    </div>
                    {dsp.errorMessage && (
                      <span className="text-rose-400 text-[11px] block mt-1">
                        Error: {dsp.errorMessage}
                      </span>
                    )}
                  </div>
                  <div className="text-right text-[11px] text-slate-400">
                    <div>{dsp.sentAt ? new Date(dsp.sentAt).toLocaleString() : new Date(dsp.createdAt).toLocaleString()}</div>
                    <div className="text-[10px] text-slate-500">
                      Operador: {dsp.triggeredByName || dsp.triggeredBy || 'Sistema'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 5. Cuadrícula de Entradas Individuales */}
      <div className="space-y-3 pt-2">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
          Listado de Entradas de la Orden ({tickets.length})
        </h3>

        {isLoading ? (
          <div className="py-8 text-center text-xs text-slate-500">
            Cargando boletos emitidos...
          </div>
        ) : tickets.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-500 bg-slate-950/40 rounded-xl border border-dashed border-slate-800 p-6">
            No se registran boletos emitidos aún para esta orden.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {tickets.map((t) => (
              <div
                key={t.id}
                className="bg-slate-950/70 border border-slate-800 hover:border-slate-700 rounded-2xl p-4 transition flex flex-col justify-between gap-3 group"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="font-mono text-xs font-bold text-emerald-400 block">
                      {t.ticketCode}
                    </span>
                    <span className="text-sm font-semibold text-white mt-0.5 block truncate">
                      {t.attendeeSnapshot.fullName}
                    </span>
                    <span className="text-[11px] text-slate-400 block">
                      {t.attendeeSnapshot.ticketType || 'Acceso General'}
                    </span>
                  </div>
                  <div>{getStatusBadge(t.status)}</div>
                </div>

                {/* Pie de tarjeta con acciones individuales */}
                <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2 text-xs">
                  <span className="text-[10px] text-slate-500">
                    Reenvíos: {t.emailDelivery?.resendCount || 0}
                  </span>

                  <button
                    onClick={() => {
                      setSelectedTicket(t);
                      setIsSingleModalOpen(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-medium transition border border-slate-700"
                  >
                    <QrCode className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Ver Boleto Individual</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal de Detalle / Impresión de Boleto Individual */}
      <TicketModal
        ticket={selectedTicket}
        isOpen={isSingleModalOpen}
        onClose={() => {
          setIsSingleModalOpen(false);
          setSelectedTicket(null);
        }}
        onTicketUpdated={loadData}
      />

      {/* Modal Profesional de Paquete Completo de Entradas (Fase 7) */}
      {order && (
        <TicketPackageModal
          order={order}
          tickets={tickets}
          event={event}
          isOpen={isPackageModalOpen}
          onClose={() => setIsPackageModalOpen(false)}
        />
      )}

      {/* Modal de Confirmación de Reenvío de Entradas (Fase 7) */}
      {order && (
        <ResendEmailConfirmModal
          order={order}
          defaultEmail={customerEmail || latestDispatch?.customerEmail || ''}
          ticketCount={tickets.length}
          isOpen={isResendModalOpen}
          onClose={() => setIsResendModalOpen(false)}
          onConfirm={handleConfirmResend}
        />
      )}

    </div>
  );
};
