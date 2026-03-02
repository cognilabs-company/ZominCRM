import React from 'react';
import { ArrowRight, CircleDot, RefreshCw } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { clientApiRequest } from '../api/clientApi';
import { useClientApp } from '../bootstrap/ClientAppContext';
import { useClientLanguage } from '../bootstrap/ClientLanguageContext';
import { ClientEmptyState } from '../components/ClientEmptyState';
import { ClientErrorPanel } from '../components/ClientErrorPanel';
import { ClientPage } from '../components/ClientPage';
import { ClientPanel } from '../components/ClientPanel';
import { SkeletonOrderList } from '../components/ClientSkeleton';
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
        <ClientPanel className="p-5 text-sm text-[#5b6770]">
          <p>{t('orders.unauth_description')}</p>
          {openInTelegramUrl ? (
            <a href={openInTelegramUrl} className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-[linear-gradient(135deg,#f59e0b_0%,#e76f51_100%)] px-4 py-3 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(231,111,81,0.24)] transition hover:brightness-105">
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
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-2xl border border-[#d9cdbd] bg-[rgba(255,248,240,0.94)] px-4 py-3 text-sm font-semibold text-[#31424d] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          {t('orders.refresh')}
        </button>
      }
    >
      {error ? (
        <ClientErrorPanel
          title={t('common.error_title')}
          message={error}
          onRetry={() => void loadOrders()}
          retryLabel={t('orders.refresh')}
          className="border-rose-200 bg-[rgba(255,241,240,0.95)]"
        />
      ) : null}

      {loading ? <SkeletonOrderList /> : null}

      {!loading && orders.length === 0 ? (
        <ClientPanel className="p-0">
          <ClientEmptyState
            title={t('orders.empty')}
            description={t('orders.subtitle')}
            action={
              <button
                type="button"
                onClick={() => void loadOrders()}
                className="inline-flex items-center gap-2 rounded-2xl bg-[#21404d] px-4 py-3 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(33,64,77,0.18)] transition hover:brightness-105"
              >
                <RefreshCw size={15} />
                {t('orders.refresh')}
              </button>
            }
          />
        </ClientPanel>
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
                className={`w-full rounded-[30px] border p-4 text-left transition ${isSelected ? 'border-transparent bg-[linear-gradient(135deg,#21404d_0%,#3d6c77_100%)] text-white shadow-[0_20px_40px_rgba(33,64,77,0.24)]' : 'border-white/70 bg-[rgba(255,252,247,0.88)] text-[#1f2933] hover:-translate-y-0.5 hover:shadow-[0_20px_40px_rgba(63,48,34,0.10)]'}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className={`text-sm font-semibold ${isSelected ? 'text-white' : 'text-[#1f2933]'}`}>{formatOrderRef(order.id)}</p>
                    <p className={`mt-1 text-sm ${isSelected ? 'text-white/70' : 'text-[#5b6770]'}`}>{order.location_text || t('orders.delivery_pending')}</p>
                  </div>
                  <div className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${isSelected ? 'bg-white/10 text-white' : getOrderStatusClasses(order.status)}`}>
                    {getOrderStatusLabel(order.status, language)}
                  </div>
                </div>
                <div className={`mt-3 flex items-center justify-between text-sm ${isSelected ? 'text-white/80' : 'text-[#5b6770]'}`}>
                  <span>{formatDateTime(order.created_at, language)}</span>
                  <span className={`font-semibold ${isSelected ? 'text-white' : 'text-[#1f2933]'}`}>{formatAmount(order.total_amount_uzs, language)}</span>
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
              <p className="text-xs uppercase tracking-[0.2em] text-[#9a6b3a]">{t('orders.selected_order')}</p>
              <h2 className="mt-2 text-lg font-semibold text-[#1f2933]">{formatOrderRef(selectedOrder.id)}</h2>
              <p className="mt-2 text-sm text-[#5b6770]">{selectedOrder.location_text || t('orders.delivery_pending')}</p>
            </div>
            <div className="text-right">
              <div className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${getOrderStatusClasses(selectedOrder.status)}`}>
                {getOrderStatusLabel(selectedOrder.status, language)}
              </div>
              <p className="mt-3 text-lg font-semibold text-[#1f2933]">{formatAmount(selectedOrder.total_amount_uzs, language)}</p>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-[24px] bg-[rgba(255,248,240,0.94)] px-4 py-3">
              <p className="text-xs uppercase tracking-[0.2em] text-[#9a6b3a]">{t('orders.product_subtotal')}</p>
              <p className="mt-2 text-base font-semibold text-[#1f2933]">{formatAmount(selectedOrder.product_subtotal_uzs || 0, language)}</p>
            </div>
            <div className="rounded-[24px] bg-[rgba(232,241,238,0.95)] px-4 py-3">
              <p className="text-xs uppercase tracking-[0.2em] text-[#40635b]">{t('orders.deposit')}</p>
              <p className="mt-2 text-base font-semibold text-[#1f2933]">{formatAmount(selectedOrder.bottle_deposit_total_uzs || 0, language)}</p>
            </div>
            <div className="rounded-[24px] bg-[rgba(235,240,244,0.94)] px-4 py-3">
              <p className="text-xs uppercase tracking-[0.2em] text-[#5a6d7c]">{t('orders.payment_method')}</p>
              <p className="mt-2 text-base font-semibold text-[#1f2933]">{getPaymentMethodLabel(selectedOrder.payment_method, language)}</p>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {(selectedOrder.items || []).map((item) => (
              <div key={`${selectedOrder.id}-${item.product_id}-${item.product_name}`} className="rounded-[24px] border border-[#eadfce] bg-[rgba(255,248,240,0.8)] px-4 py-3">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-[#1f2933]">{item.product_name}</p>
                    <p className="mt-1 text-sm text-[#5b6770]">{item.product_size_liters || '-'}L · {t('orders.qty', { count: item.quantity })}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-[#1f2933]">{formatAmount(item.line_total_uzs, language)}</p>
                    <p className="mt-1 text-xs text-[#7b8790]">{t('orders.deposit_item', { amount: formatAmount(item.bottle_deposit_total_uzs || 0, language) })}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm text-[#5b6770]">
            <div className="flex items-center gap-2">
              <CircleDot size={14} className="text-[#c0a07c]" />
              {detailLoading ? t('orders.refreshing_details') : t('orders.last_updated', { value: formatDateTime(selectedOrder.updated_at, language) })}
            </div>
            <NavLink
              to={`/app/orders/${selectedOrder.id}`}
              className="inline-flex items-center gap-2 rounded-2xl bg-[#21404d] px-4 py-3 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(33,64,77,0.18)] transition hover:brightness-105"
            >
              {t('orders.open_detail')}
              <ArrowRight size={15} />
            </NavLink>
          </div>
        </ClientPanel>
      ) : null}
    </ClientPage>
  );
};
