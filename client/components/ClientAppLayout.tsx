import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { ArrowRight, Compass, Package, RefreshCw, ShieldCheck, Sparkles, UserRound } from 'lucide-react';
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
  const { language, setLanguage, t } = useClientLanguage();

  const displayName = client?.full_name || telegramUser?.first_name || telegramUser?.username || t('layout.telegram_client');
  const depositHeld = bottleSummary?.total_deposit_held_uzs || 0;
  const languageOptions = [
    { code: 'uz', flag: 'UZ', icon: '🇺🇿' },
    { code: 'ru', flag: 'RU', icon: '🇷🇺' },
    { code: 'en', flag: 'EN', icon: '🇺🇸' },
  ] as const;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(247,223,186,0.5)_0%,rgba(243,239,231,1)_34%,rgba(226,235,233,1)_100%)] text-[#1f2933]">
      <div className="pointer-events-none fixed inset-x-0 top-0 h-72 bg-[radial-gradient(circle_at_top_right,rgba(38,70,83,0.18),transparent_58%),radial-gradient(circle_at_top_left,rgba(244,162,97,0.24),transparent_42%)]" />
      <div className="relative mx-auto flex min-h-screen w-full max-w-md flex-col px-4 pb-28 pt-4 md:pb-8">
        <div className="rounded-[34px] border border-white/10 bg-[linear-gradient(145deg,#1f3b47_0%,#284b63_48%,#cb7c45_100%)] px-5 py-5 text-white shadow-[0_28px_60px_rgba(31,59,71,0.30)]">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/80">
                <ShieldCheck size={14} />
                {t('layout.badge')}
              </div>
              <div>
                <h1 className="text-[32px] font-semibold tracking-[-0.05em]">{t('layout.title')}</h1>
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
              <p className="mt-1 text-sm font-medium">{formatAmount(depositHeld, language)}</p>
            </div>
          </div>
        </div>

        <div className="mt-4 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 rounded-[30px] border border-white/75 bg-[rgba(255,250,244,0.86)] px-4 py-4 shadow-[0_20px_46px_rgba(63,48,34,0.08)]">
              <p className="text-xs uppercase tracking-[0.2em] text-[#9a6b3a]">{t('layout.active_session')}</p>
              <div className="mt-1 flex items-center gap-2 text-sm font-medium text-[#1f2933]">
                <UserRound size={16} className="text-[#8d99a2]" />
                <span className="truncate">{displayName}</span>
              </div>
              <p className="mt-1 text-xs text-[#5b6770]">
                {telegramAvailable ? t('layout.telegram_detected') : t('layout.telegram_missing')}
              </p>
              <div className="mt-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#9a6b3a]">{t('layout.language_label')}</p>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {languageOptions.map((option) => (
                    <button
                      key={option.code}
                      type="button"
                      onClick={() => setLanguage(option.code)}
                      className={`flex items-center justify-center gap-2 rounded-2xl border px-3 py-2.5 text-xs font-semibold transition ${
                        language === option.code
                          ? 'border-[#21404d] bg-[#21404d] text-white shadow-[0_8px_18px_rgba(33,64,77,0.20)]'
                          : 'border-transparent bg-[#f3eadf] text-[#5b6770] hover:border-[#d9c7b4] hover:bg-white hover:text-[#1f2933]'
                      }`}
                      title={t(`language.${option.code}`)}
                    >
                      <span className="text-sm leading-none">{option.icon}</span>
                      <span>{option.flag}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <NavLink to="/app/profile" className="inline-flex shrink-0 items-center gap-2 rounded-2xl bg-[linear-gradient(135deg,#f59e0b_0%,#e76f51_100%)] px-4 py-3 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(231,111,81,0.24)] transition hover:brightness-105">
              {t('layout.profile')}
              <ArrowRight size={15} />
            </NavLink>
          </div>

          {isAuthenticated && activeOrder ? (
            <div className="rounded-[30px] border border-white/70 bg-[linear-gradient(135deg,rgba(255,247,237,0.92)_0%,rgba(246,242,233,0.92)_100%)] px-4 py-4 shadow-[0_18px_38px_rgba(90,71,48,0.08)]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-[#9a6b3a]">{t('layout.active_order')}</p>
                  <p className="mt-1 text-sm font-semibold text-[#1f2933]">{formatOrderRef(activeOrder.id)}</p>
                  <p className="mt-1 text-sm text-[#5b6770]">{activeOrder.location_text || t('layout.awaiting_delivery')}</p>
                </div>
                <div className="text-right">
                  <div className="inline-flex items-center gap-1 rounded-full bg-[#21404d] px-3 py-1 text-xs font-medium text-white">
                    <Package size={12} />
                    {getOrderStatusLabel(activeOrder.status, language)}
                  </div>
                  <p className="mt-2 text-sm font-semibold text-[#1f2933]">{formatAmount(activeOrder.total_amount_uzs, language)}</p>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {!isAuthenticated && mode === 'preview' ? (
          <ClientPanel className="mt-4 overflow-hidden p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#21404d] text-white">
                <Compass size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-base font-semibold text-[#1f2933]">{t('home.open_in_telegram')}</h2>
                <p className="mt-2 text-sm leading-6 text-[#5b6770]">{t('home.preview_mode')}</p>
              </div>
            </div>
            {openInTelegramUrl ? (
              <a
                href={openInTelegramUrl}
                className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-[linear-gradient(135deg,#f59e0b_0%,#e76f51_100%)] px-4 py-3 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(231,111,81,0.24)] transition hover:brightness-105"
              >
                {t('home.open_in_telegram_cta')}
                <ArrowRight size={15} />
              </a>
            ) : null}
          </ClientPanel>
        ) : null}

        {error ? (
          <ClientPanel className="mt-4 border-rose-200 bg-[rgba(255,241,240,0.95)] p-4 text-sm text-rose-700">
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

        <div className="pointer-events-none mt-6 flex items-center justify-center gap-2 pb-2 text-[11px] font-medium uppercase tracking-[0.28em] text-[#9ba7ae]">
          <Sparkles size={12} />
          Telegram Client Surface
        </div>
      </div>

      <ClientBottomNav />
    </div>
  );
};
