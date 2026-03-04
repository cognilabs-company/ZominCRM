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
    <nav className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(0.9rem,env(safe-area-inset-bottom))] pt-3">
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-[linear-gradient(180deg,rgba(233,229,220,0)_0%,rgba(233,229,220,0.92)_60%,rgba(233,229,220,1)_100%)]" />
      <div className="relative mx-auto grid max-w-md grid-cols-5 gap-1 rounded-[28px] border border-white/75 bg-[rgba(38,53,62,0.92)] p-1.5 shadow-[0_24px_50px_rgba(31,41,51,0.28)] backdrop-blur-xl">
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
              className={`flex flex-col items-center justify-center gap-1 rounded-[20px] px-2 py-2 text-[11px] font-medium transition ${
                isActive
                  ? 'bg-[linear-gradient(135deg,#f59e0b_0%,#e76f51_100%)] text-white shadow-[0_12px_24px_rgba(231,111,81,0.28)]'
                  : 'text-[#d2d9dd] hover:bg-white/10 hover:text-white'
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
