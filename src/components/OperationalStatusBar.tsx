import React, { useState, useEffect } from 'react';
import { isFirebaseConfigured, firebaseConfig, isFirestoreHealthy, probeFirestoreApi } from '../services/firebase';
import { WifiOff, Database } from 'lucide-react';

export const OperationalStatusBar: React.FC = () => {
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <>
      {/* Alerta si el dispositivo pierde conexión en Modo Producción */}
      {!isOnline && isFirebaseConfigured && (
        <div
          id="offline-production-alert"
          className="bg-rose-900/90 text-rose-100 border-b border-rose-700 px-4 py-2.5 text-xs flex items-center justify-between shadow-lg"
        >
          <div className="flex items-center gap-2 max-w-5xl mx-auto w-full">
            <WifiOff className="w-4 h-4 text-rose-300 flex-shrink-0 animate-pulse" />
            <span>
              <strong>ATENCIÓN — CONEXIÓN PERDIDA:</strong> La aplicación opera en{' '}
              <span className="font-semibold underline">MODO PRODUCCIÓN</span>. Para garantizar la
              integridad de las transacciones e impedir datos huérfanos, no se permiten escrituras
              simuladas locales sin sincronización. Restablezca su red.
            </span>
          </div>
        </div>
      )}
    </>
  );
};

export const OperationalModeBadge: React.FC = () => {
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [dbHealthy, setDbHealthy] = useState<boolean>(isFirestoreHealthy());

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    if (isFirebaseConfigured) {
      probeFirestoreApi().then((healthy) => {
        setDbHealthy(healthy);
      });
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isFirebaseConfigured) {
    return (
      <div
        id="operational-mode-badge-prod"
        className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-emerald-950/80 border border-emerald-500/30 text-emerald-300"
        title={`Base de datos Firestore activa y conectada en proyecto: ${firebaseConfig.projectId}`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${isOnline && dbHealthy ? 'bg-emerald-400 animate-pulse' : 'bg-emerald-400'}`} />
        <Database className="w-3.5 h-3.5 text-emerald-400" />
        <span className="font-bold">FIRESTORE EN VIVO</span>
        <span className="text-emerald-500/70">|</span>
        <span className="text-emerald-400 font-mono text-[10px]">{firebaseConfig.projectId}</span>
      </div>
    );
  }

  return (
    <div
      id="operational-mode-badge-sandbox"
      className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-amber-950/80 border border-amber-500/30 text-amber-300"
      title="Ejecutando en Sandbox de demostración local"
    >
      <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
      <span className="font-bold">MODO DEMO / SANDBOX</span>
    </div>
  );
};
