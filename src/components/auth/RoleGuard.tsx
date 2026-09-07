import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { SystemRole } from '../../types';
import { ShieldX, ArrowRight, LogOut } from 'lucide-react';
import { authService } from '../../services/auth.service';

interface RoleGuardProps {
  allowedRoles: SystemRole[];
  currentPathName: string;
  children: React.ReactNode;
  onNavigateToRoleHome?: (path: string) => void;
}

export const RoleGuard: React.FC<RoleGuardProps> = ({
  allowedRoles,
  currentPathName,
  children,
  onNavigateToRoleHome
}) => {
  const { user, logout } = useAuth();

  if (!user) {
    return null;
  }

  const isPermitted = allowedRoles.includes(user.role);

  if (!isPermitted) {
    const roleLabels: Record<SystemRole, string> = {
      admin: 'Administrador General',
      cashier: 'Cobranzas',
      gate_operator: 'Operador de Puerta'
    };

    const targetRoleUrl = authService.getRedirectPathForRole(user.role);

    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-slate-100">
        <div className="max-w-md w-full bg-slate-900 border border-amber-500/30 rounded-2xl p-8 shadow-2xl text-center">
          <div className="w-16 h-16 bg-amber-500/10 text-amber-400 rounded-2xl mx-auto flex items-center justify-center mb-5 border border-amber-500/20">
            <ShieldX className="w-8 h-8" />
          </div>

          <span className="inline-block px-3 py-1 bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-semibold uppercase tracking-wider rounded-full mb-3">
            Acceso Denegado (HTTP 403)
          </span>

          <h2 className="text-xl font-bold text-slate-100 mb-2">Área Restringida por Rol</h2>

          <p className="text-sm text-slate-400 mb-6 leading-relaxed">
            Tu rol actual no posee los privilegios requeridos para ingresar a esta sección ({currentPathName}). La política RBAC de SHIKKUM restringe esta vista exclusivamente a roles autorizados.
          </p>

          <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 mb-6 text-xs text-left space-y-1.5 font-mono">
            <div className="text-slate-400">
              <span className="text-slate-500">Usuario:</span> <span className="text-slate-200">{user.email}</span>
            </div>
            <div className="text-slate-400">
              <span className="text-slate-500">Tu Rol actual:</span> <span className="text-amber-400 font-bold">{user.role} ({roleLabels[user.role]})</span>
            </div>
            <div className="text-slate-400">
              <span className="text-slate-500">Roles permitidos en esta área:</span>{' '}
              <span className="text-emerald-400 font-semibold">{allowedRoles.join(', ')}</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            {onNavigateToRoleHome && (
              <button
                onClick={() => onNavigateToRoleHome(targetRoleUrl)}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-xl transition shadow-lg shadow-indigo-600/20"
              >
                <span>Ir a mi panel ({targetRoleUrl})</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}

            <button
              onClick={() => logout()}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium rounded-xl transition border border-slate-700"
            >
              <LogOut className="w-4 h-4" />
              <span>Cerrar sesión</span>
            </button>
          </div>
        </div>

        <footer className="mt-8 text-xs text-slate-600">
          SHIKKUM © 2026 — Programa desarrollado por Yeiber Pedrozo — Todos los derechos reservados.
        </footer>
      </div>
    );
  }

  return <>{children}</>;
};
