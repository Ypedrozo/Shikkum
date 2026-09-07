import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar,
  Search,
  Plus,
  Edit2,
  MapPin,
  Users,
  Ticket,
  AlertCircle,
  RefreshCw,
  ChevronRight,
  X,
  ArrowUpDown
} from 'lucide-react';
import { Event, EventStatus } from '../../types';
import { eventService } from '../../services/event.service';
import { useAuth } from '../../context/AuthContext';

interface EventsPageProps {
  onNavigate: (path: string) => void;
}

export const EventsPage: React.FC<EventsPageProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Filtros y ordenamiento
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<EventStatus | 'ALL'>('ALL');
  const [sortByDate, setSortByDate] = useState<'asc' | 'desc'>('asc');

  // Modal Crear / Editar Evento
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    date: '',
    startTime: '',
    endTime: '',
    venue: '',
    capacity: '',
    status: 'DRAFT' as EventStatus
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const loadEvents = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const data = await eventService.getEvents();
      setEvents(data);
    } catch {
      setErrorMessage('No fue posible cargar el catálogo de eventos.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadEvents();
  }, []);

  // Filtrado y ordenamiento reactivo
  const filteredEvents = useMemo(() => {
    const cleanTerm = searchTerm.trim().toLowerCase();
    const filtered = events.filter((evt) => {
      if (statusFilter !== 'ALL' && evt.status !== statusFilter) return false;
      if (!cleanTerm) return true;

      const matchTitle = evt.title.toLowerCase().includes(cleanTerm);
      const matchVenue = evt.venue ? evt.venue.toLowerCase().includes(cleanTerm) : false;
      const matchDesc = evt.description ? evt.description.toLowerCase().includes(cleanTerm) : false;

      return matchTitle || matchVenue || matchDesc;
    });

    return filtered.sort((a, b) => {
      const timeA = new Date(a.date).getTime();
      const timeB = new Date(b.date).getTime();
      return sortByDate === 'asc' ? timeA - timeB : timeB - timeA;
    });
  }, [events, searchTerm, statusFilter, sortByDate]);

  // Abrir modal de creación
  const handleOpenCreateModal = () => {
    setEditingEvent(null);
    setFormData({
      title: '',
      description: '',
      date: new Date().toISOString().split('T')[0],
      startTime: '18:00',
      endTime: '22:00',
      venue: '',
      capacity: '200',
      status: 'DRAFT'
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  // Abrir modal de edición
  const handleOpenEditModal = (evt: Event, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingEvent(evt);
    setFormData({
      title: evt.title,
      description: evt.description || '',
      date: evt.date,
      startTime: evt.startTime || '',
      endTime: evt.endTime || '',
      venue: evt.venue || '',
      capacity: evt.capacity !== undefined ? String(evt.capacity) : '',
      status: evt.status
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  // Guardar evento
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const validation = eventService.validateEvent({
      title: formData.title,
      date: formData.date,
      capacity: formData.capacity ? Number(formData.capacity) : undefined,
      status: formData.status
    });

    if (!validation.isValid) {
      setFormError(validation.error || 'Datos no válidos.');
      return;
    }

    setIsSubmitting(true);
    try {
      const operatorUid = user?.uid || 'usr_admin';

      if (editingEvent) {
        const updated = await eventService.updateEvent(
          editingEvent.id,
          {
            title: formData.title,
            description: formData.description || undefined,
            date: formData.date,
            startTime: formData.startTime || undefined,
            endTime: formData.endTime || undefined,
            venue: formData.venue || undefined,
            capacity: formData.capacity ? Number(formData.capacity) : undefined,
            status: formData.status
          },
          operatorUid
        );

        setEvents((prev) =>
          prev.map((e) => (e.id === updated.id ? updated : e))
        );
      } else {
        const created = await eventService.createEvent(
          {
            title: formData.title,
            description: formData.description || undefined,
            date: formData.date,
            startTime: formData.startTime || undefined,
            endTime: formData.endTime || undefined,
            venue: formData.venue || undefined,
            capacity: formData.capacity ? Number(formData.capacity) : undefined,
            status: formData.status
          },
          operatorUid
        );

        setEvents((prev) => [created, ...prev]);
      }

      setIsModalOpen(false);
    } catch (err: any) {
      setFormError(err.message || 'Error al guardar el evento.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Cambio rápido de estado
  const handleQuickStatusChange = async (
    evt: Event,
    newStatus: EventStatus,
    e: React.MouseEvent
  ) => {
    e.stopPropagation();
    try {
      const operatorUid = user?.uid || 'usr_admin';
      const updated = await eventService.setEventStatus(evt.id, newStatus, operatorUid);
      setEvents((prev) =>
        prev.map((item) => (item.id === updated.id ? updated : item))
      );
    } catch {
      alert('Error al actualizar el estado del evento.');
    }
  };

  const getStatusBadge = (status: EventStatus) => {
    switch (status) {
      case 'DRAFT':
        return (
          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            DRAFT (Borrador)
          </span>
        );
      case 'ACTIVE':
        return (
          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            ACTIVE (En Ventas)
          </span>
        );
      case 'CLOSED':
        return (
          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
            CLOSED (Cerrado)
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
            CANCELLED (Cancelado)
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="p-2 bg-indigo-600/10 text-indigo-400 border border-indigo-500/20 rounded-xl">
                <Calendar className="w-5 h-5" />
              </span>
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-400">
                Gestión de Eventos
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Eventos
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Administración de fechas, aforos, estados operativos y asignación de reglas de precios.
            </p>
          </div>

          <button
            id="btn-create-event"
            onClick={handleOpenCreateModal}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-indigo-600/20 transition self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Crear Evento</span>
          </button>
        </div>

        {/* Filtros y Controles */}
        <div className="mt-6 pt-6 border-t border-slate-800/80 flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar evento por título, lugar o descripción..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filtro de Estado */}
          <div className="flex flex-wrap items-center gap-1 bg-slate-950/80 p-1 rounded-xl border border-slate-800 self-start">
            <button
              onClick={() => setStatusFilter('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                statusFilter === 'ALL' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Todos ({events.length})
            </button>
            <button
              onClick={() => setStatusFilter('ACTIVE')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                statusFilter === 'ACTIVE' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Activos ({events.filter((e) => e.status === 'ACTIVE').length})
            </button>
            <button
              onClick={() => setStatusFilter('DRAFT')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                statusFilter === 'DRAFT' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Borrador ({events.filter((e) => e.status === 'DRAFT').length})
            </button>
            <button
              onClick={() => setStatusFilter('CLOSED')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                statusFilter === 'CLOSED' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Cerrados ({events.filter((e) => e.status === 'CLOSED').length})
            </button>
          </div>

          {/* Ordenar por fecha */}
          <button
            onClick={() => setSortByDate((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-950/80 border border-slate-800 hover:border-slate-700 rounded-xl text-xs text-slate-300 transition self-start"
            title="Cambiar orden de fecha"
          >
            <ArrowUpDown className="w-3.5 h-3.5 text-indigo-400" />
            <span>Fecha {sortByDate === 'asc' ? '(Próximos primero)' : '(Lejanos primero)'}</span>
          </button>
        </div>
      </div>

      {/* Listado de Eventos */}
      {isLoading ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center">
          <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin mx-auto mb-3" />
          <p className="text-sm text-slate-300 font-medium">Cargando eventos...</p>
        </div>
      ) : errorMessage ? (
        <div className="bg-rose-950/30 border border-rose-800/50 rounded-2xl p-8 text-center">
          <AlertCircle className="w-8 h-8 text-rose-400 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-rose-300 mb-1">Error</h3>
          <p className="text-xs text-rose-400/80 max-w-md mx-auto mb-4">{errorMessage}</p>
          <button
            onClick={loadEvents}
            className="inline-flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-semibold"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Reintentar</span>
          </button>
        </div>
      ) : filteredEvents.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center">
          <Calendar className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-bold text-white mb-1">
            {searchTerm || statusFilter !== 'ALL'
              ? 'No se encontraron eventos coincidentes'
              : 'No existen eventos registrados.'}
          </h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto mb-6">
            {searchTerm || statusFilter !== 'ALL'
              ? 'Ajuste los criterios de búsqueda o cambie el filtro de estado.'
              : 'Empiece creando el primer evento para asociar reglas de precios.'}
          </p>
          {!searchTerm && statusFilter === 'ALL' && (
            <button
              onClick={handleOpenCreateModal}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-lg transition"
            >
              <Plus className="w-4 h-4" />
              <span>Crear primer evento</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredEvents.map((evt) => (
            <div
              key={evt.id}
              onClick={() => onNavigate(`/admin/events/${evt.id}`)}
              className="bg-slate-900 border border-slate-800 hover:border-indigo-500/50 rounded-2xl p-6 shadow-xl hover:shadow-indigo-500/5 transition cursor-pointer flex flex-col justify-between group"
            >
              <div className="space-y-4">
                {/* Status & Actions */}
                <div className="flex items-center justify-between gap-2">
                  <div>{getStatusBadge(evt.status)}</div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => handleOpenEditModal(evt, e)}
                      title="Editar evento"
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Title and Description */}
                <div>
                  <h3 className="text-lg font-bold text-white group-hover:text-indigo-300 transition line-clamp-2">
                    {evt.title}
                  </h3>
                  {evt.description && (
                    <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                      {evt.description}
                    </p>
                  )}
                </div>

                {/* Details */}
                <div className="space-y-2 text-xs text-slate-300 bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-indigo-400 shrink-0" />
                    <span className="font-semibold text-white">{evt.date}</span>
                    {(evt.startTime || evt.endTime) && (
                      <span className="text-slate-400">
                        ({evt.startTime || ''} - {evt.endTime || ''})
                      </span>
                    )}
                  </div>

                  {evt.venue && (
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-slate-500 shrink-0" />
                      <span className="truncate">{evt.venue}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800">
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                      <Users className="w-3.5 h-3.5 text-slate-500" />
                      <span>Capacidad: <b className="text-slate-200">{evt.capacity ?? 'Ilimitada'}</b></span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                      <Ticket className="w-3.5 h-3.5 text-slate-500" />
                      <span>Vendidos: <b className="text-slate-200">{evt.ticketsSold}</b></span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer card with status quick switcher & link */}
              <div className="mt-5 pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs">
                {/* Selector rápido de estado */}
                <select
                  value={evt.status}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => handleQuickStatusChange(evt, e.target.value as EventStatus, e as any)}
                  className="bg-slate-950 border border-slate-800 text-[11px] font-semibold text-slate-300 rounded-lg px-2 py-1 focus:outline-none focus:border-indigo-500"
                >
                  <option value="DRAFT">Borrador</option>
                  <option value="ACTIVE">Activo</option>
                  <option value="CLOSED">Cerrado</option>
                  <option value="CANCELLED">Cancelado</option>
                </select>

                <span className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-400 group-hover:translate-x-0.5 transition">
                  <span>Reglas de precios</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Crear / Editar Evento */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-150">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <h2 className="text-base font-bold text-white">
                {editingEvent ? 'Editar Evento' : 'Crear Nuevo Evento'}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-400 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Título del Evento <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Ej. EVENTO DEMO — NO REAL: Shikkum 2026"
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Descripción (Opcional)
                </label>
                <textarea
                  rows={2}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Detalles sobre el acontecimiento, programa o restricciones..."
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                ></textarea>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Fecha <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Hora Inicio
                  </label>
                  <input
                    type="time"
                    value={formData.startTime}
                    onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Hora Fin
                  </label>
                  <input
                    type="time"
                    value={formData.endTime}
                    onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Lugar / Venue
                  </label>
                  <input
                    type="text"
                    value={formData.venue}
                    onChange={(e) => setFormData({ ...formData, venue: e.target.value })}
                    placeholder="Ej. Salón Principal de la Sinagoga"
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Capacidad (Opcional)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.capacity}
                    onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
                    placeholder="Ej. 250"
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Estado Operativo
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as EventStatus })}
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="DRAFT">DRAFT — En configuración (no visible en ventas)</option>
                  <option value="ACTIVE">ACTIVE — Activo (disponible para operaciones de Cobranzas)</option>
                  <option value="CLOSED">CLOSED — Cerrado para nuevas operaciones</option>
                  <option value="CANCELLED">CANCELLED — Cancelado</option>
                </select>
              </div>

              <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-600/20 transition disabled:opacity-50"
                >
                  {isSubmitting ? 'Guardando...' : editingEvent ? 'Actualizar Evento' : 'Crear Evento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
