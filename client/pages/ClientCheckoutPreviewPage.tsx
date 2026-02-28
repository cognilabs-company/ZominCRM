import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, CheckCircle2, ReceiptText } from 'lucide-react';
import { clientApiRequest } from '../api/clientApi';
import { useClientApp } from '../bootstrap/ClientAppContext';
import { useClientCart } from '../bootstrap/ClientCartContext';
import { ClientPage } from '../components/ClientPage';
import { ClientPanel } from '../components/ClientPanel';
import { ClientCreateOrderResponse, ClientOrderPreviewResponse } from '../types';
import { formatAmount, formatDateTime, formatOrderRef, getOrderStatusClasses, getOrderStatusLabel, parseNumericInput } from '../utils';

const buildPayload = (items: ReturnType<typeof useClientCart>['items'], orderDraft: ReturnType<typeof useClientCart>['orderDraft']) => ({
  order: {
    payment_method: orderDraft.payment_method,
    location_text: orderDraft.location_text,
    location_lat: parseNumericInput(orderDraft.location_lat),
    location_lng: parseNumericInput(orderDraft.location_lng),
    delivery_time_requested: orderDraft.delivery_time_requested ? new Date(orderDraft.delivery_time_requested).toISOString() : null,
  },
  items: items.map((item) => ({
    product_id: item.product_id,
    quantity: item.quantity,
  })),
});

export const ClientCheckoutPreviewPage: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated, sessionToken, refreshBootstrap } = useClientApp();
  const { items, orderDraft, clearCart } = useClientCart();
  const [preview, setPreview] = React.useState<ClientOrderPreviewResponse | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const canRequestPreview = items.length > 0 && orderDraft.location_text.trim().length > 0;

  const loadPreview = React.useCallback(async () => {
    if (!sessionToken || !canRequestPreview) return;
    try {
      setLoading(true);
      setError(null);
      const response = await clientApiRequest<ClientOrderPreviewResponse>(
        '/orders/preview/',
        {
          method: 'POST',
          body: JSON.stringify(buildPayload(items, orderDraft)),
        },
        sessionToken
      );
      setPreview(response);
    } catch (loadError) {
      setPreview(null);
      setError(loadError instanceof Error ? loadError.message : 'Failed to preview order.');
    } finally {
      setLoading(false);
    }
  }, [canRequestPreview, items, orderDraft, sessionToken]);

  React.useEffect(() => {
    void loadPreview();
  }, [loadPreview]);

  const handleCreateOrder = async () => {
    if (!sessionToken || !canRequestPreview) return;
    try {
      setSubmitting(true);
      setError(null);
      await clientApiRequest<ClientCreateOrderResponse>(
        '/orders/',
        {
          method: 'POST',
          body: JSON.stringify(buildPayload(items, orderDraft)),
        },
        sessionToken
      );
      clearCart();
      await refreshBootstrap();
      navigate('/app/orders');
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Failed to create order.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <ClientPage title="Checkout Preview" subtitle="Open the Telegram WebApp to preview and submit orders.">
        <ClientPanel className="p-5 text-sm text-slate-500">Client preview requires a verified Telegram session.</ClientPanel>
      </ClientPage>
    );
  }

  if (!items.length) {
    return (
      <ClientPage title="Checkout Preview" subtitle="There is nothing to preview yet.">
        <ClientPanel className="p-5 text-sm text-slate-500">Add products to the cart first, then return here for exact deposit-aware pricing.</ClientPanel>
      </ClientPage>
    );
  }

  if (!orderDraft.location_text.trim()) {
    return (
      <ClientPage title="Checkout Preview" subtitle="Delivery details are required before preview.">
        <ClientPanel className="p-5">
          <p className="text-sm leading-6 text-slate-500">Add a delivery address in the cart page before requesting preview.</p>
          <NavLink to="/app/cart" className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800">
            <ArrowLeft size={15} />
            Back to cart
          </NavLink>
        </ClientPanel>
      </ClientPage>
    );
  }

  return (
    <ClientPage
      title="Checkout Preview"
      subtitle="Preview exact product subtotal, bottle deposit, and total payable before creating the order."
      action={
        <NavLink
          to="/app/cart"
          className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
        >
          <ArrowLeft size={15} />
          Back to cart
        </NavLink>
      }
    >
      {error ? (
        <ClientPanel className="border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</ClientPanel>
      ) : null}

      {loading ? (
        <ClientPanel className="p-5 text-sm text-slate-500">Calculating preview...</ClientPanel>
      ) : null}

      {preview?.blocked_by_active_order && preview.active_order ? (
        <ClientPanel className="p-5">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
              <AlertTriangle size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-semibold text-slate-950">New order is blocked</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">You already have an active order. Open it first before creating a new one.</p>
              <div className="mt-4 rounded-2xl bg-slate-100 p-4">
                <p className="text-sm font-semibold text-slate-950">{formatOrderRef(preview.active_order.id)}</p>
                <p className="mt-1 text-sm text-slate-500">{preview.active_order.location_text || 'Delivery address pending'}</p>
                <div className={`mt-3 inline-flex rounded-full px-3 py-1 text-xs font-medium ${getOrderStatusClasses(preview.active_order.status)}`}>
                  {getOrderStatusLabel(preview.active_order.status)}
                </div>
              </div>
              <NavLink to="/app/orders" className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800">
                Open orders
              </NavLink>
            </div>
          </div>
        </ClientPanel>
      ) : null}

      {preview?.preview ? (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <ClientPanel className="p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Product subtotal</p>
              <p className="mt-2 text-xl font-semibold text-slate-950">{formatAmount(preview.preview.product_subtotal_uzs)}</p>
            </ClientPanel>
            <ClientPanel className="p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Bottle deposit</p>
              <p className="mt-2 text-xl font-semibold text-slate-950">{formatAmount(preview.preview.bottle_deposit_total_uzs)}</p>
            </ClientPanel>
            <ClientPanel className="p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Total payable</p>
              <p className="mt-2 text-xl font-semibold text-slate-950">{formatAmount(preview.preview.total_amount_uzs)}</p>
            </ClientPanel>
          </div>

          {preview.bottle_summary ? (
            <ClientPanel className="p-5">
              <h2 className="text-base font-semibold text-slate-950">Bottle coverage summary</h2>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-slate-100 px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Outstanding bottles</p>
                  <p className="mt-2 text-xl font-semibold text-slate-950">{preview.bottle_summary.total_outstanding_bottles_count}</p>
                </div>
                <div className="rounded-2xl bg-slate-100 px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Deposit held</p>
                  <p className="mt-2 text-xl font-semibold text-slate-950">{formatAmount(preview.bottle_summary.deposit_held_total_uzs)}</p>
                </div>
              </div>
            </ClientPanel>
          ) : null}

          <div className="grid gap-3">
            {preview.preview.items.map((item) => (
              <ClientPanel key={`${item.product_id}-${item.product_name}`} className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-sm font-semibold text-slate-950">{item.product_name}</h2>
                    <p className="mt-1 text-sm text-slate-500">{item.product_size_liters || '-'}L · Qty {item.quantity}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-slate-950">{formatAmount(item.line_total_uzs)}</p>
                    <p className="mt-1 text-xs text-slate-400">Deposit {formatAmount(item.bottle_deposit_total_uzs || 0)}</p>
                  </div>
                </div>
                {item.requires_returnable_bottle ? (
                  <div className="mt-4 rounded-2xl bg-slate-100 px-4 py-3 text-sm text-slate-600">
                    Covered bottles: {item.already_covered_bottle_count || 0} · Deposit charge qty: {item.bottle_deposit_charge_quantity || 0}
                  </div>
                ) : null}
              </ClientPanel>
            ))}
          </div>

          <ClientPanel className="p-5">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                <ReceiptText size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-base font-semibold text-slate-950">Delivery and payment</h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">{orderDraft.location_text}</p>
                <p className="mt-2 text-sm text-slate-500">Payment method: {orderDraft.payment_method}</p>
                <p className="mt-1 text-sm text-slate-500">Requested delivery: {formatDateTime(orderDraft.delivery_time_requested ? new Date(orderDraft.delivery_time_requested).toISOString() : null)}</p>
              </div>
            </div>

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={handleCreateOrder}
                disabled={submitting}
                className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                <CheckCircle2 size={18} />
                {submitting ? 'Creating order...' : 'Create order'}
              </button>
            </div>
          </ClientPanel>
        </>
      ) : null}
    </ClientPage>
  );
};
