import React from 'react';
import { clientApiRequest, CLIENT_API_BASE_URL } from '../api/clientApi';
import { ClientBootstrapResponse, ClientBootstrapState, ClientTelegramUser } from '../types';

interface ClientAppContextValue extends ClientBootstrapState {
  refreshBootstrap: () => Promise<void>;
}

const ClientAppContext = React.createContext<ClientAppContextValue | undefined>(undefined);

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
};

export const ClientAppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = React.useState<ClientBootstrapState>(initialState);

  const refreshBootstrap = React.useCallback(async () => {
    const telegramWebApp = typeof window !== 'undefined' ? (window as any).Telegram?.WebApp : null;
    telegramWebApp?.ready?.();
    telegramWebApp?.expand?.();

    const snapshot = getTelegramSnapshot();

    if (!snapshot.initData) {
      setState({
        ...initialState,
        status: 'ready',
        mode: snapshot.mode,
        telegramAvailable: snapshot.telegramAvailable,
        initData: snapshot.initData,
        telegramUser: snapshot.telegramUser,
        apiBaseUrl: CLIENT_API_BASE_URL,
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
        headers: {
          'X-Telegram-Init-Data': snapshot.initData,
        },
        body: JSON.stringify({ init_data: snapshot.initData }),
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
      });
    } catch (error) {
      setState({
        ...initialState,
        status: 'error',
        mode: snapshot.mode,
        telegramAvailable: snapshot.telegramAvailable,
        initData: snapshot.initData,
        telegramUser: snapshot.telegramUser,
        apiBaseUrl: CLIENT_API_BASE_URL,
        error: error instanceof Error ? error.message : 'Mijoz WebApp bootstrapi bajarilmadi.',
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

