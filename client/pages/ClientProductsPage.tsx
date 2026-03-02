import React from 'react';
import { NavLink } from 'react-router-dom';
import { Minus, Plus, RefreshCw, ShoppingBag, ShoppingCart } from 'lucide-react';
import { clientApiRequest } from '../api/clientApi';
import { useClientApp } from '../bootstrap/ClientAppContext';
import { useClientCart } from '../bootstrap/ClientCartContext';
import { useClientLanguage } from '../bootstrap/ClientLanguageContext';
import { ClientEmptyState } from '../components/ClientEmptyState';
import { ClientErrorPanel } from '../components/ClientErrorPanel';
import { ClientPage } from '../components/ClientPage';
import { ClientPanel } from '../components/ClientPanel';
import { SkeletonProductList } from '../components/ClientSkeleton';
import { ClientProduct, ClientProductsResponse } from '../types';
import { formatAmount, getAvailabilityClasses, getAvailabilityLabel } from '../utils';

const getPrimaryProductImage = (product: ClientProduct) => product.image_url || product.images?.[0]?.url || null;

export const ClientProductsPage: React.FC = () => {
  const { isAuthenticated, sessionToken, status, openInTelegramUrl } = useClientApp();
  const { addProduct, updateQuantity, getItemQuantity, itemsCount } = useClientCart();
  const { language, t } = useClientLanguage();
  const [products, setProducts] = React.useState<ClientProduct[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const loadProducts = React.useCallback(async () => {
    if (!sessionToken) return;
    try {
      setLoading(true);
      setError(null);
      const response = await clientApiRequest<ClientProductsResponse>('/products/', undefined, sessionToken);
      setProducts(response.results || []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : t('products.error_load'));
    } finally {
      setLoading(false);
    }
  }, [sessionToken, t]);

  React.useEffect(() => {
    let active = true;
    const run = async () => {
      await loadProducts();
      if (!active) {
        return;
      }
    };

    void run();
    return () => {
      active = false;
    };
  }, [loadProducts]);

  if (!isAuthenticated && status !== 'loading') {
    return (
      <ClientPage title={t('products.title')} subtitle={t('products.unauth_subtitle')}>
        <ClientPanel className="p-5">
          <p className="text-sm leading-6 text-[#5b6770]">{t('products.unauth_description')}</p>
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
      title={t('products.title')}
      subtitle={t('products.subtitle')}
      action={
        <NavLink
          to="/app/cart"
          className="inline-flex items-center gap-2 rounded-2xl bg-[linear-gradient(135deg,#21404d_0%,#3d6c77_100%)] px-4 py-3 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(33,64,77,0.18)] transition hover:brightness-105"
        >
          <ShoppingCart size={16} />
          {t('products.cart')} {itemsCount ? `(${itemsCount})` : ''}
        </NavLink>
      }
    >
      {error ? (
        <ClientErrorPanel
          title={t('common.error_title')}
          message={error}
          onRetry={() => void loadProducts()}
          retryLabel={t('orders.refresh')}
          className="border-rose-200 bg-[rgba(255,241,240,0.95)]"
        />
      ) : null}

      {loading ? <SkeletonProductList /> : null}

      {!loading && !error && products.length === 0 ? (
        <ClientPanel className="p-0">
          <ClientEmptyState
            title={t('products.empty')}
            description={t('products.subtitle')}
            action={
              <button
                type="button"
                onClick={() => void loadProducts()}
                className="inline-flex items-center gap-2 rounded-2xl bg-[#21404d] px-4 py-3 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(33,64,77,0.18)] transition hover:brightness-105"
              >
                <RefreshCw size={16} />
                {t('orders.refresh')}
              </button>
            }
          />
        </ClientPanel>
      ) : null}

      <div className="grid grid-cols-1 gap-4">
        {products.map((product) => {
          const quantity = getItemQuantity(product.id);
          const unavailable = product.availability_status === 'out_of_stock' || product.count <= 0;
          const primaryImage = getPrimaryProductImage(product);
          const galleryCount = product.images?.length || 0;
          const photoBadgeLabel = galleryCount > 1
            ? `${galleryCount} ${language === 'ru' ? 'фото' : language === 'uz' ? 'foto' : 'pics'}`
            : primaryImage
              ? (language === 'ru' ? 'есть' : language === 'uz' ? 'tayyor' : 'ready')
              : (language === 'ru' ? 'новый' : language === 'uz' ? 'yangi' : 'new');
          const photoStatusText = galleryCount > 1
            ? `${galleryCount} ${language === 'ru' ? 'фото в галерее' : language === 'uz' ? 'ta galereya rasmi' : 'gallery photos'}`
            : primaryImage
              ? (language === 'ru' ? 'Фото товара готово' : language === 'uz' ? 'Mahsulot rasmi tayyor' : 'Product photo ready')
              : (language === 'ru' ? 'Фото появится здесь' : language === 'uz' ? 'Rasm shu yerda ko\'rinadi' : 'Photo will appear here');
          const noPhotoLabel = language === 'ru' ? 'Нет фото' : language === 'uz' ? 'Rasm yoq' : 'No photo';

          return (
            <ClientPanel key={product.id} className="overflow-hidden p-4">
              <div className="flex items-start gap-4">
                <div className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-[28px] bg-[linear-gradient(135deg,#21404d_0%,#3d6c77_100%)] text-white">
                  {primaryImage ? (
                    <img src={primaryImage} alt={product.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="text-center">
                      <ShoppingBag size={24} className="mx-auto" />
                      <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/70">{noPhotoLabel}</p>
                    </div>
                  )}
                  <div className="absolute inset-x-0 bottom-0 h-8 bg-[linear-gradient(180deg,transparent_0%,rgba(0,0,0,0.3)_100%)]" />
                  <div className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#21404d]">
                    {photoBadgeLabel}
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-base font-semibold text-[#1f2933]">{product.name}</h2>
                      <p className="mt-1 text-sm text-[#5b6770]">{product.size_liters}L · {product.sku}</p>
                    </div>
                    <span className={`inline-flex shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${getAvailabilityClasses(product.availability_status)}`}>
                      {getAvailabilityLabel(product.availability_status, language)}
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-[22px] bg-[rgba(255,246,236,0.95)] px-3 py-3">
                      <p className="text-xs uppercase tracking-[0.2em] text-[#9a6b3a]">{t('products.price')}</p>
                      <p className="mt-1 font-semibold text-[#1f2933]">{formatAmount(product.price_uzs, language)}</p>
                    </div>
                    <div className="rounded-[22px] bg-[rgba(232,241,238,0.95)] px-3 py-3">
                      <p className="text-xs uppercase tracking-[0.2em] text-[#40635b]">{t('products.deposit')}</p>
                      <p className="mt-1 font-semibold text-[#1f2933]">
                        {product.requires_returnable_bottle ? formatAmount(product.bottle_deposit_uzs, language) : t('products.no_deposit')}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm text-[#5b6770]">{t('products.available_count', { count: product.count })}</p>
                      <p className="mt-1 text-xs text-[#8d99a2]">{photoStatusText}</p>
                    </div>
                    {quantity > 0 ? (
                      <div className="inline-flex items-center gap-2 rounded-2xl bg-[#21404d] px-2 py-2 text-white shadow-[0_12px_24px_rgba(33,64,77,0.18)]">
                        <button type="button" onClick={() => updateQuantity(product.id, Math.max(0, quantity - 1))} className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/10 transition hover:bg-white/20 active:bg-white/25">
                          <Minus size={16} />
                        </button>
                        <span className="min-w-8 text-center text-sm font-semibold">{quantity}</span>
                        <button type="button" onClick={() => updateQuantity(product.id, quantity + 1)} className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/10 transition hover:bg-white/20 active:bg-white/25">
                          <Plus size={16} />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => addProduct(product)}
                        disabled={unavailable}
                        className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-medium transition ${
                          unavailable
                            ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                            : 'bg-[linear-gradient(135deg,#f59e0b_0%,#e76f51_100%)] text-white shadow-[0_12px_24px_rgba(231,111,81,0.24)] hover:brightness-105'
                        }`}
                      >
                        <Plus size={16} />
                        {t('products.add')}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </ClientPanel>
          );
        })}
      </div>

      {itemsCount > 0 ? (
        <div className="sticky bottom-24 z-20">
          <ClientPanel className="border-none bg-[linear-gradient(135deg,#21404d_0%,#3d6c77_100%)] p-4 text-white shadow-[0_24px_48px_rgba(33,64,77,0.28)]">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-white/55">{t('products.cart_ready')}</p>
                <p className="mt-1 text-sm text-white/80">{t('products.cart')} {itemsCount}</p>
              </div>
              <NavLink
                to="/app/cart"
                className="inline-flex shrink-0 items-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-[#21404d] transition hover:bg-[#fff5ea]"
              >
                {t('products.open_cart')}
                <ShoppingCart size={16} />
              </NavLink>
            </div>
          </ClientPanel>
        </div>
      ) : null}
    </ClientPage>
  );
};
