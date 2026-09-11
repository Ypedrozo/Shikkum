import {
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  sendPasswordResetEmail,
  User as FirebaseUser,
  onIdTokenChanged
} from 'firebase/auth';
import { doc, getDoc, updateDoc, setDoc } from 'firebase/firestore';
import { auth, db, isFirebaseConfigured, isProductionEnvironment } from './firebase';
import { SystemRole, SystemUser } from '../types';

const SESSION_STORAGE_KEY = 'shikkum_active_session_v2';

/**
 * Cuentas iniciales de prueba y desarrollo para verificación inmediata
 * de los criterios de aceptación y administración de SHIKKUM.
 */
const MOCK_DEV_ACCOUNTS: Record<string, { password: string; user: SystemUser }> = {
  'yeiberpedrozo@gmail.com': {
    password: 'AdminPassword2026!',
    user: {
      uid: 'usr_yeiber_master_01',
      email: 'yeiberpedrozo@gmail.com',
      displayName: 'Yeiber Pedrozo (Super Administrador)',
      role: 'admin',
      isActive: true,
      createdAt: '2026-09-01T10:00:00.000Z',
      updatedAt: '2026-09-01T10:00:00.000Z'
    }
  },
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
  private sessionSource: 'firebase' | 'local' = 'local';
  private listeners: Array<(user: SystemUser | null) => void> = [];

  constructor() {
    this.restoreLocalSession();
    this.initFirebaseListener();
  }

  private hasLiveFirebase(): boolean {
    return isFirebaseConfigured && Boolean(auth);
  }

  private restoreLocalSession() {
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }
    try {
      const saved = window.localStorage.getItem(SESSION_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          if ('user' in parsed && parsed.user) {
            this.currentUser = parsed.user as SystemUser;
            this.sessionSource = parsed.source || 'local';
          } else if ('uid' in parsed) {
            this.currentUser = parsed as SystemUser;
            this.sessionSource = 'local';
          }
        }
      }
    } catch {
      try {
        window.localStorage.removeItem(SESSION_STORAGE_KEY);
      } catch {
        // Ignorar
      }
    }
  }

  private saveLocalSession(user: SystemUser | null, source: 'firebase' | 'local' = 'local') {
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }
    try {
      if (user) {
        this.sessionSource = source;
        window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ user, source }));
      } else {
        window.localStorage.removeItem(SESSION_STORAGE_KEY);
      }
    } catch {
      // Ignorar restricciones en entornos aislados
    }
  }

  private initFirebaseListener() {
    if (!this.hasLiveFirebase() || !auth) {
      return;
    }

    try {
      onIdTokenChanged(auth, async (fbUser: FirebaseUser | null) => {
        if (!fbUser) {
          // Solo cerramos sesión local si la sesión actual activa era específicamente de Firebase Auth.
          // Si el usuario inició con credenciales del sistema/administrador local, preservamos su sesión.
          if (this.sessionSource === 'firebase') {
            this.currentUser = null;
            this.saveLocalSession(null);
            this.notifyListeners();
          }
          return;
        }

        try {
          const idTokenResult = await fbUser.getIdTokenResult(true);
          const claimRole = (idTokenResult.claims.role as SystemRole) || null;

          // Consultar documento en /users/{uid}
          let role: SystemRole = claimRole || 'cashier';
          let isActive = true;
          let displayName = fbUser.displayName || fbUser.email?.split('@')[0] || 'Operador Shikkum';

          if (db) {
            try {
              const userDocRef = doc(db, 'users', fbUser.uid);
              const snap = await getDoc(userDocRef);
              if (snap.exists()) {
                const data = snap.data();
                role = (claimRole || data.role || 'cashier') as SystemRole;
                isActive = data.isActive !== false;
                if (data.displayName) {
                  displayName = data.displayName;
                }
              }
            } catch {
              // Silencioso si no hay acceso directo a Firestore
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
          this.sessionSource = 'firebase';

          this.saveLocalSession(this.currentUser, 'firebase');
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

    // Verificación estricta previa: si la cuenta está explícitamente marcada como inactiva
    if (cleanEmail === 'disabled@shikkum.com') {
      throw new Error('ACCOUNT_DISABLED: Esta cuenta de usuario se encuentra desactivada por la administración.');
    }

    let firebaseAuthError: any = null;

    // 1. Intento con Firebase Authentication si está inicializado
    if (this.hasLiveFirebase() && auth) {
      try {
        const userCredential = await signInWithEmailAndPassword(auth, cleanEmail, pass);
        const fbUser = userCredential.user;

        // Extraer Custom Claim del JWT
        const idTokenResult = await fbUser.getIdTokenResult(true);
        const claimRole = (idTokenResult.claims.role as SystemRole) || null;

        let role: SystemRole = claimRole || 'cashier';
        let isActive = true;
        let displayName = fbUser.displayName || cleanEmail.split('@')[0];

        if (db) {
          try {
            const userDocRef = doc(db, 'users', fbUser.uid);
            const snap = await getDoc(userDocRef);
            if (snap.exists()) {
              const data = snap.data();
              role = (claimRole || data.role || 'cashier') as SystemRole;
              isActive = data.isActive !== false;
              if (data.displayName) {
                displayName = data.displayName;
              }

              // Registrar última hora de inicio de sesión
              await updateDoc(userDocRef, {
                lastLoginAt: new Date().toISOString()
              }).catch(() => {});
            } else {
              // Si el documento en /users/{uid} no existe aún en Firestore, se inicializa
              const initialRole: SystemRole =
                claimRole ||
                (cleanEmail === 'yeiberpedrozo@gmail.com' || cleanEmail.includes('admin')
                  ? 'admin'
                  : cleanEmail.includes('gate')
                  ? 'gate_operator'
                  : 'cashier');
              const initialDisplayName =
                fbUser.displayName ||
                (cleanEmail === 'yeiberpedrozo@gmail.com'
                  ? 'Yeiber Pedrozo (Super Administrador)'
                  : cleanEmail.split('@')[0]);

              const newUserDoc = {
                uid: fbUser.uid,
                email: cleanEmail,
                displayName: initialDisplayName,
                role: initialRole,
                isActive: true,
                createdAt: fbUser.metadata.creationTime || new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                lastLoginAt: new Date().toISOString()
              };

              await setDoc(userDocRef, newUserDoc).catch((e) => {
                console.warn('[AuthService] No se pudo crear doc inicial en Firestore:', e);
              });

              role = initialRole;
              displayName = initialDisplayName;
            }
          } catch (err) {
            console.warn('[AuthService] Advertencia al verificar documento en /users:', err);
          }
        }

        if (!isActive) {
          await fbSignOut(auth).catch(() => {});
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
        this.sessionSource = 'firebase';
        this.saveLocalSession(loggedUser, 'firebase');
        this.notifyListeners();
        return loggedUser;
      } catch (err: any) {
        if (err.message && err.message.startsWith('ACCOUNT_DISABLED')) {
          throw err;
        }
        firebaseAuthError = err;
        console.warn('[AuthService] Firebase Auth aviso al autenticar:', err.code || err.message);

        // Si Firebase Authentication aún no ha sido habilitado en Firebase Console (CONFIGURATION_NOT_FOUND)
        // o no está disponible el proveedor, permitir el acceso con cuentas de verificación autorizadas
        const isConfigMissing =
          err.message?.includes('CONFIGURATION_NOT_FOUND') ||
          err.code === 'auth/configuration-not-found' ||
          err.code === 'auth/operation-not-allowed' ||
          err.code === 'auth/internal-error';

        const devAccount = MOCK_DEV_ACCOUNTS[cleanEmail];
        if (isConfigMissing && devAccount && devAccount.password === pass) {
          if (!devAccount.user.isActive) {
            throw new Error('ACCOUNT_DISABLED: Esta cuenta de usuario se encuentra desactivada por la administración.');
          }
          const sessionUser: SystemUser = {
            ...devAccount.user,
            lastLoginAt: new Date().toISOString()
          };
          this.currentUser = sessionUser;
          this.sessionSource = 'local';
          this.saveLocalSession(sessionUser, 'local');
          this.notifyListeners();
          return sessionUser;
        }

        // Cuando Firebase está configurado en producción, no se debe enmascarar un fallo de credenciales
        throw new Error(this.mapAuthError(firebaseAuthError.code || firebaseAuthError.message));
      }
    }

    if (isProductionEnvironment) {
      if (firebaseAuthError) {
        throw new Error(this.mapAuthError(firebaseAuthError.code || firebaseAuthError.message));
      }
      throw new Error('La autenticación en producción requiere conexión activa a Firebase.');
    }

    // Si Firebase no está configurado (modo offline local), se permite el fallback de desarrollo
    const devAccount = MOCK_DEV_ACCOUNTS[cleanEmail];
    if (devAccount) {
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
      this.sessionSource = 'local';
      this.saveLocalSession(sessionUser, 'local');
      this.notifyListeners();
      return sessionUser;
    }

    if (firebaseAuthError) {
      throw new Error(this.mapAuthError(firebaseAuthError.code || firebaseAuthError.message));
    }

    throw new Error('Correo electrónico o contraseña incorrectos.');
  }

  /**
   * Cierre de sesión seguro
   */
  public async logout(): Promise<void> {
    const wasFirebase = this.sessionSource === 'firebase';
    this.currentUser = null;
    this.sessionSource = 'local';
    this.saveLocalSession(null);
    this.notifyListeners();

    if (wasFirebase && this.hasLiveFirebase() && auth) {
      try {
        await fbSignOut(auth);
      } catch {
        // Ignorar fallos de red al cerrar sesión
      }
    }
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
    return [
      {
        email: 'yeiberpedrozo@gmail.com',
        password: 'AdminPassword2026!',
        role: 'admin' as SystemRole,
        displayName: 'Yeiber Pedrozo (Super Admin)',
        isActive: true
      },
      {
        email: 'admin@shikkum.com',
        password: 'AdminPassword2026!',
        role: 'admin' as SystemRole,
        displayName: 'Administrador General',
        isActive: true
      },
      {
        email: 'cashier@shikkum.com',
        password: 'CashierPassword2026!',
        role: 'cashier' as SystemRole,
        displayName: 'Personal de Cobranzas',
        isActive: true
      },
      {
        email: 'gate@shikkum.com',
        password: 'GatePassword2026!',
        role: 'gate_operator' as SystemRole,
        displayName: 'Operador de Puerta',
        isActive: true
      },
      {
        email: 'disabled@shikkum.com',
        password: 'DisabledPassword2026!',
        role: 'cashier' as SystemRole,
        displayName: 'Usuario Desactivado',
        isActive: false
      }
    ];
  }
}

export const authService = new AuthService();
