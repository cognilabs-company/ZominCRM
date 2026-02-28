import React from 'react';
import { NavLink } from 'react-router-dom';
import { ArrowRight, Droplets, Package, ShoppingBag, ShoppingCart, WalletCards } from 'lucide-react';
import { useClientApp } from '../bootstrap/ClientAppContext';
import { useClientCart } from '../bootstrap/ClientCartContext';
import { useClientLanguage } from '../bootstrap/ClientLanguageContext';
import { ClientPage } from '../components/ClientPage';
import { ClientPanel } from '../components/ClientPanel';
import { formatAmount, formatOrderRef } from '../utils';

export const ClientHomePage: React.FC = () => {
  const { client, bottleSummary, activeOrder, isAuthenticated, status, mode, openInTelegramUrl } = useClientApp();
  const { itemsCount, productSubtotal } = useClientCart();
  const { language, t } = useClientLanguage();

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
      to: '/app/bottles',
      icon: Droplets,
    },
  ];

  return (
    <ClientPage
      title={t('home.title')}
      subtitle={t('home.subtitle')}
    >
      {!isAuthenticated ? (
        <ClientPanel className="p-5">
          <h2 className="text-base font-semibold text-slate-950">{t('home.open_in_telegram')}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            {mode === 'preview' ? t('home.preview_mode') : t('home.verifying')}
          </p>
          {mode === 'preview' && openInTelegramUrl ? (
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

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <ClientPanel className="p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{t('home.cart_items')}</p>
          <p className="mt-2 text-2xl font-semibold text-slate-950">{itemsCount}</p>
          <p className="mt-1 text-sm text-slate-500">{t('home.product_subtotal')} {formatAmount(productSubtotal, language)}</p>
        </ClientPanel>
        <ClientPanel className="p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{t('home.bottle_balance')}</p>
          <p className="mt-2 text-2xl font-semibold text-slate-950">{bottleSummary?.total_outstanding_bottles_count ?? 0}</p>
          <p className="mt-1 text-sm text-slate-500">{t('layout.deposit_held')} {formatAmount(bottleSummary?.deposit_held_total_uzs ?? 0, language)}</p>
        </ClientPanel>
        <ClientPanel className="p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{t('home.session')}</p>
          <p className="mt-2 text-2xl font-semibold text-slate-950 capitalize">{t(`layout.status.${status}`)}</p>
          <p className="mt-1 text-sm text-slate-500">{client?.full_name || t('layout.telegram_client')}</p>
        </ClientPanel>
      </div>

      {activeOrder ? (
        <ClientPanel className="p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{t('home.current_active_order')}</p>
              <h2 className="mt-2 text-lg font-semibold text-slate-950">{formatOrderRef(activeOrder.id)}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">{activeOrder.location_text || t('home.delivery_placeholder')}</p>
            </div>
            <NavLink
              to="/app/orders"
              className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              {t('home.open_orders')}
              <ArrowRight size={15} />
            </NavLink>
          </div>
        </ClientPanel>
      ) : null}

      <div className="grid grid-cols-1 gap-3">
        {quickActions.map((item) => (
          <NavLink key={item.key} to={item.to}>
            <ClientPanel className="flex items-center gap-4 p-4 transition hover:-translate-y-0.5 hover:shadow-[0_16px_34px_rgba(15,23,42,0.12)]">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-white">
                <item.icon size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-950">{item.title}</p>
                <p className="mt-1 text-sm leading-6 text-slate-500">{item.description}</p>
              </div>
              <ArrowRight size={18} className="shrink-0 text-slate-300" />
            </ClientPanel>
          </NavLink>
        ))}
      </div>

      <ClientPanel className="p-5">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-white">
            <ShoppingCart size={20} />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-950">{t('home.checkout_flow_title')}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              {t('home.checkout_flow')}
            </p>
          </div>
        </div>
      </ClientPanel>
    </ClientPage>
  );
};
