import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  QrCode,
  CheckCircle2,
  XCircle,
  ShieldAlert,
  Smartphone,
  History,
  Search,
  Volume2,
  VolumeX,
  DoorOpen,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  UserCheck,
  Camera,
  Calendar
} from 'lucide-react';
import { ticketService } from '../../services/ticket.service';
import { eventService } from '../../services/event.service';
import { ValidateAccessResponse, AccessLog, Event } from '../../types';
import { CameraScannerModal } from '../../components/gate/CameraScannerModal';

interface GateDashboardProps {
  onNavigate: (path: string) => void;
}

export const GateDashboard: React.FC<GateDashboardProps> = ({ onNavigate }) => {
  const { user } = useAuth();

  // Configuración de puerta y filtro de evento
  const [selectedGate, setSelectedGate] = useState<string>('PUERTA-01 (Principal)');
  const [inputCode, setInputCode] = useState<string>('');
  const [isValidating, setIsValidating] = useState<boolean>(false);
  const [validationResult, setValidationResult] = useState<ValidateAccessResponse | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState<boolean>(false);
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>('');

  // Registro de auditoría reciente
  const [accessLogs, setAccessLogs] = useState<AccessLog[]>([]);

  // Feedback auditivo (Web Audio API sintético sin dependencias externas)
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);

  // Contador de sesión
  const [stats, setStats] = useState({
    authorized: 0,
    rejected: 0,
    total: 0
  });

  const inputRef = useRef<HTMLInputElement>(null);

  const playFeedbackTone = (authorized: boolean) => {
    if (!soundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (authorized) {
        // Tono agudo armónico de éxito
        osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
        osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1); // A5
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        osc.start();
        osc.stop(ctx.currentTime + 0.3);
      } else {
        // Tono grave de advertencia / rechazo
        osc.frequency.setValueAtTime(220, ctx.currentTime); // A3
        osc.frequency.setValueAtTime(164.81, ctx.currentTime + 0.15); // E3
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
        osc.start();
        osc.stop(ctx.currentTime + 0.4);
      }
    } catch {
      // Ignorar restricciones de audio del navegador
    }
  };

  const loadInitialData = async () => {
    try {
      // Seguridad Fase 6.1: Gate Operator nunca descarga la lista de tickets
      const [logs, allEvents] = await Promise.all([
        ticketService.getAccessLogs({ limit: 30 }),
        eventService.getEvents().catch(() => [])
      ]);
      setAccessLogs(logs);
      const activeEvents = allEvents.filter((e) => e.status === 'ACTIVE');
      setEvents(activeEvents);
      if (activeEvents.length > 0) {
        setSelectedEventId((prev) => (prev && activeEvents.some((e) => e.id === prev) ? prev : activeEvents[0].id));
      }

      // Calcular estadísticas de la sesión actual
      const authCount = logs.filter((l) => l.authorized).length;
      const rejCount = logs.filter((l) => !l.authorized).length;
      setStats({
        authorized: authCount,
        rejected: rejCount,
        total: logs.length
      });
    } catch (err) {
      console.warn('[GateDashboard] Error cargando registros de acceso:', err);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  const handleValidate = async (tokenOrCode: string) => {
    const clean = tokenOrCode.trim();
    if (!clean) return;

    if (!selectedEventId) {
      setValidationResult({
        authorized: false,
        status: 'REJECTED',
        rejectionReason: 'WRONG_EVENT',
        message: 'Debe seleccionar un evento específico para operar el control de acceso en puerta.'
      });
      playFeedbackTone(false);
      return;
    }

    try {
      setIsValidating(true);
      setValidationResult(null);

      // Determinar si es qrToken (hex largo) o ticketCode legible
      const isQr = clean.length >= 32;
      const res = await ticketService.validateTicketAccess({
        qrToken: isQr ? clean : undefined,
        ticketCode: !isQr ? clean : undefined,
        gateId: selectedGate,
        eventId: selectedEventId
      });

      setValidationResult(res);
      playFeedbackTone(res.authorized);

      // Actualizar contadores
      setStats((prev) => ({
        authorized: prev.authorized + (res.authorized ? 1 : 0),
        rejected: prev.rejected + (!res.authorized ? 1 : 0),
        total: prev.total + 1
      }));

      // Refrescar registros
      await loadInitialData();
      setInputCode('');
      if (inputRef.current) {
        inputRef.current.focus();
      }
    } catch (err: any) {
      const errorResponse: ValidateAccessResponse = {
        authorized: false,
        status: 'REJECTED',
        rejectionReason: 'UNAUTHORIZED',
        message: err.message || 'Error inesperado durante la validación de acceso.'
      };
      setValidationResult(errorResponse);
      playFeedbackTone(false);
    } finally {
      setIsValidating(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleValidate(inputCode);
  };

  return (
    <div className="space-y-6">
      {/* Cabecera Principal del Terminal */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="p-2 bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 rounded-xl">
                <QrCode className="w-5 h-5" />
              </span>
              <span className="text-xs font-bold uppercase tracking-wider text-cyan-400">
                Fase 6: Control Seguro de Acceso Server-Side
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Terminal de Puerta y Validación
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Escaneo atómico con prevención estricta de doble ingreso (<code className="font-mono text-cyan-300">runTransaction</code>).
            </p>
          </div>

          {/* Configuración de Puerta y Sonido */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-2xl px-3 py-2">
              <UserCheck className="w-4 h-4 text-cyan-400" />
              <div className="text-left text-xs">
                <span className="font-bold text-white block truncate max-w-[120px]">
                  {user?.displayName || 'Operador'}
                </span>
                <span className="text-[10px] text-cyan-400 font-mono block">
                  {user?.role}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-2xl px-3 py-2">
              <DoorOpen className="w-4 h-4 text-cyan-400" />
              <select
                value={selectedGate}
                onChange={(e) => setSelectedGate(e.target.value)}
                className="bg-transparent text-xs text-white font-semibold focus:outline-none cursor-pointer"
              >
                <option value="PUERTA-01 (Principal)" className="bg-slate-900 text-white">
                  PUERTA-01 (Principal)
                </option>
                <option value="PUERTA-02 (VIP)" className="bg-slate-900 text-white">
                  PUERTA-02 (VIP)
                </option>
                <option value="PUERTA-03 (Lateral Norte)" className="bg-slate-900 text-white">
                  PUERTA-03 (Lateral Norte)
                </option>
              </select>
            </div>

            <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-2xl px-3 py-2">
              <Calendar className="w-4 h-4 text-cyan-400" />
              <select
                value={selectedEventId}
                onChange={(e) => setSelectedEventId(e.target.value)}
                className="bg-transparent text-xs text-white font-semibold focus:outline-none cursor-pointer max-w-[160px] sm:max-w-[200px] truncate"
                title="Evento específico obligatorio para el control de acceso"
              >
                {!selectedEventId && (
                  <option value="" disabled className="bg-slate-900 text-slate-400">
                    Seleccione un evento...
                  </option>
                )}
                {events.map((ev) => (
                  <option key={ev.id} value={ev.id} className="bg-slate-900 text-white">
                    {ev.title}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`p-2.5 rounded-2xl border transition ${
                soundEnabled
                  ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400'
                  : 'bg-slate-800 border-slate-700 text-slate-400'
              }`}
              title={soundEnabled ? 'Silenciar alertas' : 'Activar alertas de audio'}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Métricas de la Sesión en Tiempo Real */}
        <div className="grid grid-cols-3 gap-3 sm:gap-4 mt-6">
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">
                Autorizados
              </span>
              <span className="text-xl sm:text-2xl font-black font-mono text-emerald-400">
                {stats.authorized}
              </span>
            </div>
          </div>

          <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center justify-center">
              <XCircle className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">
                Rechazados
              </span>
              <span className="text-xl sm:text-2xl font-black font-mono text-rose-400">
                {stats.rejected}
              </span>
            </div>
          </div>

          <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 flex items-center justify-center">
              <History className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">
                Total Escaneos
              </span>
              <span className="text-xl sm:text-2xl font-black font-mono text-cyan-400">
                {stats.total}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Panel Central de Escaneo y Feedback */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Columna Izquierda: Entrada de Código y Pruebas Rápidas (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-6">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Smartphone className="w-5 h-5 text-cyan-400" />
              <span>Escáner de Boletos / Lector 2D</span>
            </h2>

            {/* Formulario de Escaneo Manual / Pistola Láser */}
            <form onSubmit={handleSubmit} className="space-y-3">
              <label className="text-xs font-semibold text-slate-300 block">
                Token QR o Código de Boleto (Enter para validar)
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                  <input
                    ref={inputRef}
                    type="text"
                    value={inputCode}
                    onChange={(e) => setInputCode(e.target.value)}
                    placeholder="Escanear QR o ingresar ej. TKT-2026-DEMO01-01..."
                    autoFocus
                    className="w-full pl-10 pr-4 py-3 bg-slate-950 border border-slate-700 focus:border-cyan-500 rounded-2xl text-xs sm:text-sm text-white placeholder-slate-500 font-mono tracking-wide focus:outline-none shadow-inner"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setIsCameraOpen(true)}
                  className="px-4 py-3 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 rounded-2xl text-xs font-bold transition flex items-center gap-2 shadow-sm shrink-0"
                  title="Escanear código QR en vivo con la cámara"
                >
                  <Camera className="w-4 h-4 text-indigo-400" />
                  <span className="hidden sm:inline">Cámara</span>
                </button>
                <button
                  type="submit"
                  disabled={isValidating || !inputCode.trim()}
                  className="px-5 py-3 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white rounded-2xl text-xs font-bold transition flex items-center gap-2 shadow-lg shadow-cyan-600/30 shrink-0"
                >
                  {isValidating ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <span>Validar</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
              <p className="text-[11px] text-slate-500">
                Compatible con pistolas lectoras de códigos de barra 2D USB/Bluetooth y teclado estándar.
              </p>
            </form>

            {/* Pruebas Rápidas de Seguridad y Auditoría */}
            <div className="pt-4 border-t border-slate-800 space-y-3">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Pruebas de Seguridad y Resiliencia en Puerta
              </span>
              <div className="flex flex-wrap gap-2">
                {/* Botón de prueba para Token Inválido / Adulterado */}
                <button
                  type="button"
                  onClick={() => handleValidate('TOKEN_FALSO_O_ADULTERADO_0000000000000000000000000000')}
                  disabled={isValidating}
                  className="px-3 py-2 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 rounded-xl text-xs text-left transition space-y-0.5"
                >
                  <div className="font-mono text-rose-400 font-bold text-[11px]">
                    QR FALSO / ADULTERADO
                  </div>
                  <div className="text-[11px] text-rose-300">Auditar token no reconocido</div>
                </button>

                {/* Botón de prueba para Código Inexistente */}
                <button
                  type="button"
                  onClick={() => handleValidate('TKT-9999-INEXISTENTE-99')}
                  disabled={isValidating}
                  className="px-3 py-2 bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-amber-500/40 rounded-xl text-xs text-left transition space-y-0.5"
                >
                  <div className="font-mono text-amber-400 font-bold text-[11px]">
                    CÓDIGO INEXISTENTE
                  </div>
                  <div className="text-[11px] text-slate-400">Auditar rechazo controlado</div>
                </button>
              </div>
              <p className="text-[10px] text-slate-500 leading-relaxed">
                Terminal con principio de menor privilegio: Los operadores de puerta nunca descargan ni enumeran boletos ni tokens QR de forma masiva.
              </p>
            </div>
          </div>
        </div>

        {/* Columna Derecha: Tarjeta de Resultado Instantáneo (5 cols) */}
        <div className="lg:col-span-5">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl h-full flex flex-col justify-between">
            <h2 className="text-base font-bold text-white flex items-center gap-2 mb-4">
              <ShieldCheck className="w-5 h-5 text-indigo-400" />
              <span>Resultado de Validación</span>
            </h2>

            {isValidating ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 space-y-3">
                <RefreshCw className="w-10 h-10 animate-spin text-cyan-400" />
                <span className="text-xs text-slate-400">Verificando en servidor con Admin SDK...</span>
              </div>
            ) : !validationResult ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-3 bg-slate-950/40 rounded-2xl border border-dashed border-slate-800">
                <div className="w-12 h-12 rounded-2xl bg-slate-800 text-slate-500 flex items-center justify-center">
                  <QrCode className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-300">Terminal en Espera</h3>
                  <p className="text-xs text-slate-500 mt-1 max-w-xs">
                    Escanee un código QR o seleccione un boleto de prueba para verificar autorización.
                  </p>
                </div>
              </div>
            ) : validationResult.authorized ? (
              /* Tarjeta de Aceptación Verde Esmeralda de Alto Impacto */
              <div className="flex-1 flex flex-col justify-between p-6 bg-emerald-950/50 border-2 border-emerald-500/60 rounded-2xl shadow-xl shadow-emerald-950/50 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500 text-slate-950 flex items-center justify-center shadow-lg shadow-emerald-500/40 animate-pulse">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <div>
                    <span className="text-xs font-black uppercase tracking-wider text-emerald-400 block">
                      INGRESO AUTORIZADO
                    </span>
                    <h3 className="text-lg font-black text-white">
                      {validationResult.ticket?.attendeeName}
                    </h3>
                  </div>
                </div>

                <div className="bg-slate-950/80 rounded-xl p-4 border border-emerald-500/20 space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Boleto:</span>
                    <span className="font-mono font-bold text-white">
                      {validationResult.ticket?.ticketCode}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Categoría:</span>
                    <span className="text-emerald-300 font-semibold">
                      {validationResult.ticket?.ticketType || 'General'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Evento:</span>
                    <span className="text-white font-medium truncate max-w-[180px]">
                      {validationResult.ticket?.eventTitle}
                    </span>
                  </div>
                  <div className="flex justify-between border-t border-slate-800 pt-2 text-[11px]">
                    <span className="text-slate-500">Hora de Ingreso:</span>
                    <span className="text-slate-300 font-mono">
                      {new Date().toLocaleTimeString()}
                    </span>
                  </div>
                </div>

                <div className="text-center text-xs font-bold text-emerald-400 bg-emerald-500/10 py-2 rounded-xl border border-emerald-500/20">
                  {validationResult.message}
                </div>
              </div>
            ) : (
              /* Tarjeta de Rechazo Carmesí de Alto Impacto */
              <div className="flex-1 flex flex-col justify-between p-6 bg-rose-950/50 border-2 border-rose-500/60 rounded-2xl shadow-xl shadow-rose-950/50 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-rose-600 text-white flex items-center justify-center shadow-lg shadow-rose-600/40">
                    <XCircle className="w-8 h-8" />
                  </div>
                  <div>
                    <span className="text-xs font-black uppercase tracking-wider text-rose-400 block">
                      ACCESO DENEGADO
                    </span>
                    <h3 className="text-base font-bold text-white">
                      {validationResult.rejectionReason === 'ALREADY_USED'
                        ? 'Boleto ya Utilizado'
                        : validationResult.rejectionReason === 'TICKET_CANCELLED'
                        ? 'Boleto Cancelado'
                        : 'Boleto no Válido'}
                    </h3>
                  </div>
                </div>

                <div className="bg-slate-950/80 rounded-xl p-4 border border-rose-500/20 space-y-2 text-xs">
                  <p className="text-rose-300 font-medium leading-relaxed">
                    {validationResult.message}
                  </p>
                  {validationResult.ticket && (
                    <div className="pt-2 border-t border-slate-800 text-[11px] space-y-1">
                      <div className="flex justify-between text-slate-400">
                        <span>Asistente:</span>
                        <span className="font-bold text-white">
                          {validationResult.ticket.attendeeName}
                        </span>
                      </div>
                      <div className="flex justify-between text-slate-400">
                        <span>Código:</span>
                        <span className="font-mono text-slate-300">
                          {validationResult.ticket.ticketCode}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="text-center text-xs font-bold text-rose-400 bg-rose-500/10 py-2 rounded-xl border border-rose-500/20">
                  Causa: {validationResult.rejectionReason || 'RECHAZADO'}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Historial de Auditoría de Accesos (Access Logs) */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <History className="w-5 h-5 text-indigo-400" />
            <span>Auditoría de Accesos en Tiempo Real</span>
          </h2>
          <span className="text-xs text-slate-400 font-mono">
            Últimos registros auditados
          </span>
        </div>

        {accessLogs.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-500">
            No se han registrado intentos de acceso en esta puerta aún.
          </div>
        ) : (
          <div className="overflow-x-auto border border-slate-800 rounded-2xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Hora</th>
                  <th className="py-3 px-4">Boleto / Token</th>
                  <th className="py-3 px-4">Asistente</th>
                  <th className="py-3 px-4">Puerta</th>
                  <th className="py-3 px-4">Método</th>
                  <th className="py-3 px-4">Resultado</th>
                  <th className="py-3 px-4">Detalle / Motivo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 bg-slate-900/40 font-mono">
                {accessLogs.slice(0, 15).map((log) => (
                  <tr key={log.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-2.5 px-4 text-slate-400">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </td>
                    <td className="py-2.5 px-4 font-bold text-slate-200">
                      {log.ticketCode || 'N/A'}
                    </td>
                    <td className="py-2.5 px-4 font-sans text-slate-300">
                      {log.attendeeName || 'Desconocido'}
                    </td>
                    <td className="py-2.5 px-4 text-slate-400 font-sans">{log.gateId}</td>
                    <td className="py-2.5 px-4 text-slate-400">
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-[10px]">
                        {log.validationMethod}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 font-sans">
                      {log.authorized ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold rounded-full">
                          <CheckCircle2 className="w-3 h-3" />
                          AUTORIZADO
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[10px] font-bold rounded-full">
                          <XCircle className="w-3 h-3" />
                          RECHAZADO
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-4 font-sans text-slate-400 truncate max-w-xs">
                      {log.message || log.rejectionReason || 'OK'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Criterios de Aceptación & Verificación de RBAC */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-amber-500/10 text-amber-400 rounded-xl flex items-center justify-center border border-amber-500/20">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Verificar Escenario de RBAC</h3>
            <p className="text-xs text-slate-400">Intento de acceso cruzado no autorizado para gate_operator</p>
          </div>
        </div>
        <p className="text-xs text-slate-400 mb-4 leading-relaxed">
          Un usuario con rol <code className="text-cyan-400 font-bold">gate_operator</code> NO tiene autorización para ingresar a <code className="text-emerald-400 font-bold">/cashier</code> ni a <code className="text-indigo-400 font-bold">/admin</code>. Comprueba el rechazo por RouteGuard y Firestore Rules:
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={() => onNavigate('/cashier')}
            className="flex-1 py-2.5 px-4 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-xl text-xs font-semibold transition text-center"
          >
            Intentar acceder a /cashier (Cobranzas)
          </button>
          <button
            onClick={() => onNavigate('/admin')}
            className="flex-1 py-2.5 px-4 bg-red-500/10 hover:bg-red-500/20 text-red-300 border border-red-500/30 rounded-xl text-xs font-semibold transition text-center"
          >
            Intentar acceder a /admin (Administración)
          </button>
        </div>
      </div>

      {/* Modal de Escáner por Cámara */}
      <CameraScannerModal
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onScan={(code) => {
          handleValidate(code);
        }}
      />
    </div>
  );
};
