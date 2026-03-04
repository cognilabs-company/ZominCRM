import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../components/ui/Card';
import { Switch } from '../components/ui/Switch';
import { useLanguage } from '../context/LanguageContext';
import { ApiError, ENDPOINTS, apiRequest } from '../services/api';
import { useToast } from '../context/ToastContext';
import { Save, RefreshCw } from 'lucide-react';

interface CredentialsData {
  id: string;
  status: boolean;
  ai_key: string;
  ai_user_prompt: string;
  ai_system_prompt: string;
  created_at: string;
  updated_at: string;
}

interface PromptFileSnapshot {
  path: string;
  exists: boolean;
  current?: {
    ai_user_prompt?: string;
    ai_system_prompt?: string;
    source?: string;
    credential_id?: string;
    saved_at?: string;
  };
  history_count?: number;
}

interface CredentialsResponse {
  credential?: CredentialsData;
  prompt_file?: PromptFileSnapshot;
}

const normalizePromptText = (value?: string | null) =>
  String(value || '')
    .replace(/\r\n/g, '\n')
    .replace(/\\r\\n/g, '\n')
    .replace(/\\n/g, '\n');

const AICredentials: React.FC = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const { language } = useLanguage();
  const tr = (en: string, ru: string, uz: string) => (language === 'ru' ? ru : language === 'uz' ? uz : en);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [status, setStatus] = useState(true);
  const [aiKey, setAiKey] = useState('');
  const [aiUserPrompt, setAiUserPrompt] = useState('');
  const [aiSystemPrompt, setAiSystemPrompt] = useState('');
  const [promptFile, setPromptFile] = useState<PromptFileSnapshot | null>(null);

  const loadCredentials = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiRequest<CredentialsResponse>(ENDPOINTS.AI.CREDENTIALS);
      const cred = data.credential;
      setPromptFile(data.prompt_file || null);
      if (cred) {
        setStatus(!!cred.status);
        setAiKey(cred.ai_key || '');
        setAiUserPrompt(normalizePromptText(cred.ai_user_prompt));
        setAiSystemPrompt(normalizePromptText(cred.ai_system_prompt));
      }
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        navigate('/login', { replace: true });
        return;
      }
      if (e instanceof ApiError && e.status === 403) {
        setError(tr('Access denied. Admin only.', "Ruxsat yo\'q. Faqat admin.", "Ruxsat yo\'q. Faqat admin."));
        toast.error(tr('Access denied. Admin only.', "Ruxsat yo\'q. Faqat admin.", "Ruxsat yo\'q. Faqat admin."));
        return;
      }
      setError(e instanceof Error ? e.message : tr('Failed to load AI credentials', "AI credentiallarni yuklab bo\'lmadi", "AI credentiallarni yuklab bo\'lmadi"));
      toast.error(e instanceof Error ? e.message : tr('Failed to load AI credentials', "AI credentiallarni yuklab bo\'lmadi", "AI credentiallarni yuklab bo\'lmadi"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCredentials();
  }, []);

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);
      const data = await apiRequest<CredentialsResponse>(ENDPOINTS.AI.CREDENTIALS, {
        method: 'PUT',
        body: JSON.stringify({
          status,
          ai_key: aiKey,
          ai_user_prompt: aiUserPrompt,
          ai_system_prompt: aiSystemPrompt,
        }),
      });
      setPromptFile(data.prompt_file || null);
      setSuccess(tr('AI credentials saved.', 'AI credentials saved.', 'AI credentiallar saqlandi.'));
      toast.success(tr('AI credentials saved.', 'AI credentials saved.', 'AI credentiallar saqlandi.'));
    } catch (e) {
      setError(e instanceof Error ? e.message : tr('Failed to save AI credentials', "AI credentiallarni saqlab bo\'lmadi", "AI credentiallarni saqlab bo\'lmadi"));
      toast.error(e instanceof Error ? e.message : tr('Failed to save AI credentials', "AI credentiallarni saqlab bo\'lmadi", "AI credentiallarni saqlab bo\'lmadi"));
    } finally {
      setSaving(false);
    }
  };

  const handleSyncFromFile = async () => {
    try {
      setSyncing(true);
      setError(null);
      setSuccess(null);
      await apiRequest(ENDPOINTS.AI.PROMPTS_SYNC, {
        method: 'POST',
        body: JSON.stringify({ source: 'file' }),
      });
      await loadCredentials();
      setSuccess(tr('Synced prompts from file to DB.', 'Synced prompts from file to DB.', 'Promptlar fayldan DB ga sinxronlandi.'));
      toast.success(tr('Synced prompts from file to DB.', 'Synced prompts from file to DB.', 'Promptlar fayldan DB ga sinxronlandi.'));
    } catch (e) {
      setError(e instanceof Error ? e.message : tr('Sync failed', 'Sync failed', 'Sinxronlash muvaffaqiyatsiz'));
      toast.error(e instanceof Error ? e.message : tr('Sync failed', 'Sync failed', 'Sinxronlash muvaffaqiyatsiz'));
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-light-text dark:text-white">{tr('AI Credentials', 'AI Credentials', 'AI credentiallar')}</h1>
        <button onClick={loadCredentials} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-light-border dark:border-navy-700 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-navy-800">
          <RefreshCw size={16} /> {tr('Refresh', 'Refresh', 'Yangilash')}
        </button>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 text-red-700 px-4 py-3 text-sm">{error}</div>}
      {success && <div className="rounded-lg border border-green-200 bg-green-50 text-green-700 px-4 py-3 text-sm">{success}</div>}

      <Card title={tr('Credentials', 'Credentials', 'Credentiallar')}>
        {loading ? (
          <p className="text-sm text-gray-500">{tr('Loading...', 'Loading...', 'Yuklanmoqda...')}</p>
        ) : (
          <div className="space-y-5">
            <Switch checked={status} onChange={setStatus} label={tr('Credentials Active', 'Credentials Active', 'Credentiallar faol')} />

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{tr('AI Key', 'AI Key', 'AI kalit')}</label>
              <input
                value={aiKey}
                onChange={(e) => setAiKey(e.target.value)}
                className="w-full bg-gray-50 dark:bg-navy-900 border border-light-border dark:border-navy-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-blue dark:text-white"
                placeholder="sk-..."
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{tr('Prompt Editors', 'Prompt Editors', 'Prompt editorlari')}</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {tr('Edit system and user prompts side by side for easier comparison.', 'Edit system and user prompts side by side for easier comparison.', 'System va user promptlarni yonma-yon tahrirlang.')}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <div className="rounded-xl border border-light-border dark:border-navy-700 bg-gray-50/70 dark:bg-navy-900/40 p-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{tr('System Prompt', 'System Prompt', 'Tizim prompti')}</label>
                  <textarea
                    value={aiSystemPrompt}
                    onChange={(e) => setAiSystemPrompt(e.target.value)}
                    className="w-full min-h-[420px] bg-white dark:bg-navy-900 border border-light-border dark:border-navy-600 rounded-xl px-4 py-3 text-sm leading-6 resize-y focus:outline-none focus:border-primary-blue dark:text-white"
                  />
                </div>

                <div className="rounded-xl border border-light-border dark:border-navy-700 bg-gray-50/70 dark:bg-navy-900/40 p-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{tr('User Prompt', 'User Prompt', 'Foydalanuvchi prompti')}</label>
                  <textarea
                    value={aiUserPrompt}
                    onChange={(e) => setAiUserPrompt(e.target.value)}
                    className="w-full min-h-[420px] bg-white dark:bg-navy-900 border border-light-border dark:border-navy-600 rounded-xl px-4 py-3 text-sm leading-6 resize-y focus:outline-none focus:border-primary-blue dark:text-white"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-blue text-white text-sm font-medium hover:bg-blue-600 disabled:opacity-50"
              >
                <Save size={16} />
                {saving ? tr('Saving...', 'Saving...', 'Saqlanmoqda...') : tr('Save', 'Save', 'Saqlash')}
              </button>
            </div>
          </div>
        )}
      </Card>

      <Card title={tr('Prompt File', 'Prompt File', 'Prompt fayli')}>
        {!promptFile ? (
          <p className="text-sm text-gray-500">{tr('No prompt file info.', "Prompt fayli ma\'lumoti yo\'q.", "Prompt fayli ma\'lumoti yo\'q.")}</p>
        ) : (
          <div className="space-y-3 text-sm">
              <p><span className="font-medium">{tr('Path', "Yo\'l", "Yo\'l")}: </span>{promptFile.path}</p>
            <p><span className="font-medium">{tr('Exists', 'Exists', 'Mavjud')}:</span> {String(promptFile.exists)}</p>
            <p><span className="font-medium">{tr('History Count', 'History Count', 'Tarix soni')}:</span> {promptFile.history_count ?? 0}</p>
            <p><span className="font-medium">{tr('Current Source', 'Current Source', 'Joriy manba')}:</span> {promptFile.current?.source || '-'}</p>
            <p><span className="font-medium">{tr('Current Saved At', 'Current Saved At', 'Joriy saqlangan vaqt')}:</span> {promptFile.current?.saved_at || '-'}</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
              <button
                onClick={handleSyncFromFile}
                disabled={syncing}
                className="px-4 py-2 rounded-lg border border-light-border dark:border-navy-700 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-navy-800 disabled:opacity-50"
              >
                {syncing ? tr('Syncing...', 'Syncing...', 'Sinxronlanmoqda...') : tr('Sync From File -> DB', 'Sync From File -> DB', 'Fayldan -> DB sinxronlash')}
              </button>
              <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center">
                {tr('Backend currently supports only `source=file` for prompt sync.', "Backend hozircha prompt sinxroni uchun faqat `source=file` ni qo\'llaydi.", "Backend hozircha prompt sinxroni uchun faqat `source=file` ni qo\'llaydi.")}
              </p>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};

export default AICredentials;
