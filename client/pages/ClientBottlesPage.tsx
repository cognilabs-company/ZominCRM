import React from 'react';
import { Droplets, RefreshCw } from 'lucide-react';
import { clientApiRequest } from '../api/clientApi';
import { useClientApp } from '../bootstrap/ClientAppContext';
import { ClientPage } from '../components/ClientPage';
import { ClientPanel } from '../components/ClientPanel';
import { ClientBottlesResponse } from '../types';
import { formatAmount, formatDateTime, formatOrderRef, getMovementLabel } from '../utils';

export const ClientBottlesPage: React.FC = () => {
  const { sessionToken, isAuthenticated } = useClientApp();
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
      setError(loadError instanceof Error ? loadError.message : 'Failed to load bottle balances.');
    } finally {
      setLoading(false);
    }
  }, [sessionToken]);

  React.useEffect(() => {
    void loadBottles();
  }, [loadBottles]);

  if (!isAuthenticated) {
    return (
      <ClientPage title="Bottles" subtitle="Open Telegram WebApp to view bottle balances.">
        <ClientPanel className="p-5 text-sm text-slate-500">Bottle summary is available only for verified client sessions.</ClientPanel>
      </ClientPage>
    );
  }

  return (
    <ClientPage
      title="Bottles"
      subtitle="Read-only bottle balance, deposit held, and movement history."
      action={
        <button
          type="button"
          onClick={() => void loadBottles()}
          className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
        >
          <RefreshCw size={15} />
          Refresh
        </button>
      }
    >
      {error ? (
        <ClientPanel className="border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</ClientPanel>
      ) : null}

      {loading ? (
        <ClientPanel className="p-5 text-sm text-slate-500">Loading bottle balances...</ClientPanel>
      ) : null}

      {data?.summary ? (
        <div className="grid grid-cols-2 gap-3">
          <ClientPanel className="p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Outstanding bottles</p>
            <p className="mt-2 text-2xl font-semibold text-slate-950">{data.summary.total_outstanding_bottles_count}</p>
          </ClientPanel>
          <ClientPanel className="p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Deposit held</p>
            <p className="mt-2 text-2xl font-semibold text-slate-950">{formatAmount(data.summary.deposit_held_total_uzs)}</p>
          </ClientPanel>
          <ClientPanel className="p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Total charged</p>
            <p className="mt-2 text-xl font-semibold text-slate-950">{formatAmount(data.summary.total_deposit_charged_uzs)}</p>
          </ClientPanel>
          <ClientPanel className="p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Total refunded</p>
            <p className="mt-2 text-xl font-semibold text-slate-950">{formatAmount(data.summary.total_deposit_refunded_uzs)}</p>
          </ClientPanel>
        </div>
      ) : null}

      <ClientPanel className="p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-white">
            <Droplets size={20} />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-950">Balances by product</h2>
            <p className="text-sm text-slate-500">Current reusable bottle coverage for each product.</p>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          {data?.balances?.length ? data.balances.map((balance) => (
            <div key={balance.id} className="rounded-2xl border border-slate-200 px-4 py-3">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-slate-950">{balance.product_name}</p>
                  <p className="mt-1 text-sm text-slate-500">{balance.product_size_liters}L · {balance.product_sku}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-slate-950">{balance.outstanding_bottles_count} bottles</p>
                  <p className="mt-1 text-xs text-slate-400">{formatAmount(balance.deposit_held_uzs)}</p>
                </div>
              </div>
            </div>
          )) : (
            <div className="rounded-2xl bg-slate-100 px-4 py-3 text-sm text-slate-500">No bottle balances yet.</div>
          )}
        </div>
      </ClientPanel>

      <ClientPanel className="p-5">
        <h2 className="text-base font-semibold text-slate-950">Recent movements</h2>
        <div className="mt-4 space-y-3">
          {data?.movements?.length ? data.movements.map((movement) => (
            <div key={movement.id} className="rounded-2xl border border-slate-200 px-4 py-3">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-slate-950">{getMovementLabel(movement.movement_type)}</p>
                  <p className="mt-1 text-sm text-slate-500">{movement.product_name} · {movement.product_size_liters}L</p>
                  <p className="mt-1 text-xs text-slate-400">{movement.order_id ? formatOrderRef(movement.order_id) : 'No order reference'}</p>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-semibold ${movement.deposit_delta_uzs < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{formatAmount(movement.deposit_delta_uzs)}</p>
                  <p className="mt-1 text-xs text-slate-400">{movement.bottles_delta > 0 ? '+' : ''}{movement.bottles_delta} bottles</p>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-slate-500">
                <p>Balance: {movement.balance_before_count} {'->'} {movement.balance_after_count}</p>
                <p>Deposit: {formatAmount(movement.deposit_before_uzs)} {'->'} {formatAmount(movement.deposit_after_uzs)}</p>
                <p>{movement.actor || '-'}</p>
                <p>{formatDateTime(movement.created_at)}</p>
              </div>
            </div>
          )) : (
            <div className="rounded-2xl bg-slate-100 px-4 py-3 text-sm text-slate-500">No bottle movements yet.</div>
          )}
        </div>
      </ClientPanel>
    </ClientPage>
  );
};

