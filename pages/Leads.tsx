import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../components/ui/Card';
import { Modal } from '../components/ui/Modal';
import { Badge } from '../components/ui/Badge';
import { useLanguage } from '../context/LanguageContext';
import { useToast } from '../context/ToastContext';
import { ENDPOINTS, apiRequest } from '../services/api';
import { Plus, Edit2, Send, Instagram, MessageCircle } from 'lucide-react';

type LeadStatus = 'NEW' | 'QUALIFIED' | 'CONVERTED' | 'LOST';

interface Lead {
  id: string;
  client_id: string;
  source: string;
  status: LeadStatus;
  notes: string;
  created_at: string;
}

interface Client {
  id: string;
  full_name: string | null;
  phone: string | null;
}

const Leads: React.FC = () => {
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const toast = useToast();
  const tr = (en: string, ru: string, uz: string) => (language === 'ru' ? ru : language === 'uz' ? uz : en);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<Lead | null>(null);

  const statusLabel = (status: LeadStatus) => {
    const labels: Record<LeadStatus, Record<'en' | 'ru' | 'uz', string>> = {
      NEW: { en: 'New', ru: 'Новый', uz: 'Yangi' },
      QUALIFIED: { en: 'Qualified', ru: 'Квалифицирован', uz: 'Saralangan' },
      CONVERTED: { en: 'Converted', ru: 'Конвертирован', uz: 'Konvert qilingan' },
      LOST: { en: 'Lost', ru: 'Потерян', uz: "Yo'qotilgan" },
    };
    return labels[status][language];
  };

  const statusVariant = (status: LeadStatus) => {
    if (status === 'CONVERTED') return 'success';
    if (status === 'QUALIFIED') return 'info';
    if (status === 'LOST') return 'error';
    return 'warning';
  };

  const getLeadSourceMeta = (source: string) => {
    const normalized = String(source || '').trim().toLowerCase();
    if (normalized.includes('telegram')) {
      return {
        label: tr('Telegram', 'Telegram', 'Telegram'),
        icon: Send,
        className:
          'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-900/20 dark:text-sky-300 dark:border-sky-800/50',
      };
    }
    if (normalized.includes('instagram') || normalized === 'ig') {
      return {
        label: tr('Instagram', 'Instagram', 'Instagram'),
        icon: Instagram,
        className:
          'bg-pink-50 text-pink-700 border-pink-200 dark:bg-pink-900/20 dark:text-pink-300 dark:border-pink-800/50',
      };
    }
    return null;
  };

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [leadsData, clientsData] = await Promise.all([
        apiRequest<{ results?: Lead[] }>(ENDPOINTS.LEADS.LIST),
        apiRequest<{ results?: Client[] }>(ENDPOINTS.CLIENTS.LIST),
      ]);
      setLeads(leadsData.results || []);
      setClients(clientsData.results || []);
    } catch (e) {
      const message = e instanceof Error ? e.message : tr('Failed to load leads', 'Не удалось загрузить лиды', 'Lidlarni yuklab bo‘lmadi');
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const findClientLabel = (clientId: string) => {
    const c = clients.find((x) => x.id === clientId);
    return c?.full_name || c?.phone || clientId.slice(0, 8);
  };

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const payload = {
      lead_id: editing?.id,
      client_id: String(form.get('client_id') || ''),
      source: String(form.get('source') || ''),
      status: String(form.get('status') || 'NEW'),
      notes: String(form.get('notes') || ''),
    };

    try {
      setSaving(true);
      setError(null);
      await apiRequest(ENDPOINTS.LEADS.UPSERT, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setIsModalOpen(false);
      setEditing(null);
      await loadData();
      toast.success(editing ? tr('Lead updated.', 'Лид обновлён.', 'Lid yangilandi.') : tr('Lead created.', 'Лид создан.', 'Lid yaratildi.'));
    } catch (e) {
      const message = e instanceof Error ? e.message : tr('Failed to save lead', 'Не удалось сохранить лид', 'Lidni saqlab bo‘lmadi');
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-light-text dark:text-white">{t('nav_leads')}</h1>
        <button
          onClick={() => {
            setEditing(null);
            setIsModalOpen(true);
          }}
          className="px-4 py-2 bg-primary-blue hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
        >
          {t('create')} <Plus size={16} />
        </button>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 text-red-700 px-4 py-3 text-sm">{error}</div>}

      <Card className="!p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 dark:bg-navy-900/50 text-xs uppercase text-gray-500 dark:text-gray-400 border-b border-light-border dark:border-navy-700">
                <th className="px-6 py-4 font-semibold">{tr('Lead ID', 'ID лида', 'Lid ID')}</th>
                <th className="px-6 py-4 font-semibold">{t('nav_clients')}</th>
                <th className="px-6 py-4 font-semibold">{tr('Source', 'Платформа', 'Platforma')}</th>
                <th className="px-6 py-4 font-semibold">{t('status')}</th>
                <th className="px-6 py-4 font-semibold">{tr('Created', 'Создан', 'Yaratilgan')}</th>
                <th className="px-6 py-4 font-semibold text-right">{t('actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-light-border dark:divide-navy-700">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-gray-400">
                    {tr('Loading leads...', 'Лиды загружаются...', 'Lidlar yuklanmoqda...')}
                  </td>
                </tr>
              ) : leads.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-gray-400">
                    {tr('No leads found.', 'Лиды не найдены.', 'Lidlar topilmadi.')}
                  </td>
                </tr>
              ) : (
                leads.map((lead) => {
                  const sourceMeta = getLeadSourceMeta(lead.source);
                  const SourceIcon = sourceMeta?.icon;
                  return (
                    <tr key={lead.id} className="hover:bg-gray-50 dark:hover:bg-navy-700/50 transition-colors">
                      <td className="px-6 py-4 text-sm font-medium text-primary-blue dark:text-blue-400">{lead.id.slice(0, 8)}</td>
                      <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">{findClientLabel(lead.client_id)}</td>
                      <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">
                        {sourceMeta && SourceIcon ? (
                          <span className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-full border text-xs font-medium ${sourceMeta.className}`}>
                            <SourceIcon size={13} />
                            {sourceMeta.label}
                          </span>
                        ) : (
                          lead.source || '-'
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant={statusVariant(lead.status) as any}>{statusLabel(lead.status)}</Badge>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">{new Date(lead.created_at).toLocaleDateString()}</td>
                      <td className="px-6 py-4 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => navigate(`/conversations?client_id=${encodeURIComponent(lead.client_id)}`)}
                            className="inline-flex items-center gap-1 rounded-md border border-light-border dark:border-navy-600 px-2 py-1 text-xs text-gray-600 hover:text-primary-blue hover:border-blue-300 dark:text-gray-300 dark:hover:text-blue-400 dark:hover:border-blue-700 transition-colors"
                            title={tr('Go to chat', 'Открыть чат', 'Chatga o‘tish')}
                          >
                            <MessageCircle size={13} />
                            <span className="hidden sm:inline">{tr('Chat', 'Chat', 'Chat')}</span>
                          </button>
                          <button
                            onClick={() => {
                              setEditing(lead);
                              setIsModalOpen(true);
                            }}
                            className="p-1.5 text-gray-500 hover:text-primary-blue dark:hover:text-blue-400 transition-colors"
                            title={tr('Edit lead', 'Редактировать лид', 'Lidni tahrirlash')}
                          >
                            <Edit2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editing ? tr('Edit Lead', 'Редактировать лид', 'Lidni tahrirlash') : tr('New Lead', 'Новый лид', 'Yangi lid')}
        footer={null}
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('nav_clients')}</label>
            <select
              name="client_id"
              required
              defaultValue={editing?.client_id || ''}
              className="w-full bg-gray-50 dark:bg-navy-900 border border-light-border dark:border-navy-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-blue dark:text-white"
            >
              <option value="">{tr('Select client', 'Выберите клиента', 'Mijozni tanlang')}</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.full_name || c.phone || c.id}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{tr('Source', 'Платформа', 'Platforma')}</label>
            <input
              name="source"
              defaultValue={editing?.source || ''}
              placeholder="telegram / instagram"
              className="w-full bg-gray-50 dark:bg-navy-900 border border-light-border dark:border-navy-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-blue dark:text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('status')}</label>
            <select
              name="status"
              defaultValue={editing?.status || 'NEW'}
              className="w-full bg-gray-50 dark:bg-navy-900 border border-light-border dark:border-navy-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-blue dark:text-white"
            >
              <option value="NEW">{statusLabel('NEW')}</option>
              <option value="QUALIFIED">{statusLabel('QUALIFIED')}</option>
              <option value="CONVERTED">{statusLabel('CONVERTED')}</option>
              <option value="LOST">{statusLabel('LOST')}</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{tr('Notes', 'Заметки', 'Izohlar')}</label>
            <textarea
              name="notes"
              defaultValue={editing?.notes || ''}
              className="w-full bg-gray-50 dark:bg-navy-900 border border-light-border dark:border-navy-600 rounded-lg px-3 py-2 text-sm h-24 resize-none focus:outline-none focus:border-primary-blue dark:text-white"
            />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-light-border dark:border-navy-700">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 rounded-lg text-sm border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-navy-600 dark:bg-navy-800 dark:text-gray-100 dark:hover:bg-navy-700 transition-colors"
            >
              {t('cancel')}
            </button>
            <button
              disabled={saving}
              type="submit"
              className="px-4 py-2 rounded-lg text-sm font-medium bg-primary-blue text-white hover:bg-blue-600 transition-colors disabled:opacity-50"
            >
              {saving ? tr('Saving...', 'Сохранение...', 'Saqlanmoqda...') : t('save')}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Leads;
