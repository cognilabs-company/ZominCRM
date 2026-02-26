import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useToast } from '../context/ToastContext';
import { Send, Paperclip, Bot, Instagram, MessageCircle, RefreshCw, ArchiveX, ChevronLeft, ChevronDown, Search, Check, CheckCheck, AlertCircle, X } from 'lucide-react';
import { Conversation } from '../types';
import { useLanguage } from '../context/LanguageContext';
import { API_BASE_URL, ENDPOINTS, apiRequest } from '../services/api';
import { useAuth } from '../context/AuthContext';

interface ApiConversation {
  id: string;
  client_id: string;
  client_name?: string | null;
  order_id: string | null;
  channel: 'telegram' | 'instagram';
  channel_account_id?: string | null;
  external_thread_id: string;
  started_at: string;
  ended_at: string | null;
  updated_at?: string;
  last_message_at?: string;
  is_archived?: boolean;
  archived_at?: string | null;
  latest_message?: ApiMessage | null;
}

interface ApiMessage {
  id: string;
  conversation_id: string;
  role: 'client' | 'bot' | 'admin' | 'system';
  text: string;
  created_at: string;
  external_message_id?: string;
  has_attachments?: boolean;
  attachments?: Array<{
    type?: string;
    url?: string;
  }>;
  attachment_url?: string | null;
}

interface DeliveryState {
  sent: boolean;
  reason: string;
  error?: string;
}

interface ChatMessage extends ApiMessage {
  delivery?: DeliveryState;
}

interface WsMessageCreatedEvent {
  event: 'message.created';
  conversation_id: string;
  message: ApiMessage;
  conversation?: {
    id: string;
    client_name?: string | null;
    latest_message?: ApiMessage | null;
    channel?: 'telegram' | 'instagram';
    channel_account_id?: string | null;
    external_thread_id?: string;
  };
}

interface WsDeliveryStatusEvent {
  event: 'delivery.status';
  conversation_id: string;
  message_id: string;
  delivery: {
    ok: boolean;
    sent: boolean;
    channel: string;
    provider: string;
    external_message_id?: string;
    reason: string;
    error?: string;
  };
}

const WS_BACKOFF = [1000, 2000, 5000, 10000];

interface AdminSendResponse {
  ok?: boolean;
  message?: ApiMessage;
  delivery?: {
    ok: boolean;
    sent: boolean;
    channel: string;
    provider: string;
    external_message_id?: string;
    reason: string;
    error?: string;
  };
  interruption?: {
    interrupted: boolean;
    resumed: boolean;
    reason: string;
    interrupt_until?: string | null;
  };
  available_delivery_channels?: string[];
}

interface BotRuntimeState {
  conversation_id: string;
  is_paused: boolean;
  pause_until: string | null;
  paused_by_user_id?: string;
  paused_at?: string | null;
  last_resumed_at?: string | null;
  last_resume_reason?: string | null;
  trigger_effect?: {
    action: 'activate' | 'deactivate' | null;
    until?: string | null;
    remaining_customer_messages?: number;
    rule_id?: string | null;
    rule_name?: string | null;
  };
}

interface BotRuntimeResponse {
  ok?: boolean;
  state?: BotRuntimeState;
}

const FALLBACK_CLIENT_PREFIX = 'Mijoz ';

const buildFallbackClientName = (seed?: string | null) => {
  const token = String(seed || '').slice(0, 8) || 'Unknown';
  return `${FALLBACK_CLIENT_PREFIX}${token}`;
};

const isGeneratedClientName = (value?: string | null) =>
  String(value || '').startsWith(FALLBACK_CLIENT_PREFIX);

const resolveClientName = (rawName: string | null | undefined, seed?: string | null) => {
  const cleaned = String(rawName || '').trim();
  return cleaned || buildFallbackClientName(seed);
};

const normalizeAttachmentList = (message: ApiMessage) => {
  const list = Array.isArray(message.attachments) ? message.attachments : [];
  const valid = list.filter((a) => a && typeof a.url === 'string' && a.url.trim()).map((a) => ({
    type: String(a.type || 'file').toLowerCase(),
    url: String(a.url || '').trim(),
  }));

  if (valid.length > 0) return valid;

  if (message.has_attachments && message.attachment_url) {
    return [{ type: 'file', url: String(message.attachment_url).trim() }];
  }

  return [];
};

const getDisplayMessageText = (message: ApiMessage, attachments: Array<{ type: string; url: string }>) => {
  const raw = String(message.text || '').trim();
  if (!raw) return '';
  if (!attachments.length) return raw;

  // Backend keeps text as fallback/debug for attachments. Hide markers/URLs in normal UI.
  let cleaned = raw.replace(/\[ATTACHMENT:[^\]]+\]\s*/gi, '').trim();
  attachments.forEach((att) => {
    if (!att?.url) return;
    cleaned = cleaned.split(att.url).join('').trim();
  });
  cleaned = cleaned.replace(/\s{2,}/g, ' ').trim();

  if (!cleaned) return '';
  if (/^https?:\/\/\S+$/i.test(cleaned)) return '';
  return cleaned;
};

const formatClockTime = (value?: string | null) => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const formatChatListTime = (value?: string | null) => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';

  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';

  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

const isSameCalendarDay = (a?: string | null, b?: string | null) => {
  if (!a || !b) return false;
  const da = new Date(a);
  const db = new Date(b);
  if (Number.isNaN(da.getTime()) || Number.isNaN(db.getTime())) return false;
  return da.toDateString() === db.toDateString();
};

const formatMessageDateLabel = (value?: string | null) => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === now.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
};

const Conversations: React.FC = () => {
  const location = useLocation();
  const toast = useToast();
  const { language } = useLanguage();
  const { isAdmin } = useAuth();
  const tr = useCallback(
    (en: string, ru: string, uz: string) => (language === 'ru' ? ru : language === 'uz' ? uz : en),
    [language]
  );
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [listWsConnected, setListWsConnected] = useState(false);
  const [detailWsConnected, setDetailWsConnected] = useState(false);
  const [mobilePane, setMobilePane] = useState<'list' | 'chat'>('list');
  const [botRuntimeState, setBotRuntimeState] = useState<BotRuntimeState | null>(null);
  const [botRuntimeLoading, setBotRuntimeLoading] = useState(false);
  const [botRuntimeSaving, setBotRuntimeSaving] = useState(false);
  const [clearingConversationId, setClearingConversationId] = useState<string | null>(null);
  const [conversationQuery, setConversationQuery] = useState('');
  const [channelFilter, setChannelFilter] = useState<'all' | 'telegram' | 'instagram'>('all');
  const [imageViewerUrl, setImageViewerUrl] = useState<string | null>(null);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [scrollDateChip, setScrollDateChip] = useState<string>('');
  const [showScrollDateChip, setShowScrollDateChip] = useState(false);

  const messageAreaRef = useRef<HTMLDivElement | null>(null);
  const convInFlightRef = useRef(false);
  const msgInFlightRef = useRef(false);
  const hasLoadedConversationsRef = useRef(false);
  const activeConversationRef = useRef<string | null>(null);
  const shouldStickToBottomRef = useRef(true);
  const conversationLoadSeqRef = useRef(0);
  const messageLoadSeqRef = useRef(0);
  const listWsRef = useRef<WebSocket | null>(null);
  const detailWsRef = useRef<WebSocket | null>(null);
  const listRetryRef = useRef<number | null>(null);
  const detailRetryRef = useRef<number | null>(null);
  const listPingRef = useRef<number | null>(null);
  const detailPingRef = useRef<number | null>(null);
  const listRetryIdxRef = useRef(0);
  const detailRetryIdxRef = useRef(0);
  const unmountedRef = useRef(false);
  const seenWsMessageIdsRef = useRef<Set<string>>(new Set());
  const audioCtxRef = useRef<AudioContext | null>(null);
  const consumedClientTargetRef = useRef<string | null>(null);
  const scrollDateHideTimerRef = useRef<number | null>(null);

  const requestedClientId = useMemo(
    () => new URLSearchParams(location.search).get('client_id'),
    [location.search]
  );

  const selectedConversation = useMemo(
    () => conversations.find((c) => c.id === selectedChatId) || null,
    [conversations, selectedChatId]
  );

  const filteredConversations = useMemo(() => {
    const q = conversationQuery.trim().toLowerCase();
    return conversations.filter((c) => {
      if (channelFilter !== 'all' && c.channel !== channelFilter) return false;
      if (!q) return true;
      const haystack = [
        c.clientName,
        c.id,
        c.client_id,
        c.channel,
        c.channel_account_id,
      ].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(q);
    });
  }, [channelFilter, conversationQuery, conversations]);

  useEffect(() => {
    if (!selectedChatId) {
      setMobilePane('list');
    }
  }, [selectedChatId]);

  const mapConversation = useCallback((c: ApiConversation): Conversation => ({
    id: c.id,
    channel: c.channel,
    channel_account_id: c.channel_account_id ?? null,
    external_thread_id: c.external_thread_id,
    client_id: c.client_id,
    linked_order_id: c.order_id,
    last_message_preview: c.latest_message?.text || null,
    updated_at: c.latest_message?.created_at || c.last_message_at || c.updated_at || c.ended_at || c.started_at,
    clientName: resolveClientName(c.client_name, c.client_id || c.id),
  }), []);

  const normalizeMessage = useCallback((m: ApiMessage): ChatMessage => ({
    id: m.id,
    conversation_id: m.conversation_id,
    role: m.role,
    text: m.text,
    created_at: m.created_at,
    external_message_id: m.external_message_id,
    has_attachments: m.has_attachments,
    attachments: m.attachments,
    attachment_url: m.attachment_url,
  }), []);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    if (!messageAreaRef.current) return;
    messageAreaRef.current.scrollTo({ top: messageAreaRef.current.scrollHeight, behavior });
  }, []);

  const handleMessageAreaScroll = useCallback(() => {
    const area = messageAreaRef.current;
    if (!area) return;
    const distanceToBottom = area.scrollHeight - area.scrollTop - area.clientHeight;
    const isNearBottom = distanceToBottom < 72;
    shouldStickToBottomRef.current = isNearBottom;
    setShowScrollToBottom(!isNearBottom && messages.length > 0);

    const containerRect = area.getBoundingClientRect();
    const rows = area.querySelectorAll<HTMLElement>('[data-chat-message-row="1"]');
    let activeDate = '';
    for (const row of rows) {
      const rect = row.getBoundingClientRect();
      if (rect.bottom > containerRect.top + 28) {
        activeDate = row.dataset.messageDate || '';
        break;
      }
    }
    if (!activeDate && rows.length > 0) {
      activeDate = rows[rows.length - 1].dataset.messageDate || '';
    }
    if (activeDate) {
      const nextLabel = formatMessageDateLabel(activeDate);
      setScrollDateChip((prev) => (prev === nextLabel ? prev : nextLabel));
      setShowScrollDateChip(true);
      if (scrollDateHideTimerRef.current !== null) {
        window.clearTimeout(scrollDateHideTimerRef.current);
      }
      scrollDateHideTimerRef.current = window.setTimeout(() => {
        setShowScrollDateChip(false);
      }, 900);
    }
  }, [messages.length]);

  useEffect(() => {
    if (!shouldStickToBottomRef.current) return;
    scrollToBottom('auto');
    setShowScrollToBottom(false);
  }, [messages.length, scrollToBottom]);

  const playNotificationSound = useCallback(() => {
    try {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      const ctx = audioCtxRef.current || new Ctx();
      audioCtxRef.current = ctx;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.05, ctx.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.14);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.15);
    } catch {
      // Ignore audio errors
    }
  }, []);

  const markConversationRead = useCallback((conversationId: string) => {
    setConversations((prev) => prev.map((c) => (
      c.id === conversationId ? { ...c, unreadCount: 0 } : c
    )));
  }, []);

  const selectConversation = useCallback((conversationId: string) => {
    setSelectedChatId(conversationId);
    setMobilePane('chat');
    markConversationRead(conversationId);
  }, [markConversationRead]);

  useEffect(() => {
    if (!requestedClientId) {
      consumedClientTargetRef.current = null;
      return;
    }
    if (loadingConversations) return;
    if (consumedClientTargetRef.current === requestedClientId) return;

    const match = conversations.find((c) => c.client_id === requestedClientId);
    if (!match) return;

    consumedClientTargetRef.current = requestedClientId;
    if (selectedChatId !== match.id) {
      selectConversation(match.id);
    }
  }, [conversations, loadingConversations, requestedClientId, selectConversation, selectedChatId]);

  const upsertConversationPreview = useCallback((conversationId: string, message: ApiMessage, meta?: WsMessageCreatedEvent['conversation']) => {
    setConversations((prev) => {
      const idx = prev.findIndex((c) => c.id === conversationId);
      if (idx === -1) {
        const next: Conversation = {
          id: conversationId,
          channel: meta?.channel || 'telegram',
          channel_account_id: meta?.channel_account_id ?? null,
          external_thread_id: meta?.external_thread_id || '',
          client_id: null,
          linked_order_id: null,
          last_message_preview: message.text,
          updated_at: message.created_at,
          clientName: resolveClientName(meta?.client_name, conversationId),
          unreadCount: 0,
        };
        return [...prev, next];
      }
      const next = [...prev];
      const metaName = String(meta?.client_name || '').trim();
      next[idx] = {
        ...next[idx],
        clientName: metaName || next[idx].clientName || buildFallbackClientName(next[idx].client_id || next[idx].id),
        channel: meta?.channel || next[idx].channel,
        channel_account_id: meta?.channel_account_id ?? next[idx].channel_account_id ?? null,
        external_thread_id: meta?.external_thread_id || next[idx].external_thread_id,
        last_message_preview: message.text,
        updated_at: message.created_at,
        unreadCount: next[idx].unreadCount || 0,
      };
      return next;
    });
  }, []);

  const incrementUnread = useCallback((conversationId: string) => {
    setConversations((prev) => {
      const idx = prev.findIndex((c) => c.id === conversationId);
      if (idx === -1) return prev;
      const next = [...prev];
      const currentUnread = next[idx].unreadCount || 0;
      next[idx] = { ...next[idx], unreadCount: currentUnread + 1 };
      return next;
    });
  }, []);

  const applyDeliveryStatus = useCallback((event: WsDeliveryStatusEvent) => {
    setMessages((prev) => prev.map((m) => {
      if (m.id !== event.message_id) return m;
      return {
        ...m,
        external_message_id: event.delivery.external_message_id || m.external_message_id,
        delivery: {
          sent: event.delivery.sent,
          reason: event.delivery.reason,
          error: event.delivery.error || '',
        },
      };
    }));
    if (!event.delivery.sent && event.delivery.reason === 'adapter_not_configured') {
      toast.warning(tr('Channel not connected yet.', 'Kanal hali ulanmagan.', 'Kanal hali ulanmagan.'));
      return;
    }
    if (!event.delivery.sent && event.delivery.reason === 'missing_page_id') {
      toast.warning(
        tr(
          'Instagram page ID is missing for this conversation.',
          'Bu suhbat uchun Instagram page ID topilmadi.',
          'Bu suhbat uchun Instagram page ID topilmadi.'
        )
      );
    }
  }, [toast, tr]);

  const appendAdminMessageFromSendResponse = useCallback((conversationId: string, response: AdminSendResponse | ApiMessage) => {
    const sentMessage = 'message' in (response as Record<string, unknown>)
      ? (response as AdminSendResponse).message
      : (response as ApiMessage);
    if (!sentMessage?.id) return;

    const optimistic = normalizeMessage(sentMessage);
    const fullResponse = response as AdminSendResponse;
    optimistic.delivery = fullResponse.delivery
      ? {
        sent: fullResponse.delivery.sent,
        reason: fullResponse.delivery.reason || (fullResponse.delivery.sent ? 'sent' : 'failed'),
        error: fullResponse.delivery.error || '',
      }
      : { sent: false, reason: 'sending' };
    if (fullResponse.delivery?.external_message_id) {
      optimistic.external_message_id = fullResponse.delivery.external_message_id;
    }
    const shouldAutoScroll = shouldStickToBottomRef.current;
    setMessages((prev) => prev.some((m) => m.id === optimistic.id) ? prev : [...prev, optimistic]);
    upsertConversationPreview(conversationId, sentMessage);
    if (shouldAutoScroll) {
      window.setTimeout(() => scrollToBottom('smooth'), 60);
    } else {
      setShowScrollToBottom(true);
    }
  }, [normalizeMessage, scrollToBottom, upsertConversationPreview]);

  const handleWsEvent = useCallback((raw: unknown) => {
    if (!raw || typeof raw !== 'object') return;
    const payload = raw as { event?: string; type?: string };
    if (payload.type === 'pong') return;

    if (payload.event === 'message.created') {
      const event = raw as WsMessageCreatedEvent;
      if (!event.message || !event.conversation_id) return;
      if (seenWsMessageIdsRef.current.has(event.message.id)) return;
      seenWsMessageIdsRef.current.add(event.message.id);
      if (seenWsMessageIdsRef.current.size > 2000) {
        seenWsMessageIdsRef.current.clear();
      }
      const nextMessage = normalizeMessage(event.message);
      upsertConversationPreview(event.conversation_id, event.message, event.conversation);
      if (selectedChatId === event.conversation_id) {
        const shouldAutoScroll = shouldStickToBottomRef.current;
        setMessages((prev) => {
          if (prev.some((m) => m.id === nextMessage.id)) return prev;
          return [...prev, nextMessage];
        });
        if (shouldAutoScroll) {
          window.setTimeout(() => scrollToBottom('smooth'), 60);
        } else {
          setShowScrollToBottom(true);
        }
      } else if (event.message.role === 'client') {
        incrementUnread(event.conversation_id);
        playNotificationSound();
      }
      setLastSyncAt(new Date());
      return;
    }

    if (payload.event === 'delivery.status') {
      applyDeliveryStatus(raw as WsDeliveryStatusEvent);
      setLastSyncAt(new Date());
    }
  }, [applyDeliveryStatus, incrementUnread, normalizeMessage, playNotificationSound, scrollToBottom, selectedChatId, upsertConversationPreview]);

  const clearTimer = (timerRef: React.MutableRefObject<number | null>) => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const clearIntervalTimer = (timerRef: React.MutableRefObject<number | null>) => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const buildWsUrl = useCallback((path: string) => {
    const token = localStorage.getItem('auth_token');
    if (!token) return null;
    const wsBase = API_BASE_URL.replace(/\/internal\/?$/, '').replace(/^http/i, 'ws');
    return `${wsBase}${path}?token=${encodeURIComponent(token)}`;
  }, []);

  const loadConversations = useCallback(async (options?: { silent?: boolean }) => {
    const silent = Boolean(options?.silent);
    if (convInFlightRef.current) return;
    convInFlightRef.current = true;
    const seq = ++conversationLoadSeqRef.current;
    const shouldShowLoader = !silent && !hasLoadedConversationsRef.current;
    try {
      if (shouldShowLoader) {
        setLoadingConversations(true);
      }
      const data = await apiRequest<ApiConversation[] | { results?: ApiConversation[] }>(ENDPOINTS.CONVERSATIONS.LIST);
      const rawList: ApiConversation[] = Array.isArray(data)
        ? (data as ApiConversation[])
        : ((data.results || []) as ApiConversation[]);
      const list: Conversation[] = rawList.map(mapConversation);
      if (seq !== conversationLoadSeqRef.current || unmountedRef.current) return;
      setConversations((prev) => {
        const prevMap = new Map<string, Conversation>(prev.map((c): [string, Conversation] => [c.id, c]));
        return list.map((c) => ({
          ...c,
          clientName: (() => {
            const previous = prevMap.get(c.id);
            if (!previous?.clientName) return c.clientName;
            if (!isGeneratedClientName(c.clientName)) return c.clientName;
            if (!isGeneratedClientName(previous.clientName)) return previous.clientName;
            return c.clientName;
          })(),
          unreadCount: prevMap.get(c.id)?.unreadCount || 0,
        }));
      });
      hasLoadedConversationsRef.current = true;
      if (list.length && !selectedChatId) selectConversation(list[0].id);
      setLastSyncAt(new Date());
      setError(null);
    } catch (e) {
      const message = e instanceof Error ? e.message : tr('Failed to load conversations', 'Suhbatlarni yuklab bo‘lmadi', 'Suhbatlarni yuklab bo‘lmadi');
      setError(message);
      if (!silent) {
        toast.error(message);
      }
    } finally {
      if (seq !== conversationLoadSeqRef.current) return;
      if (shouldShowLoader) {
        setLoadingConversations(false);
      }
      convInFlightRef.current = false;
    }
  }, [mapConversation, selectedChatId, selectConversation, toast, tr]);

  const loadMessages = useCallback(async (conversationId: string) => {
    if (msgInFlightRef.current) return;
    msgInFlightRef.current = true;
    const seq = ++messageLoadSeqRef.current;
    try {
      setLoadingMessages(true);
      const data = await apiRequest<ApiMessage[] | { results?: ApiMessage[] }>(ENDPOINTS.CONVERSATIONS.MESSAGES(conversationId));
      const rawList: ApiMessage[] = Array.isArray(data)
        ? (data as ApiMessage[])
        : ((data.results || []) as ApiMessage[]);
      const list: ChatMessage[] = rawList.map(normalizeMessage);
      if (seq !== messageLoadSeqRef.current || activeConversationRef.current !== conversationId || unmountedRef.current) return;
      setMessages(list);
      if (list.length) {
        const latest = list[list.length - 1];
        setConversations((prev) => prev.map((c) => (
          c.id === conversationId
            ? { ...c, last_message_preview: latest.text, updated_at: latest.created_at }
            : c
        )));
      }
      shouldStickToBottomRef.current = true;
      window.setTimeout(() => scrollToBottom('auto'), 60);
      setLastSyncAt(new Date());
      setError(null);
    } catch (e) {
      const message = e instanceof Error ? e.message : tr('Failed to load messages', 'Xabarlarni yuklab bo‘lmadi', 'Xabarlarni yuklab bo‘lmadi');
      setError(message);
      toast.error(message);
      setMessages([]);
    } finally {
      if (seq !== messageLoadSeqRef.current) return;
      setLoadingMessages(false);
      msgInFlightRef.current = false;
    }
  }, [normalizeMessage, scrollToBottom, toast, tr]);

  const loadConversationBotState = useCallback(async (conversationId: string) => {
    if (!conversationId) {
      setBotRuntimeState(null);
      return;
    }
    try {
      setBotRuntimeLoading(true);
      const data = await apiRequest<BotRuntimeResponse>(ENDPOINTS.CONVERSATIONS.BOT_RESUME(conversationId), {
        method: 'GET',
      });
      setBotRuntimeState(data.state || null);
    } catch (e) {
      setBotRuntimeState(null);
      toast.warning(
        e instanceof Error
          ? e.message
          : tr('Failed to load bot state', 'Bot holatini yuklab bo‘lmadi', 'Bot holatini yuklab bo‘lmadi')
      );
    } finally {
      setBotRuntimeLoading(false);
    }
  }, [toast, tr]);

  const pauseBotForConversation = useCallback(async (conversationId: string) => {
    try {
      setBotRuntimeSaving(true);
      const input = window.prompt(
        tr(
          'Pause bot for how many minutes? Leave empty or 0 for manual resume only.',
          'Botni necha daqiqaga to‘xtatish? Bo‘sh qoldiring yoki 0 = faqat qo‘lda resume.',
          'Botni necha daqiqaga to‘xtatish? Bo‘sh qoldiring yoki 0 = faqat qo‘lda resume.'
        ),
        '10'
      );
      if (input === null) return;
      const parsed = Number(String(input).trim() || '0');
      const pause_for_minutes = Number.isFinite(parsed) && parsed >= 0 ? Math.min(parsed, 10080) : 0;
      const data = await apiRequest<BotRuntimeResponse & { paused?: boolean }>(ENDPOINTS.CONVERSATIONS.BOT_PAUSE(conversationId), {
        method: 'POST',
        body: JSON.stringify({
          pause_for_minutes,
          reason: 'manual_admin_pause',
        }),
      });
      setBotRuntimeState(data.state || null);
      toast.success(tr('Bot paused for this chat', 'Bu chat uchun bot to‘xtatildi', 'Bu chat uchun bot to‘xtatildi'));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : tr('Failed to pause bot', 'Botni to‘xtatib bo‘lmadi', 'Botni to‘xtatib bo‘lmadi'));
    } finally {
      setBotRuntimeSaving(false);
    }
  }, [toast, tr]);

  const resumeBotForConversation = useCallback(async (conversationId: string) => {
    try {
      setBotRuntimeSaving(true);
      const data = await apiRequest<BotRuntimeResponse & { resumed?: boolean }>(ENDPOINTS.CONVERSATIONS.BOT_RESUME(conversationId), {
        method: 'POST',
        body: JSON.stringify({}),
      });
      setBotRuntimeState(data.state || null);
      toast.success(tr('Bot resumed for this chat', 'Bu chat uchun bot yoqildi', 'Bu chat uchun bot yoqildi'));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : tr('Failed to resume bot', 'Botni yoqib bo‘lmadi', 'Botni yoqib bo‘lmadi'));
    } finally {
      setBotRuntimeSaving(false);
    }
  }, [toast, tr]);

  const toggleBotForConversation = useCallback(async () => {
    if (!selectedChatId) return;
    if (botRuntimeState?.is_paused) {
      await resumeBotForConversation(selectedChatId);
      return;
    }
    await pauseBotForConversation(selectedChatId);
  }, [botRuntimeState?.is_paused, pauseBotForConversation, resumeBotForConversation, selectedChatId]);

  const closeListSocket = useCallback(() => {
    clearTimer(listRetryRef);
    clearIntervalTimer(listPingRef);
    if (listWsRef.current) {
      listWsRef.current.close();
      listWsRef.current = null;
    }
    setListWsConnected(false);
  }, []);

  const closeDetailSocket = useCallback(() => {
    clearTimer(detailRetryRef);
    clearIntervalTimer(detailPingRef);
    if (detailWsRef.current) {
      detailWsRef.current.close();
      detailWsRef.current = null;
    }
    setDetailWsConnected(false);
  }, []);

  const openListSocket = useCallback(() => {
    const url = buildWsUrl('/ws/conversations/');
    if (!url) return;
    closeListSocket();

    const connect = () => {
      if (unmountedRef.current) return;
      const ws = new WebSocket(url);
      listWsRef.current = ws;

      ws.onopen = () => {
        if (listWsRef.current !== ws) return;
        listRetryIdxRef.current = 0;
        setListWsConnected(true);
        clearIntervalTimer(listPingRef);
        listPingRef.current = window.setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }));
          }
        }, 25000);
      };

      ws.onmessage = (event) => {
        if (listWsRef.current !== ws) return;
        try {
          handleWsEvent(JSON.parse(event.data));
        } catch {
          // Ignore malformed frame
        }
      };

      ws.onclose = () => {
        if (listWsRef.current !== ws) return;
        setListWsConnected(false);
        clearIntervalTimer(listPingRef);
        listWsRef.current = null;
        if (unmountedRef.current) return;
        const delay = WS_BACKOFF[Math.min(listRetryIdxRef.current, WS_BACKOFF.length - 1)];
        listRetryIdxRef.current += 1;
        clearTimer(listRetryRef);
        listRetryRef.current = window.setTimeout(connect, delay);
      };
    };

    connect();
  }, [buildWsUrl, closeListSocket, handleWsEvent]);

  const openDetailSocket = useCallback((conversationId: string) => {
    const url = buildWsUrl(`/ws/conversations/${conversationId}/`);
    if (!url) return;
    closeDetailSocket();

    const connect = () => {
      if (unmountedRef.current) return;
      const ws = new WebSocket(url);
      detailWsRef.current = ws;

      ws.onopen = () => {
        if (detailWsRef.current !== ws) return;
        detailRetryIdxRef.current = 0;
        setDetailWsConnected(true);
        clearIntervalTimer(detailPingRef);
        detailPingRef.current = window.setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }));
          }
        }, 25000);
      };

      ws.onmessage = (event) => {
        if (detailWsRef.current !== ws) return;
        try {
          handleWsEvent(JSON.parse(event.data));
        } catch {
          // Ignore malformed frame
        }
      };

      ws.onclose = () => {
        if (detailWsRef.current !== ws) return;
        setDetailWsConnected(false);
        clearIntervalTimer(detailPingRef);
        detailWsRef.current = null;
        if (unmountedRef.current) return;
        const delay = WS_BACKOFF[Math.min(detailRetryIdxRef.current, WS_BACKOFF.length - 1)];
        detailRetryIdxRef.current += 1;
        clearTimer(detailRetryRef);
        detailRetryRef.current = window.setTimeout(connect, delay);
      };
    };

    connect();
  }, [buildWsUrl, closeDetailSocket, handleWsEvent]);

  useEffect(() => {
    unmountedRef.current = false;
    loadConversations();
    openListSocket();
    return () => {
      unmountedRef.current = true;
      closeListSocket();
      closeDetailSocket();
    };
  }, [closeDetailSocket, closeListSocket, loadConversations, openListSocket]);

  useEffect(() => () => {
    if (scrollDateHideTimerRef.current !== null) {
      window.clearTimeout(scrollDateHideTimerRef.current);
      scrollDateHideTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (selectedChatId) {
      activeConversationRef.current = selectedChatId;
      shouldStickToBottomRef.current = true;
      loadMessages(selectedChatId);
      loadConversationBotState(selectedChatId);
      openDetailSocket(selectedChatId);
      markConversationRead(selectedChatId);
      return;
    }
    activeConversationRef.current = null;
    setBotRuntimeState(null);
    setMessages([]);
    closeDetailSocket();
  }, [closeDetailSocket, loadConversationBotState, loadMessages, markConversationRead, openDetailSocket, selectedChatId]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (unmountedRef.current) return;
      if (!listWsConnected) {
        loadConversations({ silent: true });
      }
      if (selectedChatId && !detailWsConnected) {
        loadMessages(selectedChatId);
        loadConversationBotState(selectedChatId);
      }
    }, 15000);
    return () => window.clearInterval(timer);
  }, [detailWsConnected, listWsConnected, loadConversationBotState, loadConversations, loadMessages, selectedChatId]);

  const handleSend = async () => {
    if (!selectedChatId || !input.trim()) return;
    const text = input.trim();
    setInput('');
    try {
      setSending(true);
      const response = await apiRequest<AdminSendResponse | ApiMessage>(ENDPOINTS.CONVERSATIONS.ADMIN_SEND(selectedChatId), {
        method: 'POST',
        body: JSON.stringify({ text }),
      });
      appendAdminMessageFromSendResponse(selectedChatId, response);
      const fullResponse = response as AdminSendResponse;      if (fullResponse.interruption?.interrupted && !fullResponse.interruption?.resumed) {
        loadConversationBotState(selectedChatId);
      }
      if ((fullResponse.available_delivery_channels || []).length === 0) {
        toast.warning(tr('No active delivery channel available for this conversation.', 'Bu suhbat uchun faol yetkazish kanali yo‘q.', 'Bu suhbat uchun faol yetkazish kanali yo‘q.'));
      }
      setLastSyncAt(new Date());
    } catch (e) {
      const message = e instanceof Error ? e.message : tr('Failed to send message', 'Xabar yuborib bo‘lmadi', 'Xabar yuborib bo‘lmadi');
      setError(message);
      toast.error(message);
      setInput(text);
    } finally {
      setSending(false);
    }
  };

  const handleClearConversation = async (conversationId: string) => {
    const ok = window.confirm(
      tr(
        'Clear this chat from active list? Messages will stay in database.',
        "Bu chat faol ro'yxatdan tozalansinmi? Xabarlar bazada saqlanadi.",
        "Bu chat faol ro'yxatdan tozalansinmi? Xabarlar bazada saqlanadi."
      )
    );
    if (!ok) return;

    try {
      setClearingConversationId(conversationId);
      await apiRequest(ENDPOINTS.CONVERSATIONS.CLEAR(conversationId), {
        method: 'POST',
        body: JSON.stringify({}),
      });

      setConversations((prev) => {
        const next = prev.filter((c) => c.id !== conversationId);
        if (selectedChatId === conversationId) {
          const nextSelected = next[0]?.id || null;
          setSelectedChatId(nextSelected);
          if (!nextSelected) {
            setMessages([]);
          }
        }
        return next;
      });

      toast.success(
        tr(
          'Conversation cleared from active list.',
          "Suhbat faol ro'yxatdan tozalandi.",
          "Suhbat faol ro'yxatdan tozalandi."
        )
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : tr('Failed to clear conversation', 'Suhbatni tozalab bolmadi', 'Suhbatni tozalab bolmadi'));
    } finally {
      setClearingConversationId(null);
    }
  };

  return (
    <div className="h-[calc(100dvh-6rem)] md:h-[calc(100vh-8rem)] flex flex-col lg:flex-row gap-4 lg:gap-5 min-h-[560px]">
      <div className={`${mobilePane === 'list' ? 'flex' : 'hidden'} lg:flex w-full lg:w-1/3 flex-col gap-4 min-h-0`}>
        <div className="flex justify-between items-center gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-light-text dark:text-white">{tr('Conversations', 'Suhbatlar', 'Suhbatlar')}</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {tr('Ordered as backend returns', 'Backend qaytargan tartibda', 'Backend qaytargan tartibda')} | {filteredConversations.length}/{conversations.length}
            </p>
          </div>
          <button
            onClick={() => {
              loadConversations({ silent: true });
              if (selectedChatId) {
                loadMessages(selectedChatId);
                loadConversationBotState(selectedChatId);
              }
            }}
            className="shrink-0 inline-flex items-center gap-1.5 text-xs bg-white dark:bg-navy-800 border border-light-border dark:border-navy-700 rounded-lg px-2.5 py-1.5 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-navy-700"
          >
            <RefreshCw size={12} />
            {tr('Refresh', 'Yangilash', 'Yangilash')}
          </button>
        </div>
        <div className="rounded-2xl border border-light-border dark:border-navy-700 bg-white dark:bg-navy-800 p-2 shadow-sm shadow-slate-200/40 dark:shadow-none">
          <label className="relative block">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={conversationQuery}
              onChange={(e) => setConversationQuery(e.target.value)}
              placeholder={tr('Search name / ID', 'Poisk imeni / ID', 'Ism / ID qidirish')}
              className="w-full h-9 pl-9 pr-3 rounded-xl border border-light-border dark:border-navy-700 bg-gray-50 dark:bg-navy-900/40 text-sm text-gray-700 dark:text-gray-200 placeholder:text-gray-400 focus:outline-none focus:border-primary-blue"
            />
          </label>
          <div className="mt-2 flex gap-1">
            {(['all', 'telegram', 'instagram'] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setChannelFilter(value)}
                className={`flex-1 rounded-lg px-2 py-1.5 text-xs border transition-colors ${
                  channelFilter === value
                    ? 'bg-primary-blue text-white border-primary-blue'
                    : 'bg-white dark:bg-navy-800 text-gray-600 dark:text-gray-300 border-light-border dark:border-navy-700 hover:bg-gray-50 dark:hover:bg-navy-700'
                }`}
              >
                {value === 'all' ? tr('All', 'Vse', 'Barchasi') : value === 'telegram' ? 'Telegram' : 'Instagram'}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-hidden flex flex-col bg-white dark:bg-navy-800 border border-light-border dark:border-navy-700 rounded-2xl shadow-sm shadow-slate-200/50 dark:shadow-none transition-colors duration-300">
          <div className="px-4 py-3 border-b border-light-border dark:border-navy-700 bg-gradient-to-r from-gray-50/90 to-white dark:from-navy-900/50 dark:to-navy-800 text-xs text-gray-500 dark:text-gray-400">
            {tr('Live conversation list', 'Jonli suhbatlar ro‘yxati', 'Jonli suhbatlar ro‘yxati')}
          </div>
          <div className="overflow-y-auto flex-1 p-1.5">
            {loadingConversations && <p className="px-3 py-6 text-sm text-gray-500">{tr('Loading conversations...', 'Suhbatlar yuklanmoqda...', 'Suhbatlar yuklanmoqda...')}</p>}
            {!loadingConversations && filteredConversations.length === 0 && (
              <p className="px-3 py-6 text-sm text-gray-500">{tr('No conversations found.', 'Suhbatlar topilmadi.', 'Suhbatlar topilmadi.')}</p>
            )}
            {filteredConversations.map((chat) => {
              const unread = chat.unreadCount || 0;
              const isSelected = selectedChatId === chat.id;
              const displayName = chat.clientName || buildFallbackClientName(chat.client_id || chat.id);
              return (
                <button
                  key={chat.id}
                  type="button"
                  onClick={() => selectConversation(chat.id)}
                  className={`group w-full text-left rounded-xl px-3 py-2.5 transition-colors ${
                    isSelected
                      ? 'bg-blue-500 text-white'
                      : 'hover:bg-gray-50 dark:hover:bg-navy-700/70 text-gray-900 dark:text-white'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="relative shrink-0">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm ${
                        isSelected
                          ? 'bg-white/20 text-white'
                          : 'bg-gray-100 dark:bg-navy-700 text-gray-700 dark:text-gray-200'
                      }`}>
                        {displayName.substring(0, 1).toUpperCase()}
                      </div>
                      <div className={`absolute -bottom-0.5 -right-0.5 rounded-full p-0.5 ${isSelected ? 'bg-blue-500' : 'bg-white dark:bg-navy-800'}`}>
                        {chat.channel === 'instagram'
                          ? <Instagram size={12} className={isSelected ? 'text-pink-200' : 'text-pink-500'} />
                          : <MessageCircle size={12} className={isSelected ? 'text-blue-100' : 'text-sky-500'} />}
                      </div>
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className={`min-w-0 text-sm font-semibold truncate ${isSelected ? 'text-white' : 'text-light-text dark:text-white'}`}>
                          {displayName}
                        </div>
                        <div className={`text-[11px] shrink-0 ${isSelected ? 'text-blue-100' : 'text-gray-400 dark:text-gray-500'}`}>
                          {formatChatListTime(chat.updated_at)}
                        </div>
                      </div>
                      <div className="mt-0.5 flex items-center justify-between gap-2">
                        <div className={`text-[11px] font-mono truncate ${isSelected ? 'text-blue-100' : 'text-gray-500 dark:text-gray-400'}`}>
                          {chat.id}
                        </div>
                        {unread > 0 ? (
                          <span className={`min-w-5 h-5 px-1.5 inline-flex items-center justify-center rounded-full text-[10px] font-semibold ${
                            isSelected ? 'bg-white text-blue-600' : 'bg-primary-blue text-white'
                          }`}>
                            {unread}
                          </span>
                        ) : (
                          <span className="w-5 h-5" />
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className={`${mobilePane === 'chat' ? 'flex' : 'hidden'} lg:flex w-full lg:w-2/3 flex-col h-full min-h-0`}>
        <div className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-navy-800 border border-light-border dark:border-navy-700 rounded-2xl shadow-sm shadow-slate-200/50 dark:shadow-none transition-colors duration-300">
          <div className="p-3 sm:p-4 border-b border-light-border dark:border-navy-700 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 bg-gradient-to-r from-white to-gray-50/80 dark:from-navy-800 dark:to-navy-900/30">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-wrap">
              <button
                type="button"
                onClick={() => setMobilePane('list')}
                className="inline-flex lg:hidden items-center justify-center p-1.5 rounded-lg border border-light-border dark:border-navy-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-navy-700"
                title={tr('Back to list', 'Назад к списку', "Ro'yxatga qaytish")}
              >
                <ChevronLeft size={16} />
              </button>
              {selectedConversation && (
                <div className="w-9 h-9 rounded-full bg-gray-100 dark:bg-navy-700 flex items-center justify-center text-sm font-semibold text-gray-700 dark:text-gray-200 shrink-0">
                  {(selectedConversation.clientName || 'U').slice(0, 1).toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <h3 className="font-bold text-light-text dark:text-white truncate">{selectedConversation?.clientName || tr('Select conversation', 'Suhbatni tanlang', 'Suhbatni tanlang')}</h3>
                {selectedConversation && (
                  <div className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                    {selectedConversation.channel} | {selectedConversation.id.slice(0, 12)}
                  </div>
                )}
              </div>
              {selectedConversation?.channel === 'instagram' && (
                <span
                  className={`text-xs px-2 py-0.5 rounded-full border ${
                    selectedConversation.channel_account_id
                      ? 'bg-pink-50 border-pink-200 text-pink-700'
                      : 'bg-amber-50 border-amber-200 text-amber-700'
                  } dark:bg-navy-700 dark:border-navy-600 dark:text-gray-300`}
                >
                  {selectedConversation.channel_account_id
                    ? `${tr('Page', 'Sahifa', 'Sahifa')}: ${selectedConversation.channel_account_id}`
                    : tr('Instagram page missing', 'Instagram sahifa ID yoq', "Instagram sahifa ID yo'q")}
                </span>
              )}
              {selectedConversation && botRuntimeState?.is_paused && (
                <span className="text-xs px-2 py-0.5 rounded-full border bg-red-50 border-red-200 text-red-700">
                  {tr('Paused by operator', 'Operator tomonidan to‘xtatilgan', 'Operator tomonidan to‘xtatilgan')}
                </span>
              )}
              {selectedConversation && botRuntimeState?.trigger_effect?.action === 'deactivate' && (
                <span className="text-xs px-2 py-0.5 rounded-full border bg-amber-50 border-amber-200 text-amber-700">
                  {tr('Trigger-deactivated', 'Trigger bilan o‘chirilgan', 'Trigger bilan o‘chirilgan')}
                </span>
              )}
              {selectedConversation && botRuntimeState?.pause_until && (
                <span className="text-xs px-2 py-0.5 rounded-full border bg-gray-100 border-gray-200 text-gray-700 dark:bg-navy-700 dark:border-navy-600 dark:text-gray-300">
                  {tr('Until', 'Gacha', 'Gacha')}: {new Date(botRuntimeState.pause_until).toLocaleTimeString()}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-500 flex-wrap">
              {selectedConversation && (
                <button
                  onClick={() => handleClearConversation(selectedConversation.id)}
                  disabled={clearingConversationId === selectedConversation.id}
                  className="inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 border border-light-border dark:border-navy-600 text-gray-600 dark:text-gray-300 hover:text-red-600 hover:border-red-300 disabled:opacity-50"
                  title={tr('Clear chat', "Chatni tozalash", "Chatni tozalash")}
                >
                  <ArchiveX size={12} />
                  <span className="hidden sm:inline">
                    {clearingConversationId === selectedConversation.id
                      ? tr('Clearing...', 'Tozalanmoqda...', 'Tozalanmoqda...')
                      : tr('Clear Chat', 'Chatni tozalash', 'Chatni tozalash')}
                  </span>
                </button>
              )}
              {selectedConversation && (
                <button
                  onClick={toggleBotForConversation}
                  disabled={botRuntimeSaving || botRuntimeLoading}
                  className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 border transition-colors disabled:opacity-60 ${
                    botRuntimeState?.is_paused
                      ? 'bg-green-50 border-green-200 text-green-700'
                      : 'bg-red-50 border-red-200 text-red-700'
                  }`}
                  title={botRuntimeState?.is_paused ? tr('Resume bot', 'Botni yoqish', 'Botni yoqish') : tr('Pause bot', 'Botni to‘xtatish', 'Botni to‘xtatish')}
                >
                  <span className={`inline-block h-2.5 w-2.5 rounded-full ${botRuntimeState?.is_paused ? 'bg-green-500' : 'bg-red-500'}`} />
                  {botRuntimeSaving
                    ? tr('Updating...', 'Yangilanmoqda...', 'Yangilanmoqda...')
                    : botRuntimeLoading
                      ? tr('Loading...', 'Yuklanmoqda...', 'Yuklanmoqda...')
                      : botRuntimeState?.is_paused
                        ? tr('Resume Bot', 'Botni yoqish', 'Botni yoqish')
                        : tr('Pause Bot', 'Botni to‘xtatish', 'Botni to‘xtatish')}
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  if (!selectedChatId) return;
                  loadConversations({ silent: true });
                  loadMessages(selectedChatId);
                  loadConversationBotState(selectedChatId);
                }}
                className="inline-flex items-center justify-center h-8 w-8 rounded-full border border-light-border dark:border-navy-600 text-gray-500 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-navy-700"
                title={lastSyncAt ? `${tr('Synced', 'Sinxronlangan', 'Sinxronlangan')} ${lastSyncAt.toLocaleTimeString()}` : tr('Refresh', 'Yangilash', 'Yangilash')}
              >
                <RefreshCw size={13} />
              </button>
            </div>
          </div>

          <div className="relative flex-1 min-h-0">
            <div
              ref={messageAreaRef}
              onScroll={handleMessageAreaScroll}
              className="h-full overflow-y-auto p-3 sm:p-4 space-y-3 bg-gradient-to-b from-gray-50 to-white dark:from-navy-900/60 dark:to-navy-900/20"
            >
            {loadingMessages && <p className="text-sm text-gray-500 px-1">{tr('Loading messages...', 'Xabarlar yuklanmoqda...', 'Xabarlar yuklanmoqda...')}</p>}
            {!loadingMessages && !selectedConversation && <p className="text-sm text-gray-500 px-1">{tr('Pick a conversation to start.', 'Boshlash uchun suhbatni tanlang.', 'Boshlash uchun suhbatni tanlang.')}</p>}
            {!loadingMessages && selectedConversation && messages.length === 0 && <p className="text-sm text-gray-500 px-1">{tr('No messages yet.', 'Hozircha xabarlar yo‘q.', 'Hozircha xabarlar yo‘q.')}</p>}
            {messages.map((m, index) => {
              const isClient = m.role === 'client';
              const isAdminMessage = m.role === 'admin';
              const isBotMessage = m.role === 'bot';
              const isSystemMessage = m.role === 'system';
              const prevMessage = index > 0 ? messages[index - 1] : null;
              const showDateDivider = !prevMessage || !isSameCalendarDay(prevMessage.created_at, m.created_at);
              const attachments = normalizeAttachmentList(m);
              const hasAttachments = attachments.length > 0;
              const visibleText = getDisplayMessageText(m, attachments);
              const roleLabel = isClient
                ? tr('Client', 'Klient', 'Mijoz')
                : isAdminMessage
                  ? tr('Admin', 'Admin', 'Admin')
                  : isBotMessage
                    ? tr('AI Assistant', 'AI yordamchi', 'AI yordamchi')
                    : tr('System', 'Sistema', 'Tizim');

              const bubbleClass = isClient
                ? 'bg-white dark:bg-navy-800 text-gray-800 dark:text-gray-100 rounded-tl-md border border-light-border dark:border-navy-700 shadow-sm'
                : isAdminMessage
                  ? 'bg-primary-blue text-white rounded-tr-md shadow-sm shadow-blue-500/20'
                  : isBotMessage
                    ? 'bg-cyan-600 text-white rounded-tr-md shadow-sm shadow-cyan-500/20'
                    : 'bg-slate-700 text-white rounded-tr-md shadow-sm';

              const metaTextClass = isClient
                ? 'text-gray-400 dark:text-gray-500'
                : isAdminMessage
                  ? 'text-blue-100'
                  : isBotMessage
                    ? 'text-cyan-100'
                    : 'text-slate-200';

              const headerTextClass = isClient
                ? 'text-gray-500 dark:text-gray-400'
                : isAdminMessage
                  ? 'text-blue-100/90'
                  : isBotMessage
                    ? 'text-cyan-100/90'
                    : 'text-slate-200/90';

              return (
                <React.Fragment key={m.id}>
                  {showDateDivider && (
                    <div className="flex justify-center py-2">
                      <span className="px-2.5 py-1 rounded-full border border-light-border dark:border-navy-700 bg-white/95 dark:bg-navy-800/95 text-[11px] text-gray-500 dark:text-gray-300 shadow-sm">
                        {tr(formatMessageDateLabel(m.created_at), formatMessageDateLabel(m.created_at), formatMessageDateLabel(m.created_at))}
                      </span>
                    </div>
                  )}
                <div
                  data-chat-message-row="1"
                  data-message-date={m.created_at}
                  className={`flex ${isClient ? 'justify-start' : 'justify-end'} max-w-full`}
                >
                  <div className={`flex items-end gap-2 max-w-full ${isClient ? '' : 'flex-row-reverse'}`}>
                    <div className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-semibold border ${
                      isClient
                        ? 'bg-white border-light-border text-gray-600 dark:bg-navy-800 dark:border-navy-700 dark:text-gray-300'
                        : isAdminMessage
                          ? 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-500/10 dark:border-blue-500/30 dark:text-blue-300'
                          : isBotMessage
                            ? 'bg-cyan-50 border-cyan-200 text-cyan-700 dark:bg-cyan-500/10 dark:border-cyan-500/30 dark:text-cyan-300'
                            : 'bg-slate-100 border-slate-200 text-slate-700 dark:bg-slate-700/20 dark:border-slate-500/30 dark:text-slate-300'
                    }`}>
                      {isBotMessage ? <Bot size={12} /> : roleLabel.slice(0, 1)}
                    </div>

                    <div className={`${bubbleClass} p-3 rounded-2xl max-w-[88vw] sm:max-w-[68%]`}>
                      {(isBotMessage || isSystemMessage) && (
                        <div className={`flex items-center gap-1.5 mb-1 text-[11px] ${headerTextClass}`}>
                          {isBotMessage && <Bot size={11} />}
                          <span className="font-medium">{roleLabel}</span>
                        </div>
                      )}

                    {hasAttachments && (
                      <div className="space-y-2 mb-2">
                        {attachments.map((att, idx) => {
                          const type = att.type;
                          const url = att.url;
                          const isImage = type === 'image';
                          const isAudio = type === 'audio';
                          const isVideo = type === 'video';

                          if (isImage) {
                            return (
                              <button
                                type="button"
                                key={`${m.id}-att-${idx}`}
                                onClick={() => setImageViewerUrl(url)}
                                className="block text-left"
                              >
                                <img
                                  src={url}
                                  alt={tr('Attachment image', 'Prikreplenie izobrazhenie', 'Biriktirilgan rasm')}
                                  className="max-h-64 w-auto max-w-full rounded-lg border border-black/5 dark:border-white/10 object-cover bg-white/40"
                                  loading="lazy"
                                />
                              </button>
                            );
                          }

                          if (isAudio) {
                            return (
                              <audio
                                key={`${m.id}-att-${idx}`}
                                controls
                                src={url}
                                className="w-full max-w-sm"
                              />
                            );
                          }

                          if (isVideo) {
                            return (
                              <video
                                key={`${m.id}-att-${idx}`}
                                controls
                                src={url}
                                className="max-h-72 w-auto max-w-full rounded-lg border border-black/5 dark:border-white/10 bg-black"
                              />
                            );
                          }

                          return (
                            <a
                              key={`${m.id}-att-${idx}`}
                              href={url}
                              target="_blank"
                              rel="noreferrer"
                              className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs border ${
                                isClient
                                  ? 'border-light-border dark:border-navy-600 bg-gray-50 dark:bg-navy-900 text-gray-700 dark:text-gray-200'
                                  : 'border-white/20 bg-white/10 text-white'
                              }`}
                            >
                              <Paperclip size={13} />
                              <span className="truncate max-w-[220px]">{tr('Open attachment', 'Otkryt vloshenie', 'Birikmani ochish')}</span>
                            </a>
                          );
                        })}
                      </div>
                    )}
                    {visibleText && (
                      <p className={`text-sm whitespace-pre-wrap leading-relaxed break-words [overflow-wrap:anywhere] ${
                        hasAttachments
                          ? (isClient ? 'text-gray-500 dark:text-gray-400 text-xs' : `${headerTextClass} text-xs`)
                          : ''
                      }`}>
                        {visibleText}
                      </p>
                    )}
                    <div className="flex items-center justify-between gap-2 mt-1.5">
                      <span className={`text-[10px] block ${metaTextClass}`}>{formatClockTime(m.created_at)}</span>
                      {!isClient && m.role === 'admin' && (
                        <span className={`inline-flex items-center gap-1 text-[10px] block ${m.delivery?.sent ? 'text-green-200' : m.delivery?.reason === 'sending' ? 'text-blue-100' : 'text-red-200'}`}>
                          {m.delivery?.sent ? <CheckCheck size={11} /> : m.delivery?.reason === 'sending' ? <Check size={11} /> : <AlertCircle size={11} />}
                          {m.delivery?.sent ? tr('Sent', 'Yuborildi', 'Yuborildi') : m.delivery?.reason === 'sending' ? tr('Sending...', 'Yuborilmoqda...', 'Yuborilmoqda...') : tr('Failed', 'Xato', 'Xato')}
                        </span>
                      )}
                    </div>
                    </div>
                  </div>
                </div>
                </React.Fragment>
              );
            })}
            </div>
            {showScrollDateChip && scrollDateChip && (
              <div className="pointer-events-none absolute top-3 left-1/2 -translate-x-1/2 z-10">
                <div className="rounded-full px-3 py-1 text-[11px] font-medium border border-black/5 dark:border-white/10 bg-white/95 dark:bg-navy-800/95 text-gray-600 dark:text-gray-200 shadow-lg backdrop-blur-sm">
                  {tr(scrollDateChip, scrollDateChip, scrollDateChip)}
                </div>
              </div>
            )}
            {showScrollToBottom && selectedConversation && (
              <div className="absolute bottom-3 right-3 sm:bottom-4 sm:right-4 z-10">
                <button
                  type="button"
                  onClick={() => {
                    shouldStickToBottomRef.current = true;
                    setShowScrollToBottom(false);
                    scrollToBottom('smooth');
                  }}
                  className="inline-flex items-center gap-2 rounded-full h-11 px-3 bg-white/95 dark:bg-navy-800/95 border border-light-border dark:border-navy-600 text-gray-700 dark:text-gray-100 shadow-lg backdrop-blur-sm hover:bg-white dark:hover:bg-navy-700 transition-colors"
                  title={tr('Go to bottom', 'Vniz', 'Pastga tushish')}
                >
                  <ChevronDown size={16} />
                  <span className="text-xs font-medium hidden sm:inline">{tr('Bottom', 'Vniz', 'Pastga')}</span>
                </button>
              </div>
            )}
          </div>

          <div className="p-3 sm:p-4 bg-white dark:bg-navy-800 border-t border-light-border dark:border-navy-700">
            {error && <p className="text-xs text-red-600 mb-2">{error}</p>}
            <div className="rounded-2xl border border-light-border dark:border-navy-700 bg-gray-50 dark:bg-navy-900/40 p-2 shadow-sm">
              <div className="flex gap-2 items-end">
              <button className="hidden p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200" title={tr('Attachments not implemented', 'Fayl yuborish hali yo‘q', 'Fayl yuborish hali yo‘q')}> 
                <Paperclip size={20} />
              </button>
              <div className="flex-1 bg-white dark:bg-navy-800 rounded-xl p-2 border border-light-border dark:border-navy-700 focus-within:border-blue-300 dark:focus-within:border-blue-500/40">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                   className="w-full bg-transparent border-none focus:outline-none text-sm text-gray-800 dark:text-gray-200 resize-none h-10"
                   rows={1}
                   placeholder={tr('Type a message... (Enter to send)', 'Xabar yozing... (Yuborish uchun Enter)', 'Xabar yozing... (Yuborish uchun Enter)')}
                   disabled={!selectedChatId || sending}
                 />
              </div>
              <button
                onClick={handleSend}
                disabled={!selectedChatId || !input.trim() || sending}
                className="inline-flex items-center justify-center h-10 w-10 bg-primary-blue hover:bg-blue-700 text-white rounded-full shadow-lg shadow-blue-500/20 transition-all disabled:opacity-50 disabled:shadow-none"
              >
                <Send size={18} />

              </button>
            </div>



            </div>
          </div>
        </div>
      </div>
      {imageViewerUrl && (
        <div
          className="fixed inset-0 z-[70] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setImageViewerUrl(null)}
        >
          <button
            type="button"
            className="absolute top-4 right-4 inline-flex items-center justify-center h-10 w-10 rounded-full bg-white/10 text-white hover:bg-white/20"
            onClick={() => setImageViewerUrl(null)}
            aria-label="Close image preview"
          >
            <X size={20} />
          </button>
          <img
            src={imageViewerUrl}
            alt="Preview"
            className="max-h-[88vh] max-w-[92vw] rounded-xl object-contain border border-white/10 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
};

export default Conversations;









