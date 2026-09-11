import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc
} from 'firebase/firestore';
import {
  db,
  isFirebaseConfigured,
  isFirestoreHealthy,
  markFirestoreSuccess,
  markFirestoreFailure,
  withTimeout
} from './firebase';
import { Event, EventStatus } from '../types';

const STORAGE_KEY = 'shikkum_events_store_v1';

class EventService {
  private hasLiveFirebase(): boolean {
    return isFirebaseConfigured;
  }

  private getLocalEvents(): Event[] {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) {
        return [];
      }
      return JSON.parse(saved);
    } catch {
      return [];
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
   * Obtiene la lista completa de eventos directamente desde Firestore
   */
  public async getEvents(): Promise<Event[]> {
    if (this.hasLiveFirebase() && db && isFirestoreHealthy()) {
      try {
        const colRef = collection(db, 'events');
        const snap = await withTimeout(getDocs(colRef), 3500, 'Consulta de eventos excedió el límite.');
        const list: Event[] = [];
        snap.forEach((docSnap) => {
          list.push({ id: docSnap.id, ...docSnap.data() } as Event);
        });
        markFirestoreSuccess();
        this.saveLocalEvents(list);
        return list;
      } catch (err: any) {
        markFirestoreFailure(err);
      }
    }

    return this.getLocalEvents();
  }

  /**
   * Obtiene un evento por ID
   */
  public async getEventById(id: string): Promise<Event | null> {
    if (this.hasLiveFirebase() && db && isFirestoreHealthy()) {
      try {
        const docRef = doc(db, 'events', id);
        const snap = await withTimeout(getDoc(docRef), 3500, 'Consulta de evento excedió el límite.');
        if (snap.exists()) {
          markFirestoreSuccess();
          return { id: snap.id, ...snap.data() } as Event;
        }
        return null;
      } catch (err: any) {
        markFirestoreFailure(err);
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
   * Crea un nuevo evento con persistencia directa en Firestore
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

    if (this.hasLiveFirebase() && db) {
      try {
        const docRef = doc(db, 'events', newId);
        await setDoc(docRef, newEvent);
        markFirestoreSuccess();
        return newEvent;
      } catch (e: any) {
        markFirestoreFailure(e);
        console.error('[EventService] Fallo guardando evento en Firestore:', e);
        throw new Error(`No se pudo crear el evento en Firestore: ${e.message || 'Error de permisos o red.'}`);
      }
    }

    const localList = this.getLocalEvents();
    localList.unshift(newEvent);
    this.saveLocalEvents(localList);

    return newEvent;
  }

  /**
   * Actualiza un evento existente con persistencia directa en Firestore
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

    if (this.hasLiveFirebase() && db) {
      try {
        const docRef = doc(db, 'events', id);
        await updateDoc(docRef, {
          ...updates,
          updatedAt: now,
          updatedBy: operatorUid
        });
        markFirestoreSuccess();
        return updatedEvent;
      } catch (e: any) {
        markFirestoreFailure(e);
        console.error('[EventService] Fallo actualizando evento en Firestore:', e);
        throw new Error(`No se pudo actualizar el evento en Firestore: ${e.message || 'Error de permisos o red.'}`);
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
