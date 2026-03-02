import React from 'react';
import { NavLink } from 'react-router-dom';
import { ArrowRight, Minus, Plus } from 'lucide-react';
import { useClientCart } from '../bootstrap/ClientCartContext';
import { useClientLanguage } from '../bootstrap/ClientLanguageContext';
import { ClientLocationPicker } from '../components/ClientLocationPicker';
import { ClientPage } from '../components/ClientPage';
import { ClientPanel } from '../components/ClientPanel';
import { formatAmount, getPaymentMethodLabel } from '../utils';

export const ClientCartPage: React.FC = () => {
  const { items, itemsCount, orderDraft, productSubtotal, updateQuantity, removeProduct, setOrderDraft } = useClientCart();
  const { language, t } = useClientLanguage();
  const hasItems = itemsCount > 0;

  return (
    <ClientPage
      title={t('cart.title')}
      subtitle={t('cart.subtitle')}
      action={
        <NavLink
          to="/app/checkout"
          className={`inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-medium transition ${
            hasItems
              ? 'bg-[linear-gradient(135deg,#21404d_0%,#3d6c77_100%)] text-white shadow-[0_12px_24px_rgba(33,64,77,0.18)] hover:brightness-105'
              : 'bg-slate-200 text-slate-400 cursor-not-allowed pointer-events-none'
          }`}
          aria-disabled={!hasItems}
        >
          {t('cart.preview')}
          <ArrowRight size={15} />
        </NavLink>
      }
    >
      {items.length === 0 ? (
        <ClientPanel className="p-5 text-sm text-[#5b6770]">
          {t('cart.empty')}
        </ClientPanel>
      ) : (
        <div className="grid gap-3">
          {items.map((item) => (
            <ClientPanel key={item.product_id} className="overflow-hidden p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <h2 className="text-sm font-semibold text-[#1f2933]">{item.name}</h2>
                  <p className="mt-1 text-sm text-[#5b6770]">{item.size_liters}L · {item.sku}</p>
                  <p className="mt-2 text-sm text-[#5b6770]">{t('cart.unit_price')} {formatAmount(item.unit_price_uzs, language)}</p>
                </div>
                <button type="button" onClick={() => removeProduct(item.product_id)} className="rounded-2xl bg-[rgba(255,241,240,0.95)] px-3 py-2 text-sm font-medium text-rose-600 transition hover:bg-rose-100 active:bg-rose-200" title="Remove from cart">
                  {t('cart.remove')}
                </button>
              </div>
              <div className="mt-4 flex items-center justify-between gap-3">
                <div className="inline-flex items-center gap-2 rounded-2xl bg-[#21404d] px-2 py-2 text-white shadow-[0_12px_24px_rgba(33,64,77,0.18)]">
                  <button type="button" onClick={() => updateQuantity(item.product_id, item.quantity - 1)} className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/10 transition hover:bg-white/20 active:bg-white/25" aria-label="Decrease quantity">
                    <Minus size={16} />
                  </button>
                  <span className="min-w-8 text-center text-sm font-semibold">{item.quantity}</span>
                  <button type="button" onClick={() => updateQuantity(item.product_id, item.quantity + 1)} className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/10 transition hover:bg-white/20 active:bg-white/25" aria-label="Increase quantity">
                    <Plus size={16} />
                  </button>
                </div>
                <div className="text-right">
                  <p className="text-xs uppercase tracking-[0.2em] text-[#9a6b3a]">{t('cart.line_total')}</p>
                  <p className="mt-1 text-sm font-semibold text-[#1f2933]">{formatAmount(item.unit_price_uzs * item.quantity, language)}</p>
                </div>
              </div>
            </ClientPanel>
          ))}
        </div>
      )}

      <ClientPanel className="p-5">
        <div className="grid gap-4">
          <div>
            <label className="block text-sm font-medium text-[#31424d]">{t('cart.delivery_address')}</label>
            <textarea
              value={orderDraft.location_text}
              onChange={(event) => setOrderDraft({ location_text: event.target.value })}
              className="mt-2 h-24 w-full rounded-[22px] border border-[#e7ddd0] bg-[rgba(255,248,240,0.94)] px-4 py-3 text-sm text-[#1f2933] outline-none transition focus:border-[#cb7c45]"
              placeholder={t('cart.delivery_address_placeholder')}
            />
          </div>

          <ClientLocationPicker
            address={orderDraft.location_text}
            latitude={orderDraft.location_lat}
            longitude={orderDraft.location_lng}
            onApply={(payload) => setOrderDraft(payload)}
          />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-[#31424d]">{t('cart.payment_method')}</label>
              <select
                value={orderDraft.payment_method}
                onChange={(event) => setOrderDraft({ payment_method: event.target.value as 'CASH' | 'TRANSFER' })}
                className="mt-2 w-full rounded-[22px] border border-[#e7ddd0] bg-[rgba(255,248,240,0.94)] px-4 py-3 text-sm text-[#1f2933] outline-none transition focus:border-[#cb7c45]"
              >
                <option value="CASH">{getPaymentMethodLabel('CASH', language)}</option>
                <option value="TRANSFER">{getPaymentMethodLabel('TRANSFER', language)}</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-[#31424d]">{t('cart.delivery_time')}</label>
              <input
                type="datetime-local"
                value={orderDraft.delivery_time_requested}
                onChange={(event) => setOrderDraft({ delivery_time_requested: event.target.value })}
                className="mt-2 w-full rounded-[22px] border border-[#e7ddd0] bg-[rgba(255,248,240,0.94)] px-4 py-3 text-sm text-[#1f2933] outline-none transition focus:border-[#cb7c45]"
              />
            </div>
            <div className="rounded-[22px] border border-[#e7ddd0] bg-[rgba(255,248,240,0.94)] px-4 py-3 sm:col-span-2">
              <p className="text-sm font-medium text-[#31424d]">{t('cart.map_selected_title')}</p>
              <p className="mt-2 text-sm text-[#5b6770]">
                {orderDraft.location_text || t('cart.map_selected_empty')}
              </p>
            </div>
          </div>
        </div>
      </ClientPanel>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <ClientPanel className="bg-[linear-gradient(135deg,rgba(255,248,238,0.96)_0%,rgba(247,237,224,0.92)_100%)] p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-[#9a6b3a]">{t('cart.items')}</p>
          <p className="mt-2 text-xl font-semibold text-[#1f2933]">{itemsCount}</p>
        </ClientPanel>
        <ClientPanel className="bg-[linear-gradient(135deg,rgba(233,243,239,0.96)_0%,rgba(224,236,233,0.92)_100%)] p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-[#40635b]">{t('checkout.product_subtotal')}</p>
          <p className="mt-2 text-xl font-semibold text-[#1f2933]">{formatAmount(productSubtotal, language)}</p>
        </ClientPanel>
        <ClientPanel className="bg-[linear-gradient(135deg,rgba(235,240,244,0.94)_0%,rgba(226,232,240,0.92)_100%)] p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-[#5a6d7c]">{t('checkout.deposit')}</p>
          <p className="mt-2 text-xl font-semibold text-[#1f2933]">{t('cart.deposit_preview')}</p>
        </ClientPanel>
      </div>

      {hasItems ? (
        <div className="sticky bottom-24 z-20">
          <ClientPanel className="border-none bg-[linear-gradient(135deg,#21404d_0%,#3d6c77_100%)] p-4 text-white shadow-[0_24px_48px_rgba(33,64,77,0.28)]">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 sm:max-w-[22rem]">
                <p className="text-xs uppercase tracking-[0.2em] text-white/55">{t('cart.ready_title')}</p>
                <p className="mt-1 text-sm leading-6 text-white/80">{t('cart.ready_description')}</p>
                <p className="mt-2 text-base font-semibold">{formatAmount(productSubtotal, language)}</p>
              </div>
              <NavLink
                to="/app/checkout"
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-[#21404d] shadow-lg transition hover:bg-[#fff5ea] hover:shadow-xl sm:w-auto sm:shrink-0"
              >
                {t('cart.continue_checkout')}
                <ArrowRight size={16} />
              </NavLink>
            </div>
          </ClientPanel>
        </div>
      ) : null}
    </ClientPage>
  );
};
