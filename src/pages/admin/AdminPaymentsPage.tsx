import React, { useState, useEffect, useMemo } from 'react';
import {
  CreditCard,
  Search,
  Filter,
  RefreshCw,
  AlertCircle,
  Eye,
  CheckCircle2,
  Clock,
  XCircle,
  ExternalLink,
  ArrowRight,
  FileText,
  X
} from 'lucide-react';
import { Payment, PaymentStatus, PaymentMethod } from '../../types';
import { paymentService } from '../../services/payment.service';

interface AdminPaymentsPageProps {
  onNavigate: (path: string) => void;
}

export const AdminPaymentsPage: React.FC<AdminPaymentsPageProps> = ({ onNavigate }) => {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Filtros
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | PaymentStatus>('ALL');
  const [methodFilter, setMethodFilter] = useState<'ALL' | PaymentMethod>('ALL');

  // Visor de comprobante
  const [selectedProofUrl, setSelectedProofUrl] = useState<string | null>(null);
  const [selectedOrderCode, setSelectedOrderCode] = useState<string>('');

  const loadPayments = async () => {
    try {
      setIsLoading(true);
      setErrorMessage(null);
      const data = await paymentService.getPayments();
      setPayments(data);
    } catch (err: any) {
      setErrorMessage(err.message || 'Error al cargar los pagos.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPayments();
  }, []);

  const filteredPayments = useMemo(() => {
    return payments.filter((p) => {
      if (statusFilter !== 'ALL' && p.status !== statusFilter) return false;
      if (methodFilter !== 'ALL' && p.method !== methodFilter) return false;

      if (!searchTerm.trim()) return true;
      const term = searchTerm.toLowerCase().trim();
      return (
        p.orderCode.toLowerCase().includes(term) ||
        (p.reference && p.reference.toLowerCase().includes(term)) ||
        (p.registeredByName && p.registeredByName.toLowerCase().includes(term)) ||
        (p.confirmedByName && p.confirmedByName.toLowerCase().includes(term))
      );
    });
  }, [payments, searchTerm, statusFilter, methodFilter]);

  // Estadísticas
  const stats = useMemo(() => {
    let totalCollected = 0;
    let totalPending = 0;
    let confirmedCount = 0;
    let pendingCount = 0;
    let rejectedCount = 0;

    payments.forEach((p) => {
      if (p.status === 'CONFIRMED') {
        totalCollected += p.amount;
        confirmedCount++;
      } else if (p.status === 'PENDING') {
        totalPending += p.amount;
        pendingCount++;
      } else if (p.status === 'REJECTED') {
        rejectedCount++;
      }
    });

    return {
      totalCollected,
      totalPending,
      confirmedCount,
      pendingCount,
      rejectedCount,
      totalPayments: payments.length
    };
  }, [payments]);

  const formatMethodLabel = (m: PaymentMethod) => {
    switch (m) {
      case 'CASH':
        return 'Efectivo';
      case 'BANK_TRANSFER':
        return 'Transferencia bancaria';
      case 'CARD':
        return 'Tarjeta';
      case 'OTHER':
        return 'Otro';
      default:
        return m;
    }
  };

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 text-xs font-bold bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 rounded-full">
              Auditoría Financiera
            </span>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Control y Registro de Pagos
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Supervisión integral de recaudaciones, comprobantes bancarios y estados de validación.
          </p>
        </div>

        <button
          onClick={loadPayments}
          disabled={isLoading}
          className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl border border-slate-700 transition self-start sm:self-auto"
          title="Refrescar lista"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Tarjetas de Estadísticas Rápidas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-md">
          <div className="text-slate-400 text-xs font-semibold">Total Cobrado (Confirmado)</div>
          <div className="text-xl sm:text-2xl font-black font-mono text-emerald-400 mt-1">
            ${stats.totalCollected.toFixed(2)} USD
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">{stats.confirmedCount} pagos confirmados</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-md">
          <div className="text-slate-400 text-xs font-semibold">Monto en Revisión</div>
          <div className="text-xl sm:text-2xl font-black font-mono text-amber-400 mt-1">
            ${stats.totalPending.toFixed(2)} USD
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">{stats.pendingCount} pagos pendientes</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-md">
          <div className="text-slate-400 text-xs font-semibold">Pagos Rechazados</div>
          <div className="text-xl sm:text-2xl font-black font-mono text-red-400 mt-1">
            {stats.rejectedCount}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">Requieren corrección</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-md">
          <div className="text-slate-400 text-xs font-semibold">Total de Transacciones</div>
          <div className="text-xl sm:text-2xl font-black font-mono text-white mt-1">
            {stats.totalPayments}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">Operaciones registradas</div>
        </div>
      </div>

      {/* Barra de Filtros y Búsqueda */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por código de orden, referencia o usuario..."
            className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-xs text-slate-400 font-semibold">Estado:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
            >
              <option value="ALL">Todos los estados</option>
              <option value="CONFIRMED">Confirmados</option>
              <option value="PENDING">Pendientes</option>
              <option value="REJECTED">Rechazados</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-400 font-semibold">Método:</span>
            <select
              value={methodFilter}
              onChange={(e) => setMethodFilter(e.target.value as any)}
              className="bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
            >
              <option value="ALL">Todos los métodos</option>
              <option value="CASH">Efectivo</option>
              <option value="BANK_TRANSFER">Transferencia</option>
              <option value="CARD">Tarjeta</option>
              <option value="OTHER">Otro</option>
            </select>
          </div>
        </div>
      </div>

      {errorMessage && (
        <div className="p-4 bg-red-950/50 border border-red-800/80 rounded-xl text-red-200 text-xs flex items-center gap-2 shadow">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Tabla de Pagos */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
        {isLoading ? (
          <div className="py-16 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
            <RefreshCw className="w-7 h-7 animate-spin text-indigo-400" />
            <span className="text-xs">Cargando registros de pagos...</span>
          </div>
        ) : filteredPayments.length === 0 ? (
          <div className="py-16 text-center text-slate-500 p-6">
            <CreditCard className="w-10 h-10 mx-auto mb-3 opacity-30 text-slate-400" />
            <p className="text-sm font-semibold text-slate-300">No se encontraron pagos registrados</p>
            <p className="text-xs text-slate-500 mt-1">
              Los pagos registrados por el personal de Cobranzas aparecerán en este panel.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                <tr>
                  <th className="py-3.5 px-4">Orden</th>
                  <th className="py-3.5 px-4">Método</th>
                  <th className="py-3.5 px-4">Referencia</th>
                  <th className="py-3.5 px-4 text-right">Monto</th>
                  <th className="py-3.5 px-4 text-center">Estado</th>
                  <th className="py-3.5 px-4">Registrado por</th>
                  <th className="py-3.5 px-4">Confirmado por</th>
                  <th className="py-3.5 px-4">Fecha</th>
                  <th className="py-3.5 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 bg-slate-900/30">
                {filteredPayments.map((p) => {
                  const isConfirmed = p.status === 'CONFIRMED';
                  const isPending = p.status === 'PENDING';
                  const isRejected = p.status === 'REJECTED';

                  return (
                    <tr key={p.id} className="hover:bg-slate-800/40 transition">
                      <td className="py-3.5 px-4 font-mono font-bold text-emerald-400">
                        {p.orderCode}
                      </td>
                      <td className="py-3.5 px-4 text-slate-200 font-medium">
                        {formatMethodLabel(p.method)}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-300">
                        {p.reference || <span className="text-slate-600">—</span>}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-white">
                        ${p.amount.toFixed(2)} {p.currency}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {isConfirmed && (
                          <span className="px-2.5 py-0.5 text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full inline-flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Confirmado</span>
                          </span>
                        )}
                        {isPending && (
                          <span className="px-2.5 py-0.5 text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-full inline-flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            <span>Pendiente</span>
                          </span>
                        )}
                        {isRejected && (
                          <span className="px-2.5 py-0.5 text-[10px] font-bold bg-red-500/20 text-red-400 border border-red-500/30 rounded-full inline-flex items-center gap-1">
                            <XCircle className="w-3 h-3" />
                            <span>Rechazado</span>
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-slate-300">
                        <div>{p.registeredByName || p.registeredBy}</div>
                        <div className="text-[10px] text-slate-500">
                          {new Date(p.registeredAt).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-300">
                        {p.confirmedByName || p.confirmedBy ? (
                          <div>
                            <div>{p.confirmedByName || p.confirmedBy}</div>
                            <div className="text-[10px] text-slate-500">
                              {p.confirmedAt ? new Date(p.confirmedAt).toLocaleDateString() : ''}
                            </div>
                          </div>
                        ) : isRejected ? (
                          <span className="text-red-400/80 text-[11px]">Rechazado</span>
                        ) : (
                          <span className="text-slate-600 italic">—</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-slate-400 text-[11px]">
                        {new Date(p.registeredAt).toLocaleString([], {
                          dateStyle: 'short',
                          timeStyle: 'short'
                        })}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {p.proofUrl && (
                            <button
                              onClick={() => {
                                setSelectedProofUrl(p.proofUrl || null);
                                setSelectedOrderCode(p.orderCode);
                              }}
                              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-emerald-400 hover:text-white rounded-lg transition"
                              title="Ver Comprobante"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            onClick={() => onNavigate(`/admin/orders/${p.orderId}`)}
                            className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-lg text-xs font-semibold transition flex items-center gap-1"
                          >
                            <span>Ver orden</span>
                            <ArrowRight className="w-3 h-3" />
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

      {/* Modal de Comprobante de Pago */}
      {selectedProofUrl && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-white font-bold text-sm">
                <Eye className="w-4 h-4 text-indigo-400" />
                <span>Comprobante de Pago — Orden {selectedOrderCode}</span>
              </div>
              <button
                onClick={() => setSelectedProofUrl(null)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="max-h-[70vh] overflow-auto flex items-center justify-center bg-slate-950 rounded-xl p-2 border border-slate-800">
              {selectedProofUrl.includes('data:application/pdf') || selectedProofUrl.endsWith('.pdf') ? (
                <div className="py-12 text-center space-y-3">
                  <FileText className="w-12 h-12 text-indigo-400 mx-auto" />
                  <p className="text-xs text-slate-300 font-semibold">Documento PDF del Comprobante</p>
                  <a
                    href={selectedProofUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition"
                  >
                    <span>Abrir PDF en pestaña nueva</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              ) : (
                <img
                  src={selectedProofUrl}
                  alt="Comprobante"
                  className="max-h-[65vh] w-auto object-contain rounded-lg"
                />
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedProofUrl(null)}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold transition"
              >
                Cerrar Visor
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
