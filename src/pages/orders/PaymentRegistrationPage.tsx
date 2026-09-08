import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  CreditCard,
  Building2,
  Wallet,
  FileText,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ShieldCheck,
  FileCheck,
  X,
  AlertTriangle
} from 'lucide-react';
import { Order, PaymentMethod } from '../../types';
import { orderService } from '../../services/order.service';
import { paymentService } from '../../services/payment.service';

interface PaymentRegistrationPageProps {
  orderId: string;
  onNavigate: (path: string) => void;
  baseRolePath?: '/cashier' | '/admin';
}

export const PaymentRegistrationPage: React.FC<PaymentRegistrationPageProps> = ({
  orderId,
  onNavigate,
  baseRolePath = '/cashier'
}) => {
  const [order, setOrder] = useState<Order | null>(null);
  const [isLoadingOrder, setIsLoadingOrder] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Formulario de pago
  const [method, setMethod] = useState<PaymentMethod>('CASH');
  const [reference, setReference] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [autoConfirm, setAutoConfirm] = useState<boolean>(true);

  // Archivo comprobante (para BANK_TRANSFER)
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPreviewUrl, setProofPreviewUrl] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Estado de envío
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successPayment, setSuccessPayment] = useState<any | null>(null);

  useEffect(() => {
    const fetchOrder = async () => {
      try {
        setIsLoadingOrder(true);
        setLoadError(null);
        const data = await orderService.getOrderById(orderId);
        if (!data) {
          setLoadError('No se encontró la orden especificada.');
          return;
        }
        setOrder(data);
      } catch (err: any) {
        setLoadError(err.message || 'Error al cargar la orden.');
      } finally {
        setIsLoadingOrder(false);
      }
    };

    fetchOrder();
  }, [orderId]);

  const handleFileSelect = (file: File) => {
    setFileError(null);

    // Tipos MIME permitidos
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      setFileError('Formato de archivo no válido. Solo se admiten imágenes JPEG, PNG, WEBP o documentos PDF.');
      return;
    }

    // Validación estricta de extensiones
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.pdf'];
    const lowerName = file.name.toLowerCase();
    const hasValidExt = allowedExtensions.some((ext) => lowerName.endsWith(ext));
    if (!hasValidExt) {
      setFileError('Extensión de archivo no permitida. Solo se admiten extensiones .jpg, .jpeg, .png, .webp o .pdf.');
      return;
    }

    // Tamaño máximo 10MB (Fase 8)
    if (file.size > 10 * 1024 * 1024) {
      setFileError('El comprobante supera el tamaño máximo permitido de 10 MB.');
      return;
    }

    setProofFile(file);

    if (file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      setProofPreviewUrl(url);
    } else {
      setProofPreviewUrl(null);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!order) return;

    try {
      setIsSubmitting(true);
      setSubmitError(null);

      if (order.status === 'PAID') {
        throw new Error('La orden ya fue pagada.');
      }
      if (order.status === 'CANCELLED') {
        throw new Error('La orden fue cancelada y no admite pagos.');
      }
      if (order.status !== 'PENDING_PAYMENT') {
        throw new Error(`La orden no admite pagos en su estado actual (${order.status}).`);
      }

      if (method === 'BANK_TRANSFER' && !proofFile) {
        throw new Error('El comprobante es obligatorio para transferencias bancarias.');
      }

      if ((method === 'BANK_TRANSFER' || method === 'CARD') && !reference.trim()) {
        throw new Error('Debe especificar un número de referencia bancaria o de comprobante.');
      }

      let proofStoragePath: string | undefined;
      let proofUrl: string | undefined;
      let receiptFileName: string | undefined;
      let receiptContentType: string | undefined;
      let receiptSize: number | undefined;

      // Subir archivo de comprobante si aplica
      if (proofFile) {
        const uploadRes = await paymentService.uploadPaymentProof(order.id, proofFile);
        proofStoragePath = uploadRes.storagePath;
        proofUrl = uploadRes.downloadUrl;
        receiptFileName = uploadRes.fileName;
        receiptContentType = uploadRes.contentType;
        receiptSize = uploadRes.size;
      }

      // Registrar pago
      const registered = await paymentService.registerPayment({
        orderId: order.id,
        amount: order.total,
        method,
        reference: reference.trim() || undefined,
        notes: notes.trim() || undefined,
        proofStoragePath,
        proofUrl,
        receiptStoragePath: proofStoragePath,
        receiptFileName,
        receiptContentType,
        receiptSize,
        autoConfirm
      });

      setSuccessPayment(registered);
    } catch (err: any) {
      setSubmitError(err.message || 'Error al procesar el pago.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoadingOrder) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center shadow-xl">
        <RefreshCw className="w-8 h-8 animate-spin text-emerald-400 mx-auto mb-3" />
        <p className="text-sm text-slate-300 font-semibold">Cargando datos de la orden...</p>
      </div>
    );
  }

  if (loadError || !order) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center shadow-xl space-y-4">
        <AlertCircle className="w-10 h-10 text-red-400 mx-auto" />
        <h2 className="text-lg font-bold text-white">Orden no disponible</h2>
        <p className="text-xs text-slate-400">{loadError || 'No se encontró la orden especificada.'}</p>
        <button
          onClick={() => onNavigate(`${baseRolePath}/orders`)}
          className="px-5 py-2 text-xs font-bold bg-slate-800 hover:bg-slate-700 text-white rounded-xl transition"
        >
          Volver a la lista de órdenes
        </button>
      </div>
    );
  }

  // Si la orden ya está pagada
  if (order.status === 'PAID') {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center shadow-xl space-y-4 max-w-xl mx-auto">
        <div className="w-12 h-12 bg-emerald-500/20 text-emerald-400 rounded-2xl flex items-center justify-center mx-auto border border-emerald-500/30">
          <CheckCircle2 className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-black text-white">La orden ya fue pagada</h2>
        <p className="text-xs text-slate-400">
          Esta orden (<span className="font-mono text-emerald-400">{order.orderCode}</span>) ya cuenta con un pago
          confirmado y su estado financiero es <strong className="text-emerald-400">PAID</strong>.
        </p>
        <div className="pt-2 flex justify-center gap-3">
          <button
            onClick={() => onNavigate(`${baseRolePath}/orders/${order.id}`)}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition shadow-lg shadow-emerald-600/30"
          >
            Ver Detalle de la Orden
          </button>
          <button
            onClick={() => onNavigate(`${baseRolePath}/orders`)}
            className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl transition"
          >
            Volver a Órdenes
          </button>
        </div>
      </div>
    );
  }

  // Si la orden fue cancelada
  if (order.status === 'CANCELLED') {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center shadow-xl space-y-4 max-w-xl mx-auto">
        <div className="w-12 h-12 bg-red-500/20 text-red-400 rounded-2xl flex items-center justify-center mx-auto border border-red-500/30">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-black text-white">La orden fue cancelada</h2>
        <p className="text-xs text-slate-400">
          Esta orden (<span className="font-mono text-red-400">{order.orderCode}</span>) fue cancelada
          administrativamente y no admite registro de pagos.
        </p>
        <div className="pt-2">
          <button
            onClick={() => onNavigate(`${baseRolePath}/orders`)}
            className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl transition"
          >
            Volver a la lista de órdenes
          </button>
        </div>
      </div>
    );
  }

  // Si el pago se registró con éxito
  if (successPayment) {
    const isConfirmed = successPayment.status === 'CONFIRMED';

    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center shadow-xl space-y-6 max-w-xl mx-auto">
        <div className="w-14 h-14 bg-emerald-500/20 text-emerald-400 rounded-2xl flex items-center justify-center mx-auto border border-emerald-500/30">
          <CheckCircle2 className="w-8 h-8" />
        </div>

        <div>
          <h2 className="text-xl font-black text-white">
            {isConfirmed ? '¡Pago Confirmado Exitosamente!' : '¡Pago Registrado en Revisión!'}
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            {isConfirmed
              ? 'La orden ha sido actualizada al estado PAID de forma atómica.'
              : 'El pago ha quedado registrado con estado PENDING para su validación.'}
          </p>
        </div>

        {/* Resumen del Comprobante */}
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 text-left text-xs space-y-2">
          <div className="flex justify-between border-b border-slate-800 pb-2">
            <span className="text-slate-400">Orden:</span>
            <span className="font-mono font-bold text-white">{order.orderCode}</span>
          </div>
          <div className="flex justify-between border-b border-slate-800 pb-2">
            <span className="text-slate-400">Monto Liquidado:</span>
            <span className="font-mono font-bold text-emerald-400">${order.total.toFixed(2)} USD</span>
          </div>
          <div className="flex justify-between border-b border-slate-800 pb-2">
            <span className="text-slate-400">Método de Pago:</span>
            <span className="font-semibold text-slate-200">
              {method === 'CASH' && 'Efectivo'}
              {method === 'BANK_TRANSFER' && 'Transferencia bancaria'}
              {method === 'CARD' && 'Tarjeta'}
              {method === 'OTHER' && 'Otro'}
            </span>
          </div>
          {reference && (
            <div className="flex justify-between border-b border-slate-800 pb-2">
              <span className="text-slate-400">Referencia:</span>
              <span className="font-mono text-slate-200">{reference}</span>
            </div>
          )}
          <div className="flex justify-between pt-1">
            <span className="text-slate-400">Estado del Pago:</span>
            <span
              className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                isConfirmed
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
              }`}
            >
              {successPayment.status}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => onNavigate(`${baseRolePath}/orders/${order.id}`)}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition shadow-lg shadow-emerald-600/30"
          >
            Ver Detalle de la Orden
          </button>
          <button
            onClick={() => onNavigate(`${baseRolePath}/orders`)}
            className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl transition"
          >
            Volver a Órdenes
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Encabezado con botón de regreso */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => onNavigate(`${baseRolePath}/orders/${order.id}`)}
          className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
          title="Volver a la orden"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
            <span>Registrar Pago de Orden</span>
            <span className="text-emerald-400 font-mono text-lg">{order.orderCode}</span>
          </h1>
          <p className="text-xs text-slate-400">
            Recepción y liquidación del total de la orden con auditoría independiente.
          </p>
        </div>
      </div>

      {/* Tarjeta de Resumen de la Orden */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h2 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Información de la Orden Comercial</span>
          </h2>
          <span className="px-2.5 py-0.5 text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-full">
            Pendiente de Pago
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
          <div>
            <span className="text-slate-500 block">Cliente Titular</span>
            <span className="font-bold text-white text-sm">{order.customerName}</span>
          </div>

          <div>
            <span className="text-slate-500 block">Evento</span>
            <span className="font-semibold text-slate-200">{order.eventTitle}</span>
          </div>

          <div>
            <span className="text-slate-500 block">Cantidad de Asistentes</span>
            <span className="font-mono text-slate-200 font-bold">
              {order.attendeeCount} persona{order.attendeeCount > 1 ? 's' : ''}
            </span>
          </div>

          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/80">
            <span className="text-slate-400 block text-[11px]">Total Requerido</span>
            <span className="text-xl font-mono font-black text-emerald-400">
              ${order.total.toFixed(2)} USD
            </span>
          </div>
        </div>
      </div>

      {/* Formulario de Pago */}
      <form onSubmit={handleSubmit} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
        <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-emerald-400" />
          <span>Información del Pago</span>
        </h2>

        {submitError && (
          <div className="p-4 bg-red-950/50 border border-red-800/80 rounded-xl text-red-200 text-xs flex items-center gap-2 shadow">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{submitError}</span>
          </div>
        )}

        {/* Monto del Pago (Fijo y obligatorio por el 100%) */}
        <div className="space-y-1.5">
          <label className="block text-xs font-bold text-slate-300">
            Monto a Liquidar (USD)
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold">$</span>
            <input
              type="number"
              disabled
              value={order.total}
              className="w-full pl-8 pr-4 py-2.5 bg-slate-950/70 border border-slate-800 rounded-xl text-emerald-400 font-mono font-bold text-base cursor-not-allowed opacity-90"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-slate-500">
              Total completo obligatorio
            </span>
          </div>
          <p className="text-[11px] text-slate-400">
            El monto del pago debe coincidir exactamente con el total histórico de la orden ($
            {order.total.toFixed(2)} USD).
          </p>
        </div>

        {/* Métodos de Pago */}
        <div className="space-y-2">
          <label className="block text-xs font-bold text-slate-300">
            Método de Pago <span className="text-red-400">*</span>
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <button
              type="button"
              onClick={() => setMethod('CASH')}
              className={`p-3.5 rounded-xl border text-left transition flex flex-col items-start gap-2 ${
                method === 'CASH'
                  ? 'bg-emerald-600/20 border-emerald-500 text-white'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
              }`}
            >
              <Wallet className={`w-5 h-5 ${method === 'CASH' ? 'text-emerald-400' : 'text-slate-400'}`} />
              <div>
                <div className="text-xs font-bold text-white">Efectivo</div>
                <div className="text-[10px] text-slate-400">Cobro en taquilla</div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setMethod('BANK_TRANSFER')}
              className={`p-3.5 rounded-xl border text-left transition flex flex-col items-start gap-2 ${
                method === 'BANK_TRANSFER'
                  ? 'bg-emerald-600/20 border-emerald-500 text-white'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
              }`}
            >
              <Building2 className={`w-5 h-5 ${method === 'BANK_TRANSFER' ? 'text-emerald-400' : 'text-slate-400'}`} />
              <div>
                <div className="text-xs font-bold text-white">Transferencia</div>
                <div className="text-[10px] text-slate-400">Comprobante req.</div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setMethod('CARD')}
              className={`p-3.5 rounded-xl border text-left transition flex flex-col items-start gap-2 ${
                method === 'CARD'
                  ? 'bg-emerald-600/20 border-emerald-500 text-white'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
              }`}
            >
              <CreditCard className={`w-5 h-5 ${method === 'CARD' ? 'text-emerald-400' : 'text-slate-400'}`} />
              <div>
                <div className="text-xs font-bold text-white">Tarjeta</div>
                <div className="text-[10px] text-slate-400">POS / Terminal</div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setMethod('OTHER')}
              className={`p-3.5 rounded-xl border text-left transition flex flex-col items-start gap-2 ${
                method === 'OTHER'
                  ? 'bg-emerald-600/20 border-emerald-500 text-white'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
              }`}
            >
              <FileText className={`w-5 h-5 ${method === 'OTHER' ? 'text-emerald-400' : 'text-slate-400'}`} />
              <div>
                <div className="text-xs font-bold text-white">Otro</div>
                <div className="text-[10px] text-slate-400">Cheque / Bono</div>
              </div>
            </button>
          </div>
        </div>

        {/* Referencia */}
        <div className="space-y-1.5">
          <label className="block text-xs font-bold text-slate-300">
            Número de Referencia / Transacción{' '}
            {(method === 'BANK_TRANSFER' || method === 'CARD') && (
              <span className="text-red-400">*</span>
            )}
          </label>
          <input
            type="text"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder={
              method === 'BANK_TRANSFER'
                ? 'Ej. TRF-BANCO-123456'
                : method === 'CARD'
                ? 'Ej. Nro. de aprobación POS 456789'
                : 'Ej. Nro. de recibo físico (opcional)'
            }
            className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />
        </div>

        {/* Subida de Comprobante (Requerido para Transferencia Bancaria) */}
        <div className="space-y-2">
          <label className="block text-xs font-bold text-slate-300">
            Comprobante de Pago{' '}
            {method === 'BANK_TRANSFER' ? (
              <span className="text-red-400 font-normal">(Obligatorio para Transferencia Bancaria)</span>
            ) : (
              <span className="text-slate-500 font-normal">(Opcional)</span>
            )}
          </label>

          {fileError && (
            <div className="p-3 bg-red-950/50 border border-red-800/80 rounded-xl text-red-200 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{fileError}</span>
            </div>
          )}

          {!proofFile ? (
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-800 hover:border-emerald-500/50 rounded-2xl p-6 text-center cursor-pointer bg-slate-950/50 hover:bg-slate-950 transition group"
            >
              <UploadCloud className="w-8 h-8 text-slate-400 group-hover:text-emerald-400 mx-auto mb-2 transition" />
              <p className="text-xs font-semibold text-slate-300">
                Arrastre y suelte el comprobante aquí, o haga clic para examinar
              </p>
              <p className="text-[10px] text-slate-500 mt-1">
                Formatos permitidos: JPEG, PNG, WEBP, PDF (Máximo 10 MB)
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    handleFileSelect(e.target.files[0]);
                  }
                }}
              />
            </div>
          ) : (
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                {proofPreviewUrl ? (
                  <img
                    src={proofPreviewUrl}
                    alt="Vista previa del comprobante"
                    className="w-14 h-14 object-cover rounded-lg border border-slate-700"
                  />
                ) : (
                  <div className="w-12 h-12 bg-slate-900 border border-slate-800 rounded-lg flex items-center justify-center text-emerald-400">
                    <FileCheck className="w-6 h-6" />
                  </div>
                )}
                <div className="text-xs">
                  <div className="font-bold text-white">{proofFile.name}</div>
                  <div className="text-slate-400 text-[11px]">
                    {(proofFile.size / 1024 / 1024).toFixed(2)} MB • {proofFile.type}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setProofFile(null);
                  setProofPreviewUrl(null);
                }}
                className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-red-400 transition"
                title="Quitar archivo"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Notas adicionales */}
        <div className="space-y-1.5">
          <label className="block text-xs font-bold text-slate-300">
            Notas u Observaciones (Opcional)
          </label>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Ej. Pago recibido en ventanilla por el operador..."
            className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />
        </div>

        {/* Opción de confirmación inmediata */}
        <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl flex items-start gap-3">
          <input
            type="checkbox"
            id="autoConfirmCheck"
            checked={autoConfirm}
            onChange={(e) => setAutoConfirm(e.target.checked)}
            className="mt-1 h-4 w-4 rounded border-slate-700 bg-slate-900 text-emerald-600 focus:ring-emerald-500"
          />
          <label htmlFor="autoConfirmCheck" className="text-xs text-slate-300 cursor-pointer">
            <span className="font-bold text-white block">
              Confirmar y validar pago inmediatamente (Pasa orden a PAID)
            </span>
            Si está marcado, el backend valida el pago y actualiza la orden directamente a estado{' '}
            <strong className="text-emerald-400">PAID</strong>. Si se desmarca, se registrará como{' '}
            <strong className="text-amber-400">PENDING</strong> para revisión posterior.
          </label>
        </div>

        {/* Acciones */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
          <button
            type="button"
            onClick={() => onNavigate(`${baseRolePath}/orders/${order.id}`)}
            disabled={isSubmitting}
            className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-semibold transition"
          >
            Cancelar
          </button>

          <button
            type="submit"
            disabled={isSubmitting}
            className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-lg shadow-emerald-600/30"
          >
            {isSubmitting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Procesando Pago...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>Registrar Pago (${order.total.toFixed(2)} USD)</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
