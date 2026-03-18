import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useClientCart } from '../bootstrap/ClientCartContext';
import { useClientLanguage } from '../bootstrap/ClientLanguageContext';
import { clientRouteDefinitions } from '../routes';

export const ClientBottomNav: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useClientLanguage();
  const { itemsCount } = useClientCart();
  const navItems = clientRouteDefinitions.filter((item) => item.showInNav);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2">
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-[linear-gradient(180deg,rgba(240,242,245,0)_0%,rgba(240,242,245,0.95)_60%,rgba(240,242,245,1)_100%)]" />
      <div className="relative mx-auto grid max-w-md gap-1 rounded-[22px] border border-slate-200/80 bg-white/96 p-1.5 shadow-[0_8px_32px_rgba(15,23,42,0.10)] backdrop-blur"
        style={{ gridTemplateColumns: `repeat(${navItems.length}, 1fr)` }}>
        {navItems.map((item) => {
          const path = `/app/${item.path}`;
          const isActive = location.pathname === path || location.pathname.startsWith(`${path}/`);
          const isCart = item.id === 'cart';

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                navigate(path);
                window.scrollTo({ top: 0, behavior: 'auto' });
              }}
              style={{ WebkitTapHighlightColor: 'transparent' }}
              className={`relative flex flex-col items-center justify-center gap-1 rounded-[17px] px-2 py-2.5 text-[10px] font-semibold transition-all ${
                isActive
                  ? 'bg-slate-950 text-white shadow-[0_6px_18px_rgba(15,23,42,0.22)]'
                  : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700'
              }`}
            >
              <div className="relative">
                <item.icon size={19} />
                {isCart && itemsCount > 0 ? (
                  <span className="absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-600 px-1 text-[9px] font-bold text-white leading-none">
                    {itemsCount > 9 ? '9+' : itemsCount}
                  </span>
                ) : null}
              </div>
              <span className="leading-none">{t(item.navLabelKey)}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
