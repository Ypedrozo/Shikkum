import React from 'react';
import { useAuth } from '../context/AuthContext';
import { OperationalStatusBar, OperationalModeBadge } from '../components/OperationalStatusBar';
import {
  LogOut,
  User as UserIcon,
  LayoutDashboard,
  DollarSign,
  Users,
  Calendar,
  ShoppingBag,
  CreditCard,
  Ticket,
  Mail,
  FileText,
  ShieldAlert
} from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  currentPath: string;
  onNavigate: (path: string) => void;
}

export const AdminLayout: React.FC<LayoutProps> = ({ children, currentPath, onNavigate }) => {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <OperationalStatusBar />
      {/* Top Bar */}
      <header className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              onClick={() => onNavigate('/admin')}
              className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-black tracking-wider shadow-lg shadow-indigo-600/20 cursor-pointer"
            >
              SH
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span
                  onClick={() => onNavigate('/admin')}
                  className="font-extrabold text-lg tracking-tight text-white cursor-pointer hover:text-indigo-300 transition"
                >
                  SHIKKUM
                </span>
                <span className="px-2 py-0.5 text-[10px] font-bold bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 rounded-full uppercase">
                  Admin Master
                </span>
                <OperationalModeBadge />
              </div>
              <p className="text-xs text-slate-400">Sistema Integral de Eventos y Accesos</p>
            </div>
          </div>

          {/* Selector de navegación para pruebas de RBAC */}
          <div className="flex items-center gap-3">
            <nav className="hidden lg:flex items-center gap-1 bg-slate-950/80 p-1 rounded-xl border border-slate-800 text-xs">
              <button
                onClick={() => onNavigate('/admin')}
                className={`px-2.5 py-1 rounded-lg font-medium transition ${
                  currentPath.startsWith('/admin')
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                /admin
              </button>
              <button
                onClick={() => onNavigate('/cashier')}
                className={`px-2.5 py-1 rounded-lg font-medium transition ${
                  currentPath.startsWith('/cashier')
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                /cashier
              </button>
              <button
                onClick={() => onNavigate('/gate')}
                className={`px-2.5 py-1 rounded-lg font-medium transition ${
                  currentPath.startsWith('/gate')
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                /gate
              </button>
            </nav>

            {/* User badge & Logout */}
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex flex-col text-right">
                <span className="text-xs font-semibold text-slate-200 flex items-center justify-end gap-1.5">
                  <UserIcon className="w-3.5 h-3.5 text-indigo-400" />
                  {user?.displayName || user?.email}
                </span>
                <span className="text-[11px] text-slate-400 font-mono">
                  Rol: <span className="text-indigo-400 font-bold">{user?.role}</span> | Activo: <span className="text-emerald-400 font-bold">Sí</span>
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

        {/* Navegación Principal de Administrador: Dashboard, Clientes, Eventos, Precios */}
        <div className="bg-slate-950/90 border-t border-slate-800/80 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto flex items-center gap-1 sm:gap-2 overflow-x-auto py-2">
            <button
              onClick={() => onNavigate('/admin')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                currentPath === '/admin' || currentPath === '/admin/'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span>Dashboard</span>
            </button>

            <button
              onClick={() => onNavigate('/admin/customers')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                currentPath.startsWith('/admin/customers')
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Clientes</span>
            </button>

            <button
              onClick={() => onNavigate('/admin/events')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                currentPath.startsWith('/admin/events')
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Eventos</span>
            </button>

            <button
              onClick={() => onNavigate('/admin/price-rules')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                currentPath.startsWith('/admin/price-rules')
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              <DollarSign className="w-3.5 h-3.5" />
              <span>Precios</span>
            </button>

            <button
              onClick={() => onNavigate('/admin/orders')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                currentPath.startsWith('/admin/orders')
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>Órdenes</span>
            </button>

            <button
              onClick={() => onNavigate('/admin/payments')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                currentPath.startsWith('/admin/payments')
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>Pagos</span>
            </button>

            <button
              onClick={() => onNavigate('/admin/tickets')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                currentPath.startsWith('/admin/tickets')
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              <Ticket className="w-3.5 h-3.5" />
              <span>Boletos</span>
            </button>

            <button
              onClick={() => onNavigate('/admin/email-dispatches')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                currentPath.startsWith('/admin/email-dispatches')
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              <Mail className="w-3.5 h-3.5" />
              <span>Correos</span>
            </button>

            <button
              onClick={() => onNavigate('/admin/reports')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                currentPath.startsWith('/admin/reports')
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Reportes</span>
            </button>

            <button
              onClick={() => onNavigate('/admin/audit')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                currentPath.startsWith('/admin/audit')
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Auditoría</span>
            </button>
          </div>
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
