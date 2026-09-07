import React from 'react';
import { useAuth } from '../context/AuthContext';
import { LogOut, User as UserIcon, LayoutDashboard, Users, ShoppingBag, Plus, Ticket } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  currentPath: string;
  onNavigate: (path: string) => void;
}

export const CashierLayout: React.FC<LayoutProps> = ({ children, currentPath, onNavigate }) => {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Bar */}
      <header className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              onClick={() => onNavigate('/cashier')}
              className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white font-black tracking-wider shadow-lg shadow-emerald-600/20 cursor-pointer"
            >
              CO
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span
                  onClick={() => onNavigate('/cashier')}
                  className="font-extrabold text-lg tracking-tight text-white cursor-pointer hover:text-emerald-300 transition"
                >
                  SHIKKUM
                </span>
                <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full uppercase">
                  Cobranzas
                </span>
              </div>
              <p className="text-xs text-slate-400">Punto de Venta y Gestión de Pagos</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Navegación para verificación de RBAC */}
            <nav className="hidden lg:flex items-center gap-1 bg-slate-950/80 p-1 rounded-xl border border-slate-800 text-xs">
              <button
                onClick={() => onNavigate('/admin')}
                title="Intento de acceso a Admin (probar RBAC)"
                className={`px-2.5 py-1 rounded-lg font-medium transition ${
                  currentPath.startsWith('/admin')
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
              >
                /admin (Test)
              </button>
              <button
                onClick={() => onNavigate('/cashier')}
                className={`px-2.5 py-1 rounded-lg font-medium transition ${
                  currentPath.startsWith('/cashier')
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
              >
                /cashier
              </button>
              <button
                onClick={() => onNavigate('/gate')}
                title="Intento de acceso a Gate (probar RBAC)"
                className={`px-2.5 py-1 rounded-lg font-medium transition ${
                  currentPath.startsWith('/gate')
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
              >
                /gate (Test)
              </button>
            </nav>

            {/* User badge & Logout */}
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex flex-col text-right">
                <span className="text-xs font-semibold text-slate-200 flex items-center justify-end gap-1.5">
                  <UserIcon className="w-3.5 h-3.5 text-emerald-400" />
                  {user?.displayName || user?.email}
                </span>
                <span className="text-[11px] text-slate-400 font-mono">
                  Rol: <span className="text-emerald-400 font-bold">{user?.role}</span> | Activo: <span className="text-emerald-400 font-bold">Sí</span>
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
        </div>

        {/* Navegación Principal de Cobranzas: Dashboard, Clientes */}
        <div className="bg-slate-950/90 border-t border-slate-800/80 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto flex items-center gap-1 sm:gap-2 overflow-x-auto py-2">
            <button
              onClick={() => onNavigate('/cashier')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                currentPath === '/cashier' || currentPath === '/cashier/'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span>Dashboard</span>
            </button>

            <button
              onClick={() => onNavigate('/cashier/customers')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                currentPath.startsWith('/cashier/customers')
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Clientes</span>
            </button>

            <button
              onClick={() => onNavigate('/cashier/orders')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                currentPath.startsWith('/cashier/orders') && currentPath !== '/cashier/orders/new'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>Órdenes</span>
            </button>

            <button
              onClick={() => onNavigate('/cashier/tickets')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                currentPath.startsWith('/cashier/tickets')
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              <Ticket className="w-3.5 h-3.5" />
              <span>Boletos</span>
            </button>

            <button
              onClick={() => onNavigate('/cashier/orders/new')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition ml-auto ${
                currentPath === '/cashier/orders/new'
                  ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/30'
                  : 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-600 hover:text-white'
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Nueva Orden</span>
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
            className="text-xs px-2.5 py-1 rounded font-medium bg-emerald-600 text-white"
          >
            /cashier
          </button>
          <button
            onClick={() => onNavigate('/gate')}
            className="text-xs px-2.5 py-1 rounded font-medium text-slate-400"
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
