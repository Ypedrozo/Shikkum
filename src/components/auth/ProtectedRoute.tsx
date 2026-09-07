import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { ShieldAlert, LogOut } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  onNavigateToLogin?: () => void;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  onNavigateToLogin
}) => {
  const { user, isLoading, logout } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-slate-200">
        <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-sm font-medium tracking-wide">Validando credenciales en SHIKKUM...</p>
      </div>
    );
  }

  // 1. Usuario no autenticado: Redirección inmediata a /login
  if (!user) {
    if (onNavigateToLogin) {
      onNavigateToLogin();
    }
    return null;
  }

  // 2. Usuario con isActive = false: Bloqueo estricto con mensaje claro
  if (!user.isActive) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6">
        <div className="max-w-md w-full bg-slate-900 border border-red-500/30 rounded-2xl p-8 shadow-2xl text-center">
          <div className="w-16 h-16 bg-red-500/10 text-red-400 rounded-2xl mx-auto flex items-center justify-center mb-5 border border-red-500/20">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-100 mb-2">Cuenta Inhabilitada</h2>
          <p className="text-sm text-slate-400 mb-6 leading-relaxed">
            La cuenta asociada al usuario <span className="font-semibold text-slate-200">{user.email}</span> ha sido desactivada temporalmente por la administración del sistema. No tienes acceso a las operaciones operativas de SHIKKUM.
          </p>
          <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-3.5 mb-6 text-xs text-slate-400 text-left font-mono">
            <div><strong>UID:</strong> {user.uid}</div>
            <div><strong>Rol registrado:</strong> {user.role}</div>
            <div><strong>Estado:</strong> <span className="text-red-400 font-bold">Inactivo (isActive = false)</span></div>
          </div>
          <button
            onClick={() => logout()}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium rounded-xl transition border border-slate-700"
          >
            <LogOut className="w-4 h-4" />
            Cerrar Sesión
          </button>
        </div>
        <footer className="mt-8 text-xs text-slate-600">
          SHIKKUM © 2026 — Programa desarrollado por Yeiber Pedrozo — Todos los derechos reservados.
        </footer>
      </div>
    );
  }

  return <>{children}</>;
};
