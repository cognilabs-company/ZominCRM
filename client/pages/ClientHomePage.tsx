import React from 'react';
import { NavLink } from 'react-router-dom';
import { ArrowRight, Droplets, Package, ShoppingBag, ShoppingCart, WalletCards } from 'lucide-react';
import { useClientApp } from '../bootstrap/ClientAppContext';
import { useClientCart } from '../bootstrap/ClientCartContext';
import { ClientPage } from '../components/ClientPage';
import { ClientPanel } from '../components/ClientPanel';
import { formatAmount, formatOrderRef } from '../utils';

const quickActions = [
  {
    title: 'Browse products',
    description: 'Real client catalog backed by /client/webapp/products/.',
    to: '/app/products',
    icon: ShoppingBag,
  },
  {
    title: 'Cart and preview',
    description: 'Preview-first checkout with product subtotal and bottle deposit split.',
    to: '/app/cart',
    icon: WalletCards,
  },
  {
    title: 'My orders',
    description: 'Only current client orders are visible in the WebApp.',
    to: '/app/orders',
    icon: Package,
  },
  {
    title: 'Bottle balance',
    description: 'Read-only deposit summary and movement history.',
    to: '/app/bottles',
    icon: Droplets,
  },
];

export const ClientHomePage: React.FC = () => {
  const { client, bottleSummary, activeOrder, isAuthenticated, status, mode } = useClientApp();
  const { itemsCount, productSubtotal } = useClientCart();

  return (
    <ClientPage
      title="Home"
      subtitle="Client-first Telegram flow with isolated modules and live WebApp data."
    >
      {!isAuthenticated ? (
        <ClientPanel className="p-5">
          <h2 className="text-base font-semibold text-slate-950">Open this inside Telegram</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            {mode === 'preview'
              ? 'Preview mode is active. Real client data will appear after Telegram WebApp bootstrap succeeds.'
              : 'Client session is still being verified.'}
          </p>
        </ClientPanel>
      ) : null}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <ClientPanel className="p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Cart items</p>
          <p className="mt-2 text-2xl font-semibold text-slate-950">{itemsCount}</p>
          <p className="mt-1 text-sm text-slate-500">Product subtotal {formatAmount(productSubtotal)}</p>
        </ClientPanel>
        <ClientPanel className="p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Bottle balance</p>
          <p className="mt-2 text-2xl font-semibold text-slate-950">{bottleSummary?.total_outstanding_bottles_count ?? 0}</p>
          <p className="mt-1 text-sm text-slate-500">Deposit held {formatAmount(bottleSummary?.deposit_held_total_uzs ?? 0)}</p>
        </ClientPanel>
        <ClientPanel className="p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Session</p>
          <p className="mt-2 text-2xl font-semibold text-slate-950 capitalize">{status}</p>
          <p className="mt-1 text-sm text-slate-500">{client?.full_name || 'Telegram client'}</p>
        </ClientPanel>
      </div>

      {activeOrder ? (
        <ClientPanel className="p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Current active order</p>
              <h2 className="mt-2 text-lg font-semibold text-slate-950">{formatOrderRef(activeOrder.id)}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">{activeOrder.location_text || 'Delivery address will appear here.'}</p>
            </div>
            <NavLink
              to="/app/orders"
              className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              Open orders
              <ArrowRight size={15} />
            </NavLink>
          </div>
        </ClientPanel>
      ) : null}

      <div className="grid grid-cols-1 gap-3">
        {quickActions.map((item) => (
          <NavLink key={item.title} to={item.to}>
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
            <h2 className="text-base font-semibold text-slate-950">Checkout flow</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              The client app now follows the correct order flow: select products, manage quantities, preview subtotal and deposit, then create the order using only `/client/webapp/...` endpoints.
            </p>
          </div>
        </div>
      </ClientPanel>
    </ClientPage>
  );
};
