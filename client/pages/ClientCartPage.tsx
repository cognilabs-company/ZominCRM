import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Minus, Plus } from 'lucide-react';
import { useClientApp } from '../bootstrap/ClientAppContext';
import { useClientCart } from '../bootstrap/ClientCartContext';
import { useClientLanguage } from '../bootstrap/ClientLanguageContext';
import { ClientLocationPicker } from '../components/ClientLocationPicker';
import { ClientPage } from '../components/ClientPage';
import { ClientPanel } from '../components/ClientPanel';
import { formatAmount, getPaymentMethodLabel } from '../utils';

export const ClientCartPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { client } = useClientApp();
  const { items, itemsCount, orderDraft, productSubtotal, updateQuantity, removeProduct, setOrderDraft } = useClientCart();
  const { language, t } = useClientLanguage();
  const hasItems = itemsCount > 0;
  const copy = React.useMemo(() => {
    if (language === 'ru') {
      return {
        savedAddress: 'Сохраненный адрес',
        savedAddressDescription: 'Используйте этот адрес или выберите новый.',
        savedAddressUse: 'Использовать',
        savedAddressChange: 'Новый адрес',
        savedAddressActive: 'Этот адрес будет использован для заказа.',
        useSavedAddress: 'Вернуть сохраненный',
        customAddressTitle: 'Новый адрес',
        customAddressDescription: 'Выберите точку на карте.',
      };
    }

    if (language === 'en') {
      return {
        savedAddress: 'Saved address',
        savedAddressDescription: 'Use this address or choose a new one.',
        savedAddressUse: 'Use address',
        savedAddressChange: 'New address',
        savedAddressActive: 'This address will be used for the order.',
        useSavedAddress: 'Use saved',
        customAddressTitle: 'New address',
        customAddressDescription: 'Pick a point on the map.',
      };
    }

    return {
      savedAddress: 'Saqlangan manzil',
      savedAddressDescription: 'Shu manzilni ishlating yoki yangisini tanlang.',
      savedAddressUse: 'Ishlatish',
      savedAddressChange: 'Yangi manzil',
      savedAddressActive: 'Buyurtma shu manzilga yuboriladi.',
      useSavedAddress: 'Saqlanganga qaytish',
      customAddressTitle: 'Yangi manzil',
      customAddressDescription: 'Xaritadan nuqtani tanlang.',
    };
  }, [language]);
  const savedAddress = client?.address?.trim() || '';
  const currentAddress = orderDraft.location_text.trim();
  const hasSavedAddress = savedAddress.length > 0;
  const hasCustomAddress = Boolean(currentAddress) && currentAddress !== savedAddress;
  const [editingAddress, setEditingAddress] = React.useState(() => !hasSavedAddress || hasCustomAddress);
  const [mapExpanded, setMapExpanded] = React.useState(false);

  React.useEffect(() => {
    if (!hasSavedAddress) {
      setEditingAddress(true);
      return;
    }

    if (!currentAddress) {
      setOrderDraft({
        location_text: savedAddress,
        location_lat: '',
        location_lng: '',
      });
      setEditingAddress(false);
      return;
    }

    if (currentAddress === savedAddress && hasCustomAddress === false) {
      setEditingAddress((prev) => prev && hasCustomAddress);
    }
  }, [currentAddress, hasCustomAddress, hasSavedAddress, savedAddress, setOrderDraft]);

  React.useEffect(() => {
    if (!editingAddress) {
      setMapExpanded(false);
    }
  }, [editingAddress]);

  const goToCheckout = React.useCallback(() => {
    if (!hasItems) return;
    navigate('/app/checkout', { state: { from: location.pathname } });
  }, [hasItems, location.pathname, navigate]);

  const handleUseSavedAddress = React.useCallback(() => {
    setOrderDraft({
      location_text: savedAddress,
      location_lat: '',
      location_lng: '',
    });
    setEditingAddress(false);
    setMapExpanded(false);
  }, [savedAddress, setOrderDraft]);

  const handleChangeAddress = React.useCallback(() => {
    setEditingAddress(true);
    setMapExpanded(true);
  }, []);

  const handleApplyLocation = React.useCallback((payload: { location_text: string; location_lat: string; location_lng: string }) => {
    setOrderDraft(payload);
  }, [setOrderDraft]);

  return (
    <ClientPage
      title={t('cart.title')}
      action={
        <button
          type="button"
          onClick={goToCheckout}
          className={`inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-medium transition ${
            hasItems
              ? 'bg-slate-950 text-white shadow-[0_12px_24px_rgba(15,23,42,0.18)] hover:bg-slate-800'
              : 'pointer-events-none cursor-not-allowed bg-slate-200 text-slate-400'
          }`}
          aria-disabled={!hasItems}
        >
          {t('cart.preview')}
          <ArrowRight size={15} />
        </button>
      }
    >
      <div className="grid grid-cols-3 gap-2">
        <ClientPanel className="p-3 text-center">
          <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400">1</p>
          <p className="mt-1 text-xs font-semibold text-slate-950">{t('nav.products')}</p>
        </ClientPanel>
        <ClientPanel className="border-slate-950 bg-slate-950 p-3 text-center">
          <p className="text-[11px] uppercase tracking-[0.16em] text-white/55">2</p>
          <p className="mt-1 text-xs font-semibold text-white">{t('nav.cart')}</p>
        </ClientPanel>
        <ClientPanel className="p-3 text-center opacity-70">
          <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400">3</p>
          <p className="mt-1 text-xs font-semibold text-slate-950">{t('nav.checkout')}</p>
        </ClientPanel>
      </div>

      {items.length === 0 ? (
        <ClientPanel className="p-5 text-sm text-slate-500">{t('cart.empty')}</ClientPanel>
      ) : (
        <div className="grid gap-3">
          {items.map((item) => (
            <ClientPanel key={item.product_id} className="overflow-hidden p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <h2 className="text-sm font-semibold text-slate-950">{item.name}</h2>
                  <p className="mt-1 text-sm text-slate-500">{item.size_liters}L / {item.sku}</p>
                  <p className="mt-2 text-sm text-slate-500">
                    {t('cart.unit_price')} {formatAmount(item.unit_price_uzs, language)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => removeProduct(item.product_id)}
                  className="rounded-2xl bg-rose-50 px-3 py-2 text-sm font-medium text-rose-600 transition hover:bg-rose-100 active:bg-rose-200"
                  title="Remove from cart"
                >
                  {t('cart.remove')}
                </button>
              </div>
              <div className="mt-4 flex items-center justify-between gap-3">
                <div className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-2 py-2 text-white shadow-[0_12px_24px_rgba(15,23,42,0.16)]">
                  <button
                    type="button"
                    onClick={() => updateQuantity(item.product_id, item.quantity - 1)}
                    className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/10 transition hover:bg-white/20 active:bg-white/25"
                    aria-label="Decrease quantity"
                  >
                    <Minus size={16} />
                  </button>
                  <span className="min-w-8 text-center text-sm font-semibold">{item.quantity}</span>
                  <button
                    type="button"
                    onClick={() => updateQuantity(item.product_id, item.quantity + 1)}
                    className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/10 transition hover:bg-white/20 active:bg-white/25"
                    aria-label="Increase quantity"
                  >
                    <Plus size={16} />
                  </button>
                </div>
                <div className="text-right">
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-400">{t('cart.line_total')}</p>
                  <p className="mt-1 text-sm font-semibold text-slate-950">{formatAmount(item.unit_price_uzs * item.quantity, language)}</p>
                </div>
              </div>
            </ClientPanel>
          ))}
        </div>
      )}

      <ClientPanel className="p-5">
        <div className="grid gap-4">
          {hasSavedAddress && !editingAddress ? (
            <div className="rounded-[20px] border border-slate-200 bg-slate-50 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{copy.savedAddress}</p>
              <p className="mt-3 text-base font-semibold text-slate-950">{savedAddress}</p>
              <p className="mt-2 text-sm text-slate-500">{copy.savedAddressDescription}</p>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={handleUseSavedAddress}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(15,23,42,0.16)] transition hover:bg-slate-800"
                >
                  <CheckCircle2 size={16} />
                  {copy.savedAddressUse}
                </button>
                <button
                  type="button"
                  onClick={handleChangeAddress}
                  className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  {copy.savedAddressChange}
                </button>
              </div>
              <p className="mt-3 text-xs text-slate-500">{copy.savedAddressActive}</p>
            </div>
          ) : null}

          {!hasSavedAddress ? (
            <div>
              <label className="block text-sm font-medium text-slate-700">{t('cart.delivery_address')}</label>
              <textarea
                value={orderDraft.location_text}
                onChange={(event) => setOrderDraft({ location_text: event.target.value })}
                className="mt-2 h-24 w-full rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400"
                placeholder={t('cart.delivery_address_placeholder')}
              />
            </div>
          ) : null}

          {hasSavedAddress && editingAddress ? (
            <div className="rounded-[20px] border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{copy.customAddressTitle}</p>
                  <p className="mt-2 text-sm text-slate-500">{copy.customAddressDescription}</p>
                  <p className="mt-2 text-sm font-medium text-slate-950">{currentAddress || savedAddress}</p>
                </div>
                <button
                  type="button"
                  onClick={handleUseSavedAddress}
                  className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  {copy.useSavedAddress}
                </button>
              </div>
            </div>
          ) : null}

          {(editingAddress || !hasSavedAddress) ? (
            <ClientLocationPicker
              address={orderDraft.location_text}
              latitude={orderDraft.location_lat}
              longitude={orderDraft.location_lng}
              onApply={handleApplyLocation}
              expanded={hasSavedAddress ? mapExpanded : undefined}
              onExpandedChange={hasSavedAddress ? setMapExpanded : undefined}
            />
          ) : null}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-700">{t('cart.payment_method')}</label>
              <select
                value={orderDraft.payment_method}
                onChange={(event) => setOrderDraft({ payment_method: event.target.value as 'CASH' | 'TRANSFER' })}
                className="mt-2 w-full rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400"
              >
                <option value="CASH">{getPaymentMethodLabel('CASH', language)}</option>
                <option value="TRANSFER">{getPaymentMethodLabel('TRANSFER', language)}</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">{t('cart.delivery_time')}</label>
              <input
                type="datetime-local"
                value={orderDraft.delivery_time_requested}
                onChange={(event) => setOrderDraft({ delivery_time_requested: event.target.value })}
                className="mt-2 w-full rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400"
              />
            </div>
            <div className="rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3 sm:col-span-2">
              <p className="text-sm font-medium text-slate-700">{t('cart.map_selected_title')}</p>
              <p className="mt-2 text-sm text-slate-500">{orderDraft.location_text || t('cart.map_selected_empty')}</p>
            </div>
          </div>
        </div>
      </ClientPanel>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <ClientPanel className="p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-400">{t('cart.items')}</p>
          <p className="mt-2 text-xl font-semibold text-slate-950">{itemsCount}</p>
        </ClientPanel>
        <ClientPanel className="p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-400">{t('checkout.product_subtotal')}</p>
          <p className="mt-2 text-xl font-semibold text-slate-950">{formatAmount(productSubtotal, language)}</p>
        </ClientPanel>
        <ClientPanel className="p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-400">{t('checkout.deposit')}</p>
          <p className="mt-2 text-xl font-semibold text-slate-950">{t('cart.deposit_preview')}</p>
        </ClientPanel>
      </div>

      {hasItems ? (
        <div className="sticky bottom-24 z-20">
          <ClientPanel className="border-slate-950 bg-slate-950 p-4 text-white shadow-[0_24px_48px_rgba(15,23,42,0.2)]">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 sm:max-w-[22rem]">
                <p className="text-xs uppercase tracking-[0.18em] text-white/55">{t('cart.ready_title')}</p>
                <p className="mt-1 text-sm text-white/80">{formatAmount(productSubtotal, language)}</p>
              </div>
              <button
                type="button"
                onClick={goToCheckout}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-950 shadow-lg transition hover:bg-slate-100 sm:w-auto sm:shrink-0"
              >
                {t('cart.continue_checkout')}
                <ArrowRight size={16} />
              </button>
            </div>
          </ClientPanel>
        </div>
      ) : null}
    </ClientPage>
  );
};
