import React, { useState, useEffect } from 'react';
import {
  Ticket as TicketIcon,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  XCircle,
  QrCode,
  Mail,
  RefreshCw,
  AlertCircle,
  ExternalLink,
  ShieldCheck
} from 'lucide-react';
import { Ticket, Event } from '../../types';
import { ticketService } from '../../services/ticket.service';
import { eventService } from '../../services/event.service';
import { TicketModal } from '../../components/tickets/TicketModal';

interface AdminTicketsPageProps {
  onNavigate: (path: string) => void;
  baseRolePath?: string;
}

export const AdminTicketsPage: React.FC<AdminTicketsPageProps> = ({
  onNavigate,
  baseRolePath = '/admin'
}) => {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [eventFilter, setEventFilter] = useState<string>('ALL');

  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);
  const [resendingId, setResendingId] = useState<string | null>(null);

  const loadTickets = async () => {
    try {
      setIsLoading(true);
      const [allTickets, allEvents] = await Promise.all([
        ticketService.getAllTickets({
          eventId: eventFilter !== 'ALL' ? eventFilter : undefined,
          status: statusFilter !== 'ALL' ? statusFilter : undefined
        }),
        eventService.getEvents().catch(() => [])
      ]);
      setTickets(allTickets);
      setEvents(allEvents);
    } catch (err) {
      console.warn('[AdminTicketsPage] Error cargando tickets:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTickets();
  }, [eventFilter, statusFilter]);

  const filteredTickets = tickets.filter((t) => {
    if (statusFilter !== 'ALL' && t.status !== statusFilter) return false;
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      const matchCode = t.ticketCode.toLowerCase().includes(term);
      const matchName = t.attendeeSnapshot.fullName.toLowerCase().includes(term);
      const matchOrder = t.orderSnapshot.orderCode.toLowerCase().includes(term);
      const matchEvent = t.eventSnapshot.title.toLowerCase().includes(term);
      return matchCode || matchName || matchOrder || matchEvent;
    }
    return true;
  });

  const handleQuickResend = async (ticket: Ticket) => {
    try {
      setResendingId(ticket.id);
      setActionFeedback(null);
      const res = await ticketService.resendTicketEmail(ticket.id);
      setActionFeedback(res.message);
      loadTickets();
    } catch (err: any) {
      setActionFeedback(`Error: ${err.message || 'Fallo al reenviar'}`);
    } finally {
      setResendingId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ISSUED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold rounded-full">
            <CheckCircle2 className="w-3 h-3" />
            EMITIDO
          </span>
        );
      case 'USED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[10px] font-bold rounded-full">
            <Clock className="w-3 h-3" />
            UTILIZADO
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[10px] font-bold rounded-full">
            <XCircle className="w-3 h-3" />
            CANCELADO
          </span>
        );
      default:
        return null;
    }
  };

  const stats = {
    total: tickets.length,
    issued: tickets.filter((t) => t.status === 'ISSUED').length,
    used: tickets.filter((t) => t.status === 'USED').length,
    cancelled: tickets.filter((t) => t.status === 'CANCELLED').length
  };

  return (
    <div className="space-y-6">
      {/* Cabecera */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="p-2 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-xl">
                <TicketIcon className="w-5 h-5" />
              </span>
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-400">
                Fase 6: Gestión de Boletos & Control de Acceso
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Boletos y Control de Ingreso
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Registro centralizado de tickets emitidos, reenvíos por correo y auditoría de uso.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              onClick={() => onNavigate('/gate')}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/30 rounded-2xl text-xs font-semibold transition"
              title="Ir a Terminal de Control de Acceso en Puerta"
            >
              <ShieldCheck className="w-4 h-4 text-cyan-400" />
              <span>Terminal de Puerta</span>
              <ExternalLink className="w-3 h-3 text-cyan-400" />
            </button>

            <button
              onClick={loadTickets}
              className="p-2.5 text-slate-400 hover:text-white bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-2xl transition"
              title="Refrescar datos"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-indigo-400' : ''}`} />
            </button>
          </div>
        </div>

        {/* Tarjetas de Métricas */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-4">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">
              Total Emitidos
            </span>
            <span className="text-xl sm:text-2xl font-black font-mono text-white">
              {stats.total}
            </span>
          </div>

          <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-4">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">
              Válidos / Activos
            </span>
            <span className="text-xl sm:text-2xl font-black font-mono text-emerald-400">
              {stats.issued}
            </span>
          </div>

          <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-4">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">
              Utilizados en Puerta
            </span>
            <span className="text-xl sm:text-2xl font-black font-mono text-blue-400">
              {stats.used}
            </span>
          </div>

          <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-4">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">
              Cancelados
            </span>
            <span className="text-xl sm:text-2xl font-black font-mono text-rose-400">
              {stats.cancelled}
            </span>
          </div>
        </div>
      </div>

      {actionFeedback && (
        <div className="p-3 bg-slate-900 border border-slate-800 rounded-2xl text-xs text-slate-300 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-indigo-400 shrink-0" />
          <span>{actionFeedback}</span>
        </div>
      )}

      {/* Barra de Búsqueda y Filtros */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por código, asistente u orden..."
            className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <div className="flex items-center gap-1.5">
            <Filter className="w-4 h-4 text-slate-500" />
            <select
              value={eventFilter}
              onChange={(e) => setEventFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 text-xs text-slate-300 rounded-xl px-3 py-2 focus:outline-none cursor-pointer max-w-[200px] truncate"
            >
              <option value="ALL">Todos los Eventos</option>
              {events.map((ev) => (
                <option key={ev.id} value={ev.id} className="bg-slate-900 text-white">
                  {ev.title}
                </option>
              ))}
            </select>
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 text-xs text-slate-300 rounded-xl px-3 py-2 focus:outline-none cursor-pointer"
          >
            <option value="ALL">Todos los Estados</option>
            <option value="ISSUED">Emitidos (Válidos)</option>
            <option value="USED">Utilizados (Puerta)</option>
            <option value="CANCELLED">Cancelados</option>
          </select>
        </div>
      </div>

      {/* Tabla Principal de Boletos */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        {isLoading ? (
          <div className="py-12 text-center text-xs text-slate-500">Cargando boletos...</div>
        ) : filteredTickets.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-500">
            No se encontraron boletos con los criterios especificados.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Código Boleto</th>
                  <th className="py-3 px-4">Asistente</th>
                  <th className="py-3 px-4">Evento</th>
                  <th className="py-3 px-4">Orden</th>
                  <th className="py-3 px-4">Estado</th>
                  <th className="py-3 px-4">Reenvíos</th>
                  <th className="py-3 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 bg-slate-900/40">
                {filteredTickets.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-3 px-4 font-mono font-bold text-indigo-300">
                      {t.ticketCode}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-white">{t.attendeeSnapshot.fullName}</div>
                      <div className="text-[11px] text-slate-400">
                        {t.attendeeSnapshot.ticketType || 'General'}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-300 truncate max-w-xs">
                      {t.eventSnapshot.title}
                    </td>
                    <td className="py-3 px-4">
                      <button
                        onClick={() => onNavigate(`${baseRolePath}/orders/${t.orderId}`)}
                        className="font-mono text-cyan-400 hover:underline"
                      >
                        {t.orderSnapshot.orderCode}
                      </button>
                    </td>
                    <td className="py-3 px-4">{getStatusBadge(t.status)}</td>
                    <td className="py-3 px-4 text-slate-400 font-mono">
                      {t.emailDelivery?.resendCount || 0}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          onClick={() => handleQuickResend(t)}
                          disabled={resendingId === t.id}
                          className="p-1.5 text-slate-400 hover:text-indigo-300 hover:bg-slate-800 rounded-lg transition"
                          title="Reenviar por correo"
                        >
                          <Mail className={`w-4 h-4 ${resendingId === t.id ? 'animate-pulse text-indigo-400' : ''}`} />
                        </button>
                        <button
                          onClick={() => {
                            setSelectedTicket(t);
                            setIsModalOpen(true);
                          }}
                          className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-medium inline-flex items-center gap-1 transition"
                        >
                          <QrCode className="w-3.5 h-3.5 text-indigo-400" />
                          <span>Ver / QR</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de Detalle */}
      <TicketModal
        ticket={selectedTicket}
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedTicket(null);
        }}
        onTicketUpdated={loadTickets}
      />
    </div>
  );
};
