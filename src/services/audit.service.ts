import { collection, doc, setDoc, getDocs, query, where } from 'firebase/firestore';
import { db, isFirebaseConfigured } from './firebase';
import { AuditLog, AuditAction, SystemRole } from '../types';
import { authService } from './auth.service';

const AUDIT_STORAGE_KEY = 'shikkum_audit_logs_store_v1';

class AuditService {
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

    const logEntry: AuditLog = {
      id: auditId,
      timestamp,
      userId: activeUser?.uid || 'system',
      userEmail: activeUser?.email || undefined,
      userName: activeUser?.displayName || 'Sistema SHIKKUM',
      role: activeUser?.role || 'cashier',
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      metadata: params.metadata || {}
    };

    if (this.hasLiveFirebase() && db) {
      try {
        await setDoc(doc(db, 'audit_logs', auditId), logEntry);
        return logEntry;
      } catch (err) {
        console.error('[AuditService] Error registrando auditoría en Firestore:', err);
        if (isFirebaseConfigured) {
          throw new Error('No se pudo persistir el registro de auditoría obligatorio en Firestore.');
        }
      }
    }

    // Almacenamiento local (Sandbox Demo)
    const local = this.getLocalLogs();
    local.unshift(logEntry);
    this.saveLocalLogs(local);
    return logEntry;
  }

  /**
   * Obtener registros de auditoría vinculados a una entidad
   */
  async getLogsByEntityId(entityId: string): Promise<AuditLog[]> {
    if (this.hasLiveFirebase() && db) {
      try {
        const q = query(
          collection(db, 'audit_logs'),
          where('entityId', '==', entityId)
        );
        const snap = await getDocs(q);
        if (!snap.empty) {
          const list = snap.docs.map((d) => d.data() as AuditLog);
          list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
          return list;
        }
        return [];
      } catch (err) {
        console.error('[AuditService] Error consultando auditoría en Firestore:', err);
        throw new Error('Error al consultar el historial de auditoría en Firestore.');
      }
    }

    // Modo Sandbox Demo
    const local = this.getLocalLogs();
    return local
      .filter((l) => l.entityId === entityId || l.metadata?.orderId === entityId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  /**
   * Obtener registros de auditoría vinculados a una orden (incluye pagos y tickets de la orden)
   */
  async getLogsForOrder(orderId: string): Promise<AuditLog[]> {
    if (this.hasLiveFirebase() && db) {
      try {
        const [directLogsSnap, metaLogsSnap] = await Promise.all([
          getDocs(query(collection(db, 'audit_logs'), where('entityId', '==', orderId))),
          getDocs(query(collection(db, 'audit_logs'), where('metadata.orderId', '==', orderId)))
        ]);

        const map = new Map<string, AuditLog>();
        directLogsSnap.forEach((d) => map.set(d.id, d.data() as AuditLog));
        metaLogsSnap.forEach((d) => map.set(d.id, d.data() as AuditLog));

        const list = Array.from(map.values());
        list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        return list;
      } catch (err) {
        console.error('[AuditService] Error consultando auditoría de orden en Firestore:', err);
        throw new Error('Error al consultar el historial de auditoría de la orden en Firestore.');
      }
    }

    const local = this.getLocalLogs();
    return local
      .filter((l) => l.entityId === orderId || l.metadata?.orderId === orderId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }
}

export const auditService = new AuditService();
