import React from 'react';
import { NavLink } from 'react-router-dom';
import { useClientLanguage } from '../bootstrap/ClientLanguageContext';
import { clientRouteDefinitions } from '../routes';

export const ClientBottomNav: React.FC = () => {
  const { t } = useClientLanguage();
  const navItems = clientRouteDefinitions.filter((item) => item.showInNav);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200/80 bg-white/95 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur">
      <div className="mx-auto grid max-w-md grid-cols-5 gap-1 rounded-[26px] bg-slate-100/90 p-1.5">
        {navItems.map((item) => (
          <NavLink
            key={item.id}
            to={`/app/${item.path}`}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center gap-1 rounded-[20px] px-2 py-2 text-[11px] font-medium transition ${
                isActive
                  ? 'bg-slate-950 text-white shadow-[0_10px_24px_rgba(15,23,42,0.18)]'
                  : 'text-slate-500 hover:bg-white hover:text-slate-900'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <item.icon size={18} className={isActive ? 'text-white' : ''} />
                <span>{t(item.navLabelKey)}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
};
