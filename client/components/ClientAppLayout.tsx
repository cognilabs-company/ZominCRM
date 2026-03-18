import React from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { ArrowRight, Package, RefreshCw, UserRound } from 'lucide-react';
import { useClientApp } from '../bootstrap/ClientAppContext';
import { useClientLanguage } from '../bootstrap/ClientLanguageContext';
import { ClientBottomNav } from './ClientBottomNav';
import { formatAmount, formatOrderRef, getOrderStatusLabel } from '../utils';

export const ClientAppLayout: React.FC = () => {
  const navigate = useNavigate();
  const {
    status,
    mode,
    telegramUser,
    refreshBootstrap,
    client,
    activeOrder,
    error,
    isAuthenticated,
    openInTelegramUrl,
  } = useClientApp();
  const { language, t } = useClientLanguage();

  const displayName = client?.full_name || telegramUser?.first_name || telegramUser?.username || null;

  return (
    <div className="min-h-screen bg-[#f0f2f5] text-slate-900">
      <div className="relative mx-auto flex min-h-screen w-full max-w-md flex-col">
        {/* Slim header */}
        <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/95 backdrop-blur">
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-white shadow-sm">
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                  <path d="M10 2C6 2 3 6.5 3 10a7 7 0 0014 0c0-3.5-3-8-7-8z" />
                </svg>
              </div>
              <span className="text-base font-bold tracking-tight text-slate-950">{t('layout.title')}</span>
            </div>
            <div className="flex items-center gap-2">
              {displayName ? (
                <button
                  type="button"
                  onClick={() => navigate('/app/profile')}
                  className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100"
                >
                  <UserRound size={13} className="text-slate-400" />
                  <span className="max-w-[90px] truncate">{displayName}</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => navigate('/app/profile')}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-500 transition hover:bg-slate-100"
                >
                  <UserRound size={15} />
                </button>
              )}
              <button
                type="button"
                onClick={() => void refreshBootstrap()}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-500 transition hover:bg-slate-100"
                title={t('layout.refresh_title')}
              >
                <RefreshCw size={14} className={status === 'loading' ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>
        </header>

        {/* Active order banner */}
        {isAuthenticated && activeOrder ? (
          <button
            type="button"
            onClick={() => navigate(`/app/orders/${activeOrder.id}`)}
            className="mx-4 mt-3 flex items-center justify-between gap-3 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-left transition hover:bg-blue-100"
          >
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white">
                <Package size={14} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-blue-700">{t('layout.active_order')} · {formatOrderRef(activeOrder.id)}</p>
                <p className="truncate text-xs text-blue-600/70">{activeOrder.location_text || t('layout.awaiting_delivery')} · {getOrderStatusLabel(activeOrder.status, language)}</p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className="text-sm font-semibold text-blue-700">{formatAmount(activeOrder.total_amount_uzs, language)}</span>
              <ArrowRight size={14} className="text-blue-500" />
            </div>
          </button>
        ) : null}

        {/* Preview mode / unauthenticated prompt */}
        {!isAuthenticated && mode === 'preview' && openInTelegramUrl ? (
          <div className="mx-4 mt-3 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3">
            <p className="text-sm font-medium text-amber-800">{t('home.open_in_telegram')}</p>
            <a
              href={openInTelegramUrl}
              className="mt-2 inline-flex items-center gap-2 rounded-xl bg-amber-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-amber-700"
            >
              {t('home.open_in_telegram_cta')}
              <ArrowRight size={13} />
            </a>
          </div>
        ) : null}

        {/* Error banner */}
        {error ? (
          <div className="mx-4 mt-3 rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            <p>{error}</p>
          </div>
        ) : null}

        <main className="flex-1 px-4 pb-28 pt-4">
          <Outlet />
        </main>
      </div>

      <ClientBottomNav />
    </div>
  );
};
