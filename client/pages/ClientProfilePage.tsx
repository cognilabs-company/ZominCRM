import React from 'react';
import { CheckCircle2, Pencil, RefreshCw, UserRound, X } from 'lucide-react';
import { clientApiRequest } from '../api/clientApi';
import { useClientApp } from '../bootstrap/ClientAppContext';
import { useClientLanguage } from '../bootstrap/ClientLanguageContext';
import { ClientErrorPanel } from '../components/ClientErrorPanel';
import { ClientPage } from '../components/ClientPage';
import { ClientPanel } from '../components/ClientPanel';
import { SkeletonProfileCard } from '../components/ClientSkeleton';
import { ClientProfile, ClientProfileResponse, ClientUiLanguage } from '../types';
import { getClientLanguageLabel } from '../utils';

type ProfileFormState = {
  full_name: string;
  phone: string;
  address: string;
  preferred_language: ClientUiLanguage;
};

const toFormState = (profile: ClientProfile | null, fallbackLanguage: ClientUiLanguage): ProfileFormState => ({
  full_name: profile?.full_name || '',
  phone: profile?.phone || '',
  address: profile?.address || '',
  preferred_language: (profile?.preferred_language as ClientUiLanguage) || fallbackLanguage,
});

export const ClientProfilePage: React.FC = () => {
  const {
    client: bootstrapClient,
    clientCreated,
    sessionToken,
    telegramAvailable,
    telegramUser,
    refreshBootstrap,
  } = useClientApp();
  const { language, setLanguage, t } = useClientLanguage();
  const [profile, setProfile] = React.useState<ClientProfile | null>(bootstrapClient);
  const [form, setForm] = React.useState<ProfileFormState>(() => toFormState(bootstrapClient, language));
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [editing, setEditing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [saveMessage, setSaveMessage] = React.useState<string | null>(null);

  const loadProfile = React.useCallback(async () => {
    if (!sessionToken) return;
    try {
      setLoading(true);
      setError(null);
      const response = await clientApiRequest<ClientProfileResponse | ClientProfile>('/profile/', undefined, sessionToken);
      const currentProfile = (response as ClientProfileResponse).client || (response as ClientProfile);
      if (!currentProfile?.id) return;
      setProfile(currentProfile);
      setForm(toFormState(currentProfile, language));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : t('profile.error_load'));
    } finally {
      setLoading(false);
    }
  }, [language, sessionToken, t]);

  React.useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  React.useEffect(() => {
    if (!profile || editing) return;
    setForm(toFormState(profile, language));
  }, [editing, language, profile]);

  const handleChange = <K extends keyof ProfileFormState>(key: K, value: ProfileFormState[K]) => {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const handleCancel = () => {
    setEditing(false);
    setSaveMessage(null);
    setForm(toFormState(profile, language));
  };

  const handleSave = async () => {
    if (!sessionToken) return;
    try {
      setSaving(true);
      setError(null);
      setSaveMessage(null);
      const response = await clientApiRequest<ClientProfileResponse | ClientProfile>(
        '/profile/',
        {
          method: 'PATCH',
          body: JSON.stringify({
            full_name: form.full_name.trim(),
            phone: form.phone.trim(),
            address: form.address.trim(),
            preferred_language: form.preferred_language,
          }),
        },
        sessionToken
      );
      const nextProfile = (response as ClientProfileResponse).client || (response as ClientProfile);
      if (nextProfile?.id) {
        setProfile(nextProfile);
        setForm(toFormState(nextProfile, form.preferred_language));
      }
      setLanguage(form.preferred_language);
      setEditing(false);
      setSaveMessage(t('profile.saved'));
      await refreshBootstrap();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t('profile.error_save'));
    } finally {
      setSaving(false);
    }
  };

  const accountRows = [
    { key: 'username', label: t('profile.username'), value: profile?.username || telegramUser?.username || '-' },
    { key: 'platform_user_id', label: t('profile.platform_user_id'), value: profile?.platform_user_id || telegramUser?.id || '-' },
    { key: 'platform', label: t('profile.platform'), value: profile?.platform || '-' },
    { key: 'telegram_language', label: t('profile.telegram_language'), value: getClientLanguageLabel(telegramUser?.language_code, language) },
  ];

  const statusRows = [
    { key: 'client_created', label: t('profile.client_created'), value: clientCreated ? t('profile.yes') : t('profile.no') },
    { key: 'has_phone', label: t('profile.has_phone'), value: profile?.has_phone ? t('profile.yes') : t('profile.no') },
    { key: 'identity_verified', label: t('profile.identity_verified'), value: profile?.is_platform_identity_verified ? t('profile.yes') : t('profile.no') },
  ];

  return (
    <ClientPage
      title={t('profile.title')}
      subtitle={t('profile.subtitle')}
      action={
        editing ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCancel}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <X size={15} />
              {t('profile.cancel')}
            </button>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(15,23,42,0.18)] transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <CheckCircle2 size={15} />
              {saving ? t('profile.saving') : t('profile.save')}
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(15,23,42,0.18)] transition hover:bg-slate-800"
            >
              <Pencil size={15} />
              {t('profile.edit')}
            </button>
            <button
              type="button"
              onClick={() => void loadProfile()}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
              {t('orders.refresh')}
            </button>
          </div>
        )
      }
    >
      {error ? (
        <ClientErrorPanel
          title={t('common.error_title')}
          message={error}
          className="border-rose-200 bg-[rgba(255,241,240,0.95)]"
        />
      ) : null}

      {saveMessage ? (
        <ClientPanel className="border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
          {saveMessage}
        </ClientPanel>
      ) : null}

      {loading && !profile ? <SkeletonProfileCard /> : null}

      <ClientPanel className="p-5">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
            <UserRound size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold text-slate-950">{profile?.full_name || telegramUser?.first_name || telegramUser?.username || t('layout.telegram_client')}</h2>
            <p className="mt-1 text-sm text-slate-500">
              {telegramAvailable ? t('profile.context_detected') : t('profile.context_preview')}
            </p>
          </div>
        </div>

        <div className="mt-5">
          <h3 className="text-sm font-semibold text-slate-950">{t('profile.edit_title')}</h3>
          <div className="mt-3 grid grid-cols-1 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700">{t('profile.full_name')}</label>
              <input
                type="text"
                value={form.full_name}
                onChange={(event) => handleChange('full_name', event.target.value)}
                disabled={!editing || saving}
                className="mt-2 w-full rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 disabled:cursor-not-allowed disabled:opacity-70"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">{t('profile.phone')}</label>
              <input
                type="text"
                value={form.phone}
                onChange={(event) => handleChange('phone', event.target.value)}
                disabled={!editing || saving}
                className="mt-2 w-full rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 disabled:cursor-not-allowed disabled:opacity-70"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">{t('profile.address')}</label>
              <textarea
                value={form.address}
                onChange={(event) => handleChange('address', event.target.value)}
                disabled={!editing || saving}
                className="mt-2 h-24 w-full rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 disabled:cursor-not-allowed disabled:opacity-70"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">{t('profile.preferred_language')}</label>
              <select
                value={form.preferred_language}
                onChange={(event) => handleChange('preferred_language', event.target.value as ClientUiLanguage)}
                disabled={!editing || saving}
                className="mt-2 w-full rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 disabled:cursor-not-allowed disabled:opacity-70"
              >
                <option value="uz">{t('language.uz')}</option>
                <option value="ru">{t('language.ru')}</option>
                <option value="en">{t('language.en')}</option>
              </select>
            </div>
          </div>
        </div>
      </ClientPanel>

      <ClientPanel className="p-5">
        <h3 className="text-sm font-semibold text-slate-950">{t('profile.details_title')}</h3>
        <div className="mt-3 grid grid-cols-1 gap-3 text-sm">
          {accountRows.map((row) => (
            <div key={row.key} className="rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">{row.label}</p>
              <p className="mt-2 font-medium text-slate-950">{row.value}</p>
            </div>
          ))}
        </div>
      </ClientPanel>

      <ClientPanel className="p-5">
        <h3 className="text-sm font-semibold text-slate-950">{t('profile.status_title')}</h3>
        <div className="mt-3 grid grid-cols-1 gap-3 text-sm">
          {statusRows.map((row) => (
            <div key={row.key} className="rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">{row.label}</p>
              <p className="mt-2 font-medium text-slate-950">{row.value}</p>
            </div>
          ))}
        </div>
        {loading ? <p className="mt-3 text-xs text-slate-500">{t('profile.refreshing')}</p> : null}
      </ClientPanel>
    </ClientPage>
  );
};
