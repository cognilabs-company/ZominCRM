import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { ArrowRight, Package, RefreshCw, ShieldCheck, UserRound } from 'lucide-react';
import { useClientApp } from '../bootstrap/ClientAppContext';
import { useClientLanguage } from '../bootstrap/ClientLanguageContext';
import { ClientBottomNav } from './ClientBottomNav';
import { ClientPanel } from './ClientPanel';
import { formatAmount, formatOrderRef, getOrderStatusLabel } from '../utils';

export const ClientAppLayout: React.FC = () => {
  const {
    status,
    mode,
    telegramAvailable,
    telegramUser,
    refreshBootstrap,
    client,
    activeOrder,
    bottleSummary,
    error,
    isAuthenticated,
    openInTelegramUrl,
  } = useClientApp();
  const { language, t } = useClientLanguage();

  const displayName = client?.full_name || telegramUser?.first_name || telegramUser?.username || t('layout.telegram_client');

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#eef2f7_100%)] text-slate-950">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col px-4 pb-28 pt-4 md:pb-8">
        <ClientPanel className="overflow-hidden">
          <div className="border-b border-slate-200/70 bg-[linear-gradient(135deg,#0f172a_0%,#172554_48%,#0f766e_100%)] px-5 py-5 text-white">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-3">
                <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/80">
                  <ShieldCheck size={14} />
                  {t('layout.badge')}
                </div>
                <div>
                  <h1 className="text-[30px] font-semibold tracking-tight">{t('layout.title')}</h1>
                  <p className="mt-1 max-w-[20rem] text-sm leading-6 text-white/72">
                    {mode === 'telegram' ? t('layout.telegram_verified') : t('layout.preview_shell')}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => void refreshBootstrap()}
                className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/15 bg-white/10 text-white transition hover:bg-white/15"
                title={t('layout.refresh_title')}
              >
                <RefreshCw size={16} />
              </button>
            </div>

            <div className="mt-5 grid grid-cols-3 gap-3">
              <div className="rounded-3xl border border-white/10 bg-white/10 px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.2em] text-white/55">{t('layout.mode')}</p>
                <p className="mt-1 text-sm font-medium capitalize">{t(`layout.mode.${mode}`)}</p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/10 px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.2em] text-white/55">{t('layout.session')}</p>
                <p className="mt-1 text-sm font-medium capitalize">{t(`layout.status.${status}`)}</p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/10 px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.2em] text-white/55">{t('layout.deposit_held')}</p>
                <p className="mt-1 text-sm font-medium">{formatAmount(bottleSummary?.deposit_held_total_uzs || 0, language)}</p>
              </div>
            </div>
          </div>

          <div className="space-y-4 px-5 py-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{t('layout.active_session')}</p>
                <div className="mt-1 flex items-center gap-2 text-sm font-medium text-slate-900">
                  <UserRound size={16} className="text-slate-400" />
                  <span className="truncate">{displayName}</span>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {telegramAvailable ? t('layout.telegram_detected') : t('layout.telegram_missing')}
                </p>
              </div>

              <NavLink to="/app/profile" className="inline-flex shrink-0 items-center gap-2 rounded-2xl bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800">
                {t('layout.profile')}
                <ArrowRight size={15} />
              </NavLink>
            </div>

            {isAuthenticated && activeOrder ? (
              <div className="rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{t('layout.active_order')}</p>
                    <p className="mt-1 text-sm font-semibold text-slate-950">{formatOrderRef(activeOrder.id)}</p>
                    <p className="mt-1 text-sm text-slate-500">{activeOrder.location_text || t('layout.awaiting_delivery')}</p>
                  </div>
                  <div className="text-right">
                    <div className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-3 py-1 text-xs font-medium text-sky-700">
                      <Package size={12} />
                      {getOrderStatusLabel(activeOrder.status, language)}
                    </div>
                    <p className="mt-2 text-sm font-semibold text-slate-950">{formatAmount(activeOrder.total_amount_uzs, language)}</p>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </ClientPanel>

        {!isAuthenticated && mode === 'preview' ? (
          <ClientPanel className="mt-4 p-5">
            <h2 className="text-base font-semibold text-slate-950">{t('home.open_in_telegram')}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">{t('home.preview_mode')}</p>
            {openInTelegramUrl ? (
              <a
                href={openInTelegramUrl}
                className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
              >
                {t('home.open_in_telegram_cta')}
                <ArrowRight size={15} />
              </a>
            ) : null}
          </ClientPanel>
        ) : null}

        {error ? (
          <ClientPanel className="mt-4 border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
            <p>{error}</p>
            {openInTelegramUrl ? (
              <a
                href={openInTelegramUrl}
                className="mt-3 inline-flex items-center gap-2 rounded-2xl bg-rose-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-rose-800"
              >
                {t('home.open_in_telegram_cta')}
                <ArrowRight size={15} />
              </a>
            ) : null}
          </ClientPanel>
        ) : null}

        <main className="mt-4 flex-1">
          <Outlet />
        </main>
      </div>

      <ClientBottomNav />
    </div>
  );
};
