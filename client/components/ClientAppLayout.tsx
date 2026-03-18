import React from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { ArrowRight, Compass, Package, RefreshCw, ShieldCheck, UserRound } from 'lucide-react';
import { useClientApp } from '../bootstrap/ClientAppContext';
import { useClientLanguage } from '../bootstrap/ClientLanguageContext';
import { ClientBottomNav } from './ClientBottomNav';
import { ClientPanel } from './ClientPanel';
import { formatAmount, formatOrderRef, getBottleDepositHeldTotal, getOrderStatusLabel } from '../utils';

const FlagIcon: React.FC<{ code: 'uz' | 'ru' | 'en' }> = ({ code }) => {
  if (code === 'uz') {
    return (
      <svg viewBox="0 0 24 16" className="h-4 w-6 overflow-hidden rounded-[4px] shadow-sm" aria-hidden="true">
        <rect width="24" height="16" fill="#ffffff" />
        <rect width="24" height="5" y="0" fill="#23a9e1" />
        <rect width="24" height="1" y="5" fill="#d64045" />
        <rect width="24" height="5" y="6" fill="#ffffff" />
        <rect width="24" height="1" y="11" fill="#d64045" />
        <rect width="24" height="5" y="12" fill="#34a853" />
        <rect width="6" height="5" y="0" fill="#1f4d8f" />
        <circle cx="3" cy="2.5" r="1.2" fill="#ffffff" />
        <circle cx="3.4" cy="2.5" r="1.0" fill="#1f4d8f" />
      </svg>
    );
  }

  if (code === 'ru') {
    return (
      <svg viewBox="0 0 24 16" className="h-4 w-6 overflow-hidden rounded-[4px] shadow-sm" aria-hidden="true">
        <rect width="24" height="16" fill="#ffffff" />
        <rect width="24" height="5.333" y="5.333" fill="#2458d3" />
        <rect width="24" height="5.334" y="10.666" fill="#d64045" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 16" className="h-4 w-6 overflow-hidden rounded-[4px] shadow-sm" aria-hidden="true">
      <rect width="24" height="16" fill="#b22234" />
      <rect width="24" height="2" y="2" fill="#ffffff" />
      <rect width="24" height="2" y="6" fill="#ffffff" />
      <rect width="24" height="2" y="10" fill="#ffffff" />
      <rect width="24" height="2" y="14" fill="#ffffff" />
      <rect width="10" height="8" fill="#3c3b6e" />
    </svg>
  );
};

export const ClientAppLayout: React.FC = () => {
  const navigate = useNavigate();
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
  const { language, setLanguage, t } = useClientLanguage();

  const displayName = client?.full_name || telegramUser?.first_name || telegramUser?.username || t('layout.telegram_client');
  const depositHeld = getBottleDepositHeldTotal(bottleSummary);
  const languageOptions = [
    { code: 'uz' },
    { code: 'ru' },
    { code: 'en' },
  ] as const;

  return (
    <div className="min-h-screen bg-[#f4f6f8] text-slate-900">
      <div className="pointer-events-none fixed inset-x-0 top-0 h-64 bg-[radial-gradient(circle_at_top,rgba(15,23,42,0.08),transparent_48%),radial-gradient(circle_at_top_left,rgba(148,163,184,0.12),transparent_36%)]" />
      <div className="relative mx-auto flex min-h-screen w-full max-w-md flex-col px-4 pb-28 pt-4 md:pb-8">
        <ClientPanel className="px-5 py-5">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-600">
                <ShieldCheck size={14} />
                {t('layout.badge')}
              </div>
              <div>
                <h1 className="text-[28px] font-semibold tracking-[-0.05em] text-slate-950">{t('layout.title')}</h1>
                <p className="mt-1 text-sm text-slate-500">
                  {mode === 'telegram' ? t('layout.telegram_verified') : t('layout.preview_shell')}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void refreshBootstrap()}
              className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-700 transition hover:bg-slate-100"
              title={t('layout.refresh_title')}
            >
              <RefreshCw size={16} />
            </button>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            <div className="rounded-[18px] border border-slate-200 bg-slate-50 px-3 py-3">
              <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400">{t('layout.mode')}</p>
              <p className="mt-1 text-sm font-medium capitalize text-slate-900">{t(`layout.mode.${mode}`)}</p>
            </div>
            <div className="rounded-[18px] border border-slate-200 bg-slate-50 px-3 py-3">
              <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400">{t('layout.session')}</p>
              <p className="mt-1 text-sm font-medium capitalize text-slate-900">{t(`layout.status.${status}`)}</p>
            </div>
            <div className="rounded-[18px] border border-slate-200 bg-slate-50 px-3 py-3">
              <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400">{t('layout.deposit_held')}</p>
              <p className="mt-1 text-sm font-medium text-slate-900">{formatAmount(depositHeld, language)}</p>
            </div>
          </div>
        </ClientPanel>

        <div className="mt-4 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <ClientPanel className="min-w-0 flex-1 px-4 py-4">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">{t('layout.active_session')}</p>
              <div className="mt-2 flex items-center gap-2 text-sm font-medium text-slate-900">
                <UserRound size={16} className="text-slate-400" />
                <span className="truncate">{displayName}</span>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {telegramAvailable ? t('layout.telegram_detected') : t('layout.telegram_missing')}
              </p>
              <div className="mt-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{t('layout.language_label')}</p>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {languageOptions.map((option) => (
                    <button
                      key={option.code}
                      type="button"
                      onClick={() => setLanguage(option.code)}
                      className={`flex items-center justify-center rounded-2xl border px-3 py-2.5 text-xs font-semibold transition ${
                        language === option.code
                          ? 'border-slate-900 bg-slate-900 text-white shadow-[0_8px_18px_rgba(15,23,42,0.16)]'
                          : 'border-slate-200 bg-slate-50 text-slate-500 hover:border-slate-300 hover:bg-white hover:text-slate-900'
                      }`}
                      title={t(`language.${option.code}`)}
                    >
                      <FlagIcon code={option.code} />
                    </button>
                  ))}
                </div>
              </div>
            </ClientPanel>

            <button
              type="button"
              onClick={() => navigate('/app/profile')}
              className="inline-flex shrink-0 items-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(15,23,42,0.18)] transition hover:bg-slate-800"
            >
              {t('layout.profile')}
              <ArrowRight size={15} />
            </button>
          </div>

          {isAuthenticated && activeOrder ? (
            <ClientPanel className="px-4 py-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">{t('layout.active_order')}</p>
                  <p className="mt-1 text-sm font-semibold text-slate-950">{formatOrderRef(activeOrder.id)}</p>
                  <p className="mt-1 text-sm text-slate-500">{activeOrder.location_text || t('layout.awaiting_delivery')}</p>
                </div>
                <div className="text-right">
                  <div className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                    <Package size={12} />
                    {getOrderStatusLabel(activeOrder.status, language)}
                  </div>
                  <p className="mt-2 text-sm font-semibold text-slate-950">{formatAmount(activeOrder.total_amount_uzs, language)}</p>
                </div>
              </div>
            </ClientPanel>
          ) : null}
        </div>

        {!isAuthenticated && mode === 'preview' ? (
          <ClientPanel className="mt-4 overflow-hidden p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-white">
                <Compass size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-base font-semibold text-slate-950">{t('home.open_in_telegram')}</h2>
                <p className="mt-2 text-sm text-slate-500">{t('home.preview_mode')}</p>
              </div>
            </div>
            {openInTelegramUrl ? (
              <a
                href={openInTelegramUrl}
                className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(15,23,42,0.18)] transition hover:bg-slate-800"
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
