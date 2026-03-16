import React from 'react';
import { NavLink } from 'react-router-dom';
import { NAV_ITEMS } from '../constants';
import { useLanguage } from '../context/LanguageContext';
import { Bot, X } from 'lucide-react';
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
    <nav className="relative flex-1 overflow-y-auto py-4 px-3">
      <p className="px-3 mb-4 text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-white/30 select-none">
        {tr('Menu', 'Меню', 'Menyu')}
      </p>
      <ul className="space-y-1">
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
                  `nav-item flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all select-none ${isActive
                    ? 'bg-blue-50 dark:bg-blue-500/20 text-primary-blue dark:text-blue-400 shadow-sm'
                    : 'text-gray-600 dark:text-white/50 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/8'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <span className={`shrink-0 transition-colors ${isActive ? 'text-primary-blue dark:text-blue-400' : ''}`}>
                      <item.icon size={19} strokeWidth={isActive ? 2.2 : 1.8} />
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
    <div className="relative px-4 py-4 border-t border-gray-200 dark:border-white/10 shrink-0">
      <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/8 transition-colors cursor-pointer group">
        <div className="relative shrink-0">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center text-white text-sm font-bold shrink-0"
            style={{ background: 'linear-gradient(135deg, #2F6BFF 0%, #1A4FCC 100%)' }}
          >
            {initials}
          </div>
          <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-500 border-2 border-white dark:border-navy-900" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-gray-900 dark:text-white truncate leading-tight">
            {user?.first_name ? `${user.first_name} ${user.last_name || ''}`.trim() : user?.username || tr('User', 'Пользователь', 'Foydalanuvchi')}
          </p>
          <p className="text-[11px] text-gray-500 dark:text-white/40 font-medium uppercase tracking-wider truncate">
            {user?.role || '-'}
          </p>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-30 md:hidden"
          onClick={onCloseMobile}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-0 h-screen w-64 bg-white dark:bg-navy-950 border-r border-gray-200 dark:border-white/10 z-30 transition-transform duration-200 flex flex-col md:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Logo/Header */}
        <div className="px-4 py-6 flex items-center justify-between border-b border-gray-200 dark:border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary-blue to-primary-blue/80 flex items-center justify-center text-white font-bold">
              <Bot size={22} />
            </div>
            <div>
              <h2 className="font-bold text-gray-900 dark:text-white text-base">Admin</h2>
              <p className="text-[10px] text-gray-500 dark:text-white/40 font-semibold uppercase tracking-wider">Panel</p>
            </div>
          </div>
          <button
            onClick={onCloseMobile}
            className="md:hidden p-1.5 rounded-lg text-gray-500 dark:text-white/40 hover:bg-gray-100 dark:hover:bg-white/8 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation */}
        {renderNav(mobileOpen)}

        {/* Profile */}
        {renderProfile()}
      </aside>
    </>
  );
};
