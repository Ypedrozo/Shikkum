import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from './firebase';
import { Event, EventStatus } from '../types';

const STORAGE_KEY = 'shikkum_events_store_v1';

// Datos iniciales de prueba claramente identificados como DEMO
const INITIAL_DEMO_EVENTS: Event[] = [
  {
    id: 'evt_demo_001',
    title: 'EVENTO DEMO — NO REAL: Gran Gala Shikkum 2026',
    description: 'Evento de demostración para verificar la gestión de eventos y reglas de precios.',
    date: '2026-10-15',
    startTime: '19:00',
    endTime: '23:30',
    venue: 'Salón Principal Comunitario',
    capacity: 250,
    status: 'ACTIVE',
    ticketsSold: 0,
    createdAt: '2026-09-01T12:00:00.000Z',
    updatedAt: '2026-09-01T12:00:00.000Z',
    createdBy: 'usr_admin_master_01',
    updatedBy: 'usr_admin_master_01'
  },
  {
    id: 'evt_demo_002',
    title: 'EVENTO DEMO — NO REAL: Taller Juvenil de Primavera',
    description: 'Encuentro juvenil educativo y cultural en borrador.',
    date: '2026-11-05',
    startTime: '16:00',
    endTime: '18:30',
    venue: 'Centro de Juventud',
    capacity: 80,
    status: 'DRAFT',
    ticketsSold: 0,
    createdAt: '2026-09-02T14:30:00.000Z',
    updatedAt: '2026-09-02T14:30:00.000Z',
    createdBy: 'usr_admin_master_01',
    updatedBy: 'usr_admin_master_01'
  },
  {
    id: 'evt_demo_003',
    title: 'EVENTO DEMO — NO REAL: Concierto de Invierno 2025',
    description: 'Evento histórico cerrado para verificar filtros de estado.',
    date: '2025-12-20',
    startTime: '20:00',
    endTime: '22:00',
    venue: 'Auditorio Central',
    capacity: 150,
    status: 'CLOSED',
    ticketsSold: 0,
    createdAt: '2025-11-01T08:00:00.000Z',
    updatedAt: '2025-12-21T00:00:00.000Z',
    createdBy: 'usr_admin_master_01',
    updatedBy: 'usr_admin_master_01'
  }
];

class EventService {
  private hasLiveFirebase(): boolean {
    return isFirebaseConfigured;
  }

  private getLocalEvents(): Event[] {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_DEMO_EVENTS));
        return INITIAL_DEMO_EVENTS;
      }
      return JSON.parse(saved);
    } catch {
      return INITIAL_DEMO_EVENTS;
    }
  }

  private saveLocalEvents(items: Event[]): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch (e) {
      console.error('Error guardando eventos locales', e);
    }
  }

  /**
   * Valida la entidad del evento
   */
  public validateEvent(data: Partial<Event>): { isValid: boolean; error?: string } {
    if (!data.title || data.title.trim().length < 3) {
      return { isValid: false, error: 'El título del evento es obligatorio y debe tener al menos 3 caracteres.' };
    }

    if (!data.date || !data.date.trim()) {
      return { isValid: false, error: 'La fecha del evento es obligatoria.' };
    }

    if (data.capacity !== undefined && data.capacity !== null) {
      if (Number.isNaN(Number(data.capacity)) || Number(data.capacity) < 0) {
        return { isValid: false, error: 'La capacidad debe ser un número entero mayor o igual a 0.' };
      }
    }

    const validStatuses: EventStatus[] = ['DRAFT', 'ACTIVE', 'CLOSED', 'CANCELLED'];
    if (data.status && !validStatuses.includes(data.status)) {
      return { isValid: false, error: 'El estado del evento no es válido.' };
    }

    return { isValid: true };
  }

  /**
   * Obtiene la lista completa de eventos
   */
  public async getEvents(): Promise<Event[]> {
    if (this.hasLiveFirebase()) {
      try {
        const colRef = collection(db, 'events');
        const snap = await getDocs(colRef);
        const list: Event[] = [];
        snap.forEach((docSnap) => {
          list.push({ id: docSnap.id, ...docSnap.data() } as Event);
        });
        if (list.length > 0) {
          return list;
        }
      } catch {
        // Fallback local
      }
    }

    return this.getLocalEvents();
  }

  /**
   * Obtiene un evento por ID
   */
  public async getEventById(id: string): Promise<Event | null> {
    if (this.hasLiveFirebase()) {
      try {
        const docRef = doc(db, 'events', id);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          return { id: snap.id, ...snap.data() } as Event;
        }
      } catch {
        // Fallback local
      }
    }

    const list = this.getLocalEvents();
    return list.find((e) => e.id === id) || null;
  }

  /**
   * Búsqueda y filtrado de eventos
   */
  public async searchEvents(params: {
    term?: string;
    status?: EventStatus | 'ALL';
    sortByDate?: 'asc' | 'desc';
  }): Promise<Event[]> {
    const all = await this.getEvents();
    const cleanTerm = (params.term || '').trim().toLowerCase();
    const statusFilter = params.status || 'ALL';
    const sortOrder = params.sortByDate || 'asc';

    const filtered = all.filter((e) => {
      // Filtro de estado
      if (statusFilter !== 'ALL' && e.status !== statusFilter) {
        return false;
      }

      // Filtro de búsqueda por título, lugar o descripción
      if (cleanTerm) {
        const matchTitle = e.title.toLowerCase().includes(cleanTerm);
        const matchVenue = e.venue ? e.venue.toLowerCase().includes(cleanTerm) : false;
        const matchDesc = e.description ? e.description.toLowerCase().includes(cleanTerm) : false;
        if (!matchTitle && !matchVenue && !matchDesc) {
          return false;
        }
      }

      return true;
    });

    // Ordenar por fecha
    return filtered.sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
    });
  }

  /**
   * Crea un nuevo evento con auditoría
   */
  public async createEvent(
    payload: Omit<Event, 'id' | 'ticketsSold' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'>,
    operatorUid: string
  ): Promise<Event> {
    const validation = this.validateEvent(payload);
    if (!validation.isValid) {
      throw new Error(validation.error);
    }

    const now = new Date().toISOString();
    const newId = 'evt_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now().toString(36);

    const newEvent: Event = {
      id: newId,
      title: payload.title.trim(),
      description: payload.description?.trim() || undefined,
      date: payload.date.trim(),
      startTime: payload.startTime?.trim() || undefined,
      endTime: payload.endTime?.trim() || undefined,
      venue: payload.venue?.trim() || undefined,
      capacity: payload.capacity !== undefined ? Number(payload.capacity) : undefined,
      status: payload.status || 'DRAFT',
      ticketsSold: 0,
      createdAt: now,
      updatedAt: now,
      createdBy: operatorUid,
      updatedBy: operatorUid
    };

    if (this.hasLiveFirebase()) {
      try {
        const docRef = doc(db, 'events', newId);
        await setDoc(docRef, newEvent);
      } catch (e) {
        console.warn('Firestore setDoc events falló, guardando localmente:', e);
      }
    }

    const localList = this.getLocalEvents();
    localList.unshift(newEvent);
    this.saveLocalEvents(localList);

    return newEvent;
  }

  /**
   * Actualiza un evento existente con auditoría
   */
  public async updateEvent(
    id: string,
    updates: Partial<Event>,
    operatorUid: string
  ): Promise<Event> {
    const existing = await this.getEventById(id);
    if (!existing) {
      throw new Error('El evento solicitado no existe.');
    }

    const merged = { ...existing, ...updates };
    const validation = this.validateEvent(merged);
    if (!validation.isValid) {
      throw new Error(validation.error);
    }

    const now = new Date().toISOString();
    const updatedEvent: Event = {
      ...existing,
      ...updates,
      updatedAt: now,
      updatedBy: operatorUid
    };

    if (this.hasLiveFirebase()) {
      try {
        const docRef = doc(db, 'events', id);
        await updateDoc(docRef, {
          ...updates,
          updatedAt: now,
          updatedBy: operatorUid
        });
      } catch (e) {
        console.warn('Firestore updateDoc events falló, actualizando localmente:', e);
      }
    }

    const localList = this.getLocalEvents();
    const index = localList.findIndex((e) => e.id === id);
    if (index !== -1) {
      localList[index] = updatedEvent;
      this.saveLocalEvents(localList);
    }

    return updatedEvent;
  }

  /**
   * Cambia el estado del evento
   */
  public async setEventStatus(id: string, newStatus: EventStatus, operatorUid: string): Promise<Event> {
    return this.updateEvent(id, { status: newStatus }, operatorUid);
  }
}

export const eventService = new EventService();
