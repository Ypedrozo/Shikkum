import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { authService } from '../../services/auth.service';
import { Lock, Mail, AlertCircle, ArrowRight, ShieldCheck, KeyRound, Check, RefreshCw, X } from 'lucide-react';

interface LoginProps {
  onLoginSuccess: (path: string) => void;
}

export const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const { login, resetPassword, error, clearError } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  // Estado para modal de recuperación de contraseña
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetSuccess, setResetSuccess] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    clearError();

    if (!email.trim() || !password) {
      setLocalError('Por favor ingresa tu correo electrónico y contraseña.');
      return;
    }

    setIsSubmitting(true);

    try {
      const loggedUser = await login(email, password);
      const targetPath = authService.getRedirectPathForRole(loggedUser.role);
      onLoginSuccess(targetPath);
    } catch (err: any) {
      const msg = err.message || 'Error al iniciar sesión';
      setLocalError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickFill = (testEmail: string, testPass: string) => {
    setEmail(testEmail);
    setPassword(testPass);
    setLocalError(null);
    clearError();
  };

  const handlePasswordResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError(null);
    setResetSuccess(false);

    if (!resetEmail.trim()) {
      setResetError('Ingresa un correo electrónico.');
      return;
    }

    setResetLoading(true);
    try {
      await resetPassword(resetEmail);
      setResetSuccess(true);
    } catch (err: any) {
      setResetError(err.message || 'No fue posible enviar las instrucciones.');
    } finally {
      setResetLoading(false);
    }
  };

  const testAccounts = authService.getDevTestAccounts();

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-between text-slate-100 font-sans selection:bg-indigo-500 selection:text-white">
      {/* Background visual accents */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-indigo-600/10 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 right-10 w-[450px] h-[350px] bg-cyan-600/5 rounded-full blur-3xl"></div>
      </div>

      {/* Main Container */}
      <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 lg:p-8 z-10">
        <div className="w-full max-w-md">
          {/* Brand Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-600 text-white font-black text-2xl tracking-wider shadow-xl shadow-indigo-600/25 mb-4 border border-indigo-400/20">
              SH
            </div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight">SHIKKUM</h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1 font-medium">
              Plataforma de Eventos, Cobranzas y Accesos
            </p>
            <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-[11px] text-slate-400">
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
              <span>Acceso restringido para personal autorizado</span>
            </div>
          </div>

          {/* Login Card */}
          <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl">
            <h2 className="text-lg font-bold text-white mb-1">Iniciar Sesión</h2>
            <p className="text-xs text-slate-400 mb-6">
              Ingresa tus credenciales oficiales para acceder a tu panel de control.
            </p>

            {/* Error alerts */}
            {(localError || error) && (
              <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-start gap-3">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  <span className="font-semibold block mb-0.5">Atención</span>
                  {localError || error}
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5" htmlFor="email-input">
                  Correo Electrónico
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    id="email-input"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="operador@shikkum.com"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-950/80 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-slate-300" htmlFor="password-input">
                    Contraseña
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setResetEmail(email);
                      setIsResetModalOpen(true);
                    }}
                    className="text-xs text-indigo-400 hover:text-indigo-300 font-medium transition"
                  >
                    ¿Olvidaste tu contraseña?
                  </button>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    id="password-input"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-950/80 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition font-mono"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full mt-2 py-3 px-4 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl shadow-lg shadow-indigo-600/25 transition flex items-center justify-center gap-2 cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Verificando...</span>
                  </>
                ) : (
                  <>
                    <span>Iniciar Sesión</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Test Accounts Panel (Verificación de Criterios de Aceptación) */}
          <div className="mt-6 bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 sm:p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-indigo-400" />
                <span className="text-xs font-bold text-slate-200">
                  Cuentas de Verificación (Fase 2 - Criterios de Aceptación)
                </span>
              </div>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                1-Click Test
              </span>
            </div>

            <p className="text-[11px] text-slate-400 mb-3 leading-relaxed">
              Haz clic en cualquier rol para autocompletar credenciales y probar la redirección y permisos RBAC:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {testAccounts.map((acc) => (
                <button
                  key={acc.email}
                  type="button"
                  onClick={() => handleQuickFill(acc.email, acc.password)}
                  className={`text-left p-2.5 rounded-xl border transition flex flex-col justify-between ${
                    acc.isActive
                      ? 'bg-slate-950/70 hover:bg-slate-800/80 border-slate-800 hover:border-slate-700 text-slate-300'
                      : 'bg-red-950/20 hover:bg-red-950/30 border-red-900/40 text-red-300'
                  }`}
                >
                  <div className="flex items-center justify-between w-full mb-1">
                    <span className="text-xs font-bold capitalize">
                      {acc.role === 'gate_operator' ? 'Gate Operator' : acc.role}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                        acc.isActive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/20 text-red-400'
                      }`}
                    >
                      {acc.isActive ? 'Activo' : 'Inactivo (Escenario 7)'}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400 truncate font-mono">{acc.email}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Password Reset Modal */}
      {isResetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setIsResetModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-200 p-1"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-white mb-1">Recuperar Contraseña</h3>
            <p className="text-xs text-slate-400 mb-5">
              Enviaremos un correo electrónico con instrucciones para restablecer tu contraseña.
            </p>

            {resetSuccess ? (
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-start gap-3 mb-4">
                <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold block mb-0.5">Correo Enviado</span>
                  Si la cuenta existe en SHIKKUM, recibirás un enlace de recuperación en los próximos minutos.
                </div>
              </div>
            ) : (
              <form onSubmit={handlePasswordResetSubmit} className="space-y-4">
                {resetError && (
                  <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-xs">
                    {resetError}
                  </div>
                )}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Correo Electrónico Registrado
                  </label>
                  <input
                    type="email"
                    required
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    placeholder="operador@shikkum.com"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <button
                  type="submit"
                  disabled={resetLoading}
                  className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl transition"
                >
                  {resetLoading ? 'Enviando...' : 'Enviar Instrucciones'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Official Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-6 text-center text-xs text-slate-500 z-10">
        <p>SHIKKUM © 2026 — Programa desarrollado por Yeiber Pedrozo — Todos los derechos reservados.</p>
      </footer>
    </div>
  );
};
