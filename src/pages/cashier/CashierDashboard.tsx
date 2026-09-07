import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { DollarSign, CheckCircle2, ShoppingBag, ShieldAlert, Users, Plus, ArrowRight } from 'lucide-react';

interface CashierDashboardProps {
  onNavigate: (path: string) => void;
}

export const CashierDashboard: React.FC<CashierDashboardProps> = ({ onNavigate }) => {
  const { user } = useAuth();

  return (
    <div className="space-y-8">
      {/* Header card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="p-2 bg-emerald-600/10 text-emerald-400 border border-emerald-500/20 rounded-xl">
                <DollarSign className="w-5 h-5" />
              </span>
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                Punto de Venta Oficial
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Panel de Cobranzas
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Terminal autorizado para registro de clientes, cotización con reglas de precios y confirmación de órdenes.
            </p>
          </div>

          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold rounded-xl self-start sm:self-auto">
            <CheckCircle2 className="w-4 h-4" />
            <span>Acceso Autorizado (Rol: {user?.role})</span>
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
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-mono">
              {user?.role}
            </span>
            <span className="text-[11px] text-slate-500 block mt-1">Personal de Cobranzas</span>
          </div>
          <div>
            <span className="text-xs font-medium text-slate-400 block mb-1">Estado:</span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              {user?.isActive ? 'Activo (Autorizado)' : 'Inactivo'}
            </span>
            <span className="text-[11px] text-slate-500 block mt-1">
              Último login: {user?.lastLoginAt ? new Date(user.lastLoginAt).toLocaleTimeString() : 'Sesión actual'}
            </span>
          </div>
        </div>
      </div>

      {/* Accesos Rápidos de Cobranzas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Tarjeta Órdenes */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4 hover:border-emerald-500/40 transition flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-3 mb-3">
              <div className="w-12 h-12 bg-emerald-500/20 text-emerald-400 rounded-xl flex items-center justify-center border border-emerald-500/30">
                <ShoppingBag className="w-6 h-6" />
              </div>
              <span className="px-2.5 py-0.5 text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full">
                Fase 4 Activa
              </span>
            </div>
            <h2 className="text-lg font-bold text-white">Órdenes y Ventas</h2>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Registro asistido de órdenes con congelamiento inmutable de precios por asistente, consulta de estado y seguimiento de pedidos pendientes de pago.
            </p>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={() => onNavigate('/cashier/orders/new')}
              className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-600/30 transition flex items-center justify-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Nueva Orden</span>
            </button>
            <button
              onClick={() => onNavigate('/cashier/orders')}
              className="py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-semibold border border-slate-700 transition flex items-center gap-1.5"
            >
              <span>Ver Órdenes</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Tarjeta Clientes */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4 hover:border-emerald-500/40 transition flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-3 mb-3">
              <div className="w-12 h-12 bg-slate-800 text-emerald-400 rounded-xl flex items-center justify-center border border-slate-700">
                <Users className="w-6 h-6" />
              </div>
              <span className="px-2.5 py-0.5 text-[10px] font-bold bg-slate-800 text-slate-400 rounded-full">
                Base de Datos
              </span>
            </div>
            <h2 className="text-lg font-bold text-white">Gestión de Clientes</h2>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Búsqueda en tiempo real de compradores, validación de estado activo/inactivo y registro rápido de clientes titulares antes de iniciar una venta.
            </p>
          </div>

          <div className="pt-2">
            <button
              onClick={() => onNavigate('/cashier/customers')}
              className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-semibold border border-slate-700 transition flex items-center justify-center gap-1.5"
            >
              <Users className="w-4 h-4" />
              <span>Administrar Clientes</span>
              <ArrowRight className="w-3.5 h-3.5 ml-auto" />
            </button>
          </div>
        </div>
      </div>

      {/* Criterios de Aceptación & Pruebas de RBAC */}
      <div className="bg-slate-900 border border-slate-800/80 rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-amber-500/10 text-amber-400 rounded-xl flex items-center justify-center border border-amber-500/20">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Verificación de Seguridad RBAC</h3>
            <p className="text-xs text-slate-400">Intento de acceso denegado a ruta administrativa</p>
          </div>
        </div>
        <p className="text-xs text-slate-400 mb-4 leading-relaxed">
          Según las especificaciones de seguridad, un usuario con rol <code className="text-emerald-400 font-bold">cashier</code> NO tiene permitido el acceso a <code className="text-indigo-400 font-bold">/admin</code>. Haz clic para verificar que el sistema bloquea el acceso mostrando la pantalla 403:
        </p>
        <button
          onClick={() => onNavigate('/admin')}
          className="py-2.5 px-4 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-xl text-xs font-semibold transition flex items-center gap-2"
        >
          <span>Intentar acceder a /admin (Probar bloqueo)</span>
        </button>
      </div>
    </div>
  );
};

