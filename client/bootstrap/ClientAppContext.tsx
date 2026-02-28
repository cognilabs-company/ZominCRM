import React from 'react';
import { clientApiRequest, CLIENT_API_BASE_URL } from '../api/clientApi';
import { ClientBootstrapResponse, ClientBootstrapState, ClientTelegramUser, ClientWebAppConfigResponse, ClientWebAppEntry } from '../types';

interface ClientAppContextValue extends ClientBootstrapState {
  refreshBootstrap: () => Promise<void>;
}

const ClientAppContext = React.createContext<ClientAppContextValue | undefined>(undefined);

const resolveOpenInTelegramUrl = (entry: ClientWebAppEntry | null) => {
  if (!entry) return null;
  return entry.startapp_url || entry.start_url || entry.bot_url || null;
};

const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

const getTelegramSnapshot = () => {
  if (typeof window === 'undefined') {
    return {
      telegramAvailable: false,
      initData: '',
      telegramUser: null as ClientTelegramUser | null,
      mode: 'preview' as const,
    };
  }

  const telegramWebApp = (window as any).Telegram?.WebApp;
  const rawUser = telegramWebApp?.initDataUnsafe?.user;

  return {
    telegramAvailable: Boolean(telegramWebApp),
    initData: telegramWebApp?.initData || '',
    telegramUser: rawUser
      ? {
          id: rawUser.id,
          first_name: rawUser.first_name,
          last_name: rawUser.last_name,
          username: rawUser.username,
          language_code: rawUser.language_code,
        }
      : null,
    mode: telegramWebApp?.initData ? ('telegram' as const) : ('preview' as const),
  };
};

const initialState: ClientBootstrapState = {
  status: 'loading',
  mode: 'preview',
  telegramAvailable: false,
  initData: '',
  telegramUser: null,
  apiBaseUrl: CLIENT_API_BASE_URL,
  error: null,
  sessionToken: null,
  tokenExpiresAt: null,
  tokenExpiresIn: null,
  clientCreated: false,
  client: null,
  activeOrder: null,
  bottleSummary: null,
  isAuthenticated: false,
  entry: null,
  openInTelegramUrl: null,
};

export const ClientAppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = React.useState<ClientBootstrapState>(initialState);

  const refreshBootstrap = React.useCallback(async () => {
    const resolveSnapshot = async () => {
      let attempts = 0;
      let snapshot = getTelegramSnapshot();

      while (!snapshot.initData && attempts < 10) {
        attempts += 1;
        await wait(150);
        snapshot = getTelegramSnapshot();
      }

      return snapshot;
    };

    const snapshot = await resolveSnapshot();
    const telegramWebApp = typeof window !== 'undefined' ? (window as any).Telegram?.WebApp : null;
    telegramWebApp?.ready?.();
    telegramWebApp?.expand?.();

    const loadConfig = async () => {
      try {
        return await clientApiRequest<ClientWebAppConfigResponse>('/config/', { method: 'GET' });
      } catch {
        return null;
      }
    };

    if (!snapshot.initData) {
      const config = await loadConfig();
      setState({
        ...initialState,
        status: 'ready',
        mode: snapshot.mode,
        telegramAvailable: snapshot.telegramAvailable,
        initData: snapshot.initData,
        telegramUser: snapshot.telegramUser,
        apiBaseUrl: CLIENT_API_BASE_URL,
        entry: config?.entry || null,
        openInTelegramUrl: resolveOpenInTelegramUrl(config?.entry || null),
      });
      return;
    }

    try {
      setState((current) => ({
        ...current,
        status: 'loading',
        error: null,
        telegramAvailable: snapshot.telegramAvailable,
        initData: snapshot.initData,
        telegramUser: snapshot.telegramUser,
        mode: snapshot.mode,
      }));

      const data = await clientApiRequest<ClientBootstrapResponse>('/bootstrap/', {
        method: 'POST',
        body: new URLSearchParams({ init_data: snapshot.initData }),
      });

      setState({
        status: 'ready',
        mode: snapshot.mode,
        telegramAvailable: snapshot.telegramAvailable,
        initData: snapshot.initData,
        telegramUser: data.telegram_user || snapshot.telegramUser,
        apiBaseUrl: CLIENT_API_BASE_URL,
        error: null,
        sessionToken: data.token,
        tokenExpiresAt: data.token_expires_at,
        tokenExpiresIn: data.token_expires_in,
        clientCreated: data.client_created,
        client: data.client,
        activeOrder: data.active_order,
        bottleSummary: data.bottle_summary,
        isAuthenticated: Boolean(data.token),
        entry: data.entry || null,
        openInTelegramUrl: resolveOpenInTelegramUrl(data.entry || null),
      });
    } catch (error) {
      const config = await loadConfig();
      setState({
        ...initialState,
        status: 'error',
        mode: snapshot.mode,
        telegramAvailable: snapshot.telegramAvailable,
        initData: snapshot.initData,
        telegramUser: snapshot.telegramUser,
        apiBaseUrl: CLIENT_API_BASE_URL,
        error: error instanceof Error ? error.message : 'Mijoz WebApp bootstrapi bajarilmadi.',
        entry: config?.entry || null,
        openInTelegramUrl: resolveOpenInTelegramUrl(config?.entry || null),
      });
    }
  }, []);

  React.useEffect(() => {
    void refreshBootstrap();
  }, [refreshBootstrap]);

  const value = React.useMemo<ClientAppContextValue>(() => ({
    ...state,
    refreshBootstrap,
  }), [refreshBootstrap, state]);

  return <ClientAppContext.Provider value={value}>{children}</ClientAppContext.Provider>;
};

export const useClientApp = () => {
  const context = React.useContext(ClientAppContext);
  if (!context) {
    throw new Error('useClientApp must be used within ClientAppProvider.');
  }
  return context;
};
