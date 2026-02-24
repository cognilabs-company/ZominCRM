import React from 'react';
import { HashRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { LanguageProvider, useLanguage } from './context/LanguageContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import Dashboard from './pages/Dashboard';
import Conversations from './pages/Conversations';
import Orders from './pages/Orders';
import Settings from './pages/Settings';
import AITools from './pages/AITools';
import Products from './pages/Products';
import Clients from './pages/Clients';
import Leads from './pages/Leads';
import Users from './pages/Users';
import AICredentials from './pages/AICredentials';
import ConversationAutomation from './pages/ConversationAutomation';
import AISettings from './pages/AISettings';
import Login from './pages/auth/Login';
import Forbidden from './pages/auth/Forbidden';
import InstagramPages from './pages/InstagramPages';
import Payments from './pages/Payments';
import Couriers from './pages/Couriers';

// Placeholder components for other pages
const PlaceholderPage = ({ title }: { title: string }) => (
  <PlaceholderContent title={title} />
);

const PlaceholderContent: React.FC<{ title: string }> = ({ title }) => {
  const { language } = useLanguage();
  const tr = (en: string, ru: string, uz: string) => (language === 'ru' ? ru : language === 'uz' ? uz : en);
  const resolvedTitle = (() => {
    if (title === 'Clients') return tr('Clients', 'Mijozlar', 'Mijozlar');
    if (title === 'Payments') return tr('Payments', "To'lovlar", "To'lovlar");
    if (title === 'Couriers') return tr('Couriers', 'Kuryerlar', 'Kuryerlar');
    return title;
  })();
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center animate-fade-in-up select-none">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-2"
        style={{ background: 'linear-gradient(135deg, #1A2C45, #203552)', border: '1px solid rgba(255,255,255,0.08)' }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#E53935" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </div>
      <h2 className="text-2xl font-bold text-light-text dark:text-white">{resolvedTitle}</h2>
      <p className="text-sm text-light-muted dark:text-white/40 max-w-xs">
        {tr('This page is coming soon. Check back later.', 'Bu sahifa tez orada ishga tushadi.', 'Bu sahifa tez orada ishga tushadi.')}
      </p>
      <div className="mt-2 px-4 py-1.5 rounded-full text-xs font-semibold border"
        style={{ color: '#E53935', borderColor: 'rgba(229,57,53,0.3)', background: 'rgba(229,57,53,0.08)' }}>
        🚧 {tr('Under Construction', 'Ishlab chiqilmoqda', 'Ishlab chiqilmoqda')}
      </div>
    </div>
  );
};

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
          <p className="text-sm text-white/40">{tr('Loading...', 'Yuklanmoqda...', 'Yuklanmoqda...')}</p>
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

const App: React.FC = () => {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <ToastProvider>
          <AuthProvider>
            <Router>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/403" element={<Forbidden />} />

                <Route element={<ProtectedLayout />}>
                  <Route path="/" element={<RequirePermission permission="dashboard.access"><Dashboard /></RequirePermission>} />
                  <Route path="/conversations" element={<RequirePermission permission="crm.access"><Conversations /></RequirePermission>} />
                  <Route path="/conversations/:conversationId/automation" element={<Navigate to="/ai-settings" replace />} />
                  <Route path="/orders" element={<RequirePermission permission="orders.access"><Orders /></RequirePermission>} />
                  <Route path="/products" element={<RequirePermission permission="products.access"><Products /></RequirePermission>} />
                  <Route path="/clients" element={<RequirePermission permission="crm.access"><Clients /></RequirePermission>} />
                  <Route path="/leads" element={<RequirePermission permission="crm.access"><Leads /></RequirePermission>} />
                  <Route path="/payments" element={<RequirePermission permission="payments.access"><Payments /></RequirePermission>} />
                  <Route path="/couriers" element={<RequirePermission permission="couriers.access"><Couriers /></RequirePermission>} />
                  <Route path="/users" element={<RequireAdmin><Users /></RequireAdmin>} />
                  <Route path="/ai-tools" element={<RequirePermission permission="ai.access"><AITools /></RequirePermission>} />
                  <Route path="/ai-credentials" element={<RequireAdmin><AICredentials /></RequireAdmin>} />
                  <Route path="/ai-settings" element={<RequirePermission permission="ai.access"><AISettings /></RequirePermission>} />
                  <Route path="/ai-settings/automation/:conversationId" element={<RequirePermission permission="ai.access"><ConversationAutomation /></RequirePermission>} />
                  <Route path="/instagram-pages" element={<RequireAdmin><InstagramPages /></RequireAdmin>} />
                  <Route path="/settings" element={<Settings />} />
                </Route>

                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Router>
          </AuthProvider>
        </ToastProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
};

export default App;
