import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { useLanguage } from '../context/LanguageContext';
import { useToast } from '../context/ToastContext';
import { ENDPOINTS, apiRequest } from '../services/api';
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
  const [delayMinutes, setDelayMinutes] = useState(10);
  const [runLimit, setRunLimit] = useState(100);
  const [remindersBusy, setRemindersBusy] = useState<'preview' | 'run' | null>(null);
  const [reminderPreview, setReminderPreview] = useState<ReminderResponse | null>(null);

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
                          <Badge variant="success" className="flex w-max items-center gap-1">
                            <CheckCircle size={14} /> {tr('Linked', 'Svyazano', "Boglangan")}
                          </Badge>
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
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAutoMatch(tx);
                              }}
                              disabled={matchingId === tx.id}
                              className="inline-flex items-center gap-1 text-primary-blue hover:text-blue-700 text-sm font-medium disabled:opacity-50"
                            >
                              <Link2 size={14} />
                              {matchingId === tx.id ? tr('Matching...', 'Svyazka...', 'Boglanmoqda...') : tr('Auto match', 'Avto-svyaz', "Avto boglash")}
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
              <div className="rounded-lg border border-light-border dark:border-navy-700 p-3"><p className="text-xs text-gray-500">{tr('Linked order', 'Svyazannyy zakaz', "Boglangan buyurtma")}</p><p className="font-mono break-all text-gray-900 dark:text-white">{fieldValue(selectedTransaction.linked_order_id)}</p></div>
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
