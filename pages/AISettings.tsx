import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../components/ui/Card';
import { Switch } from '../components/ui/Switch';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { ApiError, ENDPOINTS, apiRequest } from '../services/api';
import { Bot, KeyRound, PlayCircle, Settings2, MessageSquare, Power, RefreshCw } from 'lucide-react';

interface ConversationRow {
  id: string;
  channel: 'telegram' | 'instagram';
  client_name?: string | null;
  external_thread_id?: string;
}

interface GlobalAutomationSettings {
  id: string;
  singleton_key: string;
  is_bot_paused: boolean;
  pause_until: string | null;
  paused_by_user_id: string;
  pause_reason: string;
  followups_enabled: boolean;
  created_at?: string;
  updated_at?: string;
}

interface GlobalFormState {
  is_bot_paused: boolean;
  followups_enabled: boolean;
  pause_for_minutes: number;
  pause_reason: string;
}

const AISettings: React.FC = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const { language } = useLanguage();
  const { isAdmin } = useAuth();
  const tr = useCallback(
    (en: string, ru: string, uz: string) => (language === 'ru' ? ru : language === 'uz' ? uz : en),
    [language]
  );

  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState('');
  const [loadingConversations, setLoadingConversations] = useState(true);

  const [globalLoading, setGlobalLoading] = useState(true);
  const [globalSaving, setGlobalSaving] = useState(false);
  const [globalResuming, setGlobalResuming] = useState(false);
  const [globalSettings, setGlobalSettings] = useState<GlobalAutomationSettings | null>(null);
  const [globalForm, setGlobalForm] = useState<GlobalFormState>({
    is_bot_paused: false,
    followups_enabled: true,
    pause_for_minutes: 10,
    pause_reason: '',
  });

  const handleAuthFailure = useCallback((e: unknown) => {
    if (e instanceof ApiError && e.status === 401) {
      navigate('/login', { replace: true });
      return true;
    }
    if (e instanceof ApiError && e.status === 403) {
      navigate('/403', { replace: true });
      return true;
    }
    return false;
  }, [navigate]);

  const loadGlobalSettings = useCallback(async () => {
    try {
      setGlobalLoading(true);
      const response = await apiRequest<{ settings?: GlobalAutomationSettings }>(ENDPOINTS.AUTOMATION.SETTINGS);
      const settings = response.settings || null;
      setGlobalSettings(settings);
      if (settings) {
        setGlobalForm((prev) => ({
          ...prev,
          is_bot_paused: settings.is_bot_paused,
          followups_enabled: settings.followups_enabled,
          pause_reason: settings.pause_reason || '',
        }));
      }
    } catch (e) {
      if (handleAuthFailure(e)) return;
      toast.error(e instanceof Error ? e.message : tr('Failed to load global automation settings', 'Global automation sozlamalarini yuklab bolmadi', 'Global automation sozlamalarini yuklab bolmadi'));
    } finally {
      setGlobalLoading(false);
    }
  }, [handleAuthFailure, toast, tr]);

  const loadConversations = useCallback(async () => {
    try {
      setLoadingConversations(true);
      const data = await apiRequest<{ results?: ConversationRow[] } | ConversationRow[]>(ENDPOINTS.CONVERSATIONS.LIST);
      const list = Array.isArray(data) ? data : (data.results || []);
      setConversations(list);
      if (list.length && !selectedConversationId) {
        setSelectedConversationId(list[0].id);
      }
    } catch (e) {
      if (handleAuthFailure(e)) return;
      toast.error(e instanceof Error ? e.message : tr('Failed to load conversations', 'Suhbatlarni yuklab bolmadi', 'Suhbatlarni yuklab bolmadi'));
    } finally {
      setLoadingConversations(false);
    }
  }, [handleAuthFailure, selectedConversationId, toast, tr]);

  useEffect(() => {
    loadGlobalSettings();
    loadConversations();
  }, [loadConversations, loadGlobalSettings]);

  const saveGlobalSettings = async () => {
    try {
      setGlobalSaving(true);
      const payload = {
        is_bot_paused: globalForm.is_bot_paused,
        pause_for_minutes: globalForm.pause_for_minutes,
        pause_reason: globalForm.pause_reason,
        followups_enabled: globalForm.followups_enabled,
      };
      const data = await apiRequest<{ settings?: GlobalAutomationSettings }>(ENDPOINTS.AUTOMATION.SETTINGS, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      if (data.settings) {
        setGlobalSettings(data.settings);
        setGlobalForm((prev) => ({
          ...prev,
          is_bot_paused: data.settings?.is_bot_paused ?? prev.is_bot_paused,
          followups_enabled: data.settings?.followups_enabled ?? prev.followups_enabled,
          pause_reason: data.settings?.pause_reason || '',
        }));
      }
      toast.success(tr('Global settings saved', 'Global sozlamalar saqlandi', 'Global sozlamalar saqlandi'));
    } catch (e) {
      if (handleAuthFailure(e)) return;
      toast.error(e instanceof Error ? e.message : tr('Failed to save global settings', 'Global sozlamalarni saqlab bolmadi', 'Global sozlamalarni saqlab bolmadi'));
    } finally {
      setGlobalSaving(false);
    }
  };

  const resumeGlobalNow = async () => {
    try {
      setGlobalResuming(true);
      const data = await apiRequest<{ settings?: GlobalAutomationSettings }>(ENDPOINTS.AUTOMATION.RESUME, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      if (data.settings) {
        setGlobalSettings(data.settings);
        setGlobalForm((prev) => ({
          ...prev,
          is_bot_paused: false,
          pause_reason: data.settings?.pause_reason || '',
        }));
      }
      toast.success(tr('Bot resumed globally', 'Bot global qayta yoqildi', 'Bot global qayta yoqildi'));
    } catch (e) {
      if (handleAuthFailure(e)) return;
      toast.error(e instanceof Error ? e.message : tr('Failed to resume bot', 'Botni qayta yoqib bolmadi', 'Botni qayta yoqib bolmadi'));
    } finally {
      setGlobalResuming(false);
    }
  };

  const globalStatus = useMemo(() => {
    if (!globalSettings) return null;
    return {
      bot: globalSettings.is_bot_paused ? tr('Paused', 'Toxtagan', 'Toxtagan') : tr('Active', 'Faol', 'Faol'),
      followups: globalSettings.followups_enabled ? tr('Enabled', 'Yoqilgan', 'Yoqilgan') : tr('Disabled', 'Ochiq emas', 'Ochiq emas'),
      pauseUntil: globalSettings.pause_until || '-',
      updatedAt: globalSettings.updated_at ? new Date(globalSettings.updated_at).toLocaleString() : '-',
    };
  }, [globalSettings, tr]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-light-text dark:text-white inline-flex items-center gap-2">
            <Settings2 size={24} className="text-primary-blue" />
            {tr('AI Configuration Center', 'AI konfiguratsiya markazi', 'AI konfiguratsiya markazi')}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {tr(
              'Manage bot behavior globally and per conversation.',
              'Botni global va har bir suhbat boyicha boshqaring.',
              'Botni global va har bir suhbat boyicha boshqaring.'
            )}
          </p>
        </div>
        <button
          onClick={() => {
            loadGlobalSettings();
            loadConversations();
          }}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-light-border dark:border-navy-700 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-navy-800"
        >
          <RefreshCw size={16} />
          {tr('Refresh', 'Yangilash', 'Yangilash')}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card title={tr('AI Playground', 'AI sinov maydoni', 'AI sinov maydoni')}>
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
            {tr(
              'Test prompts, responses, tools and trace output.',
              'Prompt, javob, tool va trace natijalarini sinang.',
              'Prompt, javob, tool va trace natijalarini sinang.'
            )}
          </p>
          <button
            onClick={() => navigate('/ai-tools')}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-blue text-white hover:bg-blue-600 text-sm"
          >
            <PlayCircle size={16} />
            {tr('Open Playground', 'Sinov maydonini ochish', 'Sinov maydonini ochish')}
          </button>
        </Card>

        <Card title={tr('AI Credentials', 'AI credentiallar', 'AI credentiallar')}>
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
            {tr(
              'Manage API key and prompts used by AI.',
              'AI ishlatadigan kalit va promptlarni boshqaring.',
              'AI ishlatadigan kalit va promptlarni boshqaring.'
            )}
          </p>
          <button
            onClick={() => navigate('/ai-credentials')}
            disabled={!isAdmin}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-blue text-white hover:bg-blue-600 text-sm disabled:opacity-50"
          >
            <KeyRound size={16} />
            {isAdmin
              ? tr('Open Credentials', 'Credentiallarni ochish', 'Credentiallarni ochish')
              : tr('Admin only', 'Faqat admin', 'Faqat admin')}
          </button>
        </Card>

        <Card title={tr('Conversation Automation', 'Suhbat avtomatikasi', 'Suhbat avtomatikasi')}>
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
            {tr(
              'Configure interruption/resume rules for a specific chat.',
              'Aniq chat uchun toxtatish/davom ettirish qoidalarini sozlang.',
              'Aniq chat uchun toxtatish/davom ettirish qoidalarini sozlang.'
            )}
          </p>
          {loadingConversations ? (
            <p className="text-sm text-gray-500">{tr('Loading conversations...', 'Suhbatlar yuklanmoqda...', 'Suhbatlar yuklanmoqda...')}</p>
          ) : conversations.length === 0 ? (
            <p className="text-sm text-gray-500">{tr('No conversations found', 'Suhbatlar topilmadi', 'Suhbatlar topilmadi')}</p>
          ) : (
            <div className="space-y-3">
              <select
                value={selectedConversationId}
                onChange={(e) => setSelectedConversationId(e.target.value)}
                className="w-full bg-gray-50 dark:bg-navy-900 border border-light-border dark:border-navy-600 rounded-lg px-3 py-2 text-sm text-gray-800 dark:text-gray-200"
              >
                {conversations.map((c) => (
                  <option key={c.id} value={c.id}>
                    {(c.client_name || c.external_thread_id || c.id.slice(0, 8))} ({c.channel})
                  </option>
                ))}
              </select>
              <button
                onClick={() => navigate(`/ai-settings/automation/${selectedConversationId}`)}
                disabled={!selectedConversationId}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-blue text-white hover:bg-blue-600 text-sm disabled:opacity-50"
              >
                <MessageSquare size={16} />
                {tr('Open Conversation Settings', 'Suhbat sozlamalarini ochish', 'Suhbat sozlamalarini ochish')}
              </button>
            </div>
          )}
        </Card>
      </div>

      <Card
        title={tr('Global Automation Controls', 'Global avtomatika boshqaruvi', 'Global avtomatika boshqaruvi')}
        action={(
          <div className="inline-flex items-center gap-2 text-xs">
            <span className={`px-2 py-1 rounded-full border ${globalForm.is_bot_paused ? 'bg-red-50 border-red-200 text-red-700' : 'bg-green-50 border-green-200 text-green-700'}`}>
              <Power size={12} className="inline-block mr-1" />
              {globalForm.is_bot_paused ? tr('Bot paused', 'Bot toxtagan', 'Bot toxtagan') : tr('Bot active', 'Bot faol', 'Bot faol')}
            </span>
          </div>
        )}
      >
        {globalLoading ? (
          <p className="text-sm text-gray-500">{tr('Loading global settings...', 'Global sozlamalar yuklanmoqda...', 'Global sozlamalar yuklanmoqda...')}</p>
        ) : (
          <div className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Switch
                checked={globalForm.is_bot_paused}
                onChange={(value) => setGlobalForm((prev) => ({ ...prev, is_bot_paused: value }))}
                label={tr('Pause bot globally', 'Botni global toxtatish', 'Botni global toxtatish')}
              />
              <Switch
                checked={globalForm.followups_enabled}
                onChange={(value) => setGlobalForm((prev) => ({ ...prev, followups_enabled: value }))}
                label={tr('Enable follow-ups globally', 'Follow-uplarni global yoqish', 'Follow-uplarni global yoqish')}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                  {tr('Pause for minutes', 'Necha daqiqaga toxtatish', 'Necha daqiqaga toxtatish')}
                </label>
                <input
                  type="number"
                  min={1}
                  value={globalForm.pause_for_minutes}
                  onChange={(e) => setGlobalForm((prev) => ({ ...prev, pause_for_minutes: Number(e.target.value || 1) }))}
                  className="w-full bg-gray-50 dark:bg-navy-900 border border-light-border dark:border-navy-600 rounded-lg px-3 py-2 text-sm text-gray-800 dark:text-gray-200"
                />
                <p className="text-[11px] text-gray-500 mt-1">
                  {tr(
                    'Used when pause is ON (auto resume timer).',
                    'Pause yoqilganda ishlatiladi (avto resume timer).',
                    'Pause yoqilganda ishlatiladi (avto resume timer).'
                  )}
                </p>
              </div>
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                  {tr('Pause reason', 'Toxtatish sababi', 'Toxtatish sababi')}
                </label>
                <input
                  value={globalForm.pause_reason}
                  onChange={(e) => setGlobalForm((prev) => ({ ...prev, pause_reason: e.target.value }))}
                  className="w-full bg-gray-50 dark:bg-navy-900 border border-light-border dark:border-navy-600 rounded-lg px-3 py-2 text-sm text-gray-800 dark:text-gray-200"
                  placeholder={tr('maintenance', 'servis ishlari', 'servis ishlari')}
                />
              </div>
            </div>

            <div className="rounded-lg border border-light-border dark:border-navy-700 bg-gray-50 dark:bg-navy-900/40 p-3 text-xs text-gray-700 dark:text-gray-300 space-y-1">
              <p>
                {tr('Bot status', 'Bot holati', 'Bot holati')}: <span className="font-semibold">{globalStatus?.bot || '-'}</span>
              </p>
              <p>
                {tr('Follow-up status', 'Follow-up holati', 'Follow-up holati')}: <span className="font-semibold">{globalStatus?.followups || '-'}</span>
              </p>
              <p>
                {tr('Pause until', 'Toxtash muddati', 'Toxtash muddati')}: <span className="font-semibold">{globalStatus?.pauseUntil || '-'}</span>
              </p>
              <p>
                {tr('Last updated', 'Oxirgi yangilanish', 'Oxirgi yangilanish')}: <span className="font-semibold">{globalStatus?.updatedAt || '-'}</span>
              </p>
              <p className="text-[11px] text-gray-500 pt-1">
                {tr(
                  'Backend note: setting is_bot_paused=false will unpause even if pause_for_minutes is stale.',
                  'Backend izohi: is_bot_paused=false yuborilsa pause_for_minutes eski bolsa ham bot yoqiladi.',
                  'Backend izohi: is_bot_paused=false yuborilsa pause_for_minutes eski bolsa ham bot yoqiladi.'
                )}
              </p>
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                onClick={resumeGlobalNow}
                disabled={globalResuming}
                className="px-4 py-2 rounded-lg border border-light-border dark:border-navy-600 text-sm text-gray-700 dark:text-gray-200 disabled:opacity-50"
              >
                {globalResuming
                  ? tr('Resuming...', 'Qayta yoqilmoqda...', 'Qayta yoqilmoqda...')
                  : tr('Resume all now', 'Hammasini hozir yoqish', 'Hammasini hozir yoqish')}
              </button>
              <button
                onClick={saveGlobalSettings}
                disabled={globalSaving}
                className="px-4 py-2 rounded-lg bg-primary-blue text-white hover:bg-blue-600 text-sm disabled:opacity-50"
              >
                {globalSaving
                  ? tr('Saving...', 'Saqlanmoqda...', 'Saqlanmoqda...')
                  : tr('Save global settings', 'Global sozlamalarni saqlash', 'Global sozlamalarni saqlash')}
              </button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};

export default AISettings;
