import React, { useState, useEffect } from 'react';
import {
  DollarSign,
  Search,
  RefreshCw,
  AlertCircle,
  Calendar,
  BadgeCheck,
  CheckCircle2,
  XCircle,
  ArrowRight
} from 'lucide-react';
import { PriceRule, Event } from '../../types';
import { pricingService } from '../../services/pricing.service';
import { eventService } from '../../services/event.service';

interface PriceRulesPageProps {
  onNavigate: (path: string) => void;
}

export const PriceRulesPage: React.FC<PriceRulesPageProps> = ({ onNavigate }) => {
  const [rules, setRules] = useState<PriceRule[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Filtros
  const [selectedEventId, setSelectedEventId] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');

  const loadData = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const [rulesData, eventsData] = await Promise.all([
        pricingService.getAllRules(),
        eventService.getEvents()
      ]);
      setRules(rulesData);
      setEvents(eventsData);
    } catch {
      setErrorMessage('Error al sincronizar reglas de precio y eventos.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const getEventTitle = (eventId: string) => {
    const found = events.find((e) => e.id === eventId);
    return found ? found.title : eventId;
  };

  const filteredRules = rules.filter((r) => {
    if (selectedEventId !== 'ALL' && r.eventId !== selectedEventId) return false;
    if (statusFilter === 'ACTIVE' && !r.isActive) return false;
    if (statusFilter === 'INACTIVE' && r.isActive) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const matchName = r.name.toLowerCase().includes(term);
      const matchEvent = getEventTitle(r.eventId).toLowerCase().includes(term);
      if (!matchName && !matchEvent) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="p-2 bg-emerald-600/10 text-emerald-400 border border-emerald-500/20 rounded-xl">
                <DollarSign className="w-5 h-5" />
              </span>
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                Tarifario General
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Reglas de Precios
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Catálogo consolidado de tarifas por evento, rangos etarios y condiciones comunitarias.
            </p>
          </div>

          <button
            onClick={loadData}
            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition self-start sm:self-auto"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Actualizar</span>
          </button>
        </div>

        {/* Filtros */}
        <div className="mt-6 pt-6 border-t border-slate-800/80 flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar regla por nombre o evento..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
            />
          </div>

          {/* Filtro por Evento */}
          <select
            value={selectedEventId}
            onChange={(e) => setSelectedEventId(e.target.value)}
            className="px-3.5 py-2.5 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
          >
            <option value="ALL">Todos los Eventos ({events.length})</option>
            {events.map((e) => (
              <option key={e.id} value={e.id}>
                {e.title}
              </option>
            ))}
          </select>

          {/* Filtro de Estado */}
          <div className="flex items-center gap-1 bg-slate-950/80 p-1 rounded-xl border border-slate-800 self-start">
            <button
              onClick={() => setStatusFilter('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                statusFilter === 'ALL' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Todas ({rules.length})
            </button>
            <button
              onClick={() => setStatusFilter('ACTIVE')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                statusFilter === 'ACTIVE' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Activas ({rules.filter((r) => r.isActive).length})
            </button>
          </div>
        </div>
      </div>

      {/* Lista / Tabla de Reglas */}
      {isLoading ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center">
          <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin mx-auto mb-3" />
          <p className="text-sm text-slate-300 font-medium">Cargando reglas de precio...</p>
        </div>
      ) : errorMessage ? (
        <div className="bg-rose-950/30 border border-rose-800/50 rounded-2xl p-8 text-center">
          <AlertCircle className="w-8 h-8 text-rose-400 mx-auto mb-3" />
          <p className="text-xs text-rose-300 mb-3">{errorMessage}</p>
          <button
            onClick={loadData}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-semibold"
          >
            Reintentar
          </button>
        </div>
      ) : filteredRules.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center">
          <DollarSign className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-bold text-white mb-1">No se encontraron reglas de precio</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto mb-4">
            Para crear reglas de precio, ingrese a la gestión de un evento específico.
          </p>
          <button
            onClick={() => onNavigate('/admin/events')}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl"
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Ir a Eventos</span>
          </button>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-950/60 border-b border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="px-6 py-3.5">Regla / Categoría</th>
                  <th className="px-6 py-3.5">Evento Asociado</th>
                  <th className="px-6 py-3.5">Rango Edad</th>
                  <th className="px-6 py-3.5">Comunidad</th>
                  <th className="px-6 py-3.5">Precio USD</th>
                  <th className="px-6 py-3.5">Prioridad</th>
                  <th className="px-6 py-3.5">Estado</th>
                  <th className="px-6 py-3.5 text-right">Gestionar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-xs">
                {filteredRules.map((rule) => (
                  <tr key={rule.id} className="hover:bg-slate-800/40 transition">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-white">{rule.name}</div>
                      <div className="text-[11px] text-slate-400 font-mono mt-0.5">{rule.id}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-slate-300 font-medium max-w-xs truncate">
                        {getEventTitle(rule.eventId)}
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono">{rule.eventId}</div>
                    </td>
                    <td className="px-6 py-4 font-mono text-slate-300">
                      {rule.minAge} {rule.maxAge !== null ? `a ${rule.maxAge}` : '+'} años
                    </td>
                    <td className="px-6 py-4">
                      {rule.communityMemberOnly ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-400">
                          <BadgeCheck className="w-3.5 h-3.5" />
                          <span>Exclusivo Miembro</span>
                        </span>
                      ) : (
                        <span className="text-slate-400">General (Cualquiera)</span>
                      )}
                    </td>
                    <td className="px-6 py-4 font-mono font-bold text-emerald-400 text-sm">
                      ${rule.price}
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-300 font-mono text-[11px]">
                        P{rule.priority}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {rule.isActive ? (
                        <span className="inline-flex items-center gap-1 text-emerald-400 font-semibold">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Activa</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-slate-500">
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Inactiva</span>
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => onNavigate(`/admin/events/${rule.eventId}`)}
                        className="inline-flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 font-semibold"
                      >
                        <span>Ver en evento</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
