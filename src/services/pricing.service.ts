import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc
} from 'firebase/firestore';
import {
  db,
  isFirebaseConfigured,
  isFirestoreHealthy,
  markFirestoreSuccess,
  markFirestoreFailure,
  withTimeout
} from './firebase';
import { PriceRule, PricePreviewRequest, PricePreviewResult } from '../types';
import { eventService } from './event.service';

const STORAGE_KEY = 'shikkum_price_rules_store_v1';

class PricingService {
  private hasLiveFirebase(): boolean {
    return isFirebaseConfigured;
  }

  private getLocalRules(): PriceRule[] {
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

  private saveLocalRules(items: PriceRule[]): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch (e) {
      console.error('Error guardando reglas locales', e);
    }
  }

  /**
   * Valida una regla de precio según los requerimientos de la Sección 6
   */
  public async validatePriceRule(
    data: Partial<PriceRule>,
    existingRuleId?: string
  ): Promise<{ isValid: boolean; error?: string; warning?: string }> {
    if (!data.name || data.name.trim().length < 2) {
      return { isValid: false, error: 'El nombre descriptivo de la regla es obligatorio.' };
    }

    if (!data.eventId || !data.eventId.trim()) {
      return { isValid: false, error: 'Debe asociar la regla a un evento existente.' };
    }

    // Verificar que el evento exista
    const event = await eventService.getEventById(data.eventId);
    if (!event) {
      return { isValid: false, error: 'El evento especificado no existe en el sistema.' };
    }

    if (data.minAge === undefined || data.minAge === null || Number.isNaN(Number(data.minAge))) {
      return { isValid: false, error: 'La edad mínima es obligatoria.' };
    }

    const minAge = Number(data.minAge);
    if (minAge < 0 || !Number.isInteger(minAge)) {
      return { isValid: false, error: 'La edad mínima debe ser un número entero mayor o igual a 0.' };
    }

    let maxAge: number | null = null;
    if (data.maxAge !== undefined && data.maxAge !== null && data.maxAge !== ('' as any)) {
      maxAge = Number(data.maxAge);
      if (Number.isNaN(maxAge) || maxAge < 0 || !Number.isInteger(maxAge)) {
        return { isValid: false, error: 'La edad máxima debe ser un número entero válido o dejarse en blanco (sin límite).' };
      }
      if (maxAge < minAge) {
        return { isValid: false, error: 'La edad máxima debe ser mayor o igual a la edad mínima.' };
      }
    }

    if (data.price === undefined || data.price === null || Number.isNaN(Number(data.price))) {
      return { isValid: false, error: 'El precio es obligatorio.' };
    }

    const price = Number(data.price);
    if (price < 0) {
      return { isValid: false, error: 'El precio debe ser mayor o igual a 0 USD.' };
    }

    if (data.priority === undefined || data.priority === null || Number.isNaN(Number(data.priority))) {
      return { isValid: false, error: 'La prioridad de evaluación es obligatoria.' };
    }

    const priority = Number(data.priority);
    if (!Number.isInteger(priority)) {
      return { isValid: false, error: 'La prioridad debe ser un número entero.' };
    }

    // Comprobación de reglas idénticas para advertir ambigüedad
    let warning: string | undefined;
    const allRules = await this.getRulesByEventId(data.eventId);
    const duplicates = allRules.filter((r) => {
      if (existingRuleId && r.id === existingRuleId) return false;
      return (
        r.isActive &&
        r.minAge === minAge &&
        r.maxAge === maxAge &&
        r.communityMemberOnly === Boolean(data.communityMemberOnly)
      );
    });

    if (duplicates.length > 0) {
      warning = `Existe otra regla activa con el mismo rango de edad (${minAge}-${maxAge ?? '∞'}) y condición comunitaria. La prioridad resolverá cuál se aplica.`;
    }

    return { isValid: true, warning };
  }

  /**
   * Obtiene todas las reglas registradas directamente desde Firestore
   */
  public async getAllRules(): Promise<PriceRule[]> {
    if (this.hasLiveFirebase() && db && isFirestoreHealthy()) {
      try {
        const colRef = collection(db, 'price_rules');
        const snap = await withTimeout(getDocs(colRef), 3500, 'Consulta de reglas de precio excedió el límite.');
        const list: PriceRule[] = [];
        snap.forEach((docSnap) => {
          list.push({ id: docSnap.id, ...docSnap.data() } as PriceRule);
        });
        markFirestoreSuccess();
        this.saveLocalRules(list);
        return list;
      } catch (err: any) {
        markFirestoreFailure(err);
      }
    }

    return this.getLocalRules();
  }

  /**
   * Obtiene las reglas de precio para un evento específico
   */
  public async getRulesByEventId(eventId: string, activeOnly = false): Promise<PriceRule[]> {
    const all = await this.getAllRules();
    return all
      .filter((r) => r.eventId === eventId && (!activeOnly || r.isActive))
      .sort((a, b) => b.priority - a.priority);
  }

  /**
   * Obtiene una regla por ID
   */
  public async getRuleById(id: string): Promise<PriceRule | null> {
    if (this.hasLiveFirebase() && db && isFirestoreHealthy()) {
      try {
        const docRef = doc(db, 'price_rules', id);
        const snap = await withTimeout(getDoc(docRef), 3500, 'Consulta de regla excedió el límite.');
        if (snap.exists()) {
          markFirestoreSuccess();
          return { id: snap.id, ...snap.data() } as PriceRule;
        }
        return null;
      } catch (err: any) {
        markFirestoreFailure(err);
      }
    }

    const list = this.getLocalRules();
    return list.find((r) => r.id === id) || null;
  }

  /**
   * Crea una nueva regla de precios con persistencia directa en Firestore
   */
  public async createRule(
    payload: Omit<PriceRule, 'id' | 'currency' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'>,
    operatorUid: string
  ): Promise<PriceRule> {
    const validation = await this.validatePriceRule(payload);
    if (!validation.isValid) {
      throw new Error(validation.error);
    }

    const now = new Date().toISOString();
    const newId = 'prule_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now().toString(36);

    const maxAgeValue =
      payload.maxAge !== null && payload.maxAge !== undefined && (payload.maxAge as any) !== ''
        ? Number(payload.maxAge)
        : null;

    const newRule: PriceRule = {
      id: newId,
      eventId: payload.eventId.trim(),
      name: payload.name.trim(),
      minAge: Number(payload.minAge),
      maxAge: maxAgeValue,
      communityMemberOnly: Boolean(payload.communityMemberOnly),
      ticketType: payload.ticketType?.trim() || undefined,
      price: Number(payload.price),
      currency: 'USD',
      isActive: payload.isActive !== undefined ? payload.isActive : true,
      priority: Number(payload.priority),
      createdAt: now,
      updatedAt: now,
      createdBy: operatorUid,
      updatedBy: operatorUid
    };

    if (this.hasLiveFirebase() && db) {
      try {
        const docRef = doc(db, 'price_rules', newId);
        await setDoc(docRef, newRule);
        markFirestoreSuccess();
        return newRule;
      } catch (e: any) {
        markFirestoreFailure(e);
        console.error('[PricingService] Fallo guardando regla en Firestore:', e);
        throw new Error(`No se pudo crear la regla en Firestore: ${e.message || 'Error de permisos o red.'}`);
      }
    }

    const localList = this.getLocalRules();
    localList.unshift(newRule);
    this.saveLocalRules(localList);

    return newRule;
  }

  /**
   * Actualiza una regla existente con persistencia directa en Firestore
   */
  public async updateRule(
    id: string,
    updates: Partial<PriceRule>,
    operatorUid: string
  ): Promise<PriceRule> {
    const existing = await this.getRuleById(id);
    if (!existing) {
      throw new Error('La regla de precio no existe.');
    }

    const merged = { ...existing, ...updates };
    const validation = await this.validatePriceRule(merged, id);
    if (!validation.isValid) {
      throw new Error(validation.error);
    }

    const maxAgeValue =
      updates.maxAge !== undefined
        ? (updates.maxAge !== null && (updates.maxAge as any) !== '' ? Number(updates.maxAge) : null)
        : existing.maxAge;

    const now = new Date().toISOString();
    const updatedRule: PriceRule = {
      ...existing,
      ...updates,
      maxAge: maxAgeValue,
      currency: 'USD',
      updatedAt: now,
      updatedBy: operatorUid
    };

    if (this.hasLiveFirebase() && db) {
      try {
        const docRef = doc(db, 'price_rules', id);
        await updateDoc(docRef, {
          ...updates,
          maxAge: maxAgeValue,
          currency: 'USD',
          updatedAt: now,
          updatedBy: operatorUid
        });
        markFirestoreSuccess();
        return updatedRule;
      } catch (e: any) {
        markFirestoreFailure(e);
        console.error('[PricingService] Fallo actualizando regla en Firestore:', e);
        throw new Error(`No se pudo actualizar la regla en Firestore: ${e.message || 'Error de permisos o red.'}`);
      }
    }

    const localList = this.getLocalRules();
    const index = localList.findIndex((r) => r.id === id);
    if (index !== -1) {
      localList[index] = updatedRule;
      this.saveLocalRules(localList);
    }

    return updatedRule;
  }

  /**
   * Activa o desactiva una regla
   */
  public async toggleRuleStatus(id: string, isActive: boolean, operatorUid: string): Promise<PriceRule> {
    return this.updateRule(id, { isActive }, operatorUid);
  }

  /**
   * Elimina una regla si aún no ha sido utilizada
   */
  public async deleteRule(id: string): Promise<void> {
    if (this.hasLiveFirebase() && db) {
      try {
        const docRef = doc(db, 'price_rules', id);
        await deleteDoc(docRef);
        markFirestoreSuccess();
      } catch (e: any) {
        markFirestoreFailure(e);
        console.error('[PricingService] Fallo eliminando regla en Firestore:', e);
        throw new Error(`No se pudo eliminar la regla de Firestore: ${e.message || 'Error de permisos o red.'}`);
      }
    }

    const localList = this.getLocalRules();
    const filtered = localList.filter((r) => r.id !== id);
    this.saveLocalRules(filtered);
  }

  /**
   * calculatePricePreview
   *
   * Realiza una previsualización del precio según la edad, pertenencia comunitaria y prioridad.
   * IMPORTANTE: Esta función frontend NO confirma compras. El cálculo definitivo será en Cloud Functions.
   */
  public async calculatePricePreview(request: PricePreviewRequest): Promise<PricePreviewResult> {
    const { eventId, age, isCommunityMember } = request;

    if (!eventId) {
      return {
        matchedRuleId: null,
        ruleName: null,
        price: null,
        currency: 'USD',
        rejectionReason: 'ID de evento no especificado.'
      };
    }

    if (age === undefined || age === null || Number.isNaN(age) || age < 0) {
      return {
        matchedRuleId: null,
        ruleName: null,
        price: null,
        currency: 'USD',
        rejectionReason: 'La edad del asistente debe ser un número mayor o igual a 0.'
      };
    }

    // Obtener reglas activas del evento
    const activeRules = await this.getRulesByEventId(eventId, true);

    if (activeRules.length === 0) {
      return {
        matchedRuleId: null,
        ruleName: null,
        price: null,
        currency: 'USD',
        rejectionReason: 'No existen reglas de precios activas configuradas para este evento.'
      };
    }

    // Filtrar reglas compatibles con la edad y condición comunitaria
    const eligibleRules = activeRules.filter((rule) => {
      // Condición de edad
      const matchesMinAge = age >= rule.minAge;
      const matchesMaxAge = rule.maxAge === null || age <= rule.maxAge;
      if (!matchesMinAge || !matchesMaxAge) {
        return false;
      }

      // Condición comunitaria:
      // Si la regla exige ser miembro (communityMemberOnly === true), el asistente debe serlo.
      // Si communityMemberOnly === false, aplica a cualquier persona (miembro o no).
      if (rule.communityMemberOnly && !isCommunityMember) {
        return false;
      }

      return true;
    });

    if (eligibleRules.length === 0) {
      return {
        matchedRuleId: null,
        ruleName: null,
        price: null,
        currency: 'USD',
        rejectionReason: `No existe ninguna regla de precio activa aplicable para edad ${age} años ${isCommunityMember ? '(Miembro)' : '(No Miembro)'}.`
      };
    }

    // Resolver regla ganadora:
    // 1. Mayor prioridad (priority descendente)
    // 2. Si empatan en prioridad, favorecer la regla más específica (communityMemberOnly === true si es miembro)
    // 3. Menor precio si persisten empates
    eligibleRules.sort((a, b) => {
      if (b.priority !== a.priority) {
        return b.priority - a.priority;
      }
      if (a.communityMemberOnly !== b.communityMemberOnly) {
        return a.communityMemberOnly ? -1 : 1;
      }
      return a.price - b.price;
    });

    const winningRule = eligibleRules[0];

    return {
      matchedRuleId: winningRule.id,
      ruleName: winningRule.name,
      price: winningRule.price,
      currency: 'USD',
      ticketType: winningRule.ticketType
    };
  }
}

export const pricingService = new PricingService();
