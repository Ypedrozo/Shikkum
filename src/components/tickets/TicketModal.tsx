import React, { useState, useEffect } from 'react';
import {
  X,
  Printer,
  Mail,
  ShieldCheck,
  AlertTriangle,
  Calendar,
  MapPin,
  Clock,
  CheckCircle2,
  XCircle,
  QrCode,
  Download
} from 'lucide-react';
import { Ticket } from '../../types';
import { ticketService } from '../../services/ticket.service';
import { useAuth } from '../../context/AuthContext';

interface TicketModalProps {
  ticket: Ticket | null;
  isOpen: boolean;
  onClose: () => void;
  onTicketUpdated?: () => void;
}

export const TicketModal: React.FC<TicketModalProps> = ({
  ticket,
  isOpen,
  onClose,
  onTicketUpdated
}) => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const isCashierOrAdmin = user?.role === 'admin' || user?.role === 'cashier';

  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [isResending, setIsResending] = useState<boolean>(false);
  const [resendSuccess, setResendSuccess] = useState<string | null>(null);
  const [resendError, setResendError] = useState<string | null>(null);

  const [isCancelModalOpen, setIsCancelModalOpen] = useState<boolean>(false);
  const [cancelReason, setCancelReason] = useState<string>('');
  const [isCancelling, setIsCancelling] = useState<boolean>(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  useEffect(() => {
    if (ticket && isOpen) {
      ticketService.generateQrCodeDataUrl(ticket.qrToken).then(setQrDataUrl);
      setResendSuccess(null);
      setResendError(null);
      setCancelError(null);
    }
  }, [ticket, isOpen]);

  if (!isOpen || !ticket) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleResendEmail = async () => {
    try {
      setIsResending(true);
      setResendError(null);
      setResendSuccess(null);
      const res = await ticketService.resendTicketEmail(ticket.id);
      setResendSuccess(res.message);
      if (onTicketUpdated) onTicketUpdated();
    } catch (err: any) {
      setResendError(err.message || 'Error al reenviar boleto.');
    } finally {
      setIsResending(false);
    }
  };

  const handleCancelTicket = async () => {
    if (!cancelReason || cancelReason.trim().length < 5) {
      setCancelError('Debe ingresar un motivo de cancelación (mínimo 5 caracteres).');
      return;
    }
    try {
      setIsCancelling(true);
      setCancelError(null);
      await ticketService.cancelTicket(ticket.id, cancelReason);
      setIsCancelModalOpen(false);
      setCancelReason('');
      if (onTicketUpdated) onTicketUpdated();
      onClose();
    } catch (err: any) {
      setCancelError(err.message || 'Error al cancelar boleto.');
    } finally {
      setIsCancelling(false);
    }
  };

  const statusBadge = () => {
    switch (ticket.status) {
      case 'ISSUED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-bold rounded-full">
            <CheckCircle2 className="w-3.5 h-3.5" />
            EMITIDO / VÁLIDO
          </span>
        );
      case 'USED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-500/10 text-blue-400 border border-blue-500/20 text-xs font-bold rounded-full">
            <Clock className="w-3.5 h-3.5" />
            UTILIZADO EN PUERTA
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-500/10 text-rose-400 border border-rose-500/20 text-xs font-bold rounded-full">
            <XCircle className="w-3.5 h-3.5" />
            CANCELADO
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden my-8">
        {/* Barra superior de acciones */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/40">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-indigo-400" />
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              Boleto Oficial SHIKKUM
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition"
            title="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Notificaciones */}
        {resendSuccess && (
          <div className="mx-6 mt-4 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-400 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{resendSuccess}</span>
          </div>
        )}
        {resendError && (
          <div className="mx-6 mt-4 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-400 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{resendError}</span>
          </div>
        )}

        {/* Tarjeta Visual de Boleto (Optimizada para pantalla e impresión) */}
        <div id="printable-ticket" className="p-6 sm:p-8 space-y-6 bg-slate-900">
          {/* Cabecera del Boleto */}
          <div className="flex justify-between items-start gap-4 pb-4 border-b border-slate-800">
            <div>
              <span className="text-[10px] font-bold text-indigo-400 tracking-wider uppercase block mb-1">
                {ticket.attendeeSnapshot.ticketType || 'Acceso General'}
              </span>
              <h2 className="text-xl font-extrabold text-white leading-tight">
                {ticket.eventSnapshot.title}
              </h2>
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-xs text-slate-400 mt-2">
                <span className="inline-flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-500" />
                  {ticket.eventSnapshot.startDate
                    ? new Date(ticket.eventSnapshot.startDate).toLocaleDateString('es-ES', {
                        weekday: 'short',
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                      })
                    : 'Fecha por confirmar'}
                </span>
                {ticket.eventSnapshot.location && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-slate-500" />
                    {ticket.eventSnapshot.location}
                  </span>
                )}
              </div>
            </div>
            <div>{statusBadge()}</div>
          </div>

          {/* Código QR Central con fondo de alto contraste */}
          <div className="flex flex-col items-center justify-center p-6 bg-white rounded-2xl shadow-inner border border-slate-200">
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt="Código QR de Acceso"
                className="w-48 h-48 sm:w-56 sm:h-56 object-contain"
              />
            ) : (
              <div className="w-48 h-48 flex items-center justify-center text-slate-400">
                <QrCode className="w-12 h-12 animate-pulse" />
              </div>
            )}
            <span className="font-mono text-xs font-bold text-slate-900 tracking-wider mt-3">
              {ticket.ticketCode}
            </span>
            <span className="text-[10px] text-slate-500 mt-0.5 text-center">
              Token QR seguro e impredecible (un solo uso)
            </span>
          </div>

          {/* Información del Titular y Asistente */}
          <div className="grid grid-cols-2 gap-3 bg-slate-950/60 p-4 rounded-2xl border border-slate-800 text-xs">
            <div>
              <span className="text-[11px] text-slate-500 block">Asistente</span>
              <span className="font-bold text-slate-200 truncate block">
                {ticket.attendeeSnapshot.fullName}
              </span>
              {ticket.attendeeSnapshot.documentId && (
                <span className="text-[10px] text-slate-400">
                  Doc: {ticket.attendeeSnapshot.documentId}
                </span>
              )}
            </div>
            <div>
              <span className="text-[11px] text-slate-500 block">Orden Vinculada</span>
              <span className="font-mono font-semibold text-slate-200 block">
                {ticket.orderSnapshot.orderCode}
              </span>
              <span className="text-[10px] text-slate-400">
                {ticket.orderSnapshot.currency} ${ticket.attendeeSnapshot.unitPrice?.toFixed(2) || '0.00'}
              </span>
            </div>
          </div>

          {/* Información de acceso si ya fue usado */}
          {ticket.status === 'USED' && ticket.access && (
            <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl text-xs text-blue-300 space-y-1">
              <div className="font-semibold flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-blue-400" />
                Ingreso Registrado
              </div>
              <p className="text-[11px] text-slate-300">
                Fecha: {new Date(ticket.access.usedAt || '').toLocaleString()} por{' '}
                <span className="font-bold">{ticket.access.usedByName || 'Operador'}</span> en{' '}
                <span className="font-mono">{ticket.access.gateId}</span> (
                {ticket.access.validationMethod})
              </p>
            </div>
          )}

          {/* Información de cancelación si aplica */}
          {ticket.status === 'CANCELLED' && ticket.cancellation && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-300 space-y-1">
              <div className="font-semibold flex items-center gap-1.5">
                <XCircle className="w-3.5 h-3.5 text-rose-400" />
                Boleto Cancelado por Administración
              </div>
              <p className="text-[11px] text-slate-300">
                Motivo: {ticket.cancellation.cancellationReason}
              </p>
              <p className="text-[10px] text-slate-400">
                Fecha: {new Date(ticket.cancellation.cancelledAt || '').toLocaleString()}
              </p>
            </div>
          )}

          {/* Historial de reenvío por correo */}
          <div className="text-[11px] text-slate-400 flex items-center justify-between px-1">
            <span>
              Entrega:{' '}
              <strong className="text-slate-300">{ticket.emailDelivery.recipient}</strong>
            </span>
            <span>
              Reenvíos:{' '}
              <span className="font-mono text-indigo-400 font-bold">
                {ticket.emailDelivery.resendCount}
              </span>
            </span>
          </div>
        </div>

        {/* Modal de Cancelación para Administrador */}
        {isCancelModalOpen && (
          <div className="p-6 bg-slate-950 border-t border-slate-800 space-y-4">
            <h3 className="text-sm font-bold text-rose-400 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Cancelar Boleto {ticket.ticketCode}
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Esta acción revocará el boleto en el sistema e impedirá el acceso en puerta.
            </p>
            <div>
              <label className="text-xs text-slate-300 font-medium block mb-1">
                Motivo de Cancelación (Requerido)
              </label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Ej. Devolución comercial autorizada por gerencia..."
                className="w-full h-20 px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-rose-500"
              />
            </div>
            {cancelError && <p className="text-xs text-rose-400">{cancelError}</p>}
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setIsCancelModalOpen(false)}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold"
              >
                Volver
              </button>
              <button
                type="button"
                onClick={handleCancelTicket}
                disabled={isCancelling}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-semibold flex items-center gap-2"
              >
                {isCancelling ? 'Cancelando...' : 'Confirmar Cancelación'}
              </button>
            </div>
          </div>
        )}

        {/* Acciones del pie */}
        {!isCancelModalOpen && (
          <div className="px-6 py-4 bg-slate-950 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrint}
                className="inline-flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold transition shadow-sm"
              >
                <Printer className="w-3.5 h-3.5" />
                Imprimir
              </button>

              {qrDataUrl && (
                <a
                  href={qrDataUrl}
                  download={`Boleto_QR_${ticket.ticketCode}.png`}
                  className="inline-flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold transition shadow-sm"
                  title="Descargar código QR en alta resolución"
                >
                  <Download className="w-3.5 h-3.5" />
                  Descargar QR
                </a>
              )}

              {isCashierOrAdmin && (
                <button
                  onClick={handleResendEmail}
                  disabled={isResending}
                  className="inline-flex items-center gap-2 px-3 py-2 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 rounded-xl text-xs font-semibold transition"
                >
                  <Mail className="w-3.5 h-3.5" />
                  {isResending ? 'Reenviando...' : 'Reenviar Correo'}
                </button>
              )}
            </div>

            {isAdmin && ticket.status === 'ISSUED' && (
              <button
                onClick={() => setIsCancelModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-xl text-xs font-semibold transition"
              >
                <XCircle className="w-3.5 h-3.5" />
                Cancelar Boleto
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
