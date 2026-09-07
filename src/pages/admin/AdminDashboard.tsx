import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { Shield, Users, CheckCircle, Database, Lock, KeyRound } from 'lucide-react';

interface AdminDashboardProps {
  onNavigate: (path: string) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onNavigate }) => {
  const { user } = useAuth();

  return (
    <div className="space-y-8">
      {/* Header card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="p-2 bg-indigo-600/10 text-indigo-400 border border-indigo-500/20 rounded-xl">
                <Shield className="w-5 h-5" />
              </span>
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-400">
                Fase 2: RBAC Activo
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Panel Administrativo
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Control centralizado de identidades, roles de seguridad y políticas de acceso para SHIKKUM.
            </p>
          </div>

          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold rounded-xl self-start sm:self-auto">
            <CheckCircle className="w-4 h-4" />
            <span>RBAC Verificado (Nivel 1: Admin)</span>
          </div>
        </div>

        {/* User Identity Info Banner */}
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-950/60 border border-slate-800/80 rounded-xl p-4">
          <div>
            <span className="text-xs font-medium text-slate-400 block mb-1">Usuario:</span>
            <span className="text-sm font-semibold text-white truncate block">{user?.email}</span>
            <span className="text-[11px] text-slate-500">{user?.displayName}</span>
          </div>
          <div>
            <span className="text-xs font-medium text-slate-400 block mb-1">Rol:</span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-xs font-bold bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 font-mono">
              <KeyRound className="w-3 h-3" />
              {user?.role}
            </span>
            <span className="text-[11px] text-slate-500 block mt-1">Super Administrador</span>
          </div>
          <div>
            <span className="text-xs font-medium text-slate-400 block mb-1">Estado:</span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              {user?.isActive ? 'Activo (Acceso total)' : 'Inactivo'}
            </span>
            <span className="text-[11px] text-slate-500 block mt-1">
              Último login: {user?.lastLoginAt ? new Date(user.lastLoginAt).toLocaleTimeString() : 'Sesión actual'}
            </span>
          </div>
        </div>
      </div>

      {/* Grid de módulos en espera (Fase 3+) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-slate-900 border border-slate-800/80 rounded-2xl p-6">
          <div className="w-12 h-12 bg-indigo-500/10 text-indigo-400 rounded-xl flex items-center justify-center mb-4 border border-indigo-500/20">
            <Users className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-white mb-1">Gestión de Operadores</h3>
          <p className="text-xs text-slate-400 mb-4 leading-relaxed">
            Creación segura de cuentas para Cobranzas y Operadores de Puerta mediante Cloud Functions.
          </p>
          <div className="text-[11px] text-indigo-400 font-medium bg-indigo-950/40 border border-indigo-800/30 rounded-lg px-3 py-2">
            Colección: <code className="font-mono font-bold">/users/{'{uid}'}</code> protegida por Custom Claims.
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800/80 rounded-2xl p-6">
          <div className="w-12 h-12 bg-emerald-500/10 text-emerald-400 rounded-xl flex items-center justify-center mb-4 border border-emerald-500/20">
            <Database className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-white mb-1">Matriz de Precios y Eventos</h3>
          <p className="text-xs text-slate-400 mb-4 leading-relaxed">
            Configuración de eventos, aforos y tarifas dinámicas en Firestore (programado para fases posteriores).
          </p>
          <div className="text-[11px] text-slate-400 font-medium bg-slate-950/40 border border-slate-800 rounded-lg px-3 py-2">
            Estado: <span className="text-amber-400 font-semibold">En espera según directiva</span>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800/80 rounded-2xl p-6">
          <div className="w-12 h-12 bg-purple-500/10 text-purple-400 rounded-xl flex items-center justify-center mb-4 border border-purple-500/20">
            <Lock className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-white mb-1">Políticas de Acceso RBAC</h3>
          <p className="text-xs text-slate-400 mb-4 leading-relaxed">
            Como <code className="text-indigo-400 font-bold">admin</code>, tienes autorización total para inspeccionar todas las rutas del sistema.
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => onNavigate('/cashier')}
              className="flex-1 text-xs py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 font-medium transition"
            >
              Ver /cashier
            </button>
            <button
              onClick={() => onNavigate('/gate')}
              className="flex-1 text-xs py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 font-medium transition"
            >
              Ver /gate
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
