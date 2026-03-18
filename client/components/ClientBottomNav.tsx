import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useClientLanguage } from '../bootstrap/ClientLanguageContext';
import { clientRouteDefinitions } from '../routes';

export const ClientBottomNav: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useClientLanguage();
  const navItems = clientRouteDefinitions.filter((item) => item.showInNav);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 px-4 pb-[max(0.85rem,env(safe-area-inset-bottom))] pt-3">
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-[linear-gradient(180deg,rgba(244,246,248,0)_0%,rgba(244,246,248,0.94)_58%,rgba(244,246,248,1)_100%)]" />
      <div className="relative mx-auto grid max-w-md grid-cols-5 gap-1 rounded-[24px] border border-slate-200/80 bg-white/95 p-1.5 shadow-[0_18px_40px_rgba(15,23,42,0.12)] backdrop-blur">
        {navItems.map((item) => {
          const path = `/app/${item.path}`;
          const isActive = location.pathname === path || location.pathname.startsWith(`${path}/`);

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                navigate(path);
                window.scrollTo({ top: 0, behavior: 'auto' });
              }}
              style={{ WebkitTapHighlightColor: 'transparent' }}
              className={`flex flex-col items-center justify-center gap-1 rounded-[18px] px-2 py-2 text-[11px] font-medium transition ${
                isActive
                  ? 'bg-slate-950 text-white shadow-[0_10px_22px_rgba(15,23,42,0.18)]'
                  : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <item.icon size={18} className={isActive ? 'text-white' : ''} />
              <span>{t(item.navLabelKey)}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
