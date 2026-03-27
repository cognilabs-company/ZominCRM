import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../components/ui/Card';
import { Modal } from '../components/ui/Modal';
import { Switch } from '../components/ui/Switch';
import { useActionConfirm } from '../components/ui/useActionConfirm';
import { useToast } from '../context/ToastContext';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { ApiError, ENDPOINTS, apiRequest } from '../services/api';
import { Edit2, Plus, RefreshCw, Settings2, Trash2, Play, KeyRound, PlayCircle } from 'lucide-react';

type TriggerSource = 'client' | 'admin';
type TriggerMatchMode = 'exact' | 'contains';
type TriggerAction = 'activate' | 'deactivate';
type FollowUpMode = 'MANUAL' | 'AI';

interface GlobalSettings {
  id: string;
  singleton_key: string;
  is_bot_paused: boolean;
  pause_until: string | null;
  pause_reason: string;
  followups_enabled: boolean;
  operator_interrupt_enabled: boolean;
  operator_resume_after_minutes: number;
  updated_at?: string;
}

interface TriggerRule {
  id: string;
  name: string;
  is_active: boolean;
  order: number;
  source: TriggerSource;
  phrase: string;
  match_mode: TriggerMatchMode;
  case_sensitive: boolean;
  action: TriggerAction;
  duration_minutes: number;
  customer_message_count: number;
}

interface FollowUpRule {
  id: string;
  name: string;
  is_active: boolean;
  order: number;
  delay_minutes: number;
  message_mode: FollowUpMode;
  manual_text: string;
  ai_instruction: string;
  context_message_limit: number;
}

type TriggerForm = Omit<TriggerRule, 'id'>;
type FollowUpForm = Omit<FollowUpRule, 'id'>;

const defaultTriggerForm: TriggerForm = {
  name: '',
  is_active: true,
  order: 0,
  source: 'client',
  phrase: '',
  match_mode: 'contains',
  case_sensitive: false,
  action: 'deactivate',
  duration_minutes: 10,
  customer_message_count: 0,
};

const defaultFollowUpForm: FollowUpForm = {
  name: '',
  is_active: true,
  order: 1,
  delay_minutes: 5,
  message_mode: 'MANUAL',
  manual_text: '',
  ai_instruction: '',
  context_message_limit: 10,
};

const AISettings: React.FC = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const { confirm, confirmationModal } = useActionConfirm();
  const { language } = useLanguage();
  const { isAdmin } = useAuth();
  const tr = useCallback((en: string, ru: string, uz: string) => (language === 'ru' ? ru : language === 'uz' ? uz : en), [language]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingGlobal, setSavingGlobal] = useState(false);
  const [resumingGlobal, setResumingGlobal] = useState(false);
  const [runningFollowUps, setRunningFollowUps] = useState(false);

  const [globalSettings, setGlobalSettings] = useState<GlobalSettings | null>(null);
  const [globalForm, setGlobalForm] = useState({
    is_bot_paused: false,
    pause_for_minutes: 10,
    pause_reason: '',
    followups_enabled: true,
    operator_interrupt_enabled: true,
    operator_resume_after_minutes: 2,
  });

  const [triggers, setTriggers] = useState<TriggerRule[]>([]);
  const [triggersIncludeInactive, setTriggersIncludeInactive] = useState(false);
  const [triggersLoading, setTriggersLoading] = useState(false);
  const [triggerModalOpen, setTriggerModalOpen] = useState(false);
  const [triggerSaving, setTriggerSaving] = useState(false);
  const [editingTrigger, setEditingTrigger] = useState<TriggerRule | null>(null);
  const [triggerForm, setTriggerForm] = useState<TriggerForm>(defaultTriggerForm);

  const [followUps, setFollowUps] = useState<FollowUpRule[]>([]);
  const [followUpsIncludeInactive, setFollowUpsIncludeInactive] = useState(false);
  const [followUpsLoading, setFollowUpsLoading] = useState(false);
  const [followUpModalOpen, setFollowUpModalOpen] = useState(false);
  const [followUpSaving, setFollowUpSaving] = useState(false);
  const [editingFollowUp, setEditingFollowUp] = useState<FollowUpRule | null>(null);
  const [followUpForm, setFollowUpForm] = useState<FollowUpForm>(defaultFollowUpForm);

  const handleAuthFailure = useCallback((e: unknown) => {
    if (e instanceof ApiError && e.status === 401) { navigate('/login', { replace: true }); return true; }
    if (e instanceof ApiError && e.status === 403) { navigate('/403', { replace: true }); return true; }
    return false;
  }, [navigate]);

  const loadGlobal = useCallback(async () => {
    const res = await apiRequest<{ settings?: GlobalSettings }>(ENDPOINTS.AUTOMATION.SETTINGS);
    const s = res.settings || null;
    setGlobalSettings(s);
    if (s) {
      setGlobalForm((p) => ({
        ...p,
        is_bot_paused: s.is_bot_paused,
        pause_reason: s.pause_reason || '',
        followups_enabled: s.followups_enabled,
        operator_interrupt_enabled: s.operator_interrupt_enabled,
        operator_resume_after_minutes: s.operator_resume_after_minutes ?? p.operator_resume_after_minutes,
      }));
    }
  }, []);

  const loadTriggers = useCallback(async () => {
    setTriggersLoading(true);
    try {
      const qs = triggersIncludeInactive ? '?include_inactive=1' : '';
      const res = await apiRequest<{ results?: TriggerRule[] }>(`${ENDPOINTS.AUTOMATION.TRIGGERS}${qs}`);
      setTriggers(res.results || []);
    } finally {
      setTriggersLoading(false);
    }
  }, [triggersIncludeInactive]);

  const loadFollowUps = useCallback(async () => {
    setFollowUpsLoading(true);
    try {
      const qs = followUpsIncludeInactive ? '?include_inactive=1' : '';
      const res = await apiRequest<{ results?: FollowUpRule[] }>(`${ENDPOINTS.AUTOMATION.FOLLOW_UPS}${qs}`);
      setFollowUps(res.results || []);
    } finally {
      setFollowUpsLoading(false);
    }
  }, [followUpsIncludeInactive]);

  const refreshAll = useCallback(async (initial = false) => {
    try {
      initial ? setLoading(true) : setRefreshing(true);
      await Promise.all([loadGlobal(), loadTriggers(), loadFollowUps()]);
    } catch (e) {
      if (!handleAuthFailure(e)) toast.error(e instanceof Error ? e.message : tr('Failed to load AI settings', 'Failed to load AI settings', "AI sozlamalarini yuklab bo\'lmadi"));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [handleAuthFailure, loadFollowUps, loadGlobal, loadTriggers, toast, tr]);

  useEffect(() => { refreshAll(true); }, [refreshAll]);
  useEffect(() => { loadTriggers().catch(() => {}); }, [loadTriggers]);
  useEffect(() => { loadFollowUps().catch(() => {}); }, [loadFollowUps]);

  const saveGlobal = async () => {
    const confirmed = await confirm({
      title: tr('Save global settings', 'Save global settings', 'Global sozlamalarni saqlash'),
      message: tr(
        'Apply these global automation changes?',
        'Apply these global automation changes?',
        'Bu global avtomatika o‘zgarishlarini qo‘llaysizmi?'
      ),
      confirmLabel: tr('Apply changes', 'Apply changes', "O'zgarishlarni qo'llash"),
      cancelLabel: tr('Cancel', 'Cancel', 'Bekor'),
      tone: 'primary',
    });
    if (!confirmed) return;

    try {
      setSavingGlobal(true);
      const res = await apiRequest<{ settings?: GlobalSettings }>(ENDPOINTS.AUTOMATION.SETTINGS, {
        method: 'PUT',
        body: JSON.stringify(globalForm),
      });
      if (res.settings) setGlobalSettings(res.settings);
      toast.success(tr('Global settings saved', 'Global settings saved', 'Global sozlamalar saqlandi'));
    } catch (e) {
      if (!handleAuthFailure(e)) toast.error(e instanceof Error ? e.message : tr('Failed to save global settings', 'Failed to save global settings', "Global sozlamalarni saqlab bo\'lmadi"));
    } finally {
      setSavingGlobal(false);
    }
  };

  const resumeGlobal = async () => {
    try {
      setResumingGlobal(true);
      const res = await apiRequest<{ settings?: GlobalSettings }>(ENDPOINTS.AUTOMATION.RESUME, { method: 'POST', body: JSON.stringify({}) });
      if (res.settings) {
        setGlobalSettings(res.settings);
        setGlobalForm((p) => ({ ...p, is_bot_paused: false, pause_reason: res.settings?.pause_reason || '' }));
      }
      toast.success(tr('Bot resumed globally', 'Bot resumed globally', 'Bot global qayta yoqildi'));
    } catch (e) {
      if (!handleAuthFailure(e)) toast.error(e instanceof Error ? e.message : tr('Failed to resume bot', 'Failed to resume bot', "Botni qayta yoqib bo\'lmadi"));
    } finally {
      setResumingGlobal(false);
    }
  };

  const openTriggerCreate = () => { setEditingTrigger(null); setTriggerForm({ ...defaultTriggerForm }); setTriggerModalOpen(true); };
  const openTriggerEdit = (r: TriggerRule) => { setEditingTrigger(r); const { id: _id, ...rest } = r; setTriggerForm(rest); setTriggerModalOpen(true); };
  const openFollowUpCreate = () => { setEditingFollowUp(null); setFollowUpForm({ ...defaultFollowUpForm }); setFollowUpModalOpen(true); };
  const openFollowUpEdit = (r: FollowUpRule) => { setEditingFollowUp(r); const { id: _id, ...rest } = r; setFollowUpForm(rest); setFollowUpModalOpen(true); };

  const saveTrigger = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!triggerForm.phrase.trim()) return toast.warning(tr('Phrase is required', 'Phrase is required', 'Ibora kerak'));
    if ((triggerForm.duration_minutes || 0) <= 0 && (triggerForm.customer_message_count || 0) <= 0) {
      return toast.warning(tr('Set duration or message count', 'Set duration or message count', 'Davomiylik yoki xabar soni kiriting'));
    }
    if (editingTrigger) {
      const confirmed = await confirm({
        title: tr('Save trigger changes', 'Save trigger changes', 'Trigger o‘zgarishlarini saqlash'),
        message: tr(
          `Save changes for "${editingTrigger.name}"?`,
          `Save changes for "${editingTrigger.name}"?`,
          `"${editingTrigger.name}" uchun o'zgarishlarni saqlaysizmi?`
        ),
        confirmLabel: tr('Save changes', 'Save changes', "O'zgarishlarni saqlash"),
        cancelLabel: tr('Cancel', 'Cancel', 'Bekor'),
        tone: 'primary',
      });
      if (!confirmed) return;
    }
    try {
      setTriggerSaving(true);
      const payload = { ...triggerForm, name: triggerForm.name.trim() || triggerForm.phrase.trim() };
      if (editingTrigger) {
        await apiRequest(ENDPOINTS.AUTOMATION.TRIGGER_DETAIL(editingTrigger.id), { method: 'PATCH', body: JSON.stringify(payload) });
      } else {
        await apiRequest(ENDPOINTS.AUTOMATION.TRIGGERS, { method: 'POST', body: JSON.stringify(payload) });
      }
      setTriggerModalOpen(false);
      await loadTriggers();
      toast.success(tr('Trigger saved', 'Trigger saved', 'Trigger saqlandi'));
    } catch (e) {
      if (!handleAuthFailure(e)) toast.error(e instanceof Error ? e.message : tr('Failed to save trigger', 'Failed to save trigger', "Triggerni saqlab bo\'lmadi"));
    } finally {
      setTriggerSaving(false);
    }
  };

  const deleteTrigger = async (id: string) => {
    const confirmed = await confirm({
      title: tr('Delete trigger rule', 'Delete trigger rule', "Trigger qoidasini o'chirish"),
      message: tr('Delete trigger rule?', 'Delete trigger rule?', "Trigger qoidasini o'chirasizmi?"),
      confirmLabel: tr('Delete rule', 'Delete rule', "Qoidani o'chirish"),
      cancelLabel: tr('Cancel', 'Cancel', 'Bekor'),
      tone: 'danger',
    });
    if (!confirmed) return;
    try {
      await apiRequest(ENDPOINTS.AUTOMATION.TRIGGER_DETAIL(id), { method: 'DELETE' });
      await loadTriggers();
      toast.success(tr('Trigger deleted', 'Trigger deleted', "Trigger o\'chirildi"));
    } catch (e) {
      if (!handleAuthFailure(e)) toast.error(e instanceof Error ? e.message : tr('Failed to delete trigger', 'Failed to delete trigger', "Triggerni o\'chirib bo\'lmadi"));
    }
  };

  const saveFollowUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!followUpForm.name.trim()) return toast.warning(tr('Rule name is required', 'Rule name is required', 'Qoida nomi kerak'));
    if (followUpForm.message_mode === 'MANUAL' && !followUpForm.manual_text.trim()) return toast.warning(tr('Manual text is required', 'Manual text is required', 'Manual matn kerak'));
    if (followUpForm.message_mode === 'AI' && !followUpForm.ai_instruction.trim()) return toast.warning(tr('AI instruction is required', 'AI instruction is required', 'AI instruktsiya kerak'));
    if (editingFollowUp) {
      const confirmed = await confirm({
        title: tr('Save follow-up changes', 'Save follow-up changes', "Follow-up o'zgarishlarini saqlash"),
        message: tr(
          `Save changes for "${editingFollowUp.name}"?`,
          `Save changes for "${editingFollowUp.name}"?`,
          `"${editingFollowUp.name}" uchun o'zgarishlarni saqlaysizmi?`
        ),
        confirmLabel: tr('Save changes', 'Save changes', "O'zgarishlarni saqlash"),
        cancelLabel: tr('Cancel', 'Cancel', 'Bekor'),
        tone: 'primary',
      });
      if (!confirmed) return;
    }
    try {
      setFollowUpSaving(true);
      if (editingFollowUp) {
        await apiRequest(ENDPOINTS.AUTOMATION.FOLLOW_UP_DETAIL(editingFollowUp.id), { method: 'PATCH', body: JSON.stringify(followUpForm) });
      } else {
        await apiRequest(ENDPOINTS.AUTOMATION.FOLLOW_UPS, { method: 'POST', body: JSON.stringify(followUpForm) });
      }
      setFollowUpModalOpen(false);
      await loadFollowUps();
      toast.success(tr('Follow-up saved', 'Follow-up saved', 'Follow-up saqlandi'));
    } catch (e) {
      if (!handleAuthFailure(e)) toast.error(e instanceof Error ? e.message : tr('Failed to save follow-up', 'Failed to save follow-up', "Follow-upni saqlab bo\'lmadi"));
    } finally {
      setFollowUpSaving(false);
    }
  };

  const deleteFollowUp = async (id: string) => {
    const confirmed = await confirm({
      title: tr('Delete follow-up rule', 'Delete follow-up rule', "Follow-up qoidasini o'chirish"),
      message: tr('Delete follow-up rule?', 'Delete follow-up rule?', "Follow-up qoidasini o'chirasizmi?"),
      confirmLabel: tr('Delete rule', 'Delete rule', "Qoidani o'chirish"),
      cancelLabel: tr('Cancel', 'Cancel', 'Bekor'),
      tone: 'danger',
    });
    if (!confirmed) return;
    try {
      await apiRequest(ENDPOINTS.AUTOMATION.FOLLOW_UP_DETAIL(id), { method: 'DELETE' });
      await loadFollowUps();
      toast.success(tr('Follow-up deleted', 'Follow-up deleted', "Follow-up o\'chirildi"));
    } catch (e) {
      if (!handleAuthFailure(e)) toast.error(e instanceof Error ? e.message : tr('Failed to delete follow-up', 'Failed to delete follow-up', "Follow-upni o\'chirib bo\'lmadi"));
    }
  };

  const runFollowUpsNow = async () => {
    try {
      setRunningFollowUps(true);
      const res = await apiRequest<{ summary?: { processed?: number; sent?: number; skipped?: number } }>(ENDPOINTS.AUTOMATION.FOLLOW_UPS_RUN, {
        method: 'POST',
        body: JSON.stringify({ limit: 100, provider: 'openai' }),
      });
      const s = res.summary || {};
      toast.success(`${tr('Run complete', 'Run complete', 'Ish tugadi')}: ${tr('sent', 'sent', 'yuborildi')} ${s.sent || 0}, ${tr('skipped', 'skipped', "O\'tkazildi")} ${s.skipped || 0}`);
    } catch (e) {
      if (!handleAuthFailure(e)) toast.error(e instanceof Error ? e.message : tr('Failed to run follow-ups', 'Failed to run follow-ups', 'Follow-up ishga tushmadi'));
    } finally {
      setRunningFollowUps(false);
    }
  };

  const globalMeta = useMemo(() => ({
    updated: globalSettings?.updated_at ? new Date(globalSettings.updated_at).toLocaleString() : '-',
    pauseUntil: globalSettings?.pause_until || '-',
  }), [globalSettings]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-light-text dark:text-white inline-flex items-center gap-2">
            <Settings2 size={24} className="text-primary-blue" />
            {tr('AI Settings', 'AI Settings', 'AI sozlamalari')}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {tr('Global automation settings, trigger rules and follow-up rules.', 'Global automation settings, trigger rules and follow-up rules.', 'Global sozlamalar, trigger va follow-up qoidalari.')}
          </p>
        </div>
        <button onClick={() => refreshAll(false)} disabled={refreshing || loading} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-light-border dark:border-navy-700 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-navy-800 disabled:opacity-50">
          <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
          {tr('Refresh', 'Refresh', 'Yangilash')}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <Card title={tr('Playground', 'Playground', 'Playground')}>
          <button onClick={() => navigate('/ai-tools')} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-primary-blue text-white text-sm">
            <PlayCircle size={15} /> {tr('Open', 'Open', 'Ochish')}
          </button>
        </Card>
        <Card title={tr('Credentials', 'Credentials', 'Credentiallar')}>
          <button onClick={() => navigate('/ai-credentials')} disabled={!isAdmin} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-primary-blue text-white text-sm disabled:opacity-50">
            <KeyRound size={15} /> {isAdmin ? tr('Open', 'Open', 'Ochish') : tr('Admin only', 'Admin only', 'Faqat admin')}
          </button>
        </Card>
        <Card title={tr('Updated', 'Updated', 'Yangilangan')}><p className="text-sm text-gray-600 dark:text-gray-300">{globalMeta.updated}</p></Card>
        <Card title={tr('Pause Until', 'Pause Until', 'Pauza gacha')}><p className="text-sm text-gray-600 dark:text-gray-300">{globalMeta.pauseUntil}</p></Card>
      </div>

      <Card title={tr('Global Automation Settings', 'Global Automation Settings', 'Global avtomatika sozlamalari')}>
        {loading ? <p className="text-sm text-gray-500">{tr('Loading...', 'Loading...', 'Yuklanmoqda...')}</p> : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Switch checked={globalForm.is_bot_paused} onChange={(v) => setGlobalForm((p) => ({ ...p, is_bot_paused: v }))} label={tr('Global bot pause', 'Global bot pause', 'Global bot pauzasi')} />
              <Switch checked={globalForm.followups_enabled} onChange={(v) => setGlobalForm((p) => ({ ...p, followups_enabled: v }))} label={tr('Follow-ups enabled', 'Follow-ups enabled', 'Follow-up yoqilgan')} />
              <Switch checked={globalForm.operator_interrupt_enabled} onChange={(v) => setGlobalForm((p) => ({ ...p, operator_interrupt_enabled: v }))} label={tr('Operator interruption enabled', 'Operator interruption enabled', 'Operator interruption yoqilgan')} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">{tr('Pause minutes', 'Pause minutes', 'Pauza daqiqasi')}</label>
                <input type="number" min={0} value={globalForm.pause_for_minutes} onChange={(e) => setGlobalForm((p) => ({ ...p, pause_for_minutes: Number(e.target.value || 0) }))} className="w-full bg-gray-50 dark:bg-navy-900 border border-light-border dark:border-navy-600 rounded-lg px-3 py-2 text-sm dark:text-white" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">{tr('Operator resume (min)', 'Operator resume (min)', 'Operator resume (daq)')}</label>
                <input type="number" min={0} value={globalForm.operator_resume_after_minutes} onChange={(e) => setGlobalForm((p) => ({ ...p, operator_resume_after_minutes: Number(e.target.value || 0) }))} className="w-full bg-gray-50 dark:bg-navy-900 border border-light-border dark:border-navy-600 rounded-lg px-3 py-2 text-sm dark:text-white" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">{tr('Pause reason', 'Pause reason', 'Pauza sababi')}</label>
                <input value={globalForm.pause_reason} onChange={(e) => setGlobalForm((p) => ({ ...p, pause_reason: e.target.value }))} className="w-full bg-gray-50 dark:bg-navy-900 border border-light-border dark:border-navy-600 rounded-lg px-3 py-2 text-sm dark:text-white" />
              </div>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <button onClick={resumeGlobal} disabled={resumingGlobal} className="px-4 py-2 rounded-lg border border-light-border dark:border-navy-600 text-sm dark:text-white disabled:opacity-50">{resumingGlobal ? tr('Resuming...', 'Resuming...', 'Qayta yoqilmoqda...') : tr('Resume now', 'Resume now', 'Hozir yoqish')}</button>
              <button onClick={saveGlobal} disabled={savingGlobal} className="px-4 py-2 rounded-lg bg-primary-blue text-white text-sm disabled:opacity-50">{savingGlobal ? tr('Saving...', 'Saving...', 'Saqlanmoqda...') : tr('Save', 'Save', 'Saqlash')}</button>
            </div>
          </div>
        )}
      </Card>

      <Card
        title={tr('Trigger Rules', 'Trigger Rules', 'Trigger qoidalari')}
        action={
          <div className="flex items-center gap-2">
            <label className="inline-flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
              <input type="checkbox" checked={triggersIncludeInactive} onChange={(e) => setTriggersIncludeInactive(e.target.checked)} />
              {tr('Include inactive', 'Include inactive', 'Nofaollar')}
            </label>
            <button onClick={openTriggerCreate} className="px-3 py-1.5 rounded-lg bg-primary-blue text-white text-sm inline-flex items-center gap-2">
              <Plus size={14} /> {tr('Add', "Qo\'shish", "Qo\'shish")}
            </button>
          </div>
        }
      >
        {triggersLoading && !triggers.length ? (
          <p className="text-sm text-gray-500">{tr('Loading triggers...', 'Loading triggers...', 'Triggerlar yuklanmoqda...')}</p>
        ) : triggers.length === 0 ? (
          <p className="text-sm text-gray-500">{tr('No trigger rules', "Trigger qoidalari yo\'q", "Trigger qoidalari yo\'q")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-xs uppercase text-gray-500 border-b border-light-border dark:border-navy-700">
                  <th className="py-2 pr-3">{tr('Name', 'Name', 'Nomi')}</th>
                  <th className="py-2 pr-3">{tr('Phrase', 'Phrase', 'Ibora')}</th>
                  <th className="py-2 pr-3">{tr('Source', 'Source', 'Manba')}</th>
                  <th className="py-2 pr-3">{tr('Action', 'Action', 'Amal')}</th>
                  <th className="py-2 pr-3">{tr('Duration/Count', 'Duration/Count', 'Davomiylik/Sanoq')}</th>
                  <th className="py-2 pr-3">{tr('Status', 'Status', 'Holat')}</th>
                  <th className="py-2 text-right">{tr('Actions', 'Actions', 'Amallar')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-light-border dark:divide-navy-700">
                {triggers.map((r) => (
                  <tr key={r.id}>
                    <td className="py-3 pr-3 text-sm text-gray-900 dark:text-white">{r.name}</td>
                    <td className="py-3 pr-3 text-sm text-gray-700 dark:text-gray-300">
                      <div className="flex flex-col">
                        <span>{r.phrase}</span>
                        <span className="text-xs text-gray-500">{r.match_mode}{r.case_sensitive ? ' / case' : ''}</span>
                      </div>
                    </td>
                    <td className="py-3 pr-3 text-sm text-gray-700 dark:text-gray-300">{r.source}</td>
                    <td className="py-3 pr-3 text-sm">
                      <span className={`px-2 py-1 rounded text-xs ${r.action === 'deactivate' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>{r.action}</span>
                    </td>
                    <td className="py-3 pr-3 text-sm text-gray-700 dark:text-gray-300">{r.duration_minutes || 0} / {r.customer_message_count || 0}</td>
                    <td className="py-3 pr-3 text-sm">
                      <span className={`px-2 py-1 rounded text-xs ${r.is_active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{r.is_active ? tr('Active', 'Active', 'Faol') : tr('Inactive', 'Inactive', 'Nofaol')}</span>
                    </td>
                    <td className="py-3 text-right">
                      <div className="inline-flex items-center gap-2">
                        <button onClick={() => openTriggerEdit(r)} className="p-1.5 text-gray-500 dark:text-gray-300 hover:text-primary-blue dark:hover:text-blue-400"><Edit2 size={15} /></button>
                        <button onClick={() => deleteTrigger(r.id)} className="p-1.5 text-gray-500 dark:text-gray-300 hover:text-red-600 dark:hover:text-red-400"><Trash2 size={15} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card
        title={tr('Follow-up Rules', 'Follow-up Rules', 'Follow-up qoidalari')}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
              <input type="checkbox" checked={followUpsIncludeInactive} onChange={(e) => setFollowUpsIncludeInactive(e.target.checked)} />
              {tr('Include inactive', 'Include inactive', 'Nofaollar')}
            </label>
            <button onClick={runFollowUpsNow} disabled={runningFollowUps} className="px-3 py-1.5 rounded-lg border border-light-border dark:border-navy-600 text-sm inline-flex items-center gap-2 disabled:opacity-50">
              <Play size={14} /> {runningFollowUps ? tr('Running...', 'Running...', 'Ishlamoqda...') : tr('Run now', 'Run now', 'Hozir ishga tushirish')}
            </button>
            <button onClick={openFollowUpCreate} className="px-3 py-1.5 rounded-lg bg-primary-blue text-white text-sm inline-flex items-center gap-2">
              <Plus size={14} /> {tr('Add', "Qo\'shish", "Qo\'shish")}
            </button>
          </div>
        }
      >
        {followUpsLoading && !followUps.length ? (
          <p className="text-sm text-gray-500">{tr('Loading follow-ups...', 'Loading follow-ups...', 'Follow-uplar yuklanmoqda...')}</p>
        ) : followUps.length === 0 ? (
          <p className="text-sm text-gray-500">{tr('No follow-up rules', "Follow-up qoidalari yo\'q", "Follow-up qoidalari yo\'q")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-xs uppercase text-gray-500 border-b border-light-border dark:border-navy-700">
                  <th className="py-2 pr-3">{tr('Name', 'Name', 'Nomi')}</th>
                  <th className="py-2 pr-3">{tr('Delay', 'Delay', 'Kechikish')}</th>
                  <th className="py-2 pr-3">{tr('Mode', 'Mode', 'Rejim')}</th>
                  <th className="py-2 pr-3">{tr('Context', 'Context', 'Kontekst')}</th>
                  <th className="py-2 pr-3">{tr('Status', 'Status', 'Holat')}</th>
                  <th className="py-2 text-right">{tr('Actions', 'Actions', 'Amallar')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-light-border dark:divide-navy-700">
                {followUps.map((r) => (
                  <tr key={r.id}>
                    <td className="py-3 pr-3 text-sm text-gray-900 dark:text-white">
                      <div className="flex flex-col">
                        <span>{r.name}</span>
                        <span className="text-xs text-gray-500 truncate max-w-[320px]">{r.message_mode === 'MANUAL' ? (r.manual_text || '-') : (r.ai_instruction || '-')}</span>
                      </div>
                    </td>
                    <td className="py-3 pr-3 text-sm text-gray-700 dark:text-gray-300">{r.delay_minutes}</td>
                    <td className="py-3 pr-3 text-sm"><span className={`px-2 py-1 rounded text-xs ${r.message_mode === 'AI' ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'}`}>{r.message_mode}</span></td>
                    <td className="py-3 pr-3 text-sm text-gray-700 dark:text-gray-300">{r.context_message_limit}</td>
                    <td className="py-3 pr-3 text-sm"><span className={`px-2 py-1 rounded text-xs ${r.is_active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{r.is_active ? tr('Active', 'Active', 'Faol') : tr('Inactive', 'Inactive', 'Nofaol')}</span></td>
                    <td className="py-3 text-right">
                      <div className="inline-flex items-center gap-2">
                        <button onClick={() => openFollowUpEdit(r)} className="p-1.5 text-gray-500 dark:text-gray-300 hover:text-primary-blue dark:hover:text-blue-400"><Edit2 size={15} /></button>
                        <button onClick={() => deleteFollowUp(r.id)} className="p-1.5 text-gray-500 dark:text-gray-300 hover:text-red-600 dark:hover:text-red-400"><Trash2 size={15} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal isOpen={triggerModalOpen} onClose={() => { setTriggerModalOpen(false); setEditingTrigger(null); }} title={editingTrigger ? tr('Edit Trigger', 'Edit Trigger', 'Triggerni tahrirlash') : tr('Add Trigger', "Trigger qo\'shish", "Trigger qo\'shish")} footer={null}>
        <form onSubmit={saveTrigger} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">{tr('Name', 'Name', 'Nomi')}</label>
              <input value={triggerForm.name} onChange={(e) => setTriggerForm((p) => ({ ...p, name: e.target.value }))} className="w-full bg-gray-50 dark:bg-navy-900 border border-light-border dark:border-navy-600 rounded-lg px-3 py-2 text-sm dark:text-white" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">{tr('Phrase', 'Phrase', 'Ibora')}</label>
              <input required value={triggerForm.phrase} onChange={(e) => setTriggerForm((p) => ({ ...p, phrase: e.target.value }))} className="w-full bg-gray-50 dark:bg-navy-900 border border-light-border dark:border-navy-600 rounded-lg px-3 py-2 text-sm dark:text-white" />
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <select value={triggerForm.source} onChange={(e) => setTriggerForm((p) => ({ ...p, source: e.target.value as TriggerSource }))} className="bg-gray-50 dark:bg-navy-900 border border-light-border dark:border-navy-600 rounded-lg px-3 py-2 text-sm dark:text-white"><option value="client">client</option><option value="admin">admin</option></select>
            <select value={triggerForm.match_mode} onChange={(e) => setTriggerForm((p) => ({ ...p, match_mode: e.target.value as TriggerMatchMode }))} className="bg-gray-50 dark:bg-navy-900 border border-light-border dark:border-navy-600 rounded-lg px-3 py-2 text-sm dark:text-white"><option value="contains">contains</option><option value="exact">exact</option></select>
            <select value={triggerForm.action} onChange={(e) => setTriggerForm((p) => ({ ...p, action: e.target.value as TriggerAction }))} className="bg-gray-50 dark:bg-navy-900 border border-light-border dark:border-navy-600 rounded-lg px-3 py-2 text-sm dark:text-white"><option value="deactivate">deactivate</option><option value="activate">activate</option></select>
            <input type="number" min={0} value={triggerForm.order} onChange={(e) => setTriggerForm((p) => ({ ...p, order: Number(e.target.value || 0) }))} className="bg-gray-50 dark:bg-navy-900 border border-light-border dark:border-navy-600 rounded-lg px-3 py-2 text-sm dark:text-white" placeholder={tr('Order', 'Order', 'Tartib')} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input type="number" min={0} value={triggerForm.duration_minutes} onChange={(e) => setTriggerForm((p) => ({ ...p, duration_minutes: Number(e.target.value || 0) }))} className="bg-gray-50 dark:bg-navy-900 border border-light-border dark:border-navy-600 rounded-lg px-3 py-2 text-sm dark:text-white" placeholder={tr('Duration minutes', 'Duration minutes', 'Daqiqa')} />
            <input type="number" min={0} value={triggerForm.customer_message_count} onChange={(e) => setTriggerForm((p) => ({ ...p, customer_message_count: Number(e.target.value || 0) }))} className="bg-gray-50 dark:bg-navy-900 border border-light-border dark:border-navy-600 rounded-lg px-3 py-2 text-sm dark:text-white" placeholder={tr('Client messages count', 'Client messages count', 'Xabar soni')} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Switch checked={triggerForm.is_active} onChange={(v) => setTriggerForm((p) => ({ ...p, is_active: v }))} label={tr('Active', 'Active', 'Faol')} />
            <Switch checked={triggerForm.case_sensitive} onChange={(v) => setTriggerForm((p) => ({ ...p, case_sensitive: v }))} label={tr('Case sensitive', 'Case sensitive', 'Registr sezgir')} />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => { setTriggerModalOpen(false); setEditingTrigger(null); }} className="px-3 py-2 rounded-lg border border-light-border dark:border-navy-600 text-sm">{tr('Cancel', 'Cancel', 'Bekor')}</button>
            <button type="submit" disabled={triggerSaving} className="px-3 py-2 rounded-lg bg-primary-blue text-white text-sm disabled:opacity-50">{triggerSaving ? tr('Saving...', 'Saving...', 'Saqlanmoqda...') : tr('Save', 'Save', 'Saqlash')}</button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={followUpModalOpen} onClose={() => { setFollowUpModalOpen(false); setEditingFollowUp(null); }} title={editingFollowUp ? tr('Edit Follow-up', 'Edit Follow-up', 'Follow-up tahrirlash') : tr('Add Follow-up', "Follow-up qo\'shish", "Follow-up qo\'shish")} footer={null}>
        <form onSubmit={saveFollowUp} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">{tr('Name', 'Name', 'Nomi')}</label>
              <input required value={followUpForm.name} onChange={(e) => setFollowUpForm((p) => ({ ...p, name: e.target.value }))} className="w-full bg-gray-50 dark:bg-navy-900 border border-light-border dark:border-navy-600 rounded-lg px-3 py-2 text-sm dark:text-white" />
            </div>
            <div className="mt-5"><Switch checked={followUpForm.is_active} onChange={(v) => setFollowUpForm((p) => ({ ...p, is_active: v }))} label={tr('Active', 'Active', 'Faol')} /></div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <input type="number" min={0} value={followUpForm.order} onChange={(e) => setFollowUpForm((p) => ({ ...p, order: Number(e.target.value || 0) }))} className="bg-gray-50 dark:bg-navy-900 border border-light-border dark:border-navy-600 rounded-lg px-3 py-2 text-sm dark:text-white" placeholder={tr('Order', 'Order', 'Tartib')} />
            <input type="number" min={1} value={followUpForm.delay_minutes} onChange={(e) => setFollowUpForm((p) => ({ ...p, delay_minutes: Number(e.target.value || 1) }))} className="bg-gray-50 dark:bg-navy-900 border border-light-border dark:border-navy-600 rounded-lg px-3 py-2 text-sm dark:text-white" placeholder={tr('Delay min', 'Delay min', 'Kechikish')} />
            <select value={followUpForm.message_mode} onChange={(e) => setFollowUpForm((p) => ({ ...p, message_mode: e.target.value as FollowUpMode }))} className="bg-gray-50 dark:bg-navy-900 border border-light-border dark:border-navy-600 rounded-lg px-3 py-2 text-sm dark:text-white"><option value="MANUAL">MANUAL</option><option value="AI">AI</option></select>
            <input type="number" min={1} value={followUpForm.context_message_limit} onChange={(e) => setFollowUpForm((p) => ({ ...p, context_message_limit: Number(e.target.value || 10) }))} className="bg-gray-50 dark:bg-navy-900 border border-light-border dark:border-navy-600 rounded-lg px-3 py-2 text-sm dark:text-white" placeholder={tr('Context', 'Context', 'Kontekst')} />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">{tr('Manual text', 'Manual text', 'Manual matn')}</label>
            <textarea
              value={followUpForm.manual_text}
              onChange={(e) => setFollowUpForm((p) => ({ ...p, manual_text: e.target.value }))}
              disabled={followUpForm.message_mode !== 'MANUAL'}
              className={`w-full h-20 border rounded-lg px-3 py-2 text-sm ${
                followUpForm.message_mode !== 'MANUAL'
                  ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed dark:bg-navy-900/40 dark:text-gray-500 dark:border-navy-700'
                  : 'bg-gray-50 dark:bg-navy-900 border-light-border dark:border-navy-600 dark:text-white'
              }`}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">{tr('AI instruction', 'AI instruction', 'AI instruktsiya')}</label>
            <textarea
              value={followUpForm.ai_instruction}
              onChange={(e) => setFollowUpForm((p) => ({ ...p, ai_instruction: e.target.value }))}
              disabled={followUpForm.message_mode !== 'AI'}
              className={`w-full h-24 border rounded-lg px-3 py-2 text-sm ${
                followUpForm.message_mode !== 'AI'
                  ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed dark:bg-navy-900/40 dark:text-gray-500 dark:border-navy-700'
                  : 'bg-gray-50 dark:bg-navy-900 border-light-border dark:border-navy-600 dark:text-white'
              }`}
            />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => { setFollowUpModalOpen(false); setEditingFollowUp(null); }} className="px-3 py-2 rounded-lg border border-light-border dark:border-navy-600 text-sm">{tr('Cancel', 'Cancel', 'Bekor')}</button>
            <button type="submit" disabled={followUpSaving} className="px-3 py-2 rounded-lg bg-primary-blue text-white text-sm disabled:opacity-50">{followUpSaving ? tr('Saving...', 'Saving...', 'Saqlanmoqda...') : tr('Save', 'Save', 'Saqlash')}</button>
          </div>
        </form>
      </Modal>
      {confirmationModal}
    </div>
  );
};

export default AISettings;
