import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  query,
  limit
} from 'firebase/firestore';
import {
  db,
  isFirebaseConfigured,
  isFirestoreHealthy,
  markFirestoreFailure,
  withTimeout
} from './firebase';
import { Customer } from '../types';

const STORAGE_KEY = 'shikkum_customers_store_v1';

// Datos iniciales de prueba claramente identificados como DEMO
const INITIAL_DEMO_CUSTOMERS: Customer[] = [
  {
    id: 'cust_demo_001',
    fullName: 'Cliente Demo Uno',
    email: 'cliente.demo@example.com',
    phone: '+1 555-0192',
    documentId: 'DEMO-98765432',
    isCommunityMember: true,
    isActive: true,
    notes: 'Registro inicial ficticio para pruebas de aceptación',
    createdAt: '2026-09-01T10:00:00.000Z',
    updatedAt: '2026-09-01T10:00:00.000Z',
    createdBy: 'usr_admin_master_01',
    updatedBy: 'usr_admin_master_01'
  },
  {
    id: 'cust_demo_002',
    fullName: 'Cliente Demo Dos (No Miembro)',
    email: 'cliente.demo2@example.com',
    phone: '+1 555-0193',
    documentId: 'DEMO-12345678',
    isCommunityMember: false,
    isActive: true,
    notes: 'Cliente no perteneciente a la comunidad para test de precios',
    createdAt: '2026-09-02T11:30:00.000Z',
    updatedAt: '2026-09-02T11:30:00.000Z',
    createdBy: 'usr_admin_master_01',
    updatedBy: 'usr_admin_master_01'
  },
  {
    id: 'cust_demo_003',
    fullName: 'Cliente Demo Inactivo',
    email: 'cliente.inactivo@example.com',
    phone: '+1 555-0194',
    documentId: 'DEMO-44556677',
    isCommunityMember: true,
    isActive: false,
    notes: 'Cliente de demostración desactivado para filtro',
    createdAt: '2026-09-02T14:00:00.000Z',
    updatedAt: '2026-09-03T09:15:00.000Z',
    createdBy: 'usr_admin_master_01',
    updatedBy: 'usr_admin_master_01'
  }
];

class CustomerService {
  private hasLiveFirebase(): boolean {
    return isFirebaseConfigured;
  }

  private getLocalCustomers(): Customer[] {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_DEMO_CUSTOMERS));
        return INITIAL_DEMO_CUSTOMERS;
      }
      return JSON.parse(saved);
    } catch {
      return INITIAL_DEMO_CUSTOMERS;
    }
  }

  private saveLocalCustomers(items: Customer[]): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch (e) {
      console.error('Error guardando clientes locales', e);
    }
  }

  /**
   * Valida los campos requeridos y formato del cliente
   */
  public validateCustomer(data: Partial<Customer>): { isValid: boolean; error?: string } {
    if (!data.fullName || data.fullName.trim().length < 2) {
      return { isValid: false, error: 'El nombre completo es obligatorio y debe tener al menos 2 caracteres.' };
    }

    if (!data.email || !data.email.trim()) {
      return { isValid: false, error: 'El correo electrónico es obligatorio.' };
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.email.trim())) {
      return { isValid: false, error: 'El formato del correo electrónico no es válido.' };
    }

    if (data.isCommunityMember === undefined || data.isCommunityMember === null) {
      return { isValid: false, error: 'Debe indicar si el cliente pertenece o no a la comunidad.' };
    }

    return { isValid: true };
  }

  /**
   * Obtiene todos los clientes
   */
  public async getCustomers(): Promise<Customer[]> {
    if (this.hasLiveFirebase() && db && isFirestoreHealthy()) {
      try {
        const colRef = collection(db, 'customers');
        const snap = await withTimeout(getDocs(query(colRef, limit(100))), 500);
        const list: Customer[] = [];
        snap.forEach((docSnap) => {
          list.push({ id: docSnap.id, ...docSnap.data() } as Customer);
        });
        if (list.length > 0) {
          return list;
        }
      } catch (err: any) {
        markFirestoreFailure(err);
      }
    }

    return this.getLocalCustomers();
  }

  /**
   * Obtiene un cliente por ID
   */
  public async getCustomerById(id: string): Promise<Customer | null> {
    if (this.hasLiveFirebase() && db && isFirestoreHealthy()) {
      try {
        const docRef = doc(db, 'customers', id);
        const snap = await withTimeout(getDoc(docRef), 800);
        if (snap.exists()) {
          return { id: snap.id, ...snap.data() } as Customer;
        }
      } catch (err: any) {
        markFirestoreFailure(err);
      }
    }

    const list = this.getLocalCustomers();
    return list.find((c) => c.id === id) || null;
  }

  /**
   * Busca clientes por término (nombre, correo, teléfono, documento) y filtro de estado activo
   */
  public async searchCustomers(term: string, activeFilter?: 'all' | 'active' | 'inactive'): Promise<Customer[]> {
    const all = await this.getCustomers();
    const cleanTerm = term.trim().toLowerCase();

    return all.filter((c) => {
      // Filtro de estado
      if (activeFilter === 'active' && !c.isActive) return false;
      if (activeFilter === 'inactive' && c.isActive) return false;

      // Filtro de búsqueda
      if (!cleanTerm) return true;

      const matchName = c.fullName.toLowerCase().includes(cleanTerm);
      const matchEmail = c.email.toLowerCase().includes(cleanTerm);
      const matchPhone = c.phone ? c.phone.toLowerCase().includes(cleanTerm) : false;
      const matchDoc = c.documentId ? c.documentId.toLowerCase().includes(cleanTerm) : false;

      return matchName || matchEmail || matchPhone || matchDoc;
    });
  }

  /**
   * Crea un nuevo cliente con auditoría
   */
  public async createCustomer(
    payload: Omit<Customer, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'>,
    operatorUid: string
  ): Promise<Customer> {
    const validation = this.validateCustomer(payload);
    if (!validation.isValid) {
      throw new Error(validation.error);
    }

    const now = new Date().toISOString();
    const newId = 'cust_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now().toString(36);

    const newCustomer: Customer = {
      id: newId,
      fullName: payload.fullName.trim(),
      email: payload.email.trim().toLowerCase(),
      phone: payload.phone?.trim() || undefined,
      documentId: payload.documentId?.trim() || undefined,
      isCommunityMember: Boolean(payload.isCommunityMember),
      isActive: payload.isActive !== undefined ? payload.isActive : true,
      notes: payload.notes?.trim() || undefined,
      createdAt: now,
      updatedAt: now,
      createdBy: operatorUid,
      updatedBy: operatorUid
    };

    if (this.hasLiveFirebase()) {
      try {
        const docRef = doc(db, 'customers', newId);
        await setDoc(docRef, newCustomer);
      } catch (e) {
        console.warn('Firestore setDoc customers falló, guardando localmente:', e);
      }
    }

    const localList = this.getLocalCustomers();
    localList.unshift(newCustomer);
    this.saveLocalCustomers(localList);

    return newCustomer;
  }

  /**
   * Actualiza un cliente existente con auditoría
   */
  public async updateCustomer(
    id: string,
    updates: Partial<Customer>,
    operatorUid: string
  ): Promise<Customer> {
    const existing = await this.getCustomerById(id);
    if (!existing) {
      throw new Error('El cliente solicitado no existe.');
    }

    const merged = { ...existing, ...updates };
    const validation = this.validateCustomer(merged);
    if (!validation.isValid) {
      throw new Error(validation.error);
    }

    const now = new Date().toISOString();
    const updatedCustomer: Customer = {
      ...existing,
      ...updates,
      updatedAt: now,
      updatedBy: operatorUid
    };

    if (this.hasLiveFirebase()) {
      try {
        const docRef = doc(db, 'customers', id);
        await updateDoc(docRef, {
          ...updates,
          updatedAt: now,
          updatedBy: operatorUid
        });
      } catch (e) {
        console.warn('Firestore updateDoc customers falló, actualizando localmente:', e);
      }
    }

    const localList = this.getLocalCustomers();
    const index = localList.findIndex((c) => c.id === id);
    if (index !== -1) {
      localList[index] = updatedCustomer;
      this.saveLocalCustomers(localList);
    }

    return updatedCustomer;
  }

  /**
   * Activa o desactiva un cliente (soft delete)
   */
  public async toggleCustomerStatus(id: string, isActive: boolean, operatorUid: string): Promise<Customer> {
    return this.updateCustomer(id, { isActive }, operatorUid);
  }
}

export const customerService = new CustomerService();
