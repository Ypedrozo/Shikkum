import React, { useEffect, useState } from 'react';
import {
  X,
  Printer,
  Calendar,
  MapPin,
  CheckCircle2,
  Clock,
  XCircle,
  AlertCircle
} from 'lucide-react';
import QRCode from 'qrcode';
import { Order, Ticket, Event } from '../../types';

interface TicketPackageModalProps {
  order: Order;
  tickets: Ticket[];
  event?: Event | null;
  isOpen: boolean;
  onClose: () => void;
}

export const TicketPackageModal: React.FC<TicketPackageModalProps> = ({
  order,
  tickets,
  event,
  isOpen,
  onClose
}) => {
  const [qrImages, setQrImages] = useState<Record<string, string>>({});
  const [activePrintTicketId, setActivePrintTicketId] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || tickets.length === 0) return;

    let isMounted = true;

    const generateQrs = async () => {
      const generated: Record<string, string> = {};
      for (const t of tickets) {
        try {
          const qrData = t.qrToken || t.ticketCode;
          const url = await QRCode.toDataURL(qrData, {
            width: 200,
            margin: 1,
            color: {
              dark: '#020617',
              light: '#ffffff'
            }
          });
          generated[t.id] = url;
        } catch (err) {
          console.error(`Error generando QR para ticket ${t.ticketCode}:`, err);
        }
      }
      if (isMounted) {
        setQrImages(generated);
      }
    };

    generateQrs();

    return () => {
      isMounted = false;
    };
  }, [isOpen, tickets]);

  if (!isOpen) return null;

  const handlePrintAll = () => {
    setActivePrintTicketId(null);
    setTimeout(() => {
      window.print();
    }, 150);
  };

  const handlePrintSingle = (ticketId: string) => {
    setActivePrintTicketId(ticketId);
    setTimeout(() => {
      window.print();
      setActivePrintTicketId(null);
    }, 150);
  };

  const formattedDate = event?.date || order.createdAt;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
      {/* Estilos para impresión universal */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #ticket-package-printable,
          #ticket-package-printable * {
            visibility: visible;
          }
          #ticket-package-printable {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            background: white !important;
            color: black !important;
            padding: 20px;
          }
          .no-print {
            display: none !important;
          }
          .ticket-card-print {
            page-break-inside: avoid;
            margin-bottom: 24px;
            border: 2px dashed #334155 !important;
            background: white !important;
            color: #0f172a !important;
          }
        }
      `}</style>

      <div className="relative w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden my-8 max-h-[90vh] flex flex-col">
        {/* Cabecera del Modal (no-print) */}
        <div className="no-print p-6 border-b border-slate-800 flex items-center justify-between bg-slate-950/80">
          <div>
            <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider">
              Paquete Oficial de Entradas
            </span>
            <h2 className="text-xl font-bold text-white tracking-tight">
              Orden {order.orderCode} — {order.eventTitle}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {tickets.length} {tickets.length === 1 ? 'entrada emitida' : 'entradas emitidas'} • 1 código QR por asistente
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handlePrintAll}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-lg shadow-emerald-600/30"
              title="Imprimir todas las entradas en un solo paquete"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir Paquete Completo</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Contenido Imprimible y Desplazable */}
        <div className="overflow-y-auto p-6 space-y-6 flex-1 bg-slate-950/50">
          <div id="ticket-package-printable" className="space-y-6">
            
            {/* Banner de Resumen del Evento */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Evento
                </div>
                <h3 className="text-lg font-bold text-white mt-0.5">
                  {order.eventTitle}
                </h3>
                <div className="flex flex-wrap items-center gap-4 mt-2 text-xs text-slate-300">
                  <span className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                    {new Date(formattedDate).toLocaleDateString('es-ES', {
                      weekday: 'short',
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric'
                    })}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                    {event?.venue || 'Sede Oficial'}
                  </span>
                </div>
              </div>

              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-right self-start md:self-auto">
                <span className="text-[10px] text-slate-500 block uppercase font-bold">Comprador</span>
                <span className="text-xs font-bold text-slate-200 block">{order.customerName}</span>
                <span className="text-[10px] text-emerald-400 font-mono">Orden: {order.orderCode}</span>
              </div>
            </div>

            {/* Cuadrícula de Entradas */}
            <div className="space-y-4">
              {tickets
                .filter((t) => !activePrintTicketId || t.id === activePrintTicketId)
                .map((ticket, index) => {
                  const qrSrc = qrImages[ticket.id];
                  return (
                    <div
                      key={ticket.id}
                      className="ticket-card-print bg-slate-900 border border-slate-800 rounded-2xl p-5 relative overflow-hidden transition hover:border-slate-700"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                        {/* Datos del Asistente y Entrada */}
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                              Entrada #{index + 1}
                            </span>
                            <span className="text-xs font-semibold text-slate-400">
                              {ticket.attendeeSnapshot?.ticketType || 'Acceso General'}
                            </span>
                          </div>

                          <div>
                            <div className="text-lg font-extrabold text-white">
                              {ticket.attendeeSnapshot?.fullName || 'Asistente'}
                            </div>
                            {ticket.attendeeSnapshot?.documentId && (
                              <div className="text-xs text-slate-400 mt-0.5">
                                Documento: <span className="font-mono text-slate-200">{ticket.attendeeSnapshot.documentId}</span>
                              </div>
                            )}
                          </div>

                          <div className="pt-2 flex flex-wrap items-center gap-4 text-xs">
                            <div className="bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
                              <span className="text-slate-500 text-[10px] block font-mono">Código de Boleto</span>
                              <span className="font-mono font-bold text-white">{ticket.ticketCode}</span>
                            </div>

                            <div className="flex items-center gap-1.5">
                              {ticket.status === 'ISSUED' && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-bold rounded-lg">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  Listo para Ingreso
                                </span>
                              )}
                              {ticket.status === 'USED' && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-500/10 text-blue-400 border border-blue-500/20 text-xs font-bold rounded-lg">
                                  <Clock className="w-3.5 h-3.5" />
                                  Utilizado en Puerta
                                </span>
                              )}
                              {ticket.status === 'CANCELLED' && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-rose-500/10 text-rose-400 border border-rose-500/20 text-xs font-bold rounded-lg">
                                  <XCircle className="w-3.5 h-3.5" />
                                  Cancelado
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* QR escaneable e individual */}
                        <div className="flex sm:flex-col items-center justify-center gap-2 p-3 bg-white rounded-xl shadow-md border border-slate-200 self-center sm:self-auto">
                          {qrSrc ? (
                            <img
                              src={qrSrc}
                              alt={`QR ${ticket.ticketCode}`}
                              className="w-28 h-28 object-contain"
                            />
                          ) : (
                            <div className="w-28 h-28 flex items-center justify-center bg-slate-100 text-slate-400 text-xs font-mono">
                              Generando QR...
                            </div>
                          )}
                          <span className="text-[10px] font-mono font-bold text-slate-900 uppercase tracking-tight">
                            {ticket.ticketCode}
                          </span>
                        </div>
                      </div>

                      {/* Botón individual de impresión (no-print) */}
                      <div className="no-print mt-4 pt-3 border-t border-slate-800 flex justify-end">
                        <button
                          onClick={() => handlePrintSingle(ticket.id)}
                          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold transition flex items-center gap-1.5"
                        >
                          <Printer className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Imprimir esta Entrada</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
            </div>

            {/* Advertencia de Ingreso */}
            <div className="p-4 bg-slate-900/60 border border-amber-500/30 rounded-xl text-xs text-amber-200 flex items-start gap-3">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-amber-300">Aviso importante de seguridad:</strong> Cada código QR es estrictamente de un solo uso y queda invalidado automáticamente al ser escaneado en el acceso del evento. El asistente debe presentar su código en pantalla o impreso.
              </div>
            </div>

            {/* Pie de página oficial de SHIKKUM */}
            <div className="pt-4 border-t border-slate-800 text-center text-[11px] text-slate-500">
              SHIKKUM © 2026 — Programa desarrollado por Yeiber Pedrozo — Todos los derechos reservados.
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};
