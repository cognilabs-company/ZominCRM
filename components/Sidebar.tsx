import React from 'react';
import { NavLink } from 'react-router-dom';
import { NAV_ITEMS } from '../constants';
import { useLanguage } from '../context/LanguageContext';
import { Bot, X, Zap } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface SidebarProps {
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ mobileOpen = false, onCloseMobile }) => {
  const { t, language } = useLanguage();
  const { user, hasPermission, isAdmin } = useAuth();
  const tr = (en: string, ru: string, uz: string) => (language === 'ru' ? ru : language === 'uz' ? uz : en);
  const getAdminNavPath = (path: string) => (path === '/' ? '/admin-app' : `/admin-app${path}`);

  const canAccessNavItem = (id: string) => {
    if (!user) return false;
    switch (id) {
      case 'dashboard': return hasPermission('dashboard.access');
      case 'conversations':
      case 'clients': return hasPermission('crm.access');
      case 'bottles': return hasPermission('crm.access');
      case 'leads': return isAdmin;
      case 'orders': return hasPermission('orders.access');
      case 'payments': return hasPermission('payments.access');
      case 'couriers': return hasPermission('couriers.access');
      case 'products': return hasPermission('products.access');
      case 'users': return isAdmin;
      case 'ai_tools':
      case 'ai_settings': return hasPermission('ai.access');
      case 'ai_credentials': return isAdmin;
      case 'settings': return true;
      default: return false;
    }
  };

  const initials = (() => {
    const name = (user?.first_name && user?.last_name)
      ? `${user.first_name} ${user.last_name}`
      : user?.username || '';
    return name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2) || 'U';
  })();

  const renderNav = (isMobile = false) => (
    <nav className="relative flex-1 overflow-y-auto py-3 px-2">
      <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-white/25 select-none">
        {tr('Menu', 'Menu', 'Menyu')}
      </p>
      <ul className="space-y-0.5">
        {NAV_ITEMS.map((item) =>
          canAccessNavItem(item.id) ? (
            <li key={item.id}>
              <NavLink
                to={getAdminNavPath(item.path)}
                end={item.path === '/'}
                onClick={() => {
                  if (isMobile) onCloseMobile?.();
                }}
                className={({ isActive }) =>
                  `nav-item flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all select-none ${isActive
                    ? 'nav-active'
                    : 'text-gray-500 hover:text-gray-900 dark:text-white/55 dark:hover:text-white/90'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <span className={`shrink-0 transition-colors ${isActive ? 'text-primary-red' : ''}`}>
                      <item.icon size={17} strokeWidth={isActive ? 2.2 : 1.8} />
                    </span>
                    <span className={`truncate ${isActive ? 'font-semibold' : ''}`}>{t(item.labelKey)}</span>
                  </>
                )}
              </NavLink>
            </li>
          ) : null
        )}
      </ul>
    </nav>
  );

  const renderProfile = () => (
    <div className="relative px-3 py-4 border-t border-light-border dark:border-white/6 shrink-0">
      <div className="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-gray-50 dark:hover:bg-white/5 transition-colors cursor-pointer group">
        <div className="relative shrink-0">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-sm font-bold shrink-0"
            style={{ background: 'linear-gradient(135deg, #2F6BFF 0%, #1A4FCC 100%)' }}
          >
            {initials}
          </div>
          <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-accent-emerald border-2 border-white dark:border-navy-900" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-gray-900 dark:text-white truncate leading-tight">
            {user?.first_name ? `${user.first_name} ${user.last_name || ''}`.trim() : user?.username || tr('User', 'User', 'Foydalanuvchi')}
          </p>
          <p className="text-[11px] text-gray-500 dark:text-white/40 font-medium uppercase tracking-wide truncate">
            {user?.role || '-'}
          </p>
        </div>
        <div
          className="shrink-0 w-1.5 h-1.5 rounded-full bg-accent-emerald opacity-80"
          style={{ boxShadow: '0 0 5px rgba(16,185,129,0.9)' }}
        />
      </div>
    </div>
  );

  const sidebarBody = (isMobile = false) => (
    <>
      <div
        className="absolute inset-0 pointer-events-none hidden dark:block"
        style={{
          background:
            'radial-gradient(ellipse at 20% 0%, rgba(229,57,53,0.08) 0%, transparent 60%), radial-gradient(ellipse at 80% 100%, rgba(47,107,255,0.06) 0%, transparent 60%)',
        }}
      />

      <div className="relative h-16 flex items-center px-5 border-b border-light-border dark:border-white/6 shrink-0">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center text-white shadow-glow-red"
              style={{ background: 'linear-gradient(135deg, #E53935 0%, #C62828 100%)' }}
            >
              <Bot size={19} strokeWidth={2.2} />
            </div>
            <div
              className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-accent-emerald border-2 border-white dark:border-navy-900"
              style={{ boxShadow: '0 0 6px rgba(16,185,129,0.8)' }}
            />
          </div>
          <div>
            <span className="font-bold text-gray-900 dark:text-white text-base tracking-tight">Zomin</span>
            <span className="font-bold text-[15px] tracking-tight" style={{ color: '#E53935' }}> CRM</span>
          </div>
        </div>

        {isMobile ? (
          <button
            onClick={onCloseMobile}
            className="ml-auto p-2 rounded-lg text-gray-500 hover:text-gray-900 dark:text-white/60 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5"
            title={tr('Close', 'Close', 'Yopish')}
          >
            <X size={18} />
          </button>
        ) : (
          <div className="ml-auto">
            <Zap size={13} className="text-yellow-400 opacity-70" />
          </div>
        )}
      </div>

      {renderNav(isMobile)}
      {renderProfile()}
    </>
  );

  return (
    <>
      <aside className="w-64 fixed h-full z-30 hidden md:flex flex-col bg-white dark:bg-[#0B1220] border-r border-light-border dark:border-white/5 shadow-sm dark:shadow-sidebar transition-colors">
        {sidebarBody(false)}
      </aside>

      <div className={`md:hidden fixed inset-0 z-40 transition ${mobileOpen ? 'pointer-events-auto' : 'pointer-events-none'}`}>
        <div
          className={`absolute inset-0 bg-black/40 transition-opacity ${mobileOpen ? 'opacity-100' : 'opacity-0'}`}
          onClick={onCloseMobile}
        />
        <aside
          className={`absolute inset-y-0 left-0 w-[86vw] max-w-80 flex flex-col bg-white dark:bg-[#0B1220] border-r border-light-border dark:border-white/5 shadow-xl transition-transform duration-200 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}
        >
          {sidebarBody(true)}
        </aside>
      </div>
    </>
  );
};
