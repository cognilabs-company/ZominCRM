import React from 'react';
import { CircleDot, RefreshCw } from 'lucide-react';
import { clientApiRequest } from '../api/clientApi';
import { useClientApp } from '../bootstrap/ClientAppContext';
import { useClientLanguage } from '../bootstrap/ClientLanguageContext';
import { ClientPage } from '../components/ClientPage';
import { ClientPanel } from '../components/ClientPanel';
import { ClientOrder, ClientOrderDetailResponse, ClientOrdersListResponse } from '../types';
import { formatAmount, formatDateTime, formatOrderRef, getOrderStatusClasses, getOrderStatusLabel, getPaymentMethodLabel } from '../utils';

export const ClientOrdersPage: React.FC = () => {
  const { sessionToken, isAuthenticated, activeOrder, openInTelegramUrl } = useClientApp();
  const { language, t } = useClientLanguage();
  const [orders, setOrders] = React.useState<ClientOrder[]>([]);
  const [selectedOrder, setSelectedOrder] = React.useState<ClientOrder | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [detailLoading, setDetailLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const loadOrders = React.useCallback(async () => {
    if (!sessionToken) return;
    try {
      setLoading(true);
      setError(null);
      const response = await clientApiRequest<ClientOrdersListResponse>('/orders/', undefined, sessionToken);
      const rows = response.results || [];
      setOrders(rows);
      setSelectedOrder((current) => current || (activeOrder ? rows.find((row) => row.id === activeOrder.id) || rows[0] : rows[0] || null));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : t('orders.error_load'));
    } finally {
      setLoading(false);
    }
  }, [activeOrder, sessionToken, t]);

  React.useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  React.useEffect(() => {
    if (!sessionToken || !selectedOrder?.id) return;
    let active = true;
    const loadOrderDetail = async () => {
      try {
        setDetailLoading(true);
        const response = await clientApiRequest<ClientOrderDetailResponse | ClientOrder>(`/orders/${selectedOrder.id}/`, undefined, sessionToken);
        const order = (response as ClientOrderDetailResponse).order || (response as ClientOrder);
        if (!active || !order?.id) return;
        setSelectedOrder(order);
      } catch {
      } finally {
        if (active) setDetailLoading(false);
      }
    };

    void loadOrderDetail();
    return () => {
      active = false;
    };
  }, [selectedOrder?.id, sessionToken]);

  if (!isAuthenticated) {
    return (
      <ClientPage title={t('orders.title')} subtitle={t('orders.unauth_subtitle')}>
        <ClientPanel className="p-5 text-sm text-slate-500">
          <p>{t('orders.unauth_description')}</p>
          {openInTelegramUrl ? (
            <a href={openInTelegramUrl} className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800">
              {t('home.open_in_telegram_cta')}
            </a>
          ) : null}
        </ClientPanel>
      </ClientPage>
    );
  }

  return (
    <ClientPage
      title={t('orders.title')}
      subtitle={t('orders.subtitle')}
      action={
        <button
          type="button"
          onClick={() => void loadOrders()}
          className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
        >
          <RefreshCw size={15} />
          {t('orders.refresh')}
        </button>
      }
    >
      {error ? (
        <ClientPanel className="border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</ClientPanel>
      ) : null}

      {loading ? (
        <ClientPanel className="p-5 text-sm text-slate-500">{t('orders.loading')}</ClientPanel>
      ) : null}

      {!loading && orders.length === 0 ? (
        <ClientPanel className="p-5 text-sm text-slate-500">{t('orders.empty')}</ClientPanel>
      ) : null}

      {orders.length > 0 ? (
        <div className="space-y-3">
          {orders.map((order) => {
            const isSelected = selectedOrder?.id === order.id;
            return (
              <button
                key={order.id}
                type="button"
                onClick={() => setSelectedOrder(order)}
                className={`w-full rounded-[28px] border p-4 text-left transition ${isSelected ? 'border-slate-950 bg-slate-950 text-white shadow-[0_16px_34px_rgba(15,23,42,0.18)]' : 'border-slate-200 bg-white text-slate-950 hover:-translate-y-0.5 hover:shadow-[0_16px_34px_rgba(15,23,42,0.08)]'}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className={`text-sm font-semibold ${isSelected ? 'text-white' : 'text-slate-950'}`}>{formatOrderRef(order.id)}</p>
                    <p className={`mt-1 text-sm ${isSelected ? 'text-white/70' : 'text-slate-500'}`}>{order.location_text || t('orders.delivery_pending')}</p>
                  </div>
                  <div className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${isSelected ? 'bg-white/10 text-white' : getOrderStatusClasses(order.status)}`}>
                    {getOrderStatusLabel(order.status, language)}
                  </div>
                </div>
                <div className={`mt-3 flex items-center justify-between text-sm ${isSelected ? 'text-white/80' : 'text-slate-500'}`}>
                  <span>{formatDateTime(order.created_at, language)}</span>
                  <span className={`font-semibold ${isSelected ? 'text-white' : 'text-slate-950'}`}>{formatAmount(order.total_amount_uzs, language)}</span>
                </div>
              </button>
            );
          })}
        </div>
      ) : null}

      {selectedOrder ? (
        <ClientPanel className="p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{t('orders.selected_order')}</p>
              <h2 className="mt-2 text-lg font-semibold text-slate-950">{formatOrderRef(selectedOrder.id)}</h2>
              <p className="mt-2 text-sm text-slate-500">{selectedOrder.location_text || t('orders.delivery_pending')}</p>
            </div>
            <div className="text-right">
              <div className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${getOrderStatusClasses(selectedOrder.status)}`}>
                {getOrderStatusLabel(selectedOrder.status, language)}
              </div>
              <p className="mt-3 text-lg font-semibold text-slate-950">{formatAmount(selectedOrder.total_amount_uzs, language)}</p>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-2xl bg-slate-100 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{t('orders.product_subtotal')}</p>
              <p className="mt-2 text-base font-semibold text-slate-950">{formatAmount(selectedOrder.product_subtotal_uzs || 0, language)}</p>
            </div>
            <div className="rounded-2xl bg-slate-100 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{t('orders.deposit')}</p>
              <p className="mt-2 text-base font-semibold text-slate-950">{formatAmount(selectedOrder.bottle_deposit_total_uzs || 0, language)}</p>
            </div>
            <div className="rounded-2xl bg-slate-100 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{t('orders.payment_method')}</p>
              <p className="mt-2 text-base font-semibold text-slate-950">{getPaymentMethodLabel(selectedOrder.payment_method, language)}</p>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {(selectedOrder.items || []).map((item) => (
              <div key={`${selectedOrder.id}-${item.product_id}-${item.product_name}`} className="rounded-2xl border border-slate-200 px-4 py-3">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-slate-950">{item.product_name}</p>
                    <p className="mt-1 text-sm text-slate-500">{item.product_size_liters || '-'}L · {t('orders.qty', { count: item.quantity })}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-slate-950">{formatAmount(item.line_total_uzs, language)}</p>
                    <p className="mt-1 text-xs text-slate-400">{t('orders.deposit_item', { amount: formatAmount(item.bottle_deposit_total_uzs || 0, language) })}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5 flex items-center gap-2 text-sm text-slate-500">
            <CircleDot size={14} className="text-slate-300" />
            {detailLoading ? t('orders.refreshing_details') : t('orders.last_updated', { value: formatDateTime(selectedOrder.updated_at, language) })}
          </div>
        </ClientPanel>
      ) : null}
    </ClientPage>
  );
};
