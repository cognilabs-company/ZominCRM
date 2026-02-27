import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card } from '../components/ui/Card';
import { Modal } from '../components/ui/Modal';
import { Switch } from '../components/ui/Switch';
import { useToast } from '../context/ToastContext';
import { useLanguage } from '../context/LanguageContext';
import { ApiError, ENDPOINTS, apiRequest } from '../services/api';
import { ArrowLeft, Edit2, Play, Plus, RefreshCw, Trash2 } from 'lucide-react';

interface AutomationSettingsState {
  is_interrupted: boolean;
  interrupted_at: string | null;
  interrupt_until: string | null;
  interrupted_by_user_id: string;
  employee_interrupt_messages_seen: number;
  customer_messages_while_interrupted?: number;
  last_resumed_at: string | null;
  last_resume_reason: string;
}

interface AutomationSettings {
  conversation_id: string;
  do_not_respond_when_interrupted: boolean;
  ignore_first_employee_messages: boolean;
  ignore_employee_messages_count: number;
  interrupt_exempt_phrases: string;
  resume_by_timer: boolean;
  resume_after_minutes: number;
  resume_after_customer_messages: number;
  resume_by_employee_phrases: boolean;
  employee_resume_phrases: string;
  resume_by_customer_phrases: boolean;
  customer_resume_phrases: string;
  state: AutomationSettingsState;
  updated_at?: string;
}

interface FollowUpRule {
  id: string;
  conversation_id: string;
  name: string;
  is_active: boolean;
  order: number;
  delay_minutes: number;
  message_mode: string;
  message_content: string;
  llm_instruction_enabled: boolean;
  last_triggered_at: string | null;
  created_at?: string;
  updated_at?: string;
}

const DEFAULT_SETTINGS: AutomationSettings = {
  conversation_id: '',
  do_not_respond_when_interrupted: true,
  ignore_first_employee_messages: false,
  ignore_employee_messages_count: 1,
  interrupt_exempt_phrases: '',
  resume_by_timer: true,
  resume_after_minutes: 2,
  resume_after_customer_messages: 0,
  resume_by_employee_phrases: false,
  employee_resume_phrases: '',
  resume_by_customer_phrases: false,
  customer_resume_phrases: '',
  state: {
    is_interrupted: false,
    interrupted_at: null,
    interrupt_until: null,
    interrupted_by_user_id: '',
    employee_interrupt_messages_seen: 0,
    customer_messages_while_interrupted: 0,
    last_resumed_at: null,
    last_resume_reason: '',
  },
};

const ConversationAutomation: React.FC = () => {
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { language } = useLanguage();
  const tr = useCallback(
    (en: string, ru: string, uz: string) => (language === 'ru' ? ru : language === 'uz' ? uz : en),
    [language]
  );

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [runningNow, setRunningNow] = useState(false);
  const [resumingNow, setResumingNow] = useState(false);
  const [settings, setSettings] = useState<AutomationSettings>(DEFAULT_SETTINGS);
  const [followUps, setFollowUps] = useState<FollowUpRule[]>([]);
  const [isRuleModalOpen, setIsRuleModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<FollowUpRule | null>(null);
  const [ruleIsActive, setRuleIsActive] = useState(true);
  const [ruleLlmEnabled, setRuleLlmEnabled] = useState(false);
  const [ruleSaving, setRuleSaving] = useState(false);

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

  const loadSettings = useCallback(async () => {
    if (!conversationId) return;
    const data = await apiRequest<{ settings?: AutomationSettings } | { ok?: boolean; settings: AutomationSettings }>(
      ENDPOINTS.CONVERSATIONS.AUTOMATION_SETTINGS(conversationId)
    );
    const payload = (data as { settings?: AutomationSettings }).settings || (data as unknown as AutomationSettings);
    setSettings({
      ...DEFAULT_SETTINGS,
      ...payload,
      state: {
        ...DEFAULT_SETTINGS.state,
        ...(payload?.state || {}),
      },
    });
  }, [conversationId]);

  const loadFollowUps = useCallback(async () => {
    if (!conversationId) return;
    const data = await apiRequest<{ results?: FollowUpRule[] }>(ENDPOINTS.CONVERSATIONS.AUTOMATION_FOLLOW_UPS(conversationId));
    setFollowUps(data.results || []);
  }, [conversationId]);

  useEffect(() => {
    (async () => {
      if (!conversationId) return;
      try {
        setLoading(true);
        await Promise.all([loadSettings(), loadFollowUps()]);
      } catch (e) {
        if (handleAuthFailure(e)) return;
        toast.error(e instanceof Error ? e.message : tr('Failed to load automation settings', 'Avtomatika sozlamalarini yuklab bolmadi', 'Avtomatika sozlamalarini yuklab bolmadi'));
      } finally {
        setLoading(false);
      }
    })();
  }, [conversationId, handleAuthFailure, loadFollowUps, loadSettings, toast, tr]);

  const saveSettings = async () => {
    if (!conversationId) return;
    try {
      setSaving(true);
      const payload = {
        do_not_respond_when_interrupted: settings.do_not_respond_when_interrupted,
        ignore_first_employee_messages: settings.ignore_first_employee_messages,
        ignore_employee_messages_count: settings.ignore_employee_messages_count,
        interrupt_exempt_phrases: settings.interrupt_exempt_phrases,
        resume_by_timer: settings.resume_by_timer,
        resume_after_minutes: settings.resume_after_minutes,
        resume_after_customer_messages: settings.resume_after_customer_messages,
        resume_by_employee_phrases: settings.resume_by_employee_phrases,
        employee_resume_phrases: settings.employee_resume_phrases,
        resume_by_customer_phrases: settings.resume_by_customer_phrases,
        customer_resume_phrases: settings.customer_resume_phrases,
      };

      const data = await apiRequest<{ settings?: AutomationSettings }>(
        ENDPOINTS.CONVERSATIONS.AUTOMATION_SETTINGS(conversationId),
        { method: 'PUT', body: JSON.stringify(payload) }
      );
      if (data.settings) {
        setSettings({
          ...DEFAULT_SETTINGS,
          ...data.settings,
          state: {
            ...DEFAULT_SETTINGS.state,
            ...(data.settings.state || {}),
          },
        });
      }
      toast.success(tr('Conversation automation saved', 'Suhbat avtomatikasi saqlandi', 'Suhbat avtomatikasi saqlandi'));
    } catch (e) {
      if (handleAuthFailure(e)) return;
      toast.error(e instanceof Error ? e.message : tr('Failed to save settings', 'Sozlamalarni saqlab bolmadi', 'Sozlamalarni saqlab bolmadi'));
    } finally {
      setSaving(false);
    }
  };

  const resumeNow = async () => {
    if (!conversationId) return;
    try {
      setResumingNow(true);
      const data = await apiRequest<{ settings?: AutomationSettings }>(
        ENDPOINTS.CONVERSATIONS.AUTOMATION_RESUME(conversationId),
        { method: 'POST', body: JSON.stringify({}) }
      );
      if (data.settings) {
        setSettings({
          ...DEFAULT_SETTINGS,
          ...data.settings,
          state: {
            ...DEFAULT_SETTINGS.state,
            ...(data.settings.state || {}),
          },
        });
      }
      toast.success(tr('Bot resumed for this chat', 'Bu chat uchun bot qayta yoqildi', 'Bu chat uchun bot qayta yoqildi'));
    } catch (e) {
      if (handleAuthFailure(e)) return;
      toast.error(e instanceof Error ? e.message : tr('Failed to resume bot', 'Botni qayta yoqib bolmadi', 'Botni qayta yoqib bolmadi'));
    } finally {
      setResumingNow(false);
    }
  };

  const runFollowUpsNow = async () => {
    try {
      setRunningNow(true);
      const data = await apiRequest<{ summary?: { processed?: number; sent?: number; skipped?: number } }>(
        ENDPOINTS.AUTOMATION.FOLLOW_UPS_RUN,
        { method: 'POST', body: JSON.stringify({ limit: 100 }) }
      );
      const summary = data.summary || {};
      toast.success(
        `${tr('Run complete', 'Ishga tushirish tugadi', 'Ishga tushirish tugadi')}: ` +
        `${tr('sent', 'yuborildi', 'yuborildi')} ${summary.sent || 0}, ` +
        `${tr('skipped', 'otkazib yuborildi', "otkazib yuborildi")} ${summary.skipped || 0}`
      );
    } catch (e) {
      if (handleAuthFailure(e)) return;
      toast.error(e instanceof Error ? e.message : tr('Failed to run follow-ups', 'Follow-uplarni ishga tushirib bolmadi', 'Follow-uplarni ishga tushirib bolmadi'));
    } finally {
      setRunningNow(false);
    }
  };

  const openCreateRule = () => {
    setEditingRule(null);
    setRuleIsActive(true);
    setRuleLlmEnabled(false);
    setIsRuleModalOpen(true);
  };

  const openEditRule = (rule: FollowUpRule) => {
    setEditingRule(rule);
    setRuleIsActive(rule.is_active);
    setRuleLlmEnabled(rule.llm_instruction_enabled);
    setIsRuleModalOpen(true);
  };

  const saveRule = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!conversationId) return;

    const form = new FormData(e.currentTarget);
    const payload = {
      name: String(form.get('name') || ''),
      is_active: ruleIsActive,
      order: Number(form.get('order') || 0),
      delay_minutes: Number(form.get('delay_minutes') || 2),
      message_mode: String(form.get('message_mode') || 'STATIC_TEXT'),
      message_content: String(form.get('message_content') || ''),
      llm_instruction_enabled: ruleLlmEnabled,
    };

    try {
      setRuleSaving(true);
      if (editingRule) {
        await apiRequest(
          ENDPOINTS.CONVERSATIONS.AUTOMATION_FOLLOW_UP_DETAIL(conversationId, editingRule.id),
          { method: 'PATCH', body: JSON.stringify(payload) }
        );
        toast.success(tr('Follow-up updated', 'Follow-up yangilandi', 'Follow-up yangilandi'));
      } else {
        await apiRequest(ENDPOINTS.CONVERSATIONS.AUTOMATION_FOLLOW_UPS(conversationId), {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        toast.success(tr('Follow-up created', 'Follow-up yaratildi', 'Follow-up yaratildi'));
      }

      setIsRuleModalOpen(false);
      setEditingRule(null);
      setRuleIsActive(true);
      setRuleLlmEnabled(false);
      await loadFollowUps();
    } catch (e) {
      if (handleAuthFailure(e)) return;
      toast.error(e instanceof Error ? e.message : tr('Failed to save follow-up', 'Follow-upni saqlab bolmadi', 'Follow-upni saqlab bolmadi'));
    } finally {
      setRuleSaving(false);
    }
  };

  const deleteRule = async (ruleId: string) => {
    if (!conversationId) return;
    if (!window.confirm(tr('Delete this follow-up rule?', 'Bu follow-up qoidasi ochirilsinmi?', "Bu follow-up qoidasi ochirilsinmi?"))) return;
    try {
      await apiRequest(ENDPOINTS.CONVERSATIONS.AUTOMATION_FOLLOW_UP_DETAIL(conversationId, ruleId), { method: 'DELETE' });
      toast.success(tr('Follow-up deleted', 'Follow-up ochirildi', "Follow-up ochirildi"));
      await loadFollowUps();
    } catch (e) {
      if (handleAuthFailure(e)) return;
      toast.error(e instanceof Error ? e.message : tr('Failed to delete follow-up', 'Follow-upni ochirib bolmadi', "Follow-upni ochirib bolmadi"));
    }
  };

  const stateSummary = useMemo(() => ([
    {
      label: tr('Interrupted', 'Toxtatilgan', 'Toxtatilgan'),
      value: settings.state.is_interrupted ? tr('Yes', 'Ha', 'Ha') : tr('No', 'Yoq', "Yoq"),
    },
    {
      label: tr('Interrupt until', 'Toxtatish muddati', 'Toxtatish muddati'),
      value: settings.state.interrupt_until || '-',
    },
    {
      label: tr('Customer messages while interrupted', 'Toxtatilgandagi mijoz xabarlari', 'Toxtatilgandagi mijoz xabarlari'),
      value: String(settings.state.customer_messages_while_interrupted ?? 0),
    },
    {
      label: tr('Last resume reason', 'Oxirgi davom ettirish sababi', 'Oxirgi davom ettirish sababi'),
      value: settings.state.last_resume_reason || '-',
    },
  ]), [settings.state, tr]);

  if (!conversationId) {
    return (
      <Card>
        <p className="text-sm text-red-600">{tr('Conversation id is required', 'Conversation id kerak', 'Conversation id kerak')}</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-light-text dark:text-white">
            {tr('Conversation AI Automation', 'Suhbat AI avtomatikasi', 'Suhbat AI avtomatikasi')}
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            {tr('Conversation ID', 'Conversation ID', 'Conversation ID')}: {conversationId}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/ai-settings')}
            className="px-3 py-2 rounded-lg text-sm border border-light-border dark:border-navy-600 text-gray-700 dark:text-gray-200 inline-flex items-center gap-2"
          >
            <ArrowLeft size={14} />
            {tr('Back', 'Orqaga', 'Orqaga')}
          </button>
          <button
            onClick={() => {
              loadSettings();
              loadFollowUps();
            }}
            className="px-3 py-2 rounded-lg text-sm border border-light-border dark:border-navy-600 text-gray-700 dark:text-gray-200 inline-flex items-center gap-2"
          >
            <RefreshCw size={14} />
            {tr('Refresh', 'Yangilash', 'Yangilash')}
          </button>
          <button
            onClick={runFollowUpsNow}
            disabled={runningNow}
            className="px-3 py-2 rounded-lg text-sm bg-gray-100 dark:bg-navy-700 text-gray-700 dark:text-gray-200 disabled:opacity-50 inline-flex items-center gap-2"
          >
            <Play size={14} />
            {runningNow ? tr('Running...', 'Ishlamoqda...', 'Ishlamoqda...') : tr('Run follow-ups now', 'Follow-uplarni hozir ishga tushirish', 'Follow-uplarni hozir ishga tushirish')}
          </button>
          <button
            onClick={resumeNow}
            disabled={resumingNow}
            className="px-3 py-2 rounded-lg text-sm bg-primary-blue text-white hover:bg-blue-600 disabled:opacity-50"
          >
            {resumingNow ? tr('Resuming...', 'Qayta yoqilmoqda...', 'Qayta yoqilmoqda...') : tr('Resume bot now', 'Botni hozir yoqish', 'Botni hozir yoqish')}
          </button>
        </div>
      </div>

      <Card title={tr('Current Conversation State', 'Joriy suhbat holati', 'Joriy suhbat holati')}>
        {loading ? (
          <p className="text-sm text-gray-500">{tr('Loading state...', 'Holat yuklanmoqda...', 'Holat yuklanmoqda...')}</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
            {stateSummary.map((item) => (
              <div key={item.label} className="rounded-lg border border-light-border dark:border-navy-700 bg-gray-50 dark:bg-navy-900/40 px-3 py-2">
                <p className="text-xs text-gray-500">{item.label}</p>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mt-1 break-words">{item.value}</p>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title={tr('Interruption Rules', 'Toxtatish qoidalari', 'Toxtatish qoidalari')}>
        {loading ? (
          <p className="text-sm text-gray-500">{tr('Loading settings...', 'Sozlamalar yuklanmoqda...', 'Sozlamalar yuklanmoqda...')}</p>
        ) : (
          <div className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Switch
                checked={settings.do_not_respond_when_interrupted}
                onChange={(value) => setSettings((prev) => ({ ...prev, do_not_respond_when_interrupted: value }))}
                label={tr('Do not respond when interrupted', 'Toxtatilganda javob bermasin', 'Toxtatilganda javob bermasin')}
              />
              <Switch
                checked={settings.ignore_first_employee_messages}
                onChange={(value) => setSettings((prev) => ({ ...prev, ignore_first_employee_messages: value }))}
                label={tr('Ignore employee interruption messages', 'Xodim interrupt xabarlarini etiborsiz qoldirish', "Xodim interrupt xabarlarini etiborsiz qoldirish")}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  {tr('Ignore employee messages count', 'Etiborsiz xodim xabarlari soni', 'Etiborsiz xodim xabarlari soni')}
                </label>
                <input
                  type="number"
                  min={0}
                  value={settings.ignore_employee_messages_count}
                  onChange={(e) => setSettings((prev) => ({ ...prev, ignore_employee_messages_count: Number(e.target.value || 0) }))}
                  className="w-full bg-gray-50 dark:bg-navy-900 border border-light-border dark:border-navy-600 rounded-lg px-3 py-2 text-sm text-gray-800 dark:text-gray-200"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  {tr('Interrupt exempt phrases', 'Interruptdan mustasno iboralar', "Interruptdan mustasno iboralar")}
                </label>
                <input
                  value={settings.interrupt_exempt_phrases}
                  onChange={(e) => setSettings((prev) => ({ ...prev, interrupt_exempt_phrases: e.target.value }))}
                  className="w-full bg-gray-50 dark:bg-navy-900 border border-light-border dark:border-navy-600 rounded-lg px-3 py-2 text-sm text-gray-800 dark:text-gray-200"
                  placeholder={tr('comma separated phrases', 'vergul bilan ajrating', 'vergul bilan ajrating')}
                />
              </div>
            </div>
          </div>
        )}
      </Card>

      <Card title={tr('Auto Resume Triggers', 'Avto davom ettirish triggerlari', 'Avto davom ettirish triggerlari')}>
        {loading ? (
          <p className="text-sm text-gray-500">{tr('Loading settings...', 'Sozlamalar yuklanmoqda...', 'Sozlamalar yuklanmoqda...')}</p>
        ) : (
          <div className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Switch
                checked={settings.resume_by_timer}
                onChange={(value) => setSettings((prev) => ({ ...prev, resume_by_timer: value }))}
                label={tr('Resume by timer', 'Taymer boyicha davom etish', "Taymer boyicha davom etish")}
              />
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  {tr('Resume after minutes', 'Necha daqiqadan keyin davom etish', 'Necha daqiqadan keyin davom etish')}
                </label>
                <input
                  type="number"
                  min={0}
                  value={settings.resume_after_minutes}
                  onChange={(e) => setSettings((prev) => ({ ...prev, resume_after_minutes: Number(e.target.value || 0) }))}
                  className="w-full bg-gray-50 dark:bg-navy-900 border border-light-border dark:border-navy-600 rounded-lg px-3 py-2 text-sm text-gray-800 dark:text-gray-200"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Switch
                checked={settings.resume_by_customer_phrases}
                onChange={(value) => setSettings((prev) => ({ ...prev, resume_by_customer_phrases: value }))}
                label={tr('Resume by customer phrases', 'Mijoz iboralari bilan davom etish', 'Mijoz iboralari bilan davom etish')}
              />
              <Switch
                checked={settings.resume_by_employee_phrases}
                onChange={(value) => setSettings((prev) => ({ ...prev, resume_by_employee_phrases: value }))}
                label={tr('Resume by employee phrases', 'Xodim iboralari bilan davom etish', 'Xodim iboralari bilan davom etish')}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  {tr('Customer resume phrases', 'Mijoz davom iboralari', 'Mijoz davom iboralari')}
                </label>
                <textarea
                  value={settings.customer_resume_phrases}
                  onChange={(e) => setSettings((prev) => ({ ...prev, customer_resume_phrases: e.target.value }))}
                  className="w-full h-24 bg-gray-50 dark:bg-navy-900 border border-light-border dark:border-navy-600 rounded-lg px-3 py-2 text-sm text-gray-800 dark:text-gray-200"
                  placeholder={tr('continue, continue chat, resume', 'davom et, continue, resume', 'davom et, continue, resume')}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  {tr('Employee resume phrases', 'Xodim davom iboralari', 'Xodim davom iboralari')}
                </label>
                <textarea
                  value={settings.employee_resume_phrases}
                  onChange={(e) => setSettings((prev) => ({ ...prev, employee_resume_phrases: e.target.value }))}
                  className="w-full h-24 bg-gray-50 dark:bg-navy-900 border border-light-border dark:border-navy-600 rounded-lg px-3 py-2 text-sm text-gray-800 dark:text-gray-200"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1">
                {tr('Resume after customer messages', 'Mijoz xabarlari sonidan keyin davom etish', 'Mijoz xabarlari sonidan keyin davom etish')}
              </label>
              <input
                type="number"
                min={0}
                value={settings.resume_after_customer_messages}
                onChange={(e) => setSettings((prev) => ({ ...prev, resume_after_customer_messages: Number(e.target.value || 0) }))}
                className="w-full md:w-64 bg-gray-50 dark:bg-navy-900 border border-light-border dark:border-navy-600 rounded-lg px-3 py-2 text-sm text-gray-800 dark:text-gray-200"
              />
              <p className="text-[11px] text-gray-500 mt-1">
                {tr(
                  'Example: 3 means first 3 customer messages are ignored, bot replies from the 4th.',
                  'Masalan: 3 bolsa birinchi 3 mijoz xabari etiborsiz qoladi, bot 4-xabardan javob beradi.',
                  'Masalan: 3 bolsa birinchi 3 mijoz xabari etiborsiz qoladi, bot 4-xabardan javob beradi.'
                )}
              </p>
            </div>
          </div>
        )}
      </Card>

      <div className="flex justify-end">
        <button
          onClick={saveSettings}
          disabled={saving || loading}
          className="px-4 py-2 rounded-lg text-sm font-medium bg-primary-blue text-white hover:bg-blue-600 disabled:opacity-50"
        >
          {saving ? tr('Saving...', 'Saqlanmoqda...', 'Saqlanmoqda...') : tr('Save conversation settings', 'Suhbat sozlamalarini saqlash', 'Suhbat sozlamalarini saqlash')}
        </button>
      </div>

      <Card
        title={tr('Follow-up Rules', 'Follow-up qoidalari', 'Follow-up qoidalari')}
        action={(
          <button
            onClick={openCreateRule}
            className="px-3 py-1.5 rounded-lg text-sm bg-primary-blue text-white hover:bg-blue-600 inline-flex items-center gap-2"
          >
            {tr('Add Rule', 'Qoida qoshish', 'Qoida qoshish')}
            <Plus size={14} />
          </button>
        )}
      >
        {loading ? (
          <p className="text-sm text-gray-500">{tr('Loading rules...', 'Qoidalar yuklanmoqda...', 'Qoidalar yuklanmoqda...')}</p>
        ) : followUps.length === 0 ? (
          <p className="text-sm text-gray-500">{tr('No follow-up rules yet', 'Hozircha follow-up qoidalari yoq', "Hozircha follow-up qoidalari yoq")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-xs uppercase text-gray-500 border-b border-light-border dark:border-navy-700">
                  <th className="py-2 pr-3">{tr('Name', 'Nomi', 'Nomi')}</th>
                  <th className="py-2 pr-3">{tr('Delay', 'Kechikish', 'Kechikish')}</th>
                  <th className="py-2 pr-3">{tr('Mode', 'Rejim', 'Rejim')}</th>
                  <th className="py-2 pr-3">{tr('Active', 'Faol', 'Faol')}</th>
                  <th className="py-2 text-right">{tr('Actions', 'Amallar', 'Amallar')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-light-border dark:divide-navy-700">
                {followUps.map((rule) => (
                  <tr key={rule.id}>
                    <td className="py-3 pr-3 text-sm text-gray-800 dark:text-gray-200">{rule.name}</td>
                    <td className="py-3 pr-3 text-sm text-gray-800 dark:text-gray-200">{rule.delay_minutes} {tr('min', 'daq', 'daq')}</td>
                    <td className="py-3 pr-3 text-sm text-gray-800 dark:text-gray-200">{rule.message_mode}</td>
                    <td className="py-3 pr-3 text-sm text-gray-800 dark:text-gray-200">{rule.is_active ? tr('Yes', 'Ha', 'Ha') : tr('No', 'Yoq', "Yoq")}</td>
                    <td className="py-3 text-right">
                      <div className="inline-flex items-center gap-2">
                        <button onClick={() => openEditRule(rule)} className="p-1.5 text-gray-500 dark:text-gray-300 hover:text-primary-blue dark:hover:text-blue-400 transition-colors">
                          <Edit2 size={15} />
                        </button>
                        <button onClick={() => deleteRule(rule.id)} className="p-1.5 text-gray-500 dark:text-gray-300 hover:text-red-600 dark:hover:text-red-400 transition-colors">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal
        isOpen={isRuleModalOpen}
        onClose={() => { setIsRuleModalOpen(false); setEditingRule(null); }}
        title={editingRule ? tr('Edit Follow-up Rule', 'Follow-up qoidasini tahrirlash', 'Follow-up qoidasini tahrirlash') : tr('Create Follow-up Rule', 'Follow-up qoidasini yaratish', 'Follow-up qoidasini yaratish')}
        footer={null}
      >
        <form onSubmit={saveRule} className="space-y-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">{tr('Name', 'Nomi', 'Nomi')}</label>
            <input
              name="name"
              required
              defaultValue={editingRule?.name || ''}
              className="w-full bg-gray-50 dark:bg-navy-900 border border-light-border dark:border-navy-600 rounded-lg px-3 py-2 text-sm text-gray-800 dark:text-gray-200"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">{tr('Order', 'Tartib', 'Tartib')}</label>
              <input
                name="order"
                type="number"
                defaultValue={editingRule?.order ?? 0}
                className="w-full bg-gray-50 dark:bg-navy-900 border border-light-border dark:border-navy-600 rounded-lg px-3 py-2 text-sm text-gray-800 dark:text-gray-200"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">{tr('Delay minutes', 'Kechikish daqiqasi', 'Kechikish daqiqasi')}</label>
              <input
                name="delay_minutes"
                type="number"
                defaultValue={editingRule?.delay_minutes ?? 2}
                className="w-full bg-gray-50 dark:bg-navy-900 border border-light-border dark:border-navy-600 rounded-lg px-3 py-2 text-sm text-gray-800 dark:text-gray-200"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">{tr('Mode', 'Rejim', 'Rejim')}</label>
              <select
                name="message_mode"
                defaultValue={editingRule?.message_mode || 'STATIC_TEXT'}
                className="w-full bg-gray-50 dark:bg-navy-900 border border-light-border dark:border-navy-600 rounded-lg px-3 py-2 text-sm text-gray-800 dark:text-gray-200"
              >
                <option value="STATIC_TEXT">STATIC_TEXT</option>
                <option value="BOT_GENERATION">BOT_GENERATION</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">{tr('Message content', 'Xabar matni', 'Xabar matni')}</label>
            <textarea
              name="message_content"
              defaultValue={editingRule?.message_content || ''}
              className="w-full h-24 bg-gray-50 dark:bg-navy-900 border border-light-border dark:border-navy-600 rounded-lg px-3 py-2 text-sm text-gray-800 dark:text-gray-200"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Switch checked={ruleIsActive} onChange={setRuleIsActive} label={tr('Active', 'Faol', 'Faol')} />
            <Switch checked={ruleLlmEnabled} onChange={setRuleLlmEnabled} label={tr('LLM instruction enabled', 'LLM korsatmasi yoqilgan', 'LLM korsatmasi yoqilgan')} />
          </div>

          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => { setIsRuleModalOpen(false); setEditingRule(null); }} className="px-3 py-2 rounded-lg border border-light-border dark:border-navy-600 text-sm">
              {tr('Cancel', 'Bekor qilish', 'Bekor qilish')}
            </button>
            <button type="submit" disabled={ruleSaving} className="px-3 py-2 rounded-lg bg-primary-blue text-white text-sm disabled:opacity-50">
              {ruleSaving ? tr('Saving...', 'Saqlanmoqda...', 'Saqlanmoqda...') : tr('Save Rule', 'Qoidani saqlash', 'Qoidani saqlash')}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default ConversationAutomation;
