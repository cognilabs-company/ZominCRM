import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { useLanguage } from '../context/LanguageContext';
import { useToast } from '../context/ToastContext';
import { ApiError, ENDPOINTS, apiRequest } from '../services/api';
import { RefreshCw, CreditCard, CheckCircle, AlertTriangle, PlayCircle, Eye, Link2, Info } from 'lucide-react';

type PaymentsTab = 'transactions' | 'attempts' | 'ambiguous';

interface ApiPaymentAttempt {
  id: string;
  order_id: string;
  amount_uzs: number;
  status: string;
  payer_card_last4?: string | null;
  provider_hint?: string | null;
  payment_waiting_reminder_sent_at?: string | null;
  created_at: string;
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
    status?: string | null;
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

const statusBadge = (status: string) => {
  if (['CONFIRMED', 'MATCHED', 'SUCCESS'].includes(status)) return 'success' as const;
  if (['PENDING', 'NEEDS_ADMIN', 'WAITING'].includes(status)) return 'warning' as const;
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
  const tr = useCallback((en: string, ru: string, uz: string) => (language === 'ru' ? ru : language === 'uz' ? uz : en), [language]);

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
  const [delayMinutes, setDelayMinutes] = useState(10);
  const [runLimit, setRunLimit] = useState(100);
  const [remindersBusy, setRemindersBusy] = useState<'preview' | 'run' | null>(null);
  const [reminderPreview, setReminderPreview] = useState<ReminderResponse | null>(null);

  const formatOrderRef = useCallback((orderId?: string | null) => {
    if (!orderId) return '-';
    return `#${orderId.slice(0, 8)}`;
  }, []);

  const openOrderPage = useCallback((orderId?: string | null) => {
    if (!orderId) return;
    navigate(`/orders?order_id=${encodeURIComponent(orderId)}`);
  }, [navigate]);

  const getAttachErrorMessage = useCallback((error: unknown) => {
    if (error instanceof ApiError) {
      if (error.code === 'E-ORD-004') {
        return tr('Only transfer orders can be attached to a transaction.', 'K tranzaktsii mozhno privyazat tolko zakaz s TRANSFER.', 'Tranzaksiyaga faqat TRANSFER buyurtmani boglash mumkin.');
      }
      if (error.code === 'E-PAY-003') {
        return tr('This transaction is already linked to another order.', 'Eta tranzaktsiya uzhe privyazana k drugomu zakazu.', 'Bu tranzaksiya allaqachon boshqa buyurtmaga boglangan.');
      }
      if (error.code === 'E-ORD-001') {
        return tr('Order was not found.', 'Zakaz ne nayden.', 'Buyurtma topilmadi.');
      }
      if (error.code === 'E-PAY-005') {
        return tr('Transaction was not found.', 'Tranzaktsiya ne naydena.', 'Tranzaksiya topilmadi.');
      }
      if (error.code === 'E-PAY-006') {
        return tr('Validation failed for manual attach. Check amount, transaction success, or existing links.', 'Ruchnaya privyazka ne proshla proverku. Proverte summu, status tranzaktsii ili uzhe sushchestvuyushchie svyazi.', 'Qolda boglash tekshiruvdan otmadi. Summani, tranzaksiya holatini yoki mavjud boglanishlarni tekshiring.');
      }
    }
    return error instanceof Error ? error.message : tr('Failed to attach transaction to order.', 'Ne udalos privyazat tranzaktsiyu k zakazu.', 'Tranzaksiyani buyurtmaga boglab bolmadi.');
  }, [tr]);

  const openAttachModal = useCallback((tx: ApiTransaction) => {
    setAttachTransaction(tx);
    setAttachOrderId(tx.linked_order_id || '');
  }, []);

  const closeAttachModal = useCallback(() => {
    if (attaching) return;
    setAttachTransaction(null);
    setAttachOrderId('');
  }, [attaching]);

  const loadTabData = useCallback(async () => {
    try {
      setLoading(true);
      if (activeTab === 'transactions') {
        const res = await apiRequest<{ results?: ApiTransaction[] }>(ENDPOINTS.PAYMENTS.TRANSACTIONS);
        setTransactions(res.results || []);
      } else if (activeTab === 'attempts') {
        const res = await apiRequest<{ results?: ApiPaymentAttempt[] }>(ENDPOINTS.PAYMENTS.ATTEMPTS);
        setAttempts(res.results || []);
      } else {
        const res = await apiRequest<{ results?: AmbiguousQueueItem[] }>(`${ENDPOINTS.PAYMENTS.QUEUE_AMBIGUOUS}?limit=${Math.max(1, Math.min(runLimit, 500))}`);
        setAmbiguousQueue(res.results || []);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : tr('Failed to load payments data', 'Ne udalos zagruzit platezhnye dannye', "Tolov malumotlarini yuklab bolmadi"));
    } finally {
      setLoading(false);
    }
  }, [activeTab, runLimit, toast, tr]);

  const submitAttachOrder = useCallback(async (force = false) => {
    if (!attachTransaction) return;
    const orderId = attachOrderId.trim();
    if (!orderId) {
      toast.warning(tr('Enter order ID first.', 'Snachala ukazhite ID zakaza.', 'Avval buyurtma ID ni kiriting.'));
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
      toast.success(tr('Transaction attached to order.', 'Tranzaktsiya privyazana k zakazu.', 'Tranzaksiya buyurtmaga boglandi.'));
      await loadTabData();
    };

    try {
      setAttaching(true);
      await executeAttach(force);
    } catch (error) {
      if (!force && error instanceof ApiError && error.code === 'E-PAY-006') {
        const shouldForce = window.confirm(
          tr(
            'Normal attach was rejected. Force attach this transaction to the selected order?',
            'Obychnaya privyazka otklonena. Prinuditelno privyazat tranzaktsiyu k vybrannomu zakazu?',
            'Oddiy boglash rad etildi. Tranzaksiyani tanlangan buyurtmaga majburan boglaysizmi?'
          )
        );

        if (shouldForce) {
          await executeAttach(true);
          return;
        }
      }

      toast.error(getAttachErrorMessage(error));
    } finally {
      setAttaching(false);
    }
  }, [attachOrderId, attachTransaction, closeAttachModal, getAttachErrorMessage, loadTabData, toast, tr]);

  useEffect(() => {
    loadTabData();
  }, [loadTabData]);

  const handleAutoMatch = async (tx: ApiTransaction) => {
    try {
      setMatchingId(tx.id);
      const res = await apiRequest<{ result?: string }>(ENDPOINTS.PAYMENTS.TRANSACTION_MATCH(tx.id), { method: 'POST' });
      if (res.result === 'matched') {
        toast.success(tr('Matched successfully', 'Uspeshno svyazano', 'Muvaffaqiyatli boglandi'));
      } else {
        toast.warning(tr('No match found', 'Sovpadenie ne naydeno', 'Moslik topilmadi'));
      }
      await loadTabData();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : tr('Failed to match transaction', 'Ne udalos svyazat tranzaktsiyu', 'Tranzaksiyani boglab bolmadi'));
    } finally {
      setMatchingId(null);
    }
  };

  const previewReminders = async () => {
    const safeDelay = Math.max(1, Math.min(delayMinutes, 120));
    try {
      setRemindersBusy('preview');
      const res = await apiRequest<ReminderResponse>(`${ENDPOINTS.PAYMENTS.REMINDERS_RUN}?delay_minutes=${safeDelay}`);
      setReminderPreview(res);
      const count = Number(res.due_count ?? res.count ?? (Array.isArray(res.results) ? res.results.length : 0));
      toast.success(tr(`Preview ready: ${count} due reminders`, `Predprosmotr gotov: ${count}`, `Korish tayyor: ${count}`));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : tr('Failed to preview reminders', 'Ne udalos predprosmotret napominaniya', 'Eslatmalarni korib bolmadi'));
    } finally {
      setRemindersBusy(null);
    }
  };

  const runReminders = async () => {
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
      toast.success(tr(`Done: sent ${summary.sent || 0}, skipped ${summary.skipped || 0}`, `Gotovo: ${summary.sent || 0}/${summary.skipped || 0}`, `Bajarildi: ${summary.sent || 0}/${summary.skipped || 0}`));
      await loadTabData();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : tr('Failed to run reminders', 'Ne udalos zapustit napominaniya', 'Eslatmalarni ishga tushirib bolmadi'));
    } finally {
      setRemindersBusy(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-light-text dark:text-white">{t('nav_payments')}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{tr('Transactions, attempts, reminders and ambiguous queue', 'Tranzaktsii, popytki, napominaniya', 'Tranzaksiyalar, urinishlar, eslatmalar')}</p>
        </div>
        <button onClick={loadTabData} disabled={loading} className="inline-flex items-center gap-2 px-3 py-2 bg-white dark:bg-navy-800 border border-light-border dark:border-navy-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-navy-700 transition disabled:opacity-60">
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          <span className="text-sm">{tr('Refresh', 'Obnovit', 'Yangilash')}</span>
        </button>
      </div>

      <Card className="space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-800 dark:text-gray-100">
          <PlayCircle size={16} className="text-primary-blue" />
          <span>{tr('Transfer reminders operations', 'Operatsii napominaniy', 'Otkazma eslatmalari amallari')}</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-gray-600 dark:text-gray-300">{tr('Delay minutes', 'Zaderzhka (min)', 'Kechikish (daq)')}</span>
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
            <span className="text-gray-600 dark:text-gray-300">{tr('Run limit', 'Limit zapuska', 'Ishga tushirish limiti')}</span>
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
            <button onClick={previewReminders} disabled={remindersBusy !== null} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-light-border dark:border-navy-600 bg-white dark:bg-navy-900 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-navy-800 disabled:opacity-60">
              <Eye size={15} />
              {remindersBusy === 'preview' ? tr('Previewing...', 'Predprosmotr...', 'Korib chiqilmoqda...') : tr('Preview', 'Predprosmotr', 'Korish')}
            </button>
            <button onClick={runReminders} disabled={remindersBusy !== null} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-primary-blue bg-primary-blue text-white hover:bg-blue-700 disabled:opacity-60">
              <PlayCircle size={15} />
              {remindersBusy === 'run' ? tr('Running...', 'Zapusk...', 'Ishga tushmoqda...') : tr('Run now', 'Zapustit', 'Hozir ishga tushirish')}
            </button>
          </div>
        </div>
        {reminderPreview && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-lg border border-light-border dark:border-navy-700 p-3 bg-gray-50 dark:bg-navy-900/40">
              <p className="text-xs text-gray-500">{tr('Processed', 'Obrabotano', 'Qayta ishlangan')}</p>
              <p className="text-lg font-semibold">{reminderPreview.summary?.processed ?? 0}</p>
            </div>
            <div className="rounded-lg border border-light-border dark:border-navy-700 p-3 bg-gray-50 dark:bg-navy-900/40">
              <p className="text-xs text-gray-500">{tr('Sent', 'Otpravleno', 'Yuborilgan')}</p>
              <p className="text-lg font-semibold text-green-600">{reminderPreview.summary?.sent ?? 0}</p>
            </div>
            <div className="rounded-lg border border-light-border dark:border-navy-700 p-3 bg-gray-50 dark:bg-navy-900/40">
              <p className="text-xs text-gray-500">{tr('Skipped', 'Propushcheno', "Otkazib yuborilgan")}</p>
              <p className="text-lg font-semibold text-amber-600">{reminderPreview.summary?.skipped ?? 0}</p>
            </div>
            <div className="rounded-lg border border-light-border dark:border-navy-700 p-3 bg-gray-50 dark:bg-navy-900/40">
              <p className="text-xs text-gray-500">{tr('Errors', 'Oshibki', 'Xatolar')}</p>
              <p className="text-lg font-semibold text-red-600">{reminderPreview.summary?.errors?.length ?? 0}</p>
            </div>
          </div>
        )}
      </Card>

      <div className="flex gap-4 border-b border-light-border dark:border-navy-700">
        {[
          { key: 'transactions', label: tr('Transactions', 'Tranzaktsii', 'Tranzaksiyalar') },
          { key: 'attempts', label: tr('Payment Attempts', 'Popytki oplaty', "Tolov urinishlari") },
          { key: 'ambiguous', label: tr('Ambiguous Queue', 'Spornaia ochered', 'Noaniq navbat') },
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
                  <th className="px-6 py-4 font-semibold">{tr('Provider', 'Provayder', 'Provayder')}</th>
                  <th className="px-6 py-4 font-semibold">{tr('Amount', 'Summa', 'Summa')}</th>
                  <th className="px-6 py-4 font-semibold">{tr('Occurred', 'Vremya', 'Vaqt')}</th>
                  <th className="px-6 py-4 font-semibold">{tr('Link', 'Svyaz', 'Boglanish')}</th>
                  <th className="px-6 py-4 font-semibold text-right">{tr('Action', 'Deystvie', 'Amal')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-light-border dark:divide-navy-700">
                {loading && transactions.length === 0 ? (
                  <tr><td colSpan={5} className="py-10 text-center text-gray-500">{tr('Loading...', 'Zagruzka...', 'Yuklanmoqda...')}</td></tr>
                ) : transactions.length === 0 ? (
                  <tr><td colSpan={5} className="py-10 text-center text-gray-500">{tr('No transactions found', 'Tranzaktsii ne naydeny', 'Tranzaksiya topilmadi')}</td></tr>
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
                              <CheckCircle size={14} /> {tr('Linked to order', 'Privyazano k zakazu', "Buyurtmaga boglangan")}
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
                          <Badge variant="warning">{tr('Unlinked', 'Ne svyazano', "Boglanmagan")}</Badge>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="inline-flex items-center gap-3">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedTransaction(tx);
                            }}
                            className="inline-flex items-center gap-1 text-gray-600 dark:text-gray-300 hover:text-primary-blue text-sm font-medium"
                          >
                            <Info size={14} />
                            {tr('Details', 'Detalno', 'Batafsil')}
                          </button>
                          {!tx.linked_order_id && (
                            <>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openAttachModal(tx);
                                }}
                                className="inline-flex items-center gap-1 text-primary-blue dark:text-blue-300 hover:text-blue-700 dark:hover:text-blue-200 text-sm font-medium"
                              >
                                <Link2 size={14} />
                                {tr('Attach order', 'Privyazat zakaz', 'Buyurtmani boglash')}
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleAutoMatch(tx);
                                }}
                                disabled={matchingId === tx.id}
                                className="inline-flex items-center gap-1 text-primary-blue dark:text-blue-300 hover:text-blue-700 dark:hover:text-blue-200 text-sm font-medium disabled:opacity-50"
                              >
                                <Link2 size={14} />
                                {matchingId === tx.id ? tr('Matching...', 'Svyazka...', 'Boglanmoqda...') : tr('Auto match', 'Avto-svyaz', "Avto boglash")}
                              </button>
                            </>
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
                  <th className="px-6 py-4 font-semibold">{tr('Order', 'Zakaz', 'Buyurtma')}</th>
                  <th className="px-6 py-4 font-semibold">{tr('Amount', 'Summa', 'Summa')}</th>
                  <th className="px-6 py-4 font-semibold">{tr('Status', 'Status', 'Holat')}</th>
                  <th className="px-6 py-4 font-semibold">{tr('Provider hint', 'Podskazka provaydera', 'Provayder belgisi')}</th>
                  <th className="px-6 py-4 font-semibold">{tr('Reminder', 'Napominanie', 'Eslatma')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-light-border dark:divide-navy-700">
                {loading && attempts.length === 0 ? (
                  <tr><td colSpan={5} className="py-10 text-center text-gray-500">{tr('Loading...', 'Zagruzka...', 'Yuklanmoqda...')}</td></tr>
                ) : attempts.length === 0 ? (
                  <tr><td colSpan={5} className="py-10 text-center text-gray-500">{tr('No payment attempts found', 'Popytki oplaty ne naydeny', "Tolov urinishlari topilmadi")}</td></tr>
                ) : (
                  attempts.map((att) => (
                    <tr key={att.id} className="hover:bg-gray-50 dark:hover:bg-navy-700/50 transition-colors">
                      <td className="px-6 py-4">
                        <p className="text-xs font-mono text-gray-500">{(att.order_id || '').slice(0, 8) || '-'}</p>
                        <p className="text-xs text-gray-400">{formatDateTime(att.created_at, locale)}</p>
                      </td>
                      <td className="px-6 py-4 text-sm font-semibold text-gray-900 dark:text-white">{formatAmount(att.amount_uzs)}</td>
                      <td className="px-6 py-4">
                        <Badge variant={statusBadge(att.status || '')}>
                          {fieldValue(att.status)}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {fieldValue(att.provider_hint)}
                        {att.payer_card_last4 ? ` • ****${att.payer_card_last4}` : ''}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {att.payment_waiting_reminder_sent_at
                          ? formatDateTime(att.payment_waiting_reminder_sent_at, locale)
                          : tr('Not sent', 'Ne otpravleno', 'Yuborilmagan')}
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
                  <th className="px-6 py-4 font-semibold">{tr('Order / Client', 'Zakaz / Klient', 'Buyurtma / Mijoz')}</th>
                  <th className="px-6 py-4 font-semibold">{tr('Attempt', 'Popytka', 'Urinish')}</th>
                  <th className="px-6 py-4 font-semibold">{tr('Candidates', 'Kandidaty', 'Nomzodlar')}</th>
                  <th className="px-6 py-4 font-semibold">{tr('Latest audit', 'Posledniy audit', 'Songgi audit')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-light-border dark:divide-navy-700">
                {loading && ambiguousQueue.length === 0 ? (
                  <tr><td colSpan={4} className="py-10 text-center text-gray-500">{tr('Loading...', 'Zagruzka...', 'Yuklanmoqda...')}</td></tr>
                ) : ambiguousQueue.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-10 text-center text-gray-500">
                      <span className="inline-flex items-center gap-2">
                        <CheckCircle size={16} className="text-green-500" />
                        {tr('No ambiguous payments in queue', 'Spornykh platezhey net', "Noaniq tolovlar yoq")}
                      </span>
                    </td>
                  </tr>
                ) : (
                  ambiguousQueue.map((row, idx) => (
                    <tr key={`${row.payment_attempt?.id || row.order?.id || 'q'}-${idx}`} className="hover:bg-gray-50 dark:hover:bg-navy-700/50 transition-colors">
                      <td className="px-6 py-4">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{fieldValue(row.order?.client_name)}</p>
                        <p className="text-xs text-gray-500 font-mono">{(row.order?.id || '').slice(0, 8) || '-'}</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm font-semibold">{formatAmount(row.payment_attempt?.amount_uzs)}</p>
                        <div className="mt-1">
                          <Badge variant={statusBadge(row.payment_attempt?.status || 'NEEDS_ADMIN')}>
                            {fieldValue(row.payment_attempt?.status || 'NEEDS_ADMIN')}
                          </Badge>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm text-gray-800 dark:text-gray-100">{row.candidate_transactions?.length || 0}</p>
                        <p className="text-xs text-gray-500">{tr('possible matches', 'vozmozhnye sovpadeniya', 'mos tushishi mumkin')}</p>
                      </td>
                      <td className="px-6 py-4">
                        {row.latest_audit ? (
                          <div className="text-sm text-gray-700 dark:text-gray-200">
                            <div className="inline-flex items-center gap-1">
                              <AlertTriangle size={14} className="text-amber-500" />
                              <span>{fieldValue(row.latest_audit.status)}</span>
                            </div>
                            <p className="text-xs text-gray-500 mt-1">{fieldValue(row.latest_audit.reason)}</p>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-500">-</span>
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

      <Modal isOpen={!!attachTransaction} onClose={closeAttachModal} title={tr('Attach transaction to order', 'Privyazat tranzaktsiyu k zakazu', 'Tranzaksiyani buyurtmaga boglash')} maxWidthClass="max-w-2xl">
        {attachTransaction && (
          <div className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="rounded-lg border border-light-border dark:border-navy-700 p-3 bg-gray-50 dark:bg-navy-900/40">
                <p className="text-xs text-gray-500">{tr('Provider', 'Provayder', 'Provayder')}</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{fieldValue(attachTransaction.provider)}</p>
              </div>
              <div className="rounded-lg border border-light-border dark:border-navy-700 p-3 bg-gray-50 dark:bg-navy-900/40">
                <p className="text-xs text-gray-500">{tr('Amount', 'Summa', 'Summa')}</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{formatAmount(attachTransaction.amount_uzs)}</p>
              </div>
              <div className="rounded-lg border border-light-border dark:border-navy-700 p-3 bg-gray-50 dark:bg-navy-900/40">
                <p className="text-xs text-gray-500">{tr('Transaction status', 'Status tranzaktsii', 'Tranzaksiya holati')}</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{fieldValue(attachTransaction.status_text)}</p>
              </div>
            </div>

            <div className="rounded-lg border border-light-border dark:border-navy-700 p-4 space-y-3">
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">{tr('Order ID', 'ID zakaza', 'Buyurtma ID')}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{tr('Paste full order UUID to attach this transaction.', 'Vstavte polnyy UUID zakaza dlya privyazki etoy tranzaktsii.', 'Ushbu tranzaksiyani boglash uchun buyurtmaning toliq UUID sini kiriting.')}</p>
              </div>
              <input
                type="text"
                value={attachOrderId}
                onChange={(e) => setAttachOrderId(e.target.value)}
                placeholder={tr('Enter order UUID', 'Vvedite UUID zakaza', 'Buyurtma UUID sini kiriting')}
                className="w-full bg-white dark:bg-navy-900 border border-light-border dark:border-navy-600 rounded-lg px-3 py-2.5 text-sm text-gray-900 dark:text-white outline-none focus:border-primary-blue"
              />
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
                {tr('Cancel', 'Otmena', 'Bekor qilish')}
              </button>
              <button
                type="button"
                onClick={() => submitAttachOrder(false)}
                disabled={attaching}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-primary-blue bg-primary-blue text-white hover:bg-blue-700 disabled:opacity-60"
              >
                <Link2 size={15} />
                {attaching ? tr('Attaching...', 'Privyazka...', 'Boglanmoqda...') : tr('Attach to order', 'Privyazat k zakazu', 'Buyurtmaga boglash')}
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal isOpen={!!selectedTransaction} onClose={() => setSelectedTransaction(null)} title={tr('Transaction details', 'Detali tranzaktsii', 'Tranzaksiya tafsilotlari')} maxWidthClass="max-w-4xl">
        {selectedTransaction && (
          <div className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="rounded-lg border border-light-border dark:border-navy-700 p-3 bg-gray-50 dark:bg-navy-900/40">
                <p className="text-xs text-gray-500">{tr('Amount', 'Summa', 'Summa')}</p>
                <p className="text-lg font-semibold text-gray-900 dark:text-white">{formatAmount(selectedTransaction.amount_uzs)}</p>
              </div>
              <div className="rounded-lg border border-light-border dark:border-navy-700 p-3 bg-gray-50 dark:bg-navy-900/40">
                <p className="text-xs text-gray-500">{tr('Provider', 'Provayder', 'Provayder')}</p>
                <p className="text-lg font-semibold text-gray-900 dark:text-white">{fieldValue(selectedTransaction.provider)}</p>
              </div>
              <div className="rounded-lg border border-light-border dark:border-navy-700 p-3 bg-gray-50 dark:bg-navy-900/40">
                <p className="text-xs text-gray-500">{tr('Status', 'Status', 'Holat')}</p>
                <p className="text-lg font-semibold text-gray-900 dark:text-white">{fieldValue(selectedTransaction.status_text)}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg border border-light-border dark:border-navy-700 p-3"><p className="text-xs text-gray-500">{tr('Transaction ID', 'ID tranzaktsii', 'Tranzaksiya ID')}</p><p className="font-mono break-all text-gray-900 dark:text-white">{fieldValue(selectedTransaction.id)}</p></div>
              <div className="rounded-lg border border-light-border dark:border-navy-700 p-3"><p className="text-xs text-gray-500">{tr('Provider transaction ID', 'ID provaydera', 'Provayder tranzaksiya ID')}</p><p className="font-mono break-all text-gray-900 dark:text-white">{fieldValue(selectedTransaction.provider_transaction_id)}</p></div>
              <div className="rounded-lg border border-light-border dark:border-navy-700 p-3"><p className="text-xs text-gray-500">{tr('Occurred at', 'Vremya platezha', "Tolov vaqti")}</p><p className="text-gray-900 dark:text-white">{formatDateTime(selectedTransaction.occurred_at, locale)}</p></div>
              <div className="rounded-lg border border-light-border dark:border-navy-700 p-3"><p className="text-xs text-gray-500">{tr('Created at', 'Sozdano', 'Yaratilgan')}</p><p className="text-gray-900 dark:text-white">{formatDateTime(selectedTransaction.created_at, locale)}</p></div>
              <div className="rounded-lg border border-light-border dark:border-navy-700 p-3"><p className="text-xs text-gray-500">{tr('Sender card', 'Karta otpravitelya', 'Yuboruvchi karta')}</p><p className="text-gray-900 dark:text-white">{fieldValue(selectedTransaction.sender_card_masked || selectedTransaction.sender_card_last4)}</p></div>
              <div className="rounded-lg border border-light-border dark:border-navy-700 p-3"><p className="text-xs text-gray-500">{tr('Merchant card', 'Karta magazina', 'Qabul qiluvchi karta')}</p><p className="text-gray-900 dark:text-white">{fieldValue(selectedTransaction.merchant_card_last4)}</p></div>
              <div className="rounded-lg border border-light-border dark:border-navy-700 p-3"><p className="text-xs text-gray-500">{tr('Merchant name', 'Nazvanie magazina', 'Qabul qiluvchi nomi')}</p><p className="text-gray-900 dark:text-white">{fieldValue(selectedTransaction.merchant_name)}</p></div>
              <div className="rounded-lg border border-light-border dark:border-navy-700 p-3"><p className="text-xs text-gray-500">{tr('Payer name', 'Imya platelshchika', "Tolovchi ismi")}</p><p className="text-gray-900 dark:text-white">{fieldValue(selectedTransaction.payer_name)}</p></div>
              <div className="rounded-lg border border-light-border dark:border-navy-700 p-3"><p className="text-xs text-gray-500">{tr('Payer phone', 'Telefon platelshchika', "Tolovchi telefoni")}</p><p className="text-gray-900 dark:text-white">{fieldValue(selectedTransaction.payer_phone_masked)}</p></div>
              <div className="rounded-lg border border-light-border dark:border-navy-700 p-3">
                <p className="text-xs text-gray-500">{tr('Linked order', 'Svyazannyy zakaz', "Boglangan buyurtma")}</p>
                {selectedTransaction.linked_order_id ? (
                  <div className="mt-1 space-y-2">
                    <p className="text-gray-900 dark:text-white font-semibold">{formatOrderRef(selectedTransaction.linked_order_id)}</p>
                    <button
                      type="button"
                      onClick={() => openOrderPage(selectedTransaction.linked_order_id)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-light-border dark:border-navy-600 text-sm text-primary-blue dark:text-blue-300 hover:bg-gray-50 dark:hover:bg-navy-800"
                    >
                      <Link2 size={14} />
                      {tr('Open order', 'Otkryt zakaz', 'Buyurtmani ochish')}
                    </button>
                  </div>
                ) : (
                  <p className="font-mono break-all text-gray-900 dark:text-white">-</p>
                )}
              </div>
              <div className="rounded-lg border border-light-border dark:border-navy-700 p-3"><p className="text-xs text-gray-500">{tr('Source chat ID', 'ID chata istochnika', 'Manba chat ID')}</p><p className="font-mono break-all text-gray-900 dark:text-white">{fieldValue(selectedTransaction.source_chat_id)}</p></div>
              <div className="rounded-lg border border-light-border dark:border-navy-700 p-3"><p className="text-xs text-gray-500">{tr('Source message ID', 'ID soobshcheniya', 'Manba xabar ID')}</p><p className="font-mono break-all text-gray-900 dark:text-white">{fieldValue(selectedTransaction.source_message_id)}</p></div>
            </div>

            <div className="rounded-lg border border-light-border dark:border-navy-700 p-3">
              <p className="text-xs text-gray-500">{tr('Raw hash', 'Raw khesh', 'Raw hash')}</p>
              <p className="font-mono break-all text-gray-900 dark:text-white">{fieldValue(selectedTransaction.raw_hash)}</p>
            </div>

            <div className="rounded-lg border border-light-border dark:border-navy-700 p-3">
              <p className="text-xs text-gray-500 mb-2">{tr('Parsed payload', 'Razobrannyy payload', 'Ajratilgan payload')}</p>
              <pre className="text-xs leading-relaxed overflow-auto bg-gray-50 dark:bg-navy-900/40 rounded-lg p-3 text-gray-800 dark:text-gray-200">{JSON.stringify(selectedTransaction.parsed_payload || {}, null, 2)}</pre>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Payments;
