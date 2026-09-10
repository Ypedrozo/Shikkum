import React, { useState, useEffect, useMemo } from 'react';
import {
  Mail,
  Search,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Clock,
  XCircle,
  RotateCw,
  Send,
  Ticket,
  ExternalLink,
  X
} from 'lucide-react';
import { EmailDispatch, EmailDispatchStatus, Event } from '../../types';
import { emailDispatchService } from '../../services/emailDispatch.service';
import { eventService } from '../../services/event.service';

interface AdminEmailDispatchesPageProps {
  onNavigate: (path: string) => void;
}

export const AdminEmailDispatchesPage: React.FC<AdminEmailDispatchesPageProps> = ({ onNavigate }) => {
  const [dispatches, setDispatches] = useState<EmailDispatch[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Filtros
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | EmailDispatchStatus>('ALL');
  const [selectedEventId, setSelectedEventId] = useState<string>('ALL');

  // Estado de reintento en curso por orden
  const [resendingOrderId, setResendingOrderId] = useState<string | null>(null);

  // Modal para reintento con correo personalizado opcional
  const [selectedDispatchForResend, setSelectedDispatchForResend] = useState<EmailDispatch | null>(null);
  const [customEmailRecipient, setCustomEmailRecipient] = useState<string>('');

  const loadData = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const [dispatchesData, eventsData] = await Promise.all([
        emailDispatchService.getAllDispatches(100),
        eventService.getEvents()
      ]);
      setDispatches(dispatchesData);
      setEvents(eventsData);
    } catch (err: any) {
      setErrorMessage(err.message || 'Error al cargar el historial de correos.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredDispatches = useMemo(() => {
    return dispatches.filter((d) => {
      if (statusFilter !== 'ALL' && d.status !== statusFilter) return false;
      if (selectedEventId !== 'ALL' && d.eventId !== selectedEventId) return false;

      if (!searchTerm.trim()) return true;
      const term = searchTerm.toLowerCase().trim();
      const matchEmail = d.customerEmail.toLowerCase().includes(term);
      const matchOrder = d.orderCode ? d.orderCode.toLowerCase().includes(term) : false;
      const matchOrderId = d.orderId.toLowerCase().includes(term);
      const matchCustomer = d.customerName ? d.customerName.toLowerCase().includes(term) : false;
      const matchEvent = d.eventTitle ? d.eventTitle.toLowerCase().includes(term) : false;

      return matchEmail || matchOrder || matchOrderId || matchCustomer || matchEvent;
    });
  }, [dispatches, searchTerm, statusFilter, selectedEventId]);

  // Contadores
  const stats = useMemo(() => {
    let sent = 0;
    let pending = 0;
    let failed = 0;
    dispatches.forEach((d) => {
      if (d.status === 'SENT') sent++;
      else if (d.status === 'FAILED') failed++;
      else pending++;
    });
    return { sent, pending, failed, total: dispatches.length };
  }, [dispatches]);

  const handleOpenResendModal = (dispatch: EmailDispatch) => {
    setSelectedDispatchForResend(dispatch);
    setCustomEmailRecipient(dispatch.customerEmail || '');
  };

  const handleExecuteResend = async () => {
    if (!selectedDispatchForResend) return;
    const orderId = selectedDispatchForResend.orderId;
    setResendingOrderId(orderId);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const result = await emailDispatchService.resendTicketsEmail(
        orderId,
        customEmailRecipient.trim() || undefined
      );

      if (result.success) {
        setSuccessMessage(`Boleto(s) reenviado(s) exitosamente a ${result.recipient}`);
        setSelectedDispatchForResend(null);
        // Recargar datos actualizados
        await loadData();
      } else {
        setErrorMessage(result.errorMessage || 'El envío falló al ser procesado.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error al solicitar el reenvío de correo.');
    } finally {
      setResendingOrderId(null);
    }
  };

  const getStatusBadge = (status: EmailDispatchStatus) => {
    switch (status) {
      case 'SENT':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Enviado</span>
          </span>
        );
      case 'FAILED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <XCircle className="w-3.5 h-3.5" />
            <span>Fallido</span>
          </span>
        );
      case 'SENDING':
      case 'PENDING':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Clock className="w-3.5 h-3.5 animate-spin" />
            <span>Pendiente</span>
          </span>
        );
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="p-2 bg-indigo-600/10 text-indigo-400 border border-indigo-500/20 rounded-xl">
                <Mail className="w-5 h-5" />
              </span>
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-400">
                Auditoría de Notificaciones
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Control de Correo y Despachos
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Monitoreo en tiempo real del envío de boletos con códigos QR criptográficos a través de Resend API.
            </p>
          </div>

          <button
            id="btn-refresh-dispatches"
            onClick={loadData}
            disabled={isLoading}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-bold border border-slate-700 transition self-start sm:self-auto"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Actualizar</span>
          </button>
        </div>

        {/* Tarjetas de Estadísticas */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-800/80">
          <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800">
            <span className="text-xs text-slate-400 block mb-1">Total Despachos</span>
            <span className="text-2xl font-bold text-white">{stats.total}</span>
          </div>
          <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800">
            <span className="text-xs text-emerald-400 block mb-1">Entregados (SENT)</span>
            <span className="text-2xl font-bold text-emerald-400">{stats.sent}</span>
          </div>
          <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800">
            <span className="text-xs text-amber-400 block mb-1">En Cola (PENDING)</span>
            <span className="text-2xl font-bold text-amber-400">{stats.pending}</span>
          </div>
          <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800">
            <span className="text-xs text-rose-400 block mb-1">Fallidos (FAILED)</span>
            <span className="text-2xl font-bold text-rose-400">{stats.failed}</span>
          </div>
        </div>

        {/* Notificaciones de éxito / error */}
        {successMessage && (
          <div className="mt-4 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between text-xs text-emerald-400">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMessage}</span>
            </div>
            <button onClick={() => setSuccessMessage(null)} className="text-emerald-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {errorMessage && (
          <div className="mt-4 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-between text-xs text-rose-400">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button onClick={() => setErrorMessage(null)} className="text-rose-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Filtros */}
        <div className="mt-6 pt-6 border-t border-slate-800/80 grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Búsqueda */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por correo, orden o cliente..."
              className="w-full pl-10 pr-4 py-2 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filtro por Estado */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="w-full px-3 py-2 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500 transition"
            >
              <option value="ALL">Todos los estados</option>
              <option value="SENT">Enviados (SENT)</option>
              <option value="FAILED">Fallidos (FAILED)</option>
              <option value="PENDING">Pendientes (PENDING)</option>
            </select>
          </div>

          {/* Filtro por Evento */}
          <div>
            <select
              value={selectedEventId}
              onChange={(e) => setSelectedEventId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500 transition"
            >
              <option value="ALL">Todos los eventos</option>
              {events.map((evt) => (
                <option key={evt.id} value={evt.id}>
                  {evt.title}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Tabla de Despachos */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 sm:p-6 border-b border-slate-800 flex items-center justify-between">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Mail className="w-4 h-4 text-indigo-400" />
            <span>Historial de Envíos ({filteredDispatches.length})</span>
          </h2>
          <span className="text-xs text-slate-400">
            Reintentos usan los mismos boletos determinísticos
          </span>
        </div>

        {isLoading ? (
          <div className="py-16 text-center text-slate-400 text-xs">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-500" />
            <span>Cargando registros de correo...</span>
          </div>
        ) : filteredDispatches.length === 0 ? (
          <div className="py-16 text-center text-slate-500 text-xs">
            No se encontraron registros de correo con los filtros aplicados.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Orden</th>
                  <th className="py-3 px-4">Cliente / Destinatario</th>
                  <th className="py-3 px-4">Evento</th>
                  <th className="py-3 px-4">Entradas</th>
                  <th className="py-3 px-4">Estado</th>
                  <th className="py-3 px-4">Fecha / Intento</th>
                  <th className="py-3 px-4">Reintentos</th>
                  <th className="py-3 px-4 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredDispatches.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-3 px-4">
                      <button
                        onClick={() => onNavigate(`/admin/orders/${d.orderId}`)}
                        className="font-mono font-bold text-indigo-400 hover:text-indigo-300 hover:underline inline-flex items-center gap-1"
                      >
                        <span>{d.orderCode || d.orderId}</span>
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-white">{d.customerName || 'Cliente'}</div>
                      <div className="text-slate-400 font-mono text-[11px]">{d.customerEmail}</div>
                    </td>
                    <td className="py-3 px-4 text-slate-300 max-w-[200px] truncate">
                      {d.eventTitle || d.eventId}
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800 text-slate-200 font-mono">
                        <Ticket className="w-3 h-3 text-indigo-400" />
                        <span>{d.ticketIds?.length || 0}</span>
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {getStatusBadge(d.status)}
                      {d.errorMessage && (
                        <div className="text-[11px] text-rose-400 mt-1 max-w-[220px] truncate" title={d.errorMessage}>
                          {d.errorMessage}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-400">
                      <div>{new Date(d.createdAt).toLocaleDateString()}</div>
                      <div className="text-[11px] text-slate-500">{new Date(d.createdAt).toLocaleTimeString()}</div>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`font-mono text-xs ${d.retryCount > 0 ? 'text-amber-400 font-bold' : 'text-slate-400'}`}>
                        {d.retryCount}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => handleOpenResendModal(d)}
                        disabled={resendingOrderId === d.orderId}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 rounded-lg text-xs font-semibold border border-indigo-500/30 transition disabled:opacity-50"
                      >
                        <RotateCw className={`w-3.5 h-3.5 ${resendingOrderId === d.orderId ? 'animate-spin' : ''}`} />
                        <span>Reintentar</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Reintentar Envío con Dirección Opcional */}
      {selectedDispatchForResend && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-indigo-600/10 text-indigo-400 border border-indigo-500/20">
                  <Send className="w-4 h-4" />
                </span>
                <h3 className="text-base font-bold text-white">Reintentar Envío de Entradas</h3>
              </div>
              <button
                onClick={() => setSelectedDispatchForResend(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800 space-y-1">
                <div className="flex justify-between text-slate-400">
                  <span>Orden:</span>
                  <span className="font-mono text-white font-bold">{selectedDispatchForResend.orderCode || selectedDispatchForResend.orderId}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Evento:</span>
                  <span className="text-white truncate max-w-[200px]">{selectedDispatchForResend.eventTitle}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Boletos a enviar:</span>
                  <span className="text-indigo-400 font-bold">{selectedDispatchForResend.ticketIds?.length || 0} boletos</span>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  Dirección de Correo Destinatario:
                </label>
                <input
                  type="email"
                  value={customEmailRecipient}
                  onChange={(e) => setCustomEmailRecipient(e.target.value)}
                  placeholder="ejemplo@correo.com"
                  className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:outline-none focus:border-indigo-500 font-mono"
                />
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Los mismos códigos QR inmutables serán enviados a esta dirección.
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                onClick={() => setSelectedDispatchForResend(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleExecuteResend}
                disabled={resendingOrderId !== null}
                className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-lg transition disabled:opacity-50"
              >
                {resendingOrderId ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Enviando...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Enviar Boletos</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
