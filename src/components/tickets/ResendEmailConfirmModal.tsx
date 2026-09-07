import React, { useState } from 'react';
import {
  X,
  Mail,
  Send,
  AlertTriangle,
  RefreshCw
} from 'lucide-react';
import { Order } from '../../types';

interface ResendEmailConfirmModalProps {
  order: Order;
  defaultEmail: string;
  ticketCount: number;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (recipientEmail: string) => Promise<void>;
}

export const ResendEmailConfirmModal: React.FC<ResendEmailConfirmModalProps> = ({
  order,
  defaultEmail,
  ticketCount,
  isOpen,
  onClose,
  onConfirm
}) => {
  const [recipient, setRecipient] = useState<string>(defaultEmail);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = recipient.trim();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError('Por favor ingrese una dirección de correo electrónico válida.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      await onConfirm(trimmed);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error al reenviar entradas por correo.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Cabecera */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Mail className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Reenviar Entradas</h3>
              <p className="text-[11px] text-slate-400">Orden {order.orderCode}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          
          <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 text-xs space-y-1.5">
            <div className="flex justify-between text-slate-400">
              <span>Titular:</span>
              <span className="font-semibold text-white">{order.customerName}</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Evento:</span>
              <span className="font-semibold text-white truncate max-w-[200px]">{order.eventTitle}</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Cantidad de entradas:</span>
              <span className="font-bold text-emerald-400">{ticketCount} {ticketCount === 1 ? 'entrada' : 'entradas'}</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Dirección de Correo Destinataria
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                placeholder="cliente@ejemplo.com"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 pl-9 pr-3 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500"
              />
            </div>
            <p className="text-[10px] text-slate-500 mt-1">
              Se enviará el paquete con los códigos QR de acceso correspondientes a esta orden.
            </p>
          </div>

          <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-start gap-2.5 text-[11px] text-amber-300">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <strong>Seguridad e Idempotencia:</strong> El reenvío utiliza exactamente los mismos boletos ya generados. Los códigos QR y de barras no se modifican ni se duplican.
            </div>
          </div>

          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-300">
              {error}
            </div>
          )}

          <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-lg shadow-emerald-600/30 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Enviando...</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Confirmar Reenvío</span>
                </>
              )}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
