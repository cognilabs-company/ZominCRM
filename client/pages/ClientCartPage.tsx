import React from 'react';
import { NavLink } from 'react-router-dom';
import { ArrowRight, Minus, Plus } from 'lucide-react';
import { useClientCart } from '../bootstrap/ClientCartContext';
import { ClientPage } from '../components/ClientPage';
import { ClientPanel } from '../components/ClientPanel';
import { formatAmount } from '../utils';

export const ClientCartPage: React.FC = () => {
  const { items, itemsCount, orderDraft, productSubtotal, updateQuantity, removeProduct, setOrderDraft } = useClientCart();

  return (
    <ClientPage
      title="Cart"
      subtitle="Set delivery details here, then move to preview for exact bottle deposit calculation."
      action={
        <NavLink
          to="/app/checkout-preview"
          className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-medium transition ${itemsCount ? 'bg-slate-950 text-white hover:bg-slate-800' : 'bg-slate-200 text-slate-500'}`}
        >
          Preview
          <ArrowRight size={15} />
        </NavLink>
      }
    >
      {items.length === 0 ? (
        <ClientPanel className="p-5 text-sm text-slate-500">
          Cart is empty. Add products first, then preview subtotal and deposit before creating an order.
        </ClientPanel>
      ) : (
        <div className="grid gap-3">
          {items.map((item) => (
            <ClientPanel key={item.product_id} className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <h2 className="text-sm font-semibold text-slate-950">{item.name}</h2>
                  <p className="mt-1 text-sm text-slate-500">{item.size_liters}L · {item.sku}</p>
                  <p className="mt-2 text-sm text-slate-500">Unit price {formatAmount(item.unit_price_uzs)}</p>
                </div>
                <button type="button" onClick={() => removeProduct(item.product_id)} className="rounded-2xl bg-rose-50 px-3 py-2 text-sm font-medium text-rose-600 transition hover:bg-rose-100">
                  Remove
                </button>
              </div>
              <div className="mt-4 flex items-center justify-between gap-3">
                <div className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-2 py-2 text-white">
                  <button type="button" onClick={() => updateQuantity(item.product_id, item.quantity - 1)} className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/10 transition hover:bg-white/15">
                    <Minus size={16} />
                  </button>
                  <span className="min-w-8 text-center text-sm font-semibold">{item.quantity}</span>
                  <button type="button" onClick={() => updateQuantity(item.product_id, item.quantity + 1)} className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/10 transition hover:bg-white/15">
                    <Plus size={16} />
                  </button>
                </div>
                <div className="text-right">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Line total</p>
                  <p className="mt-1 text-sm font-semibold text-slate-950">{formatAmount(item.unit_price_uzs * item.quantity)}</p>
                </div>
              </div>
            </ClientPanel>
          ))}
        </div>
      )}

      <ClientPanel className="p-5">
        <div className="grid gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700">Delivery address</label>
            <textarea
              value={orderDraft.location_text}
              onChange={(event) => setOrderDraft({ location_text: event.target.value })}
              className="mt-2 h-24 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none focus:border-slate-400"
              placeholder="Enter full delivery address"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-700">Payment method</label>
              <select
                value={orderDraft.payment_method}
                onChange={(event) => setOrderDraft({ payment_method: event.target.value as 'CASH' | 'TRANSFER' })}
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none focus:border-slate-400"
              >
                <option value="CASH">Cash</option>
                <option value="TRANSFER">Transfer</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Delivery time</label>
              <input
                type="datetime-local"
                value={orderDraft.delivery_time_requested}
                onChange={(event) => setOrderDraft({ delivery_time_requested: event.target.value })}
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none focus:border-slate-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Latitude</label>
              <input
                type="text"
                value={orderDraft.location_lat}
                onChange={(event) => setOrderDraft({ location_lat: event.target.value })}
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none focus:border-slate-400"
                placeholder="Optional"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Longitude</label>
              <input
                type="text"
                value={orderDraft.location_lng}
                onChange={(event) => setOrderDraft({ location_lng: event.target.value })}
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none focus:border-slate-400"
                placeholder="Optional"
              />
            </div>
          </div>
        </div>
      </ClientPanel>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <ClientPanel className="p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Items</p>
          <p className="mt-2 text-xl font-semibold text-slate-950">{itemsCount}</p>
        </ClientPanel>
        <ClientPanel className="p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Product subtotal</p>
          <p className="mt-2 text-xl font-semibold text-slate-950">{formatAmount(productSubtotal)}</p>
        </ClientPanel>
        <ClientPanel className="p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Bottle deposit</p>
          <p className="mt-2 text-xl font-semibold text-slate-950">Calculated on preview</p>
        </ClientPanel>
      </div>
    </ClientPage>
  );
};
