import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { Card } from '../components/ui/Card';
import { useToast } from '../context/ToastContext';
import { ShoppingBag, DollarSign, Clock, Truck, Download, RefreshCw, Calendar } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid } from 'recharts';
import { ENDPOINTS, apiRequest, getHeaders } from '../services/api';

interface DashboardStatsResponse {
  date_from?: string;
  date_to?: string;
  days?: number;
  total_orders?: number;
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

  useEffect(() => {
    if (hasInitialLoadRef.current) return;
    hasInitialLoadRef.current = true;
    loadStats();
  }, [loadStats]);

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
  const depositChargedValue = pickMetric(stats, ['deposit_charged_period_uzs', 'deposit_charged_uzs', 'bottle_deposit_charged_period_uzs', 'bottle_deposit_charged_uzs']) ?? 0;
  const depositRefundedValue = pickMetric(stats, ['deposit_refunded_period_uzs', 'deposit_refunded_uzs', 'bottle_deposit_refunded_period_uzs', 'bottle_deposit_refunded_uzs']) ?? 0;
  const showDepositCards =
    hasMetric(stats, ['deposit_held_total_uzs', 'deposit_held_uzs', 'bottle_deposit_held_uzs']) ||
    hasMetric(stats, ['deposit_charged_period_uzs', 'deposit_charged_uzs', 'bottle_deposit_charged_period_uzs', 'bottle_deposit_charged_uzs']) ||
    hasMetric(stats, ['deposit_refunded_period_uzs', 'deposit_refunded_uzs', 'bottle_deposit_refunded_period_uzs', 'bottle_deposit_refunded_uzs']);

  const kpiCards = [
    {
      title: t('total_orders'),
      value: String(stats.total_orders ?? 0),
      sub: tr('Orders in selected period', 'Orders in selected period', 'Tanlangan davrdagi buyurtmalar'),
      icon: ShoppingBag,
      color: 'text-blue-500',
    },
    {
      title: tr('Product Revenue', 'Product Revenue', 'Mahsulot tushumi'),
      value: `${revenuePeriodValue.toLocaleString()} UZS`,
      sub: tr(
        `Selected period revenue. Actual today: ${(stats.revenue_today_actual ?? 0).toLocaleString()} UZS`,
        `Vyruchka za vybrannyy period. Fakticheski segodnya: ${(stats.revenue_today_actual ?? 0).toLocaleString()} UZS`,
        `Tanlangan davr tushumi. Haqiqiy bugun: ${(stats.revenue_today_actual ?? 0).toLocaleString()} UZS`
      ),
      icon: DollarSign,
      color: 'text-green-500',
    },
    {
      title: tr('Pending Amount', 'Pending Amount', "Kutilayotgan to\'lov summasi"),
      value: `${(stats.pending_payments_amount ?? 0).toLocaleString()} UZS`,
      sub: tr(
        `${stats.pending_payments ?? 0} pending payment orders (tap to open)`,
        `${stats.pending_payments ?? 0} zakazov s ozhidayushchey oplatoy (otkryt)`,
        `${stats.pending_payments ?? 0} ta kutilayotgan to\'lov buyurtmasi (ochish)`
      ),
      icon: Clock,
      color: 'text-orange-500',
      onClick: () => navigate('/orders?status=PAYMENT_PENDING'),
    },
    {
      title: t('in_delivery'),
      value: String(stats.in_delivery ?? 0),
      sub: tr('Orders currently in delivery', 'Orders currently in delivery', 'Yetkazib berilayotgan buyurtmalar'),
      icon: Truck,
      color: 'text-purple-500',
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
          <Card key={idx} className={`relative overflow-hidden ${kpi.onClick ? 'cursor-pointer hover:shadow-md' : ''}`}>
            <div className="flex justify-between items-start" onClick={kpi.onClick}>
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{kpi.title}</p>
                <h3 className="text-2xl font-bold text-light-text dark:text-white mt-2">{loading ? '...' : kpi.value}</h3>
              </div>
              <div className={`p-3 rounded-lg bg-gray-50 dark:bg-navy-700 ${kpi.color}`}>
                <kpi.icon size={24} />
              </div>
            </div>
            <div className="mt-4 text-xs text-gray-500 dark:text-gray-400">{kpi.sub}</div>
          </Card>
        ))}
      </div>

      {showDepositCards ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card accent="amber">
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{tr('Deposit Held', 'Deposit Held', 'Ushlab turilgan depozit')}</p>
            <h3 className="mt-2 text-2xl font-bold text-light-text dark:text-white">{loading ? '...' : `${depositHeldValue.toLocaleString()} UZS`}</h3>
            <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">{tr('Current bottle deposit held from clients', 'Current bottle deposit held from clients', 'Mijozlardan ushlab turilgan joriy idish depoziti')}</p>
          </Card>
          <Card accent="blue">
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{tr('Deposit Charged', 'Deposit Charged', 'Hisoblangan depozit')}</p>
            <h3 className="mt-2 text-2xl font-bold text-light-text dark:text-white">{loading ? '...' : `${depositChargedValue.toLocaleString()} UZS`}</h3>
            <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">{tr('Deposit charged in selected period', 'Deposit charged in selected period', 'Tanlangan davrda hisoblangan depozit')}</p>
          </Card>
          <Card accent="emerald">
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{tr('Deposit Refunded', 'Deposit Refunded', 'Qaytarilgan depozit')}</p>
            <h3 className="mt-2 text-2xl font-bold text-light-text dark:text-white">{loading ? '...' : `${depositRefundedValue.toLocaleString()} UZS`}</h3>
            <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">{tr('Deposit refunded in selected period', 'Deposit refunded in selected period', 'Tanlangan davrda qaytarilgan depozit')}</p>
          </Card>
        </div>
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
    </div>
  );
};

export default Dashboard;
