import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Edit2, Package, Plus, Search, Trash2 } from 'lucide-react';
import { Badge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';
import { Modal } from '../components/ui/Modal';
import { useLanguage } from '../context/LanguageContext';
import { useToast } from '../context/ToastContext';
import { ENDPOINTS, apiRequest } from '../services/api';

interface ApiProduct {
  id: string;
  name: string;
  sku: string;
  image_url?: string | null;
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

const emptyForm = {
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
  const [formState, setFormState] = useState(emptyForm);

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

  const handleSearch = (event: React.FormEvent) => {
    event.preventDefault();
    void loadProducts();
  };

  useEffect(() => {
    if (!editing) {
      setFormState(emptyForm);
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
  }, [editing]);

  const openCreate = () => {
    setEditing(null);
    setFormState(emptyForm);
    setIsModalOpen(true);
  };

  const openEdit = (product: ApiProduct) => {
    setEditing(product);
    setIsModalOpen(true);
  };

  const handleSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const payload = {
      name: formState.name.trim(),
      sku: formState.sku,
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

    try {
      setSaving(true);
      setError(null);

      if (editing) {
        await apiRequest(ENDPOINTS.PRODUCTS.DETAIL(editing.id), {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
      } else {
        await apiRequest(ENDPOINTS.PRODUCTS.LIST_CREATE, {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }

      setIsModalOpen(false);
      setEditing(null);
      setFormState(emptyForm);
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
    if (!window.confirm(tr(`Deactivate \"${product.name}\"?`, `Деактивировать \"${product.name}\"?`, `\"${product.name}\" mahsulotini nofaol qilinsinmi?`))) return;

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

  const availabilityBadge = (status: ApiProduct['availability_status']) => {
    if (status === 'in_stock') return <Badge variant="success">{tr('In stock', 'В наличии', 'Mavjud')}</Badge>;
    if (status === 'low_stock') return <Badge variant="warning">{tr('Low stock', 'Мало осталось', 'Kam qolgan')}</Badge>;
    return <Badge variant="error">{tr('Out of stock', 'Нет в наличии', 'Tugagan')}</Badge>;
  };

  const activeCount = useMemo(() => products.filter((product) => product.is_active !== false).length, [products]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-light-text dark:text-white">{t('nav_products')}</h1>
        <button
          onClick={openCreate}
          className="px-4 py-2 bg-primary-blue hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
        >
          {t('create')} <Plus size={16} />
        </button>
      </div>

      {error ? <div className="rounded-lg border border-red-200 bg-red-50 text-red-700 px-4 py-3 text-sm">{error}</div> : null}

      <Card className="!p-0 overflow-hidden">
        <form onSubmit={handleSearch} className="p-4 border-b border-light-border dark:border-navy-700 flex flex-col gap-3 bg-white dark:bg-navy-800">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-white">{tr('Products catalog', 'Каталог товаров', 'Mahsulotlar katalogi')}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {tr('Active products', 'Активные товары', 'Faol mahsulotlar')}: {activeCount} · {tr('Total', 'Всего', 'Jami')}: {products.length}
              </p>
            </div>
            <div className="relative w-full lg:max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={`${t('search')}...`}
                className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-navy-900 border border-light-border dark:border-navy-600 rounded-lg text-sm focus:outline-none focus:border-primary-blue dark:text-white"
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input type="checkbox" checked={onlyLowStock} onChange={(event) => setOnlyLowStock(event.target.checked)} />
              {tr('Low stock only', 'Только с низким остатком', 'Faqat kam qolganlar')}
            </label>
            <button type="submit" className="px-3 py-2 bg-gray-100 dark:bg-navy-700 rounded-lg text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-navy-600">
              {t('search')}
            </button>
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
                products.map((product) => (
                  <tr key={product.id} className="hover:bg-gray-50 dark:hover:bg-navy-700/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 overflow-hidden rounded-lg bg-gray-100 dark:bg-navy-700 flex items-center justify-center text-gray-400 shrink-0">
                          {product.image_url ? (
                            <img
                              src={product.image_url}
                              alt={product.name}
                              className="h-full w-full object-cover"
                              onError={(event) => {
                                event.currentTarget.style.display = 'none';
                                const fallback = event.currentTarget.nextElementSibling as HTMLElement | null;
                                if (fallback) fallback.style.display = 'flex';
                              }}
                            />
                          ) : null}
                          <div className={`h-full w-full items-center justify-center ${product.image_url ? 'hidden' : 'flex'}`}>
                            <Package size={20} />
                          </div>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">{product.name}</p>
                          <p className="text-xs text-gray-500">{product.id.slice(0, 8)}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">{product.sku || '-'}</td>
                    <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">{product.size_liters || '-'}</td>
                    <td className="px-6 py-4 text-sm font-semibold text-gray-900 dark:text-white">{product.price_uzs.toLocaleString()}</td>
                    <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">
                      <div>
                        <p>{product.count}</p>
                        <p className="text-xs text-gray-500">{tr('Min', 'Мин', 'Min')}: {product.min_stock_threshold}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {product.requires_returnable_bottle ? (
                        <Badge variant="info">{tr('Returnable', 'Возвратная', 'Qaytariladigan')}</Badge>
                      ) : (
                        <Badge variant="default">{tr('No bottle', 'Без тары', 'Idishsiz')}</Badge>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-700 dark:text-gray-300">
                      {product.requires_returnable_bottle ? `${product.bottle_deposit_uzs.toLocaleString()} UZS` : '-'}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap items-center gap-2">
                        {availabilityBadge(product.availability_status)}
                        {product.is_active === false ? <Badge variant="default">{tr('Inactive', 'Неактивный', 'Nofaol')}</Badge> : null}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button onClick={() => openEdit(product)} className="p-1.5 text-gray-500 dark:text-gray-300 hover:text-primary-blue dark:hover:text-blue-400 transition-colors"><Edit2 size={16} /></button>
                        <button onClick={() => void handleDeactivate(product)} className="p-1.5 text-gray-500 dark:text-gray-300 hover:text-red-500 dark:hover:text-red-400 transition-colors"><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editing ? tr('Edit Product', 'Редактировать товар', 'Mahsulotni tahrirlash') : tr('Add New Product', 'Добавить товар', 'Yangi mahsulot qo\'shish')} footer={null}>
        <form onSubmit={handleSave} className="space-y-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('product_name')}</label>
              <input value={formState.name} onChange={(event) => setFormState((current) => ({ ...current, name: event.target.value }))} required className="w-full bg-gray-50 dark:bg-navy-900 border border-light-border dark:border-navy-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-blue dark:text-white" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">SKU</label>
              <input value={formState.sku} onChange={(event) => setFormState((current) => ({ ...current, sku: event.target.value }))} placeholder={tr('Leave empty to auto-generate', 'Оставьте пустым для автогенерации', 'Avto yaratish uchun bo\'sh qoldiring')} className="w-full bg-gray-50 dark:bg-navy-900 border border-light-border dark:border-navy-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-blue dark:text-white" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{tr('Image URL', 'URL изображения', 'Rasm URL')}</label>
              <input value={formState.image_url} onChange={(event) => setFormState((current) => ({ ...current, image_url: event.target.value }))} placeholder="https://cdn.example.com/product.png" className="w-full bg-gray-50 dark:bg-navy-900 border border-light-border dark:border-navy-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-blue dark:text-white" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{tr('Size liters', 'Объем (литр)', 'Hajmi (litr)')}</label>
              <input value={formState.size_liters} onChange={(event) => setFormState((current) => ({ ...current, size_liters: event.target.value }))} required className="w-full bg-gray-50 dark:bg-navy-900 border border-light-border dark:border-navy-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-blue dark:text-white" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('price')} (UZS)</label>
              <input type="number" min="0" value={formState.price_uzs} onChange={(event) => setFormState((current) => ({ ...current, price_uzs: event.target.value }))} required className="w-full bg-gray-50 dark:bg-navy-900 border border-light-border dark:border-navy-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-blue dark:text-white" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('stock')}</label>
              <input type="number" min="0" value={formState.count} onChange={(event) => setFormState((current) => ({ ...current, count: event.target.value }))} required className="w-full bg-gray-50 dark:bg-navy-900 border border-light-border dark:border-navy-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-blue dark:text-white" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{tr('Min threshold', 'Минимальный порог', 'Minimal chegara')}</label>
              <input type="number" min="0" value={formState.min_stock_threshold} onChange={(event) => setFormState((current) => ({ ...current, min_stock_threshold: event.target.value }))} required className="w-full bg-gray-50 dark:bg-navy-900 border border-light-border dark:border-navy-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-blue dark:text-white" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{tr('Bottle deposit (UZS)', 'Депозит за тару (UZS)', 'Idish depoziti (UZS)')}</label>
              <input type="number" min="0" value={formState.bottle_deposit_uzs} onChange={(event) => setFormState((current) => ({ ...current, bottle_deposit_uzs: event.target.value }))} disabled={!formState.requires_returnable_bottle} className="w-full bg-gray-50 dark:bg-navy-900 border border-light-border dark:border-navy-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-blue dark:text-white disabled:opacity-50" />
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input type="checkbox" checked={formState.requires_returnable_bottle} onChange={(event) => setFormState((current) => ({ ...current, requires_returnable_bottle: event.target.checked, bottle_deposit_uzs: event.target.checked ? current.bottle_deposit_uzs : '0' }))} />
              {tr('Requires returnable bottle', 'Требует возвратную тару', 'Qaytariladigan idish talab qiladi')}
            </label>
            <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input type="checkbox" checked={formState.is_active} onChange={(event) => setFormState((current) => ({ ...current, is_active: event.target.checked }))} />
              {tr('Active', 'Активный', 'Faol')}
            </label>
          </div>

          <div className="rounded-lg border border-blue-100 bg-blue-50/70 px-4 py-3 text-sm text-blue-800 dark:border-blue-900/40 dark:bg-blue-950/20 dark:text-blue-200">
            {tr(
              'Leave SKU empty to let backend regenerate it. Bottle deposit is applied only when returnable bottle is enabled.',
              'Оставьте SKU пустым, чтобы backend сгенерировал его заново. Депозит применяется только если включена возвратная тара.',
              'SKU maydonini bo\'sh qoldirsangiz, backend uni qayta yaratadi. Depozit faqat qaytariladigan idish yoqilganda ishlaydi.'
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-light-border dark:border-navy-700">
            <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-navy-700 transition-colors">{t('cancel')}</button>
            <button disabled={saving} type="submit" className="px-4 py-2 rounded-lg text-sm font-medium bg-primary-blue text-white hover:bg-blue-600 transition-colors disabled:opacity-50">{saving ? tr('Saving...', 'Сохранение...', 'Saqlanmoqda...') : t('save')}</button>
          </div>
        </form>
      </Modal>

      <Card className="border-amber-200 bg-amber-50/70 dark:bg-navy-800 dark:border-amber-800/40">
        <div className="flex items-start gap-3">
          <AlertTriangle className="text-amber-500 mt-0.5" size={18} />
          <p className="text-xs text-amber-800 dark:text-amber-200">
            {tr(
              'Product deletion endpoint is not present. Delete now deactivates the product with is_active=false via PATCH /products/{id}/.',
              'Эндпоинта удаления товара нет. Удаление теперь деактивирует товар через PATCH /products/{id}/ с is_active=false.',
              'Mahsulotni o\'chirish endpointi yo\'q. O\'chirish tugmasi endi PATCH /products/{id}/ orqali is_active=false qilib nofaol qiladi.'
            )}
          </p>
        </div>
      </Card>
    </div>
  );
};

export default Products;
