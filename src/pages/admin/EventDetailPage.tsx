import React, { useState, useEffect } from 'react';
import {
  Calendar,
  DollarSign,
  Plus,
  Edit2,
  Trash2,
  AlertCircle,
  RefreshCw,
  ArrowLeft,
  BadgeCheck,
  CheckCircle2,
  XCircle,
  Calculator,
  X,
  AlertTriangle
} from 'lucide-react';
import { Event, PriceRule, PricePreviewResult } from '../../types';
import { eventService } from '../../services/event.service';
import { pricingService } from '../../services/pricing.service';
import { useAuth } from '../../context/AuthContext';

interface EventDetailPageProps {
  eventId: string;
  onNavigate: (path: string) => void;
}

export const EventDetailPage: React.FC<EventDetailPageProps> = ({ eventId, onNavigate }) => {
  const { user } = useAuth();
  const [event, setEvent] = useState<Event | null>(null);
  const [rules, setRules] = useState<PriceRule[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Modal Crear / Editar Regla
  const [isRuleModalOpen, setIsRuleModalOpen] = useState<boolean>(false);
  const [editingRule, setEditingRule] = useState<PriceRule | null>(null);
  const [ruleFormData, setRuleFormData] = useState({
    name: '',
    minAge: 0,
    maxAge: '' as string | number,
    communityMemberOnly: false,
    ticketType: '',
    price: 0,
    priority: 10,
    isActive: true
  });
  const [ruleFormError, setRuleFormError] = useState<string | null>(null);
  const [ruleFormWarning, setRuleFormWarning] = useState<string | null>(null);
  const [isSubmittingRule, setIsSubmittingRule] = useState<boolean>(false);

  // Simulador de cálculo de precio (calculatePricePreview)
  const [simAge, setSimAge] = useState<number>(25);
  const [simIsMember, setSimIsMember] = useState<boolean>(true);
  const [previewResult, setPreviewResult] = useState<PricePreviewResult | null>(null);
  const [isCalculatingPreview, setIsCalculatingPreview] = useState<boolean>(false);

  const loadEventAndRules = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const evt = await eventService.getEventById(eventId);
      if (!evt) {
        setErrorMessage('El evento solicitado no fue encontrado.');
        setIsLoading(false);
        return;
      }
      setEvent(evt);

      const priceRules = await pricingService.getRulesByEventId(eventId);
      setRules(priceRules);
    } catch {
      setErrorMessage('Error al cargar la información del evento y sus reglas de precio.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadEventAndRules();
  }, [eventId]);

  // Ejecutar preview automático cuando cambian los inputs de prueba o las reglas
  useEffect(() => {
    if (!eventId) return;

    let isMounted = true;
    const runPreview = async () => {
      setIsCalculatingPreview(true);
      try {
        const result = await pricingService.calculatePricePreview({
          eventId,
          age: Number(simAge),
          isCommunityMember: simIsMember
        });
        if (isMounted) {
          setPreviewResult(result);
        }
      } catch (err: any) {
        if (isMounted) {
          setPreviewResult({
            matchedRuleId: null,
            ruleName: null,
            price: null,
            currency: 'USD',
            rejectionReason: err.message || 'Error en cálculo'
          });
        }
      } finally {
        if (isMounted) {
          setIsCalculatingPreview(false);
        }
      }
    };

    runPreview();

    return () => {
      isMounted = false;
    };
  }, [eventId, simAge, simIsMember, rules]);

  // Abrir modal nueva regla
  const handleOpenCreateRule = () => {
    setEditingRule(null);
    setRuleFormData({
      name: '',
      minAge: 0,
      maxAge: '',
      communityMemberOnly: false,
      ticketType: 'General',
      price: 20,
      priority: 10,
      isActive: true
    });
    setRuleFormError(null);
    setRuleFormWarning(null);
    setIsRuleModalOpen(true);
  };

  // Abrir modal editar regla
  const handleOpenEditRule = (r: PriceRule) => {
    setEditingRule(r);
    setRuleFormData({
      name: r.name,
      minAge: r.minAge,
      maxAge: r.maxAge !== null ? r.maxAge : '',
      communityMemberOnly: r.communityMemberOnly,
      ticketType: r.ticketType || '',
      price: r.price,
      priority: r.priority,
      isActive: r.isActive
    });
    setRuleFormError(null);
    setRuleFormWarning(null);
    setIsRuleModalOpen(true);
  };

  // Guardar regla
  const handleSubmitRule = async (e: React.FormEvent) => {
    e.preventDefault();
    setRuleFormError(null);
    setRuleFormWarning(null);

    const maxAgeVal =
      ruleFormData.maxAge !== '' && ruleFormData.maxAge !== null
        ? Number(ruleFormData.maxAge)
        : null;

    const validation = await pricingService.validatePriceRule(
      {
        eventId,
        name: ruleFormData.name,
        minAge: Number(ruleFormData.minAge),
        maxAge: maxAgeVal,
        price: Number(ruleFormData.price),
        priority: Number(ruleFormData.priority),
        communityMemberOnly: ruleFormData.communityMemberOnly
      },
      editingRule?.id
    );

    if (!validation.isValid) {
      setRuleFormError(validation.error || 'Datos no válidos.');
      return;
    }

    if (validation.warning) {
      setRuleFormWarning(validation.warning);
    }

    setIsSubmittingRule(true);
    try {
      const operatorUid = user?.uid || 'usr_admin';

      if (editingRule) {
        const updated = await pricingService.updateRule(
          editingRule.id,
          {
            name: ruleFormData.name,
            minAge: Number(ruleFormData.minAge),
            maxAge: maxAgeVal,
            communityMemberOnly: ruleFormData.communityMemberOnly,
            ticketType: ruleFormData.ticketType || undefined,
            price: Number(ruleFormData.price),
            priority: Number(ruleFormData.priority),
            isActive: ruleFormData.isActive
          },
          operatorUid
        );

        setRules((prev) =>
          prev
            .map((r) => (r.id === updated.id ? updated : r))
            .sort((a, b) => b.priority - a.priority)
        );
      } else {
        const created = await pricingService.createRule(
          {
            eventId,
            name: ruleFormData.name,
            minAge: Number(ruleFormData.minAge),
            maxAge: maxAgeVal,
            communityMemberOnly: ruleFormData.communityMemberOnly,
            ticketType: ruleFormData.ticketType || undefined,
            price: Number(ruleFormData.price),
            priority: Number(ruleFormData.priority),
            isActive: ruleFormData.isActive
          },
          operatorUid
        );

        setRules((prev) => [created, ...prev].sort((a, b) => b.priority - a.priority));
      }

      setIsRuleModalOpen(false);
    } catch (err: any) {
      setRuleFormError(err.message || 'Error al guardar la regla de precio.');
    } finally {
      setIsSubmittingRule(false);
    }
  };

  // Toggle estado de regla (Activa / Inactiva)
  const handleToggleRuleStatus = async (r: PriceRule) => {
    try {
      const operatorUid = user?.uid || 'usr_admin';
      const updated = await pricingService.toggleRuleStatus(r.id, !r.isActive, operatorUid);
      setRules((prev) =>
        prev
          .map((item) => (item.id === updated.id ? updated : item))
          .sort((a, b) => b.priority - a.priority)
      );
    } catch {
      alert('Error al modificar el estado de la regla.');
    }
  };

  // Eliminar regla (si aún no está en uso)
  const handleDeleteRule = async (r: PriceRule) => {
    const confirmDelete = window.confirm(
      `¿Está seguro de eliminar permanentemente la regla "${r.name}"?`
    );
    if (!confirmDelete) return;

    try {
      await pricingService.deleteRule(r.id);
      setRules((prev) => prev.filter((item) => item.id !== r.id));
    } catch {
      alert('No fue posible eliminar la regla.');
    }
  };

  if (isLoading) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center">
        <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin mx-auto mb-3" />
        <p className="text-sm text-slate-300 font-medium">Cargando detalle del evento...</p>
      </div>
    );
  }

  if (errorMessage || !event) {
    return (
      <div className="bg-rose-950/30 border border-rose-800/50 rounded-2xl p-8 text-center">
        <AlertCircle className="w-8 h-8 text-rose-400 mx-auto mb-3" />
        <h3 className="text-sm font-bold text-rose-300 mb-1">Evento no disponible</h3>
        <p className="text-xs text-rose-400/80 max-w-md mx-auto mb-4">{errorMessage}</p>
        <button
          onClick={() => onNavigate('/admin/events')}
          className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Volver a Eventos</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Botón Volver */}
      <button
        onClick={() => onNavigate('/admin/events')}
        className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Volver a la lista de eventos</span>
      </button>

      {/* Tarjeta de Información General del Evento */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-indigo-600/10 text-indigo-400 border border-indigo-500/20 rounded-lg">
                <Calendar className="w-4 h-4" />
              </span>
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-400 font-mono">
                {event.id}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              {event.title}
            </h1>
            {event.description && (
              <p className="text-sm text-slate-400 max-w-2xl">{event.description}</p>
            )}
          </div>

          <div className="flex flex-col sm:items-end gap-2">
            <span
              className={`px-3 py-1 rounded-full text-xs font-bold border ${
                event.status === 'ACTIVE'
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                  : event.status === 'DRAFT'
                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                  : event.status === 'CLOSED'
                  ? 'bg-slate-800 text-slate-400 border-slate-700'
                  : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
              }`}
            >
              Estado: {event.status}
            </span>
            <span className="text-[11px] text-slate-500">
              Creado: {new Date(event.createdAt).toLocaleDateString()}
            </span>
          </div>
        </div>

        {/* Metadatos operativos */}
        <div className="mt-6 pt-6 border-t border-slate-800/80 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
          <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
            <span className="text-[11px] text-slate-500 block mb-1">Fecha programada</span>
            <span className="font-semibold text-white">{event.date}</span>
          </div>
          <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
            <span className="text-[11px] text-slate-500 block mb-1">Horario</span>
            <span className="font-semibold text-white">
              {event.startTime || '--:--'} a {event.endTime || '--:--'}
            </span>
          </div>
          <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
            <span className="text-[11px] text-slate-500 block mb-1">Lugar</span>
            <span className="font-semibold text-white truncate block">
              {event.venue || 'Por definir'}
            </span>
          </div>
          <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
            <span className="text-[11px] text-slate-500 block mb-1">Capacidad / Ventas</span>
            <span className="font-semibold text-white">
              {event.ticketsSold} / {event.capacity ?? '∞'}
            </span>
          </div>
        </div>
      </div>

      {/* SECCIÓN: REGLAS DE PRECIOS */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="p-1.5 bg-emerald-600/10 text-emerald-400 border border-emerald-500/20 rounded-lg">
                <DollarSign className="w-4 h-4" />
              </span>
              <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                Reglas de precios
              </h2>
            </div>
            <p className="text-xs text-slate-400">
              Configure las tarifas dinámicas aplicables según edad, condición comunitaria y orden de prioridad.
            </p>
          </div>

          <button
            id="btn-create-price-rule"
            onClick={handleOpenCreateRule}
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-emerald-600/20 transition self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Crear Regla de Precio</span>
          </button>
        </div>

        {/* Listado de Reglas */}
        {rules.length === 0 ? (
          <div className="bg-slate-950/60 border border-dashed border-slate-800 rounded-xl p-8 text-center">
            <DollarSign className="w-8 h-8 text-slate-600 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-300">No hay reglas de precios configuradas para este evento.</p>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto mb-4">
              Sin reglas de precios activas, Cobranzas no podrá cotizar boletos para este evento.
            </p>
            <button
              onClick={handleOpenCreateRule}
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Crear regla ahora</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-950/80 border-b border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="px-4 py-3">Nombre</th>
                  <th className="px-4 py-3">Rango de Edad</th>
                  <th className="px-4 py-3">Miembro Sinagoga</th>
                  <th className="px-4 py-3">Precio</th>
                  <th className="px-4 py-3">Prioridad</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-xs">
                {rules.map((rule) => (
                  <tr key={rule.id} className="hover:bg-slate-800/40 transition">
                    <td className="px-4 py-3.5">
                      <div className="font-semibold text-white">{rule.name}</div>
                      {rule.ticketType && (
                        <div className="text-[10px] text-slate-400">{rule.ticketType}</div>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="font-mono text-slate-300">
                        {rule.minAge} {rule.maxAge !== null ? `a ${rule.maxAge}` : '+'} años
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      {rule.communityMemberOnly ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-400">
                          <BadgeCheck className="w-3.5 h-3.5" />
                          <span>Exclusivo Miembro</span>
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-400">Cualquiera (General)</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 font-bold text-emerald-400 font-mono text-sm">
                      ${rule.price} {rule.currency}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="inline-flex items-center px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[11px]">
                        Nivel {rule.priority}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      {rule.isActive ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Activa</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500">
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Inactiva</span>
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenEditRule(rule)}
                          title="Editar regla"
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-indigo-400 transition"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleToggleRuleStatus(rule)}
                          title={rule.isActive ? 'Desactivar regla' : 'Activar regla'}
                          className={`p-1.5 rounded-lg text-xs font-medium ${
                            rule.isActive
                              ? 'bg-amber-500/10 text-amber-400 hover:bg-amber-500/20'
                              : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                          }`}
                        >
                          {rule.isActive ? 'Pausar' : 'Activar'}
                        </button>
                        <button
                          onClick={() => handleDeleteRule(rule)}
                          title="Eliminar regla si no está utilizada"
                          className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* SECCIÓN 8: SIMULADOR Y PREVISUALIZACIÓN DE PRECIOS */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl space-y-6">
        <div className="flex items-center gap-2">
          <span className="p-1.5 bg-indigo-600/10 text-indigo-400 border border-indigo-500/20 rounded-lg">
            <Calculator className="w-4 h-4" />
          </span>
          <div>
            <h3 className="text-base sm:text-lg font-bold text-white">
              Simulador de Precios (calculatePricePreview)
            </h3>
            <p className="text-xs text-slate-400">
              Prueba en tiempo real de resolución de reglas según edad, condición comunitaria y prioridad.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-slate-950/70 border border-slate-800/80 rounded-xl p-5">
          {/* Inputs de simulación */}
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Edad del Asistente (Años)
              </label>
              <input
                id="input-sim-age"
                type="number"
                min="0"
                max="120"
                value={simAge}
                onChange={(e) => setSimAge(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500 font-mono text-base"
              />
            </div>

            <label className="flex items-center gap-3 p-3 bg-slate-900 border border-slate-800 rounded-xl cursor-pointer hover:border-slate-700 transition">
              <input
                id="input-sim-member"
                type="checkbox"
                checked={simIsMember}
                onChange={(e) => setSimIsMember(e.target.checked)}
                className="w-4 h-4 rounded text-indigo-600 bg-slate-800 border-slate-700 focus:ring-indigo-500"
              />
              <div>
                <span className="text-xs font-semibold text-white block">
                  Miembro de Sinagoga
                </span>
                <span className="text-[11px] text-slate-400">
                  {simIsMember ? 'Cumple condición comunitaria' : 'Aplica solo reglas generales'}
                </span>
              </div>
            </label>
          </div>

          {/* Resultado de la simulación */}
          <div className="md:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Resultado de Evaluación
                </span>
                {isCalculatingPreview && (
                  <RefreshCw className="w-3.5 h-3.5 text-indigo-400 animate-spin" />
                )}
              </div>

              {previewResult?.matchedRuleId ? (
                <div className="space-y-3">
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-black text-emerald-400 font-mono">
                      ${previewResult.price}
                    </span>
                    <span className="text-xs font-bold text-slate-400 uppercase">
                      {previewResult.currency}
                    </span>
                  </div>

                  <div className="space-y-1 text-xs">
                    <div className="text-slate-200">
                      Regla ganadora: <b className="text-white">{previewResult.ruleName}</b>
                    </div>
                    {previewResult.ticketType && (
                      <div className="text-slate-400">
                        Categoría: <span className="text-indigo-400 font-medium">{previewResult.ticketType}</span>
                      </div>
                    )}
                    <div className="text-[11px] text-slate-500 font-mono">
                      ID de Regla: {previewResult.matchedRuleId}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-amber-300">
                    <AlertTriangle className="w-4 h-4" />
                    <span>Sin regla aplicable (Resultado controlado)</span>
                  </div>
                  <p className="text-amber-400/90 text-[11px]">
                    {previewResult?.rejectionReason || 'No existe regla activa que coincida con los criterios.'}
                  </p>
                </div>
              )}
            </div>

            <div className="pt-3 mt-4 border-t border-slate-800 text-[11px] text-slate-500 flex items-center justify-between">
              <span>Frontend Preview Only — La confirmación oficial será en Cloud Functions</span>
              <span className="font-mono">SHIKKUM Pricing Engine</span>
            </div>
          </div>
        </div>
      </div>

      {/* Modal Crear / Editar Regla */}
      {isRuleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-150">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <h2 className="text-base font-bold text-white">
                {editingRule ? 'Editar Regla de Precio' : 'Nueva Regla de Precio'}
              </h2>
              <button
                onClick={() => setIsRuleModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitRule} className="p-6 space-y-4">
              {ruleFormError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-400 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{ruleFormError}</span>
                </div>
              )}

              {ruleFormWarning && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-400 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{ruleFormWarning}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Nombre Descriptivo de la Regla <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={ruleFormData.name}
                  onChange={(e) => setRuleFormData({ ...ruleFormData, name: e.target.value })}
                  placeholder="Ej. Niño, Adulto Miembro, Senior..."
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Edad Mínima (Años) <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={ruleFormData.minAge}
                    onChange={(e) =>
                      setRuleFormData({ ...ruleFormData, minAge: Math.max(0, parseInt(e.target.value) || 0) })
                    }
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Edad Máxima (Dejar en blanco para sin límite)
                  </label>
                  <input
                    type="number"
                    min={ruleFormData.minAge}
                    value={ruleFormData.maxAge}
                    onChange={(e) => setRuleFormData({ ...ruleFormData, maxAge: e.target.value })}
                    placeholder="Ej. 17 (o vacío para ∞)"
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Precio (USD) <span className="text-rose-400">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                    <input
                      type="number"
                      required
                      min="0"
                      step="0.01"
                      value={ruleFormData.price}
                      onChange={(e) =>
                        setRuleFormData({ ...ruleFormData, price: Math.max(0, parseFloat(e.target.value) || 0) })
                      }
                      className="w-full pl-8 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500 font-mono font-bold"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Prioridad de Resolución <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    value={ruleFormData.priority}
                    onChange={(e) =>
                      setRuleFormData({ ...ruleFormData, priority: parseInt(e.target.value) || 0 })
                    }
                    placeholder="Mayor valor = gana en coincidencia"
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Categoría / Tipo de Ticket (Opcional)
                </label>
                <input
                  type="text"
                  value={ruleFormData.ticketType}
                  onChange={(e) => setRuleFormData({ ...ruleFormData, ticketType: e.target.value })}
                  placeholder="Ej. General, VIP, Infantil, Miembro Comunitario"
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="space-y-3 pt-2">
                <label className="flex items-center gap-3 p-3 bg-slate-950 border border-slate-800 rounded-xl cursor-pointer hover:border-slate-700 transition">
                  <input
                    type="checkbox"
                    checked={ruleFormData.communityMemberOnly}
                    onChange={(e) =>
                      setRuleFormData({ ...ruleFormData, communityMemberOnly: e.target.checked })
                    }
                    className="w-4 h-4 rounded text-indigo-600 bg-slate-900 border-slate-700 focus:ring-indigo-500"
                  />
                  <div>
                    <span className="text-xs font-semibold text-white block">
                      Exclusivo para Miembros de la Sinagoga
                    </span>
                    <span className="text-[11px] text-slate-400">
                      Solo aplicará si el asistente o comprador es miembro verificado de la comunidad.
                    </span>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3 bg-slate-950 border border-slate-800 rounded-xl cursor-pointer hover:border-slate-700 transition">
                  <input
                    type="checkbox"
                    checked={ruleFormData.isActive}
                    onChange={(e) => setRuleFormData({ ...ruleFormData, isActive: e.target.checked })}
                    className="w-4 h-4 rounded text-emerald-600 bg-slate-900 border-slate-700 focus:ring-emerald-500"
                  />
                  <div>
                    <span className="text-xs font-semibold text-white block">
                      Regla Activa
                    </span>
                    <span className="text-[11px] text-slate-400">
                      Habilitada para ser evaluada por el motor de precios.
                    </span>
                  </div>
                </label>
              </div>

              <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsRuleModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingRule}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-600/20 transition disabled:opacity-50"
                >
                  {isSubmittingRule ? 'Guardando...' : editingRule ? 'Actualizar Regla' : 'Crear Regla'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
