import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, CheckCircle2, Loader2, MapPin, Package } from 'lucide-react';
import { clientApiRequest } from '../api/clientApi';
import { useClientApp } from '../bootstrap/ClientAppContext';
import { useClientCart } from '../bootstrap/ClientCartContext';
import { useClientLanguage } from '../bootstrap/ClientLanguageContext';
import { ClientCreateOrderResponse, ClientOrderPreviewResponse, ClientProfile } from '../types';
import { formatAmount, formatDateTime, formatOrderRef, getOrderStatusClasses, getOrderStatusLabel, getPaymentMethodLabel, parseNumericInput } from '../utils';

export const ClientCheckoutPreviewPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, sessionToken, refreshBootstrap, client } = useClientApp();
  const { items, orderDraft, clearCart } = useClientCart();
  const { language, t } = useClientLanguage();
  const [preview, setPreview] = React.useState<ClientOrderPreviewResponse | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const canRequestPreview = items.length > 0 && orderDraft.location_text.trim().length > 0;

  const buildPayload = React.useCallback((includeClient: boolean) => {
    const payload: {
      client?: Pick<ClientProfile, 'full_name' | 'phone' | 'address' | 'preferred_language'>;
      order: {
        payment_method: typeof orderDraft.payment_method;
        location_text: string;
        location_lat: number | null;
        location_lng: number | null;
        delivery_time_requested: string | null;
      };
      items: Array<{ product_id: string; quantity: number }>;
    } = {
      order: {
        payment_method: orderDraft.payment_method,
        location_text: orderDraft.location_text,
        location_lat: parseNumericInput(orderDraft.location_lat),
        location_lng: parseNumericInput(orderDraft.location_lng),
        delivery_time_requested: orderDraft.delivery_time_requested ? new Date(orderDraft.delivery_time_requested).toISOString() : null,
      },
      items: items.map((item) => ({ product_id: item.product_id, quantity: item.quantity })),
    };

    if (includeClient && client) {
      payload.client = {
        full_name: client.full_name,
        phone: client.phone,
        address: orderDraft.location_text || client.address,
        preferred_language: language,
      };
    }

    return payload;
  }, [client, items, language, orderDraft]);

  const loadPreview = React.useCallback(async () => {
    if (!sessionToken || !canRequestPreview) return;
    try {
      setLoading(true);
      setError(null);
      const response = await clientApiRequest<ClientOrderPreviewResponse>(
        '/orders/preview/',
        { method: 'POST', body: JSON.stringify(buildPayload(false)) },
        sessionToken
      );
      setPreview(response);
    } catch (e) {
      setPreview(null);
      setError(e instanceof Error ? e.message : t('checkout.error_preview'));
    } finally {
      setLoading(false);
    }
  }, [buildPayload, canRequestPreview, sessionToken, t]);

  React.useEffect(() => { void loadPreview(); }, [loadPreview]);

  const handleCreateOrder = async () => {
    if (!sessionToken || !canRequestPreview) return;
    try {
      setSubmitting(true);
      setError(null);
      const response = await clientApiRequest<ClientCreateOrderResponse>(
        '/orders/',
        { method: 'POST', body: JSON.stringify(buildPayload(true)) },
        sessionToken
      );
      clearCart();
      await refreshBootstrap();
      navigate(`/app/orders/${response.order.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('checkout.error_create'));
    } finally {
      setSubmitting(false);
    }
  };

  const goBack = () => navigate('/app/cart', { state: { from: location.pathname } });

  if (!isAuthenticated) {
    return (
      <div className="py-10 text-center">
        <p className="text-sm text-slate-500">{t('checkout.unauth_description')}</p>
      </div>
    );
  }

  if (!items.length) {
    return (
      <div className="py-10 text-center">
        <p className="text-sm text-slate-500">{t('checkout.empty_description')}</p>
        <button type="button" onClick={() => navigate('/app/products')} className="mt-4 text-sm font-medium text-blue-600">
          {t('nav.products')}
        </button>
      </div>
    );
  }

  if (!orderDraft.location_text.trim()) {
    return (
      <div className="py-10 text-center">
        <p className="text-sm text-slate-500">{t('checkout.address_required_description')}</p>
        <button type="button" onClick={goBack} className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white">
          <ArrowLeft size={14} />
          {t('checkout.back_to_cart')}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={goBack}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50"
        >
          <ArrowLeft size={16} />
        </button>
        <h1 className="text-xl font-bold text-slate-950">{t('checkout.title')}</h1>
      </div>

      {/* Error */}
      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      ) : null}

      {/* Loading preview */}
      {loading ? (
        <div className="flex items-center justify-center py-8 text-slate-400">
          <Loader2 size={24} className="animate-spin" />
        </div>
      ) : null}

      {/* Blocked by active order */}
      {preview?.blocked_by_active_order && preview.active_order ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
              <AlertTriangle size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-amber-900">{t('checkout.blocked_title')}</p>
              <p className="mt-1 text-sm text-amber-700">{t('checkout.blocked_description')}</p>
              <div className="mt-3 rounded-xl border border-amber-200 bg-white p-3">
                <p className="text-sm font-semibold text-slate-950">{formatOrderRef(preview.active_order.id)}</p>
                <p className="mt-0.5 text-sm text-slate-500">{preview.active_order.location_text || t('checkout.delivery_pending')}</p>
                <div className={`mt-2 inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${getOrderStatusClasses(preview.active_order.status)}`}>
                  {getOrderStatusLabel(preview.active_order.status, language)}
                </div>
              </div>
              <button
                type="button"
                onClick={() => navigate(`/app/orders/${preview.active_order!.id}`)}
                className="mt-3 inline-flex items-center gap-2 rounded-xl bg-amber-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-amber-700"
              >
                <Package size={14} />
                {t('checkout.open_orders')}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Order preview */}
      {preview?.preview ? (
        <>
          {/* Totals */}
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="px-4 py-3 border-b border-slate-100">
              <p className="text-sm font-semibold text-slate-950">{t('checkout.delivery_payment')}</p>
            </div>
            <div className="divide-y divide-slate-100">
              <div className="flex items-center justify-between px-4 py-3 text-sm">
                <span className="text-slate-500">{t('checkout.product_subtotal')}</span>
                <span className="font-semibold text-slate-950">{formatAmount(preview.preview.product_subtotal_uzs, language)}</span>
              </div>
              <div className="flex items-center justify-between px-4 py-3 text-sm">
                <span className="text-slate-500">{t('checkout.deposit')}</span>
                <span className="font-semibold text-slate-950">{formatAmount(preview.preview.bottle_deposit_total_uzs, language)}</span>
              </div>
              <div className="flex items-center justify-between bg-slate-950 px-4 py-3">
                <span className="text-sm font-semibold text-white/70">{t('checkout.total_payable')}</span>
                <span className="text-lg font-bold text-white">{formatAmount(preview.preview.total_amount_uzs, language)}</span>
              </div>
            </div>
          </div>

          {/* Items */}
          <div className="space-y-2">
            {preview.preview.items.map((item) => (
              <div key={`${item.product_id}-${item.product_name}`} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-slate-950">{item.product_name}</p>
                  <p className="mt-0.5 text-sm text-slate-500">{item.product_size_liters || '-'}L · ×{item.quantity}</p>
                  {item.requires_returnable_bottle ? (
                    <p className="mt-1 text-xs text-blue-600">
                      {t('checkout.deposit_charge_qty', { count: item.bottle_deposit_charge_quantity || 0 })} {t('checkout.covered_bottles', { count: item.already_covered_bottle_count || 0 })}
                    </p>
                  ) : null}
                </div>
                <div className="text-right">
                  <p className="font-bold text-slate-950">{formatAmount(item.line_total_uzs, language)}</p>
                  {(item.bottle_deposit_total_uzs || 0) > 0 ? (
                    <p className="text-xs text-slate-400">+{formatAmount(item.bottle_deposit_total_uzs || 0, language)}</p>
                  ) : null}
                </div>
              </div>
            ))}
          </div>

          {/* Delivery info */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                <MapPin size={16} />
              </div>
              <div className="min-w-0 flex-1 text-sm">
                <p className="font-semibold text-slate-950">{orderDraft.location_text}</p>
                <p className="mt-1 text-slate-500">{getPaymentMethodLabel(orderDraft.payment_method, language)}</p>
                {orderDraft.delivery_time_requested ? (
                  <p className="text-slate-500">{formatDateTime(new Date(orderDraft.delivery_time_requested).toISOString(), language)}</p>
                ) : null}
              </div>
            </div>
          </div>

          {/* Place order CTA */}
          <button
            type="button"
            onClick={() => void handleCreateOrder()}
            disabled={submitting}
            className="flex w-full items-center justify-center gap-3 rounded-3xl bg-blue-600 py-4 text-base font-bold text-white shadow-[0_8px_28px_rgba(37,99,235,0.35)] transition hover:bg-blue-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <CheckCircle2 size={18} />
            )}
            {submitting ? t('checkout.submitting') : t('checkout.confirm')}
          </button>
        </>
      ) : null}
    </div>
  );
};
