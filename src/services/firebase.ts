import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, initializeFirestore, Firestore } from 'firebase/firestore';
import { getFunctions, Functions } from 'firebase/functions';
import { getStorage, FirebaseStorage } from 'firebase/storage';

/**
 * Configuración oficial del proyecto Firebase para SHIKKUM
 * Project ID: shikkum-7a238
 * Web App ID: 1:128758477432:web:4b6c7282909cc5a939b38d
 */
const env = (import.meta as any).env || {};

export const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || 'AIzaSyBdxqxBRD9wmCbsOOG-eBIFhl_cVew5lEs',
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || 'shikkum-7a238.firebaseapp.com',
  projectId: env.VITE_FIREBASE_PROJECT_ID || 'shikkum-7a238',
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || 'shikkum-7a238.firebasestorage.app',
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || '128758477432',
  appId: env.VITE_FIREBASE_APP_ID || '1:128758477432:web:4b6c7282909cc5a939b38d',
  measurementId: env.VITE_FIREBASE_MEASUREMENT_ID || 'G-2FS1WCVWS0'
};

/**
 * Valida si se dispone de una clave API válida de Firebase para la inicialización activa.
 * Las claves Web de Firebase son cadenas no vacías (generalmente inician con 'AIza' y > 15 caracteres).
 */
export const isFirebaseConfigured: boolean = Boolean(
  firebaseConfig.apiKey &&
  typeof firebaseConfig.apiKey === 'string' &&
  firebaseConfig.apiKey.trim().length > 15 &&
  !firebaseConfig.apiKey.startsWith('YOUR_') &&
  !firebaseConfig.apiKey.includes('placeholder')
);

/**
 * Identificación inequívoca del entorno de ejecución (Desarrollo/Testing vs Producción).
 * En producción se exige Firebase configurado para cualquier transacción real.
 */
export const isProductionEnvironment: boolean = Boolean(env.PROD || env.MODE === 'production');
export const isDevelopmentSandbox: boolean = !isFirebaseConfigured;

let appInstance: FirebaseApp | null = null;
let authInstance: Auth | null = null;
let dbInstance: Firestore | null = null;
let functionsInstance: Functions | null = null;
let storageInstance: FirebaseStorage | null = null;

if (isFirebaseConfigured) {
  try {
    appInstance = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    authInstance = getAuth(appInstance);
    try {
      dbInstance = initializeFirestore(appInstance, {
        experimentalAutoDetectLongPolling: true
      });
    } catch {
      dbInstance = getFirestore(appInstance);
    }
    functionsInstance = getFunctions(appInstance, 'us-central1');
    storageInstance = getStorage(appInstance);
  } catch (error) {
    console.warn('[SHIKKUM] No se pudo inicializar Firebase en vivo:', error);
    appInstance = null;
    authInstance = null;
    dbInstance = null;
    functionsInstance = null;
    storageInstance = null;
  }
} else if (isProductionEnvironment) {
  console.error(
    '[SHIKKUM CRÍTICO] La aplicación se encuentra en modo producción pero no tiene VITE_FIREBASE_API_KEY configurada. Operaciones reales bloqueadas.'
  );
}

// Exportar instancias auténticas de Firebase SDK.
// NUNCA exportar proxies vacíos que rompan validaciones internas del SDK modular en collection() o doc()
export const app = appInstance as FirebaseApp;
export const auth = authInstance as Auth;
export const db = dbInstance as Firestore;
export const functions = functionsInstance as Functions;
export const storage = storageInstance as FirebaseStorage;

/**
 * Control de resiliencia y salud de Firestore y Cloud Functions.
 * Previene demoras y bloqueos de interfaz si Firestore API está deshabilitada en GCP
 * o si Cloud Functions no han sido desplegadas en el proyecto de Firebase.
 */
const FIRESTORE_DISABLED_FLAG_KEY = 'shikkum_firestore_api_disabled_v1';
const FIRESTORE_LAST_FAIL_TIME_KEY = 'shikkum_firestore_last_fail_time_v1';
const FIRESTORE_SESSION_HEALTHY_KEY = 'shikkum_firestore_session_healthy_v1';
const FUNCTIONS_SESSION_HEALTHY_KEY = 'shikkum_functions_session_healthy_v1';

// Verificar estado previo persistido
const getInitialFirestoreHealthy = (): boolean => {
  if (!isFirebaseConfigured || !dbInstance) return false;
  try {
    const disabledFlag = localStorage.getItem(FIRESTORE_DISABLED_FLAG_KEY) || sessionStorage.getItem(FIRESTORE_DISABLED_FLAG_KEY);
    const lastFail = localStorage.getItem(FIRESTORE_LAST_FAIL_TIME_KEY) || sessionStorage.getItem(FIRESTORE_LAST_FAIL_TIME_KEY);
    if (disabledFlag === 'true' && lastFail) {
      const elapsed = Date.now() - Number(lastFail);
      if (elapsed < 300000) { // 5 minutos de memoria caché si la API está deshabilitada en GCP
        return false;
      }
    }
    const cached = sessionStorage.getItem(FIRESTORE_SESSION_HEALTHY_KEY);
    if (cached === 'false') return false;
    if (cached === 'true') return true;
  } catch {
    // sessionStorage inaccesible en algunos iframes
  }
  return true;
};

let firestoreHealthy: boolean = getInitialFirestoreHealthy();
let lastFirestoreCheckTime: number = firestoreHealthy ? 0 : Date.now();
let functionsHealthy: boolean = isFirebaseConfigured;
let lastFunctionsCheckTime: number = 0;
let lastWarnLogTime: number = 0;

/**
 * Prueba activa no bloqueante contra el endpoint REST de Firestore en GCP.
 * Detecta en ~150ms si Cloud Firestore API está deshabilitada en el proyecto GCP (HTTP 403 SERVICE_DISABLED).
 * Esto evita esperar los timeouts del SDK de Firestore.
 */
export async function probeFirestoreApi(): Promise<boolean> {
  if (!isFirebaseConfigured || !firebaseConfig.projectId) return false;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2000);
    const res = await fetch(
      `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents/orders?key=${firebaseConfig.apiKey}`,
      { signal: controller.signal }
    );
    clearTimeout(timer);

    if (res.status === 403) {
      const data = await res.json().catch(() => null);
      const isServiceDisabled =
        data?.error?.details?.[0]?.reason === 'SERVICE_DISABLED' ||
        data?.error?.message?.includes('disabled') ||
        data?.error?.message?.includes('has not been used');

      if (isServiceDisabled) {
        firestoreHealthy = false;
        lastFirestoreCheckTime = Date.now();
        try {
          localStorage.setItem(FIRESTORE_DISABLED_FLAG_KEY, 'true');
          localStorage.setItem(FIRESTORE_LAST_FAIL_TIME_KEY, String(Date.now()));
          sessionStorage.setItem(FIRESTORE_SESSION_HEALTHY_KEY, 'false');
        } catch {
          // ignorar
        }
        return false;
      } else {
        // La base de datos está creada y activa en Google Cloud (respondiendo reglas de seguridad)
        firestoreHealthy = true;
        try {
          localStorage.removeItem(FIRESTORE_DISABLED_FLAG_KEY);
          localStorage.removeItem(FIRESTORE_LAST_FAIL_TIME_KEY);
          sessionStorage.setItem(FIRESTORE_SESSION_HEALTHY_KEY, 'true');
        } catch {
          // ignorar
        }
        return true;
      }
    }

    if (res.ok || res.status === 404 || res.status === 200) {
      firestoreHealthy = true;
      try {
        localStorage.removeItem(FIRESTORE_DISABLED_FLAG_KEY);
        localStorage.removeItem(FIRESTORE_LAST_FAIL_TIME_KEY);
        sessionStorage.setItem(FIRESTORE_SESSION_HEALTHY_KEY, 'true');
      } catch {
        // ignorar
      }
      return true;
    }
  } catch {
    // En caso de fallo de red o aborto, mantener estado actual
  }
  return firestoreHealthy;
}

// Ejecutar sonda inicial de manera inmediata y no bloqueante
if (isFirebaseConfigured) {
  probeFirestoreApi();
}

export const isFirestoreHealthy = (): boolean => {
  if (!isFirebaseConfigured || !dbInstance) return false;
  if (!firestoreHealthy) {
    // Si no está saludable, no reintentar antes de 5 minutos
    if (Date.now() - lastFirestoreCheckTime < 300000) {
      return false;
    }
    // Después de 5 minutos, lanzar una sonda en background sin bloquear la consulta actual
    probeFirestoreApi();
    return false;
  }
  return true;
};

export const markFirestoreFailure = (error?: any) => {
  firestoreHealthy = false;
  lastFirestoreCheckTime = Date.now();
  try {
    sessionStorage.setItem(FIRESTORE_SESSION_HEALTHY_KEY, 'false');
    localStorage.setItem(FIRESTORE_LAST_FAIL_TIME_KEY, String(Date.now()));
  } catch {
    // ignorar
  }

  // Limitar logs a uno cada 60 segundos para evitar saturación de consola
  if (Date.now() - lastWarnLogTime > 60000) {
    lastWarnLogTime = Date.now();
    const errMsg = error?.message || String(error || '');
    console.info('[Firebase Resilience] Conmutando a almacenamiento resiliente local:', errMsg);
  }
};

export const markFirestoreSuccess = () => {
  firestoreHealthy = true;
  lastFirestoreCheckTime = Date.now();
  try {
    localStorage.removeItem(FIRESTORE_DISABLED_FLAG_KEY);
    sessionStorage.setItem(FIRESTORE_SESSION_HEALTHY_KEY, 'true');
  } catch {
    // ignorar
  }
};

export const resetFirestoreHealthCheck = () => {
  firestoreHealthy = true;
  lastFirestoreCheckTime = 0;
  try {
    localStorage.removeItem(FIRESTORE_DISABLED_FLAG_KEY);
    localStorage.removeItem(FIRESTORE_LAST_FAIL_TIME_KEY);
    sessionStorage.removeItem(FIRESTORE_SESSION_HEALTHY_KEY);
  } catch {
    // ignorar
  }
};

export const isFunctionsHealthy = (): boolean => {
  if (!isFirebaseConfigured || !functionsInstance) return false;
  if (!functionsHealthy && Date.now() - lastFunctionsCheckTime > 60000) {
    functionsHealthy = true;
    return true;
  }
  return functionsHealthy;
};

export const markFunctionsFailure = (_error?: any) => {
  functionsHealthy = false;
  lastFunctionsCheckTime = Date.now();
  try {
    sessionStorage.setItem(FUNCTIONS_SESSION_HEALTHY_KEY, 'false');
  } catch {
    // ignorar
  }
};

export const markFunctionsSuccess = () => {
  functionsHealthy = true;
  lastFunctionsCheckTime = Date.now();
  try {
    sessionStorage.setItem(FUNCTIONS_SESSION_HEALTHY_KEY, 'true');
  } catch {
    // ignorar
  }
};

/**
 * Envoltorio para operaciones asíncronas con límite de tiempo controlado (timeout).
 * Tiempo límite equilibrado para evitar congelamiento de UI (3.5 segundos por defecto).
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number = 3500,
  timeoutMessage: string = 'La operación remota excedió el tiempo límite de espera.'
): Promise<T> {
  let timer: any;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`TIMEOUT: ${timeoutMessage}`));
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timer);
    return result;
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

