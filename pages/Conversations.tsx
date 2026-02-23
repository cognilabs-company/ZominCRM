import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useToast } from '../context/ToastContext';
import { Send, Paperclip, Bot, Instagram, MessageCircle, RefreshCw, ArchiveX, ChevronLeft } from 'lucide-react';
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

interface ConversationAutomationSettingsResponse {
  settings?: {
    do_not_respond_when_interrupted: boolean;
    resume_by_timer: boolean;
    resume_after_minutes: number;
    state: {
      is_interrupted: boolean;
      interrupt_until?: string | null;
    };
  };
}

const ADMIN_TAKEOVER_MESSAGE = "Operator suhbatga ulandi. Bot vaqtincha to'xtatildi.";
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
  const [chatAutomation, setChatAutomation] = useState<ConversationAutomationSettingsResponse['settings'] | null>(null);
  const [chatAutomationLoading, setChatAutomationLoading] = useState(false);
  const [chatAutomationSaving, setChatAutomationSaving] = useState(false);
  const [clearingConversationId, setClearingConversationId] = useState<string | null>(null);

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

  const requestedClientId = useMemo(
    () => new URLSearchParams(location.search).get('client_id'),
    [location.search]
  );

  const selectedConversation = useMemo(
    () => conversations.find((c) => c.id === selectedChatId) || null,
    [conversations, selectedChatId]
  );

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
    shouldStickToBottomRef.current = distanceToBottom < 72;
  }, []);

  useEffect(() => {
    if (!shouldStickToBottomRef.current) return;
    scrollToBottom('auto');
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
    setMessages((prev) => prev.some((m) => m.id === optimistic.id) ? prev : [...prev, optimistic]);
    upsertConversationPreview(conversationId, sentMessage);
    if (shouldStickToBottomRef.current) {
      window.setTimeout(() => scrollToBottom('smooth'), 60);
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
        setMessages((prev) => {
          if (prev.some((m) => m.id === nextMessage.id)) return prev;
          return [...prev, nextMessage];
        });
        if (shouldStickToBottomRef.current) {
          window.setTimeout(() => scrollToBottom('smooth'), 60);
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

  const loadConversationAutomation = useCallback(async (conversationId: string) => {
    if (!isAdmin || !conversationId) {
      setChatAutomation(null);
      return;
    }
    try {
      setChatAutomationLoading(true);
      const data = await apiRequest<ConversationAutomationSettingsResponse>(
        ENDPOINTS.CONVERSATIONS.AUTOMATION_SETTINGS(conversationId)
      );
      setChatAutomation(data.settings || null);
    } catch (e) {
      toast.warning(e instanceof Error ? e.message : tr('Failed to load chat automation state', 'Suhbat avtomatika holatini yuklab bo‘lmadi', 'Suhbat avtomatika holatini yuklab bo‘lmadi'));
      setChatAutomation(null);
    } finally {
      setChatAutomationLoading(false);
    }
  }, [isAdmin, toast, tr]);

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

  useEffect(() => {
    if (selectedChatId) {
      activeConversationRef.current = selectedChatId;
      shouldStickToBottomRef.current = true;
      loadMessages(selectedChatId);
      loadConversationAutomation(selectedChatId);
      openDetailSocket(selectedChatId);
      markConversationRead(selectedChatId);
      return;
    }
    activeConversationRef.current = null;
    setChatAutomation(null);
    setMessages([]);
    closeDetailSocket();
  }, [closeDetailSocket, loadConversationAutomation, loadMessages, markConversationRead, openDetailSocket, selectedChatId]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (unmountedRef.current) return;
      if (!listWsConnected) {
        loadConversations({ silent: true });
      }
      if (selectedChatId && !detailWsConnected) {
        loadMessages(selectedChatId);
        if (isAdmin) {
          loadConversationAutomation(selectedChatId);
        }
      }
    }, 15000);
    return () => window.clearInterval(timer);
  }, [detailWsConnected, isAdmin, listWsConnected, loadConversationAutomation, loadConversations, loadMessages, selectedChatId]);

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
      const fullResponse = response as AdminSendResponse;
      if (fullResponse.interruption?.interrupted && !fullResponse.interruption?.resumed) {
        toast.info(tr('Automation interrupted by employee message.', 'Xodim xabari sababli avtomatika to‘xtadi.', 'Xodim xabari sababli avtomatika to‘xtadi.'));
        await loadConversationAutomation(selectedChatId);
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

  const isBotStoppedForSelectedChat = Boolean(
    chatAutomation?.do_not_respond_when_interrupted && chatAutomation?.state?.is_interrupted
  );

  const toggleBotForSelectedChat = async () => {
    if (!selectedChatId || !isAdmin || chatAutomationSaving) return;
    try {
      setChatAutomationSaving(true);

      if (isBotStoppedForSelectedChat) {
        const resumeData = await apiRequest<ConversationAutomationSettingsResponse>(
          ENDPOINTS.CONVERSATIONS.AUTOMATION_RESUME(selectedChatId),
          { method: 'POST', body: JSON.stringify({}) }
        );
        setChatAutomation(resumeData.settings || null);
        toast.success(tr('Bot resumed for this chat.', 'Bu chatda bot qayta yoqildi.', 'Bu chatda bot qayta yoqildi.'));
        return;
      }

      await apiRequest<ConversationAutomationSettingsResponse>(
        ENDPOINTS.CONVERSATIONS.AUTOMATION_SETTINGS(selectedChatId),
        {
          method: 'PUT',
          body: JSON.stringify({
            do_not_respond_when_interrupted: true,
            resume_by_timer: false,
          }),
        }
      );

      const sendResponse = await apiRequest<AdminSendResponse | ApiMessage>(
        ENDPOINTS.CONVERSATIONS.ADMIN_SEND(selectedChatId),
        {
          method: 'POST',
          body: JSON.stringify({ text: ADMIN_TAKEOVER_MESSAGE }),
        }
      );
      appendAdminMessageFromSendResponse(selectedChatId, sendResponse);
      await loadConversationAutomation(selectedChatId);
      toast.success(tr('Bot stopped for this chat.', 'Bu chatda bot to‘xtatildi.', 'Bu chatda bot to‘xtatildi.'));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : tr('Failed to update bot state for this chat', 'Bu chat uchun bot holatini yangilab bo‘lmadi', 'Bu chat uchun bot holatini yangilab bo‘lmadi'));
    } finally {
      setChatAutomationSaving(false);
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
            setChatAutomation(null);
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
    <div className="h-[calc(100dvh-6rem)] md:h-[calc(100vh-8rem)] flex flex-col lg:flex-row gap-4 lg:gap-6 min-h-[560px]">
      <div className={`${mobilePane === 'list' ? 'flex' : 'hidden'} lg:flex w-full lg:w-1/3 flex-col gap-4 min-h-0`}>
        <div className="flex justify-between items-center mb-2">
          <h1 className="text-2xl font-bold text-light-text dark:text-white">{tr('Conversations', 'Suhbatlar', 'Suhbatlar')}</h1>
          <div className="flex items-center gap-2">
            <div className={`text-xs px-2 py-1 rounded-full border ${listWsConnected ? 'text-green-700 bg-green-50 border-green-200' : 'text-red-700 bg-red-50 border-red-200'} dark:bg-navy-800 dark:border-navy-700 dark:text-gray-300`}>
              {listWsConnected ? tr('List WS Online', 'Ro‘yxat WS onlayn', 'Ro‘yxat WS onlayn') : tr('List WS Offline', 'Ro‘yxat WS oflayn', 'Ro‘yxat WS oflayn')}
            </div>
            <button
              onClick={() => {
                loadConversations({ silent: true });
                if (selectedChatId) {
                  loadMessages(selectedChatId);
                  loadConversationAutomation(selectedChatId);
                }
              }}
              className="text-xs bg-white dark:bg-navy-800 border border-light-border dark:border-navy-700 rounded-md px-2 py-1 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-navy-700"
            >
              {tr('Refresh', 'Yangilash', 'Yangilash')}
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-hidden flex flex-col bg-white dark:bg-navy-800 border border-light-border dark:border-navy-700 rounded-xl shadow-sm transition-colors duration-300">
          <div className="overflow-y-auto flex-1">
            {loadingConversations && <p className="px-4 py-6 text-sm text-gray-500">{tr('Loading conversations...', 'Suhbatlar yuklanmoqda...', 'Suhbatlar yuklanmoqda...')}</p>}
            {!loadingConversations && conversations.length === 0 && (
              <p className="px-4 py-6 text-sm text-gray-500">{tr('No conversations found.', 'Suhbatlar topilmadi.', 'Suhbatlar topilmadi.')}</p>
            )}
            {conversations.map(chat => (
              <div
                key={chat.id}
                onClick={() => selectConversation(chat.id)}
                className={`p-4 border-b border-light-border dark:border-navy-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-navy-700 transition-colors ${selectedChatId === chat.id ? 'bg-blue-50 dark:bg-navy-700' : ''}`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex gap-3">
                    <div className="relative">
                      <div className="w-10 h-10 bg-gray-200 dark:bg-navy-600 rounded-full flex items-center justify-center text-gray-600 dark:text-gray-300 font-bold">
                        {(chat.clientName || 'U').substring(0,1)}
                      </div>
                      <div className="absolute -bottom-1 -right-1 bg-white dark:bg-navy-800 rounded-full p-0.5">
                        {chat.channel === 'instagram' ? <Instagram size={14} className="text-pink-500" /> : <MessageCircle size={14} className="text-blue-400" />}
                      </div>
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-light-text dark:text-white truncate w-40">{chat.clientName || buildFallbackClientName(chat.client_id || chat.id)}</h4>
                      <p className="text-xs text-gray-500 truncate w-44 font-mono">ID: {chat.id}</p>
                      {chat.channel === 'instagram' && (
                        <p className="text-[11px] text-gray-500 truncate w-44 font-mono">
                          {tr('Page', 'Sahifa', 'Sahifa')}: {chat.channel_account_id || '-'}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-xs text-gray-400">{new Date(chat.updated_at).toLocaleTimeString()}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleClearConversation(chat.id);
                      }}
                      disabled={clearingConversationId === chat.id}
                      className="text-[10px] px-2 py-0.5 rounded-full border border-light-border dark:border-navy-600 text-gray-500 hover:text-red-600 hover:border-red-300 disabled:opacity-50"
                      title={tr('Clear chat', "Chatni tozalash", "Chatni tozalash")}
                    >
                      {clearingConversationId === chat.id
                        ? tr('Clearing...', 'Tozalanmoqda...', 'Tozalanmoqda...')
                        : tr('Clear', 'Tozalash', 'Tozalash')}
                    </button>
                    {(chat.unreadCount || 0) > 0 && (
                      <span className="text-[10px] min-w-5 px-1.5 py-0.5 rounded-full bg-primary-blue text-white text-center font-semibold">
                        {chat.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className={`${mobilePane === 'chat' ? 'flex' : 'hidden'} lg:flex w-full lg:w-2/3 flex-col h-full min-h-0`}>
        <div className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-navy-800 border border-light-border dark:border-navy-700 rounded-xl shadow-sm transition-colors duration-300">
          <div className="p-3 sm:p-4 border-b border-light-border dark:border-navy-700 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 bg-white dark:bg-navy-800">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-wrap">
              <button
                type="button"
                onClick={() => setMobilePane('list')}
                className="inline-flex lg:hidden items-center justify-center p-1.5 rounded-lg border border-light-border dark:border-navy-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-navy-700"
                title={tr('Back to list', 'Назад к списку', "Ro'yxatga qaytish")}
              >
                <ChevronLeft size={16} />
              </button>
              <h3 className="font-bold text-light-text dark:text-white">{selectedConversation?.clientName || tr('Select conversation', 'Suhbatni tanlang', 'Suhbatni tanlang')}</h3>
              {selectedConversation && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-navy-700 text-gray-600 dark:text-gray-300">
                  {selectedConversation.channel}
                </span>
              )}
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
            </div>
            <div className="flex items-center gap-2 sm:gap-3 text-xs text-gray-500 flex-wrap">
              {selectedConversation && (
                <button
                  onClick={() => handleClearConversation(selectedConversation.id)}
                  disabled={clearingConversationId === selectedConversation.id}
                  className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 border border-light-border dark:border-navy-600 text-gray-600 dark:text-gray-300 hover:text-red-600 hover:border-red-300 disabled:opacity-50"
                  title={tr('Clear chat', "Chatni tozalash", "Chatni tozalash")}
                >
                  <ArchiveX size={12} />
                  {clearingConversationId === selectedConversation.id
                    ? tr('Clearing...', 'Tozalanmoqda...', 'Tozalanmoqda...')
                    : tr('Clear Chat', 'Chatni tozalash', 'Chatni tozalash')}
                </button>
              )}
              {isAdmin && selectedConversation && (
                <button
                  onClick={toggleBotForSelectedChat}
                  disabled={chatAutomationLoading || chatAutomationSaving}
                  className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 border transition-colors disabled:opacity-60 ${
                    isBotStoppedForSelectedChat
                      ? 'bg-red-50 border-red-200 text-red-700'
                      : 'bg-green-50 border-green-200 text-green-700'
                  }`}
                  title={isBotStoppedForSelectedChat ? tr('Resume bot for this chat', 'Bu chat uchun botni qayta yoqish', 'Bu chat uchun botni qayta yoqish') : tr('Stop bot for this chat', 'Bu chat uchun botni to‘xtatish', 'Bu chat uchun botni to‘xtatish')}
                >
                  <span className={`inline-block h-2.5 w-2.5 rounded-full ${isBotStoppedForSelectedChat ? 'bg-red-500' : 'bg-green-500'}`} />
                  {chatAutomationSaving
                    ? tr('Updating...', 'Yangilanmoqda...', 'Yangilanmoqda...')
                    : chatAutomationLoading
                      ? tr('Loading...', 'Yuklanmoqda...', 'Yuklanmoqda...')
                      : isBotStoppedForSelectedChat
                        ? tr('Bot Stopped', 'Bot to‘xtagan', 'Bot to‘xtagan')
                        : tr('Bot Active', 'Bot faol', 'Bot faol')}
                </button>
              )}
              <RefreshCw size={13} />
              {lastSyncAt ? `${tr('Synced', 'Sinxronlangan', 'Sinxronlangan')} ${lastSyncAt.toLocaleTimeString()}` : tr('Not synced', 'Sinxronlanmagan', 'Sinxronlanmagan')}
            </div>
          </div>

          <div
            ref={messageAreaRef}
            onScroll={handleMessageAreaScroll}
            className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-4 bg-gray-50 dark:bg-navy-900/50"
          >
            {loadingMessages && <p className="text-sm text-gray-500">{tr('Loading messages...', 'Xabarlar yuklanmoqda...', 'Xabarlar yuklanmoqda...')}</p>}
            {!loadingMessages && !selectedConversation && <p className="text-sm text-gray-500">{tr('Pick a conversation to start.', 'Boshlash uchun suhbatni tanlang.', 'Boshlash uchun suhbatni tanlang.')}</p>}
            {!loadingMessages && selectedConversation && messages.length === 0 && <p className="text-sm text-gray-500">{tr('No messages yet.', 'Hozircha xabarlar yo‘q.', 'Hozircha xabarlar yo‘q.')}</p>}
            {messages.map((m) => {
              const isClient = m.role === 'client';
              const attachments = normalizeAttachmentList(m);
              const hasAttachments = attachments.length > 0;
              return (
                <div key={m.id} className={`flex ${isClient ? 'justify-start' : 'justify-end'}`}>
                  <div className={`${isClient ? 'bg-white dark:bg-navy-800 text-gray-800 dark:text-gray-200 rounded-tl-none border border-light-border dark:border-navy-700' : 'bg-primary-blue text-white rounded-tr-none'} p-3 rounded-2xl shadow-sm max-w-[88%] sm:max-w-[75%]`}>
                    {!isClient && (
                      <div className="flex items-center gap-2 mb-1 text-blue-100 text-xs">
                        <Bot size={12} /> {m.role === 'bot' ? tr('AI Assistant', 'AI yordamchi', 'AI yordamchi') : tr('Admin', 'Admin', 'Admin')}
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
                              <a key={`${m.id}-att-${idx}`} href={url} target="_blank" rel="noreferrer" className="block">
                                <img
                                  src={url}
                                  alt={tr('Attachment image', 'Prikreplenie izobrazhenie', 'Biriktirilgan rasm')}
                                  className="max-h-64 w-auto max-w-full rounded-lg border border-black/5 dark:border-white/10 object-cover bg-white/40"
                                  loading="lazy"
                                />
                              </a>
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
                    {m.text && (
                      <p className={`text-sm whitespace-pre-wrap leading-relaxed break-words [overflow-wrap:anywhere] ${hasAttachments ? (isClient ? 'text-gray-500 dark:text-gray-400 text-xs' : 'text-blue-100 text-xs') : ''}`}>
                        {m.text}
                      </p>
                    )}
                    <div className="flex items-center justify-between gap-2 mt-1.5">
                      <span className={`text-[10px] block ${isClient ? 'text-gray-400' : 'text-blue-200'}`}>{new Date(m.created_at).toLocaleTimeString()}</span>
                      {!isClient && m.role === 'admin' && (
                        <span className={`text-[10px] block ${m.delivery?.sent ? 'text-green-200' : m.delivery?.reason === 'sending' ? 'text-blue-200' : 'text-red-200'}`}>
                          {m.delivery?.sent ? tr('Sent', 'Yuborildi', 'Yuborildi') : m.delivery?.reason === 'sending' ? tr('Sending...', 'Yuborilmoqda...', 'Yuborilmoqda...') : tr('Failed', 'Xato', 'Xato')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="p-3 sm:p-4 bg-white dark:bg-navy-800 border-t border-light-border dark:border-navy-700">
            {error && <p className="text-xs text-red-600 mb-2">{error}</p>}
            <div className="flex gap-2 items-end">
              <button className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200" title={tr('Attachments not implemented', 'Fayl yuborish hali yo‘q', 'Fayl yuborish hali yo‘q')}>
                <Paperclip size={20} />
              </button>
              <div className="flex-1 bg-gray-100 dark:bg-navy-900 rounded-xl p-2">
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
                  placeholder={tr('Type a message... (Enter to send)', 'Xabar yozing... (Yuborish uchun Enter)', 'Xabar yozing... (Yuborish uchun Enter)')}
                  disabled={!selectedChatId || sending}
                />
              </div>
              <button
                onClick={handleSend}
                disabled={!selectedChatId || !input.trim() || sending}
                className="p-2.5 bg-primary-blue hover:bg-blue-700 text-white rounded-xl shadow-lg shadow-blue-500/30 transition-all disabled:opacity-50"
              >
                <Send size={18} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Conversations;
