import React, { useState, useEffect, useRef } from 'react';
import {
  Camera,
  X,
  RefreshCw,
  AlertCircle,
  Zap,
  ZapOff,
  SwitchCamera,
  Upload,
  QrCode
} from 'lucide-react';

interface CameraScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (decodedText: string) => void;
}

export const CameraScannerModal: React.FC<CameraScannerModalProps> = ({
  isOpen,
  onClose,
  onScan
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<any>(null);

  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [torchOn, setTorchOn] = useState<boolean>(false);
  const [hasTorch, setHasTorch] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isStartingCamera, setIsStartingCamera] = useState<boolean>(true);
  const [barcodeDetectorSupported, setBarcodeDetectorSupported] = useState<boolean>(false);

  // Detener la cámara
  const stopCamera = () => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => {
        try {
          t.stop();
        } catch {
          // Ignorar
        }
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  // Iniciar la cámara
  const startCamera = async (mode: 'environment' | 'user') => {
    stopCamera();
    setIsStartingCamera(true);
    setErrorMsg(null);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('La cámara no está disponible o no tiene permisos en este navegador.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: mode,
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      // Comprobar si el dispositivo soporta linterna (torch)
      const track = stream.getVideoTracks()[0];
      if (track && typeof track.getCapabilities === 'function') {
        const caps: any = track.getCapabilities();
        setHasTorch(Boolean(caps && caps.torch));
      } else {
        setHasTorch(false);
      }

      setIsStartingCamera(false);

      // Iniciar el bucle de detección con BarcodeDetector si existe
      initBarcodeDetection();
    } catch (err: any) {
      console.warn('[CameraScanner] Error accediendo a la cámara:', err);
      setIsStartingCamera(false);
      setErrorMsg(
        err.name === 'NotAllowedError'
          ? 'Permiso de cámara denegado. Por favor, habilite el acceso a la cámara en los ajustes del navegador.'
          : err.message || 'No se pudo acceder al hardware de la cámara.'
      );
    }
  };

  const toggleTorch = async () => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (!track) return;

    try {
      const nextTorch = !torchOn;
      await (track as any).applyConstraints({
        advanced: [{ torch: nextTorch }]
      });
      setTorchOn(nextTorch);
    } catch (err) {
      console.warn('[CameraScanner] Error alternando linterna:', err);
    }
  };

  const flipCamera = () => {
    const nextMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextMode);
    startCamera(nextMode);
  };

  // Iniciar detección periódica de QR
  const initBarcodeDetection = () => {
    const hasBarcode = 'BarcodeDetector' in window;
    setBarcodeDetectorSupported(hasBarcode);

    if (hasBarcode) {
      try {
        const detector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
        scanIntervalRef.current = setInterval(async () => {
          if (!videoRef.current || videoRef.current.readyState < 2) return;
          try {
            const barcodes = await detector.detect(videoRef.current);
            if (barcodes && barcodes.length > 0) {
              const rawVal = barcodes[0].rawValue;
              if (rawVal) {
                stopCamera();
                onScan(rawVal);
                onClose();
              }
            }
          } catch {
            // Error momentáneo de detección en frame
          }
        }, 250);
      } catch (e) {
        console.warn('[CameraScanner] Error inicializando BarcodeDetector:', e);
      }
    }
  };

  // Carga manual de imagen para navegadores sin BarcodeDetector o escaneo de fotos
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      if ('BarcodeDetector' in window) {
        const detector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
        const img = new Image();
        img.src = URL.createObjectURL(file);
        img.onload = async () => {
          try {
            const codes = await detector.detect(img);
            if (codes && codes.length > 0 && codes[0].rawValue) {
              stopCamera();
              onScan(codes[0].rawValue);
              onClose();
            } else {
              setErrorMsg('No se detectó un código QR nítido en la imagen seleccionada.');
            }
          } catch (err: any) {
            setErrorMsg('Error procesando imagen: ' + (err.message || 'Fallo desconocido'));
          } finally {
            URL.revokeObjectURL(img.src);
          }
        };
      } else {
        // En navegadores sin detector nativo, permitir extracción manual o nombre
        setErrorMsg('El navegador no soporta detección de QR en imagen de forma nativa. Por favor ingrese el código manualmente o use Chrome.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al procesar archivo');
    }
  };

  useEffect(() => {
    if (isOpen) {
      startCamera(facingMode);
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col">
        {/* Cabecera del Escáner */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <span className="p-2 bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 rounded-xl">
              <Camera className="w-5 h-5" />
            </span>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="text-sm font-bold text-white">Escáner de Cámara en Vivo</h3>
                <QrCode className="w-3.5 h-3.5 text-cyan-400" />
              </div>
              <div className="flex items-center gap-2">
                <p className="text-[11px] text-slate-400">Apunte la cámara al código QR del asistente</p>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
                  {barcodeDetectorSupported ? 'HW Barcode' : 'Sensor estándar'}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition"
            title="Cerrar escáner"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Visor de Cámara con Marco de Escaneo */}
        <div className="relative aspect-square sm:aspect-video w-full bg-black overflow-hidden flex items-center justify-center">
          <video
            ref={videoRef}
            playsInline
            muted
            className="w-full h-full object-cover"
          />
          <canvas ref={canvasRef} className="hidden" />

          {/* Cuadro de Enfoque / Viewfinder */}
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-8">
            <div className="relative w-64 h-64 border-2 border-cyan-400/80 rounded-2xl shadow-[0_0_0_9999px_rgba(15,23,42,0.65)]">
              {/* Esquinas destacadas */}
              <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-cyan-400 rounded-tl-lg" />
              <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-cyan-400 rounded-tr-lg" />
              <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-cyan-400 rounded-bl-lg" />
              <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-cyan-400 rounded-br-lg" />

              {/* Láser de Escaneo Animado */}
              <div className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_12px_#22d3ee] animate-pulse top-1/2 -translate-y-1/2" />
            </div>
          </div>

          {/* Estado de Carga de Cámara */}
          {isStartingCamera && (
            <div className="absolute inset-0 bg-slate-950/80 flex flex-col items-center justify-center gap-3 text-cyan-400">
              <RefreshCw className="w-8 h-8 animate-spin" />
              <span className="text-xs font-semibold text-slate-300">Iniciando sensor de cámara...</span>
            </div>
          )}

          {/* Mensaje de Error */}
          {errorMsg && (
            <div className="absolute inset-x-4 bottom-4 p-3 bg-rose-950/90 border border-rose-500/50 rounded-2xl text-xs text-rose-300 flex items-start gap-2 shadow-xl">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <span>{errorMsg}</span>
              </div>
            </div>
          )}
        </div>

        {/* Controles de Cámara & Opciones */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={flipCamera}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold transition"
              title="Cambiar entre cámara frontal y trasera"
            >
              <SwitchCamera className="w-4 h-4 text-cyan-400" />
              <span className="hidden sm:inline">Cambiar Cámara</span>
            </button>

            {hasTorch && (
              <button
                onClick={toggleTorch}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition ${
                  torchOn
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                }`}
                title="Activar/desactivar linterna"
              >
                {torchOn ? <ZapOff className="w-4 h-4 text-amber-400" /> : <Zap className="w-4 h-4" />}
                <span className="hidden sm:inline">{torchOn ? 'Apagar Flash' : 'Linterna'}</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Carga de imagen alternativa */}
            <label className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold transition cursor-pointer">
              <Upload className="w-4 h-4 text-indigo-400" />
              <span>Subir Foto QR</span>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleImageUpload}
                className="hidden"
              />
            </label>

            <button
              onClick={() => {
                stopCamera();
                onClose();
              }}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
