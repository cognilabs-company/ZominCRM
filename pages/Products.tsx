import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Edit2, ImagePlus, Images, Link2, Package, Plus, Search, Trash2, Upload, X } from 'lucide-react';
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

const Products: React.FC = () => {
  const { t, language } = useLanguage();
  const toast = useToast();
  const tr = (en: string, ru: string, uz: string) => (language === 'ru' ? ru : language === 'uz' ? uz : en);

  const [products, setProducts] = useState<ApiProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [onlyLowStock, setOnlyLowStock] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<ApiProduct | null>(null);
  const [saving, setSaving] = useState(false);
  const [formState, setFormState] = useState<ProductFormState>(emptyForm);
  const [primaryImageFile, setPrimaryImageFile] = useState<File | null>(null);
  const [galleryFiles, setGalleryFiles] = useState<File[]>([]);
  const [primaryPreviewUrl, setPrimaryPreviewUrl] = useState<string | null>(null);
  const [galleryPreviewUrls, setGalleryPreviewUrls] = useState<string[]>([]);
  const [removeImage, setRemoveImage] = useState(false);
  const [removeImageIds, setRemoveImageIds] = useState<string[]>([]);
  const [replaceGallery, setReplaceGallery] = useState(false);

  const loadProducts = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (search.trim()) params.set('q', search.trim());
      if (onlyLowStock) params.set('low_stock', 'true');
      const query = params.toString() ? `?${params.toString()}` : '';
      const data = await apiRequest<{ results?: ApiProduct[] }>(`${ENDPOINTS.PRODUCTS.LIST_CREATE}${query}`);
      setProducts(data.results || []);
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
    const url = URL.createObjectURL(primaryImageFile);
    setPrimaryPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [primaryImageFile]);

  useEffect(() => {
    if (!galleryFiles.length) {
      setGalleryPreviewUrls([]);
      return;
    }
    const urls = galleryFiles.map((file) => URL.createObjectURL(file));
    setGalleryPreviewUrls(urls);
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
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

  const handleSearch = (event: React.FormEvent) => {
    event.preventDefault();
    void loadProducts();
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
  };

  const existingGalleryImages = useMemo(
    () => (replaceGallery ? [] : (editing?.images || []).filter((image) => !removeImageIds.includes(image.id))),
    [editing?.images, removeImageIds, replaceGallery]
  );

  const displayPrimaryImage = useMemo(() => {
    if (primaryPreviewUrl) return primaryPreviewUrl;
    if (removeImage) return null;
    return getPrimaryImage(editing);
  }, [editing, primaryPreviewUrl, removeImage]);

  const activeCount = useMemo(() => products.filter((product) => product.is_active !== false).length, [products]);

  const availabilityBadge = (status: ApiProduct['availability_status']) => {
    if (status === 'in_stock') return <Badge variant="success">{tr('In stock', 'В наличии', 'Mavjud')}</Badge>;
    if (status === 'low_stock') return <Badge variant="warning">{tr('Low stock', 'Мало осталось', 'Kam qolgan')}</Badge>;
    return <Badge variant="error">{tr('Out of stock', 'Нет в наличии', 'Tugagan')}</Badge>;
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
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-light-text dark:text-white">{t('nav_products')}</h1>
        <button onClick={() => { setEditing(null); setIsModalOpen(true); }} className="px-4 py-2 bg-primary-blue hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2">
          {t('create')} <Plus size={16} />
        </button>
      </div>

      {error ? <div className="rounded-lg border border-red-200 bg-red-50 text-red-700 px-4 py-3 text-sm">{error}</div> : null}

      <Card className="!p-0 overflow-hidden">
        <form onSubmit={handleSearch} className="p-4 border-b border-light-border dark:border-navy-700 flex flex-col gap-3 bg-white dark:bg-navy-800">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-white">{tr('Products catalog', 'Каталог товаров', 'Mahsulotlar katalogi')}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{tr('Active products', 'Активные товары', 'Faol mahsulotlar')}: {activeCount} · {tr('Total', 'Всего', 'Jami')}: {products.length}</p>
            </div>
            <div className="relative w-full lg:max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input type="text" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={`${t('search')}...`} className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-navy-900 border border-light-border dark:border-navy-600 rounded-lg text-sm focus:outline-none focus:border-primary-blue dark:text-white" />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input type="checkbox" checked={onlyLowStock} onChange={(event) => setOnlyLowStock(event.target.checked)} />
              {tr('Low stock only', 'Только с низким остатком', 'Faqat kam qolganlar')}
            </label>
            <button type="submit" className="px-3 py-2 bg-gray-100 dark:bg-navy-700 rounded-lg text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-navy-600">{t('search')}</button>
          </div>
        </form>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 dark:bg-navy-900/50 text-xs uppercase text-gray-500 dark:text-gray-400 border-b border-light-border dark:border-navy-700">
                <th className="px-6 py-4 font-semibold">{t('product_name')}</th>
                <th className="px-6 py-4 font-semibold">SKU</th>
                <th className="px-6 py-4 font-semibold">{tr('Size (L)', 'Размер (л)', 'Hajmi (l)')}</th>
                <th className="px-6 py-4 font-semibold">{t('price')} (UZS)</th>
                <th className="px-6 py-4 font-semibold">{t('stock')}</th>
                <th className="px-6 py-4 font-semibold">{tr('Bottle', 'Тара', 'Idish')}</th>
                <th className="px-6 py-4 font-semibold">{tr('Deposit', 'Депозит', 'Depozit')}</th>
                <th className="px-6 py-4 font-semibold">{tr('State', 'Состояние', 'Holati')}</th>
                <th className="px-6 py-4 font-semibold text-right">{t('actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-light-border dark:divide-navy-700">
              {loading ? (
                <tr><td colSpan={9} className="py-10 text-center text-gray-400">{tr('Loading products...', 'Загрузка товаров...', 'Mahsulotlar yuklanmoqda...')}</td></tr>
              ) : products.length === 0 ? (
                <tr><td colSpan={9} className="py-10 text-center text-gray-400">{tr('No products found.', 'Товары не найдены.', 'Mahsulotlar topilmadi.')}</td></tr>
              ) : (
                products.map((product) => {
                  const primaryImage = getPrimaryImage(product);
                  const galleryCount = product.images?.length || 0;
                  const mediaCount = galleryCount || (primaryImage ? 1 : 0);
                  return (
                    <tr key={product.id} className="hover:bg-gray-50 dark:hover:bg-navy-700/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-4">
                          <div className="relative h-16 w-16 overflow-hidden rounded-[20px] border border-white/70 bg-[linear-gradient(145deg,#21404d_0%,#3d6c77_58%,#d9a25f_100%)] shadow-[0_12px_24px_rgba(33,64,77,0.16)] shrink-0">
                            {primaryImage ? <img src={primaryImage} alt={product.name} className="h-full w-full object-cover" /> : <div className="absolute inset-0 flex items-center justify-center text-white"><Package size={22} /></div>}
                            <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-[linear-gradient(180deg,transparent_0%,rgba(0,0,0,0.58)_100%)] px-2 pb-2 pt-5 text-[10px] font-semibold text-white">
                              <span>{product.size_liters}L</span>
                              <span>{mediaCount > 0 ? mediaCount : tr('No photo', 'Нет фото', 'Rasm yoq')}</span>
                            </div>
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-900 dark:text-white">{product.name}</p>
                            <p className="mt-1 text-xs text-gray-500">{product.id.slice(0, 8)}</p>
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${primaryImage ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}><ImagePlus size={12} />{primaryImage ? tr('Photo ready', 'Фото готово', 'Rasm tayyor') : tr('Need photo', 'Нужно фото', 'Rasm kerak')}</span>
                              {mediaCount > 1 ? <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700 dark:bg-amber-900/20 dark:text-amber-300"><Images size={12} />{mediaCount}</span> : null}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">{product.sku || '-'}</td>
                      <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">{product.size_liters || '-'}</td>
                      <td className="px-6 py-4 text-sm font-semibold text-gray-900 dark:text-white">{product.price_uzs.toLocaleString()}</td>
                      <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300"><div><p>{product.count}</p><p className="text-xs text-gray-500">{tr('Min', 'Мин', 'Min')}: {product.min_stock_threshold}</p></div></td>
                      <td className="px-6 py-4 text-sm">{product.requires_returnable_bottle ? <Badge variant="info">{tr('Returnable', 'Возвратная', 'Qaytariladigan')}</Badge> : <Badge variant="default">{tr('No bottle', 'Без тары', 'Idishsiz')}</Badge>}</td>
                      <td className="px-6 py-4 text-sm font-medium text-gray-700 dark:text-gray-300">{product.requires_returnable_bottle ? `${product.bottle_deposit_uzs.toLocaleString()} UZS` : '-'}</td>
                      <td className="px-6 py-4"><div className="flex flex-wrap items-center gap-2">{availabilityBadge(product.availability_status)}{product.is_active === false ? <Badge variant="default">{tr('Inactive', 'Неактивный', 'Nofaol')}</Badge> : null}</div></td>
                      <td className="px-6 py-4 text-right"><div className="flex justify-end gap-2"><button onClick={() => { setEditing(product); setIsModalOpen(true); }} className="p-1.5 text-gray-500 dark:text-gray-300 hover:text-primary-blue dark:hover:text-blue-400 transition-colors"><Edit2 size={16} /></button><button onClick={() => void handleDeactivate(product)} className="p-1.5 text-gray-500 dark:text-gray-300 hover:text-red-500 dark:hover:text-red-400 transition-colors"><Trash2 size={16} /></button></div></td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal isOpen={isModalOpen} onClose={closeModal} title={editing ? tr('Edit Product', 'Редактировать товар', 'Mahsulotni tahrirlash') : tr('Add New Product', 'Добавить товар', 'Yangi mahsulot qo\'shish')} footer={null}>
        <form onSubmit={handleSave} className="space-y-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="md:col-span-2"><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('product_name')}</label><input value={formState.name} onChange={(event) => setFormState((current) => ({ ...current, name: event.target.value }))} required className="w-full bg-gray-50 dark:bg-navy-900 border border-light-border dark:border-navy-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-blue dark:text-white" /></div>
            <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">SKU</label><input value={formState.sku} onChange={(event) => setFormState((current) => ({ ...current, sku: event.target.value }))} placeholder={tr('Leave empty to auto-generate', 'Оставьте пустым для автогенерации', 'Avto yaratish uchun bo\'sh qoldiring')} className="w-full bg-gray-50 dark:bg-navy-900 border border-light-border dark:border-navy-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-blue dark:text-white" /></div>
            <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{tr('Size liters', 'Объем (литр)', 'Hajmi (litr)')}</label><input value={formState.size_liters} onChange={(event) => setFormState((current) => ({ ...current, size_liters: event.target.value }))} required className="w-full bg-gray-50 dark:bg-navy-900 border border-light-border dark:border-navy-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-blue dark:text-white" /></div>
            <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('price')} (UZS)</label><input type="number" min="0" value={formState.price_uzs} onChange={(event) => setFormState((current) => ({ ...current, price_uzs: event.target.value }))} required className="w-full bg-gray-50 dark:bg-navy-900 border border-light-border dark:border-navy-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-blue dark:text-white" /></div>
            <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('stock')}</label><input type="number" min="0" value={formState.count} onChange={(event) => setFormState((current) => ({ ...current, count: event.target.value }))} required className="w-full bg-gray-50 dark:bg-navy-900 border border-light-border dark:border-navy-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-blue dark:text-white" /></div>
            <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{tr('Min threshold', 'Минимальный порог', 'Minimal chegara')}</label><input type="number" min="0" value={formState.min_stock_threshold} onChange={(event) => setFormState((current) => ({ ...current, min_stock_threshold: event.target.value }))} required className="w-full bg-gray-50 dark:bg-navy-900 border border-light-border dark:border-navy-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-blue dark:text-white" /></div>
            <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{tr('Bottle deposit (UZS)', 'Депозит за тару (UZS)', 'Idish depoziti (UZS)')}</label><input type="number" min="0" value={formState.bottle_deposit_uzs} onChange={(event) => setFormState((current) => ({ ...current, bottle_deposit_uzs: event.target.value }))} disabled={!formState.requires_returnable_bottle} className="w-full bg-gray-50 dark:bg-navy-900 border border-light-border dark:border-navy-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-blue dark:text-white disabled:opacity-50" /></div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"><input type="checkbox" checked={formState.requires_returnable_bottle} onChange={(event) => setFormState((current) => ({ ...current, requires_returnable_bottle: event.target.checked, bottle_deposit_uzs: event.target.checked ? current.bottle_deposit_uzs : '0' }))} />{tr('Requires returnable bottle', 'Требует возвратную тару', 'Qaytariladigan idish talab qiladi')}</label>
            <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"><input type="checkbox" checked={formState.is_active} onChange={(event) => setFormState((current) => ({ ...current, is_active: event.target.checked }))} />{tr('Active', 'Активный', 'Faol')}</label>
          </div>

          <div className="rounded-2xl border border-light-border dark:border-navy-700 bg-[linear-gradient(135deg,rgba(255,247,237,0.92)_0%,rgba(242,247,248,0.95)_100%)] p-4 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div><p className="text-sm font-semibold text-gray-900 dark:text-white">{tr('Product photos', 'Фотографии товара', 'Mahsulot rasmlari')}</p><p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{tr('Upload a primary image and optional gallery.', 'Загрузите главное изображение и при необходимости галерею.', 'Asosiy rasm va ixtiyoriy galereyani yuklang.')}</p></div>
              <div className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1.5 text-xs font-semibold text-[#21404d] shadow-sm"><Upload size={14} />{tr('Upload', 'Загрузка', 'Yuklash')}</div>
            </div>

            <div className="grid gap-4 md:grid-cols-[1fr_1.2fr]">
              <div className="space-y-3">
                <div className="overflow-hidden rounded-[24px] border border-white/80 bg-[linear-gradient(145deg,#21404d_0%,#3d6c77_58%,#d9a25f_100%)] shadow-[0_20px_40px_rgba(33,64,77,0.16)]"><div className="relative h-48 w-full">{displayPrimaryImage ? <img src={displayPrimaryImage} alt={formState.name || 'Product preview'} className="h-full w-full object-cover" /> : <div className="absolute inset-0 flex items-center justify-center text-white"><div className="text-center"><Package size={30} className="mx-auto" /><p className="mt-2 text-xs font-semibold uppercase tracking-[0.22em] text-white/70">{tr('No primary photo', 'Нет главного фото', 'Asosiy rasm yoq')}</p></div></div>}<div className="absolute inset-x-0 bottom-0 bg-[linear-gradient(180deg,transparent_0%,rgba(0,0,0,0.62)_100%)] px-4 pb-4 pt-10 text-white"><p className="text-sm font-semibold">{formState.name || tr('New product', 'Новый товар', 'Yangi mahsulot')}</p><p className="mt-1 text-xs text-white/75">{formState.size_liters || '-'}L</p></div></div></div>
                <label className="block rounded-2xl border border-dashed border-[#c9b39a] bg-white/70 px-4 py-4 text-sm text-gray-700 shadow-sm cursor-pointer hover:border-[#21404d] transition"><span className="flex items-center gap-2 font-semibold text-[#21404d]"><ImagePlus size={16} /> {tr('Upload primary image', 'Загрузить главное фото', 'Asosiy rasmni yuklash')}</span><span className="mt-1 block text-xs text-gray-500">{primaryImageFile ? primaryImageFile.name : tr('Choose one file for the main image.', 'Выберите один файл для главного изображения.', 'Asosiy rasm uchun bitta fayl tanlang.')}</span><input type="file" accept="image/*" className="hidden" onChange={(event) => setPrimaryImageFile(event.target.files?.[0] || null)} /></label>
                {primaryImageFile ? <button type="button" onClick={() => setPrimaryImageFile(null)} className="inline-flex items-center gap-2 text-sm font-medium text-rose-600 hover:text-rose-700"><X size={14} />{tr('Remove selected file', 'Убрать выбранный файл', 'Tanlangan faylni olib tashlash')}</button> : null}
                {editing && getPrimaryImage(editing) ? <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"><input type="checkbox" checked={removeImage} onChange={(event) => setRemoveImage(event.target.checked)} />{tr('Remove current primary image on save', 'Удалить текущее главное изображение при сохранении', 'Saqlashda joriy asosiy rasmni olib tashlash')}</label> : null}
              </div>

              <div className="space-y-4">
                <div className="rounded-2xl border border-light-border dark:border-navy-700 bg-white/75 p-4 shadow-sm">
                  <div className="flex items-center justify-between gap-3"><div><p className="text-sm font-semibold text-gray-900 dark:text-white">{tr('Gallery', 'Галерея', 'Galereya')}</p><p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{tr('Multiple images improve how products look in admin and WebApp.', 'Несколько изображений улучшают вид товара в админке и WebApp.', 'Bir nechta rasm admin va WebApp ko\'rinishini yaxshilaydi.')}</p></div><label className="cursor-pointer rounded-xl bg-[#21404d] px-3 py-2 text-xs font-semibold text-white hover:bg-[#1a3340] transition">{tr('Add photos', 'Добавить фото', 'Rasm qo\'shish')}<input type="file" accept="image/*" multiple className="hidden" onChange={(event) => setGalleryFiles(Array.from(event.target.files || []))} /></label></div>
                  {editing?.images?.length ? <label className="mt-4 inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"><input type="checkbox" checked={replaceGallery} onChange={(event) => { setReplaceGallery(event.target.checked); if (event.target.checked) setRemoveImageIds([]); }} />{tr('Replace entire gallery on save', 'Полностью заменить галерею при сохранении', 'Saqlashda butun galereyani almashtirish')}</label> : null}
                  <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">{existingGalleryImages.map((image) => <div key={image.id} className="group relative overflow-hidden rounded-2xl border border-light-border bg-gray-50 shadow-sm"><img src={image.url} alt={formState.name || 'Gallery'} className="h-24 w-full object-cover" /><button type="button" onClick={() => setRemoveImageIds((current) => current.includes(image.id) ? current : [...current, image.id])} className="absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition group-hover:opacity-100"><X size={14} /></button></div>)}{galleryPreviewUrls.map((url, index) => <div key={`${url}-${index}`} className="group relative overflow-hidden rounded-2xl border border-primary-blue/30 bg-blue-50 shadow-sm"><img src={url} alt={`Upload ${index + 1}`} className="h-24 w-full object-cover" /><button type="button" onClick={() => setGalleryFiles((current) => current.filter((_, fileIndex) => fileIndex !== index))} className="absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition group-hover:opacity-100"><X size={14} /></button></div>)}{!existingGalleryImages.length && !galleryPreviewUrls.length ? <div className="col-span-full rounded-2xl border border-dashed border-light-border bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">{tr('No gallery photos yet.', 'Пока нет фото галереи.', 'Hali galereya rasmlari yoq.')}</div> : null}</div>
                </div>
                <div className="rounded-2xl border border-light-border dark:border-navy-700 bg-white/75 p-4 shadow-sm"><div className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white"><Link2 size={15} className="text-[#21404d]" />{tr('External image URL', 'Внешний URL изображения', 'Tashqi rasm URL')}</div><p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{tr('Optional fallback if you want to use an existing CDN image instead of uploading.', 'Необязательный вариант, если хотите использовать готовый CDN URL вместо загрузки.', 'Yuklash o\'rniga tayyor CDN rasmini ishlatmoqchi bo\'lsangiz, ixtiyoriy variant.')}</p><input value={formState.image_url} onChange={(event) => setFormState((current) => ({ ...current, image_url: event.target.value }))} placeholder="https://cdn.example.com/product.png" className="mt-3 w-full bg-gray-50 dark:bg-navy-900 border border-light-border dark:border-navy-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-blue dark:text-white" /></div>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-blue-100 bg-blue-50/70 px-4 py-3 text-sm text-blue-800 dark:border-blue-900/40 dark:bg-blue-950/20 dark:text-blue-200">{tr('Use uploads for the best admin and WebApp presentation. URL mode still works as fallback.', 'Для лучшего вида в админке и WebApp используйте загрузку файлов. URL все еще поддерживается как запасной вариант.', 'Admin va WebApp ko\'rinishi uchun fayl yuklash yaxshiroq. URL usuli zaxira sifatida hali ham ishlaydi.')}</div>

          <div className="flex justify-end gap-3 pt-4 border-t border-light-border dark:border-navy-700"><button type="button" onClick={closeModal} className="px-4 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-navy-700 transition-colors">{t('cancel')}</button><button disabled={saving} type="submit" className="px-4 py-2 rounded-lg text-sm font-medium bg-primary-blue text-white hover:bg-blue-600 transition-colors disabled:opacity-50">{saving ? tr('Saving...', 'Сохранение...', 'Saqlanmoqda...') : t('save')}</button></div>
        </form>
      </Modal>

      <Card className="border-amber-200 bg-amber-50/70 dark:bg-navy-800 dark:border-amber-800/40">
        <div className="flex items-start gap-3">
          <AlertTriangle className="text-amber-500 mt-0.5" size={18} />
          <p className="text-xs text-amber-800 dark:text-amber-200">{tr('Product deletion endpoint is not present. Delete now deactivates the product with is_active=false via PATCH /products/{id}/.', 'Эндпоинта удаления товара нет. Удаление теперь деактивирует товар через PATCH /products/{id}/ с is_active=false.', 'Mahsulotni o\'chirish endpointi yo\'q. O\'chirish tugmasi endi PATCH /products/{id}/ orqali is_active=false qilib nofaol qiladi.')}</p>
        </div>
      </Card>
    </div>
  );
};

export default Products;
