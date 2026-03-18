import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, Banknote, CreditCard, Minus, Plus, ShoppingBag, Trash2 } from 'lucide-react';
import { useClientApp } from '../bootstrap/ClientAppContext';
import { useClientCart } from '../bootstrap/ClientCartContext';
import { useClientLanguage } from '../bootstrap/ClientLanguageContext';
import { ClientLocationPicker } from '../components/ClientLocationPicker';
import { formatAmount } from '../utils';

export const ClientCartPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { client } = useClientApp();
  const { items, itemsCount, orderDraft, productSubtotal, updateQuantity, removeProduct, setOrderDraft } = useClientCart();
  const { language, t } = useClientLanguage();
  const hasItems = itemsCount > 0;

  const savedAddress = client?.address?.trim() || '';
  const currentAddress = orderDraft.location_text.trim();
  const hasSavedAddress = savedAddress.length > 0;
  const hasCustomAddress = Boolean(currentAddress) && currentAddress !== savedAddress;
  const [editingAddress, setEditingAddress] = React.useState(() => !hasSavedAddress || hasCustomAddress);

  React.useEffect(() => {
    if (!hasSavedAddress) {
      setEditingAddress(true);
      return;
    }
    if (!currentAddress) {
      setOrderDraft({ location_text: savedAddress, location_lat: '', location_lng: '' });
      setEditingAddress(false);
    }
  }, [currentAddress, hasSavedAddress, savedAddress, setOrderDraft]);

  const handleUseSavedAddress = React.useCallback(() => {
    setOrderDraft({ location_text: savedAddress, location_lat: '', location_lng: '' });
    setEditingAddress(false);
  }, [savedAddress, setOrderDraft]);

  const handleApplyLocation = React.useCallback(
    (payload: { location_text: string; location_lat: string; location_lng: string }) => {
      setOrderDraft(payload);
      setEditingAddress(false);
    },
    [setOrderDraft]
  );

  const goToCheckout = React.useCallback(() => {
    if (!hasItems) return;
    navigate('/app/checkout', { state: { from: location.pathname } });
  }, [hasItems, location.pathname, navigate]);

  if (!hasItems) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <ShoppingBag size={52} className="mb-4 text-slate-300" />
        <p className="text-base font-semibold text-slate-700">{t('cart.empty')}</p>
        <p className="mt-1 text-sm text-slate-500">{t('products.subtitle') || 'Add products to get started'}</p>
        <button
          type="button"
          onClick={() => navigate('/app/products')}
          className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow transition hover:bg-slate-800"
        >
          {t('nav.products')}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Page title */}
      <h1 className="text-xl font-bold text-slate-950">{t('cart.title')}</h1>

      {/* Cart items */}
      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.product_id} className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-slate-950">{item.name}</p>
                <p className="mt-0.5 text-sm text-slate-500">{item.size_liters}L · {formatAmount(item.unit_price_uzs, language)}</p>
              </div>
              <button
                type="button"
                onClick={() => removeProduct(item.product_id)}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-slate-400 transition hover:bg-rose-50 hover:text-rose-500"
                aria-label={t('cart.remove')}
              >
                <Trash2 size={15} />
              </button>
            </div>
            <div className="mt-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 rounded-2xl bg-slate-100 px-1.5 py-1.5">
                <button
                  type="button"
                  onClick={() => updateQuantity(item.product_id, item.quantity - 1)}
                  className="flex h-7 w-7 items-center justify-center rounded-xl bg-white text-slate-700 shadow-sm transition hover:bg-slate-50 active:scale-95"
                  aria-label="Decrease"
                >
                  <Minus size={13} />
                </button>
                <span className="min-w-7 text-center text-sm font-bold text-slate-950">{item.quantity}</span>
                <button
                  type="button"
                  onClick={() => updateQuantity(item.product_id, item.quantity + 1)}
                  className="flex h-7 w-7 items-center justify-center rounded-xl bg-white text-slate-700 shadow-sm transition hover:bg-slate-50 active:scale-95"
                  aria-label="Increase"
                >
                  <Plus size={13} />
                </button>
              </div>
              <p className="text-sm font-bold text-slate-950">{formatAmount(item.unit_price_uzs * item.quantity, language)}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Delivery address */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <p className="mb-3 text-sm font-semibold text-slate-950">{t('cart.delivery_address')}</p>

        {hasSavedAddress && !editingAddress ? (
          <div>
            <div className="rounded-xl bg-slate-50 px-3 py-3">
              <p className="text-sm text-slate-950">{savedAddress}</p>
            </div>
            <button
              type="button"
              onClick={() => setEditingAddress(true)}
              className="mt-2 text-xs font-medium text-blue-600 transition hover:text-blue-700"
            >
              {t('cart.map_open') || 'Change address'}
            </button>
          </div>
        ) : (
          <>
            {hasSavedAddress ? (
              <button
                type="button"
                onClick={handleUseSavedAddress}
                className="mb-3 text-xs font-medium text-blue-600 transition hover:text-blue-700"
              >
                ← {t('cart.map_close') || 'Use saved address'}
              </button>
            ) : null}
            <ClientLocationPicker
              address={orderDraft.location_text}
              latitude={orderDraft.location_lat}
              longitude={orderDraft.location_lng}
              onApply={handleApplyLocation}
            />
          </>
        )}
      </div>

      {/* Payment method */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <p className="mb-3 text-sm font-semibold text-slate-950">{t('cart.payment_method')}</p>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setOrderDraft({ payment_method: 'CASH' })}
            className={`flex items-center justify-center gap-2 rounded-xl border py-3 text-sm font-semibold transition active:scale-[0.98] ${
              orderDraft.payment_method === 'CASH'
                ? 'border-slate-950 bg-slate-950 text-white shadow-[0_4px_14px_rgba(15,23,42,0.18)]'
                : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-white'
            }`}
          >
            <Banknote size={16} />
            {t('payment.cash') || 'Cash'}
          </button>
          <button
            type="button"
            onClick={() => setOrderDraft({ payment_method: 'TRANSFER' })}
            className={`flex items-center justify-center gap-2 rounded-xl border py-3 text-sm font-semibold transition active:scale-[0.98] ${
              orderDraft.payment_method === 'TRANSFER'
                ? 'border-slate-950 bg-slate-950 text-white shadow-[0_4px_14px_rgba(15,23,42,0.18)]'
                : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-white'
            }`}
          >
            <CreditCard size={16} />
            {t('payment.transfer') || 'Transfer'}
          </button>
        </div>
      </div>

      {/* Delivery time */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <label className="mb-2 block text-sm font-semibold text-slate-950">{t('cart.delivery_time')}</label>
        <input
          type="datetime-local"
          value={orderDraft.delivery_time_requested}
          onChange={(e) => setOrderDraft({ delivery_time_requested: e.target.value })}
          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
        />
      </div>

      {/* Order summary */}
      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-500">{t('checkout.product_subtotal')}</span>
          <span className="font-bold text-slate-950">{formatAmount(productSubtotal, language)}</span>
        </div>
        <div className="mt-2 flex items-center justify-between text-sm">
          <span className="text-slate-500">{t('checkout.deposit')}</span>
          <span className="text-slate-500">{t('cart.deposit_preview')}</span>
        </div>
      </div>

      {/* Checkout CTA */}
      <button
        type="button"
        onClick={goToCheckout}
        disabled={!hasItems}
        className="flex w-full items-center justify-between gap-4 rounded-3xl bg-slate-950 px-5 py-4 text-white shadow-[0_8px_32px_rgba(15,23,42,0.22)] transition hover:bg-slate-800 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
      >
        <div className="text-left">
          <p className="text-xs font-medium text-white/60">{itemsCount} {t('cart.items')}</p>
          <p className="text-base font-bold">{formatAmount(productSubtotal, language)}</p>
        </div>
        <div className="flex items-center gap-2 rounded-2xl bg-white px-4 py-2.5">
          <span className="text-sm font-bold text-slate-950">{t('cart.continue_checkout')}</span>
          <ArrowRight size={15} className="text-slate-950" />
        </div>
      </button>
    </div>
  );
};
