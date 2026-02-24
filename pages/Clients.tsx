import React, { useMemo, useState, useEffect } from 'react';
import { Card } from '../components/ui/Card';
import { Modal } from '../components/ui/Modal';
import { Badge } from '../components/ui/Badge';
import { useLanguage } from '../context/LanguageContext';
import { useToast } from '../context/ToastContext';
import { ENDPOINTS, apiRequest } from '../services/api';
import { Edit2, Plus, Search, UserCircle2 } from 'lucide-react';

type Platform = 'telegram' | 'instagram';

interface ClientRow {
  id: string;
  platform: Platform;
  username: string | null;
  full_name: string | null;
  phone: string | null;
  address: string | null;
  preferred_language?: 'en' | 'ru' | 'uz' | null;
  created_at: string;
  updated_at: string;
}

const Clients: React.FC = () => {
  const { t, language } = useLanguage();
  const toast = useToast();
  const tr = (en: string, ru: string, uz: string) => (language === 'ru' ? ru : language === 'uz' ? uz : en);

  const [clients, setClients] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<ClientRow | null>(null);

  const loadClients = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiRequest<{ results?: ClientRow[] } | ClientRow[]>(ENDPOINTS.CLIENTS.LIST);
      const rows = Array.isArray(data) ? data : (data.results || []);
      setClients(rows);
    } catch (e) {
      const message = e instanceof Error ? e.message : tr('Failed to load clients', 'Mijozlarni yuklab bolmadi', 'Mijozlarni yuklab bolmadi');
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadClients();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    const keyword = q.trim().toLowerCase();
    if (!keyword) return clients;
    return clients.filter((c) => (
      (c.full_name || '').toLowerCase().includes(keyword) ||
      (c.phone || '').toLowerCase().includes(keyword) ||
      (c.username || '').toLowerCase().includes(keyword) ||
      (c.address || '').toLowerCase().includes(keyword) ||
      c.id.toLowerCase().includes(keyword)
    ));
  }, [clients, q]);

  const platformLabel = (p: Platform) => (
    p === 'instagram'
      ? tr('Instagram', 'Instagram', 'Instagram')
      : tr('Telegram', 'Telegram', 'Telegram')
  );

  const languageLabel = (lang?: ClientRow['preferred_language']) => {
    if (lang === 'ru') return tr('Russian', 'Русский', 'Ruscha');
    if (lang === 'uz') return tr("Uzbek", 'Uzbek', "O'zbek");
    if (lang === 'en') return tr('English', 'Английский', 'Inglizcha');
    return '-';
  };

  const languageBadgeVariant = (lang?: ClientRow['preferred_language']) => {
    if (lang === 'uz') return 'success' as const;
    if (lang === 'ru') return 'info' as const;
    if (lang === 'en') return 'purple' as const;
    return 'default' as const;
  };

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);

    const payload: Record<string, unknown> = {
      platform: String(form.get('platform') || 'telegram'),
      username: String(form.get('username') || '').trim() || null,
      full_name: String(form.get('full_name') || '').trim() || null,
      phone: String(form.get('phone') || '').trim() || null,
      address: String(form.get('address') || '').trim() || null,
      preferred_language: String(form.get('preferred_language') || '').trim() || null,
    };

    if (editing?.id) {
      payload.client_id = editing.id;
    }

    try {
      setSaving(true);
      setError(null);
      await apiRequest(ENDPOINTS.CLIENTS.UPSERT, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      toast.success(editing ? tr('Client updated', 'Mijoz yangilandi', 'Mijoz yangilandi') : tr('Client created', 'Mijoz yaratildi', 'Mijoz yaratildi'));
      setIsModalOpen(false);
      setEditing(null);
      await loadClients();
    } catch (e) {
      const message = e instanceof Error ? e.message : tr('Failed to save client', 'Mijozni saqlab bolmadi', 'Mijozni saqlab bolmadi');
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center gap-3">
        <h1 className="text-2xl font-bold text-light-text dark:text-white">{t('nav_clients')}</h1>
        <button
          onClick={() => { setEditing(null); setIsModalOpen(true); }}
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
                <th className="px-6 py-4 font-semibold">ID</th>
                <th className="px-6 py-4 font-semibold">{tr('Full Name', 'Toliq ism', 'Toliq ism')}</th>
                <th className="px-6 py-4 font-semibold">{tr('Phone', 'Telefon', 'Telefon')}</th>
                <th className="px-6 py-4 font-semibold">{tr('Username', 'Username', 'Username')}</th>
                <th className="px-6 py-4 font-semibold">{tr('Platform', 'Platforma', 'Platforma')}</th>
                <th className="px-6 py-4 font-semibold">{tr('Language', 'Til', 'Til')}</th>
                <th className="px-6 py-4 font-semibold">{tr('Address', 'Manzil', 'Manzil')}</th>
                <th className="px-6 py-4 font-semibold">{tr('Created', 'Yaratilgan', 'Yaratilgan')}</th>
                <th className="px-6 py-4 font-semibold text-right">{t('actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-light-border dark:divide-navy-700">
              {loading ? (
                <tr><td colSpan={9} className="px-6 py-10 text-center text-gray-400">{tr('Loading clients...', 'Mijozlar yuklanmoqda...', 'Mijozlar yuklanmoqda...')}</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={9} className="px-6 py-10 text-center text-gray-400">{tr('No clients found', 'Mijozlar topilmadi', 'Mijozlar topilmadi')}</td></tr>
              ) : (
                filtered.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-navy-700/50 transition-colors">
                    <td className="px-6 py-4 text-sm font-medium text-primary-blue dark:text-blue-400">{c.id.slice(0, 8)}</td>
                    <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">
                      <div className="inline-flex items-center gap-2">
                        <UserCircle2 size={16} className="text-gray-400" />
                        <span>{c.full_name || '-'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">{c.phone || '-'}</td>
                    <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">{c.username || '-'}</td>
                    <td className="px-6 py-4 text-sm">
                      <Badge variant={c.platform === 'instagram' ? 'warning' : 'info'}>{platformLabel(c.platform)}</Badge>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {c.preferred_language ? (
                        <Badge variant={languageBadgeVariant(c.preferred_language)}>{languageLabel(c.preferred_language)}</Badge>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300 max-w-[240px] truncate" title={c.address || ''}>{c.address || '-'}</td>
                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">{c.created_at ? new Date(c.created_at).toLocaleDateString() : '-'}</td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => { setEditing(c); setIsModalOpen(true); }}
                        className="p-1.5 text-gray-500 hover:text-primary-blue dark:hover:text-blue-400 transition-colors"
                        title={tr('Edit client', 'Mijozni tahrirlash', 'Mijozni tahrirlash')}
                      >
                        <Edit2 size={16} />
                      </button>
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
        title={editing ? tr('Edit Client', 'Mijozni tahrirlash', 'Mijozni tahrirlash') : tr('New Client', 'Yangi mijoz', 'Yangi mijoz')}
        footer={null}
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{tr('Platform', 'Platforma', 'Platforma')}</label>
              <select
                name="platform"
                required
                defaultValue={editing?.platform || 'telegram'}
                className="w-full bg-gray-50 dark:bg-navy-900 border border-light-border dark:border-navy-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-blue dark:text-white"
              >
                <option value="telegram">{tr('Telegram', 'Telegram', 'Telegram')}</option>
                <option value="instagram">{tr('Instagram', 'Instagram', 'Instagram')}</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{tr('Username', 'Username', 'Username')}</label>
              <input
                name="username"
                defaultValue={editing?.username || ''}
                className="w-full bg-gray-50 dark:bg-navy-900 border border-light-border dark:border-navy-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-blue dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{tr('Preferred Language', 'Predpochtitelnyy yazyk', 'Afzal til')}</label>
              <select
                name="preferred_language"
                defaultValue={editing?.preferred_language || ''}
                className="w-full bg-gray-50 dark:bg-navy-900 border border-light-border dark:border-navy-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-blue dark:text-white"
              >
                <option value="">{tr('Not set', 'Ne ukazan', 'Belgilanmagan')}</option>
                <option value="uz">{tr("Uzbek", 'Uzbek', "O'zbek")}</option>
                <option value="ru">{tr('Russian', 'Русский', 'Ruscha')}</option>
                <option value="en">{tr('English', 'Английский', 'Inglizcha')}</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{tr('Full Name', 'Toliq ism', 'Toliq ism')}</label>
            <input
              name="full_name"
              defaultValue={editing?.full_name || ''}
              className="w-full bg-gray-50 dark:bg-navy-900 border border-light-border dark:border-navy-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-blue dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{tr('Phone', 'Telefon', 'Telefon')}</label>
            <input
              name="phone"
              defaultValue={editing?.phone || ''}
              className="w-full bg-gray-50 dark:bg-navy-900 border border-light-border dark:border-navy-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-blue dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{tr('Address', 'Manzil', 'Manzil')}</label>
            <textarea
              name="address"
              defaultValue={editing?.address || ''}
              className="w-full h-24 bg-gray-50 dark:bg-navy-900 border border-light-border dark:border-navy-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-blue dark:text-white"
            />
          </div>

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
              {saving ? tr('Saving...', 'Saqlanmoqda...', 'Saqlanmoqda...') : t('save')}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Clients;
