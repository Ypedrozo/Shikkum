import React, { useState, useEffect, useMemo } from 'react';
import {
  ShoppingBag,
  Search,
  Plus,
  ArrowRight,
  RefreshCw,
  Filter,
  AlertCircle,
  CreditCard,
  CheckCircle2
} from 'lucide-react';
import { Order, OrderStatus } from '../../types';
import { orderService } from '../../services/order.service';

interface OrdersListPageProps {
  onNavigate: (path: string) => void;
  baseRolePath?: '/cashier' | '/admin';
}

export const OrdersListPage: React.FC<OrdersListPageProps> = ({
  onNavigate,
  baseRolePath = '/cashier'
}) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Filtros
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | OrderStatus>('ALL');

  const loadOrders = async () => {
    try {
      setIsLoading(true);
      setErrorMessage(null);
      const list = await orderService.getOrders();
      setOrders(list);
    } catch (err: any) {
      setErrorMessage(err.message || 'Error al cargar la lista de órdenes.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, []);

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const matchesStatus = statusFilter === 'ALL' || order.status === statusFilter;
      if (!matchesStatus) return false;

      if (!searchTerm.trim()) return true;
      const term = searchTerm.toLowerCase();
      return (
        order.orderCode.toLowerCase().includes(term) ||
        order.customerName.toLowerCase().includes(term) ||
        order.eventTitle.toLowerCase().includes(term)
      );
    });
  }, [orders, searchTerm, statusFilter]);

  return (
    <div className="space-y-6">
      {/* Encabezado Principal */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full">
              Cobranzas
            </span>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Órdenes de Venta
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Gestión y consulta de órdenes registradas con snapshots inmutables de precios.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadOrders}
            disabled={isLoading}
            className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl border border-slate-700 transition"
            title="Refrescar lista"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => onNavigate(`${baseRolePath}/orders/new`)}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg shadow-emerald-600/30 transition"
          >
            <Plus className="w-4 h-4" />
            <span>Nueva Orden</span>
          </button>
        </div>
      </div>

      {/* Barra de Búsqueda y Filtros */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por código de orden, cliente o evento..."
            className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-xs text-slate-400 font-semibold">Estado:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
          >
            <option value="ALL">Todos los Estados</option>
            <option value="PENDING_PAYMENT">Pendientes de Pago</option>
            <option value="PAID">Pagadas</option>
            <option value="CANCELLED">Canceladas</option>
          </select>
        </div>
      </div>

      {errorMessage && (
        <div className="p-4 bg-red-950/50 border border-red-800/80 rounded-xl text-red-200 text-xs flex items-center gap-2 shadow">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Tabla de Órdenes */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
        {isLoading ? (
          <div className="py-16 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
            <RefreshCw className="w-7 h-7 animate-spin text-emerald-400" />
            <span className="text-xs">Cargando órdenes registradas...</span>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="py-16 text-center text-slate-500 p-6">
            <ShoppingBag className="w-10 h-10 mx-auto mb-3 opacity-30 text-slate-400" />
            <p className="text-sm font-semibold text-slate-300">No se encontraron órdenes registradas</p>
            <p className="text-xs text-slate-500 mt-1">
              Haga clic en "+ Nueva Orden" para registrar la primera compra para un cliente.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                <tr>
                  <th className="py-3.5 px-4">Código</th>
                  <th className="py-3.5 px-4">Cliente Titular</th>
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
                      <td className="py-3.5 px-4 font-mono font-bold text-emerald-400">
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
                              onClick={() => onNavigate(`${baseRolePath}/orders/${ord.id}/payment`)}
                              className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-sm"
                              title="Registrar pago"
                            >
                              <CreditCard className="w-3 h-3" />
                              <span>Registrar pago</span>
                            </button>
                          )}
                          {isPaid && (
                            <span className="px-2.5 py-1 text-[11px] font-semibold text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 rounded-lg inline-flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Pago confirmado</span>
                            </span>
                          )}
                          <button
                            onClick={() => onNavigate(`${baseRolePath}/orders/${ord.id}`)}
                            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-lg text-xs font-semibold transition flex items-center gap-1.5"
                          >
                            <span>Ver detalle</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
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
    </div>
  );
};
