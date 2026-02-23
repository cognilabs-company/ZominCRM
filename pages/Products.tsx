import React, { useEffect, useState } from 'react';
import { Card } from '../components/ui/Card';
import { Modal } from '../components/ui/Modal';
import { Badge } from '../components/ui/Badge';
import { useLanguage } from '../context/LanguageContext';
import { useToast } from '../context/ToastContext';
import { ENDPOINTS, apiRequest } from '../services/api';
import { Plus, Search, Edit2, Trash2, Package, AlertTriangle } from 'lucide-react';

interface ApiProduct {
  id: string;
  name: string;
  sku: string;
  size_liters: string;
  price_uzs: number;
  count: number;
  min_stock_threshold: number;
  availability_status: 'in_stock' | 'low_stock' | 'out_of_stock';
  is_active: boolean;
  updated_at: string | null;
}

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
    } catch (e) {
      const message = e instanceof Error ? e.message : tr('Failed to load products', 'Mahsulotlarni yuklab bo‘lmadi', 'Mahsulotlarni yuklab bo‘lmadi');
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, [onlyLowStock]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadProducts();
  };

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const payload = {
      name: String(form.get('name') || ''),
      sku: String(form.get('sku') || ''),
      size_liters: String(form.get('size_liters') || ''),
      price_uzs: Number(form.get('price_uzs') || 0),
      count: Number(form.get('count') || 0),
      min_stock_threshold: Number(form.get('min_stock_threshold') || 0),
      is_active: form.get('is_active') === 'on',
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
      await loadProducts();
      toast.success(editing ? tr('Product updated.', 'Mahsulot yangilandi.', 'Mahsulot yangilandi.') : tr('Product created.', 'Mahsulot yaratildi.', 'Mahsulot yaratildi.'));
    } catch (e) {
      const message = e instanceof Error ? e.message : tr('Failed to save product', 'Mahsulotni saqlab bo‘lmadi', 'Mahsulotni saqlab bo‘lmadi');
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async (product: ApiProduct) => {
    if (!window.confirm(tr(`Deactivate "${product.name}"?`, `"${product.name}" mahsulotini nofaol qilinsinmi?`, `"${product.name}" mahsulotini nofaol qilinsinmi?`))) return;
    try {
      await apiRequest(ENDPOINTS.PRODUCTS.DETAIL(product.id), {
        method: 'PATCH',
        body: JSON.stringify({ is_active: false }),
      });
      await loadProducts();
      toast.success(tr('Product deactivated.', 'Mahsulot nofaol qilindi.', 'Mahsulot nofaol qilindi.'));
    } catch (e) {
      const message = e instanceof Error ? e.message : tr('Failed to deactivate product', 'Mahsulotni nofaol qilib bo‘lmadi', 'Mahsulotni nofaol qilib bo‘lmadi');
      setError(message);
      toast.error(message);
    }
  };

  const availabilityBadge = (status: ApiProduct['availability_status']) => {
    if (status === 'in_stock') return <Badge variant="success">{tr('In stock', 'Mavjud', 'Mavjud')}</Badge>;
    if (status === 'low_stock') return <Badge variant="warning">{tr('Low stock', 'Kam qolgan', 'Kam qolgan')}</Badge>;
    return <Badge variant="error">{tr('Out of stock', 'Tugagan', 'Tugagan')}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-light-text dark:text-white">{t('nav_products')}</h1>
        <button
          onClick={() => { setEditing(null); setIsModalOpen(true); }}
          className="px-4 py-2 bg-primary-blue hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
        >
          {t('create')} <Plus size={16} />
        </button>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 text-red-700 px-4 py-3 text-sm">{error}</div>}

      <Card className="!p-0 overflow-hidden">
        <form onSubmit={handleSearch} className="p-4 border-b border-light-border dark:border-navy-700 flex flex-col md:flex-row gap-3 md:items-center md:justify-between bg-white dark:bg-navy-800">
          <div className="relative w-full md:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`${t('search')}...`}
              className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-navy-900 border border-light-border dark:border-navy-600 rounded-lg text-sm focus:outline-none focus:border-primary-blue dark:text-white"
            />
          </div>
          <div className="flex items-center gap-3">
            <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input type="checkbox" checked={onlyLowStock} onChange={(e) => setOnlyLowStock(e.target.checked)} />
              {tr('Low stock only', 'Faqat kam qolgan', 'Faqat kam qolgan')}
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
                <th className="px-6 py-4 font-semibold">{tr('Size (L)', 'Hajm (l)', 'Hajm (l)')}</th>
                <th className="px-6 py-4 font-semibold">{t('price')} (UZS)</th>
                <th className="px-6 py-4 font-semibold">{t('stock')}</th>
                <th className="px-6 py-4 font-semibold">{tr('State', 'Holat', 'Holat')}</th>
                <th className="px-6 py-4 font-semibold text-right">{t('actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-light-border dark:divide-navy-700">
              {loading ? (
                <tr><td colSpan={7} className="py-10 text-center text-gray-400">{tr('Loading products...', 'Mahsulotlar yuklanmoqda...', 'Mahsulotlar yuklanmoqda...')}</td></tr>
              ) : products.length === 0 ? (
                <tr><td colSpan={7} className="py-10 text-center text-gray-400">{tr('No products found.', 'Mahsulotlar topilmadi.', 'Mahsulotlar topilmadi.')}</td></tr>
              ) : (
                products.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-navy-700/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-navy-700 flex items-center justify-center text-gray-400"><Package size={20} /></div>
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">{p.name}</p>
                          <p className="text-xs text-gray-500">{p.id.slice(0, 8)}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">{p.sku || '-'}</td>
                    <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">{p.size_liters}</td>
                    <td className="px-6 py-4 text-sm font-semibold text-gray-900 dark:text-white">{p.price_uzs.toLocaleString()}</td>
                    <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">{p.count}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {availabilityBadge(p.availability_status)}
                        {!p.is_active && (
                          <Badge variant="default">{tr('Inactive', 'Nofaol', 'Nofaol')}</Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button onClick={() => { setEditing(p); setIsModalOpen(true); }} className="p-1.5 text-gray-500 hover:text-primary-blue dark:hover:text-blue-400 transition-colors"><Edit2 size={16} /></button>
                        <button onClick={() => handleDeactivate(p)} className="p-1.5 text-gray-500 hover:text-red-500 dark:hover:text-red-400 transition-colors"><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editing ? tr('Edit Product', 'Mahsulotni tahrirlash', 'Mahsulotni tahrirlash') : tr('Add New Product', "Yangi mahsulot qo'shish", "Yangi mahsulot qo'shish")} footer={null}>
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('product_name')}</label>
            <input name="name" required defaultValue={editing?.name} className="w-full bg-gray-50 dark:bg-navy-900 border border-light-border dark:border-navy-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-blue dark:text-white" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">SKU</label>
              <input name="sku" defaultValue={editing?.sku} className="w-full bg-gray-50 dark:bg-navy-900 border border-light-border dark:border-navy-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-blue dark:text-white" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{tr('Size Liters', 'Hajm (litr)', 'Hajm (litr)')}</label>
              <input name="size_liters" required defaultValue={editing?.size_liters} className="w-full bg-gray-50 dark:bg-navy-900 border border-light-border dark:border-navy-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-blue dark:text-white" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('price')} (UZS)</label>
              <input name="price_uzs" type="number" required defaultValue={editing?.price_uzs} className="w-full bg-gray-50 dark:bg-navy-900 border border-light-border dark:border-navy-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-blue dark:text-white" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('stock')}</label>
              <input name="count" type="number" required defaultValue={editing?.count} className="w-full bg-gray-50 dark:bg-navy-900 border border-light-border dark:border-navy-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-blue dark:text-white" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{tr('Min Threshold', 'Minimal chegara', 'Minimal chegara')}</label>
              <input name="min_stock_threshold" type="number" required defaultValue={editing?.min_stock_threshold} className="w-full bg-gray-50 dark:bg-navy-900 border border-light-border dark:border-navy-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-blue dark:text-white" />
            </div>
          </div>
          <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input name="is_active" type="checkbox" defaultChecked={editing ? editing.is_active : true} />
            {tr('Active', 'Faol', 'Faol')}
          </label>
          <div className="flex justify-end gap-3 pt-4 border-t border-light-border dark:border-navy-700">
            <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-navy-700 transition-colors">{t('cancel')}</button>
            <button disabled={saving} type="submit" className="px-4 py-2 rounded-lg text-sm font-medium bg-primary-blue text-white hover:bg-blue-600 transition-colors disabled:opacity-50">{saving ? tr('Saving...', 'Saqlanmoqda...', 'Saqlanmoqda...') : t('save')}</button>
          </div>
        </form>
      </Modal>

      <Card className="border-amber-200 bg-amber-50/70 dark:bg-navy-800 dark:border-amber-800/40">
        <div className="flex items-start gap-3">
          <AlertTriangle className="text-amber-500 mt-0.5" size={18} />
          <p className="text-xs text-amber-800 dark:text-amber-200">
            {tr(
              'Product deletion endpoint is not present. "Delete" now deactivates (`is_active=false`) via `PATCH /products/{id}/`.',
              "Mahsulotni o'chirish endpointi yo'q. O'chirish tugmasi mahsulotni `PATCH /products/{id}/` orqali nofaol qiladi (`is_active=false`).",
              "Mahsulotni o'chirish endpointi yo'q. O'chirish tugmasi mahsulotni `PATCH /products/{id}/` orqali nofaol qiladi (`is_active=false`)."
            )}
          </p>
        </div>
      </Card>
    </div>
  );
};

export default Products;
