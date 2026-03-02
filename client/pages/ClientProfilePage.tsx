import React from 'react';
import { UserRound } from 'lucide-react';
import { clientApiRequest } from '../api/clientApi';
import { useClientApp } from '../bootstrap/ClientAppContext';
import { useClientLanguage } from '../bootstrap/ClientLanguageContext';
import { ClientErrorPanel } from '../components/ClientErrorPanel';
import { ClientPage } from '../components/ClientPage';
import { ClientPanel } from '../components/ClientPanel';
import { SkeletonProfileCard } from '../components/ClientSkeleton';
import { ClientProfile, ClientProfileResponse } from '../types';
import { formatDateTime, getClientLanguageLabel } from '../utils';

export const ClientProfilePage: React.FC = () => {
  const {
    apiBaseUrl,
    client: bootstrapClient,
    clientCreated,
    sessionToken,
    status,
    telegramAvailable,
    telegramUser,
    tokenExpiresAt,
  } = useClientApp();
  const { language, t } = useClientLanguage();
  const [profile, setProfile] = React.useState<ClientProfile | null>(bootstrapClient);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!sessionToken) return;
    let active = true;
    const loadProfile = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await clientApiRequest<ClientProfileResponse | ClientProfile>('/profile/', undefined, sessionToken);
        const currentProfile = (response as ClientProfileResponse).client || (response as ClientProfile);
        if (!active || !currentProfile?.id) return;
        setProfile(currentProfile);
      } catch (loadError) {
        if (!active) return;
        setError(loadError instanceof Error ? loadError.message : t('profile.error_load'));
      } finally {
        if (active) setLoading(false);
      }
    };

    void loadProfile();
    return () => {
      active = false;
    };
  }, [sessionToken, t]);

  return (
    <ClientPage title={t('profile.title')} subtitle={t('profile.subtitle')}>
      {error ? (
        <ClientErrorPanel
          title={t('common.error_title')}
          message={error}
          className="border-rose-200 bg-[rgba(255,241,240,0.95)]"
        />
      ) : null}

      {loading && !profile ? <SkeletonProfileCard /> : null}

      <div className="grid gap-3">
        <ClientPanel className="p-5">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#21404d_0%,#3d6c77_100%)] text-white">
              <UserRound size={20} />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-[#1f2933]">{profile?.full_name || telegramUser?.first_name || telegramUser?.username || t('layout.telegram_client')}</h2>
              <p className="mt-1 text-sm text-[#5b6770]">
                {telegramAvailable ? t('profile.context_detected') : t('profile.context_preview')}
              </p>
              <div className="mt-4 grid grid-cols-1 gap-3 text-sm text-[#5b6770]">
                <div className="rounded-[24px] bg-[rgba(255,248,240,0.94)] px-4 py-3"><span className="font-medium text-[#1f2933]">{t('profile.username')}:</span> {profile?.username || telegramUser?.username || '-'}</div>
                <div className="rounded-[24px] bg-[rgba(232,241,238,0.95)] px-4 py-3"><span className="font-medium text-[#1f2933]">{t('profile.phone')}:</span> {profile?.phone || '-'}</div>
                <div className="rounded-[24px] bg-[rgba(235,240,244,0.94)] px-4 py-3"><span className="font-medium text-[#1f2933]">{t('profile.address')}:</span> {profile?.address || '-'}</div>
                <div className="rounded-[24px] bg-[rgba(255,248,240,0.94)] px-4 py-3"><span className="font-medium text-[#1f2933]">{t('profile.preferred_language')}:</span> {getClientLanguageLabel(profile?.preferred_language || telegramUser?.language_code, language)}</div>
                <div className="rounded-[24px] bg-[rgba(232,241,238,0.95)] px-4 py-3"><span className="font-medium text-[#1f2933]">{t('profile.telegram_language')}:</span> {getClientLanguageLabel(telegramUser?.language_code, language)}</div>
                <div className="rounded-[24px] bg-[rgba(232,241,238,0.95)] px-4 py-3"><span className="font-medium text-[#1f2933]">{t('profile.platform_user_id')}:</span> {profile?.platform_user_id || telegramUser?.id || '-'}</div>
                <div className="rounded-[24px] bg-[rgba(235,240,244,0.94)] px-4 py-3"><span className="font-medium text-[#1f2933]">{t('profile.client_created')}:</span> {clientCreated ? t('profile.yes') : t('profile.no')}</div>
                <div className="rounded-[24px] bg-[rgba(255,248,240,0.94)] px-4 py-3"><span className="font-medium text-[#1f2933]">{t('profile.platform')}:</span> {profile?.platform || '-'}</div>
                <div className="rounded-[24px] bg-[rgba(232,241,238,0.95)] px-4 py-3"><span className="font-medium text-[#1f2933]">{t('profile.has_phone')}:</span> {profile?.has_phone ? t('profile.yes') : t('profile.no')}</div>
                <div className="rounded-[24px] bg-[rgba(235,240,244,0.94)] px-4 py-3"><span className="font-medium text-[#1f2933]">{t('profile.identity_verified')}:</span> {profile?.is_platform_identity_verified ? t('profile.yes') : t('profile.no')}</div>
                <div className="rounded-[24px] bg-[rgba(255,248,240,0.94)] px-4 py-3"><span className="font-medium text-[#1f2933]">{t('profile.can_receive_telegram')}:</span> {profile?.can_receive_telegram ? t('profile.yes') : t('profile.no')}</div>
              </div>
              {loading ? <p className="mt-3 text-xs text-[#7b8790]">{t('profile.refreshing')}</p> : null}
            </div>
          </div>
        </ClientPanel>

        <ClientPanel className="p-5">
          <h2 className="text-base font-semibold text-[#1f2933]">{t('profile.client_session')}</h2>
          <p className="mt-2 text-sm leading-6 text-[#5b6770]">{t('profile.client_session_description')}</p>
          <div className="mt-4 grid grid-cols-1 gap-3 text-sm text-[#5b6770]">
            <div className="rounded-[24px] bg-[rgba(255,248,240,0.94)] px-4 py-3"><span className="font-medium text-[#1f2933]">{t('profile.api_base')}:</span> {apiBaseUrl}</div>
            <div className="rounded-[24px] bg-[rgba(232,241,238,0.95)] px-4 py-3"><span className="font-medium text-[#1f2933]">{t('profile.session_status')}:</span> {t(`layout.status.${status}`)}</div>
            <div className="rounded-[24px] bg-[rgba(235,240,244,0.94)] px-4 py-3"><span className="font-medium text-[#1f2933]">{t('profile.token_expires_at')}:</span> {formatDateTime(tokenExpiresAt, language)}</div>
          </div>
        </ClientPanel>
      </div>
    </ClientPage>
  );
};
