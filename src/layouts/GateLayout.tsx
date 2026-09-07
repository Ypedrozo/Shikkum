import React from 'react';
import { useAuth } from '../context/AuthContext';
import { LogOut, User as UserIcon, QrCode, LayoutDashboard, DollarSign } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  currentPath: string;
  onNavigate: (path: string) => void;
}

export const GateLayout: React.FC<LayoutProps> = ({ children, currentPath, onNavigate }) => {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Bar */}
      <header className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-600 flex items-center justify-center text-white font-black tracking-wider shadow-lg shadow-cyan-600/20">
              GT
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-lg tracking-tight text-white">SHIKKUM</span>
                <span className="px-2 py-0.5 text-[10px] font-bold bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 rounded-full uppercase">
                  Control de Puerta
                </span>
              </div>
              <p className="text-xs text-slate-400">Validación de Boletos y Acceso</p>
            </div>
          </div>

          {/* Navegación para verificación de RBAC */}
          <nav className="hidden md:flex items-center gap-1 bg-slate-950/80 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => onNavigate('/admin')}
              title="Intento de acceso a Admin (probar RBAC)"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                currentPath.startsWith('/admin')
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span>/admin (Test)</span>
            </button>
            <button
              onClick={() => onNavigate('/cashier')}
              title="Intento de acceso a Cashier (probar RBAC)"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                currentPath.startsWith('/cashier')
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <DollarSign className="w-3.5 h-3.5" />
              <span>/cashier (Test)</span>
            </button>
            <button
              onClick={() => onNavigate('/gate')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                currentPath.startsWith('/gate')
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>/gate</span>
            </button>
          </nav>

          {/* User badge & Logout */}
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex flex-col text-right">
              <span className="text-xs font-semibold text-slate-200 flex items-center justify-end gap-1.5">
                <UserIcon className="w-3.5 h-3.5 text-cyan-400" />
                {user?.displayName || user?.email}
              </span>
              <span className="text-[11px] text-slate-400 font-mono">
                Rol: <span className="text-cyan-400 font-bold">{user?.role}</span> | Activo: <span className="text-emerald-400 font-bold">Sí</span>
              </span>
            </div>

            <button
              onClick={() => logout()}
              title="Cerrar Sesión"
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Barra de prueba móvil */}
        <div className="md:hidden flex items-center justify-around border-t border-slate-800/80 px-2 py-1.5 bg-slate-950/60">
          <button
            onClick={() => onNavigate('/admin')}
            className="text-xs px-2.5 py-1 rounded font-medium text-slate-400"
          >
            /admin
          </button>
          <button
            onClick={() => onNavigate('/cashier')}
            className="text-xs px-2.5 py-1 rounded font-medium text-slate-400"
          >
            /cashier
          </button>
          <button
            onClick={() => onNavigate('/gate')}
            className="text-xs px-2.5 py-1 rounded font-medium bg-cyan-600 text-white"
          >
            /gate
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>

      {/* Official Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-6 text-center text-xs text-slate-500">
        <p>SHIKKUM © 2026 — Programa desarrollado por Yeiber Pedrozo — Todos los derechos reservados.</p>
      </footer>
    </div>
  );
};
