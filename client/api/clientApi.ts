const envClientApiBaseUrl =
  typeof import.meta !== 'undefined' ? (import.meta as any).env?.VITE_CLIENT_API_BASE_URL : undefined;

const envAdminApiBaseUrl =
  typeof import.meta !== 'undefined' ? (import.meta as any).env?.VITE_API_BASE_URL : undefined;

const isLocalLikeUrl = (value?: string) => {
  if (!value) return false;

  try {
    const parsed = new URL(value);
    return parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
  } catch {
    return value.includes('localhost') || value.includes('127.0.0.1');
  }
};

const deriveClientApiBaseUrl = () => {
  const currentHost =
    typeof window !== 'undefined' && window.location.hostname
      ? window.location.hostname
      : '';
  const currentHostIsLocal =
    currentHost === 'localhost' || currentHost === '127.0.0.1';

  if (envClientApiBaseUrl && (!isLocalLikeUrl(envClientApiBaseUrl) || currentHostIsLocal)) {
    return envClientApiBaseUrl;
  }

  if (envAdminApiBaseUrl && (!isLocalLikeUrl(envAdminApiBaseUrl) || currentHostIsLocal)) {
    return envAdminApiBaseUrl.replace(/\/internal\/?$/, '/client/webapp');
  }

  if (currentHost === 'zomin.cognilabs.org') {
    return 'https://api.zomin.cognilabs.org/client/webapp';
  }

  if (typeof window !== 'undefined') {
    const { protocol, hostname, origin } = window.location;
    const isLocalHost = hostname === 'localhost' || hostname === '127.0.0.1';
    const isApiHost = hostname.startsWith('api.');

    if (!isLocalHost && !isApiHost) {
      return `${protocol}//api.${hostname}/client/webapp`;
    }

    return `${origin}/client/webapp`;
  }

  return '/client/webapp';
};

const DEFAULT_CLIENT_API_BASE_URL = deriveClientApiBaseUrl();

export const CLIENT_API_BASE_URL = DEFAULT_CLIENT_API_BASE_URL;
export const CLIENT_CONFIG_URL = `${CLIENT_API_BASE_URL}/config/`;

export class ClientApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

const extractClientErrorMessage = (payload: unknown, fallback: string) => {
  if (!payload || typeof payload !== 'object') return fallback;
  const obj = payload as Record<string, unknown>;

  if (typeof obj.message === 'string' && obj.message.trim()) {
    return obj.message;
  }

  const nested = obj.error;
  if (nested && typeof nested === 'object') {
    const nestedMessage = (nested as Record<string, unknown>).message;
    if (typeof nestedMessage === 'string' && nestedMessage.trim()) {
      return nestedMessage;
    }
  }

  return fallback;
};

export async function clientApiRequest<T = unknown>(path: string, init?: RequestInit, sessionToken?: string): Promise<T> {
  const body = init?.body;
  const hasBody = body !== undefined && body !== null;
  const shouldSetJsonContentType =
    hasBody &&
    !(body instanceof FormData) &&
    !(body instanceof URLSearchParams);
  const headers: Record<string, string> = {
    ...(shouldSetJsonContentType ? { 'Content-Type': 'application/json' } : {}),
    ...(init?.headers as Record<string, string> | undefined),
  };

  if (sessionToken) {
    headers.Authorization = `Bearer ${sessionToken}`;
  }

  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const requestUrl = `${CLIENT_API_BASE_URL}${normalizedPath}`;
  let response: Response;

  try {
    response = await fetch(requestUrl, {
      ...init,
      headers,
      mode: 'cors',
    });
  } catch (error) {
    throw new ClientApiError(
      error instanceof Error ? `${error.message} (${requestUrl})` : `Failed to fetch (${requestUrl})`,
      0
    );
  }

  const text = await response.text();
  let payload: unknown = null;

  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }

  if (!response.ok) {
    throw new ClientApiError(
      extractClientErrorMessage(payload, `Request failed with status ${response.status}`),
      response.status
    );
  }

  return payload as T;
}
