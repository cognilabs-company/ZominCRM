import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  ArrowRightLeft,
  ClipboardList,
  Droplets,
  Loader2,
  RefreshCw,
  Search,
  ShieldAlert,
  Undo2,
  ChevronDown,
  X,
  User,
  Phone,
  MapPin,
  TrendingDown,
  Package,
  Activity,
  CheckCircle2,
  AlertCircle,
  Clock,
  Zap,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useToast } from '../context/ToastContext';
import { ENDPOINTS, apiRequest } from '../services/api';

/* ─────────────────────── types ─────────────────────── */

type Platform = 'telegram' | 'instagram' | 'manual';

interface ClientRow {
  id: string;
  platform: Platform;
  username: string | null;
  full_name: string | null;
  phone: string | null;
  address: string | null;
  preferred_language?: 'en' | 'ru' | 'uz' | null;
  created_at: string;
  updated_at: string;
}

interface BottleSummary {
  client_id: string;
  total_outstanding_bottles_count: number;
  deposit_held_total_uzs: number;
  total_deposit_charged_uzs: number;
  total_deposit_refunded_uzs: number;
}

interface BottleBalance {
  id: string;
  client_id: string;
  product_id: string;
  product_name: string;
  product_sku?: string | null;
  product_size_liters?: string | null;
  requires_returnable_bottle: boolean;
  bottle_deposit_uzs: number;
  outstanding_bottles_count: number;
  deposit_held_uzs: number;
  total_deposit_charged_uzs: number;
  total_deposit_refunded_uzs: number;
  updated_at?: string | null;
}

interface BottleMovement {
  id: string;
  client_id: string;
  product_id?: string | null;
  product_name?: string | null;
  product_sku?: string | null;
  product_size_liters?: string | null;
  order_id?: string | null;
  movement_type: 'ORDER_DELIVERED' | 'REFUND' | 'RETURNED' | 'MANUAL_ADJUST' | string;
  order_quantity?: number | null;
  bottles_delta: number;
  deposit_delta_uzs: number;
  balance_before_count?: number | null;
  balance_after_count?: number | null;
  deposit_before_uzs?: number | null;
  deposit_after_uzs?: number | null;
  actor?: string | null;
  note?: string | null;
  created_at: string;
}

interface ReturnFormState {
  product_id: string;
  quantity: string;
  return_all: boolean;
  note: string;
}

/* ─────────────────────── constants ─────────────────────── */

const emptyReturnForm: ReturnFormState = {
  product_id: '',
  quantity: '1',
  return_all: false,
  note: '',
};

const platformGradient: Record<Platform, string> = {
  telegram: 'from-sky-500 to-blue-600',
  instagram: 'from-pink-500 to-purple-600',
  manual: 'from-slate-400 to-slate-500',
};

const platformInitials: Record<Platform, string> = {
  telegram: 'TG',
  instagram: 'IG',
  manual: 'MN',
};

/* ─────────────────────── component ─────────────────────── */

const BottleController: React.FC = () => {
  const location = useLocation();
  const { language } = useLanguage();
  const toast = useToast();
  const dropdownRef = useRef<HTMLDivElement>(null);

  const tr = (en: string, ru: string, uz: string) =>
    language === 'ru' ? ru : language === 'uz' ? uz : en;

  /* state */
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [clientsLoading, setClientsLoading] = useState(true);
  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const [returnSaving, setReturnSaving] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [summary, setSummary] = useState<BottleSummary | null>(null);
  const [balances, setBalances] = useState<BottleBalance[]>([]);
  const [movements, setMovements] = useState<BottleMovement[]>([]);
  const [returnForm, setReturnForm] = useState<ReturnFormState>(emptyReturnForm);
  const [successPulse, setSuccessPulse] = useState(false);

  /* derived */
  const requestedClientId = useMemo(
    () => new URLSearchParams(location.search).get('client_id'),
    [location.search]
  );

  const selectedClient = useMemo(
    () => clients.find((c) => c.id === selectedClientId) ?? null,
    [clients, selectedClientId]
  );

  const filteredClients = useMemo(() => {
    const kw = search.trim().toLowerCase();
    if (!kw) return clients;
    return clients.filter((c) =>
      [c.full_name, c.phone, c.username, c.address, c.id]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(kw)
    );
  }, [clients, search]);

  const selectedReturnBalance = useMemo(
    () => balances.find((b) => b.product_id === returnForm.product_id) ?? null,
    [balances, returnForm.product_id]
  );

  const returnPreview = useMemo(() => {
    if (!selectedReturnBalance) return { quantity: 0, deposit: 0 };
    const qty = returnForm.return_all
      ? selectedReturnBalance.outstanding_bottles_count
      : Math.max(
          0,
          Math.min(
            Number(returnForm.quantity ?? 0),
            selectedReturnBalance.outstanding_bottles_count
          )
        );
    return {
      quantity: qty,
      deposit: qty * Number(selectedReturnBalance.bottle_deposit_uzs ?? 0),
    };
  }, [returnForm.quantity, returnForm.return_all, selectedReturnBalance]);

  /* formatters */
  const fmt = (v: number) =>
    new Intl.NumberFormat(
      language === 'ru' ? 'ru-RU' : language === 'uz' ? 'uz-UZ' : 'en-US'
    ).format(v);

  const fmtDate = (v?: string | null) => {
    if (!v) return '—';
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return v;
    return new Intl.DateTimeFormat(
      language === 'ru' ? 'ru-RU' : language === 'uz' ? 'uz-UZ' : 'en-US',
      { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }
    ).format(d);
  };

  const platformLabel = (p: Platform) =>
    p === 'instagram'
      ? 'Instagram'
      : p === 'manual'
      ? tr('Manual', 'Ручной', "Qo'lda")
      : 'Telegram';

  const mvLabel = (t: string) => {
    if (t === 'RETURNED') return tr('Returned', 'Возврат бутылей', 'Qaytarildi');
    if (t === 'REFUND') return tr('Refunded', 'Возврат депозита', 'Depozit qaytarildi');
    if (t === 'ORDER_DELIVERED') return tr('Delivered', 'Доставка', 'Yetkazildi');
    if (t === 'MANUAL_ADJUST') return tr('Manual adj.', 'Корректировка', "Qo'lda tuzatish");
    return t;
  };

  const mvIcon = (t: string) => {
    if (t === 'RETURNED') return <CheckCircle2 size={12} />;
    if (t === 'REFUND') return <AlertCircle size={12} />;
    if (t === 'ORDER_DELIVERED') return <Package size={12} />;
    return <Zap size={12} />;
  };

  /* movement type → light/dark-safe colour classes */
  const mvColors = (t: string) => {
    if (t === 'RETURNED')
      return {
        badge: 'text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-400/10 dark:border-emerald-400/20',
        icon: 'text-emerald-600 dark:text-emerald-400',
      };
    if (t === 'REFUND')
      return {
        badge: 'text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-400/10 dark:border-amber-400/20',
        icon: 'text-amber-600 dark:text-amber-400',
      };
    if (t === 'ORDER_DELIVERED')
      return {
        badge: 'text-sky-700 bg-sky-50 border-sky-200 dark:text-sky-400 dark:bg-sky-400/10 dark:border-sky-400/20',
        icon: 'text-sky-600 dark:text-sky-400',
      };
    return {
      badge: 'text-violet-700 bg-violet-50 border-violet-200 dark:text-violet-400 dark:bg-violet-400/10 dark:border-violet-400/20',
      icon: 'text-violet-600 dark:text-violet-400',
    };
  };

  const clientName = (c: ClientRow) =>
    c.full_name ?? c.username ?? c.phone ?? c.id.slice(0, 8);

  const clientAvatar = (c: ClientRow) =>
    (c.full_name ?? c.username ?? '')
      .split(' ')
      .slice(0, 2)
      .map((w) => w[0] ?? '')
      .join('')
      .toUpperCase() || platformInitials[c.platform];

  /* helpers */
  const resetReturnForm = (rows: BottleBalance[]) =>
    setReturnForm({
      product_id: rows[0]?.product_id ?? '',
      quantity: '1',
      return_all: false,
      note: '',
    });

  /* outside-click closes dropdown */
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node))
        setDropdownOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  /* data fetching */
  const loadClients = async () => {
    try {
      setClientsLoading(true);
      const data = await apiRequest<{ results?: ClientRow[] } | ClientRow[]>(
        ENDPOINTS.CLIENTS.LIST
      );
      const rows = Array.isArray(data) ? data : (data.results ?? []);
      setClients(rows);
      if (!selectedClientId && rows[0])
        setSelectedClientId(requestedClientId ?? rows[0].id);
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : tr('Failed to load clients', 'Ошибка загрузки клиентов', "Mijozlarni yuklab bo'lmadi")
      );
    } finally {
      setClientsLoading(false);
    }
  };

  const loadWorkspace = async (clientId: string) => {
    try {
      setWorkspaceLoading(true);
      const [balanceData, movementData] = await Promise.all([
        apiRequest<{ summary?: BottleSummary; results?: BottleBalance[] }>(
          ENDPOINTS.CLIENTS.BOTTLE_BALANCES(clientId)
        ),
        apiRequest<{ results?: BottleMovement[] }>(
          `${ENDPOINTS.BOTTLES.MOVEMENTS}?client_id=${encodeURIComponent(clientId)}&limit=30`
        ),
      ]);
      const nb = balanceData.results ?? [];
      setSummary(balanceData.summary ?? null);
      setBalances(nb);
      setMovements(movementData.results ?? []);
      resetReturnForm(nb);
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : tr('Failed to load workspace', 'Ошибка загрузки', "Yuklab bo'lmadi")
      );
      setSummary(null);
      setBalances([]);
      setMovements([]);
      resetReturnForm([]);
    } finally {
      setWorkspaceLoading(false);
    }
  };

  useEffect(() => { void loadClients(); }, []);

  useEffect(() => {
    if (!clients.length || !requestedClientId) return;
    if (clients.some((c) => c.id === requestedClientId)) setSelectedClientId(requestedClientId);
  }, [clients, requestedClientId]);

  useEffect(() => {
    if (!selectedClientId) {
      setSummary(null); setBalances([]); setMovements([]); resetReturnForm([]);
      return;
    }
    void loadWorkspace(selectedClientId);
  }, [selectedClientId]);

  /* submit */
  const handleReturnSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedClient) return;
    if (!returnForm.product_id) {
      toast.error(tr('Select a product first', 'Выберите продукт', 'Mahsulotni tanlang'));
      return;
    }
    try {
      setReturnSaving(true);
      await apiRequest(ENDPOINTS.CLIENTS.BOTTLE_RETURNS(selectedClient.id), {
        method: 'POST',
        body: JSON.stringify({
          product_id: returnForm.product_id,
          quantity: Number(returnForm.quantity ?? 0),
          return_all: returnForm.return_all,
          note: returnForm.note.trim(),
          actor: 'admin-ui',
        }),
      });
      toast.success(tr('Return recorded', 'Возврат сохранён', 'Qaytarish saqlandi'));
      setSuccessPulse(true);
      setTimeout(() => setSuccessPulse(false), 1400);
      await loadWorkspace(selectedClient.id);
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : tr('Failed to save', 'Ошибка сохранения', "Saqlab bo'lmadi")
      );
    } finally {
      setReturnSaving(false);
    }
  };

  /* ═══════════════════════════ RENDER ═══════════════════════════ */
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#080d17] transition-colors duration-300">

      {/* ── sticky header ── */}
      <div className="sticky top-0 z-30 border-b border-gray-200 bg-white/90 backdrop-blur-xl dark:border-white/[0.05] dark:bg-[#080d17]/95">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-200 dark:shadow-emerald-900/40">
              <Droplets size={17} className="text-white" />
            </div>
            <div>
              <h1 className="text-[15px] font-bold tracking-tight text-gray-900 dark:text-white">
                {tr('Bottle Controller', 'Контроль бутылей', 'Idish nazorati')}
              </h1>
              <p className="text-[11px] text-gray-400 dark:text-white/35">
                {tr('Operator workspace', 'Рабочее место оператора', 'Operator ish maydoni')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {workspaceLoading && (
              <span className="hidden items-center gap-1.5 text-[11px] text-gray-400 dark:text-white/30 sm:flex">
                <Loader2 size={11} className="animate-spin" />
                {tr('Syncing…', 'Синхронизация…', 'Sinxronlash…')}
              </span>
            )}
            <button
              type="button"
              onClick={() => { void loadClients(); if (selectedClientId) void loadWorkspace(selectedClientId); }}
              className="group flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-[12px] font-semibold text-gray-600 shadow-sm transition-all hover:border-gray-300 hover:bg-gray-50 hover:text-gray-900 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-white/50 dark:hover:border-white/20 dark:hover:bg-white/[0.08] dark:hover:text-white"
            >
              <RefreshCw size={12} className="transition-transform duration-500 group-hover:rotate-180" />
              {tr('Refresh', 'Обновить', 'Yangilash')}
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1600px] space-y-5 px-6 py-6">

        {/* ── top row: selector + chips ── */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end">

          {/* Client selector dropdown */}
          <div ref={dropdownRef} className="relative flex-1">
            <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.15em] text-gray-400 dark:text-white/25">
              {tr('Active client', 'Активный клиент', 'Faol mijoz')}
            </label>

            <button
              type="button"
              onClick={() => setDropdownOpen((v) => !v)}
              className={`flex w-full items-center gap-4 rounded-2xl border px-5 py-4 text-left transition-all duration-200 ${
                dropdownOpen
                  ? 'border-emerald-400 bg-white shadow-lg shadow-emerald-100 dark:border-emerald-500/40 dark:bg-emerald-950/20 dark:shadow-emerald-950/30'
                  : 'border-gray-200 bg-white shadow-sm hover:border-gray-300 hover:shadow-md dark:border-white/[0.07] dark:bg-white/[0.03] dark:hover:border-white/[0.14] dark:hover:bg-white/[0.05]'
              }`}
            >
              {clientsLoading ? (
                <span className="flex items-center gap-2 text-[13px] text-gray-400 dark:text-white/30">
                  <Loader2 size={14} className="animate-spin" />
                  {tr('Loading clients…', 'Загрузка…', 'Yuklanmoqda…')}
                </span>
              ) : selectedClient ? (
                <>
                  <div
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${platformGradient[selectedClient.platform]} text-[12px] font-bold text-white shadow-lg`}
                  >
                    {clientAvatar(selectedClient)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-bold text-gray-900 dark:text-white">
                      {clientName(selectedClient)}
                    </p>
                    <p className="mt-0.5 truncate text-[12px] text-gray-400 dark:text-white/35">
                      {selectedClient.phone ?? selectedClient.username ?? selectedClient.id}
                      {selectedClient.preferred_language
                        ? ` · ${selectedClient.preferred_language.toUpperCase()}`
                        : ''}
                    </p>
                  </div>
                  {summary && (
                    <div className="shrink-0 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-center dark:border-emerald-500/20 dark:bg-emerald-500/10">
                      <p className="text-[22px] font-black leading-none text-emerald-600 dark:text-emerald-400">
                        {summary.total_outstanding_bottles_count}
                      </p>
                      <p className="mt-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-500/70 dark:text-emerald-400/50">
                        {tr('outstanding', 'бутылей', 'qoldiq')}
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <span className="text-[13px] text-gray-400 dark:text-white/25">
                  {tr('Select a client to begin…', 'Выберите клиента…', 'Mijozni tanlang…')}
                </span>
              )}
              <ChevronDown
                size={15}
                className={`ml-auto shrink-0 transition-transform duration-300 ${
                  dropdownOpen
                    ? 'rotate-180 text-emerald-500 dark:text-emerald-400'
                    : 'text-gray-400 dark:text-white/25'
                }`}
              />
            </button>

            {/* Dropdown panel */}
            {dropdownOpen && (
              <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-white/[0.08] dark:bg-[#0e1623]">
                {/* search */}
                <div className="border-b border-gray-100 p-3 dark:border-white/[0.05]">
                  <div className="relative">
                    <Search
                      size={13}
                      className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-white/25"
                    />
                    <input
                      autoFocus
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder={tr(
                        'Search name, phone, username…',
                        'Поиск по имени, телефону…',
                        'Ism, telefon, username…'
                      )}
                      className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 pl-9 pr-8 text-[12px] text-gray-800 placeholder-gray-400 outline-none focus:border-emerald-400 focus:bg-white dark:border-white/[0.06] dark:bg-white/[0.04] dark:text-white dark:placeholder-white/20 dark:focus:border-emerald-500/40"
                    />
                    {search && (
                      <button
                        type="button"
                        onClick={() => setSearch('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:text-white/25 dark:hover:text-white/50"
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>
                </div>

                <ul className="max-h-64 overflow-y-auto">
                  {filteredClients.length ? (
                    filteredClients.map((client) => {
                      const isActive = client.id === selectedClientId;
                      return (
                        <li key={client.id}>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedClientId(client.id);
                              setDropdownOpen(false);
                              setSearch('');
                            }}
                            className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors ${
                              isActive
                                ? 'bg-emerald-50 dark:bg-emerald-500/10'
                                : 'hover:bg-gray-50 dark:hover:bg-white/[0.03]'
                            }`}
                          >
                            <div
                              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${platformGradient[client.platform]} text-[11px] font-bold text-white`}
                            >
                              {clientAvatar(client)}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p
                                className={`truncate text-[13px] font-semibold ${
                                  isActive
                                    ? 'text-emerald-700 dark:text-emerald-400'
                                    : 'text-gray-800 dark:text-white/70'
                                }`}
                              >
                                {clientName(client)}
                              </p>
                              <p className="truncate text-[11px] text-gray-400 dark:text-white/25">
                                {client.phone ?? client.username ?? client.id}
                              </p>
                            </div>
                            {isActive && (
                              <CheckCircle2
                                size={14}
                                className="shrink-0 text-emerald-500 dark:text-emerald-400"
                              />
                            )}
                          </button>
                        </li>
                      );
                    })
                  ) : (
                    <li className="px-4 py-8 text-center text-[12px] text-gray-400 dark:text-white/20">
                      {tr('No clients found', 'Клиенты не найдены', 'Mijoz topilmadi')}
                    </li>
                  )}
                </ul>
              </div>
            )}
          </div>

          {/* info chips */}
          <div className="flex shrink-0 gap-2">
            <div className="flex items-center gap-2 rounded-xl border border-sky-100 bg-sky-50 px-4 py-3 dark:border-sky-500/15 dark:bg-sky-500/5">
              <ArrowRightLeft size={13} className="text-sky-500 dark:text-sky-400" />
              <span className="text-[12px] font-medium text-sky-600 dark:text-sky-400/60">
                {tr('Return flow only', 'Только возврат', 'Faqat qaytarish')}
              </span>
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 dark:border-amber-500/15 dark:bg-amber-500/5">
              <ShieldAlert size={13} className="text-amber-500 dark:text-amber-400/60" />
              <span className="text-[12px] font-medium text-amber-600 dark:text-amber-400/50">
                {tr('Manual add: N/A', 'Ручное: N/A', "Qo'lda: N/A")}
              </span>
            </div>
          </div>
        </div>

        {/* ═══ EMPTY STATE ═══ */}
        {!selectedClient ? (
          <div className="flex flex-col items-center justify-center rounded-3xl border border-gray-200 bg-white py-28 shadow-sm dark:border-white/[0.05] dark:bg-white/[0.015]">
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-emerald-200 blur-3xl dark:bg-emerald-500/15" />
              <div className="relative flex h-20 w-20 items-center justify-center rounded-3xl border border-emerald-200 bg-gradient-to-br from-emerald-100 to-teal-50 shadow-xl shadow-emerald-100 dark:border-emerald-500/20 dark:from-emerald-500/15 dark:to-teal-500/10 dark:shadow-none">
                <Droplets size={34} className="text-emerald-500 dark:text-emerald-400" />
              </div>
            </div>
            <h2 className="mt-7 text-xl font-bold text-gray-700 dark:text-white/70">
              {tr('Select a client to begin', 'Выберите клиента', 'Mijozni tanlang')}
            </h2>
            <p className="mt-2 max-w-sm text-center text-[13px] leading-6 text-gray-400 dark:text-white/25">
              {tr(
                'Bottle balances, return actions, and movement history will appear here.',
                'Балансы, возвраты и история движений загрузятся для выбранного клиента.',
                "Tanlangan mijoz uchun balans va harakatlar tarixi bu yerda ko'rinadi."
              )}
            </p>
          </div>
        ) : (
          <div className="space-y-5">

            {/* ═══ STAT CARDS ═══ */}
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              {(
                [
                  {
                    label: tr('Outstanding', 'Остаток', 'Qoldiq'),
                    value: String(summary?.total_outstanding_bottles_count ?? 0),
                    sub: tr('bottles', 'бутылей', 'ta idish'),
                    icon: <Droplets size={15} />,
                    light: 'text-emerald-600 bg-emerald-100',
                    dark: 'dark:text-emerald-400 dark:bg-emerald-400/10',
                    glow: 'from-emerald-400 to-teal-400',
                  },
                  {
                    label: tr('Held deposit', 'Удержан депозит', 'Ushlab turilgan'),
                    value: fmt(summary?.deposit_held_total_uzs ?? 0),
                    sub: 'UZS',
                    icon: <TrendingDown size={15} />,
                    light: 'text-sky-600 bg-sky-100',
                    dark: 'dark:text-sky-400 dark:bg-sky-400/10',
                    glow: 'from-sky-400 to-blue-400',
                  },
                  {
                    label: tr('Total charged', 'Начислено', 'Jami olingan'),
                    value: fmt(summary?.total_deposit_charged_uzs ?? 0),
                    sub: 'UZS',
                    icon: <Activity size={15} />,
                    light: 'text-violet-600 bg-violet-100',
                    dark: 'dark:text-violet-400 dark:bg-violet-400/10',
                    glow: 'from-violet-400 to-purple-400',
                  },
                  {
                    label: tr('Total refunded', 'Возвращено', 'Qaytarilgan'),
                    value: fmt(summary?.total_deposit_refunded_uzs ?? 0),
                    sub: 'UZS',
                    icon: <CheckCircle2 size={15} />,
                    light: 'text-amber-600 bg-amber-100',
                    dark: 'dark:text-amber-400 dark:bg-amber-400/10',
                    glow: 'from-amber-400 to-orange-400',
                  },
                ] as const
              ).map(({ label, value, sub, icon, light, dark, glow }) => (
                <div
                  key={label}
                  className="group relative overflow-hidden rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition-all hover:shadow-md dark:border-white/[0.06] dark:bg-white/[0.03] dark:hover:border-white/[0.12] dark:hover:bg-white/[0.05]"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-gray-400 dark:text-white/25">
                      {label}
                    </p>
                    <span className={`rounded-lg p-1.5 ${light} ${dark}`}>{icon}</span>
                  </div>
                  <p className="mt-3 text-[26px] font-black tracking-tight text-gray-900 leading-none dark:text-white">
                    {value}
                  </p>
                  <p className="mt-1.5 text-[11px] text-gray-400 dark:text-white/20">{sub}</p>
                  <div
                    className={`absolute -bottom-6 -right-6 h-24 w-24 rounded-full bg-gradient-to-br ${glow} opacity-[0.08] blur-xl transition-opacity group-hover:opacity-[0.16] dark:opacity-[0.06] dark:group-hover:opacity-[0.13]`}
                  />
                </div>
              ))}
            </div>

            {/* ═══ CLIENT PROFILE + RETURN FORM ═══ */}
            <div className="grid grid-cols-1 gap-5 xl:grid-cols-[300px_1fr]">

              {/* Client profile */}
              <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-white/[0.06] dark:bg-white/[0.03]">
                <p className="mb-5 text-[10px] font-bold uppercase tracking-[0.15em] text-gray-400 dark:text-white/20">
                  {tr('Client profile', 'Профиль клиента', 'Mijoz profili')}
                </p>

                <div className="flex items-center gap-4">
                  <div
                    className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${platformGradient[selectedClient.platform]} text-[13px] font-black text-white shadow-xl`}
                  >
                    {clientAvatar(selectedClient)}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-bold text-gray-900 dark:text-white">
                      {clientName(selectedClient)}
                    </p>
                    <span
                      className={`mt-1.5 inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                        selectedClient.platform === 'telegram'
                          ? 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-400'
                          : selectedClient.platform === 'instagram'
                          ? 'bg-pink-100 text-pink-700 dark:bg-pink-500/15 dark:text-pink-400'
                          : 'bg-gray-100 text-gray-600 dark:bg-slate-500/15 dark:text-slate-400'
                      }`}
                    >
                      {platformLabel(selectedClient.platform)}
                    </span>
                  </div>
                </div>

                <div className="mt-6 space-y-3.5 border-t border-gray-100 pt-5 dark:border-white/[0.04]">
                  {[
                    {
                      icon: <Phone size={12} />,
                      label: tr('Phone', 'Телефон', 'Telefon'),
                      value: selectedClient.phone ?? '—',
                    },
                    {
                      icon: <MapPin size={12} />,
                      label: tr('Address', 'Адрес', 'Manzil'),
                      value: selectedClient.address ?? '—',
                    },
                    {
                      icon: <User size={12} />,
                      label: tr('Username', 'Username', 'Username'),
                      value: selectedClient.username ?? '—',
                    },
                  ].map(({ icon, label, value }) => (
                    <div key={label} className="flex items-start gap-3">
                      <span className="mt-0.5 shrink-0 text-gray-300 dark:text-white/20">{icon}</span>
                      <div className="min-w-0">
                        <p className="text-[10px] font-medium text-gray-400 dark:text-white/20">{label}</p>
                        <p className="mt-0.5 truncate text-[12px] font-medium text-gray-600 dark:text-white/50">{value}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* deposit progress bar */}
                {summary && summary.total_deposit_charged_uzs > 0 && (
                  <div className="mt-5 border-t border-gray-100 pt-5 dark:border-white/[0.04]">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-[10px] font-medium text-gray-400 dark:text-white/20">
                        {tr('Deposit refund rate', 'Доля возврата депозита', 'Qaytarish darajasi')}
                      </span>
                      <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                        {Math.round(
                          (summary.total_deposit_refunded_uzs /
                            summary.total_deposit_charged_uzs) *
                            100
                        )}%
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-white/[0.05]">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-700"
                        style={{
                          width: `${Math.min(
                            100,
                            Math.round(
                              (summary.total_deposit_refunded_uzs /
                                summary.total_deposit_charged_uzs) *
                                100
                            )
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Return form */}
              <div
                className={`rounded-2xl border p-6 shadow-sm transition-all duration-300 ${
                  successPulse
                    ? 'border-emerald-300 bg-emerald-50/50 shadow-emerald-100 dark:border-emerald-500/50 dark:bg-emerald-950/20 dark:shadow-emerald-950/30'
                    : 'border-gray-200 bg-white dark:border-white/[0.06] dark:bg-white/[0.03]'
                }`}
              >
                {/* form header */}
                <div className="mb-6 flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-emerald-200 bg-emerald-50 dark:border-emerald-500/20 dark:bg-emerald-500/10">
                    <Undo2 size={16} className="text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-[14px] font-bold text-gray-900 dark:text-white">
                      {tr(
                        'Record bottle return',
                        'Записать возврат бутылей',
                        'Idish qaytarishni qayd etish'
                      )}
                    </p>
                    <p className="text-[11px] text-gray-400 dark:text-white/30">
                      {tr(
                        'Physical handback — reduces outstanding balance immediately',
                        'Физический возврат — сразу уменьшает остаток',
                        "Fizikaviy qaytarish — qoldiqni darhol kamaytiradi"
                      )}
                    </p>
                  </div>
                </div>

                <form onSubmit={handleReturnSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {/* product */}
                    <div>
                      <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.14em] text-gray-400 dark:text-white/25">
                        {tr('Product balance', 'Баланс продукта', 'Mahsulot balansi')}
                      </label>
                      <div className="relative">
                        <select
                          value={returnForm.product_id}
                          onChange={(e) =>
                            setReturnForm((p) => ({ ...p, product_id: e.target.value }))
                          }
                          className="w-full appearance-none rounded-xl border border-gray-200 bg-white px-4 py-3 text-[13px] font-medium text-gray-800 shadow-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-white/[0.07] dark:bg-white/[0.04] dark:text-white dark:focus:border-emerald-500/40 dark:focus:ring-0"
                        >
                          <option value="">
                            {tr('Choose product…', 'Выберите продукт…', 'Mahsulotni tanlang…')}
                          </option>
                          {balances.map((b) => (
                            <option key={b.id} value={b.product_id}>
                              {b.product_name}
                              {b.product_size_liters ? ` ${b.product_size_liters}L` : ''} —{' '}
                              {b.outstanding_bottles_count} {tr('pcs', 'шт.', 'ta')}
                            </option>
                          ))}
                        </select>
                        <ChevronDown
                          size={12}
                          className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-white/25"
                        />
                      </div>
                    </div>

                    {/* quantity */}
                    <div>
                      <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.14em] text-gray-400 dark:text-white/25">
                        {tr('Quantity', 'Количество', 'Soni')}
                      </label>
                      <input
                        type="number"
                        min="1"
                        max={selectedReturnBalance?.outstanding_bottles_count}
                        value={returnForm.quantity}
                        onChange={(e) =>
                          setReturnForm((p) => ({ ...p, quantity: e.target.value }))
                        }
                        disabled={returnForm.return_all}
                        className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-[13px] font-medium text-gray-800 shadow-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 disabled:opacity-40 dark:border-white/[0.07] dark:bg-white/[0.04] dark:text-white dark:focus:border-emerald-500/40 dark:focus:ring-0 dark:disabled:opacity-30"
                      />
                    </div>
                  </div>

                  {/* return all toggle */}
                  <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 transition hover:bg-gray-100 dark:border-white/[0.05] dark:bg-white/[0.025] dark:hover:bg-white/[0.04]">
                    <div
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-all duration-200 ${
                        returnForm.return_all
                          ? 'border-emerald-500 bg-emerald-500 shadow-sm shadow-emerald-200 dark:shadow-emerald-900/50'
                          : 'border-gray-300 bg-white dark:border-white/15 dark:bg-transparent'
                      }`}
                    >
                      {returnForm.return_all && <CheckCircle2 size={12} className="text-white" />}
                    </div>
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={returnForm.return_all}
                      onChange={(e) =>
                        setReturnForm((p) => ({ ...p, return_all: e.target.checked }))
                      }
                    />
                    <span className="flex-1 text-[13px] font-medium text-gray-600 dark:text-white/50">
                      {tr(
                        'Return all outstanding for this product',
                        'Вернуть все бутыли по этому продукту',
                        "Bu mahsulot bo'yicha barcha idishni qaytarish"
                      )}
                    </span>
                    {selectedReturnBalance && (
                      <span className="rounded-lg border border-gray-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-gray-500 dark:border-white/[0.07] dark:bg-white/[0.04] dark:text-white/30">
                        {selectedReturnBalance.outstanding_bottles_count}
                      </span>
                    )}
                  </label>
                  {/* note */}
                  <div>
                    <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.14em] text-gray-400 dark:text-white/25">
                      {tr('Operator note', 'Комментарий оператора', 'Operator izohi')}
                    </label>
                    <textarea
                      value={returnForm.note}
                      onChange={(e) =>
                        setReturnForm((p) => ({ ...p, note: e.target.value }))
                      }
                      rows={3}
                      placeholder={tr(
                        'E.g. client returned 2 empty bottles at the gate.',
                        'Напр.: клиент вернул 2 пустые бутыли у входа.',
                        "Masalan: eshik oldida 2 ta bo'sh idish qaytardi."
                      )}
                      className="w-full resize-none rounded-xl border border-gray-200 bg-white px-4 py-3 text-[13px] text-gray-800 placeholder-gray-300 shadow-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-white/[0.07] dark:bg-white/[0.04] dark:text-white dark:placeholder-white/15 dark:focus:border-emerald-500/40 dark:focus:ring-0"
                    />
                  </div>

                  <div className="flex justify-end pt-1">
                    <button
                      type="submit"
                      disabled={returnSaving || !balances.length}
                      className="group relative inline-flex items-center gap-2.5 overflow-hidden rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 px-7 py-3 text-[13px] font-bold text-white shadow-lg shadow-emerald-200 transition-all hover:shadow-emerald-300 hover:brightness-105 disabled:opacity-40 dark:shadow-emerald-950/50 dark:hover:shadow-emerald-950/70"
                    >
                      <div className="absolute inset-0 -translate-x-full bg-white/10 transition-transform duration-500 group-hover:translate-x-full" />
                      {returnSaving ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Undo2 size={14} />
                      )}
                      {returnSaving
                        ? tr('Saving…', 'Сохранение…', 'Saqlanmoqda…')
                        : tr('Save return', 'Сохранить возврат', 'Qaytarishni saqlash')}
                    </button>
                  </div>
                </form>
              </div>
            </div>

            {/* ═══ BALANCES TABLE ═══ */}
            <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-white/[0.06] dark:bg-white/[0.03]">
              <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4 dark:border-white/[0.05]">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gray-100 dark:bg-white/[0.05]">
                    <Package size={13} className="text-gray-500 dark:text-white/40" />
                  </div>
                  <p className="text-[13px] font-bold text-gray-700 dark:text-white/60">
                    {tr('Balances by product', 'Балансы по продуктам', "Mahsulotlar bo'yicha balans")}
                  </p>
                </div>
                {workspaceLoading && (
                  <Loader2 size={12} className="animate-spin text-gray-400 dark:text-white/20" />
                )}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-white/[0.03]">
                      {[
                        tr('Product', 'Продукт', 'Mahsulot'),
                        tr('Outstanding', 'Остаток', 'Qoldiq'),
                        tr('Held', 'Удержано', 'Ushlab turilgan'),
                        tr('Charged', 'Начислено', 'Olingan'),
                        tr('Refunded', 'Возвращено', 'Qaytarilgan'),
                        '',
                      ].map((h, i) => (
                        <th
                          key={i}
                          className={`bg-gray-50/70 px-6 py-3 text-[10px] font-bold uppercase tracking-[0.13em] text-gray-400 dark:bg-white/[0.015] dark:text-white/20 ${
                            i > 0 && i < 5 ? 'text-right' : ''
                          }`}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-white/[0.025]">
                    {balances.length ? (
                      balances.map((b) => (
                        <tr
                          key={b.id}
                          className="transition-colors hover:bg-gray-50 dark:hover:bg-white/[0.025]"
                        >
                          <td className="px-6 py-4">
                            <p className="text-[13px] font-bold text-gray-800 dark:text-white/75">
                              {b.product_name}
                            </p>
                            <p className="mt-0.5 text-[11px] text-gray-400 dark:text-white/25">
                              {b.product_size_liters ? `${b.product_size_liters}L` : '—'}
                              {b.product_sku ? ` · ${b.product_sku}` : ''}
                            </p>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <span className="inline-flex items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1 text-[13px] font-black text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400">
                              {b.outstanding_bottles_count}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right text-[13px] font-semibold text-gray-700 dark:text-white/55">
                            {fmt(b.deposit_held_uzs)}
                          </td>
                          <td className="px-6 py-4 text-right text-[13px] text-gray-500 dark:text-white/35">
                            {fmt(b.total_deposit_charged_uzs)}
                          </td>
                          <td className="px-6 py-4 text-right text-[13px] text-gray-500 dark:text-white/35">
                            {fmt(b.total_deposit_refunded_uzs)}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button
                              type="button"
                              onClick={() =>
                                setReturnForm((p) => ({
                                  ...p,
                                  product_id: b.product_id,
                                  return_all: false,
                                  quantity: '1',
                                }))
                              }
                              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[11px] font-bold text-emerald-700 transition-all hover:border-emerald-300 hover:bg-emerald-100 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400 dark:hover:border-emerald-500/40 dark:hover:bg-emerald-500/20"
                            >
                              <Undo2 size={11} />
                              {tr('Select', 'Выбрать', 'Tanlash')}
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-6 py-14 text-center text-[13px] text-gray-400 dark:text-white/15"
                        >
                          {workspaceLoading
                            ? tr('Loading…', 'Загрузка…', 'Yuklanmoqda…')
                            : tr(
                                'No bottle balances found.',
                                'Балансы не найдены.',
                                'Balans topilmadi.'
                              )}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ═══ MOVEMENT LOG ═══ */}
            <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-white/[0.06] dark:bg-white/[0.03]">
              <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4 dark:border-white/[0.05]">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gray-100 dark:bg-white/[0.05]">
                    <Activity size={13} className="text-gray-500 dark:text-white/40" />
                  </div>
                  <p className="text-[13px] font-bold text-gray-700 dark:text-white/60">
                    {tr('Movement audit log', 'Журнал движений', 'Harakatlar jurnali')}
                  </p>
                </div>
                <span className="rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1 text-[11px] font-semibold text-gray-400 dark:border-white/[0.06] dark:bg-white/[0.03] dark:text-white/25">
                  {movements.length}
                </span>
              </div>

              <div className="divide-y divide-gray-100 dark:divide-white/[0.025]">
                {movements.length ? (
                  movements.map((mv) => {
                    const colors = mvColors(mv.movement_type);
                    return (
                      <div
                        key={mv.id}
                        className="flex flex-col gap-4 px-6 py-5 transition-colors hover:bg-gray-50/70 dark:hover:bg-white/[0.02] lg:flex-row lg:items-center lg:justify-between"
                      >
                        {/* left: type + meta */}
                        <div className="flex items-start gap-4">
                          <div
                            className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border ${colors.badge}`}
                          >
                            {mvIcon(mv.movement_type)}
                          </div>
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-bold ${colors.badge}`}
                              >
                                {mvIcon(mv.movement_type)}
                                {mvLabel(mv.movement_type)}
                              </span>
                              <span className="text-[13px] font-semibold text-gray-800 dark:text-white/65">
                                {mv.product_name ?? '—'}
                                {mv.product_size_liters ? ` · ${mv.product_size_liters}L` : ''}
                              </span>
                              {mv.product_sku && (
                                <span className="rounded-md bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-400 dark:bg-white/[0.05] dark:text-white/25">
                                  {mv.product_sku}
                                </span>
                              )}
                            </div>
                            <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-gray-400 dark:text-white/20">
                              <span className="flex items-center gap-1">
                                <Clock size={10} />
                                {fmtDate(mv.created_at)}
                              </span>
                              {mv.actor && (
                                <>
                                  <span className="h-3 w-px bg-gray-200 dark:bg-white/10" />
                                  <span className="font-medium">{mv.actor}</span>
                                </>
                              )}
                              {mv.order_id && (
                                <>
                                  <span className="h-3 w-px bg-gray-200 dark:bg-white/10" />
                                  <span className="font-mono text-[10px]">
                                    {tr('Order', 'Заказ', 'Buyurtma')} #{mv.order_id.slice(0, 8)}
                                  </span>
                                </>
                              )}
                            </div>
                            {mv.note && (
                              <p className="mt-2 max-w-md rounded-lg border border-gray-100 bg-gray-50 px-3 py-1.5 text-[12px] italic text-gray-500 dark:border-white/[0.04] dark:bg-white/[0.025] dark:text-white/30">
                                {mv.note}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* right: delta chips */}
                        <div className="flex shrink-0 flex-wrap items-center gap-2 lg:gap-3">
                          {/* bottles delta */}
                          <div className="min-w-[80px] rounded-xl border border-gray-100 bg-gray-50 px-3 py-2.5 text-center dark:border-white/[0.05] dark:bg-white/[0.03]">
                            <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400 dark:text-white/20">
                              {tr('Bottles', 'Бутыли', 'Idish')} Δ
                            </p>
                            <p
                              className={`mt-1 text-[15px] font-black ${
                                mv.bottles_delta < 0
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : 'text-amber-600 dark:text-amber-400'
                              }`}
                            >
                              {mv.bottles_delta > 0 ? '+' : ''}
                              {mv.bottles_delta}
                            </p>
                          </div>

                          {/* deposit delta */}
                          <div className="min-w-[110px] rounded-xl border border-gray-100 bg-gray-50 px-3 py-2.5 text-center dark:border-white/[0.05] dark:bg-white/[0.03]">
                            <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400 dark:text-white/20">
                              {tr('Deposit', 'Депозит', 'Depozit')} Δ
                            </p>
                            <p
                              className={`mt-1 text-[13px] font-black ${
                                mv.deposit_delta_uzs < 0
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : 'text-amber-600 dark:text-amber-400'
                              }`}
                            >
                              {mv.deposit_delta_uzs > 0 ? '+' : ''}
                              {fmt(mv.deposit_delta_uzs)}
                            </p>
                          </div>

                          {/* balance flow */}
                          <div className="min-w-[100px] rounded-xl border border-gray-100 bg-gray-50 px-3 py-2.5 text-center dark:border-white/[0.05] dark:bg-white/[0.03]">
                            <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400 dark:text-white/20">
                              {tr('Balance', 'Баланс', 'Balans')}
                            </p>
                            <p className="mt-1 text-[13px] font-bold text-gray-600 dark:text-white/50">
                              {mv.balance_before_count ?? '—'}
                              <span className="mx-1 text-gray-300 dark:text-white/20">→</span>
                              {mv.balance_after_count ?? '—'}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <ClipboardList
                      size={22}
                      className="text-gray-300 dark:text-white/10"
                    />
                    <p className="mt-3 text-[13px] text-gray-400 dark:text-white/15">
                      {workspaceLoading
                        ? tr('Loading history…', 'Загрузка истории…', 'Yuklanmoqda…')
                        : tr(
                            'No movements yet for this client.',
                            'История движений пуста.',
                            "Bu mijoz uchun hali harakat yo'q."
                          )}
                    </p>
                  </div>
                )}
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
};

export default BottleController;