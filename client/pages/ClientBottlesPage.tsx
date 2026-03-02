import React from 'react';
import { Droplets, RefreshCw } from 'lucide-react';
import { clientApiRequest } from '../api/clientApi';
import { useClientApp } from '../bootstrap/ClientAppContext';
import { useClientLanguage } from '../bootstrap/ClientLanguageContext';
import { ClientPage } from '../components/ClientPage';
import { ClientPanel } from '../components/ClientPanel';
import { ClientBottlesResponse } from '../types';
import { formatAmount, formatDateTime, formatOrderRef, getMovementLabel } from '../utils';

export const ClientBottlesPage: React.FC = () => {
  const { sessionToken, isAuthenticated, openInTelegramUrl } = useClientApp();
  const { language, t } = useClientLanguage();
  const [data, setData] = React.useState<ClientBottlesResponse | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const loadBottles = React.useCallback(async () => {
    if (!sessionToken) return;
    try {
      setLoading(true);
      setError(null);
      const response = await clientApiRequest<ClientBottlesResponse>('/bottles/', undefined, sessionToken);
      setData(response);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : t('bottles.error_load'));
    } finally {
      setLoading(false);
    }
  }, [sessionToken, t]);

  React.useEffect(() => {
    void loadBottles();
  }, [loadBottles]);

  if (!isAuthenticated) {
    return (
      <ClientPage title={t('bottles.title')} subtitle={t('bottles.unauth_subtitle')}>
        <ClientPanel className="p-5 text-sm text-[#5b6770]">
          <p>{t('bottles.unauth_description')}</p>
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
      title={t('bottles.title')}
      subtitle={t('bottles.subtitle')}
      action={
        <button
          type="button"
          onClick={() => void loadBottles()}
          className="inline-flex items-center gap-2 rounded-2xl border border-[#d9cdbd] bg-[rgba(255,248,240,0.94)] px-4 py-3 text-sm font-semibold text-[#31424d] transition hover:bg-white"
        >
          <RefreshCw size={15} />
          {t('orders.refresh')}
        </button>
      }
    >
      {error ? (
        <ClientPanel className="border-rose-200 bg-[rgba(255,241,240,0.95)] p-4 text-sm text-rose-700">{error}</ClientPanel>
      ) : null}

      {loading ? (
        <ClientPanel className="p-5 text-sm text-[#5b6770]">{t('bottles.loading')}</ClientPanel>
      ) : null}

      {data?.summary ? (
        <div className="grid grid-cols-2 gap-3">
          <ClientPanel className="bg-[linear-gradient(135deg,rgba(255,248,238,0.96)_0%,rgba(247,237,224,0.92)_100%)] p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-[#9a6b3a]">{t('bottles.outstanding')}</p>
            <p className="mt-2 text-2xl font-semibold text-[#1f2933]">{data.summary.total_outstanding_bottles_count}</p>
          </ClientPanel>
          <ClientPanel className="bg-[linear-gradient(135deg,rgba(233,243,239,0.96)_0%,rgba(224,236,233,0.92)_100%)] p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-[#40635b]">{t('bottles.deposit_held')}</p>
            <p className="mt-2 text-2xl font-semibold text-[#1f2933]">{formatAmount(data.summary.total_deposit_held_uzs, language)}</p>
          </ClientPanel>
          <ClientPanel className="col-span-2 bg-[linear-gradient(135deg,rgba(235,240,244,0.94)_0%,rgba(226,232,240,0.92)_100%)] p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-[#5a6d7c]">{t('bottles.balances_description')}</p>
            <p className="mt-2 text-sm leading-6 text-[#5b6770]">{t('bottles.subtitle')}</p>
          </ClientPanel>
        </div>
      ) : null}

      <ClientPanel className="p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#21404d_0%,#3d6c77_100%)] text-white">
            <Droplets size={20} />
          </div>
          <div>
            <h2 className="text-base font-semibold text-[#1f2933]">{t('bottles.balances_by_product')}</h2>
            <p className="text-sm text-[#5b6770]">{t('bottles.balances_description')}</p>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          {data?.balances?.length ? data.balances.map((balance) => (
            <div key={balance.id} className="rounded-[24px] border border-[#eadfce] bg-[rgba(255,248,240,0.8)] px-4 py-3">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-[#1f2933]">{balance.product_name}</p>
                  <p className="mt-1 text-sm text-[#5b6770]">{balance.product_size_liters ? `${balance.product_size_liters}L` : '-'}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-[#1f2933]">{t('bottles.count_label', { count: balance.outstanding_bottles_count })}</p>
                  <p className="mt-1 text-xs text-[#7b8790]">{formatAmount(balance.deposit_held_uzs, language)}</p>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-[#5b6770]">
                <p>{t('bottles.total_charged')}: {formatAmount(balance.total_deposit_charged_uzs, language)}</p>
                <p>{t('bottles.total_refunded')}: {formatAmount(balance.total_deposit_refunded_uzs, language)}</p>
              </div>
            </div>
          )) : (
            <div className="rounded-[24px] bg-[rgba(255,248,240,0.94)] px-4 py-3 text-sm text-[#5b6770]">{t('bottles.no_balances')}</div>
          )}
        </div>
      </ClientPanel>

      <ClientPanel className="p-5">
        <h2 className="text-base font-semibold text-[#1f2933]">{t('bottles.recent_movements')}</h2>
        <div className="mt-4 space-y-3">
          {data?.movements?.length ? data.movements.map((movement) => (
            <div key={movement.id} className="rounded-[24px] border border-[#eadfce] bg-[rgba(255,248,240,0.8)] px-4 py-3">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-[#1f2933]">{getMovementLabel(movement.movement_type, language)}</p>
                  <p className="mt-1 text-sm text-[#5b6770]">{movement.product_name || '-'} {movement.product_size_liters ? `· ${movement.product_size_liters}L` : ''}</p>
                  <p className="mt-1 text-xs text-[#7b8790]">{movement.order_id ? formatOrderRef(movement.order_id) : t('bottles.no_order_reference')}</p>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-semibold ${movement.deposit_delta_uzs < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{formatAmount(movement.deposit_delta_uzs, language)}</p>
                  <p className="mt-1 text-xs text-[#7b8790]">{t('bottles.delta_label', { count: movement.quantity })}</p>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between gap-3 text-xs text-[#5b6770]">
                <p>{formatDateTime(movement.created_at, language)}</p>
                <p>{movement.order_id ? formatOrderRef(movement.order_id) : t('bottles.no_order_reference')}</p>
              </div>
            </div>
          )) : (
            <div className="rounded-[24px] bg-[rgba(255,248,240,0.94)] px-4 py-3 text-sm text-[#5b6770]">{t('bottles.no_movements')}</div>
          )}
        </div>
      </ClientPanel>
    </ClientPage>
  );
};
