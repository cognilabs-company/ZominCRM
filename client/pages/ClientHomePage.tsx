import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Droplets, Package, ShoppingBag, WalletCards } from 'lucide-react';
import { useClientApp } from '../bootstrap/ClientAppContext';
import { useClientCart } from '../bootstrap/ClientCartContext';
import { useClientLanguage } from '../bootstrap/ClientLanguageContext';
import { ClientPage } from '../components/ClientPage';
import { ClientPanel } from '../components/ClientPanel';
import { formatAmount, formatOrderRef, getBottleDepositHeldTotal } from '../utils';

export const ClientHomePage: React.FC = () => {
  const navigate = useNavigate();
  const { client, bottleSummary, activeOrder, isAuthenticated, status, mode, openInTelegramUrl } = useClientApp();
  const { itemsCount, productSubtotal } = useClientCart();
  const { language, t } = useClientLanguage();
  const depositHeld = getBottleDepositHeldTotal(bottleSummary);

  const quickActions = [
    {
      key: 'products',
      title: t('home.quick.products.title'),
      description: t('home.quick.products.description'),
      to: '/app/products',
      icon: ShoppingBag,
    },
    {
      key: 'cart',
      title: t('home.quick.cart.title'),
      description: t('home.quick.cart.description'),
      to: '/app/cart',
      icon: WalletCards,
    },
    {
      key: 'orders',
      title: t('home.quick.orders.title'),
      description: t('home.quick.orders.description'),
      to: '/app/orders',
      icon: Package,
    },
    {
      key: 'bottles',
      title: t('home.quick.bottles.title'),
      description: t('home.quick.bottles.description'),
      to: '/app/idishlar',
      icon: Droplets,
    },
  ];

  const summaryCards = [
    {
      key: 'cart',
      label: t('home.cart_items'),
      value: String(itemsCount),
      meta: formatAmount(productSubtotal, language),
    },
    {
      key: 'bottles',
      label: t('home.bottle_balance'),
      value: String(bottleSummary?.total_outstanding_bottles_count ?? 0),
      meta: formatAmount(depositHeld, language),
    },
    {
      key: 'session',
      label: t('home.session'),
      value: t(`layout.status.${status}`),
      meta: client?.full_name || t('layout.telegram_client'),
    },
    {
      key: 'order',
      label: t('layout.active_order'),
      value: activeOrder ? formatOrderRef(activeOrder.id) : '-',
      meta: activeOrder ? formatAmount(activeOrder.total_amount_uzs, language) : t('home.delivery_placeholder'),
    },
  ];

  return (
    <ClientPage title={t('home.title')}>
      {!isAuthenticated ? (
        <ClientPanel className="overflow-hidden p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                {mode === 'preview' ? t('home.open_in_telegram') : t('home.session')}
              </p>
              <h2 className="mt-2 text-lg font-semibold text-slate-950">{t('home.open_in_telegram')}</h2>
            </div>
            <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium uppercase tracking-[0.16em] text-slate-700">
              {t(`layout.status.${status}`)}
            </div>
          </div>
          <p className="mt-3 text-sm text-slate-500">
            {mode === 'preview' ? t('home.preview_mode') : t('home.verifying')}
          </p>
          {mode === 'preview' && openInTelegramUrl ? (
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

      <div className="grid grid-cols-2 gap-3">
        {summaryCards.map((card) => (
          <ClientPanel key={card.key} className="p-4">
            <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">{card.label}</p>
            <p className="mt-2 truncate text-xl font-semibold text-slate-950">{card.value}</p>
            <p className="mt-1 truncate text-sm text-slate-500">{card.meta}</p>
          </ClientPanel>
        ))}
      </div>

      {activeOrder ? (
        <ClientPanel className="overflow-hidden p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">{t('home.current_active_order')}</p>
              <h2 className="mt-2 text-lg font-semibold text-slate-950">{formatOrderRef(activeOrder.id)}</h2>
              <p className="mt-2 text-sm text-slate-500">{activeOrder.location_text || t('home.delivery_placeholder')}</p>
            </div>
            <button
              type="button"
              onClick={() => navigate(`/app/orders/${activeOrder.id}`)}
              className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(15,23,42,0.18)] transition hover:bg-slate-800"
            >
              {t('home.open_orders')}
              <ArrowRight size={15} />
            </button>
          </div>
        </ClientPanel>
      ) : null}

      {itemsCount > 0 ? (
        <ClientPanel className="overflow-hidden border-slate-950 bg-slate-950 p-5 text-white">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-white/55">{t('cart.ready_title')}</p>
              <p className="mt-1 text-sm text-white/75">{formatAmount(productSubtotal, language)}</p>
            </div>
            <button
              type="button"
              onClick={() => navigate('/app/cart')}
              className="inline-flex shrink-0 items-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-950 shadow-[0_12px_24px_rgba(255,255,255,0.12)] transition hover:bg-slate-100"
            >
              {t('products.open_cart')}
              <ArrowRight size={15} />
            </button>
          </div>
        </ClientPanel>
      ) : null}

      <div className="grid grid-cols-1 gap-3">
        {quickActions.map((item) => (
          <button key={item.key} type="button" onClick={() => navigate(item.to)} className="text-left">
            <ClientPanel className="flex items-center gap-4 p-4 transition hover:border-slate-300 hover:shadow-[0_18px_34px_rgba(15,23,42,0.08)]">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] bg-slate-100 text-slate-700">
                <item.icon size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-950">{item.title}</p>
                <p className="mt-1 text-sm text-slate-500">{item.description}</p>
              </div>
              <ArrowRight size={18} className="shrink-0 text-slate-300" />
            </ClientPanel>
          </button>
        ))}
      </div>
    </ClientPage>
  );
};
