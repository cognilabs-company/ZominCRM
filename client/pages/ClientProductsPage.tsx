import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Minus, Plus, RefreshCw, ShoppingBag, ShoppingCart } from 'lucide-react';
import { clientApiRequest, resolveClientMediaUrl } from '../api/clientApi';
import { useClientApp } from '../bootstrap/ClientAppContext';
import { useClientCart } from '../bootstrap/ClientCartContext';
import { useClientLanguage } from '../bootstrap/ClientLanguageContext';
import { ClientErrorPanel } from '../components/ClientErrorPanel';
import { SkeletonProductList } from '../components/ClientSkeleton';
import { ClientProduct, ClientProductsResponse } from '../types';
import { formatAmount } from '../utils';

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

  addSlide(`${product.id}-primary`, [product.image_thumb_url, product.image_url]);

  (product.images || []).forEach((image, index) => {
    addSlide(image.id || `${product.id}-gallery-${index}`, [image.thumb_url, image.url]);
  });

  return slides;
};

type ProductCardProps = {
  product: ClientProduct;
  quantity: number;
  unavailable: boolean;
  language: string;
  t: (key: string, params?: Record<string, string | number>) => string;
  addProduct: (product: ClientProduct) => void;
  updateQuantity: (productId: string, quantity: number) => void;
};

const ProductCard: React.FC<ProductCardProps> = ({ product, quantity, unavailable, language, t, addProduct, updateQuantity }) => {
  const media = React.useMemo(() => getProductImages(product), [product]);
  const [activeImageIndex, setActiveImageIndex] = React.useState(0);
  const [failedUrls, setFailedUrls] = React.useState<Record<string, boolean>>({});

  React.useEffect(() => {
    setActiveImageIndex(0);
    setFailedUrls({});
  }, [product.id]);

  const currentSlide = media[activeImageIndex];
  const currentImageUrl = currentSlide?.candidates.find((c) => !failedUrls[c]) || null;
  const galleryCount = media.length;

  const shiftImage = (dir: number) => {
    if (galleryCount < 2) return;
    setActiveImageIndex((i) => (i + dir + galleryCount) % galleryCount);
  };

  return (
    <div className={`overflow-hidden rounded-3xl border bg-white shadow-sm transition ${unavailable ? 'border-slate-200 opacity-70' : 'border-slate-200'}`}>
      {/* Image */}
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-slate-100">
        {currentImageUrl ? (
          <img
            src={currentImageUrl}
            alt={product.name}
            className="h-full w-full object-cover"
            onError={() => setFailedUrls((f) => currentImageUrl ? { ...f, [currentImageUrl]: true } : f)}
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-300">
            <ShoppingBag size={40} />
          </div>
        )}

        {/* Gradient overlay */}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-4 pb-4 pt-12">
          <div className="flex items-end justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-base font-bold text-white leading-tight">{product.name}</p>
              <p className="mt-0.5 text-sm text-white/75">{product.size_liters}L</p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-base font-bold text-white">{formatAmount(product.price_uzs, language)}</p>
              {product.requires_returnable_bottle ? (
                <p className="text-xs text-white/65">+{formatAmount(product.bottle_deposit_uzs, language)}</p>
              ) : null}
            </div>
          </div>
        </div>

        {/* Availability badge */}
        {unavailable ? (
          <div className="absolute left-3 top-3 rounded-full bg-rose-600 px-2.5 py-1 text-[11px] font-semibold text-white shadow">
            {t('products.out_of_stock') || 'Out of stock'}
          </div>
        ) : null}

        {/* Gallery arrows */}
        {galleryCount > 1 ? (
          <>
            <button
              type="button"
              onClick={() => shiftImage(-1)}
              className="absolute left-2 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-black/30 text-white backdrop-blur-sm transition hover:bg-black/50"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              onClick={() => shiftImage(1)}
              className="absolute right-2 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-black/30 text-white backdrop-blur-sm transition hover:bg-black/50"
            >
              <ChevronRight size={16} />
            </button>
            <div className="absolute bottom-16 right-3 flex items-center gap-1">
              {media.map((_, i) => (
                <div key={i} className={`rounded-full transition-all ${i === activeImageIndex ? 'h-1.5 w-3 bg-white' : 'h-1.5 w-1.5 bg-white/50'}`} />
              ))}
            </div>
          </>
        ) : null}
      </div>

      {/* Actions */}
      <div className="px-4 py-3">
        {quantity > 0 ? (
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-medium text-slate-500">
              {t('products.cart')}: <span className="text-slate-950">{formatAmount(product.price_uzs * quantity, language)}</span>
            </div>
            <div className="flex items-center gap-2 rounded-2xl bg-slate-950 px-1.5 py-1.5">
              <button
                type="button"
                onClick={() => updateQuantity(product.id, Math.max(0, quantity - 1))}
                className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/12 text-white transition hover:bg-white/22 active:scale-95"
              >
                <Minus size={15} />
              </button>
              <span className="min-w-7 text-center text-sm font-bold text-white">{quantity}</span>
              <button
                type="button"
                onClick={() => updateQuantity(product.id, quantity + 1)}
                className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/12 text-white transition hover:bg-white/22 active:scale-95"
              >
                <Plus size={15} />
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => addProduct(product)}
            disabled={unavailable}
            className={`flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-sm font-semibold transition active:scale-[0.98] ${
              unavailable
                ? 'cursor-not-allowed bg-slate-100 text-slate-400'
                : 'bg-slate-950 text-white shadow-[0_4px_14px_rgba(15,23,42,0.18)] hover:bg-slate-800'
            }`}
          >
            <Plus size={16} />
            {t('products.add')}
          </button>
        )}
      </div>
    </div>
  );
};

export const ClientProductsPage: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated, sessionToken, status, openInTelegramUrl } = useClientApp();
  const { addProduct, updateQuantity, getItemQuantity, itemsCount, productSubtotal } = useClientCart();
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
    void loadProducts().then(() => { if (!active) return; });
    return () => { active = false; };
  }, [loadProducts]);

  if (!isAuthenticated && status !== 'loading') {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <ShoppingBag size={48} className="mb-4 text-slate-300" />
        <p className="text-base font-semibold text-slate-700">{t('products.unauth_subtitle')}</p>
        <p className="mt-1 text-sm text-slate-500">{t('products.unauth_description')}</p>
        {openInTelegramUrl ? (
          <a href={openInTelegramUrl} className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow transition hover:bg-slate-800">
            {t('home.open_in_telegram_cta')}
          </a>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Page title row */}
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-slate-950">{t('products.title')}</h1>
        {itemsCount > 0 ? (
          <button
            type="button"
            onClick={() => navigate('/app/cart')}
            className="flex items-center gap-1.5 rounded-2xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white shadow transition hover:bg-blue-700"
          >
            <ShoppingCart size={14} />
            {itemsCount}
          </button>
        ) : null}
      </div>

      {error ? (
        <ClientErrorPanel
          title={t('common.error_title')}
          message={error}
          onRetry={() => void loadProducts()}
          retryLabel={t('orders.refresh')}
          className="border-rose-200 bg-rose-50"
        />
      ) : null}

      {loading ? <SkeletonProductList /> : null}

      {!loading && !error && products.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <ShoppingBag size={48} className="mb-4 text-slate-300" />
          <p className="text-base font-semibold text-slate-700">{t('products.empty')}</p>
          <button
            type="button"
            onClick={() => void loadProducts()}
            className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white shadow transition hover:bg-slate-800"
          >
            <RefreshCw size={14} />
            {t('orders.refresh')}
          </button>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4">
        {products.map((product) => {
          const quantity = getItemQuantity(product.id);
          const unavailable = product.availability_status === 'out_of_stock' || product.count <= 0;
          return (
            <ProductCard
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

      {/* Sticky cart banner */}
      {itemsCount > 0 ? (
        <div className="sticky bottom-24 z-20">
          <button
            type="button"
            onClick={() => navigate('/app/cart')}
            className="flex w-full items-center justify-between gap-4 rounded-3xl bg-slate-950 px-5 py-4 text-white shadow-[0_8px_32px_rgba(15,23,42,0.28)] transition hover:bg-slate-800 active:scale-[0.99]"
          >
            <div className="text-left">
              <p className="text-xs font-medium text-white/60">{itemsCount} {t('cart.items')}</p>
              <p className="text-base font-bold">{formatAmount(productSubtotal, language)}</p>
            </div>
            <div className="flex items-center gap-2 rounded-2xl bg-white px-4 py-2.5">
              <ShoppingCart size={15} className="text-slate-950" />
              <span className="text-sm font-bold text-slate-950">{t('products.open_cart')}</span>
            </div>
          </button>
        </div>
      ) : null}
    </div>
  );
};
