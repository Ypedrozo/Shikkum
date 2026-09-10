import React, { useState, useEffect, useMemo } from 'react';
import {
  ShieldAlert,
  Search,
  RefreshCw,
  ShieldCheck,
  X,
  Lock,
  AlertCircle
} from 'lucide-react';
import { AuditLog, AuditAction, SystemRole } from '../../types';
import { auditService } from '../../services/audit.service';

interface AdminAuditPageProps {
  onNavigate: (path: string) => void;
}

export const AdminAuditPage: React.FC<AdminAuditPageProps> = ({ onNavigate }) => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Filtros
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | SystemRole>('ALL');
  const [entityFilter, setEntityFilter] = useState<'ALL' | string>('ALL');
  const [actionFilter, setActionFilter] = useState<'ALL' | string>('ALL');

  // Visor de metadatos expandido
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const loadLogs = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const data = await auditService.getRecentLogs(100);
      setLogs(data);
    } catch (err: any) {
      setErrorMessage(err.message || 'Error al cargar bitácora de auditoría.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (roleFilter !== 'ALL' && log.role !== roleFilter) return false;
      if (entityFilter !== 'ALL' && log.entityType !== entityFilter) return false;
      if (actionFilter !== 'ALL' && log.action !== actionFilter) return false;

      if (!searchTerm.trim()) return true;
      const term = searchTerm.toLowerCase().trim();
      const matchAction = log.action.toLowerCase().includes(term);
      const matchUser = log.userName ? log.userName.toLowerCase().includes(term) : false;
      const matchEmail = log.userEmail ? log.userEmail.toLowerCase().includes(term) : false;
      const matchEntityId = log.entityId.toLowerCase().includes(term);
      const matchOrderId = log.metadata?.orderCode ? String(log.metadata.orderCode).toLowerCase().includes(term) : false;

      return matchAction || matchUser || matchEmail || matchEntityId || matchOrderId;
    });
  }, [logs, searchTerm, roleFilter, entityFilter, actionFilter]);

  const getRoleBadge = (role: SystemRole) => {
    switch (role) {
      case 'admin':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-mono">
            ADMIN
          </span>
        );
      case 'cashier':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
            CASHIER
          </span>
        );
      case 'gate_operator':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-mono">
            GATE_OPERATOR
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-slate-500/10 text-slate-400 border border-slate-500/20 font-mono">
            SISTEMA
          </span>
        );
    }
  };

  const getActionBadge = (action: AuditAction) => {
    if (action.includes('APPROVED') || action.includes('GENERATED') || action.includes('SENT') || action.includes('CREATED')) {
      return (
        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 font-mono">
          {action}
        </span>
      );
    }
    if (action.includes('REJECTED') || action.includes('CANCELLED') || action.includes('FAILED')) {
      return (
        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-rose-500/10 text-rose-300 border border-rose-500/20 font-mono">
          {action}
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-500/10 text-amber-300 border border-amber-500/20 font-mono">
        {action}
      </span>
    );
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="p-2 bg-indigo-600/10 text-indigo-400 border border-indigo-500/20 rounded-xl">
                <ShieldAlert className="w-5 h-5" />
              </span>
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-400">
                Seguridad & Trazabilidad Forense
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Bitácora de Auditoría Administrativa
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Registro inmutable de todas las acciones operativas, cambios de estado en pagos, emisiones de tickets y accesos.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-950 border border-slate-800 text-slate-400 text-xs font-medium rounded-xl">
              <Lock className="w-3.5 h-3.5 text-amber-400" />
              <span>Inmutable (Solo Lectura)</span>
            </div>
            <button
              onClick={loadLogs}
              disabled={isLoading}
              className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-bold border border-slate-700 transition"
              title="Recargar bitácora"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

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

        {/* Filtros */}
        <div className="mt-6 pt-6 border-t border-slate-800/80 grid grid-cols-1 sm:grid-cols-4 gap-3">
          {/* Búsqueda */}
          <div className="relative sm:col-span-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por acción, usuario o ID..."
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

          {/* Rol */}
          <div>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as any)}
              className="w-full px-3 py-2 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500 transition"
            >
              <option value="ALL">Todos los roles</option>
              <option value="admin">Administradores</option>
              <option value="cashier">Cobranzas (Cashier)</option>
              <option value="gate_operator">Operadores de Puerta</option>
            </select>
          </div>

          {/* Entidad */}
          <div>
            <select
              value={entityFilter}
              onChange={(e) => setEntityFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500 transition"
            >
              <option value="ALL">Todas las entidades</option>
              <option value="order">Órdenes</option>
              <option value="payment">Pagos</option>
              <option value="ticket">Tickets</option>
              <option value="customer">Clientes</option>
              <option value="event">Eventos</option>
            </select>
          </div>

          {/* Acción */}
          <div>
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500 transition"
            >
              <option value="ALL">Todas las acciones</option>
              <option value="PAYMENT_APPROVED">Pagos Aprobados</option>
              <option value="PAYMENT_REJECTED">Pagos Rechazados</option>
              <option value="PAYMENT_REGISTERED">Pagos Registrados</option>
              <option value="TICKET_GENERATED">Tickets Generados</option>
              <option value="TICKET_SENT">Tickets Enviados</option>
              <option value="TICKET_RESENT">Tickets Reenviados</option>
              <option value="ORDER_CREATED">Órdenes Creadas</option>
              <option value="ORDER_CANCELLED">Órdenes Canceladas</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tabla de Auditoría */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 sm:p-6 border-b border-slate-800 flex items-center justify-between">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-indigo-400" />
            <span>Eventos Auditados ({filteredLogs.length})</span>
          </h2>
          <span className="text-xs text-slate-400 font-mono">
            Total en bitácora: {logs.length}
          </span>
        </div>

        {isLoading ? (
          <div className="py-16 text-center text-slate-400 text-xs">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-500" />
            <span>Cargando bitácora de eventos...</span>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="py-16 text-center text-slate-500 text-xs">
            No se encontraron eventos con los filtros seleccionados.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Fecha y Hora</th>
                  <th className="py-3 px-4">Usuario / Operador</th>
                  <th className="py-3 px-4">Rol</th>
                  <th className="py-3 px-4">Acción</th>
                  <th className="py-3 px-4">Módulo / Entidad</th>
                  <th className="py-3 px-4">ID Entidad</th>
                  <th className="py-3 px-4 text-right">Detalle</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-3 px-4 text-slate-400 font-mono">
                      <div>{new Date(log.timestamp).toLocaleDateString()}</div>
                      <div className="text-[11px] text-slate-500">{new Date(log.timestamp).toLocaleTimeString()}</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-white">{log.userName || 'Sistema'}</div>
                      <div className="text-slate-400 text-[11px] truncate max-w-[160px]">{log.userEmail}</div>
                    </td>
                    <td className="py-3 px-4">
                      {getRoleBadge(log.role)}
                    </td>
                    <td className="py-3 px-4">
                      {getActionBadge(log.action)}
                    </td>
                    <td className="py-3 px-4">
                      <span className="capitalize px-2 py-0.5 bg-slate-800 text-slate-300 rounded text-[11px]">
                        {log.entityType}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-300 max-w-[140px] truncate">
                      {log.entityId}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => setSelectedLog(log)}
                        className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-semibold border border-slate-700 transition"
                      >
                        Ver Carga
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Visor de Metadatos de Auditoría */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-indigo-400" />
                <h3 className="text-base font-bold text-white">Detalle de Evento Forense</h3>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2 bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
                <div>
                  <span className="text-slate-400 block text-[11px]">ID Auditoría:</span>
                  <span className="font-mono text-white text-[11px]">{selectedLog.id}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Timestamp:</span>
                  <span className="text-white text-[11px]">{selectedLog.timestamp}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Operador:</span>
                  <span className="text-white text-[11px] font-semibold">{selectedLog.userName} ({selectedLog.role})</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Entidad Afectada:</span>
                  <span className="text-white text-[11px]">{selectedLog.entityType}: {selectedLog.entityId}</span>
                </div>
              </div>

              <div>
                <span className="text-slate-400 block mb-1 font-semibold">Carga de Metadatos (Payload Inmutable):</span>
                <pre className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-[11px] text-emerald-400 font-mono overflow-x-auto max-h-60">
                  {JSON.stringify(selectedLog.metadata, null, 2)}
                </pre>
              </div>
            </div>

            <div className="flex justify-between items-center pt-3 border-t border-slate-800">
              {selectedLog.entityType === 'order' ? (
                <button
                  onClick={() => {
                    const orderId = selectedLog.entityId;
                    setSelectedLog(null);
                    onNavigate(`/admin/orders/${orderId}`);
                  }}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition"
                >
                  Ver Orden
                </button>
              ) : (
                <div />
              )}
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
