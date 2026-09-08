import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getFunctions, Functions } from 'firebase/functions';
import { getStorage, FirebaseStorage } from 'firebase/storage';

/**
 * Configuración oficial del proyecto Firebase para SHIKKUM
 * Project ID: shikkum-7a238
 * Web App ID: 1:128758477432:web:4b6c7282909cc5a939b38d
 */
const env = (import.meta as any).env || {};

export const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || '',
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || 'shikkum-7a238.firebaseapp.com',
  projectId: env.VITE_FIREBASE_PROJECT_ID || 'shikkum-7a238',
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || 'shikkum-7a238.firebasestorage.app',
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || '128758477432',
  appId: env.VITE_FIREBASE_APP_ID || '1:128758477432:web:4b6c7282909cc5a939b38d'
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
    dbInstance = getFirestore(appInstance);
    functionsInstance = getFunctions(appInstance);
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

