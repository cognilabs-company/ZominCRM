import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';
import { Modal } from '../components/ui/Modal';
import { useActionConfirm } from '../components/ui/useActionConfirm';
import { ApiError, ENDPOINTS, apiRequest } from '../services/api';
import { useLanguage } from '../context/LanguageContext';
import { useToast } from '../context/ToastContext';
import {
  Edit2,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  UserRound,
  Phone,
  Send,
  Truck,
  MapPin,
  History,
} from 'lucide-react';

interface CourierBase {
  id: string;
  full_name: string;
  phone: string;
  telegram_user_id?: string | null;
  telegram_username?: string | null;
  is_active: boolean;
  created_at?: string;
}

interface CourierStats extends CourierBase {
  completed_orders?: number;
  active_orders?: number;
  total_orders?: number;
  last_event_at?: string | null;
}

interface ApiOrderSummary {
  id: string;
  client_id: string;
  client_name?: string | null;
  total_amount_uzs?: number;
  location_text?: string | null;
  delivery_time_requested?: string | null;
  created_at: string;
}

interface ApiCourierEvent {
  id: string;
  courier_id?: string | null;
  order_id?: string | null;
  event_type: string;
  meta?: Record<string, unknown>;
  created_at: string;
}

interface ListResponse<T> {
  ok?: boolean;
  count?: number;
  results?: T[];
}

interface CourierMutationResponse {
  ok?: boolean;
  courier?: CourierBase;
  deleted?: boolean;
  soft_deleted?: boolean;
}

type FormState = {
  full_name: string;
  phone: string;
  telegram_user_id: string;
  telegram_username: string;
  is_active: boolean;
};

type OpsTab = 'queue' | 'events';
type EventFilter = 'all' | 'active' | 'completed';

const emptyForm: FormState = {
  full_name: '',
  phone: '',
  telegram_user_id: '',
  telegram_username: '',
  is_active: true,
};

const Couriers: React.FC = () => {
  const { language } = useLanguage();
  const toast = useToast();
  const { confirm, confirmationModal } = useActionConfirm();
  const tr = useCallback(
    (en: string, ru: string, uz: string) => (language === 'ru' ? ru : language === 'uz' ? uz : en),
    [language]
  );

  const [rows, setRows] = useState<CourierStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState('');
  const [includeInactive, setIncludeInactive] = useState(false);
  const [limit, setLimit] = useState(100);

  const [queue, setQueue] = useState<ApiOrderSummary[]>([]);
  const [events, setEvents] = useState<ApiCourierEvent[]>([]);
  const [loadingOps, setLoadingOps] = useState(false);
  const [opsTab, setOpsTab] = useState<OpsTab>('events');
  const [eventFilter, setEventFilter] = useState<EventFilter>('all');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<CourierStats | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const buildCourierQuery = () => {
    const params = new URLSearchParams();
    if (query.trim()) params.set('q', query.trim());
    if (includeInactive) params.set('include_inactive', '1');
    params.set('limit', String(limit));
    return params.toString();
  };

  const loadCouriers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const qs = buildCourierQuery();
      const url = qs ? `${ENDPOINTS.COURIERS.STATS}?${qs}` : ENDPOINTS.COURIERS.STATS;
      const data = await apiRequest<ListResponse<CourierStats>>(url);
      setRows(data.results || []);
    } catch (e) {
      const message = e instanceof Error ? e.message : tr('Failed to load couriers', 'Failed to load couriers', "Kuryerlarni yuklab bo'lmadi");
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [includeInactive, limit, query, toast, tr]);

  const loadOperations = useCallback(async () => {
    try {
      setLoadingOps(true);
      const [queueRes, eventsRes] = await Promise.all([
        apiRequest<ListResponse<ApiOrderSummary>>(ENDPOINTS.COURIERS.QUEUE),
        apiRequest<ListResponse<ApiCourierEvent>>(ENDPOINTS.COURIERS.EVENTS),
      ]);
      setQueue(queueRes.results || []);
      setEvents(eventsRes.results || []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : tr('Failed to load courier operations', "Kuryer operatsiyalarini yuklab bo'lmadi"));
    } finally {
      setLoadingOps(false);
    }
  }, [toast, tr]);

  useEffect(() => {
    loadCouriers();
    loadOperations();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const refreshAll = async () => {
    await Promise.all([loadCouriers(), loadOperations()]);
  };

  const openCreate = () => {
    setEditingRow(null);
    setForm({ ...emptyForm, is_active: true });
    setIsModalOpen(true);
  };

  const openEdit = (row: CourierStats) => {
    setEditingRow(row);
    setForm({
      full_name: row.full_name || '',
      phone: row.phone || '',
      telegram_user_id: row.telegram_user_id || '',
      telegram_username: row.telegram_username || '',
      is_active: row.is_active !== false,
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;
    setIsModalOpen(false);
    setEditingRow(null);
    setForm(emptyForm);
  };

  const onChangeForm = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const buildPayload = () => {
    const payload: Record<string, unknown> = {
      full_name: form.full_name.trim(),
      is_active: form.is_active,
    };

    const phone = form.phone.trim();
    const tgId = form.telegram_user_id.trim();
    const tgUsername = form.telegram_username.trim();

    if (phone) payload.phone = phone;
    if (tgId) payload.telegram_user_id = tgId;
    if (tgUsername) payload.telegram_username = tgUsername;

    return payload;
  };

  const saveCourier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.full_name.trim()) {
      toast.warning(tr('Full name is required.', 'Full name is required.', "To'liq ism majburiy."));
      return;
    }

    if (editingRow) {
      const confirmed = await confirm({
        title: tr('Save courier changes', 'Save courier changes', "Kuryer o'zgarishlarini saqlash"),
        message: tr(
          `Save changes for "${editingRow.full_name}"?`,
          `Save changes for "${editingRow.full_name}"?`,
          `"${editingRow.full_name}" uchun o'zgarishlarni saqlaysizmi?`
        ),
        confirmLabel: tr('Save changes', 'Save changes', "O'zgarishlarni saqlash"),
        cancelLabel: tr('Cancel', 'Cancel', 'Bekor qilish'),
        tone: 'primary',
      });
      if (!confirmed) return;
    }

    try {
      setSaving(true);
      setError(null);
      const payload = buildPayload();
      const response = editingRow
        ? await apiRequest<CourierMutationResponse>(ENDPOINTS.COURIERS.DETAIL(editingRow.id), {
            method: 'PATCH',
            body: JSON.stringify(payload),
          })
        : await apiRequest<CourierMutationResponse>(ENDPOINTS.COURIERS.LIST, {
            method: 'POST',
            body: JSON.stringify(payload),
          });

      if (!response.courier) {
        throw new Error(tr('Invalid courier response', 'Invalid courier response', "Kuryer javobi noto'g'ri"));
      }

      toast.success(
        editingRow
          ? tr('Courier updated.', 'Courier updated.', 'Kuryer yangilandi.')
          : tr('Courier created.', 'Courier created.', 'Kuryer yaratildi.')
      );

      closeModal();
      await loadCouriers();
      await loadOperations();
    } catch (e) {
      if (e instanceof ApiError) {
        if (e.status === 409) {
          toast.error(tr('Duplicate phone or Telegram ID.', 'Duplicate phone or Telegram ID.', 'Telefon yoki Telegram ID takrorlangan.'));
          return;
        }
        if (e.status === 400) {
          toast.error(e.message || tr('Invalid courier data.', 'Invalid courier data.', "Kuryer ma'lumoti noto'g'ri."));
          return;
        }
      }
      const message = e instanceof Error ? e.message : tr('Failed to save courier', 'Failed to save courier', "Kuryerni saqlab bo'lmadi");
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const softDeleteCourier = async (row: CourierStats) => {
    const ok = await confirm({
      title: tr('Deactivate courier', 'Deactivate courier', 'Kuryerni nofaol qilish'),
      message: tr(
        `Deactivate courier "${row.full_name}"?`,
        `Deactivate courier "${row.full_name}"?`,
        `"${row.full_name}" kuryerni nofaol qilasizmi?`
      ),
      confirmLabel: tr('Deactivate', 'Deactivate', 'Nofaol qilish'),
      cancelLabel: tr('Cancel', 'Cancel', 'Bekor qilish'),
      tone: 'danger',
    });
    if (!ok) return;

    try {
      setDeletingId(row.id);
      await apiRequest<CourierMutationResponse>(ENDPOINTS.COURIERS.DETAIL(row.id), { method: 'DELETE' });
      toast.success(tr('Courier removed from active list.', 'Courier removed from active list.', "Kuryer faol ro'yxatdan chiqarildi."));
      await loadCouriers();
      await loadOperations();
    } catch (e) {
      const message = e instanceof Error ? e.message : tr('Failed to delete courier', 'Failed to delete courier', "Kuryerni o'chirib bo'lmadi");
      toast.error(message);
    } finally {
      setDeletingId(null);
    }
  };

  const totals = useMemo(
    () =>
      rows.reduce(
        (acc, row) => {
          acc.total += row.total_orders || 0;
          acc.active += row.active_orders || 0;
          acc.completed += row.completed_orders || 0;
          return acc;
        },
        { total: 0, active: 0, completed: 0 }
      ),
    [rows]
  );

  const courierNameMap = useMemo(() => {
    const map = new Map<string, string>();
    rows.forEach((r) => map.set(r.id, r.full_name || r.id));
    return map;
  }, [rows]);

  const filteredEvents = useMemo(() => {
    const activeTypes = new Set(['ACCEPTED', 'OUT_FOR_DELIVERY', 'ASSIGNED', 'DISPATCHED']);
    const completedTypes = new Set(['DELIVERED']);
    return events.filter((ev) => {
      if (eventFilter === 'all') return true;
      if (eventFilter === 'active') return activeTypes.has(ev.event_type);
      if (eventFilter === 'completed') return completedTypes.has(ev.event_type);
      return true;
    });
  }, [eventFilter, events]);

  const getEventVariant = (type: string) => {
    switch (type) {
      case 'DELIVERED':
        return 'success' as const;
      case 'ACCEPTED':
        return 'warning' as const;
      case 'OUT_FOR_DELIVERY':
      case 'ASSIGNED':
      case 'DISPATCHED':
      case 'BROADCASTED':
        return 'info' as const;
      case 'CANCELED':
      case 'REJECTED':
      case 'PROBLEM':
        return 'error' as const;
      default:
        return 'default' as const;
    }
  };

  const getEventTypeLabel = (type: string) => {
    const key = String(type || '').toUpperCase();
    const labels: Record<string, [string, string, string]> = {
      BROADCASTED: ['Broadcasted', 'Broadcasted', 'Kuryerlarga yuborildi'],
      ACCEPTED: ['Accepted', 'Accepted', 'Qabul qilingan'],
      ASSIGNED: ['Assigned', 'Assigned', 'Biriktirilgan'],
      DISPATCHED: ['Dispatched', 'Dispatched', "Jo'natilgan"],
      OUT_FOR_DELIVERY: ['Out for delivery', 'Out for delivery', 'Yetkazib berishda'],
      DELIVERED: ['Delivered', 'Delivered', 'Yetkazildi'],
      REJECTED: ['Rejected', 'Rejected', 'Rad etilgan'],
      CANCELED: ['Canceled', 'Canceled', 'Bekor qilingan'],
      PROBLEM: ['Problem', 'Problem', 'Muammo'],
    };
    const tuple = labels[key];
    return tuple ? tr(tuple[0], tuple[1], tuple[2]) : key;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
            <h1 className="text-2xl font-bold text-light-text dark:text-white">{tr('Couriers', 'Couriers', 'Kuryerlar')}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
              {tr('Courier profiles, stats, and order activity.', 'Courier profiles, stats, and order activity.', 'Kuryer profillari, statistikasi va buyurtma faoliyati.')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={refreshAll}
            disabled={loading || loadingOps}
            className="p-2 bg-white dark:bg-navy-800 border border-light-border dark:border-navy-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-navy-700 transition"
            title={tr('Refresh', 'Refresh', 'Yangilash')}
          >
            <RefreshCw size={18} className={loading || loadingOps ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={openCreate}
            className="px-4 py-2 bg-primary-blue hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors inline-flex items-center gap-2"
          >
            <Plus size={16} /> {tr('Add Courier', 'Add Courier', "Kuryer qo'shish")}
          </button>
        </div>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 text-red-700 px-4 py-3 text-sm">{error}</div>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <p className="text-xs uppercase tracking-wide text-gray-500">{tr('Total Orders', 'Total Orders', 'Jami buyurtmalar')}</p>
          <p className="mt-2 text-2xl font-bold text-light-text dark:text-white">{totals.total}</p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-wide text-gray-500">{tr('Active Orders', 'Active Orders', 'Faol buyurtmalar')}</p>
          <p className="mt-2 text-2xl font-bold text-light-text dark:text-white">{totals.active}</p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-wide text-gray-500">{tr('Completed Orders', 'Completed Orders', 'Tugatilgan buyurtmalar')}</p>
          <p className="mt-2 text-2xl font-bold text-light-text dark:text-white">{totals.completed}</p>
        </Card>
      </div>

      <Card className="!p-0 overflow-hidden">
        <div className="p-4 border-b border-light-border dark:border-navy-700 bg-white dark:bg-navy-800 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && loadCouriers()}
              placeholder={tr('Search courier...', 'Search courier...', 'Kuryerni qidirish...')}
              className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-navy-900 border border-light-border dark:border-navy-600 rounded-lg text-sm focus:outline-none focus:border-primary-blue dark:text-white"
            />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input type="checkbox" checked={includeInactive} onChange={(e) => setIncludeInactive(e.target.checked)} />
              {tr('Include inactive', 'Include inactive', "Nofaollarni ko'rsatish")}
            </label>
            <select
              value={String(limit)}
              onChange={(e) => setLimit(Number(e.target.value))}
              className="bg-gray-50 dark:bg-navy-900 border border-light-border dark:border-navy-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-blue dark:text-white"
            >
              {[50, 100, 200, 500].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
            <button
              onClick={loadCouriers}
              className="px-3 py-2 rounded-lg text-sm font-medium bg-white dark:bg-navy-900 border border-light-border dark:border-navy-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-navy-700"
            >
              {tr('Apply', 'Apply', "Qo'llash")}
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 dark:bg-navy-900/50 text-xs uppercase text-gray-500 dark:text-gray-400 border-b border-light-border dark:border-navy-700">
                <th className="px-6 py-4 font-semibold">{tr('Courier', 'Courier', 'Kuryer')}</th>
                <th className="px-6 py-4 font-semibold">{tr('Telegram', 'Telegram', 'Telegram')}</th>
                <th className="px-6 py-4 font-semibold text-center">{tr('Active', 'Active', 'Faol')}</th>
                <th className="px-6 py-4 font-semibold text-center">{tr('Completed', 'Completed', 'Tugagan')}</th>
                <th className="px-6 py-4 font-semibold text-center">{tr('Total', 'Total', 'Jami')}</th>
                <th className="px-6 py-4 font-semibold">{tr('Last Event', 'Last Event', 'Oxirgi hodisa')}</th>
                <th className="px-6 py-4 font-semibold">{tr('Status', 'Status', 'Holat')}</th>
                <th className="px-6 py-4 font-semibold text-right">{tr('Actions', 'Actions', 'Amallar')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-light-border dark:divide-navy-700">
              {loading && rows.length === 0 && (
                <tr><td colSpan={8} className="px-6 py-10 text-center text-gray-500">{tr('Loading couriers...', 'Loading couriers...', 'Kuryerlar yuklanmoqda...')}</td></tr>
              )}
              {!loading && rows.length === 0 && (
                <tr><td colSpan={8} className="px-6 py-10 text-center text-gray-500">{tr('No couriers found.', 'No couriers found.', 'Kuryerlar topilmadi.')}</td></tr>
              )}
              {rows.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50 dark:hover:bg-navy-700/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/20 text-blue-600 flex items-center justify-center">
                        <UserRound size={18} />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{row.full_name || '-'}</p>
                        <div className="flex items-center gap-1 text-xs text-gray-500">
                          <Phone size={12} />
                          <span>{row.phone || '-'}</span>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-700 dark:text-gray-300">
                      <div className="inline-flex items-center gap-1">
                        <Send size={13} className="text-gray-400" />
                        <span>{row.telegram_username ? `@${row.telegram_username}` : '-'}</span>
                      </div>
                      <p className="text-xs font-mono text-gray-500 mt-1">{row.telegram_user_id || '-'}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-center font-semibold text-gray-900 dark:text-white">{row.active_orders ?? 0}</td>
                  <td className="px-6 py-4 text-sm text-center font-semibold text-gray-900 dark:text-white">{row.completed_orders ?? 0}</td>
                  <td className="px-6 py-4 text-sm text-center font-semibold text-gray-900 dark:text-white">{row.total_orders ?? 0}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{row.last_event_at ? new Date(row.last_event_at).toLocaleString() : '-'}</td>
                  <td className="px-6 py-4">
                    <Badge variant={row.is_active ? 'success' : 'default'} dot>
                      {row.is_active ? tr('Active', 'Active', 'Faol') : tr('Inactive', 'Inactive', 'Nofaol')}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="inline-flex items-center gap-2">
                      <button onClick={() => openEdit(row)} className="p-1.5 text-gray-500 dark:text-gray-300 hover:text-primary-blue dark:hover:text-blue-400 transition-colors" title={tr('Edit', 'Edit', 'Tahrirlash')}>
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => softDeleteCourier(row)}
                        disabled={deletingId === row.id || row.is_active === false}
                        className="p-1.5 text-gray-500 dark:text-gray-300 hover:text-red-600 dark:hover:text-red-400 transition-colors disabled:opacity-40"
                        title={tr('Remove from active list', 'Remove from active list', "Faol ro'yxatdan chiqarish")}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="!p-0 overflow-hidden">
        <div className="p-4 border-b border-light-border dark:border-navy-700 bg-white dark:bg-navy-800 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-light-text dark:text-white">{tr('Courier Operations', 'Courier Operations', 'Kuryer operatsiyalari')}</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {tr('See who is handling which orders and who completed them.', 'See who is handling which orders and who completed them.', "Qaysi buyurtmani kim bajarayotgani va kim yakunlaganini ko'ring.")}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setOpsTab('queue')}
              className={`px-3 py-1.5 rounded-lg text-sm border ${opsTab === 'queue' ? 'bg-primary-blue text-white border-primary-blue' : 'bg-white dark:bg-navy-900 border-light-border dark:border-navy-600 text-gray-700 dark:text-gray-200'}`}
            >
              {tr('Queue', 'Queue', 'Navbat')}
            </button>
            <button
              onClick={() => setOpsTab('events')}
              className={`px-3 py-1.5 rounded-lg text-sm border ${opsTab === 'events' ? 'bg-primary-blue text-white border-primary-blue' : 'bg-white dark:bg-navy-900 border-light-border dark:border-navy-600 text-gray-700 dark:text-gray-200'}`}
            >
              {tr('History', 'History', 'Tarix')}
            </button>
          </div>
        </div>

        {opsTab === 'queue' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 dark:bg-navy-900/50 text-xs uppercase text-gray-500 dark:text-gray-400 border-b border-light-border dark:border-navy-700">
                  <th className="px-6 py-4 font-semibold">{tr('Order', 'Order', 'Buyurtma')}</th>
                  <th className="px-6 py-4 font-semibold">{tr('Address', 'Address', 'Manzil')}</th>
                  <th className="px-6 py-4 font-semibold">{tr('Total (UZS)', 'Total (UZS)', 'Jami (UZS)')}</th>
                  <th className="px-6 py-4 font-semibold">{tr('Created', 'Created', 'Yaratilgan')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-light-border dark:divide-navy-700">
                {loadingOps && queue.length === 0 ? (
                  <tr><td colSpan={4} className="py-10 text-center text-gray-500">{tr('Loading queue...', 'Loading queue...', 'Navbat yuklanmoqda...')}</td></tr>
                ) : queue.length === 0 ? (
                  <tr><td colSpan={4} className="py-10 text-center text-gray-500">{tr('Queue is empty.', 'Queue is empty.', "Navbat bo'sh.")}</td></tr>
                ) : (
                  queue.map((order) => (
                    <tr key={order.id} className="hover:bg-gray-50 dark:hover:bg-navy-700/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30">
                            <Truck size={18} />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900 dark:text-white">{order.client_name || order.client_id?.slice(0, 8) || '-'}</p>
                            <p className="text-xs font-mono text-gray-500">#{order.id.slice(0, 8)}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                          <MapPin size={14} className="text-gray-400 shrink-0" />
                          <span className="line-clamp-1">{order.location_text || '-'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm font-semibold text-gray-900 dark:text-white">{(order.total_amount_uzs || 0).toLocaleString()}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">{new Date(order.created_at).toLocaleString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {opsTab === 'events' && (
          <div>
            <div className="px-4 py-3 border-b border-light-border dark:border-navy-700 flex flex-wrap items-center gap-2 bg-white dark:bg-navy-800">
              {([
                ['all', tr('All events', 'All events', 'Barcha hodisalar')],
                ['active', tr('Active work', 'Active work', 'Faol ish')],
                ['completed', tr('Completed', 'Completed', 'Yakunlangan')],
              ] as Array<[EventFilter, string]>).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setEventFilter(key)}
                  className={`px-3 py-1.5 rounded-lg text-sm border ${eventFilter === key ? 'bg-primary-blue text-white border-primary-blue' : 'bg-white dark:bg-navy-900 border-light-border dark:border-navy-600 text-gray-700 dark:text-gray-200'}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 dark:bg-navy-900/50 text-xs uppercase text-gray-500 dark:text-gray-400 border-b border-light-border dark:border-navy-700">
                    <th className="px-6 py-4 font-semibold">{tr('Event', 'Event', 'Hodisa')}</th>
                    <th className="px-6 py-4 font-semibold">{tr('Order', 'Order', 'Buyurtma')}</th>
                    <th className="px-6 py-4 font-semibold">{tr('Courier', 'Courier', 'Kuryer')}</th>
                    <th className="px-6 py-4 font-semibold">{tr('Time', 'Time', 'Vaqt')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-light-border dark:divide-navy-700">
                  {loadingOps && events.length === 0 ? (
                    <tr><td colSpan={4} className="py-10 text-center text-gray-500">{tr('Loading events...', 'Loading events...', 'Hodisalar yuklanmoqda...')}</td></tr>
                  ) : filteredEvents.length === 0 ? (
                    <tr><td colSpan={4} className="py-10 text-center text-gray-500">{tr('No events in this filter.', 'No events in this filter.', "Bu filtrda hodisalar yo'q.")}</td></tr>
                  ) : (
                    filteredEvents.map((ev) => (
                      <tr key={ev.id} className="hover:bg-gray-50 dark:hover:bg-navy-700/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-gray-100 dark:bg-navy-900/50 text-gray-500">
                              <History size={16} />
                            </div>
                            <div className="flex flex-col gap-1">
                              <Badge variant={getEventVariant(ev.event_type)}>{getEventTypeLabel(ev.event_type)}</Badge>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300 font-mono">{ev.order_id ? `#${ev.order_id.slice(0, 8)}` : '-'}</td>
                        <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">
                          {ev.courier_id ? (courierNameMap.get(ev.courier_id) || `ID: ${ev.courier_id.slice(0, 8)}`) : '-'}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">{new Date(ev.created_at).toLocaleString()}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Card>

      <Modal isOpen={isModalOpen} onClose={closeModal} title={editingRow ? tr('Edit Courier', 'Edit Courier', 'Kuryerni tahrirlash') : tr('Add Courier', 'Add Courier', "Kuryer qo'shish")} footer={null}>
        <form onSubmit={saveCourier} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{tr('Full Name', 'Full Name', "To'liq ism")} *</label>
              <input value={form.full_name} onChange={(e) => onChangeForm('full_name', e.target.value)} required className="w-full bg-gray-50 dark:bg-navy-900 border border-light-border dark:border-navy-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-blue dark:text-white" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{tr('Phone', 'Phone', 'Telefon')}</label>
              <input value={form.phone} onChange={(e) => onChangeForm('phone', e.target.value)} placeholder="+998901234567" className="w-full bg-gray-50 dark:bg-navy-900 border border-light-border dark:border-navy-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-blue dark:text-white" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Telegram ID</label>
              <input value={form.telegram_user_id} onChange={(e) => onChangeForm('telegram_user_id', e.target.value)} placeholder="123456789" className="w-full bg-gray-50 dark:bg-navy-900 border border-light-border dark:border-navy-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-blue dark:text-white" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Telegram Username</label>
              <input value={form.telegram_username} onChange={(e) => onChangeForm('telegram_username', e.target.value.replace(/^@/, ''))} placeholder="courier_username" className="w-full bg-gray-50 dark:bg-navy-900 border border-light-border dark:border-navy-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-blue dark:text-white" />
              <p className="text-xs text-gray-500 mt-1">{tr('Phone can be empty if Telegram ID is provided (backend will generate tgid-...).', 'Phone can be empty if Telegram ID is provided (backend will generate tgid-...).', "Telegram ID bo'lsa telefon bo'sh qolishi mumkin (backend tgid-... yaratadi).")}</p>
            </div>
            <div className="md:col-span-2">
              <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <input type="checkbox" checked={form.is_active} onChange={(e) => onChangeForm('is_active', e.target.checked)} />
                {tr('Active courier', 'Active courier', 'Faol kuryer')}
              </label>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={closeModal}
              className="px-4 py-2 rounded-lg text-sm border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 dark:border-red-800/60 dark:bg-red-950/30 dark:text-red-300 dark:hover:bg-red-900/30 transition-colors"
            >
              {tr('Cancel', 'Cancel', 'Bekor qilish')}
            </button>
            <button disabled={saving} type="submit" className="px-4 py-2 rounded-lg text-sm font-medium bg-primary-blue text-white hover:bg-blue-600 transition-colors disabled:opacity-50">
              {saving ? tr('Saving...', 'Saving...', 'Saqlanmoqda...') : editingRow ? tr('Save Changes', 'Save Changes', "O'zgarishlarni saqlash") : tr('Create Courier', 'Create Courier', 'Kuryer yaratish')}
            </button>
          </div>
        </form>
      </Modal>
      {confirmationModal}
    </div>
  );
};

export default Couriers;
