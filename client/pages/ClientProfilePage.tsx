import React from 'react';
import { KeyRound, UserRound } from 'lucide-react';
import { clientApiRequest } from '../api/clientApi';
import { useClientApp } from '../bootstrap/ClientAppContext';
import { ClientPage } from '../components/ClientPage';
import { ClientPanel } from '../components/ClientPanel';
import { ClientProfile, ClientProfileResponse } from '../types';

export const ClientProfilePage: React.FC = () => {
  const { telegramUser, telegramAvailable, initData, apiBaseUrl, sessionToken, client: bootstrapClient, tokenExpiresAt, clientCreated } = useClientApp();
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
        setError(loadError instanceof Error ? loadError.message : 'Failed to load profile.');
      } finally {
        if (active) setLoading(false);
      }
    };

    void loadProfile();
    return () => {
      active = false;
    };
  }, [sessionToken]);

  return (
    <ClientPage
      title="Profile"
      subtitle="Telegram identity, verified client profile, and WebApp session context."
    >
      {error ? (
        <ClientPanel className="border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</ClientPanel>
      ) : null}

      <div className="grid gap-3">
        <ClientPanel className="p-5">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-white">
              <UserRound size={20} />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-slate-950">{profile?.full_name || telegramUser?.first_name || telegramUser?.username || 'Telegram client'}</h2>
              <p className="mt-1 text-sm text-slate-500">
                {telegramAvailable ? 'Telegram WebApp context detected.' : 'Preview mode outside Telegram WebApp.'}
              </p>
              <div className="mt-4 grid grid-cols-1 gap-2 text-sm text-slate-600">
                <p><span className="font-medium text-slate-950">Username:</span> {profile?.username || telegramUser?.username || '-'}</p>
                <p><span className="font-medium text-slate-950">Phone:</span> {profile?.phone || '-'}</p>
                <p><span className="font-medium text-slate-950">Address:</span> {profile?.address || '-'}</p>
                <p><span className="font-medium text-slate-950">Preferred language:</span> {profile?.preferred_language || telegramUser?.language_code || '-'}</p>
                <p><span className="font-medium text-slate-950">Platform user ID:</span> {profile?.platform_user_id || telegramUser?.id || '-'}</p>
                <p><span className="font-medium text-slate-950">Client created on bootstrap:</span> {clientCreated ? 'Yes' : 'No'}</p>
              </div>
              {loading ? <p className="mt-3 text-xs text-slate-400">Refreshing profile...</p> : null}
            </div>
          </div>
        </ClientPanel>

        <ClientPanel className="p-5">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-white">
              <KeyRound size={20} />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-slate-950">Client session</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                The client app now uses `/client/webapp/bootstrap/` and the returned bearer token for all WebApp requests. Admin `/internal/...` APIs are not used here.
              </p>
              <div className="mt-4 space-y-2 text-sm text-slate-600">
                <p><span className="font-medium text-slate-950">API base:</span> {apiBaseUrl}</p>
                <p><span className="font-medium text-slate-950">Token expires at:</span> {tokenExpiresAt || '-'}</p>
              </div>
              <p className="mt-3 break-all rounded-2xl bg-slate-100 px-3 py-2 text-xs text-slate-500">
                {initData || 'Telegram initData is not available in preview mode.'}
              </p>
            </div>
          </div>
        </ClientPanel>
      </div>
    </ClientPage>
  );
};
