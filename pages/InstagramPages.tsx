import React, { useEffect, useMemo, useState } from 'react';
import { Card } from '../components/ui/Card';
import { Modal } from '../components/ui/Modal';
import { Badge } from '../components/ui/Badge';
import { useLanguage } from '../context/LanguageContext';
import { useToast } from '../context/ToastContext';
import { ENDPOINTS, apiRequest } from '../services/api';
import { Edit2, Plus, Search, Trash2, Instagram, KeyRound } from 'lucide-react';

interface InstagramPageCredential {
  id: string;
  page_id: string;
  page_name?: string | null;
  access_token?: string | null;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

const maskToken = (token?: string | null) => {
  const raw = String(token || '');
  if (!raw) return '-';
  if (raw.length <= 10) return '********';
  return `${raw.slice(0, 6)}...${raw.slice(-4)}`;
};

const InstagramPages: React.FC = () => {
  const { t, language } = useLanguage();
  const toast = useToast();
  const tr = (en: string, ru: string, uz: string) => (language === 'ru' ? ru : language === 'uz' ? uz : en);

  const [rows, setRows] = useState<InstagramPageCredential[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [error, setError] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<InstagramPageCredential | null>(null);

  const loadRows = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiRequest<{ results?: InstagramPageCredential[] } | InstagramPageCredential[]>(ENDPOINTS.INSTAGRAM.PAGES);
      const list = Array.isArray(data) ? data : (data.results || []);
      setRows(list);
    } catch (e) {
      const message = e instanceof Error ? e.message : tr('Failed to load Instagram pages', 'Failed to load Instagram pages', 'Instagram sahifalarni yuklab bolmadi');
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRows();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const filteredRows = useMemo(() => {
    const keyword = q.trim().toLowerCase();
    if (!keyword) return rows;
    return rows.filter((row) => (
      (row.page_id || '').toLowerCase().includes(keyword) ||
      (row.page_name || '').toLowerCase().includes(keyword)
    ));
  }, [rows, q]);

  const openCreate = () => {
    setEditing(null);
    setIsModalOpen(true);
  };

  const openEdit = (row: InstagramPageCredential) => {
    setEditing(row);
    setIsModalOpen(true);
  };

  const onSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const payload = {
      page_id: String(form.get('page_id') || '').trim(),
      page_name: String(form.get('page_name') || '').trim(),
      access_token: String(form.get('access_token') || '').trim(),
      is_active: form.get('is_active') === 'on',
    };

    try {
      setSaving(true);
      setError(null);
      if (editing) {
        await apiRequest(ENDPOINTS.INSTAGRAM.PAGE_DETAIL(editing.id), {
          method: 'PATCH',
          body: JSON.stringify({
            page_name: payload.page_name,
            access_token: payload.access_token,
            is_active: payload.is_active,
          }),
        });
      } else {
        await apiRequest(ENDPOINTS.INSTAGRAM.PAGES, {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }

      toast.success(editing ? tr('Instagram page updated', 'Instagram page updated', 'Instagram sahifa yangilandi') : tr('Instagram page created', 'Instagram page created', 'Instagram sahifa yaratildi'));
      setIsModalOpen(false);
      setEditing(null);
      await loadRows();
    } catch (e) {
      const message = e instanceof Error ? e.message : tr('Failed to save Instagram page', 'Failed to save Instagram page', 'Instagram sahifani saqlab bolmadi');
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (row: InstagramPageCredential) => {
    const ok = window.confirm(tr('Delete this Instagram page credential?', 'Delete this Instagram page credential?', 'Instagram credential ochirilsinmi?'));
    if (!ok) return;
    try {
      setDeletingId(row.id);
      await apiRequest(ENDPOINTS.INSTAGRAM.PAGE_DETAIL(row.id), { method: 'DELETE' });
      toast.success(tr('Instagram page deleted', 'Instagram page deleted', 'Instagram sahifa ochirildi'));
      setRows((prev) => prev.filter((x) => x.id !== row.id));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : tr('Failed to delete Instagram page', 'Failed to delete Instagram page', 'Instagram sahifani ochirib bolmadi'));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-light-text dark:text-white inline-flex items-center gap-2">
          <Instagram size={24} className="text-pink-500" />
          {tr('Instagram Pages', 'Instagram Pages', 'Instagram sahifalari')}
        </h1>
        <button
          onClick={openCreate}
          className="px-4 py-2 bg-primary-blue hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
        >
          {t('create')} <Plus size={16} />
        </button>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 text-red-700 px-4 py-3 text-sm">{error}</div>}

      <Card className="!p-0 overflow-hidden">
        <div className="p-4 border-b border-light-border dark:border-navy-700 bg-white dark:bg-navy-800">
          <div className="relative w-full md:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={`${t('search')}...`}
              className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-navy-900 border border-light-border dark:border-navy-600 rounded-lg text-sm focus:outline-none focus:border-primary-blue dark:text-white"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 dark:bg-navy-900/50 text-xs uppercase text-gray-500 dark:text-gray-400 border-b border-light-border dark:border-navy-700">
                <th className="px-6 py-4 font-semibold">Page ID</th>
                <th className="px-6 py-4 font-semibold">{tr('Page Name', 'Page Name', 'Sahifa nomi')}</th>
                <th className="px-6 py-4 font-semibold">{tr('Access Token', 'Access Token', 'Access token')}</th>
                <th className="px-6 py-4 font-semibold">{tr('Status', 'Status', 'Holat')}</th>
                <th className="px-6 py-4 font-semibold">{tr('Updated', 'Updated', 'Yangilangan')}</th>
                <th className="px-6 py-4 font-semibold text-right">{t('actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-light-border dark:divide-navy-700">
              {loading ? (
                <tr><td colSpan={6} className="px-6 py-10 text-center text-gray-400">{tr('Loading Instagram pages...', 'Loading Instagram pages...', 'Instagram sahifalar yuklanmoqda...')}</td></tr>
              ) : filteredRows.length === 0 ? (
                <tr><td colSpan={6} className="px-6 py-10 text-center text-gray-400">{tr('No pages found', 'No pages found', 'Sahifalar topilmadi')}</td></tr>
              ) : (
                filteredRows.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50 dark:hover:bg-navy-700/50 transition-colors">
                    <td className="px-6 py-4 text-sm font-medium text-primary-blue dark:text-blue-400">{row.page_id}</td>
                    <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">{row.page_name || '-'}</td>
                    <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">
                      <span className="inline-flex items-center gap-1 rounded-md bg-gray-100 dark:bg-navy-700 px-2 py-1 text-xs font-mono">
                        <KeyRound size={12} />
                        {maskToken(row.access_token)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <Badge variant={row.is_active ? 'success' : 'default'}>
                        {row.is_active ? tr('Active', 'Active', 'Faol') : tr('Inactive', 'Inactive', 'Nofaol')}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">{row.updated_at ? new Date(row.updated_at).toLocaleString() : '-'}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="inline-flex items-center gap-2">
                        <button onClick={() => openEdit(row)} className="p-1.5 text-gray-500 dark:text-gray-300 hover:text-primary-blue dark:hover:text-blue-400 transition-colors" title={tr('Edit', 'Edit', 'Tahrirlash')}>
                          <Edit2 size={16} />
                        </button>
                        <button onClick={() => onDelete(row)} disabled={deletingId === row.id} className="p-1.5 text-gray-500 dark:text-gray-300 hover:text-red-600 dark:hover:text-red-400 transition-colors disabled:opacity-50" title={tr('Delete', 'Delete', 'Ochirish')}>
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setEditing(null); }}
        title={editing ? tr('Edit Instagram Page', 'Edit Instagram Page', 'Instagram sahifani tahrirlash') : tr('New Instagram Page', 'New Instagram Page', 'Yangi Instagram sahifa')}
        footer={null}
      >
        <form onSubmit={onSave} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Page ID</label>
            <input
              name="page_id"
              required
              disabled={!!editing}
              defaultValue={editing?.page_id || ''}
              className="w-full bg-gray-50 dark:bg-navy-900 border border-light-border dark:border-navy-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-blue dark:text-white disabled:opacity-60"
            />
            {editing && (
              <p className="text-[11px] text-gray-500 mt-1">{tr('Page ID cannot be changed in edit mode', 'Page ID cannot be changed in edit mode', 'Edit rejimida Page ID ozgarmaydi')}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{tr('Page Name', 'Page Name', 'Sahifa nomi')}</label>
            <input
              name="page_name"
              defaultValue={editing?.page_name || ''}
              className="w-full bg-gray-50 dark:bg-navy-900 border border-light-border dark:border-navy-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-blue dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{tr('Access Token', 'Access Token', 'Access token')}</label>
            <textarea
              name="access_token"
              defaultValue={editing?.access_token || ''}
              className="w-full h-24 bg-gray-50 dark:bg-navy-900 border border-light-border dark:border-navy-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-blue dark:text-white font-mono"
            />
          </div>

          <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input name="is_active" type="checkbox" defaultChecked={editing ? editing.is_active : true} />
            {tr('Active', 'Active', 'Faol')}
          </label>

          <div className="flex justify-end gap-3 pt-4 border-t border-light-border dark:border-navy-700">
            <button
              type="button"
              onClick={() => { setIsModalOpen(false); setEditing(null); }}
              className="px-4 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-navy-700 transition-colors"
            >
              {t('cancel')}
            </button>
            <button
              disabled={saving}
              type="submit"
              className="px-4 py-2 rounded-lg text-sm font-medium bg-primary-blue text-white hover:bg-blue-600 transition-colors disabled:opacity-50"
            >
              {saving ? tr('Saving...', 'Saving...', 'Saqlanmoqda...') : t('save')}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default InstagramPages;

