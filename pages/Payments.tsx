import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  RefreshCw,
  CreditCard,
  CheckCircle,
  AlertTriangle,
  PlayCircle,
  Eye,
  Link2,
  Info,
  Plus,
  PencilLine,
  ShieldCheck,
  Wallet,
  ExternalLink,
} from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { useActionConfirm } from '../components/ui/useActionConfirm';
import { useLanguage } from '../context/LanguageContext';
import { useToast } from '../context/ToastContext';
import { ApiError, ENDPOINTS, apiRequest } from '../services/api';
import { OrderStatus } from '../types';

type PaymentsTab = 'transactions' | 'attempts' | 'ambiguous';

interface ApiPaymentAttempt {
  id: string;
  order_id: string;
  expected_amount_uzs: number;
  status: string;
  payer_card_last4?: string | null;
  provider_hint?: string | null;
  window_start?: string | null;
  window_end?: string | null;
  payment_waiting_reminder_sent_at?: string | null;
  matched_transaction_id?: string | null;
  created_at: string;
}

interface ApiCheckoutSession {
  id: string;
  order_id: string;
  provider: 'PAYME' | 'CLICK';
  amount_uzs: number;
  status: 'CREATED' | 'PENDING' | 'PAID' | 'FAILED' | 'EXPIRED' | 'CANCELED';
  checkout_url?: string | null;
  expires_at?: string | null;
  paid_at?: string | null;
  fail_reason?: string | null;
  created_at?: string;
  updated_at?: string;
}

interface ApiTransaction {
  id: string;
  provider: string;
  amount_uzs: number;
  merchant_card_last4?: string | null;
  linked_order_id?: string | null;
  linked_payment_attempt_id?: string | null;
  occurred_at?: string;
  created_at: string;
  sender_card_last4?: string | null;
  sender_card_masked?: string | null;
  provider_transaction_id?: string | null;
  merchant_name?: string | null;
  payer_name?: string | null;
  payer_phone_masked?: string | null;
  status_text?: string | null;
  is_success?: boolean | null;
  source_chat_id?: string | null;
  source_message_id?: number | null;
  raw_hash?: string | null;
  parsed_payload?: Record<string, unknown> | null;
}

interface AmbiguousQueueItem {
  payment_attempt?: ApiPaymentAttempt;
  order?: {
    id: string;
    client_name?: string | null;
    total_amount_uzs?: number;
  };
  latest_audit?: {
    decision?: string | null;
    reason?: string | null;
  } | null;
  candidate_transactions?: ApiTransaction[];
}

interface ReminderSummary {
  processed?: number;
  sent?: number;
  skipped?: number;
  errors?: string[];
}

interface ReminderResponse {
  ok?: boolean;
  summary?: ReminderSummary;
  count?: number;
  due_count?: number;
  results?: unknown[];
}

interface AttachOrderResponse {
  ok?: boolean;
  transaction?: ApiTransaction;
  order?: {
    id: string;
  };
  payment_attempt?: ApiPaymentAttempt;
  created_payment_attempt?: boolean;
  already_linked?: boolean;
  force?: boolean;
}

interface SignalSource {
  id: string;
  title: string;
  chat_id: string;
  provider: 'PAYME' | 'CLICK' | string;
  parser_key?: string | null;
  is_active: boolean;
  success_required?: boolean;
  merchant_name_hint?: string | null;
  timezone_name?: string | null;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
}

interface SignalSender {
  id: string;
  source_id: string;
  telegram_user_id: string;
  display_name?: string | null;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

interface CheckoutCreateResponse {
  ok?: boolean;
  created?: boolean;
  reused?: boolean;
  session?: ApiCheckoutSession;
  sessions?: Record<string, ApiCheckoutSession>;
  payment_attempt?: ApiPaymentAttempt | null;
}

interface AttachableOrder {
  id: string;
  status: OrderStatus;
  payment_method: 'UNKNOWN' | 'CASH' | 'TRANSFER';
  total_amount_uzs: number;
  client_id?: string | null;
  location_text?: string | null;
  created_at?: string;
}

const ATTACHABLE_ORDER_STATUSES: OrderStatus[] = [
  'NEW_LEAD',
  'INFO_COLLECTED',
  'PAYMENT_PENDING',
  'PAYMENT_CONFIRMED',
  'DISPATCHED',
  'ASSIGNED',
  'OUT_FOR_DELIVERY',
];

const statusBadge = (status: string) => {
  if (['CONFIRMED', 'MATCHED', 'SUCCESS', 'PAID'].includes(status)) return 'success' as const;
  if (['PENDING', 'NEEDS_ADMIN', 'WAITING', 'CREATED'].includes(status)) return 'warning' as const;
  return 'error' as const;
};

const formatDateTime = (value?: string | null, locale = 'en-US') => {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString(locale);
};

const formatAmount = (value?: number | null) => `${Number(value || 0).toLocaleString()} UZS`;

const fieldValue = (value: unknown) => {
  if (value === null || value === undefined || value === '') return '-';
  return String(value);
};

const Payments: React.FC = () => {
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const toast = useToast();
  const { confirm, confirmationModal } = useActionConfirm();
  const tr = useCallback(
    (en: string, ru: string, uz: string) => (language === 'ru' ? ru : language === 'uz' ? uz : en),
    [language]
  );

  const locale = useMemo(() => {
    if (language === 'ru') return 'ru-RU';
    if (language === 'uz') return 'uz-UZ';
    return 'en-US';
  }, [language]);

  const [activeTab, setActiveTab] = useState<PaymentsTab>('transactions');
  const [loading, setLoading] = useState(false);
  const [matchingId, setMatchingId] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<ApiTransaction[]>([]);
  const [attempts, setAttempts] = useState<ApiPaymentAttempt[]>([]);
  const [ambiguousQueue, setAmbiguousQueue] = useState<AmbiguousQueueItem[]>([]);
  const [selectedTransaction, setSelectedTransaction] = useState<ApiTransaction | null>(null);
  const [attachTransaction, setAttachTransaction] = useState<ApiTransaction | null>(null);
  const [attachOrderId, setAttachOrderId] = useState('');
  const [attaching, setAttaching] = useState(false);
  const [attachError, setAttachError] = useState<string | null>(null);
  const [attachOrders, setAttachOrders] = useState<AttachableOrder[]>([]);
  const [attachOrdersLoading, setAttachOrdersLoading] = useState(false);
  const [delayMinutes, setDelayMinutes] = useState(10);
  const [runLimit, setRunLimit] = useState(100);
  const [remindersBusy, setRemindersBusy] = useState<'preview' | 'run' | null>(null);
  const [reminderPreview, setReminderPreview] = useState<ReminderResponse | null>(null);
  const [paymentOrders, setPaymentOrders] = useState<AttachableOrder[]>([]);
  const [paymentOrdersLoading, setPaymentOrdersLoading] = useState(false);

  const [ingestOpen, setIngestOpen] = useState(false);
  const [ingestSaving, setIngestSaving] = useState(false);
  const [ingestForm, setIngestForm] = useState({
    source_chat_id: '',
    source_message_id: '',
    raw_text: '',
    provider_hint: 'CLICK',
  });

  const [attemptCreateOpen, setAttemptCreateOpen] = useState(false);
  const [attemptCreateSaving, setAttemptCreateSaving] = useState(false);
  const [attemptCreateOrderId, setAttemptCreateOrderId] = useState('');
  const [attemptWindowMinutes, setAttemptWindowMinutes] = useState(10);

  const [cardAttempt, setCardAttempt] = useState<ApiPaymentAttempt | null>(null);
  const [cardSaving, setCardSaving] = useState(false);
  const [cardLast4, setCardLast4] = useState('');

  const [confirmAttempt, setConfirmAttempt] = useState<ApiPaymentAttempt | null>(null);
  const [confirmSaving, setConfirmSaving] = useState(false);
  const [confirmTransactionId, setConfirmTransactionId] = useState('');

  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutSaving, setCheckoutSaving] = useState(false);
  const [checkoutOrderId, setCheckoutOrderId] = useState('');
  const [checkoutProvider, setCheckoutProvider] = useState<'PAYME' | 'CLICK'>('PAYME');
  const [checkoutExpires, setCheckoutExpires] = useState(20);
  const [checkoutForceNew, setCheckoutForceNew] = useState(false);
  const [checkoutAllProviders, setCheckoutAllProviders] = useState(true);
  const [checkoutResult, setCheckoutResult] = useState<CheckoutCreateResponse | null>(null);

  const [signalSources, setSignalSources] = useState<SignalSource[]>([]);
  const [signalsLoading, setSignalsLoading] = useState(false);
  const [signalSaving, setSignalSaving] = useState(false);
  const [editingSource, setEditingSource] = useState<SignalSource | null>(null);
  const [sourceForm, setSourceForm] = useState({
    title: '',
    chat_id: '',
    provider: 'CLICK',
    parser_key: 'click_v1',
    is_active: true,
    success_required: true,
    merchant_name_hint: '',
    timezone_name: 'Asia/Tashkent',
    notes: '',
  });

  const [selectedSourceId, setSelectedSourceId] = useState('');
  const [signalSenders, setSignalSenders] = useState<SignalSender[]>([]);
  const [sendersLoading, setSendersLoading] = useState(false);
  const [senderSaving, setSenderSaving] = useState(false);
  const [editingSender, setEditingSender] = useState<SignalSender | null>(null);
  const [senderForm, setSenderForm] = useState({
    telegram_user_id: '',
    display_name: '',
    is_active: true,
  });

  const formatOrderRef = useCallback((orderId?: string | null) => {
    if (!orderId) return '-';
    return `#${orderId.slice(0, 8)}`;
  }, []);

  const getOrderStatusLabel = useCallback(
    (status: OrderStatus) => {
      if (status === 'NEW_LEAD') return tr('New lead', 'New lead', 'Yangi lid');
      if (status === 'INFO_COLLECTED') return tr('Info collected', 'Info collected', 'Malumot yigilgan');
      if (status === 'PAYMENT_PENDING') return tr('Payment pending', 'Payment pending', 'Tolov kutilmoqda');
      if (status === 'PAYMENT_CONFIRMED') return tr('Payment confirmed', 'Payment confirmed', 'Tolov tasdiqlangan');
      if (status === 'DISPATCHED') return tr('Dispatched', 'Dispatched', 'Yuborilgan');
      if (status === 'ASSIGNED') return tr('Assigned', 'Assigned', 'Biriktirilgan');
      if (status === 'OUT_FOR_DELIVERY') return tr('Out for delivery', 'Out for delivery', 'Yetkazib berishda');
      if (status === 'DELIVERED') return tr('Delivered', 'Delivered', 'Yetkazildi');
      if (status === 'CANCELED') return tr('Canceled', 'Canceled', 'Bekor qilingan');
      return tr('Failed', 'Failed', 'Muvaffaqiyatsiz');
    },
    [tr]
  );

  const openOrderPage = useCallback(
    (orderId?: string | null) => {
      if (!orderId) return;
      setSelectedTransaction(null);
      navigate(`/orders?order_id=${encodeURIComponent(orderId)}`);
    },
    [navigate]
  );

  const formatGenericError = useCallback(
    (error: unknown, fallbackEn: string, fallbackRu: string, fallbackUz: string) =>
      error instanceof Error ? error.message : tr(fallbackEn, fallbackRu, fallbackUz),
    [tr]
  );

  const buildOrdersQuery = useCallback((paymentMethod?: 'UNKNOWN' | 'CASH' | 'TRANSFER') => {
    const params = new URLSearchParams({
      status: ATTACHABLE_ORDER_STATUSES.join(','),
      limit: '200',
    });
    if (paymentMethod) params.set('payment_method', paymentMethod);
    return `${ENDPOINTS.ORDERS.LIST}?${params.toString()}`;
  }, []);

  const loadTransactions = useCallback(async () => {
    const res = await apiRequest<{ results?: ApiTransaction[] }>(`${ENDPOINTS.PAYMENTS.TRANSACTIONS}?limit=200`);
    setTransactions(res.results || []);
  }, []);

  const loadAttempts = useCallback(async () => {
    const res = await apiRequest<{ results?: ApiPaymentAttempt[] }>(`${ENDPOINTS.PAYMENTS.ATTEMPTS}?limit=200`);
    setAttempts(res.results || []);
  }, []);

  const loadAmbiguousQueue = useCallback(async (limit: number) => {
    const safeLimit = Math.max(1, Math.min(limit, 500));
    const res = await apiRequest<{ results?: AmbiguousQueueItem[] }>(
      `${ENDPOINTS.PAYMENTS.QUEUE_AMBIGUOUS}?limit=${safeLimit}`
    );
    setAmbiguousQueue(res.results || []);
  }, []);

  const loadPaymentOrders = useCallback(
    async (paymentMethod?: 'UNKNOWN' | 'CASH' | 'TRANSFER') => {
      try {
        setPaymentOrdersLoading(true);
        const res = await apiRequest<{ results?: AttachableOrder[] }>(buildOrdersQuery(paymentMethod));
        setPaymentOrders(res.results || []);
      } finally {
        setPaymentOrdersLoading(false);
      }
    },
    [buildOrdersQuery]
  );

  const loadAttachOrders = useCallback(async () => {
    try {
      setAttachOrdersLoading(true);
      setAttachError(null);
      const res = await apiRequest<{ results?: AttachableOrder[] }>(buildOrdersQuery('TRANSFER'));
      setAttachOrders(res.results || []);
    } catch (error) {
      const message = formatGenericError(
        error,
        'Failed to load available orders.',
        'Failed to load available orders.',
        'Mavjud buyurtmalarni yuklab bolmadi.'
      );
      setAttachOrders([]);
      setAttachError(message);
    } finally {
      setAttachOrdersLoading(false);
    }
  }, [buildOrdersQuery, formatGenericError]);

  const loadSignalSources = useCallback(async () => {
    try {
      setSignalsLoading(true);
      const res = await apiRequest<{ results?: SignalSource[] }>(`${ENDPOINTS.PAYMENTS.SIGNAL_SOURCES}?limit=200`);
      const next = res.results || [];
      setSignalSources(next);
      setSelectedSourceId((current) => {
        if (current && next.some((item) => item.id === current)) return current;
        return next[0]?.id || '';
      });
    } finally {
      setSignalsLoading(false);
    }
  }, []);

  const loadSignalSenders = useCallback(async (sourceId: string) => {
    if (!sourceId) {
      setSignalSenders([]);
      return;
    }
    try {
      setSendersLoading(true);
      const res = await apiRequest<{ results?: SignalSender[] }>(
        `${ENDPOINTS.PAYMENTS.SIGNAL_SOURCE_SENDERS(sourceId)}?limit=200`
      );
      setSignalSenders(res.results || []);
    } finally {
      setSendersLoading(false);
    }
  }, []);

  const getAttachErrorMessage = useCallback(
    (error: unknown) => {
      if (error instanceof ApiError) {
        if (error.code === 'E-ORD-004') {
          return tr(
            'Only transfer orders can be attached to a transaction.',
            'Only transfer orders can be attached to a transaction.',
            'Tranzaksiyaga faqat TRANSFER buyurtmani boglash mumkin.'
          );
        }
        if (error.code === 'E-PAY-003') {
          return tr(
            'This transaction is already linked to another order.',
            'This transaction is already linked to another order.',
            'Bu tranzaksiya allaqachon boshqa buyurtmaga boglangan.'
          );
        }
        if (error.code === 'E-ORD-001') {
          return tr('Order was not found.', 'Order was not found.', 'Buyurtma topilmadi.');
        }
        if (error.code === 'E-PAY-005') {
          return tr('Transaction was not found.', 'Transaction was not found.', 'Tranzaksiya topilmadi.');
        }
        if (error.code === 'E-PAY-006') {
          return tr(
            'Validation failed for manual attach. Check amount, transaction success, or existing links.',
            'Validation failed for manual attach. Check amount, transaction success, or existing links.',
            'Qolda boglash tekshiruvdan otmadi. Summani, tranzaksiya holatini yoki mavjud boglanishlarni tekshiring.'
          );
        }
      }
      return formatGenericError(
        error,
        'Failed to attach transaction to order.',
        'Failed to attach transaction to order.',
        'Tranzaksiyani buyurtmaga boglab bolmadi.'
      );
    },
    [formatGenericError, tr]
  );

  const resetSourceForm = useCallback(() => {
    setEditingSource(null);
    setSourceForm({
      title: '',
      chat_id: '',
      provider: 'CLICK',
      parser_key: 'click_v1',
      is_active: true,
      success_required: true,
      merchant_name_hint: '',
      timezone_name: 'Asia/Tashkent',
      notes: '',
    });
  }, []);

  const resetSenderForm = useCallback(() => {
    setEditingSender(null);
    setSenderForm({
      telegram_user_id: '',
      display_name: '',
      is_active: true,
    });
  }, []);

  const openAttachModal = useCallback(
    (tx: ApiTransaction) => {
      setSelectedTransaction(null);
      setAttachTransaction(tx);
      setAttachOrderId(tx.linked_order_id || '');
      setAttachError(null);
      void loadAttachOrders();
    },
    [loadAttachOrders]
  );

  const closeAttachModal = useCallback(() => {
    if (attaching) return;
    setAttachTransaction(null);
    setAttachOrderId('');
    setAttachError(null);
    setAttachOrders([]);
  }, [attaching]);

  const openIngestModal = useCallback(() => {
    setIngestForm({
      source_chat_id: '',
      source_message_id: '',
      raw_text: '',
      provider_hint: 'CLICK',
    });
    setIngestOpen(true);
  }, []);

  const openAttemptCreateModal = useCallback(() => {
    setAttemptCreateOrderId('');
    setAttemptWindowMinutes(10);
    setAttemptCreateOpen(true);
    void loadPaymentOrders();
  }, [loadPaymentOrders]);

  const openCardModal = useCallback((attempt: ApiPaymentAttempt) => {
    setCardAttempt(attempt);
    setCardLast4(attempt.payer_card_last4 || '');
  }, []);

  const openManualConfirmModal = useCallback(
    (attempt: ApiPaymentAttempt) => {
      setConfirmAttempt(attempt);
      setConfirmTransactionId(attempt.matched_transaction_id || '');
      if (transactions.length === 0) {
        void loadTransactions();
      }
    },
    [loadTransactions, transactions.length]
  );

  const openCheckoutModal = useCallback(() => {
    setCheckoutOrderId('');
    setCheckoutProvider('PAYME');
    setCheckoutExpires(20);
    setCheckoutForceNew(false);
    setCheckoutAllProviders(true);
    setCheckoutResult(null);
    setCheckoutOpen(true);
    void loadPaymentOrders('TRANSFER');
  }, [loadPaymentOrders]);

  const loadTabData = useCallback(async () => {
    try {
      setLoading(true);
      if (activeTab === 'transactions') {
        await loadTransactions();
      } else if (activeTab === 'attempts') {
        await loadAttempts();
      } else {
        await loadAmbiguousQueue(runLimit);
      }
    } catch (error) {
      toast.error(
        formatGenericError(
          error,
          'Failed to load payments data',
          'Failed to load payments data',
          'Tolov malumotlarini yuklab bolmadi'
        )
      );
    } finally {
      setLoading(false);
    }
  }, [activeTab, formatGenericError, loadAmbiguousQueue, loadAttempts, loadTransactions, runLimit, toast]);

  const submitAttachOrder = useCallback(
    async (force = false) => {
      if (!attachTransaction) return;
      const orderId = attachOrderId.trim();
      if (!orderId) {
        const message = tr('Enter order ID first.', 'Enter order ID first.', 'Avval buyurtma ID ni kiriting.');
        setAttachError(message);
        toast.warning(message);
        return;
      }

      const executeAttach = async (forceValue: boolean) => {
        const res = await apiRequest<AttachOrderResponse>(ENDPOINTS.PAYMENTS.TRANSACTION_ATTACH_ORDER(attachTransaction.id), {
          method: 'POST',
          body: JSON.stringify({ order_id: orderId, force: forceValue }),
        });

        if (res.transaction) {
          setSelectedTransaction(res.transaction);
        }

        closeAttachModal();
        toast.success(
          tr('Transaction attached to order.', 'Transaction attached to order.', 'Tranzaksiya buyurtmaga boglandi.')
        );
        await loadTabData();
      };

      try {
        setAttaching(true);
        setAttachError(null);
        await executeAttach(force);
      } catch (error) {
        if (!force && error instanceof ApiError && error.code === 'E-PAY-006') {
          const shouldForce = await confirm({
            title: tr('Force attach transaction', 'Force attach transaction', 'Tranzaksiyani majburan bog‘lash'),
            message: tr(
              'Normal attach was rejected. Force attach this transaction to the selected order?',
              'Obychnaya privyazka otklonena. Prinuditelno privyazat tranzaktsiyu k vybrannomu zakazu?',
              'Oddiy boglash rad etildi. Tranzaksiyani tanlangan buyurtmaga majburan boglaysizmi?'
            ),
            confirmLabel: tr('Force attach', 'Force attach', 'Majburan bog‘lash'),
            cancelLabel: t('cancel'),
            tone: 'warning',
          });
          if (shouldForce) {
            await executeAttach(true);
            return;
          }
        }

        const message = getAttachErrorMessage(error);
        setAttachError(message);
        toast.error(message);
      } finally {
        setAttaching(false);
      }
    },
    [attachOrderId, attachTransaction, closeAttachModal, getAttachErrorMessage, loadTabData, toast, tr]
  );

  const handleAutoMatch = useCallback(
    async (tx: ApiTransaction) => {
      try {
        setMatchingId(tx.id);
        const res = await apiRequest<{ result?: string }>(ENDPOINTS.PAYMENTS.TRANSACTION_MATCH(tx.id), { method: 'POST' });
        if (res.result === 'matched') {
          toast.success(tr('Matched successfully', 'Matched successfully', 'Muvaffaqiyatli boglandi'));
        } else {
          toast.warning(tr('No match found', 'No match found', 'Moslik topilmadi'));
        }
        await loadTabData();
      } catch (error) {
        toast.error(
          formatGenericError(
            error,
            'Failed to match transaction',
            'Failed to match transaction',
            'Tranzaksiyani boglab bolmadi'
          )
        );
      } finally {
        setMatchingId(null);
      }
    },
    [formatGenericError, loadTabData, toast, tr]
  );

  const previewReminders = useCallback(async () => {
    const safeDelay = Math.max(1, Math.min(delayMinutes, 120));
    try {
      setRemindersBusy('preview');
      const res = await apiRequest<ReminderResponse>(`${ENDPOINTS.PAYMENTS.REMINDERS_RUN}?delay_minutes=${safeDelay}`);
      setReminderPreview(res);
      const count = Number(res.due_count ?? res.count ?? (Array.isArray(res.results) ? res.results.length : 0));
      toast.success(tr(`Preview ready: ${count} due reminders`, `Predprosmotr gotov: ${count}`, `Korish tayyor: ${count}`));
    } catch (error) {
      toast.error(
        formatGenericError(
          error,
          'Failed to preview reminders',
          'Failed to preview reminders',
          'Eslatmalarni korib bolmadi'
        )
      );
    } finally {
      setRemindersBusy(null);
    }
  }, [delayMinutes, formatGenericError, toast, tr]);

  const runReminders = useCallback(async () => {
    const safeDelay = Math.max(1, Math.min(delayMinutes, 120));
    const safeLimit = Math.max(1, Math.min(runLimit, 500));
    try {
      setRemindersBusy('run');
      const res = await apiRequest<ReminderResponse>(ENDPOINTS.PAYMENTS.REMINDERS_RUN, {
        method: 'POST',
        body: JSON.stringify({ limit: safeLimit, delay_minutes: safeDelay }),
      });
      setReminderPreview(res);
      const summary = res.summary || {};
      toast.success(
        tr(
          `Done: sent ${summary.sent || 0}, skipped ${summary.skipped || 0}`,
          `Gotovo: ${summary.sent || 0}/${summary.skipped || 0}`,
          `Bajarildi: ${summary.sent || 0}/${summary.skipped || 0}`
        )
      );
      await loadTabData();
    } catch (error) {
      toast.error(
        formatGenericError(
          error,
          'Failed to run reminders',
          'Failed to run reminders',
          'Eslatmalarni ishga tushirib bolmadi'
        )
      );
    } finally {
      setRemindersBusy(null);
    }
  }, [delayMinutes, formatGenericError, loadTabData, runLimit, toast, tr]);

  const handleIngestTransaction = useCallback(async () => {
    const chatId = ingestForm.source_chat_id.trim();
    const messageId = Number(ingestForm.source_message_id);
    const rawText = ingestForm.raw_text.trim();

    if (!chatId || !Number.isFinite(messageId) || messageId <= 0 || !rawText) {
      toast.warning(
        tr(
          'Chat ID, message ID, and raw text are required.',
          'Chat ID, message ID, and raw text are required.',
          'Chat ID, message ID va raw text majburiy.'
        )
      );
      return;
    }

    try {
      setIngestSaving(true);
      const res = await apiRequest<{ transaction?: ApiTransaction }>(ENDPOINTS.PAYMENTS.TRANSACTION_INGEST, {
        method: 'POST',
        body: JSON.stringify({
          source_chat_id: chatId,
          source_message_id: messageId,
          raw_text: rawText,
          provider_hint: ingestForm.provider_hint || undefined,
        }),
      });
      setIngestOpen(false);
      setActiveTab('transactions');
      toast.success(tr('Transaction ingested.', 'Transaction ingested.', 'Tranzaksiya qabul qilindi.'));
      if (res.transaction) {
        setSelectedTransaction(res.transaction);
      }
      await loadTransactions();
    } catch (error) {
      toast.error(
        formatGenericError(
          error,
          'Failed to ingest transaction.',
          'Failed to ingest transaction.',
          'Tranzaksiyani qabul qilib bolmadi.'
        )
      );
    } finally {
      setIngestSaving(false);
    }
  }, [formatGenericError, ingestForm, loadTransactions, toast, tr]);

  const handleCreateAttempt = useCallback(async () => {
    const orderId = attemptCreateOrderId.trim();
    const windowMinutes = Math.max(1, Math.min(attemptWindowMinutes, 60));
    if (!orderId) {
      toast.warning(tr('Select an order first.', 'Select an order first.', 'Avval buyurtmani tanlang.'));
      return;
    }

    try {
      setAttemptCreateSaving(true);
      await apiRequest(ENDPOINTS.PAYMENTS.CREATE_ORDER_ATTEMPT(orderId), {
        method: 'POST',
        body: JSON.stringify({ window_minutes: windowMinutes }),
      });
      setAttemptCreateOpen(false);
      setActiveTab('attempts');
      toast.success(tr('Payment attempt created.', 'Payment attempt created.', 'Tolov urinishi yaratildi.'));
      await loadAttempts();
    } catch (error) {
      toast.error(
        formatGenericError(
          error,
          'Failed to create payment attempt.',
          'Failed to create payment attempt.',
          'Tolov urinishini yaratib bolmadi.'
        )
      );
    } finally {
      setAttemptCreateSaving(false);
    }
  }, [attemptCreateOrderId, attemptWindowMinutes, formatGenericError, loadAttempts, toast, tr]);

  const handleSaveCustomerCard = useCallback(async () => {
    if (!cardAttempt) return;
    const last4 = cardLast4.trim();
    if (!/^\d{4}$/.test(last4)) {
      toast.warning(tr('Enter exactly 4 digits.', 'Enter exactly 4 digits.', 'Aniq 4 ta raqam kiriting.'));
      return;
    }

    const confirmed = await confirm({
      title: tr('Save customer last4', 'Save customer last4', 'Mijoz last4 ni saqlash'),
      message: tr(
        `Save card last4 ****${last4} for ${formatOrderRef(cardAttempt.order_id)}?`,
        `Save card last4 ****${last4} for ${formatOrderRef(cardAttempt.order_id)}?`,
        `${formatOrderRef(cardAttempt.order_id)} uchun ****${last4} kartani saqlaysizmi?`
      ),
      confirmLabel: tr('Save last4', 'Save last4', 'Last4 ni saqlash'),
      cancelLabel: t('cancel'),
      tone: 'primary',
    });
    if (!confirmed) return;

    try {
      setCardSaving(true);
      await apiRequest(ENDPOINTS.PAYMENTS.ATTEMPT_CUSTOMER_CARD(cardAttempt.id), {
        method: 'PATCH',
        body: JSON.stringify({ payer_card_last4: last4 }),
      });
      setCardAttempt(null);
      setCardLast4('');
      toast.success(tr('Customer card saved.', 'Customer card saved.', 'Mijoz karta raqami saqlandi.'));
      await loadAttempts();
    } catch (error) {
      toast.error(
        formatGenericError(
          error,
          'Failed to save customer card.',
          'Failed to save customer card.',
          'Mijoz karta raqamini saqlab bolmadi.'
        )
      );
    } finally {
      setCardSaving(false);
    }
  }, [cardAttempt, cardLast4, confirm, formatGenericError, formatOrderRef, loadAttempts, t, toast, tr]);

  const handleManualConfirm = useCallback(async () => {
    if (!confirmAttempt) return;
    const transactionId = confirmTransactionId.trim();
    if (!transactionId) {
      toast.warning(tr('Select a transaction first.', 'Select a transaction first.', 'Avval tranzaksiyani tanlang.'));
      return;
    }

    try {
      setConfirmSaving(true);
      await apiRequest(ENDPOINTS.PAYMENTS.MANUAL_CONFIRM, {
        method: 'POST',
        body: JSON.stringify({
          payment_attempt_id: confirmAttempt.id,
          transaction_id: transactionId,
        }),
      });
      setConfirmAttempt(null);
      setConfirmTransactionId('');
      toast.success(tr('Payment confirmed manually.', 'Payment confirmed manually.', 'Tolov qolda tasdiqlandi.'));
      await Promise.all([loadAttempts(), loadTransactions()]);
    } catch (error) {
      toast.error(
        formatGenericError(
          error,
          'Failed to confirm payment.',
          'Failed to confirm payment.',
          'Tolovni tasdiqlab bolmadi.'
        )
      );
    } finally {
      setConfirmSaving(false);
    }
  }, [confirmAttempt, confirmTransactionId, formatGenericError, loadAttempts, loadTransactions, toast, tr]);

  const handleCreateCheckout = useCallback(async () => {
    const orderId = checkoutOrderId.trim();
    const expiresMinutes = Math.max(1, Math.min(checkoutExpires, 240));
    if (!orderId) {
      toast.warning(tr('Select a transfer order first.', 'Select a transfer order first.', 'Avval otkazma buyurtmani tanlang.'));
      return;
    }

    try {
      setCheckoutSaving(true);
      const body: Record<string, unknown> = {
        order_id: orderId,
        force_new: checkoutForceNew,
        expires_minutes: expiresMinutes,
      };
      if (checkoutAllProviders) {
        body.include_all_providers = true;
      } else {
        body.provider = checkoutProvider;
      }
      const res = await apiRequest<CheckoutCreateResponse>(ENDPOINTS.PAYMENTS.CHECKOUT_CREATE, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      setCheckoutResult(res);
      toast.success(tr('Checkout session created.', 'Checkout session created.', 'Checkout sessiyasi yaratildi.'));
    } catch (error) {
      toast.error(
        formatGenericError(
          error,
          'Failed to create checkout session.',
          'Failed to create checkout session.',
          'Checkout sessiyasini yaratib bolmadi.'
        )
      );
    } finally {
      setCheckoutSaving(false);
    }
  }, [checkoutAllProviders, checkoutExpires, checkoutForceNew, checkoutOrderId, checkoutProvider, formatGenericError, toast, tr]);

  const handleSaveSignalSource = useCallback(async () => {
    const title = sourceForm.title.trim();
    const chatId = sourceForm.chat_id.trim();
    if (!title || !chatId) {
      toast.warning(tr('Title and chat ID are required.', 'Title and chat ID are required.', 'Sarlavha va chat ID majburiy.'));
      return;
    }

    if (editingSource) {
      const confirmed = await confirm({
        title: tr('Save signal source changes', 'Save signal source changes', "Signal manbasi o'zgarishlarini saqlash"),
        message: tr(
          `Save changes for "${editingSource.title}"?`,
          `Save changes for "${editingSource.title}"?`,
          `"${editingSource.title}" uchun o'zgarishlarni saqlaysizmi?`
        ),
        confirmLabel: tr('Save changes', 'Save changes', "O'zgarishlarni saqlash"),
        cancelLabel: t('cancel'),
        tone: 'primary',
      });
      if (!confirmed) return;
    }

    try {
      setSignalSaving(true);
      if (editingSource) {
        await apiRequest(ENDPOINTS.PAYMENTS.SIGNAL_SOURCE_DETAIL(editingSource.id), {
          method: 'PATCH',
          body: JSON.stringify(sourceForm),
        });
        toast.success(tr('Signal source updated.', 'Signal source updated.', 'Signal manbasi yangilandi.'));
      } else {
        await apiRequest(ENDPOINTS.PAYMENTS.SIGNAL_SOURCES, {
          method: 'POST',
          body: JSON.stringify(sourceForm),
        });
        toast.success(tr('Signal source created.', 'Signal source created.', 'Signal manbasi yaratildi.'));
      }
      resetSourceForm();
      await loadSignalSources();
    } catch (error) {
      toast.error(
        formatGenericError(
          error,
          'Failed to save signal source.',
          'Failed to save signal source.',
          'Signal manbasini saqlab bolmadi.'
        )
      );
    } finally {
      setSignalSaving(false);
    }
  }, [confirm, editingSource, formatGenericError, loadSignalSources, resetSourceForm, sourceForm, t, toast, tr]);

  const handleDeleteSignalSource = useCallback(async (source: SignalSource) => {
    const confirmed = await confirm({
      title: tr('Delete signal source', 'Delete signal source', 'Signal manbasini o‘chirish'),
      message: tr(
        `Delete signal source "${source.title}"?`,
        `Delete signal source "${source.title}"?`,
        `"${source.title}" signal manbasini o‘chirasizmi?`
      ),
      confirmLabel: tr('Delete source', 'Delete source', "Manbani o'chirish"),
      cancelLabel: t('cancel'),
      tone: 'danger',
    });
    if (!confirmed) return;

    try {
      await apiRequest(ENDPOINTS.PAYMENTS.SIGNAL_SOURCE_DETAIL(source.id), { method: 'DELETE' });
      if (editingSource?.id === source.id) {
        resetSourceForm();
      }
      if (selectedSourceId === source.id) {
        setSelectedSourceId('');
        setSignalSenders([]);
      }
      toast.success(tr('Signal source deleted.', 'Signal source deleted.', 'Signal manbasi ochirildi.'));
      await loadSignalSources();
    } catch (error) {
      toast.error(
        formatGenericError(
          error,
          'Failed to delete signal source.',
          'Failed to delete signal source.',
          'Signal manbasini ochirib bolmadi.'
        )
      );
    }
  }, [confirm, editingSource?.id, formatGenericError, loadSignalSources, resetSourceForm, selectedSourceId, t, toast, tr]);

  const handleSaveSignalSender = useCallback(async () => {
    if (!selectedSourceId) {
      toast.warning(tr('Select a signal source first.', 'Select a signal source first.', 'Avval signal manbasini tanlang.'));
      return;
    }
    const telegramUserId = senderForm.telegram_user_id.trim();
    if (!telegramUserId) {
      toast.warning(tr('Telegram user ID is required.', 'Telegram user ID is required.', 'Telegram user ID majburiy.'));
      return;
    }

    if (editingSender) {
      const confirmed = await confirm({
        title: tr('Save sender changes', 'Save sender changes', "Yuboruvchi o'zgarishlarini saqlash"),
        message: tr(
          `Save changes for "${editingSender.display_name || editingSender.telegram_user_id}"?`,
          `Save changes for "${editingSender.display_name || editingSender.telegram_user_id}"?`,
          `"${editingSender.display_name || editingSender.telegram_user_id}" uchun o'zgarishlarni saqlaysizmi?`
        ),
        confirmLabel: tr('Save changes', 'Save changes', "O'zgarishlarni saqlash"),
        cancelLabel: t('cancel'),
        tone: 'primary',
      });
      if (!confirmed) return;
    }

    try {
      setSenderSaving(true);
      if (editingSender) {
        await apiRequest(ENDPOINTS.PAYMENTS.SIGNAL_SENDER_DETAIL(editingSender.id), {
          method: 'PATCH',
          body: JSON.stringify(senderForm),
        });
        toast.success(tr('Sender updated.', 'Sender updated.', 'Yuboruvchi yangilandi.'));
      } else {
        await apiRequest(ENDPOINTS.PAYMENTS.SIGNAL_SOURCE_SENDERS(selectedSourceId), {
          method: 'POST',
          body: JSON.stringify(senderForm),
        });
        toast.success(tr('Sender created.', 'Sender created.', 'Yuboruvchi yaratildi.'));
      }
      resetSenderForm();
      await loadSignalSenders(selectedSourceId);
    } catch (error) {
      toast.error(
        formatGenericError(
          error,
          'Failed to save sender.',
          'Failed to save sender.',
          'Yuboruvchini saqlab bolmadi.'
        )
      );
    } finally {
      setSenderSaving(false);
    }
  }, [confirm, editingSender, formatGenericError, loadSignalSenders, resetSenderForm, selectedSourceId, senderForm, t, toast, tr]);

  const handleDeleteSignalSender = useCallback(async (sender: SignalSender) => {
    const confirmed = await confirm({
      title: tr('Delete sender', 'Delete sender', 'Yuboruvchini o‘chirish'),
      message: tr(
        `Delete sender ${sender.display_name || sender.telegram_user_id}?`,
        `Delete sender ${sender.display_name || sender.telegram_user_id}?`,
        `${sender.display_name || sender.telegram_user_id} yuboruvchisini o'chirasizmi?`
      ),
      confirmLabel: tr('Delete sender', 'Delete sender', "Yuboruvchini o'chirish"),
      cancelLabel: t('cancel'),
      tone: 'danger',
    });
    if (!confirmed) return;

    try {
      await apiRequest(ENDPOINTS.PAYMENTS.SIGNAL_SENDER_DETAIL(sender.id), { method: 'DELETE' });
      if (editingSender?.id === sender.id) {
        resetSenderForm();
      }
      toast.success(tr('Sender deleted.', 'Sender deleted.', 'Yuboruvchi ochirildi.'));
      await loadSignalSenders(sender.source_id);
    } catch (error) {
      toast.error(
        formatGenericError(
          error,
          'Failed to delete sender.',
          'Failed to delete sender.',
          'Yuboruvchini ochirib bolmadi.'
        )
      );
    }
  }, [confirm, editingSender?.id, formatGenericError, loadSignalSenders, resetSenderForm, t, toast, tr]);

  useEffect(() => {
    void loadTabData();
  }, [loadTabData]);

  useEffect(() => {
    if (!selectedSourceId) {
      setSignalSenders([]);
      return;
    }
    void loadSignalSenders(selectedSourceId);
  }, [loadSignalSenders, selectedSourceId]);

  const checkoutSessions = useMemo(() => {
    if (!checkoutResult) return [];
    if (checkoutResult.sessions) return Object.entries(checkoutResult.sessions);
    if (checkoutResult.session) return [[checkoutResult.session.provider, checkoutResult.session] as [string, ApiCheckoutSession]];
    return [];
  }, [checkoutResult]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-light-text dark:text-white">{t('nav_payments')}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {tr(
              'Operations for transactions, attempts, checkout links, reminders, and signal readers',
              'Operations for transactions, attempts, checkout links, reminders, and signal readers',
              'Tranzaksiyalar, urinishlar, checkout linklar, eslatmalar va signal manbalari boshqaruvi'
            )}
          </p>
        </div>
        <button
          onClick={loadTabData}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3 py-2 bg-white dark:bg-navy-800 border border-light-border dark:border-navy-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-navy-700 transition disabled:opacity-60"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          <span className="text-sm">{tr('Refresh', 'Refresh', 'Yangilash')}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.6fr_1fr] gap-4">
        <Card className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-800 dark:text-gray-100">
            <PlayCircle size={16} className="text-primary-blue" />
            <span>{tr('Transfer reminders operations', 'Transfer reminders operations', 'Otkazma eslatmalari amallari')}</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-gray-600 dark:text-gray-300">{tr('Delay minutes', 'Delay minutes', 'Kechikish daqiqasi')}</span>
              <input
                type="number"
                min={1}
                max={120}
                value={delayMinutes}
                onChange={(e) => setDelayMinutes(Number(e.target.value || 10))}
                className="bg-white dark:bg-navy-900 border border-light-border dark:border-navy-600 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary-blue"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-gray-600 dark:text-gray-300">{tr('Run limit', 'Run limit', 'Ishga tushirish limiti')}</span>
              <input
                type="number"
                min={1}
                max={500}
                value={runLimit}
                onChange={(e) => setRunLimit(Number(e.target.value || 100))}
                className="bg-white dark:bg-navy-900 border border-light-border dark:border-navy-600 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary-blue"
              />
            </label>
            <div className="flex items-end gap-2">
              <button
                onClick={previewReminders}
                disabled={remindersBusy !== null}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-light-border dark:border-navy-600 bg-white dark:bg-navy-900 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-navy-800 disabled:opacity-60"
              >
                <Eye size={15} />
                {remindersBusy === 'preview' ? tr('Previewing...', 'Previewing...', 'Korib chiqilmoqda...') : tr('Preview', 'Preview', 'Korish')}
              </button>
              <button
                onClick={runReminders}
                disabled={remindersBusy !== null}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-primary-blue bg-primary-blue text-white hover:bg-blue-700 disabled:opacity-60"
              >
                <PlayCircle size={15} />
                {remindersBusy === 'run' ? tr('Running...', 'Running...', 'Ishga tushmoqda...') : tr('Run now', 'Run now', 'Hozir ishga tushirish')}
              </button>
            </div>
          </div>
          {reminderPreview && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="rounded-xl border border-light-border dark:border-navy-700 p-3 bg-gray-50 dark:bg-navy-900/40">
                <p className="text-xs text-gray-500">{tr('Processed', 'Processed', 'Qayta ishlangan')}</p>
                <p className="text-lg font-semibold">{reminderPreview.summary?.processed ?? 0}</p>
              </div>
              <div className="rounded-xl border border-light-border dark:border-navy-700 p-3 bg-gray-50 dark:bg-navy-900/40">
                <p className="text-xs text-gray-500">{tr('Sent', 'Sent', 'Yuborilgan')}</p>
                <p className="text-lg font-semibold text-green-600">{reminderPreview.summary?.sent ?? 0}</p>
              </div>
              <div className="rounded-xl border border-light-border dark:border-navy-700 p-3 bg-gray-50 dark:bg-navy-900/40">
                <p className="text-xs text-gray-500">{tr('Skipped', 'Skipped', 'Otib yuborilgan')}</p>
                <p className="text-lg font-semibold text-amber-600">{reminderPreview.summary?.skipped ?? 0}</p>
              </div>
              <div className="rounded-xl border border-light-border dark:border-navy-700 p-3 bg-gray-50 dark:bg-navy-900/40">
                <p className="text-xs text-gray-500">{tr('Errors', 'Errors', 'Xatolar')}</p>
                <p className="text-lg font-semibold text-red-600">{reminderPreview.summary?.errors?.length ?? 0}</p>
              </div>
            </div>
          )}
        </Card>

        <Card className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-800 dark:text-gray-100">
            <Wallet size={16} className="text-primary-blue" />
            <span>{tr('Manual payment tools', 'Manual payment tools', 'Tolov uchun qolda boshqaruv')}</span>
          </div>
          <div className="grid grid-cols-1 gap-2">
            <button
              type="button"
              onClick={openIngestModal}
              className="flex items-center justify-between gap-3 rounded-xl border border-light-border dark:border-navy-700 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-navy-900/40 transition"
            >
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{tr('Ingest transaction', 'Ingest transaction', 'Tranzaksiyani qabul qilish')}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{tr('Paste raw payment message into the parser pipeline', 'Paste raw payment message into the parser pipeline', 'Raw payment xabarini parserga yuborish')}</p>
              </div>
              <Plus size={16} className="text-primary-blue" />
            </button>
            <button
              type="button"
              onClick={openAttemptCreateModal}
              className="flex items-center justify-between gap-3 rounded-xl border border-light-border dark:border-navy-700 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-navy-900/40 transition"
            >
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{tr('Create payment attempt', 'Create payment attempt', 'Tolov urinishini yaratish')}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{tr('Open a payment window for an active order', 'Open a payment window for an active order', 'Aktiv buyurtma uchun tolok oynasini yaratish')}</p>
              </div>
              <ShieldCheck size={16} className="text-primary-blue" />
            </button>
            <button
              type="button"
              onClick={openCheckoutModal}
              className="flex items-center justify-between gap-3 rounded-xl border border-light-border dark:border-navy-700 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-navy-900/40 transition"
            >
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{tr('Create checkout link', 'Create checkout link', 'Checkout link yaratish')}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{tr('Generate Payme and Click links for transfer orders', 'Generate Payme and Click links for transfer orders', 'Otkazma buyurtmalar uchun Payme va Click linklar')}</p>
              </div>
              <ExternalLink size={16} className="text-primary-blue" />
            </button>
          </div>
        </Card>
      </div>

      <div className="flex flex-wrap gap-4 border-b border-light-border dark:border-navy-700">
        {[
          { key: 'transactions', label: tr('Transactions', 'Transactions', 'Tranzaksiyalar') },
          { key: 'attempts', label: tr('Payment attempts', 'Payment attempts', 'Tolov urinishlari') },
          { key: 'ambiguous', label: tr('Ambiguous queue', 'Ambiguous queue', 'Noaniq navbat') },
        ].map((item) => (
          <button
            key={item.key}
            onClick={() => setActiveTab(item.key as PaymentsTab)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === item.key
                ? 'border-primary-blue text-primary-blue'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <Card className="!p-0 overflow-hidden">
        {activeTab === 'transactions' && (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 dark:bg-navy-900/50 text-xs uppercase text-gray-500 dark:text-gray-400 border-b border-light-border dark:border-navy-700">
                    <th className="px-6 py-4 font-semibold">{tr('Provider', 'Provider', 'Provayder')}</th>
                    <th className="px-6 py-4 font-semibold">{tr('Amount', 'Amount', 'Summa')}</th>
                    <th className="px-6 py-4 font-semibold">{tr('Occurred', 'Occurred', 'Vaqt')}</th>
                    <th className="px-6 py-4 font-semibold">{tr('Link', 'Link', 'Boglanish')}</th>
                    <th className="px-6 py-4 font-semibold text-right">{tr('Actions', 'Actions', 'Amallar')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-light-border dark:divide-navy-700">
                  {loading && transactions.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-10 text-center text-gray-500">
                        {tr('Loading...', 'Loading...', 'Yuklanmoqda...')}
                      </td>
                    </tr>
                  ) : transactions.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-10 text-center text-gray-500">
                        {tr('No transactions found', 'No transactions found', 'Tranzaksiya topilmadi')}
                      </td>
                    </tr>
                  ) : (
                    transactions.map((tx) => (
                      <tr key={tx.id} onClick={() => setSelectedTransaction(tx)} className="hover:bg-gray-50 dark:hover:bg-navy-700/50 transition-colors cursor-pointer">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-900/30">
                              <CreditCard size={18} />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-900 dark:text-white">{fieldValue(tx.provider)}</p>
                              <p className="text-xs text-gray-500">{fieldValue(tx.sender_card_masked || tx.sender_card_last4 || tx.merchant_card_last4)}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm font-semibold text-gray-900 dark:text-white">{formatAmount(tx.amount_uzs)}</td>
                        <td className="px-6 py-4 text-sm text-gray-500">{formatDateTime(tx.occurred_at || tx.created_at, locale)}</td>
                        <td className="px-6 py-4">
                          {tx.linked_order_id ? (
                            <div className="flex flex-col items-start gap-1.5">
                              <Badge variant="success" className="flex w-max items-center gap-1">
                                <CheckCircle size={14} /> {tr('Linked to order', 'Linked to order', 'Buyurtmaga boglangan')}
                              </Badge>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openOrderPage(tx.linked_order_id);
                                }}
                                className="text-xs font-medium text-primary-blue dark:text-blue-300 hover:text-blue-700 dark:hover:text-blue-200"
                              >
                                {formatOrderRef(tx.linked_order_id)}
                              </button>
                            </div>
                          ) : (
                            <Badge variant="warning">{tr('Unlinked', 'Unlinked', 'Boglanmagan')}</Badge>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="inline-flex items-center gap-3">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedTransaction(tx);
                              }}
                              className="inline-flex items-center gap-1 text-gray-600 dark:text-gray-300 hover:text-primary-blue text-sm font-medium"
                            >
                              <Info size={14} />
                              {tr('Details', 'Details', 'Batafsil')}
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                openAttachModal(tx);
                              }}
                              className="inline-flex items-center gap-1 text-primary-blue dark:text-blue-300 hover:text-blue-700 dark:hover:text-blue-200 text-sm font-medium"
                            >
                              <Link2 size={14} />
                              {tx.linked_order_id
                                ? tr('Change order', 'Change order', 'Buyurtmani ozgartirish')
                                : tr('Attach order', 'Attach order', 'Buyurtmani boglash')}
                            </button>
                            {!tx.linked_order_id && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void handleAutoMatch(tx);
                                }}
                                disabled={matchingId === tx.id}
                                className="inline-flex items-center gap-1 text-primary-blue dark:text-blue-300 hover:text-blue-700 dark:hover:text-blue-200 text-sm font-medium disabled:opacity-50"
                              >
                                <Link2 size={14} />
                                {matchingId === tx.id ? tr('Matching...', 'Matching...', 'Boglanmoqda...') : tr('Auto match', 'Auto match', 'Avto boglash')}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
        )}

        {activeTab === 'attempts' && (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 dark:bg-navy-900/50 text-xs uppercase text-gray-500 dark:text-gray-400 border-b border-light-border dark:border-navy-700">
                    <th className="px-6 py-4 font-semibold">{tr('Order', 'Order', 'Buyurtma')}</th>
                    <th className="px-6 py-4 font-semibold">{tr('Amount', 'Amount', 'Summa')}</th>
                    <th className="px-6 py-4 font-semibold">{tr('Status', 'Status', 'Holat')}</th>
                    <th className="px-6 py-4 font-semibold">{tr('Provider hint', 'Provider hint', 'Provayder belgisi')}</th>
                    <th className="px-6 py-4 font-semibold">{tr('Reminder', 'Reminder', 'Eslatma')}</th>
                    <th className="px-6 py-4 font-semibold text-right">{tr('Actions', 'Actions', 'Amallar')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-light-border dark:divide-navy-700">
                  {loading && attempts.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-10 text-center text-gray-500">
                        {tr('Loading...', 'Loading...', 'Yuklanmoqda...')}
                      </td>
                    </tr>
                  ) : attempts.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-10 text-center text-gray-500">
                        {tr('No payment attempts found', 'No payment attempts found', 'Tolov urinishlari topilmadi')}
                      </td>
                    </tr>
                  ) : (
                    attempts.map((att) => (
                      <tr key={att.id} className="hover:bg-gray-50 dark:hover:bg-navy-700/50 transition-colors">
                        <td className="px-6 py-4">
                          <button
                            type="button"
                            onClick={() => openOrderPage(att.order_id)}
                            className="text-sm font-semibold text-primary-blue dark:text-blue-300 hover:text-blue-700 dark:hover:text-blue-200"
                          >
                            {formatOrderRef(att.order_id)}
                          </button>
                          <p className="text-xs text-gray-400">{formatDateTime(att.created_at, locale)}</p>
                        </td>
                        <td className="px-6 py-4 text-sm font-semibold text-gray-900 dark:text-white">{formatAmount(att.expected_amount_uzs)}</td>
                        <td className="px-6 py-4">
                          <Badge variant={statusBadge(att.status || '')}>{fieldValue(att.status)}</Badge>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {fieldValue(att.provider_hint)}
                          {att.payer_card_last4 ? ` / ****${att.payer_card_last4}` : ''}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {att.payment_waiting_reminder_sent_at
                            ? formatDateTime(att.payment_waiting_reminder_sent_at, locale)
                            : tr('Not sent', 'Not sent', 'Yuborilmagan')}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="inline-flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => openCardModal(att)}
                              className="inline-flex items-center gap-1 text-gray-700 dark:text-gray-200 hover:text-primary-blue text-sm font-medium"
                            >
                              <PencilLine size={14} />
                              {att.payer_card_last4 ? tr('Edit last4', 'Edit last4', 'Last4 ozgartirish') : tr('Set last4', 'Set last4', 'Last4 kiritish')}
                            </button>
                            <button
                              type="button"
                              onClick={() => openManualConfirmModal(att)}
                              className="inline-flex items-center gap-1 text-primary-blue dark:text-blue-300 hover:text-blue-700 dark:hover:text-blue-200 text-sm font-medium"
                            >
                              <ShieldCheck size={14} />
                              {tr('Manual confirm', 'Manual confirm', 'Qolda tasdiqlash')}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
        )}

        {activeTab === 'ambiguous' && (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 dark:bg-navy-900/50 text-xs uppercase text-gray-500 dark:text-gray-400 border-b border-light-border dark:border-navy-700">
                    <th className="px-6 py-4 font-semibold">{tr('Order / Client', 'Order / Client', 'Buyurtma / Mijoz')}</th>
                    <th className="px-6 py-4 font-semibold">{tr('Attempt', 'Attempt', 'Urinish')}</th>
                    <th className="px-6 py-4 font-semibold">{tr('Candidates', 'Candidates', 'Nomzodlar')}</th>
                    <th className="px-6 py-4 font-semibold">{tr('Latest audit', 'Latest audit', 'Songgi audit')}</th>
                    <th className="px-6 py-4 font-semibold text-right">{tr('Actions', 'Actions', 'Amallar')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-light-border dark:divide-navy-700">
                  {loading && ambiguousQueue.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-10 text-center text-gray-500">
                        {tr('Loading...', 'Loading...', 'Yuklanmoqda...')}
                      </td>
                    </tr>
                  ) : ambiguousQueue.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-10 text-center text-gray-500">
                        <span className="inline-flex items-center gap-2">
                          <CheckCircle size={16} className="text-green-500" />
                          {tr('No ambiguous payments in queue', 'No ambiguous payments in queue', 'Noaniq tolovlar yoq')}
                        </span>
                      </td>
                    </tr>
                  ) : (
                    ambiguousQueue.map((row, idx) => (
                      <tr key={`${row.payment_attempt?.id || row.order?.id || 'q'}-${idx}`} className="hover:bg-gray-50 dark:hover:bg-navy-700/50 transition-colors">
                        <td className="px-6 py-4">
                          <p className="text-sm font-medium text-gray-900 dark:text-white">{fieldValue(row.order?.client_name)}</p>
                          <div className="flex flex-wrap items-center gap-2 mt-1">
                            <button
                              type="button"
                              onClick={() => openOrderPage(row.order?.id)}
                              disabled={!row.order?.id}
                              className="text-xs font-medium text-primary-blue dark:text-blue-300 hover:text-blue-700 disabled:opacity-50"
                            >
                              {formatOrderRef(row.order?.id)}
                            </button>
                            <span className="text-xs text-gray-500">{formatAmount(row.order?.total_amount_uzs)}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-sm font-semibold">{formatAmount(row.payment_attempt?.expected_amount_uzs)}</p>
                          <div className="mt-1">
                            <Badge variant={statusBadge(row.payment_attempt?.status || 'NEEDS_ADMIN')}>
                              {fieldValue(row.payment_attempt?.status || 'NEEDS_ADMIN')}
                            </Badge>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="space-y-2">
                            {(row.candidate_transactions || []).slice(0, 3).map((tx) => (
                              <button
                                key={tx.id}
                                type="button"
                                onClick={() => setSelectedTransaction(tx)}
                                className="flex w-full items-center justify-between rounded-lg border border-light-border dark:border-navy-700 px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-navy-900/40"
                              >
                                <span className="text-xs text-gray-700 dark:text-gray-200">
                                  {fieldValue(tx.provider)} / {formatAmount(tx.amount_uzs)}
                                </span>
                                <span className="text-[11px] text-primary-blue dark:text-blue-300">{tx.id.slice(0, 8)}</span>
                              </button>
                            ))}
                            {(row.candidate_transactions?.length || 0) > 3 && (
                              <p className="text-xs text-gray-500">
                                {tr('More candidates available', 'More candidates available', 'Yana nomzodlar mavjud')}
                              </p>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {row.latest_audit ? (
                            <div className="text-sm text-gray-700 dark:text-gray-200">
                              <div className="inline-flex items-center gap-1">
                                <AlertTriangle size={14} className="text-amber-500" />
                                <span>{fieldValue(row.latest_audit.decision)}</span>
                              </div>
                              <p className="text-xs text-gray-500 mt-1">{fieldValue(row.latest_audit.reason)}</p>
                            </div>
                          ) : (
                            <span className="text-sm text-gray-500">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          {row.payment_attempt ? (
                            <button
                              type="button"
                              onClick={() => openManualConfirmModal(row.payment_attempt!)}
                              className="inline-flex items-center gap-1 text-primary-blue dark:text-blue-300 hover:text-blue-700 dark:hover:text-blue-200 text-sm font-medium"
                            >
                              <ShieldCheck size={14} />
                              {tr('Resolve', 'Resolve', 'Hal qilish')}
                            </button>
                          ) : (
                            <span className="text-xs text-gray-400">-</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
        )}
      </Card>

      <Modal
        isOpen={ingestOpen}
        onClose={() => (!ingestSaving ? setIngestOpen(false) : undefined)}
        title={tr('Ingest transaction', 'Ingest transaction', 'Tranzaksiyani qabul qilish')}
        maxWidthClass="max-w-2xl"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-gray-600 dark:text-gray-300">{tr('Source chat ID', 'Source chat ID', 'Manba chat ID')}</span>
              <input
                value={ingestForm.source_chat_id}
                onChange={(e) => setIngestForm((prev) => ({ ...prev, source_chat_id: e.target.value }))}
                className="bg-white dark:bg-navy-900 border border-light-border dark:border-navy-600 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary-blue"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-gray-600 dark:text-gray-300">{tr('Source message ID', 'Source message ID', 'Manba xabar ID')}</span>
              <input
                type="number"
                min={1}
                value={ingestForm.source_message_id}
                onChange={(e) => setIngestForm((prev) => ({ ...prev, source_message_id: e.target.value }))}
                className="bg-white dark:bg-navy-900 border border-light-border dark:border-navy-600 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary-blue"
              />
            </label>
          </div>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-gray-600 dark:text-gray-300">{tr('Provider hint', 'Provider hint', 'Provayder belgisi')}</span>
            <select
              value={ingestForm.provider_hint}
              onChange={(e) => setIngestForm((prev) => ({ ...prev, provider_hint: e.target.value }))}
              className="bg-white dark:bg-navy-900 border border-light-border dark:border-navy-600 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary-blue"
            >
              <option value="CLICK">CLICK</option>
              <option value="PAYME">PAYME</option>
              <option value="">{tr('No hint', 'No hint', 'Hintsiz')}</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-gray-600 dark:text-gray-300">{tr('Raw text', 'Raw text', 'Raw text')}</span>
            <textarea
              rows={8}
              value={ingestForm.raw_text}
              onChange={(e) => setIngestForm((prev) => ({ ...prev, raw_text: e.target.value }))}
              className="bg-white dark:bg-navy-900 border border-light-border dark:border-navy-600 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary-blue"
            />
          </label>
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setIngestOpen(false)}
              disabled={ingestSaving}
              className="px-4 py-2 rounded-lg border border-light-border dark:border-navy-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-navy-800 disabled:opacity-60"
            >
              {tr('Cancel', 'Cancel', 'Bekor qilish')}
            </button>
            <button
              type="button"
              onClick={() => void handleIngestTransaction()}
              disabled={ingestSaving}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-primary-blue bg-primary-blue text-white hover:bg-blue-700 disabled:opacity-60"
            >
              <Plus size={15} />
              {ingestSaving ? tr('Ingesting...', 'Ingesting...', 'Qabul qilinmoqda...') : tr('Ingest', 'Ingest', 'Qabul qilish')}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={attemptCreateOpen}
        onClose={() => (!attemptCreateSaving ? setAttemptCreateOpen(false) : undefined)}
        title={tr('Create payment attempt', 'Create payment attempt', 'Tolov urinishini yaratish')}
        maxWidthClass="max-w-2xl"
      >
        <div className="space-y-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-gray-600 dark:text-gray-300">{tr('Active order', 'Active order', 'Aktiv buyurtma')}</span>
            <select
              value={attemptCreateOrderId}
              onChange={(e) => setAttemptCreateOrderId(e.target.value)}
              disabled={paymentOrdersLoading || attemptCreateSaving}
              className="bg-white dark:bg-navy-900 border border-light-border dark:border-navy-600 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary-blue"
            >
              <option value="">
                {paymentOrdersLoading ? tr('Loading orders...', 'Loading orders...', 'Buyurtmalar yuklanmoqda...') : tr('Select order', 'Select order', 'Buyurtmani tanlang')}
              </option>
              {paymentOrders.map((order) => (
                <option key={order.id} value={order.id}>
                  {`${formatOrderRef(order.id)} / ${formatAmount(order.total_amount_uzs)} / ${order.payment_method} / ${getOrderStatusLabel(order.status)}`}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-gray-600 dark:text-gray-300">{tr('Window minutes', 'Window minutes', 'Oyna daqiqasi')}</span>
            <input
              type="number"
              min={1}
              max={60}
              value={attemptWindowMinutes}
              onChange={(e) => setAttemptWindowMinutes(Number(e.target.value || 10))}
              className="bg-white dark:bg-navy-900 border border-light-border dark:border-navy-600 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary-blue"
            />
          </label>
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setAttemptCreateOpen(false)}
              disabled={attemptCreateSaving}
              className="px-4 py-2 rounded-lg border border-light-border dark:border-navy-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-navy-800 disabled:opacity-60"
            >
              {tr('Cancel', 'Cancel', 'Bekor qilish')}
            </button>
            <button
              type="button"
              onClick={() => void handleCreateAttempt()}
              disabled={attemptCreateSaving}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-primary-blue bg-primary-blue text-white hover:bg-blue-700 disabled:opacity-60"
            >
              <ShieldCheck size={15} />
              {attemptCreateSaving ? tr('Creating...', 'Creating...', 'Yaratilmoqda...') : tr('Create attempt', 'Create attempt', 'Urinish yaratish')}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={!!cardAttempt}
        onClose={() => (!cardSaving ? setCardAttempt(null) : undefined)}
        title={tr('Set customer card last4', 'Set customer card last4', 'Mijoz karta last4 ni kiritish')}
        maxWidthClass="max-w-md"
      >
        {cardAttempt && (
          <div className="space-y-4">
            <div className="rounded-xl border border-light-border dark:border-navy-700 p-4 bg-gray-50 dark:bg-navy-900/40">
              <p className="text-xs text-gray-500">{tr('Payment attempt', 'Payment attempt', 'Tolov urinishi')}</p>
              <p className="text-sm font-semibold text-gray-900 dark:text-white mt-1">{formatOrderRef(cardAttempt.order_id)} / {formatAmount(cardAttempt.expected_amount_uzs)}</p>
            </div>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-gray-600 dark:text-gray-300">{tr('Card last4', 'Card last4', 'Karta last4')}</span>
              <input
                inputMode="numeric"
                maxLength={4}
                value={cardLast4}
                onChange={(e) => setCardLast4(e.target.value.replace(/\D/g, '').slice(0, 4))}
                className="bg-white dark:bg-navy-900 border border-light-border dark:border-navy-600 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary-blue"
              />
            </label>
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setCardAttempt(null)}
                disabled={cardSaving}
                className="px-4 py-2 rounded-lg border border-light-border dark:border-navy-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-navy-800 disabled:opacity-60"
              >
                {tr('Cancel', 'Cancel', 'Bekor qilish')}
              </button>
              <button
                type="button"
                onClick={() => void handleSaveCustomerCard()}
                disabled={cardSaving}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-primary-blue bg-primary-blue text-white hover:bg-blue-700 disabled:opacity-60"
              >
                <ShieldCheck size={15} />
                {cardSaving ? tr('Saving...', 'Saving...', 'Saqlanmoqda...') : tr('Save last4', 'Save last4', 'Last4 ni saqlash')}
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={!!confirmAttempt}
        onClose={() => (!confirmSaving ? setConfirmAttempt(null) : undefined)}
        title={tr('Manual payment confirm', 'Manual payment confirm', 'Tolovni qolda tasdiqlash')}
        maxWidthClass="max-w-2xl"
      >
        {confirmAttempt && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="rounded-xl border border-light-border dark:border-navy-700 p-4 bg-gray-50 dark:bg-navy-900/40">
                <p className="text-xs text-gray-500">{tr('Order', 'Order', 'Buyurtma')}</p>
                <button
                  type="button"
                  onClick={() => openOrderPage(confirmAttempt.order_id)}
                  className="mt-1 text-sm font-semibold text-primary-blue dark:text-blue-300 hover:text-blue-700 dark:hover:text-blue-200"
                >
                  {formatOrderRef(confirmAttempt.order_id)}
                </button>
              </div>
              <div className="rounded-xl border border-light-border dark:border-navy-700 p-4 bg-gray-50 dark:bg-navy-900/40">
                <p className="text-xs text-gray-500">{tr('Expected amount', 'Expected amount', 'Kutilgan summa')}</p>
                <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-white">{formatAmount(confirmAttempt.expected_amount_uzs)}</p>
              </div>
              <div className="rounded-xl border border-light-border dark:border-navy-700 p-4 bg-gray-50 dark:bg-navy-900/40">
                <p className="text-xs text-gray-500">{tr('Attempt status', 'Attempt status', 'Urinish holati')}</p>
                <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-white">{fieldValue(confirmAttempt.status)}</p>
              </div>
            </div>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-gray-600 dark:text-gray-300">{tr('Transaction ID', 'Transaction ID', 'Tranzaksiya ID')}</span>
              <input
                list="payment-transactions-list"
                value={confirmTransactionId}
                onChange={(e) => setConfirmTransactionId(e.target.value)}
                className="bg-white dark:bg-navy-900 border border-light-border dark:border-navy-600 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary-blue"
              />
              <datalist id="payment-transactions-list">
                {transactions.map((tx) => (
                  <option key={tx.id} value={tx.id}>
                    {`${tx.provider} / ${formatAmount(tx.amount_uzs)} / ${tx.id.slice(0, 8)}`}
                  </option>
                ))}
              </datalist>
            </label>
            <div className="rounded-xl border border-light-border dark:border-navy-700 p-4">
              <p className="text-sm font-semibold text-gray-900 dark:text-white">{tr('Recent transactions', 'Recent transactions', 'Songgi tranzaksiyalar')}</p>
              <div className="mt-3 space-y-2">
                {transactions.slice(0, 6).map((tx) => (
                  <button
                    key={tx.id}
                    type="button"
                    onClick={() => setConfirmTransactionId(tx.id)}
                    className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left transition ${
                      confirmTransactionId === tx.id
                        ? 'border-primary-blue bg-blue-50 dark:bg-blue-950/10 dark:border-blue-700'
                        : 'border-light-border dark:border-navy-700 hover:bg-gray-50 dark:hover:bg-navy-900/30'
                    }`}
                  >
                    <span className="text-sm text-gray-800 dark:text-gray-100">
                      {tx.provider} / {formatAmount(tx.amount_uzs)}
                    </span>
                    <span className="text-xs text-gray-500">{tx.id.slice(0, 8)}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmAttempt(null)}
                disabled={confirmSaving}
                className="px-4 py-2 rounded-lg border border-light-border dark:border-navy-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-navy-800 disabled:opacity-60"
              >
                {tr('Cancel', 'Cancel', 'Bekor qilish')}
              </button>
              <button
                type="button"
                onClick={() => void handleManualConfirm()}
                disabled={confirmSaving}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-primary-blue bg-primary-blue text-white hover:bg-blue-700 disabled:opacity-60"
              >
                <ShieldCheck size={15} />
                {confirmSaving ? tr('Confirming...', 'Confirming...', 'Tasdiqlanmoqda...') : tr('Confirm payment', 'Confirm payment', 'Tolovni tasdiqlash')}
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={checkoutOpen}
        onClose={() => (!checkoutSaving ? setCheckoutOpen(false) : undefined)}
        title={tr('Create checkout link', 'Create checkout link', 'Checkout link yaratish')}
        maxWidthClass="max-w-3xl"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-gray-600 dark:text-gray-300">{tr('Transfer order', 'Transfer order', 'Otkazma buyurtma')}</span>
              <select
                value={checkoutOrderId}
                onChange={(e) => setCheckoutOrderId(e.target.value)}
                disabled={paymentOrdersLoading || checkoutSaving}
                className="bg-white dark:bg-navy-900 border border-light-border dark:border-navy-600 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary-blue"
              >
                <option value="">
                  {paymentOrdersLoading ? tr('Loading orders...', 'Loading orders...', 'Buyurtmalar yuklanmoqda...') : tr('Select transfer order', 'Select transfer order', 'Otkazma buyurtmani tanlang')}
                </option>
                {paymentOrders.map((order) => (
                  <option key={order.id} value={order.id}>
                    {`${formatOrderRef(order.id)} / ${formatAmount(order.total_amount_uzs)} / ${getOrderStatusLabel(order.status)}`}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-gray-600 dark:text-gray-300">{tr('Expires minutes', 'Expires minutes', 'Amal qilish muddati')}</span>
              <input
                type="number"
                min={1}
                max={240}
                value={checkoutExpires}
                onChange={(e) => setCheckoutExpires(Number(e.target.value || 20))}
                className="bg-white dark:bg-navy-900 border border-light-border dark:border-navy-600 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary-blue"
              />
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <label className="inline-flex items-center gap-2 text-gray-700 dark:text-gray-200">
              <input
                type="checkbox"
                checked={checkoutAllProviders}
                onChange={(e) => setCheckoutAllProviders(e.target.checked)}
              />
              {tr('Create all providers', 'Create all providers', 'Barcha provayderlarni yaratish')}
            </label>
            {!checkoutAllProviders && (
              <label className="inline-flex items-center gap-2 text-gray-700 dark:text-gray-200">
                <span>{tr('Provider', 'Provider', 'Provayder')}</span>
                <select
                  value={checkoutProvider}
                  onChange={(e) => setCheckoutProvider(e.target.value as 'PAYME' | 'CLICK')}
                  className="bg-white dark:bg-navy-900 border border-light-border dark:border-navy-600 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-primary-blue"
                >
                  <option value="PAYME">PAYME</option>
                  <option value="CLICK">CLICK</option>
                </select>
              </label>
            )}
            <label className="inline-flex items-center gap-2 text-gray-700 dark:text-gray-200">
              <input
                type="checkbox"
                checked={checkoutForceNew}
                onChange={(e) => setCheckoutForceNew(e.target.checked)}
              />
              {tr('Force new session', 'Force new session', 'Yangi sessiyani majburlash')}
            </label>
          </div>

          {checkoutResult && (
            <div className="space-y-3 rounded-xl border border-light-border dark:border-navy-700 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={checkoutResult.reused ? 'warning' : 'success'}>
                  {checkoutResult.reused ? tr('Reused', 'Reused', 'Qayta ishlatildi') : tr('Created', 'Created', 'Yaratildi')}
                </Badge>
                {checkoutResult.payment_attempt && (
                  <span className="text-xs text-gray-500">
                    {tr('Attempt', 'Attempt', 'Urinish')} {checkoutResult.payment_attempt.id.slice(0, 8)}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {checkoutSessions.map(([providerKey, session]) => (
                  <div key={session.id} className="rounded-xl border border-light-border dark:border-navy-700 p-4 bg-gray-50 dark:bg-navy-900/30">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">{providerKey}</p>
                        <p className="text-xs text-gray-500 mt-1">{formatAmount(session.amount_uzs)}</p>
                      </div>
                      <Badge variant={statusBadge(session.status)}>{session.status}</Badge>
                    </div>
                    <div className="mt-3 space-y-2 text-xs text-gray-600 dark:text-gray-300">
                      <p>{tr('Session', 'Session', 'Sessiya')}: {session.id.slice(0, 8)}</p>
                      <p>{tr('Expires', 'Expires', 'Tugash vaqti')}: {formatDateTime(session.expires_at, locale)}</p>
                    </div>
                    {session.checkout_url && (
                      <a
                        href={session.checkout_url}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-primary-blue dark:text-blue-300 hover:text-blue-700 dark:hover:text-blue-200"
                      >
                        <ExternalLink size={14} />
                        {tr('Open checkout', 'Open checkout', 'Checkoutni ochish')}
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setCheckoutOpen(false)}
              disabled={checkoutSaving}
              className="px-4 py-2 rounded-lg border border-light-border dark:border-navy-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-navy-800 disabled:opacity-60"
            >
              {tr('Close', 'Close', 'Yopish')}
            </button>
            <button
              type="button"
              onClick={() => void handleCreateCheckout()}
              disabled={checkoutSaving}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-primary-blue bg-primary-blue text-white hover:bg-blue-700 disabled:opacity-60"
            >
              <ExternalLink size={15} />
              {checkoutSaving ? tr('Creating...', 'Creating...', 'Yaratilmoqda...') : tr('Create checkout', 'Create checkout', 'Checkout yaratish')}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={!!attachTransaction}
        onClose={closeAttachModal}
        title={tr('Attach transaction to order', 'Attach transaction to order', 'Tranzaksiyani buyurtmaga boglash')}
        maxWidthClass="max-w-2xl"
      >
        {attachTransaction && (
          <div className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="rounded-lg border border-light-border dark:border-navy-700 p-3 bg-gray-50 dark:bg-navy-900/40">
                <p className="text-xs text-gray-500">{tr('Provider', 'Provider', 'Provayder')}</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{fieldValue(attachTransaction.provider)}</p>
              </div>
              <div className="rounded-lg border border-light-border dark:border-navy-700 p-3 bg-gray-50 dark:bg-navy-900/40">
                <p className="text-xs text-gray-500">{tr('Amount', 'Amount', 'Summa')}</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{formatAmount(attachTransaction.amount_uzs)}</p>
              </div>
              <div className="rounded-lg border border-light-border dark:border-navy-700 p-3 bg-gray-50 dark:bg-navy-900/40">
                <p className="text-xs text-gray-500">{tr('Transaction status', 'Transaction status', 'Tranzaksiya holati')}</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{fieldValue(attachTransaction.status_text)}</p>
              </div>
            </div>

            <div className="rounded-lg border border-light-border dark:border-navy-700 p-4 space-y-3">
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">{tr('Select order', 'Select order', 'Buyurtmani tanlang')}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{tr('Only active transfer orders are shown here.', 'Only active transfer orders are shown here.', 'Bu yerda faqat aktiv otkazma buyurtmalar korsatiladi.')}</p>
              </div>
              <select
                value={attachOrderId}
                onChange={(e) => {
                  setAttachOrderId(e.target.value);
                  if (attachError) setAttachError(null);
                }}
                disabled={attachOrdersLoading || attaching}
                className="w-full bg-white dark:bg-navy-900 border border-light-border dark:border-navy-600 rounded-lg px-3 py-2.5 text-sm text-gray-900 dark:text-white outline-none focus:border-primary-blue"
              >
                <option value="">
                  {attachOrdersLoading ? tr('Loading orders...', 'Loading orders...', 'Buyurtmalar yuklanmoqda...') : tr('Choose order', 'Choose order', 'Buyurtmani tanlang')}
                </option>
                {attachOrders.map((order) => (
                  <option key={order.id} value={order.id}>
                    {`${formatOrderRef(order.id)} / ${formatAmount(order.total_amount_uzs)} / ${getOrderStatusLabel(order.status)}`}
                  </option>
                ))}
              </select>
              {!attachOrdersLoading && attachOrders.length === 0 && !attachError && (
                <div className="rounded-lg border border-light-border dark:border-navy-700 bg-gray-50 dark:bg-navy-900/40 px-3 py-2 text-xs text-gray-600 dark:text-gray-300">
                  {tr('No active transfer orders available for manual attach.', 'No active transfer orders available for manual attach.', 'Qolda boglash uchun aktiv otkazma buyurtmalar topilmadi.')}
                </div>
              )}
              {attachError && (
                <div className="rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/20 px-3 py-2 text-xs text-red-700 dark:text-red-300">
                  {attachError}
                </div>
              )}
              <div className="rounded-lg border border-amber-200 dark:border-amber-700/40 bg-amber-50 dark:bg-amber-950/20 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
                {tr(
                  'Use force only if admin intentionally overrides amount or status validation.',
                  'Force nuzhen tolko kogda admin soznatelno obkhodit proverku summy ili statusa.',
                  'Force faqat admin summa yoki status tekshiruvini ongli ravishda chetlab otganda ishlatiladi.'
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={closeAttachModal}
                disabled={attaching}
                className="px-4 py-2 rounded-lg border border-light-border dark:border-navy-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-navy-800 disabled:opacity-60"
              >
                {tr('Cancel', 'Cancel', 'Bekor qilish')}
              </button>
              <button
                type="button"
                onClick={() => void submitAttachOrder(false)}
                disabled={attaching}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-primary-blue bg-primary-blue text-white hover:bg-blue-700 disabled:opacity-60"
              >
                <Link2 size={15} />
                {attaching ? tr('Attaching...', 'Attaching...', 'Boglanmoqda...') : tr('Attach to order', 'Attach to order', 'Buyurtmaga boglash')}
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={!!selectedTransaction}
        onClose={() => setSelectedTransaction(null)}
        title={tr('Transaction details', 'Transaction details', 'Tranzaksiya tafsilotlari')}
        maxWidthClass="max-w-4xl"
      >
        {selectedTransaction && (
          <div className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="rounded-lg border border-light-border dark:border-navy-700 p-3 bg-gray-50 dark:bg-navy-900/40">
                <p className="text-xs text-gray-500">{tr('Amount', 'Amount', 'Summa')}</p>
                <p className="text-lg font-semibold text-gray-900 dark:text-white">{formatAmount(selectedTransaction.amount_uzs)}</p>
              </div>
              <div className="rounded-lg border border-light-border dark:border-navy-700 p-3 bg-gray-50 dark:bg-navy-900/40">
                <p className="text-xs text-gray-500">{tr('Provider', 'Provider', 'Provayder')}</p>
                <p className="text-lg font-semibold text-gray-900 dark:text-white">{fieldValue(selectedTransaction.provider)}</p>
              </div>
              <div className="rounded-lg border border-light-border dark:border-navy-700 p-3 bg-gray-50 dark:bg-navy-900/40">
                <p className="text-xs text-gray-500">{tr('Status', 'Status', 'Holat')}</p>
                <p className="text-lg font-semibold text-gray-900 dark:text-white">{fieldValue(selectedTransaction.status_text)}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg border border-light-border dark:border-navy-700 p-3">
                <p className="text-xs text-gray-500">{tr('Transaction ID', 'Transaction ID', 'Tranzaksiya ID')}</p>
                <p className="font-mono break-all text-gray-900 dark:text-white">{fieldValue(selectedTransaction.id)}</p>
              </div>
              <div className="rounded-lg border border-light-border dark:border-navy-700 p-3">
                <p className="text-xs text-gray-500">{tr('Provider transaction ID', 'Provider transaction ID', 'Provayder tranzaksiya ID')}</p>
                <p className="font-mono break-all text-gray-900 dark:text-white">{fieldValue(selectedTransaction.provider_transaction_id)}</p>
              </div>
              <div className="rounded-lg border border-light-border dark:border-navy-700 p-3">
                <p className="text-xs text-gray-500">{tr('Occurred at', 'Occurred at', 'Tolov vaqti')}</p>
                <p className="text-gray-900 dark:text-white">{formatDateTime(selectedTransaction.occurred_at, locale)}</p>
              </div>
              <div className="rounded-lg border border-light-border dark:border-navy-700 p-3">
                <p className="text-xs text-gray-500">{tr('Created at', 'Created at', 'Yaratilgan')}</p>
                <p className="text-gray-900 dark:text-white">{formatDateTime(selectedTransaction.created_at, locale)}</p>
              </div>
              <div className="rounded-lg border border-light-border dark:border-navy-700 p-3">
                <p className="text-xs text-gray-500">{tr('Sender card', 'Sender card', 'Yuboruvchi karta')}</p>
                <p className="text-gray-900 dark:text-white">{fieldValue(selectedTransaction.sender_card_masked || selectedTransaction.sender_card_last4)}</p>
              </div>
              <div className="rounded-lg border border-light-border dark:border-navy-700 p-3">
                <p className="text-xs text-gray-500">{tr('Merchant card', 'Merchant card', 'Qabul qiluvchi karta')}</p>
                <p className="text-gray-900 dark:text-white">{fieldValue(selectedTransaction.merchant_card_last4)}</p>
              </div>
              <div className="rounded-lg border border-light-border dark:border-navy-700 p-3">
                <p className="text-xs text-gray-500">{tr('Merchant name', 'Merchant name', 'Qabul qiluvchi nomi')}</p>
                <p className="text-gray-900 dark:text-white">{fieldValue(selectedTransaction.merchant_name)}</p>
              </div>
              <div className="rounded-lg border border-light-border dark:border-navy-700 p-3">
                <p className="text-xs text-gray-500">{tr('Payer name', 'Payer name', 'Tolovchi ismi')}</p>
                <p className="text-gray-900 dark:text-white">{fieldValue(selectedTransaction.payer_name)}</p>
              </div>
              <div className="rounded-lg border border-light-border dark:border-navy-700 p-3">
                <p className="text-xs text-gray-500">{tr('Payer phone', 'Payer phone', 'Tolovchi telefoni')}</p>
                <p className="text-gray-900 dark:text-white">{fieldValue(selectedTransaction.payer_phone_masked)}</p>
              </div>
              <div className="rounded-lg border border-light-border dark:border-navy-700 p-3">
                <p className="text-xs text-gray-500">{tr('Linked order', 'Linked order', 'Boglangan buyurtma')}</p>
                {selectedTransaction.linked_order_id ? (
                  <div className="mt-1 space-y-2">
                    <p className="text-gray-900 dark:text-white font-semibold">{formatOrderRef(selectedTransaction.linked_order_id)}</p>
                    <p className="text-xs text-gray-500 font-mono break-all">{selectedTransaction.linked_order_id}</p>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openOrderPage(selectedTransaction.linked_order_id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-light-border dark:border-navy-600 text-sm text-primary-blue dark:text-blue-300 hover:bg-gray-50 dark:hover:bg-navy-800"
                      >
                        <Link2 size={14} />
                        {tr('Open order', 'Open order', 'Buyurtmani ochish')}
                      </button>
                      <button
                        type="button"
                        onClick={() => openAttachModal(selectedTransaction)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-light-border dark:border-navy-600 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-navy-800"
                      >
                        <Link2 size={14} />
                        {tr('Change order', 'Change order', 'Buyurtmani ozgartirish')}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-1 space-y-2">
                    <p className="font-mono break-all text-gray-900 dark:text-white">-</p>
                    <button
                      type="button"
                      onClick={() => openAttachModal(selectedTransaction)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-light-border dark:border-navy-600 text-sm text-primary-blue dark:text-blue-300 hover:bg-gray-50 dark:hover:bg-navy-800"
                    >
                      <Link2 size={14} />
                      {tr('Attach order', 'Attach order', 'Buyurtmani boglash')}
                    </button>
                  </div>
                )}
              </div>
              <div className="rounded-lg border border-light-border dark:border-navy-700 p-3">
                <p className="text-xs text-gray-500">{tr('Source chat ID', 'Source chat ID', 'Manba chat ID')}</p>
                <p className="font-mono break-all text-gray-900 dark:text-white">{fieldValue(selectedTransaction.source_chat_id)}</p>
              </div>
              <div className="rounded-lg border border-light-border dark:border-navy-700 p-3">
                <p className="text-xs text-gray-500">{tr('Source message ID', 'Source message ID', 'Manba xabar ID')}</p>
                <p className="font-mono break-all text-gray-900 dark:text-white">{fieldValue(selectedTransaction.source_message_id)}</p>
              </div>
            </div>

            <div className="rounded-lg border border-light-border dark:border-navy-700 p-3">
              <p className="text-xs text-gray-500">{tr('Raw hash', 'Raw hash', 'Raw hash')}</p>
              <p className="font-mono break-all text-gray-900 dark:text-white">{fieldValue(selectedTransaction.raw_hash)}</p>
            </div>

            <div className="rounded-lg border border-light-border dark:border-navy-700 p-3">
              <p className="text-xs text-gray-500 mb-2">{tr('Parsed payload', 'Parsed payload', 'Ajratilgan payload')}</p>
              <pre className="text-xs leading-relaxed overflow-auto bg-gray-50 dark:bg-navy-900/40 rounded-lg p-3 text-gray-800 dark:text-gray-200">
                {JSON.stringify(selectedTransaction.parsed_payload || {}, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </Modal>
      {confirmationModal}
    </div>
  );
};

export default Payments;
