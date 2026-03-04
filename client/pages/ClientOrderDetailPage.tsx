import React from 'react';
import { ArrowLeft, ExternalLink, RefreshCw, WalletCards } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { clientApiRequest } from '../api/clientApi';
import { useClientApp } from '../bootstrap/ClientAppContext';
import { useClientLanguage } from '../bootstrap/ClientLanguageContext';
import { ClientEmptyState } from '../components/ClientEmptyState';
import { ClientErrorPanel } from '../components/ClientErrorPanel';
import { ClientPage } from '../components/ClientPage';
import { ClientPanel } from '../components/ClientPanel';
import { SkeletonOrderDetail } from '../components/ClientSkeleton';
import { ClientOrder, ClientOrderDetailResponse, ClientOrderPaymentOptionsResponse, ClientPaymentSession } from '../types';
import {
  formatAmount,
  formatDateTime,
  formatOrderRef,
  getOrderStatusClasses,
  getOrderStatusLabel,
  getPaymentMethodLabel,
  getPaymentProviderLabel,
  isClientOrderTerminal,
} from '../utils';

const extractOrder = (response: ClientOrderDetailResponse | ClientOrder) =>
  (response as ClientOrderDetailResponse).order || (response as ClientOrder);

const openPaymentLink = (url: string) => {
  const telegram = typeof window !== 'undefined' ? (window as any).Telegram?.WebApp : null;
  if (telegram?.openLink) {
    telegram.openLink(url);
    return;
  }
  if (typeof window !== 'undefined') {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
};

export const ClientOrderDetailPage: React.FC = () => {
  const navigate = useNavigate();
  const { orderId } = useParams<{ orderId: string }>();
  const { isAuthenticated, sessionToken, openInTelegramUrl } = useClientApp();
  const { language, t } = useClientLanguage();
  const [order, setOrder] = React.useState<ClientOrder | null>(null);
  const [paymentOptions, setPaymentOptions] = React.useState<ClientOrderPaymentOptionsResponse | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [paymentLoading, setPaymentLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [paymentError, setPaymentError] = React.useState<string | null>(null);

  const loadOrder = React.useCallback(async () => {
    if (!sessionToken || !orderId) return;
    try {
      setLoading(true);
      setError(null);
      const response = await clientApiRequest<ClientOrderDetailResponse | ClientOrder>(`/orders/${orderId}/`, undefined, sessionToken);
      const nextOrder = extractOrder(response);
      setOrder(nextOrder?.id ? nextOrder : null);
    } catch (loadError) {
      setOrder(null);
      setError(loadError instanceof Error ? loadError.message : t('orders.detail.error_load'));
    } finally {
      setLoading(false);
    }
  }, [orderId, sessionToken, t]);

  React.useEffect(() => {
    void loadOrder();
  }, [loadOrder]);

  const loadPaymentOptions = React.useCallback(async (forceNew = false) => {
    if (!sessionToken || !orderId) return;
    try {
      setPaymentLoading(true);
      setPaymentError(null);
      const response = await clientApiRequest<ClientOrderPaymentOptionsResponse>(
        `/orders/${orderId}/payment-options/`,
        {
          method: 'POST',
          body: JSON.stringify({
            force_new: forceNew,
            expires_minutes: 20,
          }),
        },
        sessionToken
      );
      setPaymentOptions(response);
      setOrder(response.order);
    } catch (loadError) {
      setPaymentError(loadError instanceof Error ? loadError.message : t('orders.payment.error_load'));
    } finally {
      setPaymentLoading(false);
    }
  }, [orderId, sessionToken, t]);

  const paymentSessions = React.useMemo(
    () => Object.values(paymentOptions?.sessions || {}).filter(Boolean) as ClientPaymentSession[],
    [paymentOptions?.sessions]
  );

  const canLoadPayments = Boolean(order && order.status === 'PAYMENT_PENDING' && !isClientOrderTerminal(order.status));

  if (!isAuthenticated) {
    return (
      <ClientPage title={t('orders.detail.title')} subtitle={t('orders.unauth_subtitle')}>
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
      title={t('orders.detail.title')}
      subtitle={t('orders.detail.subtitle')}
      action={
        <button
          type="button"
          onClick={() => navigate('/app/orders')}
          className="inline-flex items-center gap-2 rounded-2xl border border-[#d9cdbd] bg-[rgba(255,248,240,0.94)] px-4 py-3 text-sm font-semibold text-[#31424d] transition hover:bg-white"
        >
          <ArrowLeft size={15} />
          {t('orders.detail.back')}
        </button>
      }
    >
      {error ? (
        <ClientErrorPanel
          title={t('orders.detail.error_title')}
          message={error}
          onRetry={() => void loadOrder()}
          retryLabel={t('orders.refresh')}
          className="border-rose-200 bg-[rgba(255,241,240,0.95)]"
        />
      ) : null}

      {loading ? <SkeletonOrderDetail /> : null}

      {!loading && !error && !order ? (
        <ClientPanel className="p-0">
          <ClientEmptyState
            title={t('orders.detail.empty_title')}
            description={t('orders.detail.empty_description')}
            action={
              <button
                type="button"
                onClick={() => navigate('/app/orders')}
                className="inline-flex items-center gap-2 rounded-2xl bg-[#21404d] px-4 py-3 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(33,64,77,0.18)] transition hover:brightness-105"
              >
                <ArrowLeft size={15} />
                {t('orders.detail.back')}
              </button>
            }
          />
        </ClientPanel>
      ) : null}

      {order ? (
        <>
          <ClientPanel className="p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-[#9a6b3a]">{t('orders.detail.reference')}</p>
                <h2 className="mt-2 text-lg font-semibold text-[#1f2933]">{formatOrderRef(order.id)}</h2>
                <p className="mt-2 text-sm text-[#5b6770]">{order.location_text || t('orders.delivery_pending')}</p>
              </div>
              <div className="text-right">
                <div className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${getOrderStatusClasses(order.status)}`}>
                  {getOrderStatusLabel(order.status, language)}
                </div>
                <p className="mt-3 text-lg font-semibold text-[#1f2933]">{formatAmount(order.total_amount_uzs, language)}</p>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-[24px] bg-[rgba(255,248,240,0.94)] px-4 py-3">
                <p className="text-xs uppercase tracking-[0.2em] text-[#9a6b3a]">{t('orders.product_subtotal')}</p>
                <p className="mt-2 text-base font-semibold text-[#1f2933]">{formatAmount(order.product_subtotal_uzs || 0, language)}</p>
              </div>
              <div className="rounded-[24px] bg-[rgba(232,241,238,0.95)] px-4 py-3">
                <p className="text-xs uppercase tracking-[0.2em] text-[#40635b]">{t('orders.deposit')}</p>
                <p className="mt-2 text-base font-semibold text-[#1f2933]">{formatAmount(order.bottle_deposit_total_uzs || 0, language)}</p>
              </div>
              <div className="rounded-[24px] bg-[rgba(235,240,244,0.94)] px-4 py-3">
                <p className="text-xs uppercase tracking-[0.2em] text-[#5a6d7c]">{t('orders.payment_method')}</p>
                <p className="mt-2 text-base font-semibold text-[#1f2933]">{getPaymentMethodLabel(order.payment_method, language)}</p>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-[24px] bg-[rgba(255,248,240,0.8)] px-4 py-3 text-sm text-[#5b6770]">
                <p className="text-xs uppercase tracking-[0.2em] text-[#9a6b3a]">{t('orders.detail.created_at')}</p>
                <p className="mt-2 font-medium text-[#1f2933]">{formatDateTime(order.created_at, language)}</p>
              </div>
              <div className="rounded-[24px] bg-[rgba(235,240,244,0.8)] px-4 py-3 text-sm text-[#5b6770]">
                <p className="text-xs uppercase tracking-[0.2em] text-[#5a6d7c]">{t('orders.detail.delivery_time')}</p>
                <p className="mt-2 font-medium text-[#1f2933]">{formatDateTime(order.delivery_time_requested, language)}</p>
              </div>
            </div>
          </ClientPanel>

          <ClientPanel className="p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold text-[#1f2933]">{t('orders.detail.items_title')}</h2>
                <p className="mt-1 text-sm text-[#5b6770]">{t('orders.detail.items_subtitle')}</p>
              </div>
              <button
                type="button"
                onClick={() => void loadOrder()}
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-2xl border border-[#d9cdbd] bg-[rgba(255,248,240,0.94)] px-4 py-3 text-sm font-semibold text-[#31424d] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
                {t('orders.refresh')}
              </button>
            </div>

            <div className="mt-4 space-y-3">
              {(order.items || []).map((item) => (
                <div key={`${order.id}-${item.product_id}-${item.product_name}`} className="rounded-[24px] border border-[#eadfce] bg-[rgba(255,248,240,0.8)] px-4 py-3">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-[#1f2933]">{item.product_name}</p>
                      <p className="mt-1 text-sm text-[#5b6770]">{t('orders.qty', { count: item.quantity })}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-[#1f2933]">{formatAmount(item.line_total_uzs, language)}</p>
                      <p className="mt-1 text-xs text-[#7b8790]">{t('orders.deposit_item', { amount: formatAmount(item.bottle_deposit_total_uzs || 0, language) })}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ClientPanel>

          {canLoadPayments ? (
            <ClientPanel className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-base font-semibold text-[#1f2933]">{t('orders.payment.title')}</h2>
                  <p className="mt-1 text-sm text-[#5b6770]">{t('orders.payment.subtitle')}</p>
                </div>
                <button
                  type="button"
                  onClick={() => void loadPaymentOptions(Boolean(paymentOptions))}
                  disabled={paymentLoading}
                  className="inline-flex items-center gap-2 rounded-2xl bg-[linear-gradient(135deg,#21404d_0%,#3d6c77_100%)] px-4 py-3 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(33,64,77,0.18)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <WalletCards size={16} />
                  {paymentLoading
                    ? t('orders.payment.loading')
                    : paymentOptions
                      ? t('orders.payment.refresh')
                      : t('orders.payment.load')}
                </button>
              </div>

              {paymentError ? (
                <ClientErrorPanel
                  title={t('orders.payment.error_title')}
                  message={paymentError}
                  onRetry={() => void loadPaymentOptions(Boolean(paymentOptions))}
                  retryLabel={t('orders.payment.load')}
                  className="mt-4"
                />
              ) : null}

              {paymentOptions ? (
                <>
                  <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {paymentSessions.map((session) => (
                      <div key={session.id} className="rounded-[24px] border border-[#eadfce] bg-[rgba(255,248,240,0.82)] p-4">
                        <p className="text-xs uppercase tracking-[0.2em] text-[#9a6b3a]">{getPaymentProviderLabel(session.provider, language)}</p>
                        <p className="mt-2 text-lg font-semibold text-[#1f2933]">{formatAmount(session.amount_uzs, language)}</p>
                        <p className="mt-1 text-sm text-[#5b6770]">{t('orders.payment.expires_at')}: {formatDateTime(session.expires_at, language)}</p>
                        <button
                          type="button"
                          onClick={() => openPaymentLink(session.checkout_url)}
                          className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-[linear-gradient(135deg,#f59e0b_0%,#e76f51_100%)] px-4 py-3 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(231,111,81,0.24)] transition hover:brightness-105"
                        >
                          <ExternalLink size={15} />
                          {t('orders.payment.open_provider', { provider: getPaymentProviderLabel(session.provider, language) })}
                        </button>
                      </div>
                    ))}
                  </div>

                  {paymentOptions.payment_attempt ? (
                    <div className="mt-4 rounded-[24px] bg-[rgba(235,240,244,0.92)] px-4 py-4 text-sm text-[#4a5a66]">
                      <p className="font-semibold text-[#1f2933]">{t('orders.payment.window_title')}</p>
                      <p className="mt-2">{t('orders.payment.window_range', {
                        start: formatDateTime(paymentOptions.payment_attempt.window_start, language),
                        end: formatDateTime(paymentOptions.payment_attempt.window_end, language),
                      })}</p>
                      <p className="mt-1">{t('orders.payment.window_status', { status: paymentOptions.payment_attempt.status })}</p>
                    </div>
                  ) : null}
                </>
              ) : null}
            </ClientPanel>
          ) : null}
        </>
      ) : null}
    </ClientPage>
  );
};
