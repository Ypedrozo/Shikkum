import {
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  sendPasswordResetEmail,
  User as FirebaseUser,
  onIdTokenChanged
} from 'firebase/auth';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { auth, db, isFirebaseConfigured } from './firebase';
import { SystemRole, SystemUser } from '../types';

const SESSION_STORAGE_KEY = 'shikkum_active_session_v2';

/**
 * Cuentas iniciales de prueba y desarrollo para verificación inmediata
 * de los 7 criterios de aceptación de la Fase 2 en entornos sin API Key configurado.
 */
const MOCK_DEV_ACCOUNTS: Record<string, { password: string; user: SystemUser }> = {
  'admin@shikkum.com': {
    password: 'AdminPassword2026!',
    user: {
      uid: 'usr_admin_master_01',
      email: 'admin@shikkum.com',
      displayName: 'Yeiber Pedrozo (Super Administrador)',
      role: 'admin',
      isActive: true,
      createdAt: '2026-09-01T10:00:00.000Z',
      updatedAt: '2026-09-01T10:00:00.000Z'
    }
  },
  'cashier@shikkum.com': {
    password: 'CashierPassword2026!',
    user: {
      uid: 'usr_cashier_02',
      email: 'cashier@shikkum.com',
      displayName: 'Personal de Cobranzas 1',
      role: 'cashier',
      isActive: true,
      createdAt: '2026-09-02T11:00:00.000Z',
      updatedAt: '2026-09-02T11:00:00.000Z'
    }
  },
  'gate@shikkum.com': {
    password: 'GatePassword2026!',
    user: {
      uid: 'usr_gate_03',
      email: 'gate@shikkum.com',
      displayName: 'Operador Puerta 1',
      role: 'gate_operator',
      isActive: true,
      createdAt: '2026-09-02T12:00:00.000Z',
      updatedAt: '2026-09-02T12:00:00.000Z'
    }
  },
  'disabled@shikkum.com': {
    password: 'DisabledPassword2026!',
    user: {
      uid: 'usr_disabled_04',
      email: 'disabled@shikkum.com',
      displayName: 'Usuario Desactivado',
      role: 'cashier',
      isActive: false, // Bloqueo estricto
      createdAt: '2026-09-01T08:00:00.000Z',
      updatedAt: '2026-09-03T09:00:00.000Z'
    }
  }
};

class AuthService {
  private currentUser: SystemUser | null = null;
  private listeners: Array<(user: SystemUser | null) => void> = [];

  constructor() {
    this.restoreLocalSession();
    this.initFirebaseListener();
  }

  private hasLiveFirebase(): boolean {
    return isFirebaseConfigured;
  }

  private restoreLocalSession() {
    try {
      const saved = localStorage.getItem(SESSION_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as SystemUser;
        this.currentUser = parsed;
      }
    } catch {
      localStorage.removeItem(SESSION_STORAGE_KEY);
    }
  }

  private saveLocalSession(user: SystemUser | null) {
    if (user) {
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(SESSION_STORAGE_KEY);
    }
  }

  private initFirebaseListener() {
    if (!this.hasLiveFirebase()) {
      return;
    }

    try {
      onIdTokenChanged(auth, async (fbUser: FirebaseUser | null) => {
        if (!fbUser) {
          this.currentUser = null;
          this.saveLocalSession(null);
          this.notifyListeners();
          return;
        }

        try {
          const idTokenResult = await fbUser.getIdTokenResult(true);
          const claimRole = (idTokenResult.claims.role as SystemRole) || null;

          // Consultar documento en /users/{uid}
          const userDocRef = doc(db, 'users', fbUser.uid);
          const snap = await getDoc(userDocRef);

          let role: SystemRole = claimRole || 'cashier';
          let isActive = true;
          let displayName = fbUser.displayName || fbUser.email?.split('@')[0] || 'Operador Shikkum';

          if (snap.exists()) {
            const data = snap.data();
            role = (claimRole || data.role || 'cashier') as SystemRole;
            isActive = data.isActive !== false;
            if (data.displayName) {
              displayName = data.displayName;
            }
          }

          this.currentUser = {
            uid: fbUser.uid,
            email: fbUser.email || '',
            displayName,
            role,
            isActive,
            createdAt: fbUser.metadata.creationTime || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            lastLoginAt: new Date().toISOString()
          };

          this.saveLocalSession(this.currentUser);
          this.notifyListeners();
        } catch {
          this.notifyListeners();
        }
      });
    } catch {
      // Continuar en modo resiliente
    }
  }

  public subscribe(callback: (user: SystemUser | null) => void): () => void {
    this.listeners.push(callback);
    callback(this.currentUser);
    return () => {
      this.listeners = this.listeners.filter((cb) => cb !== callback);
    };
  }

  private notifyListeners() {
    this.listeners.forEach((cb) => cb(this.currentUser));
  }

  /**
   * Inicia sesión validando credenciales y evaluando estado activo y rol
   */
  public async login(email: string, pass: string): Promise<SystemUser> {
    const cleanEmail = email.trim().toLowerCase();

    // 1. Verificación directa con Firebase Auth si el API key está configurado
    if (this.hasLiveFirebase()) {
      try {
        const userCredential = await signInWithEmailAndPassword(auth, cleanEmail, pass);
        const fbUser = userCredential.user;

        // Extraer Custom Claim del JWT
        const idTokenResult = await fbUser.getIdTokenResult(true);
        const claimRole = (idTokenResult.claims.role as SystemRole) || null;

        // Consultar /users/{uid} en Firestore
        const userDocRef = doc(db, 'users', fbUser.uid);
        const snap = await getDoc(userDocRef);

        let role: SystemRole = claimRole || 'cashier';
        let isActive = true;
        let displayName = fbUser.displayName || cleanEmail.split('@')[0];

        if (snap.exists()) {
          const data = snap.data();
          role = (claimRole || data.role || 'cashier') as SystemRole;
          isActive = data.isActive !== false;
          if (data.displayName) {
            displayName = data.displayName;
          }

          // Registrar última hora de inicio de sesión
          try {
            await updateDoc(userDocRef, {
              lastLoginAt: new Date().toISOString()
            });
          } catch {
            // Silencioso si rules restringe
          }
        }

        if (!isActive) {
          await fbSignOut(auth);
          throw new Error('ACCOUNT_DISABLED: Esta cuenta de usuario se encuentra desactivada por la administración.');
        }

        const loggedUser: SystemUser = {
          uid: fbUser.uid,
          email: fbUser.email || cleanEmail,
          displayName,
          role,
          isActive: true,
          createdAt: fbUser.metadata.creationTime || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          lastLoginAt: new Date().toISOString()
        };

        this.currentUser = loggedUser;
        this.saveLocalSession(loggedUser);
        this.notifyListeners();
        return loggedUser;
      } catch (err: any) {
        if (err.message && err.message.startsWith('ACCOUNT_DISABLED')) {
          throw err;
        }
        throw new Error(this.mapAuthError(err.code || err.message));
      }
    }

    // 2. Modo Desarrollo / Sandbox para pruebas inmediatas de criterios de aceptación
    const devAccount = MOCK_DEV_ACCOUNTS[cleanEmail];
    if (!devAccount) {
      throw new Error('Correo electrónico o contraseña incorrectos.');
    }

    if (devAccount.password !== pass) {
      throw new Error('Correo electrónico o contraseña incorrectos.');
    }

    if (!devAccount.user.isActive) {
      throw new Error('ACCOUNT_DISABLED: Esta cuenta de usuario se encuentra desactivada por la administración.');
    }

    const sessionUser: SystemUser = {
      ...devAccount.user,
      lastLoginAt: new Date().toISOString()
    };

    this.currentUser = sessionUser;
    this.saveLocalSession(sessionUser);
    this.notifyListeners();
    return sessionUser;
  }

  /**
   * Cierre de sesión seguro
   */
  public async logout(): Promise<void> {
    if (this.hasLiveFirebase()) {
      try {
        await fbSignOut(auth);
      } catch {
        // Ignorar fallos de red al cerrar sesión
      }
    }

    this.currentUser = null;
    this.saveLocalSession(null);
    this.notifyListeners();
  }

  /**
   * Solicitud de restablecimiento de contraseña mediante correo
   */
  public async resetPassword(email: string): Promise<void> {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      throw new Error('Ingresa un correo electrónico válido.');
    }

    if (this.hasLiveFirebase()) {
      try {
        await sendPasswordResetEmail(auth, cleanEmail);
        return;
      } catch (err: any) {
        throw new Error(this.mapAuthError(err.code || err.message));
      }
    }

    // En modo desarrollo
    await new Promise((resolve) => setTimeout(resolve, 600));
  }

  public getCurrentUser(): SystemUser | null {
    return this.currentUser;
  }

  public getUserRole(): SystemRole | null {
    return this.currentUser?.role || null;
  }

  public getRedirectPathForRole(role: SystemRole): string {
    switch (role) {
      case 'admin':
        return '/admin';
      case 'cashier':
        return '/cashier';
      case 'gate_operator':
        return '/gate';
      default:
        return '/login';
    }
  }

  public isAuthorizedForPath(currentPath: string, user: SystemUser | null): boolean {
    if (!user || !user.isActive) {
      return false;
    }

    if (currentPath.startsWith('/admin')) {
      return user.role === 'admin';
    }

    if (currentPath.startsWith('/cashier')) {
      return user.role === 'admin' || user.role === 'cashier';
    }

    if (currentPath.startsWith('/gate')) {
      return user.role === 'admin' || user.role === 'gate_operator';
    }

    return true;
  }

  /**
   * Mapeo de códigos de error de Firebase Authentication a mensajes profesionales en español
   */
  private mapAuthError(code: string): string {
    switch (code) {
      case 'auth/invalid-credential':
      case 'auth/user-not-found':
      case 'auth/wrong-password':
        return 'Correo electrónico o contraseña incorrectos.';
      case 'auth/invalid-email':
        return 'El formato del correo electrónico no es válido.';
      case 'auth/user-disabled':
        return 'ACCOUNT_DISABLED: Esta cuenta de usuario ha sido inhabilitada por la administración.';
      case 'auth/too-many-requests':
        return 'Acceso temporalmente bloqueado por múltiples intentos fallidos. Intenta más tarde.';
      case 'auth/network-request-failed':
        return 'Error de conexión de red. Comprueba tu conexión a internet.';
      default:
        return 'No fue posible iniciar sesión. Verifica tus credenciales.';
    }
  }

  /**
   * Lista de credenciales de prueba para el panel interactivo de desarrollo
   */
  public getDevTestAccounts() {
    return Object.entries(MOCK_DEV_ACCOUNTS).map(([email, item]) => ({
      email,
      password: item.password,
      role: item.user.role,
      displayName: item.user.displayName,
      isActive: item.user.isActive
    }));
  }
}

export const authService = new AuthService();
