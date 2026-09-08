import React, { useEffect, useState } from 'react';
import {
  History,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  FileCheck,
  Upload,
  Send,
  RotateCcw,
  XCircle,
  Clock,
  User,
  RefreshCw
} from 'lucide-react';
import { AuditLog, AuditAction } from '../../types';
import { auditService } from '../../services/audit.service';

interface OrderAuditTimelineProps {
  orderId: string;
}

export const OrderAuditTimeline: React.FC<OrderAuditTimelineProps> = ({ orderId }) => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadLogs = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await auditService.getLogsForOrder(orderId);
      setLogs(data);
    } catch (err: any) {
      console.error('[OrderAuditTimeline] Error cargando auditoría:', err);
      setError(err.message || 'Error al cargar la bitácora de auditoría.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, [orderId]);

  const getActionBadge = (action: AuditAction) => {
    switch (action) {
      case 'ORDER_CREATED':
        return {
          label: 'Orden Creada',
          bg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
          icon: <FileCheck className="w-3.5 h-3.5" />
        };
      case 'RECEIPT_UPLOADED':
        return {
          label: 'Comprobante Subido',
          bg: 'bg-sky-500/10 text-sky-400 border-sky-500/30',
          icon: <Upload className="w-3.5 h-3.5" />
        };
      case 'PAYMENT_REGISTERED':
        return {
          label: 'Pago Registrado',
          bg: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
          icon: <Clock className="w-3.5 h-3.5" />
        };
      case 'PAYMENT_APPROVED':
        return {
          label: 'Pago Aprobado (PAID)',
          bg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
          icon: <CheckCircle2 className="w-3.5 h-3.5" />
        };
      case 'PAYMENT_REJECTED':
        return {
          label: 'Pago Rechazado',
          bg: 'bg-red-500/10 text-red-400 border-red-500/30',
          icon: <AlertCircle className="w-3.5 h-3.5" />
        };
      case 'TICKET_GENERATED':
        return {
          label: 'Boletos Emitidos',
          bg: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
          icon: <ShieldCheck className="w-3.5 h-3.5" />
        };
      case 'TICKET_SENT':
        return {
          label: 'Boletos Enviados por Correo',
          bg: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
          icon: <Send className="w-3.5 h-3.5" />
        };
      case 'TICKET_RESENT':
        return {
          label: 'Boletos Reenviados',
          bg: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30',
          icon: <RotateCcw className="w-3.5 h-3.5" />
        };
      case 'ORDER_CANCELLED':
        return {
          label: 'Orden Cancelada',
          bg: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
          icon: <XCircle className="w-3.5 h-3.5" />
        };
      default:
        return {
          label: action,
          bg: 'bg-slate-800 text-slate-300 border-slate-700',
          icon: <History className="w-3.5 h-3.5" />
        };
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <History className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Trazabilidad y Auditoría (Fase 8)</h3>
            <p className="text-xs text-slate-400">
              Bitácora inmutable de eventos, cambios de estado y gestión operativa
            </p>
          </div>
        </div>

        <button
          onClick={loadLogs}
          disabled={isLoading}
          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-semibold transition flex items-center gap-1.5"
          title="Actualizar bitácora"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Actualizar</span>
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-950/40 border border-red-800/60 rounded-xl text-xs text-red-200 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {isLoading ? (
        <div className="py-8 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
          <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" />
          <span>Cargando bitácora de auditoría...</span>
        </div>
      ) : logs.length === 0 ? (
        <div className="py-8 text-center text-slate-500 text-xs border border-dashed border-slate-800 rounded-xl">
          No hay registros de auditoría previos para esta orden. Los nuevos eventos quedarán registrados automáticamente.
        </div>
      ) : (
        <div className="space-y-3 pt-2">
          {logs.map((log) => {
            const badge = getActionBadge(log.action);
            return (
              <div
                key={log.id}
                className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-slate-700 transition"
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-bold ${badge.bg}`}
                    >
                      {badge.icon}
                      <span>{badge.label}</span>
                    </span>
                  </div>

                  <div className="space-y-1 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-white flex items-center gap-1">
                        <User className="w-3 h-3 text-slate-400" />
                        {log.userName || 'Sistema'}
                      </span>
                      <span className="px-1.5 py-0.2 bg-slate-800 text-slate-400 rounded text-[10px] font-mono uppercase">
                        {log.role}
                      </span>
                      {log.userEmail && (
                        <span className="text-[11px] text-slate-500 hidden md:inline">
                          ({log.userEmail})
                        </span>
                      )}
                    </div>

                    {log.metadata && Object.keys(log.metadata).length > 0 && (
                      <div className="text-[11px] text-slate-400 font-mono flex flex-wrap gap-x-3 gap-y-1">
                        {log.metadata.amount && (
                          <span>Monto: ${log.metadata.amount} USD</span>
                        )}
                        {log.metadata.method && (
                          <span>Método: {log.metadata.method}</span>
                        )}
                        {log.metadata.reference && (
                          <span>Ref: {log.metadata.reference}</span>
                        )}
                        {log.metadata.reason && (
                          <span>Motivo: {log.metadata.reason}</span>
                        )}
                        {log.metadata.recipient && (
                          <span>Destinatario: {log.metadata.recipient}</span>
                        )}
                        {log.metadata.ticketCount && (
                          <span>Boletos: {log.metadata.ticketCount}</span>
                        )}
                        {log.metadata.receiptFileName && (
                          <span>Archivo: {log.metadata.receiptFileName}</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="text-[11px] text-slate-500 font-mono whitespace-nowrap self-end sm:self-center">
                  {new Date(log.timestamp).toLocaleString()}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
