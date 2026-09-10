import { collection, doc, setDoc, getDocs, query, where, limit } from 'firebase/firestore';
import {
  db,
  isFirebaseConfigured,
  isFirestoreHealthy,
  markFirestoreFailure,
  withTimeout
} from './firebase';
import { AuditLog, AuditAction, SystemRole } from '../types';
import { authService } from './auth.service';

const AUDIT_STORAGE_KEY = 'shikkum_audit_logs_store_v1';

class AuditService {
  private orderLogsCache = new Map<string, { data: AuditLog[]; timestamp: number }>();

  private hasLiveFirebase(): boolean {
    return Boolean(isFirebaseConfigured && db);
  }

  private getLocalLogs(): AuditLog[] {
    try {
      const raw = localStorage.getItem(AUDIT_STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  private saveLocalLogs(logs: AuditLog[]): void {
    try {
      localStorage.setItem(AUDIT_STORAGE_KEY, JSON.stringify(logs));
    } catch (e) {
      console.error('[AuditService] Error guardando logs locales:', e);
    }
  }

  /**
   * Registrar evento inmutable de auditoría
   */
  async logEvent(params: {
    action: AuditAction;
    entityType: 'order' | 'payment' | 'ticket' | 'customer' | 'event';
    entityId: string;
    metadata?: Record<string, any>;
    customUser?: { uid: string; displayName?: string; email?: string; role: SystemRole };
  }): Promise<AuditLog> {
    const activeUser = params.customUser || authService.getCurrentUser();
    const timestamp = new Date().toISOString();
    const auditId = `aud_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    const orderId =
      params.entityType === 'order'
        ? params.entityId
        : (params.metadata?.orderId as string | undefined) || undefined;

    const logEntry: AuditLog & { orderId?: string } = {
      id: auditId,
      timestamp,
      userId: activeUser?.uid || 'system',
      userEmail: activeUser?.email || undefined,
      userName: activeUser?.displayName || 'Sistema SHIKKUM',
      role: activeUser?.role || 'cashier',
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      orderId,
      metadata: params.metadata || {}
    };

    if (orderId) {
      this.orderLogsCache.delete(orderId);
    }

    // Almacenamiento local inmediato (garantiza persistencia instantánea en el navegador)
    const local = this.getLocalLogs();
    local.unshift(logEntry);
    this.saveLocalLogs(local);

    if (this.hasLiveFirebase() && db && isFirestoreHealthy()) {
      try {
        await withTimeout(setDoc(doc(db, 'audit_logs', auditId), logEntry), 400);
      } catch (err) {
        markFirestoreFailure(err);
      }
    }

    return logEntry;
  }

  /**
   * Obtener registros de auditoría vinculados a una entidad
   */
  async getLogsByEntityId(entityId: string): Promise<AuditLog[]> {
    if (this.hasLiveFirebase() && db && isFirestoreHealthy()) {
      try {
        const q = query(
          collection(db, 'audit_logs'),
          where('entityId', '==', entityId),
          limit(50)
        );
        const snap = await withTimeout(getDocs(q), 400);
        if (!snap.empty) {
          const list = snap.docs.map((d) => d.data() as AuditLog);
          list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
          return list;
        }
        return [];
      } catch (err) {
        markFirestoreFailure(err);
      }
    }

    // Modo Sandbox Demo
    const local = this.getLocalLogs();
    return local
      .filter((l) => l.entityId === entityId || l.metadata?.orderId === entityId || (l as any).orderId === entityId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  /**
   * Obtener registros de auditoría vinculados a una orden (incluye pagos y tickets de la orden)
   */
  async getLogsForOrder(orderId: string): Promise<AuditLog[]> {
    const cached = this.orderLogsCache.get(orderId);
    if (cached && Date.now() - cached.timestamp < 15000) {
      return cached.data;
    }

    if (this.hasLiveFirebase() && db && isFirestoreHealthy()) {
      try {
        const q = query(
          collection(db, 'audit_logs'),
          where('entityId', '==', orderId),
          limit(50)
        );
        const directLogsSnap = await withTimeout(getDocs(q), 400);

        const list: AuditLog[] = [];
        directLogsSnap.forEach((d) => list.push(d.data() as AuditLog));
        list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        this.orderLogsCache.set(orderId, { data: list, timestamp: Date.now() });
        return list;
      } catch (err) {
        markFirestoreFailure(err);
      }
    }

    const local = this.getLocalLogs();
    const result = local
      .filter((l) => l.entityId === orderId || l.metadata?.orderId === orderId || (l as any).orderId === orderId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    this.orderLogsCache.set(orderId, { data: result, timestamp: Date.now() });
    return result;
  }

  /**
   * Obtener bitácora de actividad reciente para dashboard y módulo de auditoría
   */
  async getRecentLogs(limitCount = 50): Promise<AuditLog[]> {
    if (this.hasLiveFirebase() && db && isFirestoreHealthy()) {
      try {
        const q = query(collection(db, 'audit_logs'), limit(limitCount));
        const snap = await withTimeout(getDocs(q), 500);
        if (!snap.empty) {
          const list = snap.docs.map((d) => d.data() as AuditLog);
          list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
          return list;
        }
      } catch (err) {
        markFirestoreFailure(err);
      }
    }

    const local = this.getLocalLogs();
    return local
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limitCount);
  }
}

export const auditService = new AuditService();
