import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { Card } from '../components/ui/Card';
import { Modal } from '../components/ui/Modal';
import { useToast } from '../context/ToastContext';
import { ShoppingBag, DollarSign, Clock, Truck, Download, RefreshCw, Calendar, Search, Languages, Phone, UserRound, CheckCircle2, AlertTriangle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid } from 'recharts';
import { ENDPOINTS, apiRequest, getHeaders } from '../services/api';

interface DashboardStatsResponse {
  date_from?: string;
  date_to?: string;
  days?: number;
  total_orders?: number;
  successful_orders?: number;
  unsuccessful_orders?: number;
  pending_orders?: number;
  canceled_orders?: number;
  failed_orders?: number;
  order_status_counts?: Partial<Record<string, number>>;
  revenue_period?: number;
  revenue_today?: number;
  revenue_today_actual?: number;
  pending_payments?: number;
  pending_payments_amount?: number;
  pending_payments_snapshot?: number;
  pending_payments_amount_snapshot?: number;
  in_delivery?: number;
  in_delivery_snapshot?: number;
  deposit_held_total_uzs?: number;
  deposit_held_total_bottles_count?: number;
  deposit_holders_count?: number;
  deposit_held_uzs?: number;
  bottle_deposit_held_uzs?: number;
  deposit_charged_period_uzs?: number;
  deposit_charged_uzs?: number;
  bottle_deposit_charged_period_uzs?: number;
  bottle_deposit_charged_uzs?: number;
  deposit_refunded_period_uzs?: number;
  deposit_refunded_uzs?: number;
  bottle_deposit_refunded_period_uzs?: number;
  bottle_deposit_refunded_uzs?: number;
  orders_trend?: unknown;
  revenue_trend?: unknown;
  recent_activity?: Array<{
    id: string;
    user?: string;
    text?: string;
    status?: string;
    updated_at?: string;
  }>;
}

interface DashboardDepositBalance {
  id: string;
  client_id: string;
  product_id: string;
  product_name: string;
  product_sku?: string;
  product_size_liters?: string | number | null;
  requires_returnable_bottle?: boolean;
  bottle_deposit_uzs?: number;
  outstanding_bottles_count: number;
  deposit_held_uzs: number;
  total_deposit_charged_uzs: number;
  total_deposit_refunded_uzs: number;
  updated_at?: string;
}

interface DashboardDepositClientRow {
  client_id: string;
  client_name: string;
  client_phone?: string | null;
  client_username?: string | null;
  client_platform?: string | null;
  client_preferred_language?: string | null;
  balances_count: number;
  total_outstanding_bottles_count: number;
  deposit_held_total_uzs: number;
  total_deposit_charged_uzs: number;
  total_deposit_refunded_uzs: number;
  last_updated_at?: string | null;
  balances: DashboardDepositBalance[];
}

interface DashboardDepositsResponse {
  summary?: {
    client_count?: number;
    total_outstanding_bottles_count?: number;
    total_deposit_held_uzs?: number;
    total_deposit_charged_uzs?: number;
    total_deposit_refunded_uzs?: number;
  };
  count?: number;
  total?: number;
  limit?: number;
  offset?: number;
  results?: DashboardDepositClientRow[];
}

type DashboardFilterMode = 'weekly' | 'monthly' | 'date' | 'range';

type TrendPoint = {
  name: string;
  value: number;
};

const toText = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  return String(value);
};

const toNumber = (value: unknown): number => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') {
    const cleaned = value.replace(/[\s,]/g, '').replace(/[^0-9.-]/g, '');
    if (!cleaned) return 0;
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

const isLikelyDateString = (value: string): boolean => /^\d{4}-\d{2}-\d{2}/.test(value.trim());

const extractNumeric = (value: unknown): number | null => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;

  if (typeof value === 'string') {
    if (isLikelyDateString(value)) return null;
    const cleaned = value.replace(/[\s,]/g, '').replace(/[^0-9.-]/g, '');
    if (!cleaned) return null;
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const candidate = extractNumeric(item);
      if (candidate !== null) return candidate;
    }
    return null;
  }

  if (value && typeof value === 'object') {
    const row = value as Record<string, unknown>;
    const preferred = ['value', 'count', 'amount', 'amount_uzs', 'orders', 'revenue', 'revenue_uzs', 'total', 'y'];

    for (const key of preferred) {
      if (row[key] === undefined) continue;
      const candidate = extractNumeric(row[key]);
      if (candidate !== null) return candidate;
    }

    for (const [key, item] of Object.entries(row)) {
      if (['name', 'label', 'date', 'day', 'period', 'x', 'created_at', 'updated_at'].includes(key)) continue;
      const candidate = extractNumeric(item);
      if (candidate !== null) return candidate;
    }
  }

  return null;
};

const toTrendRows = (source: unknown): unknown[] => {
  if (Array.isArray(source)) return source;
  if (!source || typeof source !== 'object') return [];

  const obj = source as Record<string, unknown>;
  if (Array.isArray(obj.results)) return obj.results;
  if (Array.isArray(obj.data)) return obj.data;
  if (Array.isArray(obj.items)) return obj.items;
  if (Array.isArray(obj.trend)) return obj.trend;

  if (Array.isArray(obj.labels)) {
    const labels = obj.labels;
    let values: unknown[] = [];

    if (Array.isArray(obj.values)) {
      values = obj.values;
    } else if (Array.isArray(obj.series)) {
      const firstSeries = obj.series[0];
      if (Array.isArray(firstSeries)) {
        values = firstSeries;
      } else if (firstSeries && typeof firstSeries === 'object') {
        const seriesObj = firstSeries as Record<string, unknown>;
        if (Array.isArray(seriesObj.data)) values = seriesObj.data;
        else if (Array.isArray(seriesObj.values)) values = seriesObj.values;
      }
    }

    return labels.map((label, idx) => ({ label, value: values[idx] }));
  }

  for (const value of Object.values(obj)) {
    if (Array.isArray(value)) return value;
  }

  return Object.entries(obj).map(([label, value]) => ({ label, value }));
};

const normalizeLabel = (raw: unknown, index: number): string => {
  const text = toText(raw).trim();
  if (!text) return `#${index + 1}`;

  const dt = new Date(text);
  if (!Number.isNaN(dt.getTime()) && text.includes('-')) {
    const mm = String(dt.getMonth() + 1).padStart(2, '0');
    const dd = String(dt.getDate()).padStart(2, '0');
    return `${mm}-${dd}`;
  }

  return text;
};

const normalizeTrend = (source: unknown, preferredKeys: string[]): TrendPoint[] => {
  const rows = toTrendRows(source);

  return rows
    .map((entry, index) => {
      if (entry === null || entry === undefined) return null;

      if (typeof entry === 'number' || typeof entry === 'string') {
        return { name: `#${index + 1}`, value: toNumber(entry) };
      }

      if (Array.isArray(entry)) {
        const label = entry[0];
        const value = entry.length > 1 ? extractNumeric(entry[1]) : extractNumeric(entry);
        return {
          name: normalizeLabel(label, index),
          value: value ?? 0,
        };
      }

      if (typeof entry !== 'object') return null;

      const row = entry as Record<string, unknown>;
      const key = preferredKeys.find((k) => row[k] !== undefined);
      const primaryValue = key ? extractNumeric(row[key]) : null;
      const fallbackValue = primaryValue !== null ? primaryValue : extractNumeric(row);

      return {
        name: normalizeLabel(
          row.name ?? row.label ?? row.date ?? row.day ?? row.period ?? row.x ?? row.created_at ?? row.updated_at,
          index
        ),
        value: fallbackValue ?? 0,
      };
    })
    .filter((point): point is TrendPoint => Boolean(point));
};

const pickMetric = (source: DashboardStatsResponse, keys: string[]): number | null => {
  for (const key of keys) {
    const candidate = (source as Record<string, unknown>)[key];
    if (candidate !== undefined) return toNumber(candidate);
  }
  return null;
};

const hasMetric = (source: DashboardStatsResponse, keys: string[]): boolean =>
  keys.some((key) => Object.prototype.hasOwnProperty.call(source, key));

const ORDER_STATUS_BREAKDOWN_ORDER = [
  'NEW_LEAD',
  'INFO_COLLECTED',
  'PAYMENT_PENDING',
  'PAYMENT_CONFIRMED',
  'DISPATCHED',
  'ASSIGNED',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'CANCELED',
  'FAILED',
] as const;

const PENDING_ORDER_STATUSES = [
  'NEW_LEAD',
  'INFO_COLLECTED',
  'PAYMENT_PENDING',
  'PAYMENT_CONFIRMED',
  'DISPATCHED',
  'ASSIGNED',
  'OUT_FOR_DELIVERY',
].join(',');

const DELIVERY_RELATED_STATUSES = ['DISPATCHED', 'ASSIGNED', 'OUT_FOR_DELIVERY'].join(',');

const Dashboard: React.FC = () => {
  const { t, language } = useLanguage();
  const toast = useToast();
  const navigate = useNavigate();
  const tr = useCallback(
    (en: string, ru: string, uz: string) => (language === 'ru' ? ru : language === 'uz' ? uz : en),
    [language]
  );

  const todayIso = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const hasInitialLoadRef = useRef(false);

  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<DashboardStatsResponse>({});

  const [filterMode, setFilterMode] = useState<DashboardFilterMode>('date');
  const [singleDate, setSingleDate] = useState(todayIso);
  const [dateFrom, setDateFrom] = useState(todayIso);
  const [dateTo, setDateTo] = useState(todayIso);
  const [depositsModalOpen, setDepositsModalOpen] = useState(false);
  const [depositSearch, setDepositSearch] = useState('');
  const [depositsLoading, setDepositsLoading] = useState(false);
  const [depositsError, setDepositsError] = useState<string | null>(null);
  const [depositsData, setDepositsData] = useState<DashboardDepositsResponse>({});
  const [depositsOffset, setDepositsOffset] = useState(0);

  const validateFilters = useCallback(() => {
    if (filterMode === 'date' && !singleDate) {
      toast.warning(tr('Please select a date.', 'Please select a date.', 'Sanani tanlang.'));
      return false;
    }

    if (filterMode === 'range') {
      if (!dateFrom || !dateTo) {
        toast.warning(tr('Please select date range.', 'Please select date range.', 'Sana oraligini tanlang.'));
        return false;
      }
      if (dateFrom > dateTo) {
        toast.warning(
          tr(
            'Start date cannot be later than end date.',
            'Data nachala ne mozhet byt pozhe daty okonchaniya.',
            'Boshlanish sanasi tugash sanasidan keyin bolmasligi kerak.'
          )
        );
        return false;
      }
    }

    return true;
  }, [dateFrom, dateTo, filterMode, singleDate, toast, tr]);

  const buildQuery = useCallback(() => {
    const params = new URLSearchParams();

    if (filterMode === 'weekly') params.set('days', '7');
    if (filterMode === 'monthly') params.set('days', '30');
    if (filterMode === 'date') params.set('date', singleDate);
    if (filterMode === 'range') {
      params.set('date_from', dateFrom);
      params.set('date_to', dateTo);
    }

    return params.toString();
  }, [dateFrom, dateTo, filterMode, singleDate]);

  const withQuery = useCallback(
    (base: string) => {
      const query = buildQuery();
      return query ? `${base}?${query}` : base;
    },
    [buildQuery]
  );

  const loadStats = useCallback(async () => {
    if (!validateFilters()) return;

    try {
      setLoading(true);
      setError(null);
      const data = await apiRequest<DashboardStatsResponse>(withQuery(ENDPOINTS.DASHBOARD.STATS));
      setStats(data || {});
    } catch (e) {
      const message = e instanceof Error ? e.message : tr('Failed to load dashboard', 'Failed to load dashboard', 'Bosh sahifani yuklab bolmadi');
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [toast, tr, validateFilters, withQuery]);

  const downloadStats = useCallback(async () => {
    if (!validateFilters()) return;

    try {
      setDownloading(true);
      const response = await fetch(withQuery(ENDPOINTS.DASHBOARD.STATS_EXPORT), {
        method: 'GET',
        headers: {
          ...getHeaders(true),
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `Export failed (${response.status})`);
      }

      const blob = await response.blob();
      const disposition = response.headers.get('content-disposition') || '';
      const match = disposition.match(/filename=\"?([^\";]+)\"?/i);
      const filename = match?.[1] || `dashboard_stats_${todayIso}.xls`;

      const objectUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(objectUrl);

      toast.success(tr('Dashboard export downloaded.', 'Dashboard export downloaded.', 'Dashboard hisoboti yuklab olindi.'));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : tr('Failed to download export.', 'Failed to download export.', 'Eksportni yuklab bolmadi.'));
    } finally {
      setDownloading(false);
    }
  }, [todayIso, toast, tr, validateFilters, withQuery]);

  const loadDeposits = useCallback(async (offset = 0, append = false) => {
    try {
      setDepositsLoading(true);
      if (!append) {
        setDepositsError(null);
      }

      const params = new URLSearchParams();
      params.set('limit', '50');
      params.set('offset', String(offset));
      if (depositSearch.trim()) {
        params.set('q', depositSearch.trim());
      }

      const data = await apiRequest<DashboardDepositsResponse>(`${ENDPOINTS.DASHBOARD.DEPOSITS}?${params.toString()}`);
      setDepositsData((prev) => ({
        ...data,
        results: append ? [...(prev.results || []), ...(data.results || [])] : (data.results || []),
      }));
      setDepositsOffset(offset);
    } catch (e) {
      const message = e instanceof Error ? e.message : tr('Failed to load deposits.', 'Failed to load deposits.', 'Depozit tafsilotlarini yuklab bolmadi.');
      setDepositsError(message);
      if (!append) {
        setDepositsData({});
      }
    } finally {
      setDepositsLoading(false);
    }
  }, [depositSearch, tr]);

  useEffect(() => {
    if (hasInitialLoadRef.current) return;
    hasInitialLoadRef.current = true;
    loadStats();
  }, [loadStats]);

  useEffect(() => {
    if (!depositsModalOpen) return;
    const timeoutId = window.setTimeout(() => {
      void loadDeposits(0, false);
    }, 250);
    return () => window.clearTimeout(timeoutId);
  }, [depositSearch, depositsModalOpen, loadDeposits]);

  // Auto-reload when the filter mode changes (after initial load)
  const filterModeRef = useRef(filterMode);
  useEffect(() => {
    if (!hasInitialLoadRef.current) return; // skip before first load
    if (filterMode === filterModeRef.current) return;
    filterModeRef.current = filterMode;
    // Auto-load for weekly/monthly and date mode (date input already has a value)
    // Range mode still waits for explicit Load because users usually change two fields.
    if (filterMode === 'weekly' || filterMode === 'monthly' || filterMode === 'date') {
      loadStats();
    }
  }, [filterMode, loadStats]);

  const orderTrendRaw = useMemo(
    () => normalizeTrend(stats.orders_trend, ['orders', 'count', 'value', 'total_orders', 'y']),
    [stats.orders_trend]
  );

  const revenueTrendRaw = useMemo(
    () => normalizeTrend(stats.revenue_trend, ['revenue', 'amount', 'amount_uzs', 'value', 'total', 'revenue_uzs', 'y']),
    [stats.revenue_trend]
  );

  const orderTrend = useMemo(() => {
    if (orderTrendRaw.length === 1) {
      const p = orderTrendRaw[0];
      return [p, { ...p, name: `${p.name} ` }];
    }
    return orderTrendRaw;
  }, [orderTrendRaw]);

  const revenueTrend = useMemo(() => {
    if (revenueTrendRaw.length === 1) {
      const p = revenueTrendRaw[0];
      return [p, { ...p, name: `${p.name} ` }];
    }
    return revenueTrendRaw;
  }, [revenueTrendRaw]);

  const revenueDomain = useMemo<[number, number]>(() => {
    if (revenueTrend.length === 0) return [0, 1];
    const values = revenueTrend.map((p) => p.value);
    const min = Math.min(...values);
    const max = Math.max(...values);

    if (min === max) {
      const pad = Math.max(Math.abs(min) * 0.1, 1);
      return [Math.max(0, min - pad), max + pad];
    }

    const spreadPad = Math.max((max - min) * 0.1, 1);
    return [Math.max(0, min - spreadPad), max + spreadPad];
  }, [revenueTrend]);

  const loadedRange = useMemo(() => {
    if (stats.date_from || stats.date_to) return `${stats.date_from || '-'} - ${stats.date_to || '-'}`;
    if (filterMode === 'weekly') return tr('Last 7 days', 'Last 7 days', 'Oxirgi 7 kun');
    if (filterMode === 'monthly') return tr('Last 30 days', 'Last 30 days', 'Oxirgi 30 kun');
    if (filterMode === 'date') return singleDate;
    return `${dateFrom} - ${dateTo}`;
  }, [dateFrom, dateTo, filterMode, singleDate, stats.date_from, stats.date_to, tr]);

  // Dynamic chart titles based on filter mode
  const ordersTrendTitle = useMemo(() => {
    if (filterMode === 'weekly') return tr('Orders Trend (Weekly)', 'Orders Trend (Weekly)', 'Buyurtmalar trendi (Haftalik)');
    if (filterMode === 'monthly') return tr('Orders Trend (Monthly)', 'Orders Trend (Monthly)', 'Buyurtmalar trendi (Oylik)');
    if (filterMode === 'date') return tr('Orders Trend (Today)', 'Orders Trend (Today)', 'Buyurtmalar trendi (Bugun)');
    return tr('Orders Trend', 'Orders Trend', 'Buyurtmalar trendi');
  }, [filterMode, tr]);

  const revenueTrendTitle = useMemo(() => {
    if (filterMode === 'weekly') return tr('Weekly Revenue', 'Weekly Revenue', 'Haftalik tushum');
    if (filterMode === 'monthly') return tr('Monthly Revenue', 'Monthly Revenue', 'Oylik tushum');
    if (filterMode === 'date') return tr('Today\'s Revenue', 'Today\'s Revenue', 'Bugungi tushum');
    return tr('Revenue Trend', 'Revenue Trend', 'Tushum trendi');
  }, [filterMode, tr]);

  const showCharts = true;
  const revenuePeriodValue = stats.revenue_period ?? stats.revenue_today ?? 0;
  const depositHeldValue = pickMetric(stats, ['deposit_held_total_uzs', 'deposit_held_uzs', 'bottle_deposit_held_uzs']) ?? 0;
  const depositHeldBottlesCount = pickMetric(stats, ['deposit_held_total_bottles_count']) ?? 0;
  const depositHoldersCount = pickMetric(stats, ['deposit_holders_count']) ?? 0;
  const depositChargedValue = pickMetric(stats, ['deposit_charged_period_uzs', 'deposit_charged_uzs', 'bottle_deposit_charged_period_uzs', 'bottle_deposit_charged_uzs']) ?? 0;
  const depositRefundedValue = pickMetric(stats, ['deposit_refunded_period_uzs', 'deposit_refunded_uzs', 'bottle_deposit_refunded_period_uzs', 'bottle_deposit_refunded_uzs']) ?? 0;
  const showDepositCards =
    hasMetric(stats, ['deposit_held_total_uzs', 'deposit_held_uzs', 'bottle_deposit_held_uzs']) ||
    hasMetric(stats, ['deposit_held_total_bottles_count']) ||
    hasMetric(stats, ['deposit_holders_count']) ||
    hasMetric(stats, ['deposit_charged_period_uzs', 'deposit_charged_uzs', 'bottle_deposit_charged_period_uzs', 'bottle_deposit_charged_uzs']) ||
    hasMetric(stats, ['deposit_refunded_period_uzs', 'deposit_refunded_uzs', 'bottle_deposit_refunded_period_uzs', 'bottle_deposit_refunded_uzs']);
  const depositsSummary = depositsData.summary;
  const depositRows = depositsData.results || [];
  const canLoadMoreDeposits = (depositsData.total || 0) > depositRows.length;
  const statusCounts = stats.order_status_counts || {};
  const successfulOrders = pickMetric(stats, ['successful_orders']) ?? toNumber(statusCounts.DELIVERED);
  const canceledOrders = pickMetric(stats, ['canceled_orders']) ?? toNumber(statusCounts.CANCELED);
  const failedOrders = pickMetric(stats, ['failed_orders']) ?? toNumber(statusCounts.FAILED);
  const unsuccessfulOrders =
    pickMetric(stats, ['unsuccessful_orders']) ?? canceledOrders + failedOrders;
  const pendingOrders =
    pickMetric(stats, ['pending_orders']) ??
    Math.max(0, (stats.total_orders ?? 0) - successfulOrders - unsuccessfulOrders);

  const orderStatusBreakdown = ORDER_STATUS_BREAKDOWN_ORDER
    .map((status) => ({ status, count: toNumber(statusCounts[status]) }))
    .filter((row) => row.count > 0);

  const buildOrdersPath = useCallback((status?: string) => {
    const params = new URLSearchParams();

    if (status) {
      params.set('status', status);
    }

    if (filterMode === 'date' && singleDate) {
      params.set('date_from', singleDate);
      params.set('date_to', singleDate);
    } else if ((filterMode === 'range' || filterMode === 'weekly' || filterMode === 'monthly') && (stats.date_from || dateFrom)) {
      params.set('date_from', stats.date_from || dateFrom);
      params.set('date_to', stats.date_to || dateTo || stats.date_from || dateFrom);
    }

    const query = params.toString();
    return query ? `/admin-app/orders?${query}` : '/admin-app/orders';
  }, [dateFrom, dateTo, filterMode, singleDate, stats.date_from, stats.date_to]);

  const getOrderStatusLabel = useCallback((status: string) => {
    switch (status) {
      case 'NEW_LEAD':
        return tr('New lead', 'Новый лид', 'Yangi lid');
      case 'INFO_COLLECTED':
        return tr('Info collected', 'Информация собрана', "Ma'lumot yig'ilgan");
      case 'PAYMENT_PENDING':
        return tr('Payment pending', 'Ожидает оплату', "To'lov kutilmoqda");
      case 'PAYMENT_CONFIRMED':
        return tr('Payment confirmed', 'Оплата подтверждена', "To'lov tasdiqlangan");
      case 'DISPATCHED':
        return tr('Dispatched', 'Отправлен', 'Yuborilgan');
      case 'ASSIGNED':
        return tr('Assigned', 'Назначен', 'Biriktirilgan');
      case 'OUT_FOR_DELIVERY':
        return tr('Out for delivery', 'В доставке', 'Yetkazib berishda');
      case 'DELIVERED':
        return tr('Delivered', 'Доставлен', 'Yetkazildi');
      case 'CANCELED':
        return tr('Canceled', 'Отменён', 'Bekor qilingan');
      case 'FAILED':
        return tr('Failed', 'Неуспешный', 'Muvaffaqiyatsiz');
      default:
        return status;
    }
  }, [tr]);

  const getOrderStatusChipClass = useCallback((status: string) => {
    switch (status) {
      case 'DELIVERED':
        return 'border-green-200 bg-green-50 text-green-700 dark:border-green-500/20 dark:bg-green-500/10 dark:text-green-300';
      case 'CANCELED':
      case 'FAILED':
        return 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300';
      case 'PAYMENT_PENDING':
      case 'INFO_COLLECTED':
        return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300';
      case 'DISPATCHED':
      case 'ASSIGNED':
      case 'OUT_FOR_DELIVERY':
        return 'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-500/20 dark:bg-violet-500/10 dark:text-violet-300';
      default:
        return 'border-light-border bg-white text-gray-700 dark:border-navy-700 dark:bg-navy-900 dark:text-gray-200';
    }
  }, []);

  const kpiCards = [
    {
      title: t('total_orders'),
      value: String(stats.total_orders ?? 0),
      sub: tr('All orders in selected period', 'All orders in selected period', 'Tanlangan davrdagi barcha buyurtmalar'),
      icon: ShoppingBag,
      color: 'text-blue-500',
      onClick: () => navigate(buildOrdersPath()),
    },
    {
      title: tr('Successful Orders', 'Successful Orders', 'Muvaffaqiyatli buyurtmalar'),
      value: String(successfulOrders),
      sub: tr(
        'Delivered orders count',
        'Delivered orders count',
        'Yetkazilgan buyurtmalar soni'
      ),
      icon: CheckCircle2,
      color: 'text-green-500',
      onClick: () => navigate(buildOrdersPath('DELIVERED')),
    },
    {
      title: tr('Pending Orders', 'Pending Orders', 'Kutilayotgan buyurtmalar'),
      value: String(pendingOrders),
      sub: tr(
        'Non-terminal orders still in progress',
        'Non-terminal orders still in progress',
        'Hali yakunlanmagan buyurtmalar'
      ),
      icon: Clock,
      color: 'text-orange-500',
      onClick: () => navigate(buildOrdersPath(PENDING_ORDER_STATUSES)),
    },
    {
      title: tr('Unsuccessful Orders', 'Unsuccessful Orders', 'Muvaffaqiyatsiz buyurtmalar'),
      value: String(unsuccessfulOrders),
      sub: tr(
        `${canceledOrders} canceled · ${failedOrders} failed`,
        `${canceledOrders} canceled · ${failedOrders} failed`,
        `${canceledOrders} bekor qilingan · ${failedOrders} failed`
      ),
      icon: AlertTriangle,
      color: 'text-rose-500',
      onClick: () => navigate(buildOrdersPath('CANCELED,FAILED')),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-light-text dark:text-white">{t('nav_dashboard')}</h1>
      </div>

      <Card className="!p-0 overflow-hidden">
        <div className="p-4 md:p-5 flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            {([
              ['date', tr('Today / Date', 'Today / Date', 'Bugun / Sana')],
              ['weekly', tr('Weekly', 'Weekly', 'Haftalik')],
              ['monthly', tr('Monthly', 'Monthly', 'Oylik')],
              ['range', tr('Custom Range', 'Custom Range', 'Maxsus davr')],
            ] as Array<[DashboardFilterMode, string]>).map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                onClick={() => setFilterMode(mode)}
                className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${filterMode === mode
                  ? 'border-primary-blue bg-primary-blue text-white'
                  : 'border-light-border bg-white text-gray-700 hover:bg-gray-50 dark:border-navy-600 dark:bg-navy-900 dark:text-gray-200 dark:hover:bg-navy-700'
                  }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex flex-col md:flex-row gap-4 items-start md:items-end justify-between border-t border-light-border dark:border-navy-700 pt-4 mt-4">
            <div className="flex flex-wrap gap-3 w-full md:w-auto">
              {filterMode === 'date' && (
                <div className="flex-1 md:flex-none">
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">{tr('Date', 'Date', 'Sana')}</label>
                  <input
                    type="date"
                    value={singleDate}
                    onChange={(e) => setSingleDate(e.target.value)}
                    className="w-full md:w-auto rounded-lg border border-light-border dark:border-navy-600 bg-gray-50 dark:bg-navy-900/50 px-3 py-2 text-sm text-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-primary-blue/20 outline-none transition-all shadow-sm"
                  />
                </div>
              )}

              {filterMode === 'range' && (
                <>
                  <div className="flex-1 md:flex-none">
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">{tr('From', 'From', 'Dan')}</label>
                    <input
                      type="date"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                      className="w-full md:w-auto rounded-lg border border-light-border dark:border-navy-600 bg-gray-50 dark:bg-navy-900/50 px-3 py-2 text-sm text-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-primary-blue/20 outline-none transition-all shadow-sm"
                    />
                  </div>
                  <div className="flex-1 md:flex-none">
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">{tr('To', 'To', 'Gacha')}</label>
                    <input
                      type="date"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                      className="w-full md:w-auto rounded-lg border border-light-border dark:border-navy-600 bg-gray-50 dark:bg-navy-900/50 px-3 py-2 text-sm text-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-primary-blue/20 outline-none transition-all shadow-sm"
                    />
                  </div>
                </>
              )}

              {(filterMode === 'weekly' || filterMode === 'monthly') && (
                <div className="flex items-center gap-2 rounded-lg bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 px-4 py-2 text-sm text-blue-700 dark:text-blue-400">
                  <Calendar size={16} />
                  <span>
                    {filterMode === 'weekly'
                      ? tr('Rolling 7-day period', 'Rolling 7-day period', 'Sirganuvchi 7 kunlik davr')
                      : tr('Rolling 30-day period', 'Rolling 30-day period', 'Sirganuvchi 30 kunlik davr')}
                  </span>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              <div className="hidden md:flex items-center gap-2 mr-2 px-3 py-1.5 rounded-full bg-gray-50 dark:bg-navy-900 border border-light-border dark:border-navy-700 shadow-sm">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                <span className="text-xs font-medium text-gray-600 dark:text-gray-300">{loadedRange}</span>
              </div>
              <button
                type="button"
                onClick={loadStats}
                disabled={loading}
                className="flex-1 md:flex-none inline-flex justify-center items-center gap-2 rounded-lg bg-white dark:bg-navy-800 border border-light-border dark:border-navy-600 px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-navy-700 hover:text-primary-blue transition-all shadow-sm disabled:opacity-50"
              >
                <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
                {tr('Refresh', 'Refresh', 'Yangilash')}
              </button>
              <button
                type="button"
                onClick={downloadStats}
                disabled={downloading}
                className="flex-1 md:flex-none inline-flex justify-center items-center gap-2 rounded-lg bg-primary-blue px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-all shadow-sm disabled:opacity-60 relative overflow-hidden group"
              >
                <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
                <Download size={15} className="relative z-10" />
                <span className="relative z-10">{downloading ? tr('Exporting...', 'Exporting...', 'Yuklanmoqda...') : tr('Export XLS', 'Export XLS', 'XLS Yuklash')}</span>
              </button>
            </div>
          </div>
        </div>
      </Card>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 text-red-700 px-4 py-3 text-sm">{error}</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {kpiCards.map((kpi, idx) => (
          <Card key={idx} className={`relative overflow-hidden transition ${kpi.onClick ? 'cursor-pointer hover:-translate-y-0.5 hover:shadow-md' : ''}`}>
            <button type="button" className="w-full text-left" onClick={kpi.onClick}>
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{kpi.title}</p>
                <h3 className="text-2xl font-bold text-light-text dark:text-white mt-2">{loading ? '...' : kpi.value}</h3>
              </div>
              <div className={`p-3 rounded-lg bg-gray-50 dark:bg-navy-700 ${kpi.color}`}>
                <kpi.icon size={24} />
              </div>
            </div>
            <div className="mt-4 text-xs text-gray-500 dark:text-gray-400">{kpi.sub}</div>
            {kpi.onClick ? (
              <div className="mt-3 text-[11px] font-medium uppercase tracking-[0.16em] text-primary-blue dark:text-blue-300">
                {tr('Open orders', 'Open orders', 'Buyurtmalarni ochish')}
              </div>
            ) : null}
            </button>
          </Card>
        ))}
      </div>

      <Card
        title={tr('Operational Snapshot', 'Operational Snapshot', 'Operatsion ko rinish')}
        className="overflow-hidden"
      >
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.05fr_0.95fr_0.9fr]">
          <button
            type="button"
            onClick={() => navigate(buildOrdersPath())}
            className="rounded-2xl border border-light-border bg-gray-50/80 p-5 text-left transition hover:-translate-y-0.5 hover:shadow-sm dark:border-navy-700 dark:bg-navy-900/40"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{tr('Product Revenue', 'Product Revenue', 'Mahsulot tushumi')}</p>
                <h3 className="mt-2 text-3xl font-bold text-light-text dark:text-white">{loading ? '...' : `${revenuePeriodValue.toLocaleString()} UZS`}</h3>
              </div>
              <div className="rounded-2xl bg-green-50 p-3 text-green-500 dark:bg-green-500/10">
                <DollarSign size={22} />
              </div>
            </div>
            <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">
              {tr(
                `Selected period revenue. Actual today: ${(stats.revenue_today_actual ?? 0).toLocaleString()} UZS`,
                `Selected period revenue. Actual today: ${(stats.revenue_today_actual ?? 0).toLocaleString()} UZS`,
                `Tanlangan davr tushumi. Haqiqiy bugun: ${(stats.revenue_today_actual ?? 0).toLocaleString()} UZS`
              )}
            </p>
            <div className="mt-3 text-[11px] font-medium uppercase tracking-[0.16em] text-primary-blue dark:text-blue-300">
              {tr('Open orders', 'Open orders', 'Buyurtmalarni ochish')}
            </div>
          </button>

          <button
            type="button"
            onClick={() => navigate(buildOrdersPath('PAYMENT_PENDING'))}
            className="rounded-2xl border border-light-border bg-gray-50/80 p-5 text-left transition hover:-translate-y-0.5 hover:shadow-sm dark:border-navy-700 dark:bg-navy-900/40"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{tr('Pending Payments', 'Pending Payments', 'Kutilayotgan tolovlar')}</p>
                <h3 className="mt-2 text-3xl font-bold text-light-text dark:text-white">{loading ? '...' : `${(stats.pending_payments_amount ?? 0).toLocaleString()} UZS`}</h3>
              </div>
              <div className="rounded-2xl bg-orange-50 p-3 text-orange-500 dark:bg-orange-500/10">
                <Clock size={22} />
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="inline-flex items-center rounded-full bg-white px-3 py-1 text-xs font-medium text-gray-700 dark:bg-navy-800 dark:text-gray-200">
                {stats.pending_payments ?? 0} {tr('orders', 'orders', 'buyurtma')}
              </span>
              <span className="inline-flex items-center rounded-full bg-white px-3 py-1 text-xs font-medium text-gray-700 dark:bg-navy-800 dark:text-gray-200">
                {tr('Tap to open', 'Tap to open', 'Ochish uchun bosing')}
              </span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => navigate(buildOrdersPath(DELIVERY_RELATED_STATUSES))}
            className="rounded-2xl border border-light-border bg-gray-50/80 p-5 text-left transition hover:-translate-y-0.5 hover:shadow-sm dark:border-navy-700 dark:bg-navy-900/40"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{tr('In Delivery', 'In Delivery', 'Yetkazib berishda')}</p>
                <h3 className="mt-2 text-3xl font-bold text-light-text dark:text-white">{loading ? '...' : String(stats.in_delivery_snapshot ?? stats.in_delivery ?? 0)}</h3>
              </div>
              <div className="rounded-2xl bg-purple-50 p-3 text-purple-500 dark:bg-purple-500/10">
                <Truck size={22} />
              </div>
            </div>
            <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">
              {tr(
                `Selected period: ${stats.in_delivery ?? 0}`,
                `Selected period: ${stats.in_delivery ?? 0}`,
                `Tanlangan davr: ${stats.in_delivery ?? 0}`
              )}
            </p>
            <div className="mt-3 text-[11px] font-medium uppercase tracking-[0.16em] text-primary-blue dark:text-blue-300">
              {tr('Open delivery orders', 'Open delivery orders', 'Yetkazish buyurtmalarini ochish')}
            </div>
          </button>
        </div>

        {orderStatusBreakdown.length ? (
          <div className="mt-5 flex flex-wrap gap-2">
            {orderStatusBreakdown.map((row) => (
              <button
                type="button"
                key={row.status}
                onClick={() => navigate(buildOrdersPath(row.status))}
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition hover:-translate-y-0.5 hover:shadow-sm ${getOrderStatusChipClass(row.status)}`}
              >
                <span>{getOrderStatusLabel(row.status)}</span>
                <span className="rounded-full bg-white/80 px-2 py-0.5 text-[11px] font-semibold text-current dark:bg-black/10">
                  {row.count}
                </span>
              </button>
            ))}
          </div>
        ) : null}
      </Card>

      {showDepositCards ? (
        <Card
          title={tr('Deposit Overview', 'Deposit Overview', 'Depozit overview')}
          action={
            <button
              type="button"
              onClick={() => {
                setDepositsModalOpen(true);
                void loadDeposits(0, false);
              }}
              className="rounded-lg border border-light-border bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-navy-700 dark:bg-navy-900 dark:text-gray-200 dark:hover:bg-navy-800"
            >
              {tr('Details', 'Details', 'Tafsilotlar')}
            </button>
          }
        >
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <div className="rounded-2xl border border-amber-200 bg-[linear-gradient(135deg,rgba(255,247,237,0.95)_0%,rgba(255,255,255,1)_100%)] p-5 dark:border-amber-500/20 dark:bg-[linear-gradient(135deg,rgba(120,53,15,0.18)_0%,rgba(15,23,42,0.8)_100%)]">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{tr('Deposit Held Now', 'Deposit Held Now', 'Hozir ushlab turilgan depozit')}</p>
              <h3 className="mt-2 text-3xl font-bold text-light-text dark:text-white">{loading ? '...' : `${depositHeldValue.toLocaleString()} UZS`}</h3>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="inline-flex items-center rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
                  {tr('Bottles', 'Bottles', 'Idishlar')}: {depositHeldBottlesCount}
                </span>
                <span className="inline-flex items-center rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-800 dark:bg-blue-500/15 dark:text-blue-300">
                  {tr('Clients', 'Clients', 'Mijozlar')}: {depositHoldersCount}
                </span>
              </div>
              <p className="mt-5 text-xs text-gray-500 dark:text-gray-400">{tr('Current deposit balance being held from clients.', 'Current deposit balance being held from clients.', 'Mijozlardan hozir ushlab turilgan depozit qoldig‘i.')}</p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:col-span-2">
              <div className="rounded-2xl border border-light-border bg-gray-50/80 p-5 dark:border-navy-700 dark:bg-navy-900/40">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{tr('Bottles With Clients', 'Bottles With Clients', 'Mijozlarda qolgan idishlar')}</p>
                <h3 className="mt-2 text-2xl font-bold text-light-text dark:text-white">{loading ? '...' : depositHeldBottlesCount.toLocaleString()}</h3>
                <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">{tr('Bottles clients are still holding right now.', 'Bottles clients are still holding right now.', 'Mijozlarda hozir qolib turgan idishlar soni.')}</p>
              </div>

              <div className="rounded-2xl border border-light-border bg-gray-50/80 p-5 dark:border-navy-700 dark:bg-navy-900/40">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{tr('Deposit Holders', 'Deposit Holders', 'Depozit ushlab turgan mijozlar')}</p>
                <h3 className="mt-2 text-2xl font-bold text-light-text dark:text-white">{loading ? '...' : depositHoldersCount.toLocaleString()}</h3>
                <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">{tr('Distinct clients who currently hold bottles or deposit.', 'Distinct clients who currently hold bottles or deposit.', 'Hozir idish yoki depozit ushlab turgan alohida mijozlar soni.')}</p>
              </div>

              <div className="rounded-2xl border border-light-border bg-gray-50/80 p-5 dark:border-navy-700 dark:bg-navy-900/40">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{tr('Deposit Charged In Period', 'Deposit Charged In Period', 'Davrda hisoblangan depozit')}</p>
                <h3 className="mt-2 text-2xl font-bold text-light-text dark:text-white">{loading ? '...' : `${depositChargedValue.toLocaleString()} UZS`}</h3>
                <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">{tr('Newly charged deposit in the selected period.', 'Newly charged deposit in the selected period.', 'Tanlangan davr ichida yangi hisoblangan depozit.')}</p>
              </div>

              <div className="rounded-2xl border border-light-border bg-gray-50/80 p-5 dark:border-navy-700 dark:bg-navy-900/40">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{tr('Deposit Refunded In Period', 'Deposit Refunded In Period', 'Davrda qaytarilgan depozit')}</p>
                <h3 className="mt-2 text-2xl font-bold text-light-text dark:text-white">{loading ? '...' : `${depositRefundedValue.toLocaleString()} UZS`}</h3>
                <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">{tr('Deposit returned back in the selected period.', 'Deposit returned back in the selected period.', 'Tanlangan davr ichida qaytarilgan depozit.')}</p>
              </div>
            </div>
          </div>
        </Card>
      ) : null}

      {showCharts && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card title={ordersTrendTitle} className="min-h-[350px]">
            {orderTrend.length === 0 ? (
              <p className="text-sm text-gray-500">{tr('No trend data.', 'No trend data.', 'Trend malumotlari yoq.')}</p>
            ) : (
              <div className="h-[300px] w-full mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={orderTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#DDE3EA" vertical={false} />
                    <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis
                      stroke="#888888"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                      allowDecimals={false}
                      domain={[0, (dataMax: number) => Math.max(1, Math.ceil(dataMax * 1.2))]}
                    />
                    <Tooltip
                      cursor={{ fill: 'transparent' }}
                      formatter={(value) => [toNumber(value), tr('Orders', 'Orders', 'Buyurtmalar')]}
                      contentStyle={{ backgroundColor: '#101B2D', borderColor: '#1A2C45', color: '#fff' }}
                    />
                    <Bar dataKey="value" fill="#E53935" radius={[4, 4, 0, 0]} minPointSize={2} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>

          <Card title={revenueTrendTitle} className="min-h-[350px]">
            {revenueTrend.length === 0 ? (
              <p className="text-sm text-gray-500">{tr('No trend data.', 'No trend data.', 'Trend malumotlari yoq.')}</p>
            ) : (
              <div className="h-[300px] w-full mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={revenueTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#DDE3EA" vertical={false} />
                    <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis
                      stroke="#888888"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                      domain={revenueDomain}
                      tickFormatter={(value) => `${Math.round(Number(value) / 1000)}k`}
                    />
                    <Tooltip
                      formatter={(value) => [`${toNumber(value).toLocaleString()} UZS`, tr('Revenue', 'Revenue', 'Tushum')]}
                      contentStyle={{ backgroundColor: '#101B2D', borderColor: '#1A2C45', color: '#fff' }}
                    />
                    <Line type="monotone" dataKey="value" stroke="#2F6BFF" strokeWidth={3} dot={{ r: 3 }} connectNulls />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>
        </div>
      )}

      {stats.recent_activity && stats.recent_activity.length > 0 ? (
        <Card title={tr('Recent Activity', 'Recent Activity', "So\'nggi faollik")}>
          <div className="space-y-3">
            {stats.recent_activity.slice(0, 8).map((item) => (
              <div key={item.id} className="flex items-start justify-between gap-4 rounded-lg border border-light-border dark:border-navy-700 bg-gray-50 dark:bg-navy-900/40 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-light-text dark:text-white">{item.text || '-'}</p>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{item.user || 'System'}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-semibold text-primary-blue dark:text-blue-300">{item.status || '-'}</p>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{item.updated_at ? new Date(item.updated_at).toLocaleString() : '-'}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      <Modal
        isOpen={depositsModalOpen}
        onClose={() => setDepositsModalOpen(false)}
        title={tr('Deposit Details', 'Deposit Details', 'Depozit tafsilotlari')}
        maxWidthClass="max-w-5xl"
      >
        <div className="space-y-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-500 mb-1.5">{tr('Search clients', 'Search clients', 'Mijozlarni qidirish')}</label>
              <div className="flex items-center gap-2 rounded-xl border border-light-border dark:border-navy-700 bg-gray-50 dark:bg-navy-900/40 px-3 py-2">
                <Search size={16} className="text-gray-400" />
                <input
                  type="text"
                  value={depositSearch}
                  onChange={(e) => setDepositSearch(e.target.value)}
                  placeholder={tr('Name, phone, username', 'Name, phone, username', 'Ism, telefon, username')}
                  className="w-full bg-transparent text-sm text-gray-800 outline-none placeholder:text-gray-400 dark:text-gray-100"
                />
              </div>
            </div>
            <button
              type="button"
              onClick={() => void loadDeposits(0, false)}
              disabled={depositsLoading}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-light-border dark:border-navy-700 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:bg-navy-900 dark:text-gray-200 dark:hover:bg-navy-800 disabled:opacity-50"
            >
              <RefreshCw size={15} className={depositsLoading ? 'animate-spin' : ''} />
              {tr('Refresh', 'Refresh', 'Yangilash')}
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div className="rounded-xl border border-light-border dark:border-navy-700 bg-gray-50 dark:bg-navy-900/40 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.18em] text-gray-400">{tr('Clients', 'Clients', 'Mijozlar')}</p>
              <p className="mt-2 text-xl font-semibold text-light-text dark:text-white">{(depositsSummary?.client_count ?? 0).toLocaleString()}</p>
            </div>
            <div className="rounded-xl border border-light-border dark:border-navy-700 bg-gray-50 dark:bg-navy-900/40 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.18em] text-gray-400">{tr('Outstanding Bottles', 'Outstanding Bottles', 'Qolgan idishlar')}</p>
              <p className="mt-2 text-xl font-semibold text-light-text dark:text-white">{(depositsSummary?.total_outstanding_bottles_count ?? 0).toLocaleString()}</p>
            </div>
            <div className="rounded-xl border border-light-border dark:border-navy-700 bg-gray-50 dark:bg-navy-900/40 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.18em] text-gray-400">{tr('Deposit Held', 'Deposit Held', 'Ushlab turilgan depozit')}</p>
              <p className="mt-2 text-xl font-semibold text-light-text dark:text-white">{`${(depositsSummary?.total_deposit_held_uzs ?? depositHeldValue).toLocaleString()} UZS`}</p>
            </div>
            <div className="rounded-xl border border-light-border dark:border-navy-700 bg-gray-50 dark:bg-navy-900/40 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.18em] text-gray-400">{tr('Refunded', 'Refunded', 'Qaytarilgan')}</p>
              <p className="mt-2 text-xl font-semibold text-light-text dark:text-white">{`${(depositsSummary?.total_deposit_refunded_uzs ?? 0).toLocaleString()} UZS`}</p>
            </div>
          </div>

          {depositsError ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{depositsError}</div>
          ) : null}

          {depositsLoading && depositRows.length === 0 ? (
            <div className="rounded-xl border border-light-border dark:border-navy-700 bg-gray-50 dark:bg-navy-900/40 px-4 py-6 text-sm text-gray-500">
              {tr('Loading deposit details...', 'Loading deposit details...', 'Depozit tafsilotlari yuklanmoqda...')}
            </div>
          ) : null}

          {!depositsLoading && !depositsError && depositRows.length === 0 ? (
            <div className="rounded-xl border border-light-border dark:border-navy-700 bg-gray-50 dark:bg-navy-900/40 px-4 py-6 text-sm text-gray-500">
              {tr('No deposit balances found.', 'No deposit balances found.', 'Depozit balansi topilmadi.')}
            </div>
          ) : null}

          <div className="space-y-4">
            {depositRows.map((row) => (
              <div key={row.client_id} className="rounded-2xl border border-light-border dark:border-navy-700 bg-white dark:bg-navy-900/50 p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-3">
                    <div>
                      <h3 className="text-lg font-semibold text-light-text dark:text-white">{row.client_name || '-'}</h3>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-500 dark:text-gray-400">
                        {row.client_phone ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1 dark:bg-navy-800">
                            <Phone size={12} />
                            {row.client_phone}
                          </span>
                        ) : null}
                        {row.client_username ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1 dark:bg-navy-800">
                            <UserRound size={12} />
                            @{row.client_username}
                          </span>
                        ) : null}
                        {row.client_preferred_language ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1 dark:bg-navy-800">
                            <Languages size={12} />
                            {row.client_preferred_language}
                          </span>
                        ) : null}
                        {row.client_platform ? (
                          <span className="rounded-full bg-gray-100 px-3 py-1 capitalize dark:bg-navy-800">{row.client_platform}</span>
                        ) : null}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                      <div className="rounded-xl bg-gray-50 px-3 py-2 dark:bg-navy-800">
                        <p className="text-xs uppercase tracking-[0.18em] text-gray-400">{tr('Products', 'Products', 'Mahsulotlar')}</p>
                        <p className="mt-1 text-sm font-semibold text-light-text dark:text-white">{row.balances_count}</p>
                      </div>
                      <div className="rounded-xl bg-gray-50 px-3 py-2 dark:bg-navy-800">
                        <p className="text-xs uppercase tracking-[0.18em] text-gray-400">{tr('Outstanding', 'Outstanding', 'Qolgan')}</p>
                        <p className="mt-1 text-sm font-semibold text-light-text dark:text-white">{row.total_outstanding_bottles_count}</p>
                      </div>
                      <div className="rounded-xl bg-gray-50 px-3 py-2 dark:bg-navy-800">
                        <p className="text-xs uppercase tracking-[0.18em] text-gray-400">{tr('Held', 'Held', 'Ushlangan')}</p>
                        <p className="mt-1 text-sm font-semibold text-light-text dark:text-white">{`${row.deposit_held_total_uzs.toLocaleString()} UZS`}</p>
                      </div>
                      <div className="rounded-xl bg-gray-50 px-3 py-2 dark:bg-navy-800">
                        <p className="text-xs uppercase tracking-[0.18em] text-gray-400">{tr('Refunded', 'Refunded', 'Qaytarilgan')}</p>
                        <p className="mt-1 text-sm font-semibold text-light-text dark:text-white">{`${row.total_deposit_refunded_uzs.toLocaleString()} UZS`}</p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl bg-amber-50 px-4 py-3 text-right dark:bg-amber-500/10">
                    <p className="text-xs uppercase tracking-[0.18em] text-amber-700 dark:text-amber-300">{tr('Last updated', 'Last updated', 'Oxirgi yangilanish')}</p>
                    <p className="mt-1 text-sm font-semibold text-amber-900 dark:text-amber-100">
                      {row.last_updated_at ? new Date(row.last_updated_at).toLocaleString() : '-'}
                    </p>
                  </div>
                </div>

                <div className="mt-5 overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b border-light-border dark:border-navy-700 text-left text-xs uppercase tracking-[0.16em] text-gray-400">
                        <th className="pb-3 pr-4">{tr('Product', 'Product', 'Mahsulot')}</th>
                        <th className="pb-3 pr-4">{tr('Size', 'Size', 'Hajmi')}</th>
                        <th className="pb-3 pr-4">{tr('Outstanding', 'Outstanding', 'Qolgan')}</th>
                        <th className="pb-3 pr-4">{tr('Deposit held', 'Deposit held', 'Ushlangan depozit')}</th>
                        <th className="pb-3 pr-4">{tr('Charged', 'Charged', 'Hisoblangan')}</th>
                        <th className="pb-3">{tr('Refunded', 'Refunded', 'Qaytarilgan')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {row.balances.map((balance) => (
                        <tr key={balance.id} className="border-b border-light-border/70 dark:border-navy-800 last:border-0">
                          <td className="py-3 pr-4">
                            <div className="font-medium text-light-text dark:text-white">{balance.product_name}</div>
                            <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">{balance.product_sku || '-'}</div>
                          </td>
                          <td className="py-3 pr-4 text-gray-600 dark:text-gray-300">{balance.product_size_liters || '-'}</td>
                          <td className="py-3 pr-4 text-gray-600 dark:text-gray-300">{balance.outstanding_bottles_count}</td>
                          <td className="py-3 pr-4 text-gray-600 dark:text-gray-300">{`${balance.deposit_held_uzs.toLocaleString()} UZS`}</td>
                          <td className="py-3 pr-4 text-gray-600 dark:text-gray-300">{`${balance.total_deposit_charged_uzs.toLocaleString()} UZS`}</td>
                          <td className="py-3 text-gray-600 dark:text-gray-300">{`${balance.total_deposit_refunded_uzs.toLocaleString()} UZS`}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>

          {canLoadMoreDeposits ? (
            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => void loadDeposits(depositsOffset + (depositsData.limit || 50), true)}
                disabled={depositsLoading}
                className="inline-flex items-center gap-2 rounded-xl border border-light-border dark:border-navy-700 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:bg-navy-900 dark:text-gray-200 dark:hover:bg-navy-800 disabled:opacity-50"
              >
                {depositsLoading ? tr('Loading...', 'Loading...', 'Yuklanmoqda...') : tr('Load more', 'Load more', 'Yana yuklash')}
              </button>
            </div>
          ) : null}
        </div>
      </Modal>
    </div>
  );
};

export default Dashboard;
