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

const getPrimaryImage = (product?: Pick<ApiProduct, 'image_url' | 'image_thumb_url' | 'images'> | null) =>
  resolveAdminMediaUrl(
    product?.image_thumb_url ||
      product?.images?.[0]?.thumb_url ||
      product?.image_url ||
      product?.images?.[0]?.url ||
      null
  );

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
  const [imageFailed, setImageFailed] = useState(false);
  const imageUrl = imageFailed ? null : getPrimaryImage(product);

  useEffect(() => {
    setImageFailed(false);
  }, [product?.image_url, product?.image_thumb_url, product?.images]);

  return (
    <div className={`relative overflow-hidden border border-white/70 bg-[linear-gradient(145deg,#21404d_0%,#3d6c77_58%,#d9a25f_100%)] shadow-[0_12px_24px_rgba(33,64,77,0.16)] ${className}`}>
      {imageUrl ? (
        <img src={imageUrl} alt={product?.name || fallbackLabel} className="h-full w-full object-cover" onError={() => setImageFailed(true)} />
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
  const [primaryImageFile, setPrimaryImageFile] = useState<File | null>(null);
  const [galleryFiles, setGalleryFiles] = useState<File[]>([]);
  const [primaryPreviewUrl, setPrimaryPreviewUrl] = useState<string | null>(null);
  const [galleryPreviewUrls, setGalleryPreviewUrls] = useState<string[]>([]);
  const [removeImage, setRemoveImage] = useState(false);
  const [removeImageIds, setRemoveImageIds] = useState<string[]>([]);
  const [replaceGallery, setReplaceGallery] = useState(false);
  const primaryInputRef = useRef<HTMLInputElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);
  const [detailProduct, setDetailProduct] = useState<ApiProduct | null>(null);
  const [detailIndex, setDetailIndex] = useState(0);

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
      const message = loadError instanceof Error ? loadError.message : tr('Failed to load products', 'ÐÐµ ÑƒÐ´Ð°Ð»Ð¾ÑÑŒ Ð·Ð°Ð³Ñ€ÑƒÐ·Ð¸Ñ‚ÑŒ Ñ‚Ð¾Ð²Ð°Ñ€Ñ‹', 'Mahsulotlarni yuklab bo\'lmadi');
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
    () =>
      (replaceGallery ? [] : (editing?.images || []).filter((image) => !removeImageIds.includes(image.id))).map((image) => ({
        ...image,
        url: resolveAdminMediaUrl(image.url) || image.url,
        thumb_url: resolveAdminMediaUrl(image.thumb_url || image.url) || image.thumb_url || image.url,
      })),
    [editing?.images, removeImageIds, replaceGallery]
  );

  const displayPrimaryImage = useMemo(() => {
    if (primaryPreviewUrl) return primaryPreviewUrl;
    if (removeImage) return null;
    return getPrimaryImage(editing);
  }, [editing, primaryPreviewUrl, removeImage]);

  const detailMedia = useMemo(() => getProductMedia(detailProduct), [detailProduct]);

  const productStats = useMemo(
    () => ({
      active: products.filter((product) => product.is_active !== false).length,
      lowStock: products.filter((product) => product.availability_status === 'low_stock').length,
      withPhotos: products.filter((product) => getPrimaryImage(product)).length,
    }),
    [products]
  );

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
    setPrimaryImageFile(null);
    setGalleryFiles([]);
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
    if (status === 'in_stock') return <Badge variant="success">{tr('In stock', 'Ð’ Ð½Ð°Ð»Ð¸Ñ‡Ð¸Ð¸', 'Mavjud')}</Badge>;
    if (status === 'low_stock') return <Badge variant="warning">{tr('Low stock', 'ÐœÐ°Ð»Ð¾ Ð¾ÑÑ‚Ð°Ð»Ð¾ÑÑŒ', 'Kam qolgan')}</Badge>;
    return <Badge variant="error">{tr('Out of stock', 'ÐÐµÑ‚ Ð² Ð½Ð°Ð»Ð¸Ñ‡Ð¸Ð¸', 'Tugagan')}</Badge>;
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

      const hasMediaChanges = Boolean(primaryImageFile || galleryFiles.length || removeImage || removeImageIds.length || replaceGallery);

      if (hasMediaChanges) {
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
        await apiRequest(editing ? ENDPOINTS.PRODUCTS.DETAIL(editing.id) : ENDPOINTS.PRODUCTS.LIST_CREATE, {
          method: editing ? 'PATCH' : 'POST',
          body: JSON.stringify({
            name: formState.name.trim(),
            sku: formState.sku.trim(),
            size_liters: formState.size_liters.trim(),
            price_uzs: Number(formState.price_uzs || 0),
            count: Number(formState.count || 0),
            min_stock_threshold: Number(formState.min_stock_threshold || 5),
            requires_returnable_bottle: formState.requires_returnable_bottle,
            bottle_deposit_uzs: formState.requires_returnable_bottle ? Number(formState.bottle_deposit_uzs || 0) : 0,
            is_active: formState.is_active,
            actor: 'frontend-ui',
          }),
        });
      }

      closeEditor();
      await loadProducts();
      toast.success(editing ? tr('Product updated.', 'Ð¢Ð¾Ð²Ð°Ñ€ Ð¾Ð±Ð½Ð¾Ð²Ð»ÐµÐ½.', 'Mahsulot yangilandi.') : tr('Product created.', 'Ð¢Ð¾Ð²Ð°Ñ€ ÑÐ¾Ð·Ð´Ð°Ð½.', 'Mahsulot yaratildi.'));
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : tr('Failed to save product', 'ÐÐµ ÑƒÐ´Ð°Ð»Ð¾ÑÑŒ ÑÐ¾Ñ…Ñ€Ð°Ð½Ð¸Ñ‚ÑŒ Ñ‚Ð¾Ð²Ð°Ñ€', 'Mahsulotni saqlab bo\'lmadi');
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async (product: ApiProduct) => {
    if (!window.confirm(tr(`Deactivate "${product.name}"?`, `Ð”ÐµÐ°ÐºÑ‚Ð¸Ð²Ð¸Ñ€Ð¾Ð²Ð°Ñ‚ÑŒ "${product.name}"?`, `"${product.name}" mahsulotini nofaol qilinsinmi?`))) return;

    try {
      await apiRequest(ENDPOINTS.PRODUCTS.DETAIL(product.id), {
        method: 'PATCH',
        body: JSON.stringify({ is_active: false }),
      });
      await loadProducts();
      toast.success(tr('Product deactivated.', 'Ð¢Ð¾Ð²Ð°Ñ€ Ð´ÐµÐ°ÐºÑ‚Ð¸Ð²Ð¸Ñ€Ð¾Ð²Ð°Ð½.', 'Mahsulot nofaol qilindi.'));
    } catch (deactivateError) {
      const message = deactivateError instanceof Error ? deactivateError.message : tr('Failed to deactivate product', 'ÐÐµ ÑƒÐ´Ð°Ð»Ð¾ÑÑŒ Ð´ÐµÐ°ÐºÑ‚Ð¸Ð²Ð¸Ñ€Ð¾Ð²Ð°Ñ‚ÑŒ Ñ‚Ð¾Ð²Ð°Ñ€', 'Mahsulotni nofaol qilib bo\'lmadi');
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
              'Ð£Ð¿Ñ€Ð°Ð²Ð»ÑÐ¹Ñ‚Ðµ Ñ‚Ð¾Ð²Ð°Ñ€Ð°Ð¼Ð¸, Ð¾ÑÑ‚Ð°Ñ‚ÐºÐ°Ð¼Ð¸ Ð¸ Ñ„Ð¾Ñ‚Ð¾ Ð² Ð¾Ð´Ð½Ð¾Ð¼ Ñ€Ð°Ð±Ð¾Ñ‡ÐµÐ¼ Ð¿Ñ€Ð¾ÑÑ‚Ñ€Ð°Ð½ÑÑ‚Ð²Ðµ.',
              'Mahsulotlar, qoldiq va rasmlarni bitta toza oynada boshqaring.'
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
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#9a6b3a]">{tr('Catalog size', 'Ð Ð°Ð·Ð¼ÐµÑ€ ÐºÐ°Ñ‚Ð°Ð»Ð¾Ð³Ð°', 'Katalog hajmi')}</p>
          <p className="mt-3 text-3xl font-semibold text-[#1f2933]">{products.length}</p>
          <p className="mt-2 text-sm text-[#5b6770]">{tr('Total products in the catalog.', 'Ð’ÑÐµÐ³Ð¾ Ñ‚Ð¾Ð²Ð°Ñ€Ð¾Ð² Ð² ÐºÐ°Ñ‚Ð°Ð»Ð¾Ð³Ðµ.', 'Katalogdagi jami mahsulotlar.')}</p>
        </Card>
        <Card className="bg-[linear-gradient(135deg,rgba(232,241,238,0.94)_0%,rgba(255,255,255,1)_100%)]">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#40635b]">{tr('Active / low stock', 'ÐÐºÑ‚Ð¸Ð²Ð½Ñ‹Ðµ / Ð¼Ð°Ð»Ð¾', 'Faol / kam')}</p>
          <p className="mt-3 text-3xl font-semibold text-[#1f2933]">{productStats.active} / {productStats.lowStock}</p>
          <p className="mt-2 text-sm text-[#5b6770]">{tr('Quick view of availability and stock risk.', 'Ð‘Ñ‹ÑÑ‚Ñ€Ñ‹Ð¹ Ð¾Ð±Ð·Ð¾Ñ€ Ð´Ð¾ÑÑ‚ÑƒÐ¿Ð½Ð¾ÑÑ‚Ð¸ Ð¸ Ñ€Ð¸ÑÐºÐ° Ð¿Ð¾ Ð¾ÑÑ‚Ð°Ñ‚ÐºÐ°Ð¼.', 'Mavjudlik va qoldiq xavfi boâ€˜yicha tezkor koâ€˜rinish.')}</p>
        </Card>
        <Card className="bg-[linear-gradient(135deg,rgba(236,242,255,0.94)_0%,rgba(255,255,255,1)_100%)]">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#355cbb]">{tr('Photo coverage', 'Ð¤Ð¾Ñ‚Ð¾-Ð¿Ð¾ÐºÑ€Ñ‹Ñ‚Ð¸Ðµ', 'Rasm qamrovi')}</p>
          <p className="mt-3 text-3xl font-semibold text-[#1f2933]">{productStats.withPhotos}</p>
          <p className="mt-2 text-sm text-[#5b6770]">{tr('Products that already have a visible photo.', 'Ð¢Ð¾Ð²Ð°Ñ€Ñ‹, Ñƒ ÐºÐ¾Ñ‚Ð¾Ñ€Ñ‹Ñ… ÑƒÐ¶Ðµ ÐµÑÑ‚ÑŒ Ð²Ð¸Ð´Ð¸Ð¼Ð¾Ðµ Ñ„Ð¾Ñ‚Ð¾.', 'Rasmi allaqachon mavjud mahsulotlar.')}</p>
        </Card>
      </div>

      {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

      <Card className="!p-0 overflow-hidden">
        <form onSubmit={handleSearch} className="border-b border-light-border bg-white p-4 dark:border-navy-700 dark:bg-navy-800">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-white">{tr('Products catalog', 'ÐšÐ°Ñ‚Ð°Ð»Ð¾Ð³ Ñ‚Ð¾Ð²Ð°Ñ€Ð¾Ð²', 'Mahsulotlar katalogi')}</p>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {tr('Cleaner cards in the list, full details on open.', 'Ð’ ÑÐ¿Ð¸ÑÐºÐµ Ñ‚Ð¾Ð»ÑŒÐºÐ¾ Ð³Ð»Ð°Ð²Ð½Ð¾Ðµ, Ð¿Ð¾Ð»Ð½Ñ‹Ðµ Ð´ÐµÑ‚Ð°Ð»Ð¸ Ð²Ð½ÑƒÑ‚Ñ€Ð¸.', 'Roâ€˜yxatda faqat kerakli maâ€™lumot, toâ€˜liq tafsilot ichkarida.')}
              </p>
            </div>
            <div className="flex flex-col gap-3 md:flex-row md:items-center">
              <label className="inline-flex items-center gap-2 rounded-lg border border-light-border bg-gray-50 px-3 py-2 text-sm text-gray-700 dark:border-navy-600 dark:bg-navy-900 dark:text-gray-300">
                <input type="checkbox" checked={onlyLowStock} onChange={(event) => setOnlyLowStock(event.target.checked)} />
                {tr('Low stock only', 'Ð¢Ð¾Ð»ÑŒÐºÐ¾ Ñ Ð½Ð¸Ð·ÐºÐ¸Ð¼ Ð¾ÑÑ‚Ð°Ñ‚ÐºÐ¾Ð¼', 'Faqat kam qolganlar')}
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
            <div className="py-12 text-center text-sm text-gray-500">{tr('Loading products...', 'Ð—Ð°Ð³Ñ€ÑƒÐ·ÐºÐ° Ñ‚Ð¾Ð²Ð°Ñ€Ð¾Ð²...', 'Mahsulotlar yuklanmoqda...')}</div>
          ) : products.length === 0 ? (
            <div className="py-12 text-center text-sm text-gray-500">{tr('No products found.', 'Ð¢Ð¾Ð²Ð°Ñ€Ñ‹ Ð½Ðµ Ð½Ð°Ð¹Ð´ÐµÐ½Ñ‹.', 'Mahsulotlar topilmadi.')}</div>
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
                          fallbackLabel={tr('No photo', 'Нет фото', 'Rasm yo‘q')}
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
                            {mediaCount ? tr(`${mediaCount} media`, `${mediaCount} медиа`, `${mediaCount} media`) : tr('No media', 'Нет медиа', 'Media yo‘q')}
                          </span>
                          {product.requires_returnable_bottle ? (
                            <span className="inline-flex items-center rounded-full bg-amber-50 px-3 py-1.5 font-semibold text-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
                              {product.bottle_deposit_uzs.toLocaleString()} UZS
                            </span>
                          ) : null}
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <button type="button" onClick={() => openDetail(product)} className="inline-flex min-w-[112px] items-center justify-center gap-2 rounded-xl border border-light-border px-4 py-3 text-sm font-medium text-gray-700 transition hover:border-primary-blue hover:text-primary-blue dark:border-navy-600 dark:text-gray-200">
                            <Eye size={15} />
                            {tr('Open', 'Открыть', 'Ochish')}
                          </button>
                          <button type="button" onClick={() => openEdit(product)} className="inline-flex min-w-[132px] items-center justify-center gap-2 rounded-xl bg-[#21404d] px-4 py-3 text-sm font-medium text-white transition hover:brightness-105">
                            <Edit2 size={15} />
                            {tr('Edit', 'Изменить', 'Tahrirlash')}
                          </button>
                          <button type="button" onClick={() => void handleDeactivate(product)} className="inline-flex items-center justify-center rounded-xl bg-rose-50 px-4 py-3 text-rose-600 transition hover:bg-rose-100 dark:bg-rose-950/20 dark:text-rose-300">
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
        title={editing ? tr('Edit Product', 'Ð ÐµÐ´Ð°ÐºÑ‚Ð¸Ñ€Ð¾Ð²Ð°Ñ‚ÑŒ Ñ‚Ð¾Ð²Ð°Ñ€', 'Mahsulotni tahrirlash') : tr('Add New Product', 'Ð”Ð¾Ð±Ð°Ð²Ð¸Ñ‚ÑŒ Ñ‚Ð¾Ð²Ð°Ñ€', 'Yangi mahsulot qoâ€˜shish')}
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
                        <p className="mt-3 text-xs font-semibold uppercase tracking-[0.22em] text-white/72">{tr('Upload a product photo', 'Ð—Ð°Ð³Ñ€ÑƒÐ·Ð¸Ñ‚Ðµ Ñ„Ð¾Ñ‚Ð¾ Ñ‚Ð¾Ð²Ð°Ñ€Ð°', 'Mahsulot rasmini yuklang')}</p>
                      </div>
                    </div>
                  )}
                  <div className="absolute inset-x-0 bottom-0 bg-[linear-gradient(180deg,transparent_0%,rgba(0,0,0,0.66)_100%)] px-5 pb-5 pt-12 text-white">
                    <p className="text-lg font-semibold">{formState.name || tr('New product', 'ÐÐ¾Ð²Ñ‹Ð¹ Ñ‚Ð¾Ð²Ð°Ñ€', 'Yangi mahsulot')}</p>
                    <p className="mt-1 text-sm text-white/76">{formState.size_liters || '-'}L Â· {(existingGalleryImages.length + galleryFiles.length) || 0} {tr('photos', 'Ñ„Ð¾Ñ‚Ð¾', 'rasm')}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-[28px] border border-light-border bg-white/80 p-5 shadow-sm dark:border-navy-700 dark:bg-navy-900/40">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">{tr('Cover photo', 'Ð“Ð»Ð°Ð²Ð½Ð¾Ðµ Ñ„Ð¾Ñ‚Ð¾', 'Asosiy rasm')}</p>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{tr('Shown first in the catalog and client app.', 'Ð­Ñ‚Ð¾ Ñ„Ð¾Ñ‚Ð¾ Ð¿Ð¾ÐºÐ°Ð·Ñ‹Ð²Ð°ÐµÑ‚ÑÑ Ð¿ÐµÑ€Ð²Ñ‹Ð¼ Ð² Ð°Ð´Ð¼Ð¸Ð½ÐºÐµ Ð¸ WebApp.', 'Bu rasm admin va WebAppda birinchi koâ€˜rinadi.')}</p>
                  </div>
                  <label className="cursor-pointer rounded-2xl bg-[#21404d] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#1a3340]">
                    <span className="inline-flex items-center gap-2"><Upload size={15} />{tr('Choose photo', 'Ð—Ð°Ð³Ñ€ÑƒÐ·Ð¸Ñ‚ÑŒ', 'Yuklash')}</span>
                    <input ref={primaryInputRef} type="file" accept="image/*" className="hidden" onChange={(event) => setPrimaryImageFile(event.target.files?.[0] || null)} />
                  </label>
                </div>
                <div className="mt-4 rounded-2xl border border-dashed border-[#d8c7b2] bg-[rgba(255,248,240,0.94)] px-4 py-3 text-sm text-[#5b6770]">
                  {primaryImageFile ? primaryImageFile.name : tr('Choose a clear cover photo for the product.', 'Ð’Ñ‹Ð±ÐµÑ€Ð¸Ñ‚Ðµ Ð°ÐºÐºÑƒÑ€Ð°Ñ‚Ð½Ð¾Ðµ Ð¾ÑÐ½Ð¾Ð²Ð½Ð¾Ðµ Ñ„Ð¾Ñ‚Ð¾ Ñ‚Ð¾Ð²Ð°Ñ€Ð°.', 'Mahsulot uchun toza asosiy rasm tanlang.')}
                </div>
                {primaryImageFile ? (
                  <button type="button" onClick={() => { setPrimaryImageFile(null); if (primaryInputRef.current) primaryInputRef.current.value = ''; }} className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-rose-600 transition hover:text-rose-700">
                    <X size={14} />
                    {tr('Remove selected file', 'Ð£Ð±Ñ€Ð°Ñ‚ÑŒ Ð²Ñ‹Ð±Ñ€Ð°Ð½Ð½Ñ‹Ð¹ Ñ„Ð°Ð¹Ð»', 'Tanlangan faylni olib tashlash')}
                  </button>
                ) : null}
                {editing && getPrimaryImage(editing) ? (
                  <label className="mt-3 inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                    <input type="checkbox" checked={removeImage} onChange={(event) => setRemoveImage(event.target.checked)} />
                    {tr('Remove current main photo on save', 'Ð£Ð´Ð°Ð»Ð¸Ñ‚ÑŒ Ñ‚ÐµÐºÑƒÑ‰ÐµÐµ Ñ„Ð¾Ñ‚Ð¾ Ð¿Ñ€Ð¸ ÑÐ¾Ñ…Ñ€Ð°Ð½ÐµÐ½Ð¸Ð¸', 'Saqlashda joriy asosiy rasmni olib tashlash')}
                  </label>
                ) : null}
              </div>

              <div className="rounded-[28px] border border-light-border bg-white/80 p-5 shadow-sm dark:border-navy-700 dark:bg-navy-900/40">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">{tr('Gallery photos', 'Ð“Ð°Ð»ÐµÑ€ÐµÑ', 'Galereya')}</p>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{tr('Add more angles if needed.', 'Ð”Ð¾Ð±Ð°Ð²ÑŒÑ‚Ðµ Ð´Ð¾Ð¿Ð¾Ð»Ð½Ð¸Ñ‚ÐµÐ»ÑŒÐ½Ñ‹Ðµ Ñ„Ð¾Ñ‚Ð¾ Ð´Ð»Ñ Ð±Ð¾Ð»ÐµÐµ ÑÐ¸Ð»ÑŒÐ½Ð¾Ð¹ Ð¿Ð¾Ð´Ð°Ñ‡Ð¸ Ñ‚Ð¾Ð²Ð°Ñ€Ð°.', 'Mahsulotni yaxshiroq koâ€˜rsatish uchun qoâ€˜shimcha rasmlar qoâ€˜shing.')}</p>
                  </div>
                  <label className="cursor-pointer rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-[#21404d] shadow-[0_10px_20px_rgba(33,64,77,0.12)] transition hover:bg-[#fff5ea]">
                    <span className="inline-flex items-center gap-2"><Images size={15} />{tr('Add gallery', 'Ð”Ð¾Ð±Ð°Ð²Ð¸Ñ‚ÑŒ Ñ„Ð¾Ñ‚Ð¾', 'Rasm qoâ€˜shish')}</span>
                    <input ref={galleryInputRef} type="file" accept="image/*" multiple className="hidden" onChange={(event) => setGalleryFiles(Array.from(event.target.files || []))} />
                  </label>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-[#5b6770]">
                  <span className="rounded-full bg-[rgba(255,248,240,0.94)] px-3 py-1.5 font-semibold text-[#21404d]">
                    {existingGalleryImages.length} {tr('current', 'Ã‘â€šÃÂµÃÂºÃ‘Æ’Ã‘â€°ÃÂ¸Ã‘â€¦', 'mavjud')}
                  </span>
                  <span className="rounded-full bg-[rgba(236,242,255,0.94)] px-3 py-1.5 font-semibold text-[#355cbb]">
                    {galleryFiles.length} {tr('new', 'ÃÂ½ÃÂ¾ÃÂ²Ã‘â€¹Ã‘â€¦', 'yangi')}
                  </span>
                </div>
                {editing?.images?.length ? (
                  <label className="mt-4 inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                    <input type="checkbox" checked={replaceGallery} onChange={(event) => { setReplaceGallery(event.target.checked); if (event.target.checked) setRemoveImageIds([]); }} />
                    {tr('Replace full gallery on save', 'ÐŸÐ¾Ð»Ð½Ð¾ÑÑ‚ÑŒÑŽ Ð·Ð°Ð¼ÐµÐ½Ð¸Ñ‚ÑŒ Ð³Ð°Ð»ÐµÑ€ÐµÑŽ Ð¿Ñ€Ð¸ ÑÐ¾Ñ…Ñ€Ð°Ð½ÐµÐ½Ð¸Ð¸', 'Saqlashda galereyani toâ€˜liq almashtirish')}
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
                  {galleryPreviewUrls.map((url, index) => (
                    <div key={`${url}-${index}`} className="group relative overflow-hidden rounded-2xl border border-primary-blue/30 bg-blue-50 shadow-sm">
                      <img src={url} alt={`Upload ${index + 1}`} className="h-24 w-full object-cover" />
                      <button type="button" onClick={() => setGalleryFiles((current) => current.filter((_, fileIndex) => fileIndex !== index))} className="absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition group-hover:opacity-100">
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                  {!existingGalleryImages.length && !galleryPreviewUrls.length ? (
                    <div className="col-span-full rounded-2xl border border-dashed border-light-border bg-gray-50 px-4 py-6 text-center text-sm text-gray-500 dark:border-navy-700 dark:bg-navy-900/40">
                      {tr('No gallery photos yet.', 'ÐŸÐ¾ÐºÐ° Ð½ÐµÑ‚ Ñ„Ð¾Ñ‚Ð¾ Ð³Ð°Ð»ÐµÑ€ÐµÐ¸.', 'Hali galereya rasmlari yoâ€˜q.')}
                    </div>
                  ) : null}
                </div>
              </div>
            </section>

            <section className="space-y-5">
              <div className="rounded-[28px] border border-light-border bg-white/80 p-5 shadow-sm dark:border-navy-700 dark:bg-navy-900/40">
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{tr('Product details', 'Ð”ÐµÑ‚Ð°Ð»Ð¸ Ñ‚Ð¾Ð²Ð°Ñ€Ð°', 'Mahsulot tafsilotlari')}</p>
                <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="md:col-span-2">
                    <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">{t('product_name')}</label>
                    <input value={formState.name} onChange={(event) => setFormState((current) => ({ ...current, name: event.target.value }))} required className="w-full rounded-lg border border-light-border bg-gray-50 px-3 py-2 text-sm text-gray-900 outline-none focus:border-primary-blue dark:border-navy-600 dark:bg-navy-900 dark:text-white" />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">SKU</label>
                    <input value={formState.sku} onChange={(event) => setFormState((current) => ({ ...current, sku: event.target.value }))} placeholder={tr('Leave empty to auto-generate', 'ÐžÑÑ‚Ð°Ð²ÑŒÑ‚Ðµ Ð¿ÑƒÑÑ‚Ñ‹Ð¼ Ð´Ð»Ñ Ð°Ð²Ñ‚Ð¾Ð³ÐµÐ½ÐµÑ€Ð°Ñ†Ð¸Ð¸', 'Avto yaratish uchun bosh qoldiring')} className="w-full rounded-lg border border-light-border bg-gray-50 px-3 py-2 text-sm text-gray-900 outline-none focus:border-primary-blue dark:border-navy-600 dark:bg-navy-900 dark:text-white" />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">{tr('Size liters', 'ÐžÐ±ÑŠÐµÐ¼ (Ð»Ð¸Ñ‚Ñ€)', 'Hajmi (litr)')}</label>
                    <input value={formState.size_liters} onChange={(event) => setFormState((current) => ({ ...current, size_liters: event.target.value }))} required className="w-full rounded-lg border border-light-border bg-gray-50 px-3 py-2 text-sm text-gray-900 outline-none focus:border-primary-blue dark:border-navy-600 dark:bg-navy-900 dark:text-white" />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">{t('price')} (UZS)</label>
                    <input type="number" min="0" value={formState.price_uzs} onChange={(event) => setFormState((current) => ({ ...current, price_uzs: event.target.value }))} required className="w-full rounded-lg border border-light-border bg-gray-50 px-3 py-2 text-sm text-gray-900 outline-none focus:border-primary-blue dark:border-navy-600 dark:bg-navy-900 dark:text-white" />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">{t('stock')}</label>
                    <input type="number" min="0" value={formState.count} onChange={(event) => setFormState((current) => ({ ...current, count: event.target.value }))} required className="w-full rounded-lg border border-light-border bg-gray-50 px-3 py-2 text-sm text-gray-900 outline-none focus:border-primary-blue dark:border-navy-600 dark:bg-navy-900 dark:text-white" />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">{tr('Min threshold', 'ÐœÐ¸Ð½Ð¸Ð¼Ð°Ð»ÑŒÐ½Ñ‹Ð¹ Ð¿Ð¾Ñ€Ð¾Ð³', 'Minimal chegara')}</label>
                    <input type="number" min="0" value={formState.min_stock_threshold} onChange={(event) => setFormState((current) => ({ ...current, min_stock_threshold: event.target.value }))} required className="w-full rounded-lg border border-light-border bg-gray-50 px-3 py-2 text-sm text-gray-900 outline-none focus:border-primary-blue dark:border-navy-600 dark:bg-navy-900 dark:text-white" />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">{tr('Bottle deposit (UZS)', 'Ð”ÐµÐ¿Ð¾Ð·Ð¸Ñ‚ Ð·Ð° Ñ‚Ð°Ñ€Ñƒ (UZS)', 'Idish depoziti (UZS)')}</label>
                    <input type="number" min="0" value={formState.bottle_deposit_uzs} onChange={(event) => setFormState((current) => ({ ...current, bottle_deposit_uzs: event.target.value }))} disabled={!formState.requires_returnable_bottle} className="w-full rounded-lg border border-light-border bg-gray-50 px-3 py-2 text-sm text-gray-900 outline-none focus:border-primary-blue disabled:opacity-50 dark:border-navy-600 dark:bg-navy-900 dark:text-white" />
                  </div>
                </div>
              </div>

              <div className="rounded-[28px] border border-light-border bg-white/80 p-5 shadow-sm dark:border-navy-700 dark:bg-navy-900/40">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">{tr('Visibility and bottle settings', 'Ð’Ð¸Ð´Ð¸Ð¼Ð¾ÑÑ‚ÑŒ Ð¸ Ñ‚Ð°Ñ€Ð°', 'Koâ€˜rinish va idish sozlamalari')}</p>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{tr('Keep availability and bottle rules aligned with the real product.', 'Ð”ÐµÑ€Ð¶Ð¸Ñ‚Ðµ Ð´Ð¾ÑÑ‚ÑƒÐ¿Ð½Ð¾ÑÑ‚ÑŒ Ð¸ Ð¿Ñ€Ð°Ð²Ð¸Ð»Ð° Ñ‚Ð°Ñ€Ñ‹ Ð² ÑÐ¾Ð¾Ñ‚Ð²ÐµÑ‚ÑÑ‚Ð²Ð¸Ð¸ Ñ Ñ€ÐµÐ°Ð»ÑŒÐ½Ñ‹Ð¼ Ñ‚Ð¾Ð²Ð°Ñ€Ð¾Ð¼.', 'Mavjudlik va idish qoidalarini real mahsulotga mos tuting.')}</p>
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                      <input type="checkbox" checked={formState.requires_returnable_bottle} onChange={(event) => setFormState((current) => ({ ...current, requires_returnable_bottle: event.target.checked, bottle_deposit_uzs: event.target.checked ? current.bottle_deposit_uzs : '0' }))} />
                      {tr('Requires returnable bottle', 'Ð¢Ñ€ÐµÐ±ÑƒÐµÑ‚ Ð²Ð¾Ð·Ð²Ñ€Ð°Ñ‚Ð½ÑƒÑŽ Ñ‚Ð°Ñ€Ñƒ', 'Qaytariladigan idish talab qiladi')}
                    </label>
                    <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                      <input type="checkbox" checked={formState.is_active} onChange={(event) => setFormState((current) => ({ ...current, is_active: event.target.checked }))} />
                      {tr('Active', 'ÐÐºÑ‚Ð¸Ð²Ð½Ñ‹Ð¹', 'Faol')}
                    </label>
                  </div>
                </div>
              </div>
            </section>
          </div>

          <div className="flex justify-end gap-3 border-t border-light-border pt-4 dark:border-navy-700">
            <button type="button" onClick={closeEditor} className="rounded-lg px-4 py-2 text-sm text-gray-600 transition hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-navy-700">{t('cancel')}</button>
            <button disabled={saving} type="submit" className="rounded-lg bg-primary-blue px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-600 disabled:opacity-50">
              {saving ? tr('Saving...', 'Ð¡Ð¾Ñ…Ñ€Ð°Ð½ÐµÐ½Ð¸Ðµ...', 'Saqlanmoqda...') : t('save')}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={Boolean(detailProduct)}
        onClose={closeDetail}
        title={detailProduct?.name || tr('Product detail', 'Ð”ÐµÑ‚Ð°Ð»Ð¸ Ñ‚Ð¾Ð²Ð°Ñ€Ð°', 'Mahsulot tafsiloti')}
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
                          <p className="mt-3 text-xs font-semibold uppercase tracking-[0.22em] text-white/72">{tr('No product photo', 'ÐÐµÑ‚ Ñ„Ð¾Ñ‚Ð¾ Ñ‚Ð¾Ð²Ð°Ñ€Ð°', 'Mahsulot rasmi yoâ€˜q')}</p>
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
                      <p className="mt-1 text-sm text-white/76">{detailProduct.size_liters}L Â· {detailMedia.length || 0} {tr('photos', 'Ñ„Ð¾Ñ‚Ð¾', 'rasm')}</p>
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
                    <p className="text-xs uppercase tracking-[0.2em] text-[#355cbb]">{tr('Updated', 'ÐžÐ±Ð½Ð¾Ð²Ð»ÐµÐ½Ð¾', 'Yangilangan')}</p>
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
                    {detailProduct.is_active === false ? <Badge variant="default">{tr('Inactive', 'ÐÐµÐ°ÐºÑ‚Ð¸Ð²Ð½Ñ‹Ð¹', 'Nofaol')}</Badge> : null}
                    {detailProduct.requires_returnable_bottle ? <Badge variant="info">{tr('Returnable bottle', 'Ð’Ð¾Ð·Ð²Ñ€Ð°Ñ‚Ð½Ð°Ñ Ñ‚Ð°Ñ€Ð°', 'Qaytariladigan idish')}</Badge> : <Badge variant="default">{tr('No bottle deposit', 'Ð‘ÐµÐ· Ð·Ð°Ð»Ð¾Ð³Ð° Ð·Ð° Ñ‚Ð°Ñ€Ñƒ', 'Idish depozitisiz')}</Badge>}
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-500">{tr('Size', 'ÐžÐ±ÑŠÐµÐ¼', 'Hajm')}</p>
                      <p className="mt-1 font-semibold text-[#1f2933]">{detailProduct.size_liters}L</p>
                    </div>
                    <div>
                      <p className="text-gray-500">{tr('Min threshold', 'ÐœÐ¸Ð½Ð¸Ð¼Ð°Ð»ÑŒÐ½Ñ‹Ð¹ Ð¿Ð¾Ñ€Ð¾Ð³', 'Minimal chegara')}</p>
                      <p className="mt-1 font-semibold text-[#1f2933]">{detailProduct.min_stock_threshold}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">{tr('Bottle deposit', 'Ð”ÐµÐ¿Ð¾Ð·Ð¸Ñ‚ Ð·Ð° Ñ‚Ð°Ñ€Ñƒ', 'Idish depoziti')}</p>
                      <p className="mt-1 font-semibold text-[#1f2933]">{detailProduct.requires_returnable_bottle ? `${detailProduct.bottle_deposit_uzs.toLocaleString()} UZS` : tr('Not required', 'ÐÐµ Ñ‚Ñ€ÐµÐ±ÑƒÐµÑ‚ÑÑ', 'Talab qilinmaydi')}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">{tr('Photos', 'Ð¤Ð¾Ñ‚Ð¾', 'Rasmlar')}</p>
                      <p className="mt-1 font-semibold text-[#1f2933]">{detailMedia.length}</p>
                    </div>
                  </div>
                </Card>

                <div className="flex gap-3">
                  <button type="button" onClick={() => { closeDetail(); openEdit(detailProduct); }} className="inline-flex items-center gap-2 rounded-2xl bg-[#21404d] px-4 py-3 text-sm font-semibold text-white transition hover:brightness-105">
                    <Edit2 size={16} />
                    {tr('Edit product', 'Ð˜Ð·Ð¼ÐµÐ½Ð¸Ñ‚ÑŒ Ñ‚Ð¾Ð²Ð°Ñ€', 'Mahsulotni tahrirlash')}
                  </button>
                  <button type="button" onClick={() => void handleDeactivate(detailProduct)} className="inline-flex items-center gap-2 rounded-2xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-600 transition hover:bg-rose-100 dark:bg-rose-950/20 dark:text-rose-300">
                    <Trash2 size={16} />
                    {tr('Deactivate', 'Ð”ÐµÐ°ÐºÑ‚Ð¸Ð²Ð¸Ñ€Ð¾Ð²Ð°Ñ‚ÑŒ', 'Nofaol qilish')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </Modal>

      <Card className="border-amber-200 bg-amber-50/70 dark:border-amber-800/40 dark:bg-navy-800">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 text-amber-500" size={18} />
          <p className="text-xs text-amber-800 dark:text-amber-200">{tr('Product deletion endpoint is not present. Delete now deactivates the product with is_active=false via PATCH /products/{id}/.', 'Ð­Ð½Ð´Ð¿Ð¾Ð¸Ð½Ñ‚Ð° ÑƒÐ´Ð°Ð»ÐµÐ½Ð¸Ñ Ñ‚Ð¾Ð²Ð°Ñ€Ð° Ð½ÐµÑ‚. Ð£Ð´Ð°Ð»ÐµÐ½Ð¸Ðµ Ñ‚ÐµÐ¿ÐµÑ€ÑŒ Ð´ÐµÐ°ÐºÑ‚Ð¸Ð²Ð¸Ñ€ÑƒÐµÑ‚ Ñ‚Ð¾Ð²Ð°Ñ€ Ñ‡ÐµÑ€ÐµÐ· PATCH /products/{id}/ Ñ is_active=false.', 'Mahsulotni oâ€˜chirish endpointi yoâ€˜q. Oâ€˜chirish tugmasi endi PATCH /products/{id}/ orqali is_active=false qilib nofaol qiladi.')}</p>
        </div>
      </Card>
    </div>
  );
};

export default Products;


