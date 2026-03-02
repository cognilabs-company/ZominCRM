/**
 * API Configuration
 * 
 * Based on Frontend Contract:
 * Base: /internal/
 * Envelope: { "ok": true, ...data }
 */

const envApiBaseUrl =
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

const resolveApiBaseUrl = () => {
  const currentHost =
    typeof window !== 'undefined' && window.location.hostname
      ? window.location.hostname
      : 'localhost';

  const currentHostIsLocal = currentHost === 'localhost' || currentHost === '127.0.0.1';

  if (envApiBaseUrl && (!isLocalLikeUrl(envApiBaseUrl) || currentHostIsLocal)) {
    return envApiBaseUrl;
  }

  if (currentHost === 'zomin.cognilabs.org') {
    return 'https://api.zomin.cognilabs.org/internal';
  }

  if (!currentHostIsLocal && !currentHost.startsWith('api.')) {
    return `${window.location.protocol}//api.${currentHost}/internal`;
  }

  return `http://${currentHost}:8000/internal`;
};

export const API_BASE_URL = resolveApiBaseUrl();

const resolveApiOrigin = () => {
  try {
    return new URL(API_BASE_URL).origin;
  } catch {
    if (typeof window !== 'undefined') {
      return window.location.origin;
    }
    return '';
  }
};

export const resolveAdminMediaUrl = (value?: string | null) => {
  if (!value) return null;

  try {
    return new URL(value, resolveApiOrigin()).toString();
  } catch {
    return value;
  }
};

// Endpoints
export const ENDPOINTS = {
  AUTH: {
    REGISTER: `${API_BASE_URL}/auth/register/`,
    LOGIN: `${API_BASE_URL}/auth/login/`,
    ME: `${API_BASE_URL}/auth/me/`,
    LOGOUT: `${API_BASE_URL}/auth/logout/`,
    PERMISSIONS: `${API_BASE_URL}/auth/permissions/`,
  },
  DASHBOARD: {
    STATS: `${API_BASE_URL}/dashboard/stats/`,
    STATS_EXPORT: `${API_BASE_URL}/dashboard/stats/export.xlsx`,
    PENDING_PAYMENTS: `${API_BASE_URL}/dashboard/pending-payments/`,
    USERS: `${API_BASE_URL}/dashboard/users/`,
    USER_DETAIL: (id: string) => `${API_BASE_URL}/dashboard/users/${id}/`,
  },
  ORDERS: {
    LIST: `${API_BASE_URL}/orders/`, // params: status, limit, offset
    CREATE: `${API_BASE_URL}/orders/create/`,
    CREATE_FULL: `${API_BASE_URL}/orders/create-full/`,
    UPDATE_STATUS: (id: string) => `${API_BASE_URL}/orders/${id}/status/transition/`,
    ADD_ITEM: (id: string) => `${API_BASE_URL}/orders/${id}/items/upsert/`,
    REMOVE_ITEM: (id: string) => `${API_BASE_URL}/orders/${id}/items/remove/`,
    UPDATE_DELIVERY: (id: string) => `${API_BASE_URL}/orders/${id}/delivery/update/`,
    SET_PAYMENT_METHOD: (id: string) => `${API_BASE_URL}/orders/${id}/payment-method/set/`,
  },
  PRODUCTS: {
    LIST_CREATE: `${API_BASE_URL}/products/`,
    LOW_STOCK: `${API_BASE_URL}/products/low-stock/`,
    DETAIL: (id: string) => `${API_BASE_URL}/products/${id}/`,
    STOCK_ADJUST: (id: string) => `${API_BASE_URL}/products/${id}/stock/adjust/`,
    STOCK_SET: (id: string) => `${API_BASE_URL}/products/${id}/stock/set/`,
    STOCK_HISTORY: (id: string) => `${API_BASE_URL}/products/${id}/stock/history/`,
  },
  CLIENTS: {
    LIST: `${API_BASE_URL}/clients/`,
    UPSERT: `${API_BASE_URL}/clients/upsert/`,
    BOTTLE_BALANCES: (id: string) => `${API_BASE_URL}/clients/${id}/bottle-balances/`,
    BOTTLE_REFUNDS: (id: string) => `${API_BASE_URL}/clients/${id}/bottle-refunds/`,
  },
  LEADS: {
    LIST: `${API_BASE_URL}/leads/`,
    UPSERT: `${API_BASE_URL}/leads/upsert/`,
  },
  CONVERSATIONS: {
    LIST: `${API_BASE_URL}/conversations/`,
    MESSAGES: (id: string) => `${API_BASE_URL}/conversations/${id}/messages/`,
    ADMIN_SEND: (id: string) => `${API_BASE_URL}/conversations/${id}/admin-send/`,
    CLEAR: (id: string) => `${API_BASE_URL}/conversations/${id}/clear/`,
    BOT_PAUSE: (id: string) => `${API_BASE_URL}/conversations/${id}/bot/pause/`,
    BOT_RESUME: (id: string) => `${API_BASE_URL}/conversations/${id}/bot/resume/`,
    AUTOMATION_SETTINGS: (id: string) => `${API_BASE_URL}/conversations/${id}/automation/settings/`,
    AUTOMATION_RESUME: (id: string) => `${API_BASE_URL}/conversations/${id}/automation/resume/`,
    AUTOMATION_FOLLOW_UPS: (id: string) => `${API_BASE_URL}/conversations/${id}/automation/follow-ups/`,
    AUTOMATION_FOLLOW_UP_DETAIL: (conversationId: string, followUpId: string) =>
      `${API_BASE_URL}/conversations/${conversationId}/automation/follow-ups/${followUpId}/`,
    OPEN: `${API_BASE_URL}/conversations/open/`,
    ATTACH_ORDER: `${API_BASE_URL}/conversations/attach-order/`,
  },
  AUTOMATION: {
    SETTINGS: `${API_BASE_URL}/automation/settings/`,
    RESUME: `${API_BASE_URL}/automation/resume/`,
    TRIGGERS: `${API_BASE_URL}/automation/triggers/`,
    TRIGGER_DETAIL: (id: string) => `${API_BASE_URL}/automation/triggers/${id}/`,
    FOLLOW_UPS: `${API_BASE_URL}/automation/follow-ups/`,
    FOLLOW_UP_DETAIL: (id: string) => `${API_BASE_URL}/automation/follow-ups/${id}/`,
    FOLLOW_UPS_RUN: `${API_BASE_URL}/automation/follow-ups/run/`,
  },
  AI: {
    TOOLS: `${API_BASE_URL}/ai/tools/`,
    PLAYGROUND: `${API_BASE_URL}/ai/playground/`,
    REPLY: (id: string) => `${API_BASE_URL}/ai/conversations/${id}/reply/`,
    CREDENTIALS: `${API_BASE_URL}/ai/credentials/`,
    PROMPTS_SYNC: `${API_BASE_URL}/ai/prompts/sync/`,
  },
  INSTAGRAM: {
    WEBHOOK: `${API_BASE_URL}/instagram/webhook/`,
    PAGES: `${API_BASE_URL}/instagram/pages/`,
    PAGE_DETAIL: (id: string) => `${API_BASE_URL}/instagram/pages/${id}/`,
  },
  PAYMENTS: {
    ATTEMPTS: `${API_BASE_URL}/payments/attempts/`,
    TRANSACTIONS: `${API_BASE_URL}/payments/transactions/`,
    TRANSACTION_INGEST: `${API_BASE_URL}/payments/transactions/ingest/`,
    TRANSACTION_MATCH: (id: string) => `${API_BASE_URL}/payments/transactions/${id}/match/`,
    TRANSACTION_ATTACH_ORDER: (id: string) => `${API_BASE_URL}/payments/transactions/${id}/attach-order/`,
    MANUAL_CONFIRM: `${API_BASE_URL}/payments/manual-confirm/`,
    REMINDERS_RUN: `${API_BASE_URL}/payments/reminders/run/`,
    QUEUE_AMBIGUOUS: `${API_BASE_URL}/payments/queue/ambiguous/`,
    SIGNAL_SOURCES: `${API_BASE_URL}/payments/signal-sources/`,
    SIGNAL_SOURCE_DETAIL: (id: string) => `${API_BASE_URL}/payments/signal-sources/${id}/`,
    SIGNAL_SOURCE_SENDERS: (id: string) => `${API_BASE_URL}/payments/signal-sources/${id}/senders/`,
    SIGNAL_SENDER_DETAIL: (id: string) => `${API_BASE_URL}/payments/signal-senders/${id}/`,
  },
  COURIERS: {
    LIST: `${API_BASE_URL}/couriers/`,
    STATS: `${API_BASE_URL}/couriers/stats/`,
    DETAIL: (id: string) => `${API_BASE_URL}/couriers/${id}/`,
    QUEUE: `${API_BASE_URL}/couriers/queue/`,
    EVENTS: `${API_BASE_URL}/couriers/events/`,
    DISPATCH: (id: string) => `${API_BASE_URL}/couriers/orders/${id}/dispatch/`,
    ACCEPT: (id: string) => `${API_BASE_URL}/couriers/orders/${id}/accept/`,
    REJECT: (id: string) => `${API_BASE_URL}/couriers/orders/${id}/reject/`,
    OUT_FOR_DELIVERY: (id: string) => `${API_BASE_URL}/couriers/orders/${id}/out-for-delivery/`,
    DELIVERED: (id: string) => `${API_BASE_URL}/couriers/orders/${id}/delivered/`,
    PROBLEM: (id: string) => `${API_BASE_URL}/couriers/orders/${id}/problem/`,
  },
  BOTTLES: {
    MOVEMENTS: `${API_BASE_URL}/bottles/movements/`,
  },
};

// Helper for headers
export const getHeaders = (includeAuth = true) => {
  const token = localStorage.getItem('auth_token');
  const headers: Record<string, string> = {};
  if (includeAuth && token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};

interface ApiEnvelope<T = unknown> {
  ok?: boolean;
  message?: string;
  error?: {
    code?: string;
    message?: string;
    [key: string]: unknown;
  };
  data?: T;
  [key: string]: unknown;
}

export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const extractApiErrorCode = (payload: unknown): string | undefined => {
  if (!payload || typeof payload !== 'object') return undefined;
  const obj = payload as Record<string, unknown>;

  if (typeof obj.code === 'string' && obj.code.trim()) {
    return obj.code;
  }

  const nestedError = obj.error;
  if (nestedError && typeof nestedError === 'object') {
    const nestedCode = (nestedError as Record<string, unknown>).code;
    if (typeof nestedCode === 'string' && nestedCode.trim()) {
      return nestedCode;
    }
  }

  return undefined;
};

const extractApiErrorMessage = (payload: unknown, fallback: string): string => {
  if (!payload || typeof payload !== 'object') return fallback;
  const obj = payload as Record<string, unknown>;

  if (typeof obj.message === 'string' && obj.message.trim()) {
    return obj.message;
  }

  const nestedError = obj.error;
  if (nestedError && typeof nestedError === 'object') {
    const nestedMessage = (nestedError as Record<string, unknown>).message;
    if (typeof nestedMessage === 'string' && nestedMessage.trim()) {
      return nestedMessage;
    }
  }

  return fallback;
};

// Handles envelope-style responses and plain JSON payloads.
export async function apiRequest<T = unknown>(url: string, init?: RequestInit): Promise<T> {
  const hasBody = init?.body !== undefined && init?.body !== null;
  const isFormDataBody = typeof FormData !== 'undefined' && init?.body instanceof FormData;
  const isPublicAuthEndpoint = url.includes('/auth/login/') || url.includes('/auth/register/');
  const res = await fetch(url, {
    ...init,
    headers: {
      ...getHeaders(!isPublicAuthEndpoint),
      ...(hasBody && !isFormDataBody ? { 'Content-Type': 'application/json' } : {}),
      ...(init?.headers || {}),
    },
  });

  const text = await res.text();
  let payload: ApiEnvelope<T> | T | null = null;

  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      throw new Error(text);
    }
  }

  if (!res.ok) {
    const message = extractApiErrorMessage(payload, `Request failed with status ${res.status}`);
    throw new ApiError(message, res.status, extractApiErrorCode(payload));
  }

  if (!payload) {
    return {} as T;
  }

  if (typeof payload === 'object' && payload !== null && 'ok' in payload) {
    const envelope = payload as ApiEnvelope<T>;
    if (envelope.ok === false) {
      throw new Error(extractApiErrorMessage(envelope, 'Request failed'));
    }
    if (envelope.data !== undefined) {
      return envelope.data;
    }
  }

  return payload as T;
}
