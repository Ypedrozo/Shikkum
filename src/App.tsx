import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { RoleGuard } from './components/auth/RoleGuard';
import { Login } from './pages/auth/Login';
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { CustomersPage } from './pages/admin/CustomersPage';
import { EventsPage } from './pages/admin/EventsPage';
import { EventDetailPage } from './pages/admin/EventDetailPage';
import { PriceRulesPage } from './pages/admin/PriceRulesPage';
import { CashierDashboard } from './pages/cashier/CashierDashboard';
import { CashierCustomersPage } from './pages/cashier/CashierCustomersPage';
import { NewOrderWizard } from './pages/cashier/NewOrderWizard';
import { OrdersListPage } from './pages/cashier/OrdersListPage';
import { OrderDetailView } from './pages/orders/OrderDetailView';
import { PaymentRegistrationPage } from './pages/orders/PaymentRegistrationPage';
import { AdminOrdersPage } from './pages/admin/AdminOrdersPage';
import { AdminPaymentsPage } from './pages/admin/AdminPaymentsPage';
import { AdminTicketsPage } from './pages/admin/AdminTicketsPage';
import { GateDashboard } from './pages/gate/GateDashboard';
import { AdminLayout } from './layouts/AdminLayout';
import { CashierLayout } from './layouts/CashierLayout';
import { GateLayout } from './layouts/GateLayout';
import { authService } from './services/auth.service';

/**
 * Enrutador principal de SHIKKUM con soporte para History API y estado sincronizado
 */
const AppRouter: React.FC = () => {
  const { user, isLoading } = useAuth();
  const [currentPath, setCurrentPath] = useState<string>(() => {
    const p = window.location.pathname;
    return p && p !== '/' ? p : '/login';
  });

  // Manejar el botón Atrás/Adelante del navegador
  useEffect(() => {
    const handlePopState = () => {
      const p = window.location.pathname;
      setCurrentPath(p && p !== '/' ? p : '/login');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = (path: string) => {
    setCurrentPath(path);
    try {
      window.history.pushState({}, '', path);
    } catch {
      // Ignorar restricciones en entornos iframe restringidos
    }
  };

  // Si el usuario ya está autenticado y activo, y está en /login, redirigir según su rol
  useEffect(() => {
    if (!isLoading && user && user.isActive && (currentPath === '/login' || currentPath === '/')) {
      const targetPath = authService.getRedirectPathForRole(user.role);
      navigate(targetPath);
    }
  }, [user, isLoading, currentPath]);

  // Si el usuario no está autenticado y navega a una ruta protegida
  const isProtectedPath = currentPath.startsWith('/admin') ||
                          currentPath.startsWith('/cashier') ||
                          currentPath.startsWith('/gate');

  if (!isLoading && !user && isProtectedPath) {
    return <Login onLoginSuccess={(path) => navigate(path)} />;
  }

  // 1. Ruta de Login
  if (currentPath === '/login' || currentPath === '/') {
    return <Login onLoginSuccess={(path) => navigate(path)} />;
  }

  // 2. Rutas Administrativas: /admin/* (Solo 'admin')
  if (currentPath.startsWith('/admin')) {
    let adminContent = <AdminDashboard onNavigate={(p) => navigate(p)} />;

    if (currentPath === '/admin/customers' || currentPath === '/admin/customers/') {
      adminContent = <CustomersPage />;
    } else if (currentPath.startsWith('/admin/events/')) {
      const eventId = currentPath.replace('/admin/events/', '').split('/')[0];
      adminContent = <EventDetailPage eventId={eventId} onNavigate={(p) => navigate(p)} />;
    } else if (currentPath === '/admin/events' || currentPath === '/admin/events/') {
      adminContent = <EventsPage onNavigate={(p) => navigate(p)} />;
    } else if (currentPath === '/admin/price-rules' || currentPath === '/admin/price-rules/') {
      adminContent = <PriceRulesPage onNavigate={(p) => navigate(p)} />;
    } else if (currentPath === '/admin/orders/new' || currentPath === '/admin/orders/new/') {
      adminContent = (
        <NewOrderWizard
          onNavigate={(p) => navigate(p)}
          baseRolePath="/admin"
          onOrderCreated={(orderId: string) => navigate(`/admin/orders/${orderId}`)}
          onCancel={() => navigate('/admin/orders')}
        />
      );
    } else if (currentPath.startsWith('/admin/orders/') && currentPath.includes('/payment')) {
      const orderId = currentPath.replace('/admin/orders/', '').replace('/payment', '').split('/')[0];
      adminContent = (
        <PaymentRegistrationPage
          orderId={orderId}
          onNavigate={(p) => navigate(p)}
          baseRolePath="/admin"
        />
      );
    } else if (currentPath.startsWith('/admin/orders/')) {
      const orderId = currentPath.replace('/admin/orders/', '').split('/')[0];
      adminContent = (
        <OrderDetailView
          orderId={orderId}
          onNavigate={(p) => navigate(p)}
          baseRolePath="/admin"
        />
      );
    } else if (currentPath === '/admin/orders' || currentPath === '/admin/orders/') {
      adminContent = <AdminOrdersPage onNavigate={(p) => navigate(p)} />;
    } else if (currentPath === '/admin/payments' || currentPath === '/admin/payments/') {
      adminContent = <AdminPaymentsPage onNavigate={(p) => navigate(p)} />;
    } else if (currentPath === '/admin/tickets' || currentPath === '/admin/tickets/') {
      adminContent = <AdminTicketsPage onNavigate={(p) => navigate(p)} />;
    }

    return (
      <ProtectedRoute onNavigateToLogin={() => navigate('/login')}>
        <RoleGuard
          allowedRoles={['admin']}
          currentPathName="/admin"
          onNavigateToRoleHome={(p) => navigate(p)}
        >
          <AdminLayout currentPath={currentPath} onNavigate={(p) => navigate(p)}>
            {adminContent}
          </AdminLayout>
        </RoleGuard>
      </ProtectedRoute>
    );
  }

  // 3. Rutas de Cobranzas: /cashier/* (Permitido: 'admin' y 'cashier')
  if (currentPath.startsWith('/cashier')) {
    let cashierContent = <CashierDashboard onNavigate={(p) => navigate(p)} />;

    if (currentPath === '/cashier/customers' || currentPath === '/cashier/customers/') {
      cashierContent = <CashierCustomersPage />;
    } else if (currentPath === '/cashier/orders/new' || currentPath === '/cashier/orders/new/') {
      cashierContent = (
        <NewOrderWizard
          onNavigate={(p) => navigate(p)}
          baseRolePath="/cashier"
          onOrderCreated={(orderId: string) => navigate(`/cashier/orders/${orderId}`)}
          onCancel={() => navigate('/cashier/orders')}
        />
      );
    } else if (currentPath.startsWith('/cashier/orders/') && currentPath.includes('/payment')) {
      const orderId = currentPath.replace('/cashier/orders/', '').replace('/payment', '').split('/')[0];
      cashierContent = (
        <PaymentRegistrationPage
          orderId={orderId}
          onNavigate={(p) => navigate(p)}
          baseRolePath="/cashier"
        />
      );
    } else if (currentPath.startsWith('/cashier/orders/')) {
      const orderId = currentPath.replace('/cashier/orders/', '').split('/')[0];
      cashierContent = (
        <OrderDetailView
          orderId={orderId}
          onNavigate={(p) => navigate(p)}
          baseRolePath="/cashier"
        />
      );
    } else if (currentPath === '/cashier/orders' || currentPath === '/cashier/orders/') {
      cashierContent = (
        <OrdersListPage
          onNavigate={(p) => navigate(p)}
          baseRolePath="/cashier"
        />
      );
    } else if (currentPath === '/cashier/tickets' || currentPath === '/cashier/tickets/') {
      cashierContent = (
        <AdminTicketsPage
          onNavigate={(p) => navigate(p)}
          baseRolePath="/cashier"
        />
      );
    }

    return (
      <ProtectedRoute onNavigateToLogin={() => navigate('/login')}>
        <RoleGuard
          allowedRoles={['admin', 'cashier']}
          currentPathName="/cashier"
          onNavigateToRoleHome={(p) => navigate(p)}
        >
          <CashierLayout currentPath={currentPath} onNavigate={(p) => navigate(p)}>
            {cashierContent}
          </CashierLayout>
        </RoleGuard>
      </ProtectedRoute>
    );
  }

  // 4. Rutas de Operador de Puerta: /gate/* (Permitido: 'admin' y 'gate_operator')
  if (currentPath.startsWith('/gate')) {
    return (
      <ProtectedRoute onNavigateToLogin={() => navigate('/login')}>
        <RoleGuard
          allowedRoles={['admin', 'gate_operator']}
          currentPathName="/gate"
          onNavigateToRoleHome={(p) => navigate(p)}
        >
          <GateLayout currentPath={currentPath} onNavigate={(p) => navigate(p)}>
            <GateDashboard onNavigate={(p) => navigate(p)} />
          </GateLayout>
        </RoleGuard>
      </ProtectedRoute>
    );
  }

  // Fallback para rutas no encontradas
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-slate-100">
      <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center shadow-xl">
        <h2 className="text-xl font-bold mb-2">Ruta no encontrada</h2>
        <p className="text-xs text-slate-400 mb-6">La dirección solicitada ({currentPath}) no existe en SHIKKUM.</p>
        <button
          onClick={() => navigate('/login')}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold"
        >
          Volver al inicio
        </button>
      </div>
      <footer className="mt-8 text-xs text-slate-600">
        SHIKKUM © 2026 — Programa desarrollado por Yeiber Pedrozo — Todos los derechos reservados.
      </footer>
    </div>
  );
};

export function App() {
  return (
    <AuthProvider>
      <AppRouter />
    </AuthProvider>
  );
}

export default App;
