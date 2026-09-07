import React, { useState, useEffect, useMemo } from 'react';
import {
  ShoppingBag,
  Search,
  Plus,
  RefreshCw,
  AlertTriangle,
  CreditCard,
  CheckCircle2
} from 'lucide-react';
import { Order, OrderStatus, Event } from '../../types';
import { orderService } from '../../services/order.service';
import { eventService } from '../../services/event.service';

interface AdminOrdersPageProps {
  onNavigate: (path: string) => void;
}

export const AdminOrdersPage: React.FC<AdminOrdersPageProps> = ({ onNavigate }) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Filtros
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | OrderStatus>('ALL');
  const [selectedEventId, setSelectedEventId] = useState<string>('ALL');

  // Modal Cancelación
  const [cancellingOrder, setCancellingOrder] = useState<Order | null>(null);
  const [cancelReason, setCancelReason] = useState<string>('');
  const [isCancelling, setIsCancelling] = useState<boolean>(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setIsLoading(true);
      setErrorMessage(null);
      const [ordersList, eventsList] = await Promise.all([
        orderService.getOrders(),
        eventService.getEvents()
      ]);
      setOrders(ordersList);
      setEvents(eventsList);
    } catch (err: any) {
      setErrorMessage(err.message || 'Error al cargar datos de órdenes.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCancelConfirm = async () => {
    if (!cancellingOrder) return;
    try {
      setIsCancelling(true);
      setCancelError(null);
      await orderService.cancelOrder(cancellingOrder.id, cancelReason);
      setCancellingOrder(null);
      await loadData();
    } catch (err: any) {
      setCancelError(err.message || 'Error al cancelar la orden.');
    } finally {
      setIsCancelling(false);
    }
  };

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const matchesStatus = statusFilter === 'ALL' || order.status === statusFilter;
      if (!matchesStatus) return false;

      const matchesEvent = selectedEventId === 'ALL' || order.eventId === selectedEventId;
      if (!matchesEvent) return false;

      if (!searchTerm.trim()) return true;
      const term = searchTerm.toLowerCase();
      return (
        order.orderCode.toLowerCase().includes(term) ||
        order.customerName.toLowerCase().includes(term) ||
        order.eventTitle.toLowerCase().includes(term)
      );
    });
  }, [orders, searchTerm, statusFilter, selectedEventId]);

  // Métricas
  const stats = useMemo(() => {
    const totalOrders = orders.length;
    let totalRevenue = 0;
    let paidRevenue = 0;
    let pendingCount = 0;
    let paidCount = 0;
    let cancelledCount = 0;

    orders.forEach((o) => {
      if (o.status !== 'CANCELLED') {
        totalRevenue += o.total;
      }
      if (o.status === 'PAID') {
        paidRevenue += o.total;
        paidCount++;
      }
      if (o.status === 'PENDING_PAYMENT') pendingCount++;
      if (o.status === 'CANCELLED') cancelledCount++;
    });

    return { totalOrders, totalRevenue, paidRevenue, pendingCount, paidCount, cancelledCount };
  }, [orders]);

  return (
    <div className="space-y-6">
      {/* Encabezado Principal */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 text-xs font-bold bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 rounded-full">
              Administración
            </span>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Control de Órdenes de Venta
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Auditoría integral de órdenes, consulta de snapshots de precios y cancelación administrativa.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadData}
            disabled={isLoading}
            className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl border border-slate-700 transition"
            title="Refrescar lista"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => onNavigate('/admin/orders/new')}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg shadow-indigo-600/30 transition"
          >
            <Plus className="w-4 h-4" />
            <span>Nueva Orden</span>
          </button>
        </div>
      </div>

      {/* Tarjetas de Métricas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-md">
          <span className="text-xs text-slate-400 block">Total Órdenes</span>
          <span className="text-2xl font-black text-white font-mono mt-1 block">
            {stats.totalOrders}
          </span>
          <span className="text-[11px] text-slate-500 mt-0.5 block">{stats.paidCount} pagadas</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-md">
          <span className="text-xs text-slate-400 block">Total Cobrado (PAID)</span>
          <span className="text-2xl font-black text-emerald-400 font-mono mt-1 block">
            ${stats.paidRevenue.toFixed(2)}
          </span>
          <span className="text-[11px] text-slate-500 mt-0.5 block">
            Comprometido: ${stats.totalRevenue.toFixed(2)}
          </span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-md">
          <span className="text-xs text-slate-400 block">Pendientes de Pago</span>
          <span className="text-2xl font-black text-amber-400 font-mono mt-1 block">
            {stats.pendingCount}
          </span>
          <span className="text-[11px] text-slate-500 mt-0.5 block">Por liquidar</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-md">
          <span className="text-xs text-slate-400 block">Órdenes Canceladas</span>
          <span className="text-2xl font-black text-red-400 font-mono mt-1 block">
            {stats.cancelledCount}
          </span>
          <span className="text-[11px] text-slate-500 mt-0.5 block">Sin recaudación</span>
        </div>
      </div>

      {/* Barra de Filtros */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-md flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por código, cliente o evento..."
            className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Filtro Evento */}
          <select
            value={selectedEventId}
            onChange={(e) => setSelectedEventId(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
          >
            <option value="ALL">Todos los Eventos</option>
            {events.map((ev) => (
              <option key={ev.id} value={ev.id}>
                {ev.title}
              </option>
            ))}
          </select>

          {/* Filtro Estado */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
          >
            <option value="ALL">Todos los Estados</option>
            <option value="PENDING_PAYMENT">Pendientes de Pago</option>
            <option value="PAID">Pagadas</option>
            <option value="CANCELLED">Canceladas</option>
          </select>
        </div>
      </div>

      {errorMessage && (
        <div className="p-4 bg-red-950/50 border border-red-800/80 rounded-xl text-red-200 text-xs">
          {errorMessage}
        </div>
      )}

      {/* Tabla de Órdenes */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
        {isLoading ? (
          <div className="py-16 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
            <RefreshCw className="w-7 h-7 animate-spin text-indigo-400" />
            <span className="text-xs">Cargando órdenes registradas...</span>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="py-16 text-center text-slate-500 p-6">
            <ShoppingBag className="w-10 h-10 mx-auto mb-3 opacity-30 text-slate-400" />
            <p className="text-sm font-semibold text-slate-300">No se encontraron órdenes registradas</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                <tr>
                  <th className="py-3.5 px-4">Código</th>
                  <th className="py-3.5 px-4">Cliente</th>
                  <th className="py-3.5 px-4">Evento</th>
                  <th className="py-3.5 px-4">Asistentes</th>
                  <th className="py-3.5 px-4 text-right">Total</th>
                  <th className="py-3.5 px-4 text-center">Estado</th>
                  <th className="py-3.5 px-4">Fecha</th>
                  <th className="py-3.5 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 bg-slate-900/30">
                {filteredOrders.map((ord) => {
                  const isPending = ord.status === 'PENDING_PAYMENT';
                  const isPaid = ord.status === 'PAID';
                  const isCancelled = ord.status === 'CANCELLED';

                  return (
                    <tr key={ord.id} className="hover:bg-slate-800/40 transition">
                      <td className="py-3.5 px-4 font-mono font-bold text-indigo-400">
                        {ord.orderCode}
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-slate-200">
                        {ord.customerName}
                      </td>
                      <td className="py-3.5 px-4 text-slate-300">
                        {ord.eventTitle}
                      </td>
                      <td className="py-3.5 px-4 text-slate-400 font-mono">
                        {ord.attendeeCount} persona{ord.attendeeCount > 1 ? 's' : ''}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-white">
                        ${ord.total.toFixed(2)} USD
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {isPending && (
                          <span className="px-2.5 py-0.5 text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-full">
                            Pendiente de pago
                          </span>
                        )}
                        {isPaid && (
                          <span className="px-2.5 py-0.5 text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full inline-flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Pagada</span>
                          </span>
                        )}
                        {isCancelled && (
                          <span className="px-2.5 py-0.5 text-[10px] font-bold bg-red-500/20 text-red-400 border border-red-500/30 rounded-full">
                            Cancelada
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-slate-400 text-[11px]">
                        {new Date(ord.createdAt).toLocaleDateString()}{' '}
                        {new Date(ord.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {isPending && (
                            <button
                              onClick={() => onNavigate(`/admin/orders/${ord.id}/payment`)}
                              className="px-2 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition flex items-center gap-1"
                              title="Registrar pago"
                            >
                              <CreditCard className="w-3 h-3" />
                              <span>Pagar</span>
                            </button>
                          )}

                          <button
                            onClick={() => onNavigate(`/admin/orders/${ord.id}`)}
                            className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-lg text-xs font-semibold transition"
                          >
                            Detalle
                          </button>

                          {isPending && (
                            <button
                              onClick={() => {
                                setCancellingOrder(ord);
                                setCancelReason('');
                                setCancelError(null);
                              }}
                              className="px-2 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-xs font-semibold transition"
                              title="Cancelar orden"
                            >
                              Cancelar
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de Cancelación */}
      {cancellingOrder && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-red-400">
              <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center border border-red-500/30">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Cancelar Orden</h3>
                <p className="text-xs text-slate-400">Código: {cancellingOrder.orderCode}</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              ¿Está seguro de que desea cancelar la orden <strong>{cancellingOrder.orderCode}</strong>?
              Esta acción actualizará el estado a <strong className="text-red-400">Cancelada</strong> y
              conservará íntegramente todos los datos de auditoría histórica.
            </p>

            {cancelError && (
              <div className="p-3 bg-red-950/50 border border-red-800/80 rounded-xl text-red-200 text-xs">
                {cancelError}
              </div>
            )}

            <div className="space-y-1.5 text-xs">
              <label className="block text-slate-400 font-semibold">
                Motivo de cancelación (opcional)
              </label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Indique la justificación de la cancelación..."
                rows={3}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-red-500"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setCancellingOrder(null)}
                disabled={isCancelling}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-semibold transition"
              >
                Volver
              </button>

              <button
                onClick={handleCancelConfirm}
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
