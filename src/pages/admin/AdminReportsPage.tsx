import React, { useState, useEffect, useMemo } from 'react';
import {
  FileText,
  Download,
  RefreshCw,
  ShoppingBag,
  CreditCard,
  Ticket,
  DoorOpen,
  Mail,
  AlertCircle,
  X
} from 'lucide-react';
import { Event, Order, Payment, Ticket as TicketType, AccessLog, EmailDispatch } from '../../types';
import { eventService } from '../../services/event.service';
import { orderService } from '../../services/order.service';
import { paymentService } from '../../services/payment.service';
import { ticketService } from '../../services/ticket.service';
import { emailDispatchService } from '../../services/emailDispatch.service';

interface AdminReportsPageProps {
  onNavigate: (path: string) => void;
}

type ReportTab = 'sales' | 'payments' | 'tickets' | 'access' | 'emails';

export const AdminReportsPage: React.FC<AdminReportsPageProps> = ({ onNavigate }) => {
  const [activeTab, setActiveTab] = useState<ReportTab>('sales');
  const [events, setEvents] = useState<Event[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [tickets, setTickets] = useState<TicketType[]>([]);
  const [accessLogs, setAccessLogs] = useState<AccessLog[]>([]);
  const [emailDispatches, setEmailDispatches] = useState<EmailDispatch[]>([]);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Filtros globales para reportes
  const [selectedEventId, setSelectedEventId] = useState<string>('ALL');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  const loadAllData = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const [
        eventsData,
        ordersData,
        paymentsData,
        ticketsData,
        accessData,
        dispatchesData
      ] = await Promise.all([
        eventService.getEvents(),
        orderService.getOrders(),
        paymentService.getPayments(),
        ticketService.getAllTickets(),
        ticketService.getAccessLogs({ limit: 200 }),
        emailDispatchService.getAllDispatches(200)
      ]);

      setEvents(eventsData);
      setOrders(ordersData);
      setPayments(paymentsData);
      setTickets(ticketsData);
      setAccessLogs(accessData);
      setEmailDispatches(dispatchesData);
    } catch (err: any) {
      setErrorMessage(err.message || 'Error al cargar datos para reportes.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  // Función genérica para filtrar por fecha y evento
  const matchesGlobalFilters = (itemDateStr?: string, itemEventId?: string) => {
    if (selectedEventId !== 'ALL' && itemEventId && itemEventId !== selectedEventId) {
      return false;
    }
    if (startDate && itemDateStr) {
      if (new Date(itemDateStr) < new Date(startDate)) return false;
    }
    if (endDate && itemDateStr) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      if (new Date(itemDateStr) > end) return false;
    }
    return true;
  };

  // 1. Reporte de Ventas filtrado
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => matchesGlobalFilters(o.createdAt, o.eventId));
  }, [orders, selectedEventId, startDate, endDate]);

  const salesReportMetrics = useMemo(() => {
    let totalRevenue = 0;
    let paidOrders = 0;
    let pendingOrders = 0;
    let cancelledOrders = 0;
    let totalTicketsSold = 0;

    filteredOrders.forEach((o) => {
      if (o.status === 'PAID') {
        paidOrders++;
        totalRevenue += o.total || 0;
        totalTicketsSold += o.attendeeCount || 0;
      } else if (o.status === 'PENDING_PAYMENT') {
        pendingOrders++;
      } else if (o.status === 'CANCELLED') {
        cancelledOrders++;
      }
    });

    return {
      totalOrders: filteredOrders.length,
      paidOrders,
      pendingOrders,
      cancelledOrders,
      totalRevenue,
      totalTicketsSold
    };
  }, [filteredOrders]);

  // 2. Reporte de Pagos filtrado
  const filteredPayments = useMemo(() => {
    return payments.filter((p) => matchesGlobalFilters(p.registeredAt, undefined));
  }, [payments, selectedEventId, startDate, endDate]);

  const paymentsReportMetrics = useMemo(() => {
    let cash = 0;
    let transfer = 0;
    let card = 0;
    let other = 0;
    let confirmedCount = 0;
    let pendingCount = 0;
    let rejectedCount = 0;

    filteredPayments.forEach((p) => {
      if (p.status === 'CONFIRMED') {
        confirmedCount++;
        if (p.method === 'CASH') cash += p.amount;
        else if (p.method === 'BANK_TRANSFER') transfer += p.amount;
        else if (p.method === 'CARD') card += p.amount;
        else other += p.amount;
      } else if (p.status === 'PENDING') {
        pendingCount++;
      } else if (p.status === 'REJECTED') {
        rejectedCount++;
      }
    });

    return {
      totalPayments: filteredPayments.length,
      confirmedCount,
      pendingCount,
      rejectedCount,
      cash,
      transfer,
      card,
      other,
      totalCollected: cash + transfer + card + other
    };
  }, [filteredPayments]);

  // 3. Reporte de Entradas filtrado
  const filteredTickets = useMemo(() => {
    return tickets.filter((t) => matchesGlobalFilters(t.createdAt, t.eventId));
  }, [tickets, selectedEventId, startDate, endDate]);

  const ticketsReportMetrics = useMemo(() => {
    let issued = 0;
    let used = 0;
    let cancelled = 0;

    filteredTickets.forEach((t) => {
      if (t.status === 'USED') used++;
      else if (t.status === 'CANCELLED') cancelled++;
      else issued++;
    });

    return {
      totalTickets: filteredTickets.length,
      issued, // pendientes de uso
      used,
      cancelled,
      usageRate: filteredTickets.length > 0 ? ((used / filteredTickets.length) * 100).toFixed(1) : '0'
    };
  }, [filteredTickets]);

  // 4. Reporte de Accesos filtrado
  const filteredAccessLogs = useMemo(() => {
    return accessLogs.filter((a) => matchesGlobalFilters(a.timestamp, a.eventId));
  }, [accessLogs, selectedEventId, startDate, endDate]);

  const accessReportMetrics = useMemo(() => {
    let authorized = 0;
    let rejected = 0;
    const operatorCounts: Record<string, number> = {};

    filteredAccessLogs.forEach((a) => {
      if (a.authorized) authorized++;
      else rejected++;

      const opName = a.gateOperatorName || 'Operador Puerta';
      operatorCounts[opName] = (operatorCounts[opName] || 0) + 1;
    });

    return {
      totalAttempts: filteredAccessLogs.length,
      authorized,
      rejected,
      operatorCounts
    };
  }, [filteredAccessLogs]);

  // 5. Reporte de Correos filtrado
  const filteredEmails = useMemo(() => {
    return emailDispatches.filter((e) => matchesGlobalFilters(e.createdAt, e.eventId));
  }, [emailDispatches, selectedEventId, startDate, endDate]);

  const emailReportMetrics = useMemo(() => {
    let sent = 0;
    let failed = 0;
    let pending = 0;
    let totalRetries = 0;

    filteredEmails.forEach((e) => {
      if (e.status === 'SENT') sent++;
      else if (e.status === 'FAILED') failed++;
      else pending++;
      totalRetries += e.retryCount || 0;
    });

    return {
      totalDispatches: filteredEmails.length,
      sent,
      failed,
      pending,
      totalRetries
    };
  }, [filteredEmails]);

  // Exportación a CSV compatible con Excel
  const exportToCSV = (type: ReportTab) => {
    let csvContent = '';
    let filename = `reporte_${type}_${new Date().toISOString().split('T')[0]}.csv`;

    if (type === 'sales') {
      csvContent = 'ID Orden,Código Orden,Cliente,ID Cliente,Evento,Estado,Total USD,Entradas,Fecha Creación\n';
      filteredOrders.forEach((o) => {
        csvContent += `"${o.id}","${o.orderCode || ''}","${o.customerName || ''}","${o.customerId || ''}","${o.eventTitle || ''}","${o.status}","${(o.total || 0).toFixed(2)}","${o.attendeeCount || 0}","${o.createdAt}"\n`;
      });
    } else if (type === 'payments') {
      csvContent = 'ID Pago,Código Orden,Monto USD,Método,Estado,Referencia,Registrado Por,Fecha Registro,Comprobante\n';
      filteredPayments.forEach((p) => {
        csvContent += `"${p.id}","${p.orderCode}","${(p.amount || 0).toFixed(2)}","${p.method}","${p.status}","${p.reference || ''}","${p.registeredByName || ''}","${p.registeredAt}","${p.proofUrl || p.receiptFileName || 'No'}"\n`;
      });
    } else if (type === 'tickets') {
      csvContent = 'ID Boleto,Código Boleto,Asistente,Email,Tipo Entrada,Evento,Estado,Precio USD,Fecha Emisión,Fecha Uso\n';
      filteredTickets.forEach((t) => {
        csvContent += `"${t.id}","${t.ticketCode}","${t.attendeeSnapshot?.fullName || ''}","${t.attendeeSnapshot?.email || ''}","${t.attendeeSnapshot?.ticketType || 'General'}","${t.eventSnapshot?.title || ''}","${t.status}","${t.attendeeSnapshot?.unitPrice || 0}","${t.issuedAt || t.createdAt}","${t.access?.usedAt || ''}"\n`;
      });
    } else if (type === 'access') {
      csvContent = 'ID Registro,Boleto,Asistente,Evento,Resultado,Método,Operador,Puerta,Fecha y Hora,Motivo Rechazo\n';
      filteredAccessLogs.forEach((a) => {
        csvContent += `"${a.id}","${a.ticketCode || ''}","${a.attendeeName || ''}","${a.eventTitle || ''}","${a.authorized ? 'AUTORIZADO' : 'RECHAZADO'}","${a.validationMethod}","${a.gateOperatorName || ''}","${a.gateId || ''}","${a.timestamp}","${a.rejectionReason || ''}"\n`;
      });
    } else if (type === 'emails') {
      csvContent = 'ID Despacho,Orden,Cliente,Email Destinatario,Evento,Estado,Cantidad Entradas,Reintentos,Fecha,Error\n';
      filteredEmails.forEach((e) => {
        csvContent += `"${e.id}","${e.orderCode || e.orderId}","${e.customerName || ''}","${e.customerEmail}","${e.eventTitle || ''}","${e.status}","${e.ticketIds?.length || 0}","${e.retryCount}","${e.createdAt}","${e.errorMessage || ''}"\n`;
      });
    }

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="p-2 bg-indigo-600/10 text-indigo-400 border border-indigo-500/20 rounded-xl">
                <FileText className="w-5 h-5" />
              </span>
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-400">
                Centro de Reportería Ejecutiva
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Reportes y Analítica Operativa
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Consolidación multidimensional de ventas, recaudación, aforos, accesos auditados y métricas de notificación.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              onClick={() => exportToCSV(activeTab)}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-600/20 transition"
            >
              <Download className="w-4 h-4" />
              <span>Exportar Reporte (CSV)</span>
            </button>
            <button
              onClick={loadAllData}
              disabled={isLoading}
              className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-bold border border-slate-700 transition"
              title="Recargar datos"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Notificación de Error si ocurre */}
        {errorMessage && (
          <div className="mt-4 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-400 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button onClick={() => setErrorMessage(null)} className="text-rose-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Barra de Filtros Globales */}
        <div className="mt-6 pt-6 border-t border-slate-800/80 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Filtrar por Evento:</label>
            <select
              value={selectedEventId}
              onChange={(e) => setSelectedEventId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500 transition"
            >
              <option value="ALL">Todos los eventos ({events.length})</option>
              {events.map((evt) => (
                <option key={evt.id} value={evt.id}>
                  {evt.title}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Fecha Inicial:</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500 transition"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Fecha Final:</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500 transition"
            />
          </div>
        </div>

        {/* Pestañas de Reportes */}
        <div className="mt-6 flex flex-wrap gap-2 border-t border-slate-800/80 pt-4">
          <button
            onClick={() => setActiveTab('sales')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
              activeTab === 'sales'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <ShoppingBag className="w-4 h-4" />
            <span>A. Ventas</span>
          </button>

          <button
            onClick={() => setActiveTab('payments')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
              activeTab === 'payments'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            <span>B. Pagos</span>
          </button>

          <button
            onClick={() => setActiveTab('tickets')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
              activeTab === 'tickets'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <Ticket className="w-4 h-4" />
            <span>C. Entradas</span>
          </button>

          <button
            onClick={() => setActiveTab('access')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
              activeTab === 'access'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <DoorOpen className="w-4 h-4" />
            <span>D. Accesos</span>
          </button>

          <button
            onClick={() => setActiveTab('emails')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
              activeTab === 'emails'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <Mail className="w-4 h-4" />
            <span>E. Correos</span>
          </button>
        </div>
      </div>

      {/* Contenido de la Pestaña Activa */}
      {activeTab === 'sales' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
              <span className="text-xs text-slate-400 block mb-1">Órdenes Totales</span>
              <span className="text-2xl font-bold text-white">{salesReportMetrics.totalOrders}</span>
              <span className="text-[11px] text-slate-500 block mt-1">Registradas en el periodo</span>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
              <span className="text-xs text-emerald-400 block mb-1">Órdenes Pagadas</span>
              <span className="text-2xl font-bold text-emerald-400">{salesReportMetrics.paidOrders}</span>
              <span className="text-[11px] text-slate-500 block mt-1">Con emisión de tickets</span>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
              <span className="text-xs text-indigo-400 block mb-1">Recaudación Total</span>
              <span className="text-2xl font-bold text-white">${salesReportMetrics.totalRevenue.toLocaleString()} USD</span>
              <span className="text-[11px] text-slate-500 block mt-1">Pagos efectivos</span>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
              <span className="text-xs text-amber-400 block mb-1">Entradas Vendidas</span>
              <span className="text-2xl font-bold text-amber-400">{salesReportMetrics.totalTicketsSold}</span>
              <span className="text-[11px] text-slate-500 block mt-1">Asistentes confirmados</span>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
            <h3 className="text-base font-bold text-white mb-4">Detalle de Órdenes ({filteredOrders.length})</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Código</th>
                    <th className="py-3 px-4">Cliente</th>
                    <th className="py-3 px-4">Evento</th>
                    <th className="py-3 px-4">Total</th>
                    <th className="py-3 px-4">Entradas</th>
                    <th className="py-3 px-4">Estado</th>
                    <th className="py-3 px-4">Fecha</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredOrders.slice(0, 50).map((o) => (
                    <tr key={o.id} className="hover:bg-slate-800/40">
                      <td className="py-3 px-4">
                        <button
                          onClick={() => onNavigate(`/admin/orders/${o.id}`)}
                          className="font-mono font-bold text-indigo-400 hover:text-indigo-300 hover:underline"
                        >
                          {o.orderCode || o.id}
                        </button>
                      </td>
                      <td className="py-3 px-4 text-white font-medium">{o.customerName || 'Cliente'}</td>
                      <td className="py-3 px-4 text-slate-300 max-w-[200px] truncate">{o.eventTitle}</td>
                      <td className="py-3 px-4 font-bold text-white">${o.total} USD</td>
                      <td className="py-3 px-4 text-slate-300">{o.attendeeCount || 0}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                          o.status === 'PAID' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'
                        }`}>
                          {o.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-400">{new Date(o.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'payments' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
              <span className="text-xs text-emerald-400 block mb-1">Efectivo (CASH)</span>
              <span className="text-2xl font-bold text-white">${paymentsReportMetrics.cash.toLocaleString()} USD</span>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
              <span className="text-xs text-indigo-400 block mb-1">Transferencias</span>
              <span className="text-2xl font-bold text-white">${paymentsReportMetrics.transfer.toLocaleString()} USD</span>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
              <span className="text-xs text-cyan-400 block mb-1">Tarjetas (CARD)</span>
              <span className="text-2xl font-bold text-white">${paymentsReportMetrics.card.toLocaleString()} USD</span>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
              <span className="text-xs text-amber-400 block mb-1">Total Recaudado</span>
              <span className="text-2xl font-bold text-emerald-400">${paymentsReportMetrics.totalCollected.toLocaleString()} USD</span>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
            <h3 className="text-base font-bold text-white mb-4">Detalle de Pagos Registrados ({filteredPayments.length})</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Orden</th>
                    <th className="py-3 px-4">Monto</th>
                    <th className="py-3 px-4">Método</th>
                    <th className="py-3 px-4">Estado</th>
                    <th className="py-3 px-4">Referencia</th>
                    <th className="py-3 px-4">Operador</th>
                    <th className="py-3 px-4">Fecha</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredPayments.slice(0, 50).map((p) => (
                    <tr key={p.id} className="hover:bg-slate-800/40">
                      <td className="py-3 px-4 font-mono font-bold text-indigo-400">{p.orderCode}</td>
                      <td className="py-3 px-4 font-bold text-white">${p.amount} USD</td>
                      <td className="py-3 px-4 text-slate-300">{p.method}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                          p.status === 'CONFIRMED' ? 'bg-emerald-500/10 text-emerald-400' : p.status === 'REJECTED' ? 'bg-rose-500/10 text-rose-400' : 'bg-amber-500/10 text-amber-400'
                        }`}>
                          {p.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-400">{p.reference || '-'}</td>
                      <td className="py-3 px-4 text-slate-300">{p.registeredByName || '-'}</td>
                      <td className="py-3 px-4 text-slate-400">{new Date(p.registeredAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'tickets' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
              <span className="text-xs text-slate-400 block mb-1">Total Emitidos</span>
              <span className="text-2xl font-bold text-white">{ticketsReportMetrics.totalTickets}</span>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
              <span className="text-xs text-emerald-400 block mb-1">Utilizados (Accedieron)</span>
              <span className="text-2xl font-bold text-emerald-400">{ticketsReportMetrics.used}</span>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
              <span className="text-xs text-amber-400 block mb-1">Pendientes de Uso</span>
              <span className="text-2xl font-bold text-amber-400">{ticketsReportMetrics.issued}</span>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
              <span className="text-xs text-indigo-400 block mb-1">% de Utilización</span>
              <span className="text-2xl font-bold text-indigo-400">{ticketsReportMetrics.usageRate}%</span>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
            <h3 className="text-base font-bold text-white mb-4">Registro de Entradas ({filteredTickets.length})</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Código</th>
                    <th className="py-3 px-4">Asistente</th>
                    <th className="py-3 px-4">Tipo</th>
                    <th className="py-3 px-4">Evento</th>
                    <th className="py-3 px-4">Estado</th>
                    <th className="py-3 px-4">Emisión</th>
                    <th className="py-3 px-4">Uso / Puerta</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredTickets.slice(0, 50).map((t) => (
                    <tr key={t.id} className="hover:bg-slate-800/40">
                      <td className="py-3 px-4 font-mono font-bold text-indigo-400">{t.ticketCode}</td>
                      <td className="py-3 px-4 text-white font-medium">{t.attendeeSnapshot?.fullName}</td>
                      <td className="py-3 px-4 text-slate-300">{t.attendeeSnapshot?.ticketType || 'General'}</td>
                      <td className="py-3 px-4 text-slate-300 max-w-[200px] truncate">{t.eventSnapshot?.title}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                          t.status === 'USED' ? 'bg-emerald-500/10 text-emerald-400' : t.status === 'CANCELLED' ? 'bg-rose-500/10 text-rose-400' : 'bg-indigo-500/10 text-indigo-400'
                        }`}>
                          {t.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-400">{new Date(t.issuedAt || t.createdAt).toLocaleDateString()}</td>
                      <td className="py-3 px-4 text-slate-400">
                        {t.access?.usedAt ? (
                          <span className="text-emerald-400 font-mono text-[11px]">
                            {new Date(t.access.usedAt).toLocaleTimeString()} ({t.access.gateId || 'Puerta'})
                          </span>
                        ) : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'access' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
              <span className="text-xs text-slate-400 block mb-1">Intentos de Acceso</span>
              <span className="text-2xl font-bold text-white">{accessReportMetrics.totalAttempts}</span>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
              <span className="text-xs text-emerald-400 block mb-1">Autorizados</span>
              <span className="text-2xl font-bold text-emerald-400">{accessReportMetrics.authorized}</span>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
              <span className="text-xs text-rose-400 block mb-1">Rechazados</span>
              <span className="text-2xl font-bold text-rose-400">{accessReportMetrics.rejected}</span>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
            <h3 className="text-base font-bold text-white mb-4">Auditoría de Control de Accesos ({filteredAccessLogs.length})</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Hora</th>
                    <th className="py-3 px-4">Boleto</th>
                    <th className="py-3 px-4">Asistente</th>
                    <th className="py-3 px-4">Evento</th>
                    <th className="py-3 px-4">Resultado</th>
                    <th className="py-3 px-4">Operador</th>
                    <th className="py-3 px-4">Motivo / Detalle</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredAccessLogs.slice(0, 50).map((a) => (
                    <tr key={a.id} className="hover:bg-slate-800/40">
                      <td className="py-3 px-4 text-slate-400 font-mono">{new Date(a.timestamp).toLocaleTimeString()}</td>
                      <td className="py-3 px-4 font-mono font-bold text-indigo-400">{a.ticketCode || '-'}</td>
                      <td className="py-3 px-4 text-white font-medium">{a.attendeeName || 'Invitado'}</td>
                      <td className="py-3 px-4 text-slate-300 max-w-[180px] truncate">{a.eventTitle}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                          a.authorized ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                        }`}>
                          {a.authorized ? 'AUTORIZADO' : 'RECHAZADO'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-300">{a.gateOperatorName || '-'}</td>
                      <td className="py-3 px-4 text-rose-400">{a.rejectionReason || a.message || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'emails' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
              <span className="text-xs text-slate-400 block mb-1">Despachos Totales</span>
              <span className="text-2xl font-bold text-white">{emailReportMetrics.totalDispatches}</span>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
              <span className="text-xs text-emerald-400 block mb-1">Entregados (SENT)</span>
              <span className="text-2xl font-bold text-emerald-400">{emailReportMetrics.sent}</span>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
              <span className="text-xs text-rose-400 block mb-1">Fallidos (FAILED)</span>
              <span className="text-2xl font-bold text-rose-400">{emailReportMetrics.failed}</span>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
              <span className="text-xs text-amber-400 block mb-1">Reintentos Acumulados</span>
              <span className="text-2xl font-bold text-amber-400">{emailReportMetrics.totalRetries}</span>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
            <h3 className="text-base font-bold text-white mb-4">Registro de Notificaciones por Correo ({filteredEmails.length})</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Orden</th>
                    <th className="py-3 px-4">Destinatario</th>
                    <th className="py-3 px-4">Evento</th>
                    <th className="py-3 px-4">Entradas</th>
                    <th className="py-3 px-4">Estado</th>
                    <th className="py-3 px-4">Reintentos</th>
                    <th className="py-3 px-4">Fecha</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredEmails.slice(0, 50).map((e) => (
                    <tr key={e.id} className="hover:bg-slate-800/40">
                      <td className="py-3 px-4 font-mono font-bold text-indigo-400">{e.orderCode || e.orderId}</td>
                      <td className="py-3 px-4 text-white">{e.customerEmail}</td>
                      <td className="py-3 px-4 text-slate-300 max-w-[200px] truncate">{e.eventTitle}</td>
                      <td className="py-3 px-4 text-slate-300">{e.ticketIds?.length || 0}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                          e.status === 'SENT' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                        }`}>
                          {e.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-300">{e.retryCount}</td>
                      <td className="py-3 px-4 text-slate-400">{new Date(e.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
