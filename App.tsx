import React from 'react';
import { HashRouter as Router, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { ClientAppProvider } from './client/bootstrap/ClientAppContext';
import { ClientCartProvider } from './client/bootstrap/ClientCartContext';
import { ClientLanguageProvider } from './client/bootstrap/ClientLanguageContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LanguageProvider, useLanguage } from './context/LanguageContext';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';
import { clientRouteDefinitions } from './client/routes';

const Dashboard = React.lazy(() => import('./pages/Dashboard'));
const Conversations = React.lazy(() => import('./pages/Conversations'));
const Orders = React.lazy(() => import('./pages/Orders'));
const Settings = React.lazy(() => import('./pages/Settings'));
const AITools = React.lazy(() => import('./pages/AITools'));
const Products = React.lazy(() => import('./pages/Products'));
const Clients = React.lazy(() => import('./pages/Clients'));
const Leads = React.lazy(() => import('./pages/Leads'));
const Users = React.lazy(() => import('./pages/Users'));
const AICredentials = React.lazy(() => import('./pages/AICredentials'));
const AISettings = React.lazy(() => import('./pages/AISettings'));
const Login = React.lazy(() => import('./pages/auth/Login'));
const Forbidden = React.lazy(() => import('./pages/auth/Forbidden'));
const Payments = React.lazy(() => import('./pages/Payments'));
const Couriers = React.lazy(() => import('./pages/Couriers'));
const ClientAppLayout = React.lazy(() =>
  import('./client/components/ClientAppLayout').then((module) => ({ default: module.ClientAppLayout }))
);

const normalizeInitialPath = () => {
  if (typeof window === 'undefined' || window.location.hash) {
    return;
  }

  const { pathname, search } = window.location;

  if (!pathname || pathname === '/') {
    return;
  }

  window.history.replaceState(null, '', `/${search}`);
  window.location.hash = `#${pathname}`;
};

normalizeInitialPath();

const MainLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mobileSidebarOpen, setMobileSidebarOpen] = React.useState(false);

  return (
    <div className="min-h-screen bg-light-bg dark:bg-navy-900 transition-colors duration-300">
      <Sidebar mobileOpen={mobileSidebarOpen} onCloseMobile={() => setMobileSidebarOpen(false)} />
      <Header onMenuClick={() => setMobileSidebarOpen((prev) => !prev)} />
      <main className="pt-20 pb-6 px-3 sm:px-6 md:ml-64 min-h-screen">
        {children}
      </main>
    </div>
  );
};

const RequireAuth: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  const { language } = useLanguage();
  const tr = (en: string, ru: string, uz: string) => (language === 'ru' ? ru : language === 'uz' ? uz : en);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #060D18, #0B1220)' }}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #E53935, #C62828)' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a10 10 0 1 1 0 20A10 10 0 0 1 12 2" /><path d="M8 9.05v-.1" /><path d="M16 9.05v-.1" /><path d="M8.5 14a3.5 3.5 0 0 0 7 0" /></svg>
          </div>
          <p className="text-sm text-white/40">{tr('Loading...', 'Loading...', 'Yuklanmoqda...')}</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

const RequirePermission: React.FC<{ permission: string; children: React.ReactNode }> = ({ permission, children }) => {
  const { hasPermission } = useAuth();
  if (!hasPermission(permission)) {
    return <Navigate to="/403" replace />;
  }
  return <>{children}</>;
};

const RequireAdmin: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAdmin } = useAuth();
  if (!isAdmin) {
    return <Navigate to="/403" replace />;
  }
  return <>{children}</>;
};

const ProtectedLayout: React.FC = () => (
  <RequireAuth>
    <MainLayout>
      <Outlet />
    </MainLayout>
  </RequireAuth>
);

const RouteFallback: React.FC = () => (
  <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #ece7df, #dfe6e5)' }}>
    <div className="flex flex-col items-center gap-3">
      <div className="h-12 w-12 rounded-2xl border-4 border-[#21404d]/20 border-t-[#21404d] animate-spin" />
      <p className="text-sm text-[#5b6770]">Loading...</p>
    </div>
  </div>
);

const App: React.FC = () => {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <ToastProvider>
          <React.Suspense fallback={<RouteFallback />}>
            <Router>
              <Routes>
                <Route
                  path="/app"
                  element={(
                    <ClientAppProvider>
                      <ClientLanguageProvider>
                        <ClientCartProvider>
                          <ClientAppLayout />
                        </ClientCartProvider>
                      </ClientLanguageProvider>
                    </ClientAppProvider>
                  )}
                >
                  <Route index element={<Navigate to="home" replace />} />
                  {clientRouteDefinitions.map((route) => (
                    <React.Fragment key={route.id}>
                      <Route path={route.path} element={route.element} />
                    </React.Fragment>
                  ))}
                  <Route path="*" element={<Navigate to="home" replace />} />
                </Route>

                <Route
                  path="/*"
                  element={(
                    <AuthProvider>
                      <Routes>
                        <Route path="/login" element={<Login />} />
                        <Route path="/403" element={<Forbidden />} />
                        <Route element={<ProtectedLayout />}>
                          <Route path="/" element={<Navigate to="/admin-app" replace />} />

                          <Route path="/conversations" element={<Navigate to="/admin-app/conversations" replace />} />
                          <Route path="/conversations/:conversationId/automation" element={<Navigate to="/admin-app/ai-settings" replace />} />
                          <Route path="/orders" element={<Navigate to="/admin-app/orders" replace />} />
                          <Route path="/products" element={<Navigate to="/admin-app/products" replace />} />
                          <Route path="/clients" element={<Navigate to="/admin-app/clients" replace />} />
                          <Route path="/leads" element={<Navigate to="/admin-app/leads" replace />} />
                          <Route path="/payments" element={<Navigate to="/admin-app/payments" replace />} />
                          <Route path="/couriers" element={<Navigate to="/admin-app/couriers" replace />} />
                          <Route path="/users" element={<Navigate to="/admin-app/users" replace />} />
                          <Route path="/ai-tools" element={<Navigate to="/admin-app/ai-tools" replace />} />
                          <Route path="/ai-credentials" element={<Navigate to="/admin-app/ai-credentials" replace />} />
                          <Route path="/ai-settings" element={<Navigate to="/admin-app/ai-settings" replace />} />
                          <Route path="/ai-settings/automation/:conversationId" element={<Navigate to="/admin-app/ai-settings" replace />} />
                          <Route path="/settings" element={<Navigate to="/admin-app/settings" replace />} />

                          <Route path="/admin-app" element={<RequirePermission permission="dashboard.access"><Dashboard /></RequirePermission>} />
                          <Route path="/admin-app/conversations" element={<RequirePermission permission="crm.access"><Conversations /></RequirePermission>} />
                          <Route path="/admin-app/conversations/:conversationId/automation" element={<Navigate to="/admin-app/ai-settings" replace />} />
                          <Route path="/admin-app/orders" element={<RequirePermission permission="orders.access"><Orders /></RequirePermission>} />
                          <Route path="/admin-app/products" element={<RequirePermission permission="products.access"><Products /></RequirePermission>} />
                          <Route path="/admin-app/clients" element={<RequirePermission permission="crm.access"><Clients /></RequirePermission>} />
                          <Route path="/admin-app/leads" element={<RequireAdmin><Leads /></RequireAdmin>} />
                          <Route path="/admin-app/payments" element={<RequirePermission permission="payments.access"><Payments /></RequirePermission>} />
                          <Route path="/admin-app/couriers" element={<RequirePermission permission="couriers.access"><Couriers /></RequirePermission>} />
                          <Route path="/admin-app/users" element={<RequireAdmin><Users /></RequireAdmin>} />
                          <Route path="/admin-app/ai-tools" element={<RequirePermission permission="ai.access"><AITools /></RequirePermission>} />
                          <Route path="/admin-app/ai-credentials" element={<RequireAdmin><AICredentials /></RequireAdmin>} />
                          <Route path="/admin-app/ai-settings" element={<RequirePermission permission="ai.access"><AISettings /></RequirePermission>} />
                          <Route path="/admin-app/ai-settings/automation/:conversationId" element={<Navigate to="/admin-app/ai-settings" replace />} />
                          <Route path="/admin-app/settings" element={<Settings />} />
                        </Route>
                        <Route path="*" element={<Navigate to="/app" replace />} />
                      </Routes>
                    </AuthProvider>
                  )}
                />
              </Routes>
            </Router>
          </React.Suspense>
        </ToastProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
};

export default App;
