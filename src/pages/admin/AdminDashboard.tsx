import React, { useState, useEffect, useMemo } from 'react';
import {
  DollarSign,
  ShoppingBag,
  Ticket,
  DoorOpen,
  Mail,
  Clock,
  Calendar,
  Users,
  CreditCard,
  FileText,
  ShieldAlert,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ChevronRight,
  TrendingUp,
  Layers
} from 'lucide-react';
import {
  Event,
  Order,
  Payment,
  Ticket as TicketType,
  AccessLog,
  EmailDispatch,
  AuditLog
} from '../../types';
import { eventService } from '../../services/event.service';
import { orderService } from '../../services/order.service';
import { paymentService } from '../../services/payment.service';
import { ticketService } from '../../services/ticket.service';
import { emailDispatchService } from '../../services/emailDispatch.service';
import { auditService } from '../../services/audit.service';

interface AdminDashboardProps {
  onNavigate: (path: string) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onNavigate }) => {
  // Estados de datos
  const [events, setEvents] = useState<Event[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [tickets, setTickets] = useState<TicketType[]>([]);
  const [accessLogs, setAccessLogs] = useState<AccessLog[]>([]);
  const [emailDispatches, setEmailDispatches] = useState<EmailDispatch[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Filtro Global por Evento
  const [selectedEventId, setSelectedEventId] = useState<string>('ALL');

  const loadDashboardData = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const [
        eventsData,
        ordersData,
        paymentsData,
        ticketsData,
        accessData,
        dispatchesData,
        auditData
      ] = await Promise.all([
        eventService.getEvents(),
        orderService.getOrders(),
        paymentService.getPayments(),
        ticketService.getAllTickets(),
        ticketService.getAccessLogs({ limit: 50 }),
        emailDispatchService.getAllDispatches(50),
        auditService.getRecentLogs(20)
      ]);

      setEvents(eventsData);
      setOrders(ordersData);
      setPayments(paymentsData);
      setTickets(ticketsData);
      setAccessLogs(accessData);
      setEmailDispatches(dispatchesData);
      setAuditLogs(auditData);
    } catch (err: any) {
      setErrorMessage(err.message || 'Error al cargar los datos del panel administrativo.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  // Eventos activos (totales o filtrado)
  const activeEventsCount = useMemo(() => {
    return events.filter((e) => e.status === 'ACTIVE').length;
  }, [events]);

  // Filtrado de colecciones por evento seleccionado
  const filteredOrders = useMemo(() => {
    if (selectedEventId === 'ALL') return orders;
    return orders.filter((o) => o.eventId === selectedEventId);
  }, [orders, selectedEventId]);

  const filteredTickets = useMemo(() => {
    if (selectedEventId === 'ALL') return tickets;
    return tickets.filter((t) => t.eventId === selectedEventId);
  }, [tickets, selectedEventId]);

  const filteredAccessLogs = useMemo(() => {
    if (selectedEventId === 'ALL') return accessLogs;
    return accessLogs.filter((a) => a.eventId === selectedEventId);
  }, [accessLogs, selectedEventId]);

  const filteredEmailDispatches = useMemo(() => {
    if (selectedEventId === 'ALL') return emailDispatches;
    return emailDispatches.filter((e) => e.eventId === selectedEventId);
  }, [emailDispatches, selectedEventId]);

  // Métricas agregadas computadas en memoria
  const metrics = useMemo(() => {
    // Recaudación y órdenes
    let totalRevenue = 0;
    let paidOrdersCount = 0;
    filteredOrders.forEach((o) => {
      if (o.status === 'PAID') {
        paidOrdersCount++;
        totalRevenue += o.total || 0;
      }
    });

    // Entradas emitidas y utilizadas
    const issuedTicketsCount = filteredTickets.length;
    let usedTicketsCount = 0;
    filteredTickets.forEach((t) => {
      if (t.status === 'USED') usedTicketsCount++;
    });

    const attendanceRate =
      issuedTicketsCount > 0 ? ((usedTicketsCount / issuedTicketsCount) * 100).toFixed(1) : '0';

    // Correos
    let sentEmails = 0;
    let failedEmails = 0;
    filteredEmailDispatches.forEach((e) => {
      if (e.status === 'SENT') sentEmails++;
      else if (e.status === 'FAILED') failedEmails++;
    });

    // Pagos pendientes de validación
    const pendingPaymentsCount = payments.filter((p) => p.status === 'PENDING').length;

    return {
      totalRevenue,
      totalOrders: filteredOrders.length,
      paidOrdersCount,
      issuedTicketsCount,
      usedTicketsCount,
      attendanceRate,
      sentEmails,
      failedEmails,
      pendingPaymentsCount
    };
  }, [filteredOrders, filteredTickets, filteredEmailDispatches, payments]);

  // Lista de pagos pendientes para el resumen operativo
  const pendingPaymentsList = useMemo(() => {
    return payments.filter((p) => p.status === 'PENDING').slice(0, 5);
  }, [payments]);

  // Últimos errores de correo si existen
  const failedEmailsList = useMemo(() => {
    return filteredEmailDispatches.filter((e) => e.status === 'FAILED').slice(0, 4);
  }, [filteredEmailDispatches]);

  // Resumen de accesos por operador / puerta
  const gateAccessSummary = useMemo(() => {
    const counts: Record<string, { authorized: number; rejected: number }> = {};
    filteredAccessLogs.forEach((l) => {
      const key = l.gateId || l.gateOperatorName || 'Puerta Principal';
      if (!counts[key]) {
        counts[key] = { authorized: 0, rejected: 0 };
      }
      if (l.authorized) counts[key].authorized++;
      else counts[key].rejected++;
    });
    return Object.entries(counts).map(([name, data]) => ({
      name,
      ...data
    }));
  }, [filteredAccessLogs]);

  return (
    <div className="space-y-8">
      {/* 1. Header Card Ejecutivo */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="p-2 bg-indigo-600/10 text-indigo-400 border border-indigo-500/20 rounded-xl">
                <ShieldAlert className="w-5 h-5" />
              </span>
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-400">
                SHIKKUM FASE 8 — OPERACIÓN INTEGRAL
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Dashboard Ejecutivo
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Visión gerencial y control integral de recaudación, emisiones, accesos auditados y notificaciones.
            </p>
          </div>

          {/* Filtro Global por Evento & Botón Refrescar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="relative min-w-[240px]">
              <select
                value={selectedEventId}
                onChange={(e) => setSelectedEventId(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-950/90 border border-slate-800 rounded-xl text-xs font-semibold text-white focus:outline-none focus:border-indigo-500 transition shadow-inner"
              >
                <option value="ALL">🌟 Todos los eventos ({events.length})</option>
                {events.map((evt) => (
                  <option key={evt.id} value={evt.id}>
                    {evt.title} {evt.status === 'ACTIVE' ? '• Activo' : '• ' + evt.status}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={loadDashboardData}
              disabled={isLoading}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-bold border border-slate-700 transition"
              title="Actualizar datos"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Actualizar</span>
            </button>
          </div>
        </div>

        {errorMessage && (
          <div className="mt-4 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-400 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}
      </div>

      {/* 2. Grid de Métricas Globales (KPIs) */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {/* Recaudación Total */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl relative overflow-hidden group hover:border-slate-700 transition">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-400">Total Recaudado</span>
            <span className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
              <DollarSign className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            ${metrics.totalRevenue.toLocaleString()} <span className="text-xs text-slate-400 font-normal">USD</span>
          </div>
          <div className="flex items-center gap-1.5 mt-2 text-xs text-emerald-400 font-medium">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Órdenes pagadas: {metrics.paidOrdersCount} de {metrics.totalOrders}</span>
          </div>
        </div>

        {/* Entradas & Check-in */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl relative overflow-hidden group hover:border-slate-700 transition">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-400">Entradas Emitidas</span>
            <span className="p-2 bg-indigo-500/10 text-indigo-400 rounded-xl border border-indigo-500/20">
              <Ticket className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            {metrics.issuedTicketsCount}
          </div>
          <div className="flex items-center gap-1.5 mt-2 text-xs text-indigo-400 font-medium">
            <DoorOpen className="w-3.5 h-3.5" />
            <span>{metrics.usedTicketsCount} ingresados ({metrics.attendanceRate}%)</span>
          </div>
        </div>

        {/* Correos y Notificaciones */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl relative overflow-hidden group hover:border-slate-700 transition">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-400">Despacho de Correos</span>
            <span className="p-2 bg-cyan-500/10 text-cyan-400 rounded-xl border border-cyan-500/20">
              <Mail className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            {metrics.sentEmails} <span className="text-xs text-slate-400 font-normal">enviados</span>
          </div>
          <div className="flex items-center gap-1.5 mt-2 text-xs">
            {metrics.failedEmails > 0 ? (
              <span className="text-rose-400 font-semibold flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />
                {metrics.failedEmails} fallido(s) que requieren reintento
              </span>
            ) : (
              <span className="text-emerald-400 font-medium flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Entrega sin errores críticos
              </span>
            )}
          </div>
        </div>

        {/* Pagos Pendientes de Aprobación */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl relative overflow-hidden group hover:border-slate-700 transition">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-400">Validación de Pagos</span>
            <span className="p-2 bg-amber-500/10 text-amber-400 rounded-xl border border-amber-500/20">
              <Clock className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            {metrics.pendingPaymentsCount} <span className="text-xs text-slate-400 font-normal">por aprobar</span>
          </div>
          <div className="flex items-center gap-1.5 mt-2 text-xs text-amber-400 font-medium">
            <span>{activeEventsCount} eventos activos en cartelera</span>
          </div>
        </div>
      </div>

      {/* 3. Acceso Rápido a los 9 Módulos Operativos */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-2">
          <Layers className="w-4 h-4 text-indigo-400" />
          <span>Acceso Directo a Módulos del Sistema</span>
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          <button
            onClick={() => onNavigate('/admin/events')}
            className="flex flex-col items-center justify-center p-3.5 bg-slate-950/60 hover:bg-slate-800/80 border border-slate-800 rounded-xl text-center group transition"
          >
            <Calendar className="w-5 h-5 text-indigo-400 mb-1.5 group-hover:scale-110 transition" />
            <span className="text-xs font-bold text-white">Eventos</span>
            <span className="text-[10px] text-slate-500">Cartelera y aforos</span>
          </button>

          <button
            onClick={() => onNavigate('/admin/customers')}
            className="flex flex-col items-center justify-center p-3.5 bg-slate-950/60 hover:bg-slate-800/80 border border-slate-800 rounded-xl text-center group transition"
          >
            <Users className="w-5 h-5 text-indigo-400 mb-1.5 group-hover:scale-110 transition" />
            <span className="text-xs font-bold text-white">Clientes</span>
            <span className="text-[10px] text-slate-500">Directorio unificado</span>
          </button>

          <button
            onClick={() => onNavigate('/admin/price-rules')}
            className="flex flex-col items-center justify-center p-3.5 bg-slate-950/60 hover:bg-slate-800/80 border border-slate-800 rounded-xl text-center group transition"
          >
            <DollarSign className="w-5 h-5 text-indigo-400 mb-1.5 group-hover:scale-110 transition" />
            <span className="text-xs font-bold text-white">Precios</span>
            <span className="text-[10px] text-slate-500">Tarifas y lotes</span>
          </button>

          <button
            onClick={() => onNavigate('/admin/orders')}
            className="flex flex-col items-center justify-center p-3.5 bg-slate-950/60 hover:bg-slate-800/80 border border-slate-800 rounded-xl text-center group transition"
          >
            <ShoppingBag className="w-5 h-5 text-indigo-400 mb-1.5 group-hover:scale-110 transition" />
            <span className="text-xs font-bold text-white">Órdenes</span>
            <span className="text-[10px] text-slate-500">Emisiones y ventas</span>
          </button>

          <button
            onClick={() => onNavigate('/admin/payments')}
            className="flex flex-col items-center justify-center p-3.5 bg-slate-950/60 hover:bg-slate-800/80 border border-slate-800 rounded-xl text-center group transition"
          >
            <CreditCard className="w-5 h-5 text-indigo-400 mb-1.5 group-hover:scale-110 transition" />
            <span className="text-xs font-bold text-white">Pagos</span>
            <span className="text-[10px] text-slate-500">Validación y arqueo</span>
          </button>

          <button
            onClick={() => onNavigate('/admin/tickets')}
            className="flex flex-col items-center justify-center p-3.5 bg-slate-950/60 hover:bg-slate-800/80 border border-slate-800 rounded-xl text-center group transition"
          >
            <Ticket className="w-5 h-5 text-indigo-400 mb-1.5 group-hover:scale-110 transition" />
            <span className="text-xs font-bold text-white">Boletos</span>
            <span className="text-[10px] text-slate-500">QR criptográficos</span>
          </button>

          <button
            onClick={() => onNavigate('/admin/email-dispatches')}
            className="flex flex-col items-center justify-center p-3.5 bg-slate-950/60 hover:bg-slate-800/80 border border-slate-800 rounded-xl text-center group transition"
          >
            <Mail className="w-5 h-5 text-indigo-400 mb-1.5 group-hover:scale-110 transition" />
            <span className="text-xs font-bold text-white">Correos</span>
            <span className="text-[10px] text-slate-500">Control y reenvíos</span>
          </button>

          <button
            onClick={() => onNavigate('/admin/reports')}
            className="flex flex-col items-center justify-center p-3.5 bg-slate-950/60 hover:bg-slate-800/80 border border-slate-800 rounded-xl text-center group transition"
          >
            <FileText className="w-5 h-5 text-indigo-400 mb-1.5 group-hover:scale-110 transition" />
            <span className="text-xs font-bold text-white">Reportes</span>
            <span className="text-[10px] text-slate-500">Exportar a CSV</span>
          </button>

          <button
            onClick={() => onNavigate('/admin/audit')}
            className="flex flex-col items-center justify-center p-3.5 bg-slate-950/60 hover:bg-slate-800/80 border border-slate-800 rounded-xl text-center group transition"
          >
            <ShieldAlert className="w-5 h-5 text-indigo-400 mb-1.5 group-hover:scale-110 transition" />
            <span className="text-xs font-bold text-white">Auditoría</span>
            <span className="text-[10px] text-slate-500">Bitácora inmutable</span>
          </button>

          <button
            onClick={() => onNavigate('/gate')}
            className="flex flex-col items-center justify-center p-3.5 bg-slate-950/60 hover:bg-slate-800/80 border border-slate-800 rounded-xl text-center group transition"
          >
            <DoorOpen className="w-5 h-5 text-emerald-400 mb-1.5 group-hover:scale-110 transition" />
            <span className="text-xs font-bold text-white">Puerta / Scanner</span>
            <span className="text-[10px] text-slate-500">Control de acceso</span>
          </button>
        </div>
      </div>

      {/* 4. Resumen Operativo: 2 Columnas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Columna Izquierda: Pagos pendientes de validación */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-amber-400" />
                <span>Pagos Pendientes de Validación ({pendingPaymentsList.length})</span>
              </h3>
              <button
                onClick={() => onNavigate('/admin/payments')}
                className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
              >
                <span>Ver todos</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {pendingPaymentsList.length === 0 ? (
              <div className="py-8 text-center text-slate-500 text-xs">
                <CheckCircle2 className="w-8 h-8 text-emerald-500/40 mx-auto mb-2" />
                <span>No hay pagos pendientes de validación. ¡Al día!</span>
              </div>
            ) : (
              <div className="space-y-3">
                {pendingPaymentsList.map((p) => (
                  <div
                    key={p.id}
                    className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5 flex items-center justify-between"
                  >
                    <div>
                      <div className="font-mono text-xs font-bold text-indigo-400">{p.orderCode}</div>
                      <div className="text-[11px] text-slate-400">
                        {p.method} • Ref: {p.reference || 'Sin referencia'}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-bold text-white">${p.amount} USD</div>
                      <button
                        onClick={() => onNavigate('/admin/payments')}
                        className="mt-1 px-2.5 py-1 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 rounded text-[10px] font-bold border border-indigo-500/30 transition"
                      >
                        Validar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Alert de errores de correo si existen */}
          {failedEmailsList.length > 0 && (
            <div className="mt-6 pt-4 border-t border-slate-800">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-rose-400 flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>Errores de Envío de Boletos ({failedEmailsList.length})</span>
                </span>
                <button
                  onClick={() => onNavigate('/admin/email-dispatches')}
                  className="text-[11px] text-slate-400 hover:text-white underline"
                >
                  Ir al Gestor
                </button>
              </div>
              <div className="space-y-1.5">
                {failedEmailsList.map((f) => (
                  <div key={f.id} className="text-[11px] text-slate-400 flex justify-between bg-rose-950/20 px-2.5 py-1.5 rounded-lg border border-rose-900/30">
                    <span className="truncate max-w-[200px]">{f.customerEmail}</span>
                    <span className="text-rose-400 font-mono">Reintentos: {f.retryCount}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Columna Derecha: Control de Aforo y Accesos por Puerta */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <DoorOpen className="w-4 h-4 text-emerald-400" />
                <span>Estado de Accesos por Puerta / Operador</span>
              </h3>
              <button
                onClick={() => onNavigate('/gate')}
                className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
              >
                <span>Abrir Escáner</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {gateAccessSummary.length === 0 ? (
              <div className="py-8 text-center text-slate-500 text-xs">
                <span>No se han registrado lecturas en puerta para el filtro actual.</span>
              </div>
            ) : (
              <div className="space-y-3">
                {gateAccessSummary.map((gate, i) => (
                  <div
                    key={i}
                    className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5 flex items-center justify-between"
                  >
                    <div>
                      <span className="text-xs font-bold text-white block">{gate.name}</span>
                      <span className="text-[11px] text-slate-400">Punto de verificación</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-mono font-bold">
                        +{gate.authorized} Autorizados
                      </span>
                      {gate.rejected > 0 && (
                        <span className="px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 font-mono font-bold">
                          {gate.rejected} Rechazados
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-6 pt-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <span>Últimas lecturas auditadas:</span>
            <span className="font-mono font-bold text-white">{filteredAccessLogs.length} eventos</span>
          </div>
        </div>
      </div>

      {/* 5. Feed de Actividad Reciente del Sistema (Auditoría Inmutable) */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-indigo-400" />
            <h3 className="text-sm font-bold text-white">Actividad Reciente del Sistema</h3>
          </div>
          <button
            onClick={() => onNavigate('/admin/audit')}
            className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
          >
            <span>Ver bitácora completa</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {auditLogs.length === 0 ? (
          <div className="py-8 text-center text-slate-500 text-xs">
            No hay registros recientes en la bitácora.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                <tr>
                  <th className="py-2.5 px-3">Hora</th>
                  <th className="py-2.5 px-3">Usuario</th>
                  <th className="py-2.5 px-3">Acción</th>
                  <th className="py-2.5 px-3">Entidad</th>
                  <th className="py-2.5 px-3">ID / Referencia</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {auditLogs.slice(0, 8).map((log) => (
                  <tr key={log.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-2.5 px-3 text-slate-400 font-mono text-[11px]">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-white">
                      {log.userName || 'Sistema'}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="font-mono text-[11px] text-indigo-300 bg-indigo-950/40 px-2 py-0.5 rounded border border-indigo-800/30">
                        {log.action}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 capitalize text-slate-300">
                      {log.entityType}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-400 text-[11px] truncate max-w-[140px]">
                      {log.entityId}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
