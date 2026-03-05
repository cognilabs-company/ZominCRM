import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Images, Minus, Plus, RefreshCw, ShoppingBag, ShoppingCart } from 'lucide-react';
import { clientApiRequest, resolveClientMediaUrl } from '../api/clientApi';
import { useClientApp } from '../bootstrap/ClientAppContext';
import { useClientCart } from '../bootstrap/ClientCartContext';
import { useClientLanguage } from '../bootstrap/ClientLanguageContext';
import { ClientEmptyState } from '../components/ClientEmptyState';
import { ClientErrorPanel } from '../components/ClientErrorPanel';
import { ClientPage } from '../components/ClientPage';
import { ClientPanel } from '../components/ClientPanel';
import { SkeletonProductList } from '../components/ClientSkeleton';
import { ClientProduct, ClientProductsResponse } from '../types';
import { formatAmount, getAvailabilityLabel } from '../utils';

type ProductImageSlide = {
  id: string;
  candidates: string[];
};

const toProductMediaCandidate = (value?: string | null) => resolveClientMediaUrl(value) || value || null;

const getProductImages = (product: ClientProduct) => {
  const slides: ProductImageSlide[] = [];
  const slideSignatures = new Set<string>();

  const addSlide = (id: string, values: Array<string | null | undefined>) => {
    const candidates = values
      .map((value) => toProductMediaCandidate(value))
      .filter((value): value is string => Boolean(value))
      .filter((value, index, array) => array.indexOf(value) === index);

    if (!candidates.length) return;

    const signature = candidates.join('|');
    if (slideSignatures.has(signature)) return;

    slideSignatures.add(signature);
    slides.push({ id, candidates });
  };

  addSlide(`${product.id}-primary`, [product.image_url, product.image_thumb_url]);

  (product.images || []).forEach((image, index) => {
    addSlide(image.id || `${product.id}-gallery-${index}`, [image.url, image.thumb_url]);
  });

  return slides;
};

type ProductCatalogCardProps = {
  product: ClientProduct;
  quantity: number;
  unavailable: boolean;
  language: string;
  t: (key: string, params?: Record<string, string | number>) => string;
  addProduct: (product: ClientProduct) => void;
  updateQuantity: (productId: string, quantity: number) => void;
};

const ProductCatalogCard: React.FC<ProductCatalogCardProps> = ({
  product,
  quantity,
  unavailable,
  language,
  t,
  addProduct,
  updateQuantity,
}) => {
  const media = React.useMemo(() => getProductImages(product), [product]);
  const [activeImageIndex, setActiveImageIndex] = React.useState(0);
  const [failedUrls, setFailedUrls] = React.useState<Record<string, boolean>>({});

  React.useEffect(() => {
    setActiveImageIndex(0);
    setFailedUrls({});
  }, [product.id, product.image_thumb_url, product.image_url, product.images]);

  React.useEffect(() => {
    if (!media.length && activeImageIndex !== 0) {
      setActiveImageIndex(0);
    }
  }, [activeImageIndex, media.length]);

  const currentSlide = media[activeImageIndex];
  const currentImageUrl = currentSlide?.candidates.find((candidate) => !failedUrls[candidate]) || null;
  const galleryCount = media.length;
  const photoBadgeLabel =
    galleryCount > 1
      ? t('products.photo_badge_gallery', { count: galleryCount })
      : currentImageUrl
        ? t('products.photo_badge_ready')
        : t('products.photo_badge_new');
  const photoStatusText =
    galleryCount > 1
      ? t('products.photo_status_gallery', { count: galleryCount })
      : currentImageUrl
        ? t('products.photo_status_ready')
        : t('products.photo_status_empty');

  React.useEffect(() => {
    if (currentImageUrl || galleryCount < 2) return;
    const nextIndex = media.findIndex((slide, index) => {
      if (index === activeImageIndex) return false;
      return slide.candidates.some((candidate) => !failedUrls[candidate]);
    });
    if (nextIndex !== -1) {
      setActiveImageIndex(nextIndex);
    }
  }, [activeImageIndex, currentImageUrl, failedUrls, galleryCount, media]);

  const shiftImage = (direction: number) => {
    if (galleryCount < 2) return;
    setActiveImageIndex((current) => (current + direction + galleryCount) % galleryCount);
  };

  return (
    <ClientPanel className="overflow-hidden p-0">
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-[linear-gradient(145deg,#21404d_0%,#3d6c77_58%,#d9a25f_100%)] text-white">
        {currentImageUrl ? (
          <img
            src={currentImageUrl}
            alt={product.name}
            className="h-full w-full object-cover"
            onError={() => {
              setFailedUrls((current) => (currentImageUrl ? { ...current, [currentImageUrl]: true } : current));
            }}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-center">
            <div>
              <ShoppingBag size={34} className="mx-auto" />
              <p className="mt-2 text-xs font-semibold uppercase tracking-[0.22em] text-white/72">{t('products.photo_none')}</p>
            </div>
          </div>
        )}

        <div className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-full bg-white/92 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#21404d]">
          {photoBadgeLabel}
        </div>

        <div className="absolute right-4 top-4 inline-flex items-center gap-2 rounded-full bg-black/38 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-white">
          {getAvailabilityLabel(product.availability_status, language)}
        </div>

        {galleryCount > 1 ? (
          <>
            <button
              type="button"
              onClick={() => shiftImage(-1)}
              className="absolute left-4 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/35 text-white transition hover:bg-black/55"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              type="button"
              onClick={() => shiftImage(1)}
              className="absolute right-4 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/35 text-white transition hover:bg-black/55"
            >
              <ChevronRight size={18} />
            </button>
          </>
        ) : null}

        <div className="absolute inset-x-0 bottom-0 bg-[linear-gradient(180deg,transparent_0%,rgba(0,0,0,0.58)_100%)] px-4 pb-4 pt-10">
          <div className="flex items-end justify-between gap-3 text-white">
            <div className="min-w-0">
              <p className="truncate text-lg font-semibold">{product.name}</p>
              <p className="mt-1 text-sm text-white/78">{product.size_liters}L</p>
            </div>
            {galleryCount > 1 ? (
              <span className="shrink-0 rounded-full bg-white/14 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-white">
                {t('products.gallery_position', { current: activeImageIndex + 1, total: galleryCount })}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <div className="space-y-4 p-4">
        <div className="grid grid-cols-2 gap-3 text-sm">
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

        <div className="flex flex-wrap items-center gap-2 text-xs text-[#8d99a2]">
          <span>{photoStatusText}</span>
          <span className={`inline-flex items-center rounded-full px-2.5 py-1 font-semibold ${unavailable ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-700'}`}>
            {t('products.available_count', { count: product.count })}
          </span>
          {galleryCount > 1 ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-[#eef4ff] px-2.5 py-1 font-medium text-[#355cbb]">
              <Images size={12} />
              {t('products.gallery_hint')}
            </span>
          ) : null}
        </div>

        {quantity > 0 ? (
          <div className="flex items-center justify-between gap-3 rounded-[24px] bg-[#21404d] px-3 py-3 text-white shadow-[0_12px_24px_rgba(33,64,77,0.18)]">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-white/55">{t('products.cart')}</p>
              <p className="mt-1 text-sm font-semibold">{quantity}</p>
            </div>
            <div className="inline-flex items-center gap-2">
              <button
                type="button"
                onClick={() => updateQuantity(product.id, Math.max(0, quantity - 1))}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 transition hover:bg-white/20 active:bg-white/25"
              >
                <Minus size={16} />
              </button>
              <button
                type="button"
                onClick={() => updateQuantity(product.id, quantity + 1)}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 transition hover:bg-white/20 active:bg-white/25"
              >
                <Plus size={16} />
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => addProduct(product)}
            disabled={unavailable}
            className={`inline-flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-medium transition ${
              unavailable
                ? 'cursor-not-allowed bg-slate-200 text-slate-400'
                : 'bg-[linear-gradient(135deg,#f59e0b_0%,#e76f51_100%)] text-white shadow-[0_12px_24px_rgba(231,111,81,0.24)] hover:brightness-105'
            }`}
          >
            <Plus size={16} />
            {t('products.add')}
          </button>
        )}
      </div>
    </ClientPanel>
  );
};

export const ClientProductsPage: React.FC = () => {
  const navigate = useNavigate();
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
      if (!active) return;
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
        <button
          type="button"
          onClick={() => navigate('/app/cart')}
          className="inline-flex items-center gap-2 rounded-2xl bg-[linear-gradient(135deg,#21404d_0%,#3d6c77_100%)] px-4 py-3 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(33,64,77,0.18)] transition hover:brightness-105"
        >
          <ShoppingCart size={16} />
          {t('products.cart')} {itemsCount ? `(${itemsCount})` : ''}
        </button>
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

          return (
            <ProductCatalogCard
              key={product.id}
              product={product}
              quantity={quantity}
              unavailable={unavailable}
              language={language}
              t={t}
              addProduct={addProduct}
              updateQuantity={updateQuantity}
            />
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
              <button
                type="button"
                onClick={() => navigate('/app/cart')}
                className="inline-flex shrink-0 items-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-[#21404d] transition hover:bg-[#fff5ea]"
              >
                {t('products.open_cart')}
                <ShoppingCart size={16} />
              </button>
            </div>
          </ClientPanel>
        </div>
      ) : null}
    </ClientPage>
  );
};
