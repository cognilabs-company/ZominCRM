const DEFAULT_CLIENT_API_BASE_URL =
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_CLIENT_API_BASE_URL) ||
  (typeof window !== 'undefined' ? `${window.location.origin}/client/webapp` : '/client/webapp');

export const CLIENT_API_BASE_URL = DEFAULT_CLIENT_API_BASE_URL;

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
  const hasBody = init?.body !== undefined && init?.body !== null;
  const headers: Record<string, string> = {
    ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
    ...(init?.headers as Record<string, string> | undefined),
  };

  if (sessionToken) {
    headers.Authorization = `Bearer ${sessionToken}`;
  }

  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const response = await fetch(`${CLIENT_API_BASE_URL}${normalizedPath}`, {
    ...init,
    headers,
  });

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
