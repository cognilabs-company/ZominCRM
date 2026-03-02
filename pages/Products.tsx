import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ChevronLeft, ChevronRight, Edit2, Eye, ImagePlus, Images, Link2, Package, Plus, Search, Trash2, X } from 'lucide-react';
import { Badge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';
import { Modal } from '../components/ui/Modal';
import { useLanguage } from '../context/LanguageContext';
import { useToast } from '../context/ToastContext';
import { ENDPOINTS, apiRequest } from '../services/api';

interface ApiProductImage {
  id: string;
  url: string;
  sort_order?: number;
  created_at?: string | null;
}

interface ApiProduct {
  id: string;
  name: string;
  sku: string;
  image_url?: string | null;
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

type ProductFormState = {
  name: string;
  sku: string;
  image_url: string;
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
  image_url: '',
  size_liters: '',
  price_uzs: '0',
  count: '0',
  min_stock_threshold: '5',
  requires_returnable_bottle: false,
  bottle_deposit_uzs: '0',
  is_active: true,
};

const getPrimaryImage = (product?: Pick<ApiProduct, 'image_url' | 'images'> | null) =>
  product?.image_url || product?.images?.[0]?.url || null;

const getProductMedia = (product?: Pick<ApiProduct, 'image_url' | 'images'> | null) => {
  const media: ApiProductImage[] = [];
  const seen = new Set<string>();

  if (product?.image_url && !seen.has(product.image_url)) {
    seen.add(product.image_url);
    media.push({ id: 'primary-image', url: product.image_url });
  }

  (product?.images || []).forEach((image) => {
    if (!image.url || seen.has(image.url)) return;
    seen.add(image.url);
    media.push(image);
  });

  return media;
};

const ProductThumbnail: React.FC<{
  product?: Pick<ApiProduct, 'name' | 'size_liters' | 'image_url' | 'images'> | null;
  fallbackLabel: string;
  badgeLabel?: string | null;
  className?: string;
}> = ({ product, fallbackLabel, badgeLabel, className = 'h-16 w-16 rounded-[20px]' }) => {
  const [imageFailed, setImageFailed] = useState(false);
  const imageUrl = imageFailed ? null : getPrimaryImage(product);

  useEffect(() => {
    setImageFailed(false);
  }, [product?.image_url, product?.images]);

  return (
    <div className={`relative overflow-hidden border border-white/70 bg-[linear-gradient(145deg,#21404d_0%,#3d6c77_58%,#d9a25f_100%)] shadow-[0_12px_24px_rgba(33,64,77,0.16)] ${className}`}>
      {imageUrl ? (
        <img src={imageUrl} alt={product?.name || fallbackLabel} className="h-full w-full object-cover" onError={() => setImageFailed(true)} />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-white">
          <div className="text-center">
            <Package size={22} className="mx-auto" />
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/72">{fallbackLabel}</p>
          </div>
        </div>
      )}
      <div className="absolute inset-x-0 bottom-0 bg-[linear-gradient(180deg,transparent_0%,rgba(0,0,0,0.62)_100%)] px-2 pb-2 pt-5 text-[10px] font-semibold text-white">
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
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<ApiProduct | null>(null);
  const [formState, setFormState] = useState<ProductFormState>(emptyForm);
  const [primaryImageFile, setPrimaryImageFile] = useState<File | null>(null);
  const [galleryFiles, setGalleryFiles] = useState<File[]>([]);
  const [primaryPreviewUrl, setPrimaryPreviewUrl] = useState<string | null>(null);
  const [galleryPreviewUrls, setGalleryPreviewUrls] = useState<string[]>([]);
  const [removeImage, setRemoveImage] = useState(false);
  const [removeImageIds, setRemoveImageIds] = useState<string[]>([]);
  const [replaceGallery, setReplaceGallery] = useState(false);
  const primaryInputRef = useRef<HTMLInputElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);
  const [galleryPreviewProduct, setGalleryPreviewProduct] = useState<ApiProduct | null>(null);
  const [galleryPreviewIndex, setGalleryPreviewIndex] = useState(0);

  const loadProducts = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (search.trim()) params.set('q', search.trim());
      if (onlyLowStock) params.set('low_stock', 'true');
      const query = params.toString() ? `?${params.toString()}` : '';
      const response = await apiRequest<{ results?: ApiProduct[] }>(`${ENDPOINTS.PRODUCTS.LIST_CREATE}${query}`);
      setProducts(response.results || []);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : tr('Failed to load products', 'Не удалось загрузить товары', 'Mahsulotlarni yuklab bo\'lmadi');
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
    if (!primaryImageFile) {
      setPrimaryPreviewUrl(null);
      return;
    }
    const objectUrl = URL.createObjectURL(primaryImageFile);
    setPrimaryPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [primaryImageFile]);

  useEffect(() => {
    if (!galleryFiles.length) {
      setGalleryPreviewUrls([]);
      return;
    }
    const objectUrls = galleryFiles.map((file) => URL.createObjectURL(file));
    setGalleryPreviewUrls(objectUrls);
    return () => objectUrls.forEach((url) => URL.revokeObjectURL(url));
  }, [galleryFiles]);

  useEffect(() => {
    if (!editing) {
      setFormState(emptyForm);
      setPrimaryImageFile(null);
      setGalleryFiles([]);
      setRemoveImage(false);
      setRemoveImageIds([]);
      setReplaceGallery(false);
      return;
    }
    setFormState({
      name: editing.name || '',
      sku: editing.sku || '',
      image_url: editing.image_url || '',
      size_liters: editing.size_liters || '',
      price_uzs: String(editing.price_uzs ?? 0),
      count: String(editing.count ?? 0),
      min_stock_threshold: String(editing.min_stock_threshold ?? 5),
      requires_returnable_bottle: Boolean(editing.requires_returnable_bottle),
      bottle_deposit_uzs: String(editing.bottle_deposit_uzs ?? 0),
      is_active: editing.is_active !== false,
    });
    setPrimaryImageFile(null);
    setGalleryFiles([]);
    setRemoveImage(false);
    setRemoveImageIds([]);
    setReplaceGallery(false);
  }, [editing]);

  const existingGalleryImages = useMemo(
    () => (replaceGallery ? [] : (editing?.images || []).filter((image) => !removeImageIds.includes(image.id))),
    [editing?.images, removeImageIds, replaceGallery]
  );

  const displayPrimaryImage = useMemo(() => {
    if (primaryPreviewUrl) return primaryPreviewUrl;
    if (removeImage) return null;
    return getPrimaryImage(editing);
  }, [editing, primaryPreviewUrl, removeImage]);

  const productStats = useMemo(() => ({
    active: products.filter((product) => product.is_active !== false).length,
    lowStock: products.filter((product) => product.availability_status === 'low_stock').length,
    withPhotos: products.filter((product) => getPrimaryImage(product)).length,
  }), [products]);

  const galleryPreviewMedia = useMemo(() => getProductMedia(galleryPreviewProduct), [galleryPreviewProduct]);

  const resetImageInputs = () => {
    if (primaryInputRef.current) primaryInputRef.current.value = '';
    if (galleryInputRef.current) galleryInputRef.current.value = '';
  };

  const openCreate = () => {
    setEditing(null);
    setFormState(emptyForm);
    setPrimaryImageFile(null);
    setGalleryFiles([]);
    setRemoveImage(false);
    setRemoveImageIds([]);
    setReplaceGallery(false);
    resetImageInputs();
    setIsModalOpen(true);
  };

  const openEdit = (product: ApiProduct) => {
    setEditing(product);
    resetImageInputs();
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditing(null);
    setFormState(emptyForm);
    setPrimaryImageFile(null);
    setGalleryFiles([]);
    setRemoveImage(false);
    setRemoveImageIds([]);
    setReplaceGallery(false);
    resetImageInputs();
  };

  const openGalleryPreview = (product: ApiProduct, startIndex = 0) => {
    const media = getProductMedia(product);
    if (!media.length) return;
    setGalleryPreviewProduct(product);
    setGalleryPreviewIndex(Math.min(Math.max(startIndex, 0), media.length - 1));
  };

  const closeGalleryPreview = () => {
    setGalleryPreviewProduct(null);
    setGalleryPreviewIndex(0);
  };

  const shiftGalleryPreview = (direction: number) => {
    if (!galleryPreviewMedia.length) return;
    setGalleryPreviewIndex((current) => (current + direction + galleryPreviewMedia.length) % galleryPreviewMedia.length);
  };

  const availabilityBadge = (status: ApiProduct['availability_status']) => {
    if (status === 'in_stock') return <Badge variant="success">{tr('In stock', 'В наличии', 'Mavjud')}</Badge>;
    if (status === 'low_stock') return <Badge variant="warning">{tr('Low stock', 'Мало осталось', 'Kam qolgan')}</Badge>;
    return <Badge variant="error">{tr('Out of stock', 'Нет в наличии', 'Tugagan')}</Badge>;
  };

  const handleSearch = (event: React.FormEvent) => {
    event.preventDefault();
    void loadProducts();
  };

  const handleSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const hasMultipartChanges = Boolean(primaryImageFile || galleryFiles.length || removeImage || removeImageIds.length || replaceGallery);

    try {
      setSaving(true);
      setError(null);

      if (hasMultipartChanges) {
        const payload = new FormData();
        payload.append('name', formState.name.trim());
        payload.append('sku', formState.sku.trim());
        payload.append('size_liters', formState.size_liters.trim());
        payload.append('price_uzs', String(Number(formState.price_uzs || 0)));
        payload.append('count', String(Number(formState.count || 0)));
        payload.append('min_stock_threshold', String(Number(formState.min_stock_threshold || 5)));
        payload.append('requires_returnable_bottle', String(formState.requires_returnable_bottle));
        payload.append('bottle_deposit_uzs', String(formState.requires_returnable_bottle ? Number(formState.bottle_deposit_uzs || 0) : 0));
        payload.append('is_active', String(formState.is_active));
        payload.append('actor', 'frontend-ui');

        if (formState.image_url.trim() && !primaryImageFile && !removeImage) payload.append('image_url', formState.image_url.trim());
        if (primaryImageFile) payload.append('image', primaryImageFile);
        galleryFiles.forEach((file) => payload.append('images', file));
        if (replaceGallery) payload.append('replace_images', 'true');
        if (removeImage) payload.append('remove_image', 'true');
        if (removeImageIds.length) payload.append('remove_image_ids', JSON.stringify(removeImageIds));

        await apiRequest(editing ? ENDPOINTS.PRODUCTS.DETAIL(editing.id) : ENDPOINTS.PRODUCTS.LIST_CREATE, {
          method: editing ? 'PATCH' : 'POST',
          body: payload,
        });
      } else {
        const payload = {
          name: formState.name.trim(),
          sku: formState.sku.trim(),
          image_url: formState.image_url.trim() || null,
          size_liters: formState.size_liters.trim(),
          price_uzs: Number(formState.price_uzs || 0),
          count: Number(formState.count || 0),
          min_stock_threshold: Number(formState.min_stock_threshold || 5),
          requires_returnable_bottle: formState.requires_returnable_bottle,
          bottle_deposit_uzs: formState.requires_returnable_bottle ? Number(formState.bottle_deposit_uzs || 0) : 0,
          is_active: formState.is_active,
          actor: 'frontend-ui',
        };

        await apiRequest(editing ? ENDPOINTS.PRODUCTS.DETAIL(editing.id) : ENDPOINTS.PRODUCTS.LIST_CREATE, {
          method: editing ? 'PATCH' : 'POST',
          body: JSON.stringify(payload),
        });
      }

      closeModal();
      await loadProducts();
      toast.success(editing ? tr('Product updated.', 'Товар обновлен.', 'Mahsulot yangilandi.') : tr('Product created.', 'Товар создан.', 'Mahsulot yaratildi.'));
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : tr('Failed to save product', 'Не удалось сохранить товар', 'Mahsulotni saqlab bo\'lmadi');
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
      const message = deactivateError instanceof Error ? deactivateError.message : tr('Failed to deactivate product', 'Не удалось деактивировать товар', 'Mahsulotni nofaol qilib bo\'lmadi');
      setError(message);
      toast.error(message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-light-text dark:text-white">{t('nav_products')}</h1>
          <p className="mt-2 max-w-2xl text-sm text-gray-500 dark:text-gray-400">
            {tr(
              'Manage catalog stock, pricing, and product photography from one place.',
              'Управляйте остатками, ценами и фотографиями товаров в одном месте.',
              'Katalog qoldigi, narx va mahsulot rasmlarini bitta oynada boshqaring.'
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
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#9a6b3a]">{tr('Catalog size', 'Размер каталога', 'Katalog hajmi')}</p>
          <p className="mt-3 text-3xl font-semibold text-[#1f2933]">{products.length}</p>
          <p className="mt-2 text-sm text-[#5b6770]">{tr('Total product records in the admin catalog.', 'Всего карточек товаров в админ-каталоге.', 'Admin katalogidagi jami mahsulot kartalari.')}</p>
        </Card>
        <Card className="bg-[linear-gradient(135deg,rgba(232,241,238,0.94)_0%,rgba(255,255,255,1)_100%)]">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#40635b]">{tr('Active / low stock', 'Активные / мало', 'Faol / kam')}</p>
          <p className="mt-3 text-3xl font-semibold text-[#1f2933]">{productStats.active} / {productStats.lowStock}</p>
          <p className="mt-2 text-sm text-[#5b6770]">{tr('Quick view of active products and low stock risks.', 'Быстрый обзор активных товаров и рисков по остаткам.', 'Faol mahsulotlar va kam qolganlar bo‘yicha tezkor korinish.')}</p>
        </Card>
        <Card className="bg-[linear-gradient(135deg,rgba(236,242,255,0.94)_0%,rgba(255,255,255,1)_100%)]">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#355cbb]">{tr('Photo coverage', 'Фото-покрытие', 'Rasm qamrovi')}</p>
          <p className="mt-3 text-3xl font-semibold text-[#1f2933]">{productStats.withPhotos}</p>
          <p className="mt-2 text-sm text-[#5b6770]">{tr('Products that already have a visible primary image.', 'Товары, у которых уже есть видимое главное изображение.', 'Hozirning ozida korinadigan asosiy rasmga ega mahsulotlar.')}</p>
        </Card>
      </div>

      {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

      <Card className="!p-0 overflow-hidden">
        <form onSubmit={handleSearch} className="border-b border-light-border bg-white p-4 dark:border-navy-700 dark:bg-navy-800">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-white">{tr('Products catalog', 'Каталог товаров', 'Mahsulotlar katalogi')}</p>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {tr('Professional product cards with media, price, stock, and deposit status.', 'Профессиональные карточки товара с медиа, ценой, остатком и статусом депозита.', 'Media, narx, qoldiq va depozit holati bilan professional mahsulot kartalari.')}
              </p>
            </div>
            <div className="flex flex-col gap-3 md:flex-row md:items-center">
              <label className="inline-flex items-center gap-2 rounded-lg border border-light-border bg-gray-50 px-3 py-2 text-sm text-gray-700 dark:border-navy-600 dark:bg-navy-900 dark:text-gray-300">
                <input type="checkbox" checked={onlyLowStock} onChange={(event) => setOnlyLowStock(event.target.checked)} />
                {tr('Low stock only', 'Только с низким остатком', 'Faqat kam qolganlar')}
              </label>
              <div className="relative min-w-[18rem]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input type="text" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={`${t('search')}...`} className="w-full rounded-lg border border-light-border bg-gray-50 py-2 pl-10 pr-4 text-sm text-gray-900 outline-none focus:border-primary-blue dark:border-navy-600 dark:bg-navy-900 dark:text-white" />
              </div>
            </div>
          </div>
        </form>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-light-border bg-gray-50 text-xs uppercase text-gray-500 dark:border-navy-700 dark:bg-navy-900/50 dark:text-gray-400">
                <th className="px-6 py-4 font-semibold">{t('product_name')}</th>
                <th className="px-6 py-4 font-semibold">SKU</th>
                <th className="px-6 py-4 font-semibold">{tr('Size / media', 'Размер / медиа', 'Hajm / media')}</th>
                <th className="px-6 py-4 font-semibold">{t('price')}</th>
                <th className="px-6 py-4 font-semibold">{t('stock')}</th>
                <th className="px-6 py-4 font-semibold">{tr('Bottle', 'Тара', 'Idish')}</th>
                <th className="px-6 py-4 font-semibold">{tr('State', 'Состояние', 'Holati')}</th>
                <th className="px-6 py-4 font-semibold text-right">{t('actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-light-border dark:divide-navy-700">
              {loading ? (
                <tr><td colSpan={8} className="py-10 text-center text-gray-400">{tr('Loading products...', 'Загрузка товаров...', 'Mahsulotlar yuklanmoqda...')}</td></tr>
              ) : products.length === 0 ? (
                <tr><td colSpan={8} className="py-10 text-center text-gray-400">{tr('No products found.', 'Товары не найдены.', 'Mahsulotlar topilmadi.')}</td></tr>
              ) : (
                products.map((product) => {
                  const mediaCount = (product.images?.length || 0) || (getPrimaryImage(product) ? 1 : 0);
                  return (
                    <tr key={product.id} className="transition-colors hover:bg-gray-50 dark:hover:bg-navy-700/40">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-4">
                          {mediaCount > 0 ? (
                            <button type="button" onClick={() => openGalleryPreview(product)} className="rounded-[24px] text-left transition-transform hover:scale-[1.02]">
                              <ProductThumbnail product={product} fallbackLabel={tr('No photo', 'Нет фото', 'Rasm yoq')} badgeLabel={mediaCount > 0 ? String(mediaCount) : null} />
                            </button>
                          ) : (
                            <ProductThumbnail product={product} fallbackLabel={tr('No photo', 'Нет фото', 'Rasm yoq')} badgeLabel={null} />
                          )}
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-gray-900 dark:text-white">{product.name}</p>
                            <p className="mt-1 text-xs text-gray-500">{product.id.slice(0, 8)}</p>
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${getPrimaryImage(product) ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}>
                                <ImagePlus size={12} />
                                {getPrimaryImage(product) ? tr('Photo ready', 'Фото готово', 'Rasm tayyor') : tr('Need photo', 'Нужно фото', 'Rasm kerak')}
                              </span>
                              {mediaCount > 1 ? <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700 dark:bg-amber-900/20 dark:text-amber-300"><Images size={12} />{mediaCount}</span> : null}
                              {mediaCount > 0 ? (
                                <button
                                  type="button"
                                  onClick={() => openGalleryPreview(product)}
                                  className="inline-flex items-center gap-1 rounded-full bg-[#eef4ff] px-2.5 py-1 text-[11px] font-semibold text-[#355cbb] transition hover:bg-[#dbe7ff]"
                                >
                                  <Eye size={12} />
                                  {tr('Preview', 'Просмотр', 'Ko‘rish')}
                                </button>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">{product.sku || '-'}</td>
                      <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">
                        <p>{product.size_liters || '-'}L</p>
                        <p className="mt-1 text-xs text-gray-500">{mediaCount > 1 ? tr(`${mediaCount} media items`, `${mediaCount} медиа`, `${mediaCount} ta media`) : getPrimaryImage(product) ? tr('Primary media only', 'Только основное медиа', 'Faqat asosiy media') : tr('No media yet', 'Медиа пока нет', 'Hali media yoq')}</p>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <p className="font-semibold text-gray-900 dark:text-white">{product.price_uzs.toLocaleString()} UZS</p>
                        {product.requires_returnable_bottle ? <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">{product.bottle_deposit_uzs.toLocaleString()} UZS {tr('deposit', 'депозит', 'depozit')}</p> : <p className="mt-1 text-xs text-gray-500">{tr('No deposit', 'Без депозита', 'Depozitsiz')}</p>}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300"><p>{product.count}</p><p className="mt-1 text-xs text-gray-500">{tr('Min threshold', 'Минимум', 'Minimal')}: {product.min_stock_threshold}</p></td>
                      <td className="px-6 py-4 text-sm">{product.requires_returnable_bottle ? <Badge variant="info">{tr('Returnable', 'Возвратная', 'Qaytariladigan')}</Badge> : <Badge variant="default">{tr('No bottle', 'Без тары', 'Idishsiz')}</Badge>}</td>
                      <td className="px-6 py-4"><div className="flex flex-wrap items-center gap-2">{availabilityBadge(product.availability_status)}{product.is_active === false ? <Badge variant="default">{tr('Inactive', 'Неактивный', 'Nofaol')}</Badge> : null}</div></td>
                      <td className="px-6 py-4 text-right"><div className="flex justify-end gap-2"><button type="button" onClick={() => openEdit(product)} className="p-1.5 text-gray-500 transition-colors hover:text-primary-blue dark:text-gray-300 dark:hover:text-blue-400"><Edit2 size={16} /></button><button type="button" onClick={() => void handleDeactivate(product)} className="p-1.5 text-gray-500 transition-colors hover:text-red-500 dark:text-gray-300 dark:hover:text-red-400"><Trash2 size={16} /></button></div></td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal isOpen={isModalOpen} onClose={closeModal} title={editing ? tr('Edit Product', 'Редактировать товар', 'Mahsulotni tahrirlash') : tr('Add New Product', 'Добавить товар', 'Yangi mahsulot qo\'shish')} footer={null} maxWidthClass="max-w-5xl">
        <form onSubmit={handleSave} className="space-y-6">
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.05fr_1.35fr]">
            <section className="space-y-4">
              <div className="overflow-hidden rounded-[28px] border border-white/80 bg-[linear-gradient(145deg,#21404d_0%,#3d6c77_58%,#d9a25f_100%)] shadow-[0_24px_48px_rgba(33,64,77,0.18)]">
                <div className="relative h-72 w-full">
                  {displayPrimaryImage ? (
                    <>
                      <img src={displayPrimaryImage} alt={formState.name || 'Product preview'} className="h-full w-full object-cover" />
                      {editing ? (
                        <button
                          type="button"
                          onClick={() => openGalleryPreview(editing)}
                          className="absolute right-4 top-4 inline-flex items-center gap-2 rounded-full bg-black/45 px-3 py-2 text-xs font-semibold text-white transition hover:bg-black/60"
                        >
                          <Eye size={14} />
                          {tr('Open gallery', 'Открыть галерею', 'Galereyani ochish')}
                        </button>
                      ) : null}
                    </>
                  ) : <div className="absolute inset-0 flex items-center justify-center text-white"><div className="text-center"><Package size={34} className="mx-auto" /><p className="mt-3 text-xs font-semibold uppercase tracking-[0.22em] text-white/72">{tr('No primary photo', 'Нет главного фото', 'Asosiy rasm yoq')}</p></div></div>}
                  <div className="absolute inset-x-0 bottom-0 bg-[linear-gradient(180deg,transparent_0%,rgba(0,0,0,0.66)_100%)] px-5 pb-5 pt-12 text-white"><p className="text-lg font-semibold">{formState.name || tr('New product', 'Новый товар', 'Yangi mahsulot')}</p><p className="mt-1 text-sm text-white/76">{formState.size_liters || '-'}L · {(existingGalleryImages.length + galleryFiles.length) || 0} {tr('media items', 'медиа', 'media')}</p></div>
                </div>
              </div>

              <label className="cursor-pointer rounded-2xl border border-dashed border-[#c9b39a] bg-white/70 px-4 py-4 text-sm text-gray-700 shadow-sm transition hover:border-[#21404d]">
                <span className="flex items-center gap-2 font-semibold text-[#21404d]"><ImagePlus size={16} />{tr('Upload primary image', 'Загрузить главное фото', 'Asosiy rasmni yuklash')}</span>
                <span className="mt-1 block text-xs text-gray-500">{primaryImageFile ? primaryImageFile.name : tr('Choose one image for the main product thumbnail.', 'Выберите одно изображение для главной карточки товара.', 'Asosiy mahsulot kartasi uchun bitta rasm tanlang.')}</span>
                <input ref={primaryInputRef} type="file" accept="image/*" className="hidden" onChange={(event) => setPrimaryImageFile(event.target.files?.[0] || null)} />
              </label>

              <div className="rounded-2xl border border-light-border bg-white/70 p-4 shadow-sm dark:border-navy-700 dark:bg-navy-900/40">
                <div className="flex items-center justify-between gap-3">
                  <div><p className="text-sm font-semibold text-gray-900 dark:text-white">{tr('Gallery', 'Галерея', 'Galereya')}</p><p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{tr('Add multiple supporting photos like Shopify-style media galleries.', 'Добавляйте несколько фото как в галереях популярных платформ.', 'Mashhur platformalardagi kabi bir nechta qoshimcha rasmlar qoshing.')}</p></div>
                  <label className="cursor-pointer rounded-xl bg-[#21404d] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#1a3340]">{tr('Add photos', 'Добавить фото', 'Rasm qo\'shish')}<input ref={galleryInputRef} type="file" accept="image/*" multiple className="hidden" onChange={(event) => setGalleryFiles(Array.from(event.target.files || []))} /></label>
                </div>
                {editing?.images?.length ? <label className="mt-4 inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"><input type="checkbox" checked={replaceGallery} onChange={(event) => { setReplaceGallery(event.target.checked); if (event.target.checked) setRemoveImageIds([]); }} />{tr('Replace entire gallery on save', 'Полностью заменить галерею при сохранении', 'Saqlashda butun galereyani almashtirish')}</label> : null}
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {existingGalleryImages.map((image, index) => <div key={image.id} className="group relative overflow-hidden rounded-2xl border border-light-border bg-gray-50 shadow-sm dark:border-navy-700 dark:bg-navy-800"><button type="button" onClick={() => editing ? openGalleryPreview(editing, Math.min(index + (editing.image_url ? 1 : 0), getProductMedia(editing).length - 1)) : undefined} className="block h-24 w-full"><img src={image.url} alt={formState.name || 'Gallery image'} className="h-24 w-full object-cover" /></button><button type="button" onClick={() => setRemoveImageIds((current) => current.includes(image.id) ? current : [...current, image.id])} className="absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition group-hover:opacity-100"><X size={14} /></button></div>)}
                  {galleryPreviewUrls.map((url, index) => <div key={`${url}-${index}`} className="group relative overflow-hidden rounded-2xl border border-primary-blue/30 bg-blue-50 shadow-sm"><img src={url} alt={`Upload ${index + 1}`} className="h-24 w-full object-cover" /><button type="button" onClick={() => setGalleryFiles((current) => current.filter((_, fileIndex) => fileIndex !== index))} className="absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition group-hover:opacity-100"><X size={14} /></button></div>)}
                  {!existingGalleryImages.length && !galleryPreviewUrls.length ? <div className="col-span-full rounded-2xl border border-dashed border-light-border bg-gray-50 px-4 py-6 text-center text-sm text-gray-500 dark:border-navy-700 dark:bg-navy-900/40">{tr('No gallery photos yet.', 'Пока нет фото галереи.', 'Hali galereya rasmlari yoq.')}</div> : null}
                </div>
              </div>

              <div className="rounded-2xl border border-light-border bg-white/70 p-4 shadow-sm dark:border-navy-700 dark:bg-navy-900/40">
                <div className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white"><Link2 size={15} className="text-[#21404d]" />{tr('External image URL', 'Внешний URL изображения', 'Tashqi rasm URL')}</div>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{tr('Optional fallback if you want to use an existing CDN image instead of uploading files.', 'Необязательный вариант, если хотите использовать готовый CDN URL вместо загрузки файлов.', 'Fayl yuklash orniga tayyor CDN rasmidan foydalanmoqchi bolsangiz, ixtiyoriy variant.')}</p>
                <input value={formState.image_url} onChange={(event) => setFormState((current) => ({ ...current, image_url: event.target.value }))} placeholder="https://cdn.example.com/product.png" className="mt-3 w-full rounded-lg border border-light-border bg-gray-50 px-3 py-2 text-sm text-gray-900 outline-none focus:border-primary-blue dark:border-navy-600 dark:bg-navy-900 dark:text-white" />
              </div>

              {primaryImageFile ? <button type="button" onClick={() => { setPrimaryImageFile(null); if (primaryInputRef.current) primaryInputRef.current.value = ''; }} className="inline-flex items-center gap-2 text-sm font-medium text-rose-600 transition hover:text-rose-700"><X size={14} />{tr('Remove selected primary file', 'Убрать выбранный главный файл', 'Tanlangan asosiy faylni olib tashlash')}</button> : null}
              {editing && getPrimaryImage(editing) ? <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"><input type="checkbox" checked={removeImage} onChange={(event) => setRemoveImage(event.target.checked)} />{tr('Remove current primary image on save', 'Удалить текущее главное изображение при сохранении', 'Saqlashda joriy asosiy rasmni olib tashlash')}</label> : null}
            </section>

            <section className="space-y-5">
              <div className="rounded-2xl border border-light-border bg-white/70 p-5 shadow-sm dark:border-navy-700 dark:bg-navy-900/40">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="md:col-span-2"><label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">{t('product_name')}</label><input value={formState.name} onChange={(event) => setFormState((current) => ({ ...current, name: event.target.value }))} required className="w-full rounded-lg border border-light-border bg-gray-50 px-3 py-2 text-sm text-gray-900 outline-none focus:border-primary-blue dark:border-navy-600 dark:bg-navy-900 dark:text-white" /></div>
                  <div><label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">SKU</label><input value={formState.sku} onChange={(event) => setFormState((current) => ({ ...current, sku: event.target.value }))} placeholder={tr('Leave empty to auto-generate', 'Оставьте пустым для автогенерации', 'Avto yaratish uchun bosh qoldiring')} className="w-full rounded-lg border border-light-border bg-gray-50 px-3 py-2 text-sm text-gray-900 outline-none focus:border-primary-blue dark:border-navy-600 dark:bg-navy-900 dark:text-white" /></div>
                  <div><label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">{tr('Size liters', 'Объем (литр)', 'Hajmi (litr)')}</label><input value={formState.size_liters} onChange={(event) => setFormState((current) => ({ ...current, size_liters: event.target.value }))} required className="w-full rounded-lg border border-light-border bg-gray-50 px-3 py-2 text-sm text-gray-900 outline-none focus:border-primary-blue dark:border-navy-600 dark:bg-navy-900 dark:text-white" /></div>
                  <div><label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">{t('price')} (UZS)</label><input type="number" min="0" value={formState.price_uzs} onChange={(event) => setFormState((current) => ({ ...current, price_uzs: event.target.value }))} required className="w-full rounded-lg border border-light-border bg-gray-50 px-3 py-2 text-sm text-gray-900 outline-none focus:border-primary-blue dark:border-navy-600 dark:bg-navy-900 dark:text-white" /></div>
                  <div><label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">{t('stock')}</label><input type="number" min="0" value={formState.count} onChange={(event) => setFormState((current) => ({ ...current, count: event.target.value }))} required className="w-full rounded-lg border border-light-border bg-gray-50 px-3 py-2 text-sm text-gray-900 outline-none focus:border-primary-blue dark:border-navy-600 dark:bg-navy-900 dark:text-white" /></div>
                  <div><label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">{tr('Min threshold', 'Минимальный порог', 'Minimal chegara')}</label><input type="number" min="0" value={formState.min_stock_threshold} onChange={(event) => setFormState((current) => ({ ...current, min_stock_threshold: event.target.value }))} required className="w-full rounded-lg border border-light-border bg-gray-50 px-3 py-2 text-sm text-gray-900 outline-none focus:border-primary-blue dark:border-navy-600 dark:bg-navy-900 dark:text-white" /></div>
                  <div><label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">{tr('Bottle deposit (UZS)', 'Депозит за тару (UZS)', 'Idish depoziti (UZS)')}</label><input type="number" min="0" value={formState.bottle_deposit_uzs} onChange={(event) => setFormState((current) => ({ ...current, bottle_deposit_uzs: event.target.value }))} disabled={!formState.requires_returnable_bottle} className="w-full rounded-lg border border-light-border bg-gray-50 px-3 py-2 text-sm text-gray-900 outline-none focus:border-primary-blue disabled:opacity-50 dark:border-navy-600 dark:bg-navy-900 dark:text-white" /></div>
                </div>
              </div>

              <div className="rounded-2xl border border-light-border bg-white/70 p-5 shadow-sm dark:border-navy-700 dark:bg-navy-900/40">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div><p className="text-sm font-semibold text-gray-900 dark:text-white">{tr('Catalog visibility', 'Видимость в каталоге', 'Katalog korinishi')}</p><p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{tr('Keep product visibility and deposit settings in sync with real stock.', 'Держите видимость товара и депозитные настройки в соответствии с реальным остатком.', 'Mahsulot korinishi va depozit sozlamalarini real qoldiq bilan mos holda boshqaring.')}</p></div>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"><input type="checkbox" checked={formState.requires_returnable_bottle} onChange={(event) => setFormState((current) => ({ ...current, requires_returnable_bottle: event.target.checked, bottle_deposit_uzs: event.target.checked ? current.bottle_deposit_uzs : '0' }))} />{tr('Requires returnable bottle', 'Требует возвратную тару', 'Qaytariladigan idish talab qiladi')}</label>
                    <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"><input type="checkbox" checked={formState.is_active} onChange={(event) => setFormState((current) => ({ ...current, is_active: event.target.checked }))} />{tr('Active', 'Активный', 'Faol')}</label>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-blue-100 bg-blue-50/80 px-4 py-3 text-sm text-blue-800 dark:border-blue-900/40 dark:bg-blue-950/20 dark:text-blue-200">{tr('Use uploads for the best admin and WebApp presentation. External URL mode still works as a fallback when you already have hosted media.', 'Для лучшего вида в админке и WebApp используйте загрузку файлов. Внешний URL все еще подходит как запасной вариант, если медиа уже размещено.', 'Admin va WebApp korinishi uchun fayl yuklash yaxshiroq. Media allaqachon joylangan bolsa, tashqi URL ham zaxira sifatida ishlaydi.')}</div>
            </section>
          </div>

          <div className="flex justify-end gap-3 border-t border-light-border pt-4 dark:border-navy-700"><button type="button" onClick={closeModal} className="rounded-lg px-4 py-2 text-sm text-gray-600 transition hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-navy-700">{t('cancel')}</button><button disabled={saving} type="submit" className="rounded-lg bg-primary-blue px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-600 disabled:opacity-50">{saving ? tr('Saving...', 'Сохранение...', 'Saqlanmoqda...') : t('save')}</button></div>
        </form>
      </Modal>

      <Modal
        isOpen={Boolean(galleryPreviewProduct)}
        onClose={closeGalleryPreview}
        title={galleryPreviewProduct ? `${galleryPreviewProduct.name} · ${galleryPreviewIndex + 1}/${galleryPreviewMedia.length}` : tr('Product gallery', 'Галерея товара', 'Mahsulot galereyasi')}
        footer={null}
        maxWidthClass="max-w-4xl"
      >
        {galleryPreviewMedia.length ? (
          <div className="space-y-4">
            <div className="relative overflow-hidden rounded-[28px] bg-[linear-gradient(145deg,#21404d_0%,#3d6c77_58%,#d9a25f_100%)] shadow-[0_24px_48px_rgba(33,64,77,0.18)]">
              <div className="relative aspect-[16/10] w-full">
                <img
                  src={galleryPreviewMedia[galleryPreviewIndex]?.url}
                  alt={galleryPreviewProduct?.name || 'Product gallery'}
                  className="h-full w-full object-cover"
                />
                {galleryPreviewMedia.length > 1 ? (
                  <>
                    <button
                      type="button"
                      onClick={() => shiftGalleryPreview(-1)}
                      className="absolute left-4 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white transition hover:bg-black/55"
                    >
                      <ChevronLeft size={18} />
                    </button>
                    <button
                      type="button"
                      onClick={() => shiftGalleryPreview(1)}
                      className="absolute right-4 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white transition hover:bg-black/55"
                    >
                      <ChevronRight size={18} />
                    </button>
                  </>
                ) : null}
                <div className="absolute inset-x-0 bottom-0 bg-[linear-gradient(180deg,transparent_0%,rgba(0,0,0,0.66)_100%)] px-5 pb-5 pt-10 text-sm text-white/84">
                  {galleryPreviewMedia.length > 1
                    ? tr(`${galleryPreviewIndex + 1} of ${galleryPreviewMedia.length} media items`, `${galleryPreviewIndex + 1} из ${galleryPreviewMedia.length} медиа`, `${galleryPreviewIndex + 1}/${galleryPreviewMedia.length} media`)
                    : tr('Primary product media', 'Основное медиа товара', 'Asosiy mahsulot mediаsi')}
                </div>
              </div>
            </div>

            {galleryPreviewMedia.length > 1 ? (
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
                {galleryPreviewMedia.map((image, index) => (
                  <button
                    key={`${image.id}-${index}`}
                    type="button"
                    onClick={() => setGalleryPreviewIndex(index)}
                    className={`overflow-hidden rounded-2xl border transition ${
                      index === galleryPreviewIndex
                        ? 'border-[#21404d] shadow-[0_12px_24px_rgba(33,64,77,0.16)]'
                        : 'border-light-border hover:border-[#21404d]/40'
                    }`}
                  >
                    <img src={image.url} alt={`${galleryPreviewProduct?.name || 'Product'} ${index + 1}`} className="h-20 w-full object-cover" />
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </Modal>

      <Card className="border-amber-200 bg-amber-50/70 dark:border-amber-800/40 dark:bg-navy-800">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 text-amber-500" size={18} />
          <p className="text-xs text-amber-800 dark:text-amber-200">{tr('Product deletion endpoint is not present. Delete now deactivates the product with is_active=false via PATCH /products/{id}/.', 'Эндпоинта удаления товара нет. Удаление теперь деактивирует товар через PATCH /products/{id}/ с is_active=false.', 'Mahsulotni ochirish endpointi yoq. Ochirish tugmasi endi PATCH /products/{id}/ orqali is_active=false qilib nofaol qiladi.')}</p>
        </div>
      </Card>
    </div>
  );
};

export default Products;
