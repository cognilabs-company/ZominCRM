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

  return (
    <ClientPage title={t('home.title')} subtitle={t('home.subtitle')}>
      {!isAuthenticated ? (
        <ClientPanel className="overflow-hidden p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#9a6b3a]">{mode === 'preview' ? t('home.open_in_telegram') : t('home.session')}</p>
              <h2 className="mt-2 text-lg font-semibold text-[#1f2933]">{t('home.open_in_telegram')}</h2>
            </div>
            <div className="rounded-full bg-[#21404d] px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] text-white">{t(`layout.status.${status}`)}</div>
          </div>
          <p className="mt-3 text-sm leading-6 text-[#5b6770]">
            {mode === 'preview' ? t('home.preview_mode') : t('home.verifying')}
          </p>
          {mode === 'preview' && openInTelegramUrl ? (
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

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <ClientPanel className="bg-[linear-gradient(135deg,rgba(255,248,238,0.96)_0%,rgba(247,237,224,0.92)_100%)] p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-[#9a6b3a]">{t('home.cart_items')}</p>
          <p className="mt-2 text-2xl font-semibold text-[#1f2933]">{itemsCount}</p>
          <p className="mt-1 text-sm text-[#5b6770]">{t('home.product_subtotal')} {formatAmount(productSubtotal, language)}</p>
        </ClientPanel>
        <ClientPanel className="bg-[linear-gradient(135deg,rgba(233,243,239,0.96)_0%,rgba(224,236,233,0.92)_100%)] p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-[#40635b]">{t('home.bottle_balance')}</p>
          <p className="mt-2 text-2xl font-semibold text-[#1f2933]">{bottleSummary?.total_outstanding_bottles_count ?? 0}</p>
          <p className="mt-1 text-sm text-[#5b6770]">{t('layout.deposit_held')} {formatAmount(depositHeld, language)}</p>
        </ClientPanel>
        <ClientPanel className="bg-[linear-gradient(135deg,rgba(235,240,244,0.94)_0%,rgba(226,232,240,0.92)_100%)] p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-[#5a6d7c]">{t('home.session')}</p>
          <p className="mt-2 text-2xl font-semibold capitalize text-[#1f2933]">{t(`layout.status.${status}`)}</p>
          <p className="mt-1 text-sm text-[#5b6770]">{client?.full_name || t('layout.telegram_client')}</p>
        </ClientPanel>
      </div>

      {activeOrder ? (
        <ClientPanel className="overflow-hidden p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-[#9a6b3a]">{t('home.current_active_order')}</p>
              <h2 className="mt-2 text-lg font-semibold text-[#1f2933]">{formatOrderRef(activeOrder.id)}</h2>
              <p className="mt-2 text-sm leading-6 text-[#5b6770]">{activeOrder.location_text || t('home.delivery_placeholder')}</p>
            </div>
            <button
              type="button"
              onClick={() => navigate(`/app/orders/${activeOrder.id}`)}
              className="inline-flex items-center gap-2 rounded-2xl bg-[#21404d] px-4 py-3 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(33,64,77,0.18)] transition hover:brightness-105"
            >
              {t('home.open_orders')}
              <ArrowRight size={15} />
            </button>
          </div>
        </ClientPanel>
      ) : null}

      {itemsCount > 0 ? (
        <ClientPanel className="overflow-hidden bg-[linear-gradient(135deg,rgba(33,64,77,0.96)_0%,rgba(54,92,103,0.94)_100%)] p-5 text-white">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-white/55">{t('cart.ready_title')}</p>
              <p className="mt-1 text-sm text-white/78">{t('cart.ready_description')}</p>
            </div>
            <button
              type="button"
              onClick={() => navigate('/app/cart')}
              className="inline-flex shrink-0 items-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-[#21404d] shadow-[0_12px_24px_rgba(255,255,255,0.16)] transition hover:bg-[#fff5ea]"
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
            <ClientPanel className="flex items-center gap-4 p-4 transition hover:-translate-y-0.5 hover:shadow-[0_20px_40px_rgba(63,48,34,0.12)]">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[22px] bg-[linear-gradient(135deg,#21404d_0%,#3d6c77_100%)] text-white">
                <item.icon size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-[#1f2933]">{item.title}</p>
                <p className="mt-1 text-sm leading-6 text-[#5b6770]">{item.description}</p>
              </div>
              <ArrowRight size={18} className="shrink-0 text-[#c0a07c]" />
            </ClientPanel>
          </button>
        ))}
      </div>
    </ClientPage>
  );
};
