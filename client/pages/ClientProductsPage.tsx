import React from 'react';
import { NavLink } from 'react-router-dom';
import { Minus, Plus, ShoppingBag, ShoppingCart, Trash2 } from 'lucide-react';
import { clientApiRequest } from '../api/clientApi';
import { useClientApp } from '../bootstrap/ClientAppContext';
import { useClientCart } from '../bootstrap/ClientCartContext';
import { ClientPage } from '../components/ClientPage';
import { ClientPanel } from '../components/ClientPanel';
import { ClientProduct, ClientProductsResponse } from '../types';
import { formatAmount, getAvailabilityClasses, getAvailabilityLabel } from '../utils';

export const ClientProductsPage: React.FC = () => {
  const { isAuthenticated, sessionToken, status } = useClientApp();
  const { addProduct, updateQuantity, getItemQuantity, itemsCount } = useClientCart();
  const [products, setProducts] = React.useState<ClientProduct[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!sessionToken) return;

    let active = true;
    const loadProducts = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await clientApiRequest<ClientProductsResponse>('/products/', undefined, sessionToken);
        if (!active) return;
        setProducts(response.results || []);
      } catch (loadError) {
        if (!active) return;
        setError(loadError instanceof Error ? loadError.message : 'Failed to load products.');
      } finally {
        if (active) setLoading(false);
      }
    };

    void loadProducts();
    return () => {
      active = false;
    };
  }, [sessionToken]);

  if (!isAuthenticated && status !== 'loading') {
    return (
      <ClientPage title="Products" subtitle="Open the Telegram WebApp to load your client catalog.">
        <ClientPanel className="p-5">
          <p className="text-sm leading-6 text-slate-500">Client products are available only after Telegram WebApp bootstrap returns a client session token.</p>
        </ClientPanel>
      </ClientPage>
    );
  }

  return (
    <ClientPage
      title="Products"
      subtitle="Active catalog products from /client/webapp/products/."
      action={
        <NavLink
          to="/app/cart"
          className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
        >
          <ShoppingCart size={16} />
          Cart {itemsCount ? `(${itemsCount})` : ''}
        </NavLink>
      }
    >
      {error ? (
        <ClientPanel className="border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</ClientPanel>
      ) : null}

      {loading ? (
        <ClientPanel className="p-5 text-sm text-slate-500">Loading products...</ClientPanel>
      ) : null}

      {!loading && !error && products.length === 0 ? (
        <ClientPanel className="p-5 text-sm text-slate-500">No active products are available right now.</ClientPanel>
      ) : null}

      <div className="grid grid-cols-1 gap-3">
        {products.map((product) => {
          const quantity = getItemQuantity(product.id);
          const unavailable = product.availability_status === 'out_of_stock' || product.count <= 0;

          return (
            <ClientPanel key={product.id} className="p-4">
              <div className="flex items-start gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-3xl bg-slate-950 text-white">
                  <ShoppingBag size={22} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-base font-semibold text-slate-950">{product.name}</h2>
                      <p className="mt-1 text-sm text-slate-500">{product.size_liters}L · {product.sku}</p>
                    </div>
                    <span className={`inline-flex shrink-0 rounded-full px-3 py-1 text-xs font-medium ${getAvailabilityClasses(product.availability_status)}`}>
                      {getAvailabilityLabel(product.availability_status)}
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-2xl bg-slate-100 px-3 py-2">
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Price</p>
                      <p className="mt-1 font-semibold text-slate-950">{formatAmount(product.price_uzs)}</p>
                    </div>
                    <div className="rounded-2xl bg-slate-100 px-3 py-2">
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Bottle deposit</p>
                      <p className="mt-1 font-semibold text-slate-950">
                        {product.requires_returnable_bottle ? formatAmount(product.bottle_deposit_uzs) : 'No deposit'}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-3">
                    <p className="text-sm text-slate-500">Available count: {product.count}</p>
                    {quantity > 0 ? (
                      <div className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-2 py-2 text-white">
                        <button type="button" onClick={() => updateQuantity(product.id, quantity - 1)} className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/10 transition hover:bg-white/15">
                          <Minus size={16} />
                        </button>
                        <span className="min-w-8 text-center text-sm font-semibold">{quantity}</span>
                        <button type="button" onClick={() => updateQuantity(product.id, quantity + 1)} className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/10 transition hover:bg-white/15">
                          <Plus size={16} />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => addProduct(product)}
                        disabled={unavailable}
                        className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                      >
                        <Plus size={16} />
                        Add
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </ClientPanel>
          );
        })}
      </div>
    </ClientPage>
  );
};
