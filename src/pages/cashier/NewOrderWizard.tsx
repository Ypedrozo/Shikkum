import React, { useState, useEffect, useMemo } from 'react';
import {
  User,
  Calendar,
  Users,
  CheckCircle2,
  AlertCircle,
  Search,
  Plus,
  Trash2,
  ArrowRight,
  ArrowLeft,
  DollarSign,
  ShieldCheck,
  Check,
  Clock,
  MapPin,
  RefreshCw,
  FileText
} from 'lucide-react';
import { Customer, Event, AttendeeInput } from '../../types';
import { customerService } from '../../services/customer.service';
import { eventService } from '../../services/event.service';
import { pricingService } from '../../services/pricing.service';
import { orderService } from '../../services/order.service';

export interface NewOrderWizardProps {
  onNavigate?: (path: string) => void;
  baseRolePath?: '/cashier' | '/admin';
  onOrderCreated?: (orderId: string) => void;
  onCancel?: () => void;
}

export const NewOrderWizard: React.FC<NewOrderWizardProps> = ({
  onNavigate,
  baseRolePath = '/cashier',
  onOrderCreated,
  onCancel
}) => {
  // Pasos del Wizard: 1: Cliente, 2: Evento, 3: Asistentes, 4: Revisión de Precios, 5: Confirmado
  const [currentStep, setCurrentStep] = useState<number>(1);

  // Datos del Paso 1: Clientes
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoadingCustomers, setIsLoadingCustomers] = useState<boolean>(true);
  const [customerSearch, setCustomerSearch] = useState<string>('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  // Datos del Paso 2: Eventos
  const [events, setEvents] = useState<Event[]>([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState<boolean>(false);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);

  // Datos del Paso 3: Asistentes
  const [attendees, setAttendees] = useState<AttendeeInput[]>([
    { fullName: '', ageAtPurchase: 25, isCommunityMemberAtPurchase: false }
  ]);

  // Datos del Paso 4: Previsualización de Precios
  const [isLoadingRules, setIsLoadingRules] = useState<boolean>(false);
  const [calculatedPreview, setCalculatedPreview] = useState<
    Array<{
      fullName: string;
      age: number;
      isMember: boolean;
      matchedRuleName: string | null;
      matchedRuleId: string | null;
      unitPrice: number | null;
      errorReason?: string;
    }>
  >([]);

  // Estados de Envío y Confirmación
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [confirmedOrderData, setConfirmedOrderData] = useState<{
    orderId: string;
    orderCode: string;
    total: number;
    subtotal: number;
    status: string;
    customerName: string;
    eventTitle: string;
    attendeeCount: number;
  } | null>(null);

  // Token de idempotencia único generado para este intento
  const [requestId, setRequestId] = useState<string>(() => `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`);

  // Cargar lista de clientes
  useEffect(() => {
    let mounted = true;
    const loadCustomers = async () => {
      try {
        setIsLoadingCustomers(true);
        const list = await customerService.getCustomers();
        if (mounted) {
          setCustomers(list);
        }
      } catch (err: any) {
        if (mounted) setErrorMessage(err.message || 'Error al cargar clientes.');
      } finally {
        if (mounted) setIsLoadingCustomers(false);
      }
    };
    loadCustomers();
    return () => {
      mounted = false;
    };
  }, []);

  // Cargar lista de eventos activos
  useEffect(() => {
    let mounted = true;
    const loadEvents = async () => {
      try {
        setIsLoadingEvents(true);
        const list = await eventService.getEvents();
        // REGLA CRÍTICA: Solo mostrar eventos ACTIVE
        const activeOnly = list.filter((e) => e.status === 'ACTIVE');
        if (mounted) {
          setEvents(activeOnly);
        }
      } catch (err: any) {
        if (mounted) setErrorMessage(err.message || 'Error al cargar eventos.');
      } finally {
        if (mounted) setIsLoadingEvents(false);
      }
    };
    loadEvents();
    return () => {
      mounted = false;
    };
  }, []);

  // Cuando se selecciona un cliente, sincronizar el primer asistente por conveniencia si está vacío
  const handleSelectCustomer = (customer: Customer) => {
    if (!customer.isActive) {
      return; // No permitir clientes inactivos
    }
    setSelectedCustomer(customer);
    setAttendees((prev) => {
      if (prev.length === 1 && prev[0].fullName.trim() === '') {
        return [
          {
            fullName: customer.fullName,
            ageAtPurchase: 25,
            isCommunityMemberAtPurchase: customer.isCommunityMember
          }
        ];
      }
      return prev;
    });
    setErrorMessage(null);
  };

  // Clientes filtrados por búsqueda
  const filteredCustomers = useMemo(() => {
    if (!customerSearch.trim()) return customers;
    const term = customerSearch.toLowerCase();
    return customers.filter(
      (c) =>
        c.fullName.toLowerCase().includes(term) ||
        c.email.toLowerCase().includes(term) ||
        (c.documentId && c.documentId.toLowerCase().includes(term)) ||
        (c.phone && c.phone.toLowerCase().includes(term))
    );
  }, [customers, customerSearch]);

  // Manejo de Asistentes
  const handleAddAttendee = () => {
    setAttendees((prev) => [
      ...prev,
      {
        fullName: '',
        ageAtPurchase: 20,
        isCommunityMemberAtPurchase: selectedCustomer?.isCommunityMember || false
      }
    ]);
  };

  const handleRemoveAttendee = (index: number) => {
    if (attendees.length <= 1) return;
    setAttendees((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpdateAttendee = (
    index: number,
    field: keyof AttendeeInput,
    value: string | number | boolean
  ) => {
    setAttendees((prev) => {
      const copy = [...prev];
      copy[index] = {
        ...copy[index],
        [field]: value
      };
      return copy;
    });
  };

  // Cargar reglas y previsualizar precios cuando se avanza al paso 4
  useEffect(() => {
    if (currentStep === 4 && selectedEvent) {
      let isCurrent = true;
      const calculatePreview = async () => {
        setIsLoadingRules(true);
        setErrorMessage(null);
        try {
          const rules = await pricingService.getRulesByEventId(selectedEvent.id, true);
          if (!isCurrent) return;

          // Calcular previsualización individual para cada asistente
          const previewResults = attendees.map((att) => {
            const age = Math.floor(Number(att.ageAtPurchase) || 0);
            const isMember = Boolean(att.isCommunityMemberAtPurchase);

            const eligible = rules.filter((r) => {
              const matchesMin = age >= r.minAge;
              const matchesMax = r.maxAge === null || r.maxAge === undefined || age <= r.maxAge;
              if (!matchesMin || !matchesMax) return false;
              if (!isMember && r.communityMemberOnly) return false;
              return true;
            });

            if (eligible.length === 0) {
              return {
                fullName: att.fullName,
                age,
                isMember,
                matchedRuleName: null,
                matchedRuleId: null,
                unitPrice: null,
                errorReason: 'No hay regla de precio que cubra esta edad y condición'
              };
            }

            // Desempate: prioridad desc, especificidad comunitaria desc, precio asc
            eligible.sort((a, b) => {
              if (b.priority !== a.priority) return b.priority - a.priority;
              if (a.communityMemberOnly !== b.communityMemberOnly) {
                return a.communityMemberOnly ? -1 : 1;
              }
              return a.price - b.price;
            });

            const top = eligible[0];
            return {
              fullName: att.fullName,
              age,
              isMember,
              matchedRuleName: top.name,
              matchedRuleId: top.id,
              unitPrice: top.price
            };
          });

          setCalculatedPreview(previewResults);
        } catch (err: any) {
          if (isCurrent) setErrorMessage(err.message || 'Error al calcular previsualización.');
        } finally {
          if (isCurrent) setIsLoadingRules(false);
        }
      };

      calculatePreview();
      return () => {
        isCurrent = false;
      };
    }
  }, [currentStep, selectedEvent, attendees]);

  // Totales de la previsualización
  const previewTotals = useMemo(() => {
    let total = 0;
    let hasError = false;

    calculatedPreview.forEach((p) => {
      if (p.unitPrice === null) {
        hasError = true;
      } else {
        total += p.unitPrice;
      }
    });

    return {
      subtotal: total,
      total,
      hasError
    };
  }, [calculatedPreview]);

  // Confirmación Definitiva de la Orden
  const handleConfirmOrder = async () => {
    if (isSubmitting) return; // Protección contra doble clic
    if (!selectedCustomer) {
      setErrorMessage('Debe seleccionar un cliente titular.');
      return;
    }
    if (!selectedEvent) {
      setErrorMessage('Debe seleccionar un evento.');
      return;
    }
    if (attendees.length === 0) {
      setErrorMessage('Debe incluir al menos un asistente.');
      return;
    }
    if (previewTotals.hasError) {
      setErrorMessage('Hay asistentes que no disponen de una regla de precio aplicable. Ajuste las edades o reglas.');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage(null);

      const requestPayload = {
        requestId,
        customerId: selectedCustomer.id,
        eventId: selectedEvent.id,
        attendees: attendees.map((a) => ({
          fullName: a.fullName.trim(),
          ageAtPurchase: Math.floor(Number(a.ageAtPurchase)),
          isCommunityMemberAtPurchase: Boolean(a.isCommunityMemberAtPurchase),
          ticketType: a.ticketType
        }))
      };

      const response = await orderService.createOrder(requestPayload);

      setConfirmedOrderData({
        orderId: response.orderId,
        orderCode: response.orderCode,
        subtotal: response.subtotal,
        total: response.total,
        status: response.status,
        customerName: selectedCustomer.fullName,
        eventTitle: selectedEvent.title,
        attendeeCount: attendees.length
      });

      // Avanzar al paso final de confirmación
      setCurrentStep(5);
    } catch (err: any) {
      console.error('Error al confirmar orden:', err);
      setErrorMessage(err.message || 'Error al procesar la orden en el servidor.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Reiniciar formulario para una nueva orden
  const handleResetForNewOrder = () => {
    setSelectedCustomer(null);
    setSelectedEvent(null);
    setAttendees([{ fullName: '', ageAtPurchase: 25, isCommunityMemberAtPurchase: false }]);
    setCalculatedPreview([]);
    setConfirmedOrderData(null);
    setErrorMessage(null);
    setRequestId(`req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`);
    setCurrentStep(1);
  };

  return (
    <div className="space-y-6">
      {/* Encabezado y Navegación del Wizard */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-6 mb-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full">
                Cobranzas
              </span>
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                Nueva Orden de Venta
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Registro de clientes, selección de evento, configuración de asistentes y congelamiento inmutable de precios.
            </p>
          </div>

          <button
            onClick={() => {
              if (onCancel) {
                onCancel();
              } else if (onNavigate) {
                onNavigate(`${baseRolePath}/orders`);
              }
            }}
            className="self-start md:self-auto px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl border border-slate-700 transition flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Volver a Órdenes</span>
          </button>
        </div>

        {/* Indicador de Pasos Visual */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {[
            { num: 1, label: 'Cliente', icon: User },
            { num: 2, label: 'Evento', icon: Calendar },
            { num: 3, label: 'Asistentes', icon: Users },
            { num: 4, label: 'Precios', icon: DollarSign },
            { num: 5, label: 'Confirmación', icon: CheckCircle2 }
          ].map((s) => {
            const isCompleted = currentStep > s.num;
            const isCurrent = currentStep === s.num;
            return (
              <div
                key={s.num}
                className={`flex items-center gap-2.5 p-2.5 rounded-xl border transition ${
                  isCurrent
                    ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-300'
                    : isCompleted
                    ? 'bg-slate-900 border-slate-700 text-slate-300'
                    : 'bg-slate-950/40 border-slate-800/80 text-slate-500'
                }`}
              >
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                    isCurrent
                      ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                      : isCompleted
                      ? 'bg-slate-700 text-emerald-400'
                      : 'bg-slate-800 text-slate-500'
                  }`}
                >
                  {isCompleted ? <Check className="w-4 h-4" /> : s.num}
                </div>
                <div className="truncate">
                  <div className="flex items-center gap-1">
                    <s.icon className="w-3 h-3 opacity-70" />
                    <span className="text-xs font-bold block truncate">{s.label}</span>
                  </div>
                  <span className="text-[10px] text-slate-500">Paso {s.num}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Alerta de Error si ocurre */}
      {errorMessage && (
        <div className="p-4 bg-red-950/50 border border-red-800/80 rounded-xl text-red-200 text-sm flex items-start gap-3 shadow-lg">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-bold">Atención:</span> {errorMessage}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PASO 1: SELECCIONAR CLIENTE TITULAR */}
      {/* ========================================================================= */}
      {currentStep === 1 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <User className="w-5 h-5 text-emerald-400" />
                <span>Paso 1: Seleccionar Cliente Titular</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Busque el cliente registrado responsable de la orden. Solo se permiten clientes activos.
              </p>
            </div>

            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
                placeholder="Buscar por nombre, cédula, teléfono..."
                className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Tarjeta del cliente seleccionado */}
          {selectedCustomer && (
            <div className="bg-emerald-950/20 border border-emerald-500/30 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-emerald-600/30 text-emerald-400 flex items-center justify-center font-bold text-lg border border-emerald-500/40">
                  {selectedCustomer.fullName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white text-sm">{selectedCustomer.fullName}</span>
                    {selectedCustomer.isCommunityMember && (
                      <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-full">
                        Miembro de Comunidad
                      </span>
                    )}
                    <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full">
                      Cliente Activo
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {selectedCustomer.email} {selectedCustomer.phone && `• Tel: ${selectedCustomer.phone}`}{' '}
                    {selectedCustomer.documentId && `• Doc: ${selectedCustomer.documentId}`}
                  </p>
                </div>
              </div>

              <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5 self-end sm:self-center">
                <CheckCircle2 className="w-4 h-4" /> Cliente Seleccionado
              </span>
            </div>
          )}

          {/* Listado de Clientes con estado */}
          {isLoadingCustomers ? (
            <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
              <RefreshCw className="w-6 h-6 animate-spin text-emerald-400" />
              <span className="text-xs">Cargando base de datos de clientes...</span>
            </div>
          ) : filteredCustomers.length === 0 ? (
            <div className="py-12 text-center text-slate-500 border border-dashed border-slate-800 rounded-xl p-6">
              <User className="w-8 h-8 mx-auto mb-2 opacity-40 text-slate-400" />
              <p className="text-sm font-semibold text-slate-400">No se encontraron clientes</p>
              <p className="text-xs text-slate-500 mt-1">
                Verifique los términos de búsqueda o registre un nuevo cliente en el módulo de Clientes.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-96 overflow-y-auto pr-1">
              {filteredCustomers.map((customer) => {
                const isSelected = selectedCustomer?.id === customer.id;
                const isInactive = !customer.isActive;

                return (
                  <div
                    key={customer.id}
                    onClick={() => {
                      if (!isInactive) handleSelectCustomer(customer);
                    }}
                    className={`p-4 rounded-xl border text-left transition flex items-start justify-between gap-3 ${
                      isInactive
                        ? 'bg-slate-950/40 border-slate-800/60 opacity-60 cursor-not-allowed'
                        : isSelected
                        ? 'bg-emerald-950/40 border-emerald-500/80 shadow-md shadow-emerald-950/40 cursor-pointer'
                        : 'bg-slate-950/80 border-slate-800 hover:border-slate-700 hover:bg-slate-800/50 cursor-pointer'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-slate-100 truncate">
                          {customer.fullName}
                        </span>
                        {customer.isCommunityMember && (
                          <span className="px-1.5 py-0.5 text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded">
                            Comunidad
                          </span>
                        )}
                        {isInactive && (
                          <span className="px-1.5 py-0.5 text-[9px] font-bold bg-red-500/20 text-red-400 border border-red-500/30 rounded">
                            Inactivo (Bloqueado)
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-slate-400 mt-1 truncate">{customer.email}</p>
                      <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-1">
                        {customer.documentId && <span>Doc: {customer.documentId}</span>}
                        {customer.phone && <span>Tel: {customer.phone}</span>}
                      </div>

                      {isInactive && (
                        <p className="text-[11px] text-red-400/90 mt-1.5 flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5" /> No puede registrar compras estando inactivo.
                        </p>
                      )}
                    </div>

                    <div className="shrink-0 mt-0.5">
                      {isSelected ? (
                        <div className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center">
                          <Check className="w-3.5 h-3.5" />
                        </div>
                      ) : (
                        <div className="w-6 h-6 rounded-full border border-slate-700" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Acciones del Paso 1 */}
          <div className="flex justify-end pt-4 border-t border-slate-800/80">
            <button
              onClick={() => {
                if (!selectedCustomer) {
                  setErrorMessage('Debe seleccionar un cliente antes de continuar.');
                  return;
                }
                setErrorMessage(null);
                setCurrentStep(2);
              }}
              disabled={!selectedCustomer}
              className={`px-6 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition ${
                selectedCustomer
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/30'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
              }`}
            >
              <span>Continuar al Evento</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PASO 2: SELECCIONAR EVENTO (ÚNICAMENTE ACTIVOS) */}
      {/* ========================================================================= */}
      {currentStep === 2 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Calendar className="w-5 h-5 text-emerald-400" />
                <span>Paso 2: Seleccionar Evento Activo</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Solo se muestran eventos con estado ACTIVE habilitados para venta.
              </p>
            </div>

            {selectedCustomer && (
              <div className="text-xs text-slate-400 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800">
                Cliente: <span className="font-bold text-slate-200">{selectedCustomer.fullName}</span>
              </div>
            )}
          </div>

          {isLoadingEvents ? (
            <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
              <RefreshCw className="w-6 h-6 animate-spin text-emerald-400" />
              <span className="text-xs">Cargando eventos activos...</span>
            </div>
          ) : events.length === 0 ? (
            <div className="py-12 text-center text-slate-500 border border-dashed border-slate-800 rounded-xl p-6">
              <Calendar className="w-8 h-8 mx-auto mb-2 opacity-40 text-slate-400" />
              <p className="text-sm font-semibold text-slate-400">No hay eventos activos en venta</p>
              <p className="text-xs text-slate-500 mt-1">
                El Administrador debe crear y publicar eventos con estado ACTIVE.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {events.map((ev) => {
                const isSelected = selectedEvent?.id === ev.id;
                return (
                  <div
                    key={ev.id}
                    onClick={() => {
                      setSelectedEvent(ev);
                      setErrorMessage(null);
                    }}
                    className={`p-5 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between gap-4 ${
                      isSelected
                        ? 'bg-emerald-950/40 border-emerald-500/80 shadow-md shadow-emerald-950/40'
                        : 'bg-slate-950/80 border-slate-800 hover:border-slate-700 hover:bg-slate-800/50'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full">
                          ACTIVO
                        </span>
                        <div className="shrink-0">
                          {isSelected ? (
                            <div className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center">
                              <Check className="w-3.5 h-3.5" />
                            </div>
                          ) : (
                            <div className="w-6 h-6 rounded-full border border-slate-700" />
                          )}
                        </div>
                      </div>

                      <h3 className="text-base font-bold text-white mb-2">{ev.title}</h3>
                      {ev.description && (
                        <p className="text-xs text-slate-400 line-clamp-2 mb-3">{ev.description}</p>
                      )}

                      <div className="grid grid-cols-2 gap-2 text-xs text-slate-400">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                          <span>{ev.date}</span>
                        </div>
                        {ev.startTime && (
                          <div className="flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-emerald-400" />
                            <span>{ev.startTime}</span>
                          </div>
                        )}
                        {ev.venue && (
                          <div className="flex items-center gap-1.5 col-span-2">
                            <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            <span className="truncate">{ev.venue}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-500">
                      <span>Capacidad máxima: {ev.capacity || 'Ilimitada'}</span>
                      <span className="font-semibold text-slate-400">Seleccionar este evento</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Acciones del Paso 2 */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-800/80">
            <button
              onClick={() => setCurrentStep(1)}
              className="px-5 py-2.5 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Anterior</span>
            </button>

            <button
              onClick={() => {
                if (!selectedEvent) {
                  setErrorMessage('Debe seleccionar un evento activo.');
                  return;
                }
                setErrorMessage(null);
                setCurrentStep(3);
              }}
              disabled={!selectedEvent}
              className={`px-6 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition ${
                selectedEvent
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/30'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
              }`}
            >
              <span>Continuar a Asistentes</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PASO 3: REGISTRO DE ASISTENTES */}
      {/* ========================================================================= */}
      {currentStep === 3 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-emerald-400" />
                <span>Paso 3: Registrar Asistentes</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Indique los datos de cada persona que asistirá al evento para el cálculo de su tarifa correspondiente.
              </p>
            </div>

            <button
              onClick={handleAddAttendee}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-emerald-600/20 transition self-start sm:self-auto"
            >
              <Plus className="w-4 h-4" />
              <span>Agregar Asistente</span>
            </button>
          </div>

          {/* Resumen Superior de Evento y Cliente */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-slate-950 p-3.5 rounded-xl border border-slate-800">
            <div>
              <span className="text-slate-500 block text-[11px]">Cliente Titular:</span>
              <span className="font-bold text-white text-sm">{selectedCustomer?.fullName}</span>
              <span className="text-slate-400 block text-[11px] mt-0.5">
                {selectedCustomer?.isCommunityMember ? 'Miembro de Comunidad' : 'Público General'}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block text-[11px]">Evento Seleccionado:</span>
              <span className="font-bold text-emerald-400 text-sm">{selectedEvent?.title}</span>
              <span className="text-slate-400 block text-[11px] mt-0.5">
                Fecha: {selectedEvent?.date}
              </span>
            </div>
          </div>

          {/* Formulario Dinámico de Asistentes */}
          <div className="space-y-4">
            {attendees.map((attendee, index) => (
              <div
                key={index}
                className="bg-slate-950 border border-slate-800 rounded-xl p-4.5 space-y-4 relative hover:border-slate-700 transition"
              >
                <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-emerald-600/30 text-emerald-400 flex items-center justify-center font-bold text-xs border border-emerald-500/30">
                      {index + 1}
                    </span>
                    <span className="text-xs font-bold text-slate-200">
                      Asistente #{index + 1}
                    </span>
                  </div>

                  {attendees.length > 1 && (
                    <button
                      onClick={() => handleRemoveAttendee(index)}
                      className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition"
                      title="Eliminar este asistente"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
                  {/* Nombre Completo */}
                  <div className="sm:col-span-6 space-y-1">
                    <label className="block text-[11px] font-semibold text-slate-400">
                      Nombre Completo *
                    </label>
                    <input
                      type="text"
                      value={attendee.fullName}
                      onChange={(e) => handleUpdateAttendee(index, 'fullName', e.target.value)}
                      placeholder="Ej. Juan Pérez"
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  {/* Edad al momento de la compra */}
                  <div className="sm:col-span-3 space-y-1">
                    <label className="block text-[11px] font-semibold text-slate-400">
                      Edad al momento de compra *
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={120}
                      value={attendee.ageAtPurchase}
                      onChange={(e) =>
                        handleUpdateAttendee(
                          index,
                          'ageAtPurchase',
                          Math.max(0, parseInt(e.target.value, 10) || 0)
                        )
                      }
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  {/* Condición de Miembro de la Comunidad */}
                  <div className="sm:col-span-3 flex flex-col justify-end">
                    <label className="flex items-center gap-2 cursor-pointer bg-slate-900 border border-slate-800 px-3 py-2 rounded-xl hover:border-slate-700 transition">
                      <input
                        type="checkbox"
                        checked={attendee.isCommunityMemberAtPurchase}
                        onChange={(e) =>
                          handleUpdateAttendee(index, 'isCommunityMemberAtPurchase', e.target.checked)
                        }
                        className="rounded border-slate-700 text-emerald-600 focus:ring-emerald-500 bg-slate-800"
                      />
                      <span className="text-xs font-semibold text-slate-300 select-none">
                        Miembro Comunidad
                      </span>
                    </label>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Acciones del Paso 3 */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-800/80">
            <button
              onClick={() => setCurrentStep(2)}
              className="px-5 py-2.5 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Anterior</span>
            </button>

            <button
              onClick={() => {
                // Validar que todos los asistentes tengan nombre
                for (let i = 0; i < attendees.length; i++) {
                  if (!attendees[i].fullName.trim()) {
                    setErrorMessage(`El asistente #${i + 1} no tiene nombre completo.`);
                    return;
                  }
                  if (attendees[i].ageAtPurchase < 0) {
                    setErrorMessage(`La edad del asistente #${i + 1} no puede ser negativa.`);
                    return;
                  }
                }
                setErrorMessage(null);
                setCurrentStep(4);
              }}
              className="px-6 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/30 flex items-center gap-2 transition"
            >
              <span>Revisar y Calcular Precios</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PASO 4: REVISIÓN DE PRECIOS Y CONFIRMACIÓN */}
      {/* ========================================================================= */}
      {currentStep === 4 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-emerald-400" />
                <span>Paso 4: Previsualización y Revisión de Precios</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Revise la regla de precio asignada a cada asistente. Al confirmar la orden, estos importes quedarán
                congelados e inmutables en el snapshot histórico.
              </p>
            </div>

            <div className="text-xs bg-amber-500/10 border border-amber-500/20 text-amber-300 px-3 py-1.5 rounded-xl flex items-center gap-1.5 self-start sm:self-auto">
              <ShieldCheck className="w-4 h-4 text-amber-400" />
              <span>Congelamiento garantizado de precios</span>
            </div>
          </div>

          {/* Tabla de Asistentes y Precios Asignados */}
          {isLoadingRules ? (
            <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
              <RefreshCw className="w-6 h-6 animate-spin text-emerald-400" />
              <span className="text-xs">Consultando reglas activas y calculando tarifas...</span>
            </div>
          ) : (
            <div className="overflow-x-auto border border-slate-800 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">#</th>
                    <th className="py-3 px-4">Asistente</th>
                    <th className="py-3 px-4">Edad</th>
                    <th className="py-3 px-4">Comunidad</th>
                    <th className="py-3 px-4">Regla Aplicada</th>
                    <th className="py-3 px-4 text-right">Precio Unitario</th>
                    <th className="py-3 px-4 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 bg-slate-900/40">
                  {calculatedPreview.map((item, idx) => {
                    const hasError = item.unitPrice === null;
                    return (
                      <tr
                        key={idx}
                        className={`hover:bg-slate-800/40 transition ${
                          hasError ? 'bg-red-950/20' : ''
                        }`}
                      >
                        <td className="py-3.5 px-4 font-bold text-slate-500">{idx + 1}</td>
                        <td className="py-3.5 px-4 font-bold text-slate-200">{item.fullName}</td>
                        <td className="py-3.5 px-4 text-slate-400">{item.age} años</td>
                        <td className="py-3.5 px-4">
                          {item.isMember ? (
                            <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded">
                              Sí
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 text-[10px] font-semibold bg-slate-800 text-slate-400 rounded">
                              No
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          {hasError ? (
                            <span className="text-red-400 font-bold flex items-center gap-1">
                              <AlertCircle className="w-3.5 h-3.5" />
                              {item.errorReason || 'Sin regla aplicable'}
                            </span>
                          ) : (
                            <span className="font-semibold text-emerald-400">{item.matchedRuleName}</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono text-slate-300">
                          {hasError ? '—' : `$${item.unitPrice?.toFixed(2)} USD`}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono font-bold text-white">
                          {hasError ? '—' : `$${item.unitPrice?.toFixed(2)} USD`}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Tarjeta de Resumen Financiero */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="space-y-1 text-xs text-slate-400">
              <p>
                <span className="text-slate-500">Cliente Titular:</span>{' '}
                <span className="font-bold text-white">{selectedCustomer?.fullName}</span>
              </p>
              <p>
                <span className="text-slate-500">Evento:</span>{' '}
                <span className="font-bold text-emerald-400">{selectedEvent?.title}</span>
              </p>
              <p>
                <span className="text-slate-500">Cantidad de Asistentes:</span>{' '}
                <span className="font-bold text-slate-200">{attendees.length}</span>
              </p>
            </div>

            <div className="w-full sm:w-auto text-right border-t sm:border-t-0 border-slate-800 pt-3 sm:pt-0">
              <span className="text-xs text-slate-400 block">Total a Pagar (USD)</span>
              <span className="text-2xl sm:text-3xl font-black text-white font-mono">
                ${previewTotals.total.toFixed(2)}
              </span>
              <span className="text-[11px] text-slate-500 block mt-0.5">
                Estado inicial: <span className="text-amber-400 font-semibold">Pendiente de pago</span>
              </span>
            </div>
          </div>

          {/* Acciones del Paso 4 */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-800/80">
            <button
              onClick={() => setCurrentStep(3)}
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition flex items-center gap-2 disabled:opacity-50"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Modificar Asistentes</span>
            </button>

            <button
              onClick={handleConfirmOrder}
              disabled={isSubmitting || previewTotals.hasError}
              className={`px-7 py-3 rounded-xl text-xs font-extrabold flex items-center gap-2.5 transition shadow-xl ${
                isSubmitting || previewTotals.hasError
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30'
              }`}
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Procesando orden en servidor...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Confirmar Orden (${previewTotals.total.toFixed(2)} USD)</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PASO 5: RESULTADO DE CONFIRMACIÓN */}
      {/* ========================================================================= */}
      {currentStep === 5 && confirmedOrderData && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl space-y-6 text-center max-w-2xl mx-auto">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/30 shadow-lg shadow-emerald-950/50">
            <CheckCircle2 className="w-9 h-9" />
          </div>

          <div>
            <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-amber-500/20 text-amber-400 border border-amber-500/30 uppercase tracking-wider inline-block mb-3">
              Pendiente de Pago
            </span>
            <h2 className="text-2xl font-black text-white tracking-tight">
              ¡Orden Registrada Correctamente!
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-2">
              Los asistentes y sus precios han sido congelados con éxito en la base de datos con snapshots históricos inmutables.
            </p>
          </div>

          {/* Tarjeta de Información de la Orden Registrada */}
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 text-left space-y-4 font-sans">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
              <span className="text-xs text-slate-500 font-medium">Código de Orden:</span>
              <span className="text-sm font-mono font-black text-emerald-400 tracking-wider">
                {confirmedOrderData.orderCode}
              </span>
            </div>

            <div className="flex items-center justify-between pb-3 border-b border-slate-800/80 text-xs">
              <span className="text-slate-500">Cliente Titular:</span>
              <span className="font-bold text-white">{confirmedOrderData.customerName}</span>
            </div>

            <div className="flex items-center justify-between pb-3 border-b border-slate-800/80 text-xs">
              <span className="text-slate-500">Evento:</span>
              <span className="font-bold text-white">{confirmedOrderData.eventTitle}</span>
            </div>

            <div className="flex items-center justify-between pb-3 border-b border-slate-800/80 text-xs">
              <span className="text-slate-500">Asistentes Registrados:</span>
              <span className="font-bold text-white">{confirmedOrderData.attendeeCount}</span>
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-xs font-bold text-slate-400">Total Congelado:</span>
              <span className="text-2xl font-black font-mono text-white">
                ${confirmedOrderData.total.toFixed(2)} USD
              </span>
            </div>
          </div>

          <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl text-xs text-slate-400 text-left flex items-start gap-3">
            <FileText className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-slate-200">Próxima Etapa:</span> La orden se encuentra en estado{' '}
              <strong className="text-amber-400">Pendiente de pago</strong>. En las siguientes fases se integrará
              el cobro, generación criptográfica de boletos QR y envío automático por correo electrónico.
            </div>
          </div>

          {/* Botones de Acción */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <button
              onClick={() => {
                if (onOrderCreated) {
                  onOrderCreated(confirmedOrderData.orderId);
                } else if (onNavigate) {
                  onNavigate(`${baseRolePath}/orders/${confirmedOrderData.orderId}`);
                }
              }}
              className="w-full sm:w-auto px-6 py-3 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 transition"
            >
              Ver Detalle de la Orden
            </button>

            <button
              onClick={handleResetForNewOrder}
              className="w-full sm:w-auto px-6 py-3 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/30 transition flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>Registrar Nueva Orden</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
