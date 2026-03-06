import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ChevronLeft, ChevronRight, Edit2, Eye, Images, Package, Plus, Search, Trash2, Upload, X } from 'lucide-react';
import { Badge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';
import { Modal } from '../components/ui/Modal';
import { useLanguage } from '../context/LanguageContext';
import { useToast } from '../context/ToastContext';
import { ENDPOINTS, apiRequest, resolveAdminMediaUrl } from '../services/api';

interface ApiProductImage {
  id: string;
  url: string;
  thumb_url?: string | null;
  sort_order?: number;
  created_at?: string | null;
}

interface ApiProduct {
  id: string;
  name: string;
  sku: string;
  image_url?: string | null;
  image_thumb_url?: string | null;
  images?: ApiProductImage[];
  size_liters: string;
  price_uzs: number;
  count: number;
  min_stock_threshold: number;
  availability_status: 'in_stock' | 'low_stock' | 'out_of_stock';
  requires_returnable_bottle: boolean;
  bottle_deposit_uzs: number;
  is_active: boolean;
  updated_at: string | null;
}

interface ProductListResponse {
  results?: ApiProduct[];
  stock_summary?: {
    total_products?: number;
    active_products?: number;
    out_of_stock?: number;
  };
}

type ProductFormState = {
  name: string;
  sku: string;
  size_liters: string;
  price_uzs: string;
  count: string;
  min_stock_threshold: string;
  requires_returnable_bottle: boolean;
  bottle_deposit_uzs: string;
  is_active: boolean;
};

const emptyForm: ProductFormState = {
  name: '',
  sku: '',
  size_liters: '',
  price_uzs: '0',
  count: '0',
  min_stock_threshold: '5',
  requires_returnable_bottle: false,
  bottle_deposit_uzs: '0',
  is_active: true,
};

const getPrimaryImageCandidates = (product?: Pick<ApiProduct, 'image_url' | 'image_thumb_url' | 'images'> | null) =>
  [
    product?.image_thumb_url,
    product?.images?.[0]?.thumb_url,
    product?.image_url,
    product?.images?.[0]?.url,
  ]
    .map((value) => resolveAdminMediaUrl(value || null))
    .filter((value): value is string => Boolean(value))
    .filter((value, index, array) => array.indexOf(value) === index);

const getPrimaryImage = (product?: Pick<ApiProduct, 'image_url' | 'image_thumb_url' | 'images'> | null) =>
  getPrimaryImageCandidates(product)[0] || null;

const getProductMedia = (product?: Pick<ApiProduct, 'image_url' | 'images'> | null) => {
  const items: ApiProductImage[] = [];
  const seen = new Set<string>();

  if (product?.image_url && !seen.has(product.image_url)) {
    seen.add(product.image_url);
    items.push({ id: 'primary-image', url: resolveAdminMediaUrl(product.image_url) || product.image_url });
  }

  (product?.images || []).forEach((image) => {
    if (!image.url || seen.has(image.url)) return;
    seen.add(image.url);
    items.push({
      ...image,
      url: resolveAdminMediaUrl(image.url) || image.url,
      thumb_url: resolveAdminMediaUrl(image.thumb_url || image.url) || image.thumb_url || image.url,
    });
  });

  return items;
};

const ProductThumbnail: React.FC<{
  product?: Pick<ApiProduct, 'name' | 'size_liters' | 'image_url' | 'image_thumb_url' | 'images'> | null;
  fallbackLabel: string;
  badgeLabel?: string | null;
  className?: string;
}> = ({ product, fallbackLabel, badgeLabel, className = 'h-24 w-24 rounded-[24px]' }) => {
  const imageCandidates = useMemo(() => getPrimaryImageCandidates(product), [product]);
  const [imageIndex, setImageIndex] = useState(0);
  const [imageExhausted, setImageExhausted] = useState(false);
  const imageUrl = !imageExhausted ? imageCandidates[imageIndex] || null : null;

  useEffect(() => {
    setImageIndex(0);
    setImageExhausted(false);
  }, [product?.image_url, product?.image_thumb_url, product?.images]);

  return (
    <div className={`relative overflow-hidden border border-white/70 bg-[linear-gradient(145deg,#21404d_0%,#3d6c77_58%,#d9a25f_100%)] shadow-[0_12px_24px_rgba(33,64,77,0.16)] ${className}`}>
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={product?.name || fallbackLabel}
          className="h-full w-full object-cover"
          onError={() => {
            if (imageIndex + 1 >= imageCandidates.length) {
              setImageExhausted(true);
              return;
            }
            setImageIndex((current) => current + 1);
          }}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-white">
          <div className="text-center">
            <Package size={24} className="mx-auto" />
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/72">{fallbackLabel}</p>
          </div>
        </div>
      )}
      <div className="absolute inset-x-0 bottom-0 bg-[linear-gradient(180deg,transparent_0%,rgba(0,0,0,0.62)_100%)] px-3 pb-3 pt-8 text-[10px] font-semibold text-white">
        <div className="flex items-center justify-between gap-2">
          <span>{product?.size_liters || '-'}L</span>
          {badgeLabel ? <span>{badgeLabel}</span> : null}
        </div>
      </div>
    </div>
  );
};

const Products: React.FC = () => {
  const { t, language } = useLanguage();
  const toast = useToast();
  const tr = (en: string, ru: string, uz: string) => (language === 'ru' ? ru : language === 'uz' ? uz : en);

  const [products, setProducts] = useState<ApiProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [onlyLowStock, setOnlyLowStock] = useState(false);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editing, setEditing] = useState<ApiProduct | null>(null);
  const [formState, setFormState] = useState<ProductFormState>(emptyForm);
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [uploadPreviewUrls, setUploadPreviewUrls] = useState<string[]>([]);
  const [removeImage, setRemoveImage] = useState(false);
  const [removeImageIds, setRemoveImageIds] = useState<string[]>([]);
  const [replaceGallery, setReplaceGallery] = useState(false);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const [detailProduct, setDetailProduct] = useState<ApiProduct | null>(null);
  const [detailIndex, setDetailIndex] = useState(0);
  const [stockSummary, setStockSummary] = useState<ProductListResponse['stock_summary'] | null>(null);

  const loadProducts = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (search.trim()) params.set('q', search.trim());
      if (onlyLowStock) params.set('low_stock', 'true');
      const query = params.toString() ? `?${params.toString()}` : '';
      const response = await apiRequest<ProductListResponse>(`${ENDPOINTS.PRODUCTS.LIST_CREATE}${query}`);
      setProducts(response.results || []);
      setStockSummary(response.stock_summary || null);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : tr('Failed to load products', 'Не удалось загрузить товары', "Mahsulotlarni yuklab bo'lmadi");
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadProducts();
  }, [onlyLowStock]);

  useEffect(() => {
    if (!uploadFiles.length) {
      setUploadPreviewUrls([]);
      return;
    }
    const objectUrls = uploadFiles.map((file) => URL.createObjectURL(file));
    setUploadPreviewUrls(objectUrls);
    return () => objectUrls.forEach((url) => URL.revokeObjectURL(url));
  }, [uploadFiles]);

  useEffect(() => {
    if (!editing) {
      setFormState(emptyForm);
      setUploadFiles([]);
      setRemoveImage(false);
      setRemoveImageIds([]);
      setReplaceGallery(false);
      return;
    }

    setFormState({
      name: editing.name || '',
      sku: editing.sku || '',
      size_liters: editing.size_liters || '',
      price_uzs: String(editing.price_uzs ?? 0),
      count: String(editing.count ?? 0),
      min_stock_threshold: String(editing.min_stock_threshold ?? 5),
      requires_returnable_bottle: Boolean(editing.requires_returnable_bottle),
      bottle_deposit_uzs: String(editing.bottle_deposit_uzs ?? 0),
      is_active: editing.is_active !== false,
    });
    setUploadFiles([]);
    setRemoveImage(false);
    setRemoveImageIds([]);
    setReplaceGallery(false);
  }, [editing]);

  const existingGalleryImages = useMemo(
    () =>
      (replaceGallery ? [] : (editing?.images || []).filter((image) => !removeImageIds.includes(image.id))).map((image) => ({
        ...image,
        url: resolveAdminMediaUrl(image.url) || image.url,
        thumb_url: resolveAdminMediaUrl(image.thumb_url || image.url) || image.thumb_url || image.url,
      })),
    [editing?.images, removeImageIds, replaceGallery]
  );

  const displayPrimaryImage = useMemo(() => {
    if (uploadPreviewUrls[0]) return uploadPreviewUrls[0];
    if (removeImage) return null;
    return getPrimaryImage(editing);
  }, [editing, removeImage, uploadPreviewUrls]);

  const detailMedia = useMemo(() => getProductMedia(detailProduct), [detailProduct]);

  const productStats = useMemo(
    () => ({
      totalProducts: stockSummary?.total_products ?? products.length,
      activeProducts: stockSummary?.active_products ?? products.filter((product) => product.is_active !== false).length,
      outOfStock: stockSummary?.out_of_stock ?? products.filter((product) => product.availability_status === 'out_of_stock').length,
    }),
    [products, stockSummary]
  );
  const editorPrice = Number(formState.price_uzs || 0);
  const editorStock = Number(formState.count || 0);
  const editorMinThreshold = Number(formState.min_stock_threshold || 0);
  const editorDeposit = formState.requires_returnable_bottle ? Number(formState.bottle_deposit_uzs || 0) : 0;
  const editorStatus: ApiProduct['availability_status'] =
    editorStock <= 0 ? 'out_of_stock' : editorStock <= editorMinThreshold ? 'low_stock' : 'in_stock';
  const editorMediaCount = existingGalleryImages.length + uploadFiles.length;

  const resetImageInputs = () => {
    if (uploadInputRef.current) uploadInputRef.current.value = '';
  };

  const openCreate = () => {
    setEditing(null);
    setFormState(emptyForm);
    setUploadFiles([]);
    setRemoveImage(false);
    setRemoveImageIds([]);
    setReplaceGallery(false);
    resetImageInputs();
    setIsEditorOpen(true);
  };

  const openEdit = (product: ApiProduct) => {
    setEditing(product);
    resetImageInputs();
    setIsEditorOpen(true);
  };

  const closeEditor = () => {
    setIsEditorOpen(false);
    setEditing(null);
    setFormState(emptyForm);
    setUploadFiles([]);
    setRemoveImage(false);
    setRemoveImageIds([]);
    setReplaceGallery(false);
    resetImageInputs();
  };

  const openDetail = (product: ApiProduct, startIndex = 0) => {
    const media = getProductMedia(product);
    setDetailProduct(product);
    setDetailIndex(media.length ? Math.min(Math.max(startIndex, 0), media.length - 1) : 0);
  };

  const closeDetail = () => {
    setDetailProduct(null);
    setDetailIndex(0);
  };

  const shiftDetailImage = (direction: number) => {
    if (!detailMedia.length) return;
    setDetailIndex((current) => (current + direction + detailMedia.length) % detailMedia.length);
  };

  const availabilityBadge = (status: ApiProduct['availability_status']) => {
    if (status === 'in_stock') return <Badge variant="success">{tr('In stock', 'В наличии', 'Mavjud')}</Badge>;
    if (status === 'low_stock') return <Badge variant="warning">{tr('Low stock', 'Мало остатка', 'Kam qolgan')}</Badge>;
    return <Badge variant="error">{tr('Out of stock', 'Нет в наличии', 'Tugagan')}</Badge>;
  };

  const handleSearch = (event: React.FormEvent) => {
    event.preventDefault();
    void loadProducts();
  };

  const handleSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      setSaving(true);
      setError(null);

      const hasMediaChanges = Boolean(uploadFiles.length || removeImage || removeImageIds.length || replaceGallery);

      if (hasMediaChanges) {
        const payload = new FormData();
        payload.append('name', formState.name.trim());
        if (editing || formState.sku.trim()) {
          payload.append('sku', formState.sku.trim());
        }
        payload.append('size_liters', formState.size_liters.trim());
        payload.append('price_uzs', String(Number(formState.price_uzs || 0)));
        payload.append('count', String(Number(formState.count || 0)));
        payload.append('min_stock_threshold', String(Number(formState.min_stock_threshold || 5)));
        payload.append('requires_returnable_bottle', String(formState.requires_returnable_bottle));
        payload.append('bottle_deposit_uzs', String(formState.requires_returnable_bottle ? Number(formState.bottle_deposit_uzs || 0) : 0));
        payload.append('is_active', String(formState.is_active));
        payload.append('actor', 'frontend-ui');

        if (uploadFiles.length === 1) {
          payload.append('image', uploadFiles[0]);
        } else {
          uploadFiles.forEach((file) => payload.append('images[]', file));
        }
        if (replaceGallery) payload.append('replace_images', 'true');
        if (removeImage) payload.append('remove_image', 'true');
        if (removeImageIds.length) payload.append('remove_image_ids', JSON.stringify(removeImageIds));

        await apiRequest(editing ? ENDPOINTS.PRODUCTS.DETAIL(editing.id) : ENDPOINTS.PRODUCTS.LIST_CREATE, {
          method: editing ? 'PATCH' : 'POST',
          body: payload,
        });
      } else {
        const jsonPayload: Record<string, unknown> = {
          name: formState.name.trim(),
          size_liters: formState.size_liters.trim(),
          price_uzs: Number(formState.price_uzs || 0),
          count: Number(formState.count || 0),
          min_stock_threshold: Number(formState.min_stock_threshold || 5),
          requires_returnable_bottle: formState.requires_returnable_bottle,
          bottle_deposit_uzs: formState.requires_returnable_bottle ? Number(formState.bottle_deposit_uzs || 0) : 0,
          is_active: formState.is_active,
          actor: 'frontend-ui',
        };
        if (editing || formState.sku.trim()) {
          jsonPayload.sku = formState.sku.trim();
        }

        await apiRequest(editing ? ENDPOINTS.PRODUCTS.DETAIL(editing.id) : ENDPOINTS.PRODUCTS.LIST_CREATE, {
          method: editing ? 'PATCH' : 'POST',
          body: JSON.stringify(jsonPayload),
        });
      }

      closeEditor();
      await loadProducts();
      toast.success(
        editing
          ? tr('Product updated.', 'Товар обновлён.', 'Mahsulot yangilandi.')
          : tr('Product created.', 'Товар создан.', 'Mahsulot yaratildi.'),
      );
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : tr('Failed to save product', 'Не удалось сохранить товар', "Mahsulotni saqlab bo'lmadi");
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async (product: ApiProduct) => {
    if (!window.confirm(tr(`Deactivate "${product.name}"?`, `Деактивировать "${product.name}"?`, `"${product.name}" mahsulotini nofaol qilinsinmi?`))) return;

    try {
      await apiRequest(ENDPOINTS.PRODUCTS.DETAIL(product.id), {
        method: 'PATCH',
        body: JSON.stringify({ is_active: false }),
      });
      await loadProducts();
        toast.success(tr('Product deactivated.', 'Товар деактивирован.', 'Mahsulot nofaol qilindi.'));
    } catch (deactivateError) {
        const message = deactivateError instanceof Error ? deactivateError.message : tr('Failed to deactivate product', 'Не удалось деактивировать товар', "Mahsulotni nofaol qilib bo'lmadi");
      setError(message);
      toast.error(message);
    }
  };

  const formatUpdatedAt = (value?: string | null) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat(language === 'ru' ? 'ru-RU' : language === 'uz' ? 'uz-UZ' : 'en-US', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-light-text dark:text-white">{t('nav_products')}</h1>
          <p className="mt-2 max-w-2xl text-sm text-gray-500 dark:text-gray-400">
            {tr(
              'Manage products, stock, and photos in one clean workspace.',
              'Управляйте товарами, остатками и фото в одном удобном месте.',
              "Mahsulotlar, qoldiq va rasmlarni bitta toza oynada boshqaring."
            )}
          </p>
        </div>
        <button onClick={openCreate} className="inline-flex items-center gap-2 rounded-xl bg-primary-blue px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-600">
          <Plus size={16} />
          {t('create')}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="bg-[linear-gradient(135deg,rgba(255,247,237,0.94)_0%,rgba(255,255,255,1)_100%)]">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#9a6b3a]">
            {tr('Total products', 'Всего товаров', 'Jami mahsulotlar')}
          </p>
          <p className="mt-3 text-3xl font-semibold text-[#1f2933]">{productStats.totalProducts}</p>
          <p className="mt-2 text-sm text-[#5b6770]">
            {tr('All products returned by the current catalog query.', 'Все товары из текущего запроса каталога.', 'Joriy katalog so‘rovida qaytgan barcha mahsulotlar.')}
          </p>
        </Card>
        <Card className="bg-[linear-gradient(135deg,rgba(232,241,238,0.94)_0%,rgba(255,255,255,1)_100%)]">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#40635b]">
            {tr('Active products', 'Активные товары', 'Faol mahsulotlar')}
          </p>
          <p className="mt-3 text-3xl font-semibold text-[#1f2933]">
            {productStats.activeProducts}
          </p>
          <p className="mt-2 text-sm text-[#5b6770]">
            {tr('Products currently marked active in the catalog.', 'Товары, которые сейчас активны в каталоге.', 'Hozir katalogda faol belgilangan mahsulotlar.')}
          </p>
        </Card>
        <Card className="bg-[linear-gradient(135deg,rgba(236,242,255,0.94)_0%,rgba(255,255,255,1)_100%)]">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#355cbb]">
            {tr('Out of stock', 'Нет в наличии', 'Tugagan')}
          </p>
          <p className="mt-3 text-3xl font-semibold text-[#1f2933]">{productStats.outOfStock}</p>
          <p className="mt-2 text-sm text-[#5b6770]">
            {tr('Products that are currently unavailable in stock.', 'Товары, которых сейчас нет в наличии.', 'Hozir omborda qolmagan mahsulotlar.')}
          </p>
        </Card>
      </div>

      {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

      <Card className="!p-0 overflow-hidden">
        <form onSubmit={handleSearch} className="border-b border-light-border bg-white p-4 dark:border-navy-700 dark:bg-navy-800">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-white">{tr('Products catalog', 'Каталог товаров', 'Mahsulotlar katalogi')}</p>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {tr('Cleaner cards in the list, full details on open.', 'В списке только главное, полные детали внутри карточки.', "Ro'yxatda faqat kerakli ma'lumot, to'liq tafsilot ichkarida.")}
              </p>
            </div>
            <div className="flex flex-col gap-3 md:flex-row md:items-center">
              <label className="inline-flex items-center gap-2 rounded-lg border border-light-border bg-gray-50 px-3 py-2 text-sm text-gray-700 dark:border-navy-600 dark:bg-navy-900 dark:text-gray-300">
                <input type="checkbox" checked={onlyLowStock} onChange={(event) => setOnlyLowStock(event.target.checked)} />
                {tr('Low stock only', 'Только мало остатка', 'Faqat kam qolganlar')}
              </label>
              <div className="relative min-w-[18rem]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                  type="text"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={`${t('search')}...`}
                  className="w-full rounded-lg border border-light-border bg-gray-50 py-2 pl-10 pr-4 text-sm text-gray-900 outline-none focus:border-primary-blue dark:border-navy-600 dark:bg-navy-900 dark:text-white"
                />
              </div>
            </div>
          </div>
        </form>

        <div className="p-4">
          {loading ? (
            <div className="py-12 text-center text-sm text-gray-500">{tr('Loading products...', 'Товары загружаются...', 'Mahsulotlar yuklanmoqda...')}</div>
          ) : products.length === 0 ? (
            <div className="py-12 text-center text-sm text-gray-500">{tr('No products found.', 'Товары не найдены.', 'Mahsulotlar topilmadi.')}</div>
          ) : (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
              {products.map((product) => {
                const mediaCount = getProductMedia(product).length;

                return (
                  <div key={product.id} className="overflow-hidden rounded-[28px] border border-light-border bg-white shadow-[0_18px_38px_rgba(33,64,77,0.08)] transition hover:-translate-y-0.5 hover:shadow-[0_22px_44px_rgba(33,64,77,0.12)] dark:border-navy-700 dark:bg-navy-800">
                    <div className="flex h-full flex-col">
                      <button type="button" onClick={() => openDetail(product)} className="block w-full text-left">
                        <ProductThumbnail
                          product={product}
                            fallbackLabel={tr('No photo', 'Нет фото', "Rasm yo'q")}
                          badgeLabel={mediaCount ? String(mediaCount) : null}
                          className="h-52 w-full rounded-none rounded-t-[28px] border-0"
                        />
                      </button>

                      <div className="min-w-0 flex-1 space-y-4 p-5">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0">
                            <button type="button" onClick={() => openDetail(product)} className="text-left text-xl font-semibold text-gray-900 transition hover:text-primary-blue dark:text-white">
                              {product.name}
                            </button>
                            <p className="mt-1 text-sm text-gray-500">{product.size_liters}L</p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            {availabilityBadge(product.availability_status)}
                            {product.is_active === false ? <Badge variant="default">{tr('Inactive', 'Неактивный', 'Nofaol')}</Badge> : null}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="rounded-2xl bg-[rgba(255,246,236,0.95)] px-4 py-3">
                            <p className="text-[11px] uppercase tracking-[0.18em] text-[#9a6b3a]">{t('price')}</p>
                            <p className="mt-2 text-lg font-semibold text-[#1f2933]">{product.price_uzs.toLocaleString()} UZS</p>
                          </div>
                          <div className="rounded-2xl bg-[rgba(232,241,238,0.95)] px-4 py-3">
                            <p className="text-[11px] uppercase tracking-[0.18em] text-[#40635b]">{t('stock')}</p>
                            <p className="mt-2 text-lg font-semibold text-[#1f2933]">{product.count}</p>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 font-semibold ${
                              mediaCount
                                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300'
                                : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                            }`}
                          >
                            <Images size={12} />
                              {mediaCount ? tr(`${mediaCount} media`, `${mediaCount} медиа`, `${mediaCount} media`) : tr('No media', 'Нет медиа', "Media yo'q")}
                          </span>
                          {product.requires_returnable_bottle ? (
                            <span className="inline-flex items-center rounded-full bg-amber-50 px-3 py-1.5 font-semibold text-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
                              {product.bottle_deposit_uzs.toLocaleString()} UZS
                            </span>
                          ) : null}
                        </div>

                        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_44px] gap-2">
                          <button type="button" onClick={() => openDetail(product)} className="inline-flex w-full min-w-0 items-center justify-center gap-2 rounded-xl border border-light-border px-3 py-3 text-sm font-medium text-gray-700 transition hover:border-primary-blue hover:text-primary-blue dark:border-navy-600 dark:text-gray-200">
                            <Eye size={15} />
                              {tr('Open', 'Открыть', 'Ochish')}
                          </button>
                          <button type="button" onClick={() => openEdit(product)} className="inline-flex w-full min-w-0 items-center justify-center gap-2 rounded-xl bg-[#21404d] px-3 py-3 text-sm font-medium text-white transition hover:brightness-105">
                            <Edit2 size={15} />
                              {tr('Edit', 'Изменить', 'Tahrirlash')}
                          </button>
                          <button type="button" onClick={() => void handleDeactivate(product)} className="inline-flex h-[48px] w-11 items-center justify-center rounded-xl bg-rose-50 text-rose-600 transition hover:bg-rose-100 dark:bg-rose-950/20 dark:text-rose-300">
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Card>

      <Modal
        isOpen={isEditorOpen}
        onClose={closeEditor}
        title={editing ? tr('Edit Product', 'Редактировать товар', 'Mahsulotni tahrirlash') : tr('Add New Product', 'Добавить товар', "Yangi mahsulot qo'shish")}
        footer={null}
        maxWidthClass="max-w-5xl"
      >
        <form onSubmit={handleSave} className="space-y-6">
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.05fr_1.35fr]">
            <section className="space-y-4">
              <div className="overflow-hidden rounded-[28px] border border-white/80 bg-[linear-gradient(145deg,#21404d_0%,#3d6c77_58%,#d9a25f_100%)] shadow-[0_24px_48px_rgba(33,64,77,0.18)]">
                <div className="relative h-72 w-full">
                  {displayPrimaryImage ? (
                    <img src={displayPrimaryImage} alt={formState.name || 'Product preview'} className="h-full w-full object-cover" />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-white">
                      <div className="text-center">
                        <Package size={34} className="mx-auto" />
                          <p className="mt-3 text-xs font-semibold uppercase tracking-[0.22em] text-white/72">{tr('Upload a product photo', 'Загрузите фото товара', 'Mahsulot rasmini yuklang')}</p>
                      </div>
                    </div>
                  )}
                  <div className="absolute inset-x-0 bottom-0 bg-[linear-gradient(180deg,transparent_0%,rgba(0,0,0,0.66)_100%)] px-5 pb-5 pt-12 text-white">
                      <p className="text-lg font-semibold">{formState.name || tr('New product', 'Новый товар', 'Yangi mahsulot')}</p>
                      <p className="mt-1 text-sm text-white/76">{formState.size_liters || '-'}L / {(existingGalleryImages.length + uploadFiles.length) || 0} {tr('photos', 'фото', 'rasm')}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-[28px] border border-light-border bg-white/80 p-5 shadow-sm dark:border-navy-700 dark:bg-navy-900/40">
                <div className="flex items-center justify-between gap-3">
                  <div>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">{tr('Product photos', 'Фото товара', 'Mahsulot rasmlari')}</p>
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{tr('Upload one or many images. If several files are selected, the first becomes the main photo automatically.', 'Загрузите одно или несколько изображений. Если выбрано несколько, первое станет главным фото автоматически.', "Bitta yoki bir nechta rasm yuklang. Bir nechta fayl tanlansa, birinchisi avtomatik asosiy rasm bo'ladi.")}</p>
                  </div>
                  <label className="cursor-pointer rounded-2xl bg-[#21404d] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#1a3340]">
                      <span className="inline-flex items-center gap-2"><Upload size={15} />{tr('Choose images', 'Выбрать изображения', 'Rasmlarni tanlash')}</span>
                    <input ref={uploadInputRef} type="file" accept="image/*" multiple className="hidden" onChange={(event) => setUploadFiles(Array.from(event.target.files || []))} />
                  </label>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-[#5b6770]">
                  <span className="rounded-full bg-[rgba(255,248,240,0.94)] px-3 py-1.5 font-semibold text-[#21404d]">
                    {existingGalleryImages.length} {tr('current', 'текущие', 'joriy')}
                  </span>
                  <span className="rounded-full bg-[rgba(236,242,255,0.94)] px-3 py-1.5 font-semibold text-[#355cbb]">
                    {uploadFiles.length} {tr('new', 'новые', 'yangi')}
                  </span>
                  {uploadFiles.length ? (
                    <span className="rounded-full bg-[rgba(232,241,238,0.95)] px-3 py-1.5 font-semibold text-[#40635b]">
                      {tr('First selected image will be used as the main photo.', 'Первое выбранное изображение станет главным фото.', "Birinchi tanlangan rasm asosiy rasm bo'ladi.")}
                    </span>
                  ) : null}
                </div>
                {uploadFiles.length ? (
                  <div className="mt-4 rounded-2xl border border-dashed border-[#d8c7b2] bg-[rgba(255,248,240,0.94)] px-4 py-3 text-sm text-[#5b6770]">
                    {uploadFiles.map((file) => file.name).join(', ')}
                  </div>
                ) : null}
                {uploadFiles.length ? (
                  <button
                    type="button"
                    onClick={() => {
                      setUploadFiles([]);
                      if (uploadInputRef.current) uploadInputRef.current.value = '';
                    }}
                    className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-rose-600 transition hover:text-rose-700"
                  >
                    <X size={14} />
                    {tr('Remove selected files', 'Удалить выбранные файлы', "Tanlangan fayllarni olib tashlash")}
                  </button>
                ) : null}
                {editing && getPrimaryImage(editing) ? (
                  <label className="mt-3 inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                    <input type="checkbox" checked={removeImage} onChange={(event) => setRemoveImage(event.target.checked)} />
                    {tr('Remove current main photo on save', 'Удалить текущее главное фото при сохранении', "Saqlashda joriy asosiy rasmni olib tashlash")}
                  </label>
                ) : null}
                {editing?.images?.length ? (
                  <label className="mt-4 inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                    <input
                      type="checkbox"
                      checked={replaceGallery}
                      onChange={(event) => {
                        setReplaceGallery(event.target.checked);
                        if (event.target.checked) setRemoveImageIds([]);
                      }}
                    />
                    {tr('Replace full gallery on save', 'Заменить всю галерею при сохранении', "Saqlashda galereyani to'liq almashtirish")}
                  </label>
                ) : null}
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {existingGalleryImages.map((image) => (
                    <div key={image.id} className="group relative overflow-hidden rounded-2xl border border-light-border bg-gray-50 shadow-sm dark:border-navy-700 dark:bg-navy-800">
                      <img src={image.thumb_url || image.url} alt={formState.name || 'Gallery image'} className="h-24 w-full object-cover" />
                      <button type="button" onClick={() => setRemoveImageIds((current) => current.includes(image.id) ? current : [...current, image.id])} className="absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition group-hover:opacity-100">
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                  {uploadPreviewUrls.map((url, index) => (
                    <div key={`${url}-${index}`} className="group relative overflow-hidden rounded-2xl border border-primary-blue/30 bg-blue-50 shadow-sm">
                      <img src={url} alt={`Upload ${index + 1}`} className="h-24 w-full object-cover" />
                      <button type="button" onClick={() => setUploadFiles((current) => current.filter((_, fileIndex) => fileIndex !== index))} className="absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition group-hover:opacity-100">
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                  {!existingGalleryImages.length && !uploadPreviewUrls.length ? (
                    <div className="col-span-full rounded-2xl border border-dashed border-light-border bg-gray-50 px-4 py-6 text-center text-sm text-gray-500 dark:border-navy-700 dark:bg-navy-900/40">
                      {tr('No product photos yet.', 'Фото товара пока нет.', "Hali mahsulot rasmlari yo'q.")}
                    </div>
                  ) : null}
                </div>
              </div>
            </section>

            <section className="space-y-5">
              <div className="rounded-[28px] border border-light-border bg-white/80 p-5 shadow-sm dark:border-navy-700 dark:bg-navy-900/40">
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{tr('Product details', 'Детали товара', 'Mahsulot tafsilotlari')}</p>
                <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="md:col-span-2">
                    <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">{t('product_name')}</label>
                    <input
                      value={formState.name}
                      onChange={(event) => setFormState((current) => ({ ...current, name: event.target.value }))}
                      required
                      className="w-full rounded-lg border border-light-border bg-gray-50 px-3 py-2 text-sm text-gray-900 outline-none focus:border-primary-blue dark:border-navy-600 dark:bg-navy-900 dark:text-white"
                    />
                  </div>
                  {editing ? (
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">SKU</label>
                      <input
                        value={formState.sku}
                        onChange={(event) => setFormState((current) => ({ ...current, sku: event.target.value }))}
                        placeholder={tr('Leave empty to auto-generate', 'Оставьте пустым для авто-генерации', "Avto yaratish uchun bo'sh qoldiring")}
                        className="w-full rounded-lg border border-light-border bg-gray-50 px-3 py-2 text-sm text-gray-900 outline-none focus:border-primary-blue dark:border-navy-600 dark:bg-navy-900 dark:text-white"
                      />
                    </div>
                  ) : (
                    <div className="md:col-span-2 rounded-2xl border border-light-border bg-[rgba(248,252,251,0.88)] px-4 py-3 text-sm text-[#4b5663]">
                      {tr('SKU will be generated automatically after saving.', 'SKU будет сгенерирован автоматически после сохранения.', "Saqlangandan keyin SKU avtomatik yaratiladi.")}
                    </div>
                  )}
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">{tr('Size liters', 'Объем (литр)', 'Hajmi (litr)')}</label>
                    <input
                      value={formState.size_liters}
                      onChange={(event) => setFormState((current) => ({ ...current, size_liters: event.target.value }))}
                      required
                      className="w-full rounded-lg border border-light-border bg-gray-50 px-3 py-2 text-sm text-gray-900 outline-none focus:border-primary-blue dark:border-navy-600 dark:bg-navy-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">{t('price')} (UZS)</label>
                    <input
                      type="number"
                      min="0"
                      value={formState.price_uzs}
                      onChange={(event) => setFormState((current) => ({ ...current, price_uzs: event.target.value }))}
                      required
                      className="w-full rounded-lg border border-light-border bg-gray-50 px-3 py-2 text-sm text-gray-900 outline-none focus:border-primary-blue dark:border-navy-600 dark:bg-navy-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">{t('stock')}</label>
                    <input
                      type="number"
                      min="0"
                      value={formState.count}
                      onChange={(event) => setFormState((current) => ({ ...current, count: event.target.value }))}
                      required
                      className="w-full rounded-lg border border-light-border bg-gray-50 px-3 py-2 text-sm text-gray-900 outline-none focus:border-primary-blue dark:border-navy-600 dark:bg-navy-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">{tr('Min threshold', 'Минимальный порог', 'Minimal chegara')}</label>
                    <input
                      type="number"
                      min="0"
                      value={formState.min_stock_threshold}
                      onChange={(event) => setFormState((current) => ({ ...current, min_stock_threshold: event.target.value }))}
                      required
                      className="w-full rounded-lg border border-light-border bg-gray-50 px-3 py-2 text-sm text-gray-900 outline-none focus:border-primary-blue dark:border-navy-600 dark:bg-navy-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">{tr('Bottle deposit (UZS)', 'Депозит за бутыль (UZS)', 'Idish depoziti (UZS)')}</label>
                    <input
                      type="number"
                      min="0"
                      value={formState.bottle_deposit_uzs}
                      onChange={(event) => setFormState((current) => ({ ...current, bottle_deposit_uzs: event.target.value }))}
                      disabled={!formState.requires_returnable_bottle}
                      className="w-full rounded-lg border border-light-border bg-gray-50 px-3 py-2 text-sm text-gray-900 outline-none focus:border-primary-blue disabled:opacity-50 dark:border-navy-600 dark:bg-navy-900 dark:text-white"
                    />
                  </div>
                  <div className="md:col-span-2 rounded-2xl border border-light-border bg-[rgba(248,252,251,0.88)] px-4 py-3 text-sm text-[#4b5663]">
                    <p>{tr('Keep availability and bottle rules aligned with the real product setup.', 'Держите правила наличия и тары в соответствии с реальным товаром.', "Mavjudlik va idish qoidalarini real mahsulotga moslang.")}</p>
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                      <input
                        type="checkbox"
                        checked={formState.requires_returnable_bottle}
                        onChange={(event) =>
                          setFormState((current) => ({
                            ...current,
                            requires_returnable_bottle: event.target.checked,
                            bottle_deposit_uzs: event.target.checked ? current.bottle_deposit_uzs : '0',
                          }))
                        }
                      />
                      {tr('Requires returnable bottle', 'Требует возвратную тару', 'Qaytariladigan idish talab qiladi')}
                    </label>
                    <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                      <input type="checkbox" checked={formState.is_active} onChange={(event) => setFormState((current) => ({ ...current, is_active: event.target.checked }))} />
                      {tr('Active', 'Активный', 'Faol')}
                    </label>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Card className="bg-[linear-gradient(135deg,rgba(255,247,237,0.96)_0%,rgba(255,255,255,1)_100%)]">
                    <p className="text-xs uppercase tracking-[0.2em] text-[#9a6b3a]">SKU</p>
                    <p className="mt-2 text-base font-semibold text-[#1f2933]">{formState.sku || tr('Auto', 'Авто', 'Avto')}</p>
                  </Card>
                  <Card className="bg-[linear-gradient(135deg,rgba(236,242,255,0.96)_0%,rgba(255,255,255,1)_100%)]">
                    <p className="text-xs uppercase tracking-[0.2em] text-[#355cbb]">{tr('Updated', 'Обновлено', 'Yangilangan')}</p>
                    <p className="mt-2 text-base font-semibold text-[#1f2933]">
                      {editing ? formatUpdatedAt(editing.updated_at) : tr('Not saved yet', 'Ещё не сохранено', 'Hali saqlanmagan')}
                    </p>
                  </Card>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Card>
                    <p className="text-xs uppercase tracking-[0.2em] text-[#40635b]">{t('price')}</p>
                    <p className="mt-2 text-xl font-semibold text-[#1f2933]">{editorPrice.toLocaleString()} UZS</p>
                  </Card>
                  <Card>
                    <p className="text-xs uppercase tracking-[0.2em] text-[#5a6d7c]">{t('stock')}</p>
                    <p className="mt-2 text-xl font-semibold text-[#1f2933]">{editorStock}</p>
                  </Card>
                </div>

                <Card className="space-y-4">
                  <div className="flex flex-wrap items-center gap-2">
                    {availabilityBadge(editorStatus)}
                    {formState.is_active ? null : <Badge variant="default">{tr('Inactive', 'Неактивный', 'Nofaol')}</Badge>}
                    {formState.requires_returnable_bottle ? <Badge variant="info">{tr('Returnable bottle', 'Возвратная тара', 'Qaytariladigan idish')}</Badge> : null}
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-500">{tr('Size', 'Размер', 'Hajm')}</p>
                      <p className="mt-1 font-semibold text-[#1f2933]">{formState.size_liters || '-'}L</p>
                    </div>
                    <div>
                      <p className="text-gray-500">{tr('Min threshold', 'Минимальный порог', 'Minimal chegara')}</p>
                      <p className="mt-1 font-semibold text-[#1f2933]">{editorMinThreshold}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">{tr('Bottle deposit', 'Депозит за бутыль', 'Idish depoziti')}</p>
                      <p className="mt-1 font-semibold text-[#1f2933]">
                        {formState.requires_returnable_bottle ? `${editorDeposit.toLocaleString()} UZS` : tr('Not required', 'Не требуется', 'Talab qilinmaydi')}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500">{tr('Photos', 'Фото', 'Rasmlar')}</p>
                      <p className="mt-1 font-semibold text-[#1f2933]">{editorMediaCount}</p>
                    </div>
                  </div>
                </Card>

                <div className="rounded-2xl border border-light-border bg-[rgba(248,252,251,0.88)] px-4 py-3 text-sm text-[#4b5663]">
                  {tr('Review changes, then save the product.', 'Проверьте изменения и сохраните товар.', "O'zgarishlarni tekshiring va mahsulotni saqlang.")}
                </div>
              </div>
            </section>
          </div>

          <div className="flex justify-end gap-3 border-t border-light-border pt-4 dark:border-navy-700">
            <button type="button" onClick={closeEditor} className="rounded-lg px-4 py-2 text-sm text-gray-600 transition hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-navy-700">{t('cancel')}</button>
            <button disabled={saving} type="submit" className="rounded-lg bg-primary-blue px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-600 disabled:opacity-50">
              {saving ? tr('Saving...', 'Сохранение...', 'Saqlanmoqda...') : t('save')}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={Boolean(detailProduct)}
        onClose={closeDetail}
        title={detailProduct?.name || tr('Product detail', 'Детали товара', 'Mahsulot tafsiloti')}
        footer={null}
        maxWidthClass="max-w-5xl"
      >
        {detailProduct ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.1fr_1fr]">
              <div className="space-y-4">
                <div className="overflow-hidden rounded-[28px] bg-[linear-gradient(145deg,#21404d_0%,#3d6c77_58%,#d9a25f_100%)] shadow-[0_24px_48px_rgba(33,64,77,0.18)]">
                  <div className="relative aspect-[16/11] w-full">
                    {detailMedia.length ? (
                      <img src={detailMedia[detailIndex]?.url} alt={detailProduct.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-white">
                        <div className="text-center">
                          <Package size={36} className="mx-auto" />
                          <p className="mt-3 text-xs font-semibold uppercase tracking-[0.22em] text-white/72">{tr('No product photo', 'Фото товара отсутствует', "Mahsulot rasmi yo'q")}</p>
                        </div>
                      </div>
                    )}
                    {detailMedia.length > 1 ? (
                      <>
                        <button type="button" onClick={() => shiftDetailImage(-1)} className="absolute left-4 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white transition hover:bg-black/55">
                          <ChevronLeft size={18} />
                        </button>
                        <button type="button" onClick={() => shiftDetailImage(1)} className="absolute right-4 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white transition hover:bg-black/55">
                          <ChevronRight size={18} />
                        </button>
                      </>
                    ) : null}
                    <div className="absolute inset-x-0 bottom-0 bg-[linear-gradient(180deg,transparent_0%,rgba(0,0,0,0.66)_100%)] px-5 pb-5 pt-10 text-white">
                      <p className="text-lg font-semibold">{detailProduct.name}</p>
                      <p className="mt-1 text-sm text-white/76">{detailProduct.size_liters}L / {detailMedia.length || 0} {tr('photos', 'фото', 'rasm')}</p>
                    </div>
                  </div>
                </div>

                {detailMedia.length > 1 ? (
                  <div className="grid grid-cols-4 gap-3 sm:grid-cols-5">
                    {detailMedia.map((image, index) => (
                      <button key={`${image.id}-${index}`} type="button" onClick={() => setDetailIndex(index)} className={`overflow-hidden rounded-2xl border transition ${index === detailIndex ? 'border-[#21404d] shadow-[0_10px_20px_rgba(33,64,77,0.14)]' : 'border-light-border hover:border-[#21404d]/40'}`}>
                        <img src={image.thumb_url || image.url} alt={`${detailProduct.name} ${index + 1}`} className="h-20 w-full object-cover" />
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <Card className="bg-[linear-gradient(135deg,rgba(255,247,237,0.96)_0%,rgba(255,255,255,1)_100%)]">
                    <p className="text-xs uppercase tracking-[0.2em] text-[#9a6b3a]">SKU</p>
                    <p className="mt-2 text-base font-semibold text-[#1f2933]">{detailProduct.sku || '-'}</p>
                  </Card>
                  <Card className="bg-[linear-gradient(135deg,rgba(236,242,255,0.96)_0%,rgba(255,255,255,1)_100%)]">
                    <p className="text-xs uppercase tracking-[0.2em] text-[#355cbb]">{tr('Updated', 'Обновлено', 'Yangilangan')}</p>
                    <p className="mt-2 text-base font-semibold text-[#1f2933]">{formatUpdatedAt(detailProduct.updated_at)}</p>
                  </Card>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Card>
                    <p className="text-xs uppercase tracking-[0.2em] text-[#40635b]">{t('price')}</p>
                    <p className="mt-2 text-xl font-semibold text-[#1f2933]">{detailProduct.price_uzs.toLocaleString()} UZS</p>
                  </Card>
                  <Card>
                    <p className="text-xs uppercase tracking-[0.2em] text-[#5a6d7c]">{t('stock')}</p>
                    <p className="mt-2 text-xl font-semibold text-[#1f2933]">{detailProduct.count}</p>
                  </Card>
                </div>

                <Card className="space-y-4">
                  <div className="flex flex-wrap items-center gap-2">
                    {availabilityBadge(detailProduct.availability_status)}
                    {detailProduct.is_active ? null : <Badge variant="default">{tr('Inactive', 'Неактивный', 'Nofaol')}</Badge>}
                    {detailProduct.requires_returnable_bottle ? <Badge variant="info">{tr('Returnable bottle', 'Возвратная тара', 'Qaytariladigan idish')}</Badge> : null}
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-500">{tr('Size', 'Размер', 'Hajm')}</p>
                      <p className="mt-1 font-semibold text-[#1f2933]">{detailProduct.size_liters || '-'}L</p>
                    </div>
                    <div>
                      <p className="text-gray-500">{tr('Min threshold', 'Минимальный порог', 'Minimal chegara')}</p>
                      <p className="mt-1 font-semibold text-[#1f2933]">{detailProduct.min_stock_threshold}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">{tr('Bottle deposit', 'Депозит за бутыль', 'Idish depoziti')}</p>
                      <p className="mt-1 font-semibold text-[#1f2933]">
                        {detailProduct.requires_returnable_bottle ? `${detailProduct.bottle_deposit_uzs.toLocaleString()} UZS` : tr('Not required', 'Не требуется', 'Talab qilinmaydi')}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500">{tr('Photos', 'Фото', 'Rasmlar')}</p>
                      <p className="mt-1 font-semibold text-[#1f2933]">{detailMedia.length}</p>
                    </div>
                  </div>
                </Card>

                <div className="rounded-2xl border border-light-border bg-[rgba(248,252,251,0.88)] px-4 py-4 text-sm text-[#4b5663]">
                  {tr(
                    'This modal is for quick product review. Use edit if you need to change stock, price, bottle rules, or images.',
                    'Это окно для быстрого просмотра товара. Для изменения остатков, цены, правил тары или изображений используйте редактирование.',
                    'Bu oyna mahsulotni tez ko‘rish uchun. Qoldiq, narx, idish qoidalari yoki rasmlarni o‘zgartirish kerak bo‘lsa, tahrirlashdan foydalaning.'
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </Modal>

      <Card className="border-amber-200 bg-amber-50/70 dark:border-amber-800/40 dark:bg-navy-800">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 text-amber-500" size={18} />
          <p className="text-xs text-amber-800 dark:text-amber-200">
            {tr(
              'Product deletion endpoint is not present. Delete now deactivates the product with is_active=false via PATCH /products/{id}/.',
              'Эндпоинт удаления товара отсутствует. Кнопка удаления теперь деактивирует товар через PATCH /products/{id}/ с is_active=false.',
              "Mahsulotni o'chirish endpointi yo'q. O'chirish tugmasi endi PATCH /products/{id}/ orqali is_active=false qilib nofaol qiladi."
            )}
          </p>
        </div>
      </Card>
    </div>
  );
};

export default Products;
