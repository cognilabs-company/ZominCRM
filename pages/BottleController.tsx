import React, { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  ArrowRightLeft,
  ClipboardList,
  Droplets,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  Undo2,
  Wallet,
  X,
  CheckCircle2,
} from 'lucide-react';
import { Badge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';
import { useLanguage } from '../context/LanguageContext';
import { useToast } from '../context/ToastContext';
import { ENDPOINTS, apiRequest } from '../services/api';

// ─── Types ────────────────────────────────────────────────────────────────────

type Platform = 'telegram' | 'instagram' | 'manual';
type ActionType = 'return' | 'refund' | 'increment';

interface ClientRow {
  id: string;
  platform: Platform;
  username?: string | null;
  full_name?: string | null;
  phone?: string | null;
  address?: string | null;
  preferred_language?: 'uz' | 'ru' | 'en' | null;
  has_phone?: boolean;
  is_platform_identity_verified?: boolean;
  can_receive_telegram?: boolean;
  created_at?: string;
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
  movement_type: string;
  bottles_delta?: number;
  quantity?: number;
  deposit_delta_uzs: number;
  actor?: string | null;
  note?: string | null;
  created_at: string;
}

interface ReturnableProduct {
  id: string;
  name: string;
  sku?: string | null;
  size_liters?: string | null;
  requires_returnable_bottle?: boolean;
  bottle_deposit_uzs?: number;
  is_active?: boolean;
}

interface ReturnFormState {
  product_id: string;
  quantity: string;
  note: string;
}

interface RefundFormState {
  product_id: string;
  quantity: string;
  refund_all: boolean;
  note: string;
}

interface IncrementFormState {
  product_id: string;
  quantity: string;
  note: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const parseQuantity = (value: string): number => {
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

// ─── Sub-components ───────────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: string | number;
  highlight?: boolean;
}

const StatCard: React.FC<StatCardProps> = ({ label, value, highlight }) => (
  <div className={`rounded-2xl border px-4 py-4 ${highlight ? 'border-blue-200 bg-blue-50 dark:border-blue-500/20 dark:bg-blue-500/10' : 'border-light-border bg-slate-50 dark:border-white/10 dark:bg-navy-900'}`}>
    <p className="text-xs font-medium uppercase tracking-widest text-slate-500 dark:text-white/40">{label}</p>
    <p className={`mt-2 text-xl font-bold ${highlight ? 'text-blue-700 dark:text-blue-300' : 'text-slate-900 dark:text-white'}`}>{value}</p>
  </div>
);

interface FormFieldProps {
  label: string;
  children: React.ReactNode;
}

const FormField: React.FC<FormFieldProps> = ({ label, children }) => (
  <div className="space-y-1.5">
    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-white/40">{label}</label>
    {children}
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────

const BottleController: React.FC = () => {
  const { language } = useLanguage();
  const toast = useToast();
  const location = useLocation();

  const tr = (en: string, ru: string, uz: string) =>
    language === 'ru' ? ru : language === 'uz' ? uz : en;

  // ── State ──────────────────────────────────────────────────────────────────

  const [clients, setClients] = useState<ClientRow[]>([]);
  const [returnableProducts, setReturnableProducts] = useState<ReturnableProduct[]>([]);
  const [clientsLoading, setClientsLoading] = useState(true);
  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const [returnSaving, setReturnSaving] = useState(false);
  const [refundSaving, setRefundSaving] = useState(false);
  const [incrementSaving, setIncrementSaving] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [search, setSearch] = useState('');
  const [summary, setSummary] = useState<BottleSummary | null>(null);
  const [balances, setBalances] = useState<BottleBalance[]>([]);
  const [movements, setMovements] = useState<BottleMovement[]>([]);
  const [returnForm, setReturnForm] = useState<ReturnFormState>({ product_id: '', quantity: '1', note: '' });
  const [refundForm, setRefundForm] = useState<RefundFormState>({ product_id: '', quantity: '1', refund_all: false, note: '' });
  const [incrementForm, setIncrementForm] = useState<IncrementFormState>({ product_id: '', quantity: '1', note: '' });

  // ── Derived ────────────────────────────────────────────────────────────────

  const requestedClientId = useMemo(() => {
    return new URLSearchParams(location.search).get('client_id') || '';
  }, [location.search]);

  const selectedClient = useMemo(
    () => clients.find((c) => c.id === selectedClientId) ?? null,
    [clients, selectedClientId]
  );

  const filteredClients = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return clients;
    return clients.filter((c) =>
      [c.full_name, c.phone, c.username, c.address, c.id]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(keyword)
    );
  }, [clients, search]);

  const balanceByProductId = useMemo(() => {
    const map = new Map<string, BottleBalance>();
    balances.forEach((b) => map.set(b.product_id, b));
    return map;
  }, [balances]);

  const selectedReturnBalance = useMemo(
    () => (returnForm.product_id ? balanceByProductId.get(returnForm.product_id) ?? null : null),
    [balanceByProductId, returnForm.product_id]
  );

  const selectedRefundBalance = useMemo(
    () => (refundForm.product_id ? balanceByProductId.get(refundForm.product_id) ?? null : null),
    [balanceByProductId, refundForm.product_id]
  );

  const selectedIncrementProduct = useMemo(
    () => returnableProducts.find((p) => p.id === incrementForm.product_id) ?? null,
    [returnableProducts, incrementForm.product_id]
  );

  // ── Formatters ─────────────────────────────────────────────────────────────

  const locale = language === 'ru' ? 'ru-RU' : language === 'en' ? 'en-US' : 'uz-UZ';

  const formatCurrency = (value: number) =>
    `${Math.round(value || 0).toLocaleString(locale)} UZS`;

  const formatDate = (value?: string | null) => {
    if (!value) return '—';
    const d = new Date(value);
    return isNaN(d.getTime()) ? value : d.toLocaleString(locale, {
      year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit',
    });
  };

  const platformLabel = (p: Platform) =>
    p === 'instagram' ? 'Instagram' : p === 'manual' ? tr('Manual', 'Ручной', "Qo'lda") : 'Telegram';

  const languageLabel = (v?: ClientRow['preferred_language']) =>
    v === 'ru' ? 'RU' : v === 'en' ? 'EN' : v === 'uz' ? 'UZ' : '—';

  const clientDisplayName = (c: ClientRow) =>
    c.full_name || c.phone || c.username || c.id.slice(0, 8);

  const movementLabel = (v: string) => {
    const map: Record<string, string> = {
      MANUAL_ADJUST: tr('Manual adjust', 'Ручная корректировка', "Qo'lda o'zgartirish"),
      REFUND: tr('Refund', 'Возврат депозита', 'Depozit qaytarildi'),
      RETURN: tr('Bottle return', 'Возврат бутылок', 'Idish qaytimi'),
      DELIVERY: tr('Delivery', 'Доставка', 'Yetkazib berish'),
      ORDER_DELIVERED: tr('Delivery', 'Доставка', 'Yetkazib berish'),
    };
    return map[v] ?? v;
  };

  const movementVariant = (v: string): 'warning' | 'success' | 'info' | 'purple' | 'default' => {
    if (v === 'MANUAL_ADJUST') return 'warning';
    if (v === 'REFUND') return 'success';
    if (v === 'RETURN') return 'info';
    if (v === 'DELIVERY' || v === 'ORDER_DELIVERED') return 'purple';
    return 'default';
  };

  // ── Preview calculations ───────────────────────────────────────────────────

  const returnPreviewQty = selectedReturnBalance
    ? Math.min(parseQuantity(returnForm.quantity), selectedReturnBalance.outstanding_bottles_count)
    : 0;

  const refundPreviewQty = selectedRefundBalance
    ? refundForm.refund_all
      ? selectedRefundBalance.outstanding_bottles_count
      : Math.min(parseQuantity(refundForm.quantity), selectedRefundBalance.outstanding_bottles_count)
    : 0;

  const refundPreviewAmount = refundPreviewQty * Number(selectedRefundBalance?.bottle_deposit_uzs ?? 0);

  const incrementPreviewQty = parseQuantity(incrementForm.quantity);
  const incrementPreviewAmount =
    incrementPreviewQty *
    Number(
      selectedIncrementProduct?.bottle_deposit_uzs ??
      balanceByProductId.get(incrementForm.product_id)?.bottle_deposit_uzs ??
      0
    );

  // ── Data loaders ───────────────────────────────────────────────────────────

  const loadClients = async (): Promise<ClientRow[]> => {
    const data = await apiRequest<{ results?: ClientRow[] } | ClientRow[]>(ENDPOINTS.CLIENTS.LIST);
    const rows = Array.isArray(data) ? data : data.results ?? [];
    setClients(rows);
    return rows;
  };

  const loadReturnableProducts = async (): Promise<ReturnableProduct[]> => {
    const data = await apiRequest<{ results?: ReturnableProduct[] } | ReturnableProduct[]>(ENDPOINTS.PRODUCTS.LIST_CREATE);
    const rows = Array.isArray(data) ? data : data.results ?? [];
    const filtered = rows.filter((p) => p.requires_returnable_bottle && p.is_active !== false);
    setReturnableProducts(filtered);
    return filtered;
  };

  const loadWorkspace = async (clientId: string) => {
    setWorkspaceLoading(true);
    try {
      const [balanceData, movementData] = await Promise.all([
        apiRequest<{ summary?: BottleSummary; results?: BottleBalance[] }>(
          ENDPOINTS.CLIENTS.BOTTLE_BALANCES(clientId)
        ),
        apiRequest<{ results?: BottleMovement[] }>(
          `${ENDPOINTS.BOTTLES.MOVEMENTS}?client_id=${encodeURIComponent(clientId)}`
        ),
      ]);

      const nextBalances = balanceData.results ?? [];
      setSummary(balanceData.summary ?? null);
      setBalances(nextBalances);
      setMovements(movementData.results ?? []);

      const firstId = nextBalances[0]?.product_id ?? '';
      const firstProductId = returnableProducts[0]?.id ?? '';
      setReturnForm({ product_id: firstId, quantity: '1', note: '' });
      setRefundForm({ product_id: firstId, quantity: '1', refund_all: false, note: '' });
      setIncrementForm({ product_id: firstId || firstProductId, quantity: '1', note: '' });
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : tr('Failed to load bottle workspace.', 'Не удалось загрузить страницу бутылок.', "Idish sahifasini yuklab bo'lmadi.")
      );
      setSummary(null);
      setBalances([]);
      setMovements([]);
    } finally {
      setWorkspaceLoading(false);
    }
  };

  // ── Effects ────────────────────────────────────────────────────────────────

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        setClientsLoading(true);
        const [loadedClients] = await Promise.all([loadClients(), loadReturnableProducts()]);
        if (!active) return;

        if (requestedClientId && loadedClients.some((c) => c.id === requestedClientId)) {
          setSelectedClientId(requestedClientId);
        } else if (loadedClients[0]) {
          setSelectedClientId((cur) =>
            cur && loadedClients.some((c) => c.id === cur) ? cur : loadedClients[0].id
          );
        }
      } catch (err) {
        if (!active) return;
        toast.error(
          err instanceof Error
            ? err.message
            : tr('Failed to load bottle tools.', 'Не удалось загрузить инструменты.', "Idish oynasini yuklab bo'lmadi.")
        );
      } finally {
        if (active) setClientsLoading(false);
      }
    })();
    return () => { active = false; };
  }, [requestedClientId]);

  useEffect(() => {
    if (!clients.length) return;
    if (requestedClientId && clients.some((c) => c.id === requestedClientId) && selectedClientId !== requestedClientId) {
      setSelectedClientId(requestedClientId);
      return;
    }
    if (!selectedClientId || !clients.some((c) => c.id === selectedClientId)) {
      setSelectedClientId(clients[0].id);
    }
  }, [clients, requestedClientId]);

  useEffect(() => {
    if (!selectedClientId) {
      setSummary(null);
      setBalances([]);
      setMovements([]);
      return;
    }
    void loadWorkspace(selectedClientId);
  }, [selectedClientId]);

  useEffect(() => {
    if (!balances.length) return;
    const firstId = balances[0].product_id;
    if (!returnForm.product_id || !balanceByProductId.has(returnForm.product_id))
      setReturnForm((s) => ({ ...s, product_id: firstId }));
    if (!refundForm.product_id || !balanceByProductId.has(refundForm.product_id))
      setRefundForm((s) => ({ ...s, product_id: firstId, refund_all: false }));
  }, [balances]);

  useEffect(() => {
    if (incrementForm.product_id) {
      const valid = new Set([
        ...returnableProducts.map((p) => p.id),
        ...balances.map((b) => b.product_id),
      ]);
      if (!valid.has(incrementForm.product_id)) {
        setIncrementForm((s) => ({
          ...s,
          product_id: balances[0]?.product_id ?? returnableProducts[0]?.id ?? '',
        }));
      }
      return;
    }
    const fallback = balances[0]?.product_id ?? returnableProducts[0]?.id ?? '';
    if (fallback) setIncrementForm((s) => ({ ...s, product_id: fallback }));
  }, [returnableProducts, balances]);

  // ── Actions ────────────────────────────────────────────────────────────────

  const refreshAll = async () => {
    try {
      setClientsLoading(true);
      await Promise.all([loadClients(), loadReturnableProducts()]);
      if (selectedClientId) await loadWorkspace(selectedClientId);
      toast.success(tr('Refreshed.', 'Данные обновлены.', "Ma'lumotlar yangilandi."));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : tr('Refresh failed.', 'Ошибка обновления.', "Yangilab bo'lmadi."));
    } finally {
      setClientsLoading(false);
    }
  };

  const handleReturnSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClient) return;
    const qty = parseQuantity(returnForm.quantity);
    if (!returnForm.product_id) return toast.warning(tr('Select a product.', 'Выберите товар.', 'Mahsulotni tanlang.'));
    if (qty <= 0) return toast.warning(tr('Quantity must be > 0.', 'Количество должно быть > 0.', "Soni 0 dan katta bo'lishi kerak."));
    try {
      setReturnSaving(true);
      await apiRequest(ENDPOINTS.CLIENTS.BOTTLE_RETURNS(selectedClient.id), {
        method: 'POST',
        body: JSON.stringify({ product_id: returnForm.product_id, quantity: qty, note: returnForm.note.trim() }),
      });
      toast.success(tr('Bottle return saved.', 'Возврат бутылок сохранён.', 'Idish qaytimi saqlandi.'));
      await loadWorkspace(selectedClient.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : tr('Failed to save return.', 'Ошибка сохранения.', "Saqlab bo'lmadi."));
    } finally {
      setReturnSaving(false);
    }
  };

  const handleRefundSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClient) return;
    const qty = parseQuantity(refundForm.quantity);
    if (!refundForm.product_id) return toast.warning(tr('Select a product.', 'Выберите товар.', 'Mahsulotni tanlang.'));
    if (!refundForm.refund_all && qty <= 0) return toast.warning(tr('Quantity must be > 0.', 'Количество должно быть > 0.', "Soni 0 dan katta bo'lishi kerak."));
    try {
      setRefundSaving(true);
      await apiRequest(ENDPOINTS.CLIENTS.BOTTLE_REFUNDS(selectedClient.id), {
        method: 'POST',
        body: JSON.stringify({
          product_id: refundForm.product_id,
          quantity: refundForm.refund_all ? (selectedRefundBalance?.outstanding_bottles_count ?? 0) : qty,
          refund_all: refundForm.refund_all,
          note: refundForm.note.trim(),
        }),
      });
      toast.success(tr('Deposit refund saved.', 'Возврат депозита сохранён.', 'Depozit qaytimi saqlandi.'));
      await loadWorkspace(selectedClient.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : tr('Failed to save refund.', 'Ошибка сохранения.', "Saqlab bo'lmadi."));
    } finally {
      setRefundSaving(false);
    }
  };

  const handleIncrementSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClient) return;
    const qty = parseQuantity(incrementForm.quantity);
    if (!incrementForm.product_id) return toast.warning(tr('Select a product.', 'Выберите товар.', 'Mahsulotni tanlang.'));
    if (qty <= 0) return toast.warning(tr('Quantity must be > 0.', 'Количество должно быть > 0.', "Soni 0 dan katta bo'lishi kerak."));
    try {
      setIncrementSaving(true);
      await apiRequest(ENDPOINTS.CLIENTS.BOTTLE_INCREMENTS(selectedClient.id), {
        method: 'POST',
        body: JSON.stringify({ product_id: incrementForm.product_id, quantity: qty, note: incrementForm.note.trim(), actor: 'admin-ui' }),
      });
      toast.success(tr('Bottle balance increased.', 'Баланс бутылок увеличен.', 'Idish balansi oshirildi.'));
      await loadWorkspace(selectedClient.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : tr('Failed to add bottles.', 'Ошибка добавления.', "Qo'shib bo'lmadi."));
    } finally {
      setIncrementSaving(false);
    }
  };

  const selectBalanceForAction = (productId: string, action: ActionType) => {
    if (action === 'return') setReturnForm({ product_id: productId, quantity: '1', note: '' });
    else if (action === 'refund') setRefundForm({ product_id: productId, quantity: '1', refund_all: false, note: '' });
    else setIncrementForm({ product_id: productId, quantity: '1', note: '' });
  };

  // ── Shared class tokens ────────────────────────────────────────────────────

  const inputCls =
    'w-full rounded-xl border border-light-border bg-slate-50 px-3.5 py-2.5 text-sm text-slate-800 outline-none transition focus:border-primary-blue focus:bg-white focus:ring-2 focus:ring-primary-blue/10 dark:border-white/10 dark:bg-navy-900 dark:text-white dark:focus:border-blue-500 dark:focus:bg-navy-800 disabled:opacity-50';

  const btnCls = (color: string) =>
    `inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50 ${color}`;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* ── Page header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            {tr('Bottle Control', 'Управление бутылками', 'Idish nazorati')}
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-white/50">
            {tr(
              'Manage bottle adds, returns and deposit refunds in one place.',
              'Добавление бутылок, возвраты и депозиты в одном окне.',
              "Idish qo'shish, qaytarish va depozitni bitta joyda boshqaring."
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refreshAll()}
          disabled={clientsLoading || workspaceLoading}
          className="inline-flex items-center gap-2 rounded-xl border border-light-border bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-white/10 dark:bg-navy-800 dark:text-white dark:hover:bg-navy-700"
        >
          <RefreshCw size={15} className={clientsLoading || workspaceLoading ? 'animate-spin' : ''} />
          {tr('Refresh', 'Обновить', 'Yangilash')}
        </button>
      </div>

      {/* ── Info cards ── */}
      <div className="grid gap-4 md:grid-cols-3">
        {[
          {
            icon: <Plus size={18} />,
            color: 'text-blue-600 bg-blue-50 dark:bg-blue-500/15 dark:text-blue-300',
            title: tr('Add bottles', 'Добавить бутылки', "Idish qo'shish"),
            desc: tr(
              'Client received bottles outside a normal order.',
              'Клиент получил бутылки вне обычного заказа.',
              "Mijoz buyurtmadan tashqari idish olganida ishlating."
            ),
          },
          {
            icon: <ArrowRightLeft size={18} />,
            color: 'text-amber-600 bg-amber-50 dark:bg-amber-500/15 dark:text-amber-300',
            title: tr('Return bottles', 'Принять бутылки', 'Idish qaytimi'),
            desc: tr(
              'Record empty bottles returned by the client.',
              'Фиксируйте пустые бутылки, вернувшиеся от клиента.',
              "Bo'sh idish mijozdan qaytganda qayd qiling."
            ),
          },
          {
            icon: <Wallet size={18} />,
            color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-500/15 dark:text-emerald-300',
            title: tr('Refund deposit', 'Вернуть депозит', 'Depozit qaytarish'),
            desc: tr(
              'Return money to client after bottles are accepted.',
              'Верните деньги клиенту после приёма бутылок.',
              "Idish qabul qilinib pul qaytarilishi kerak bo'lsa ishlating."
            ),
          },
        ].map(({ icon, color, title, desc }, i) => (
          <Card key={i} className="h-full">
            <div className="flex items-start gap-4">
              <div className={`rounded-2xl p-3 ${color}`}>{icon}</div>
              <div>
                <h3 className="font-semibold text-slate-900 dark:text-white">{title}</h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-white/50">{desc}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* ── Client selector ── */}
      <Card title={tr('Select client', 'Выбор клиента', 'Mijoz tanlash')}>
        {/* Search input */}
        <div className="relative">
          <Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-white/30" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={tr('Search by name, phone, username\u2026', 'Poisk po imeni, telefonu, niku\u2026', "Ism, telefon yoki login bo'yicha\u2026")}
            className="w-full rounded-xl border border-light-border bg-slate-50 py-2.5 pl-9 pr-9 text-sm text-slate-800 outline-none transition focus:border-primary-blue focus:bg-white focus:ring-2 focus:ring-primary-blue/10 dark:border-white/10 dark:bg-navy-900 dark:text-white dark:placeholder:text-white/30 dark:focus:border-blue-500"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-0.5 text-slate-400 transition hover:text-slate-600 dark:text-white/30 dark:hover:text-white/70"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Client list */}
        <div className="mt-3 overflow-hidden rounded-xl border border-light-border dark:border-white/10">
          {clientsLoading ? (
            <div className="flex items-center gap-2.5 px-4 py-4 text-sm text-slate-500 dark:text-white/40">
              <Loader2 size={14} className="animate-spin" />
              {tr('Loading clients…', 'Загрузка клиентов…', 'Mijozlar yuklanmoqda…')}
            </div>
          ) : filteredClients.length === 0 ? (
            <div className="px-4 py-5 text-center text-sm text-slate-400 dark:text-white/30">
              {tr('No clients found.', 'Клиенты не найдены.', 'Mijoz topilmadi.')}
            </div>
          ) : (
            <div className="max-h-72 divide-y divide-light-border overflow-y-auto dark:divide-white/10">
              {filteredClients.map((client) => {
                const name = clientDisplayName(client);
                const sub = [client.phone, client.address, platformLabel(client.platform)].filter(Boolean).join(' · ');
                const active = client.id === selectedClientId;
                return (
                  <button
                    key={client.id}
                    type="button"
                    onClick={() => setSelectedClientId(client.id)}
                    className={`flex w-full items-center gap-3.5 px-4 py-3 text-left transition ${active ? 'bg-blue-50 dark:bg-blue-500/10' : 'hover:bg-slate-50 dark:hover:bg-white/[0.03]'}`}
                  >
                    {/* Avatar */}
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${active ? 'bg-primary-blue text-white' : 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-white/60'}`}>
                      {name.charAt(0).toUpperCase()}
                    </div>

                    {/* Name + sub */}
                    <div className="min-w-0 flex-1">
                      <p className={`truncate text-sm font-semibold ${active ? 'text-primary-blue dark:text-blue-400' : 'text-slate-900 dark:text-white'}`}>
                        {name}
                      </p>
                      <p className="truncate text-xs text-slate-400 dark:text-white/35">{sub}</p>
                    </div>

                    {/* Platform + check */}
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="hidden rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-500 dark:bg-white/10 dark:text-white/40 sm:block">
                        {platformLabel(client.platform)}
                      </span>
                      {active && <CheckCircle2 size={16} className="text-primary-blue dark:text-blue-400" />}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer: count + badges */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-slate-400 dark:text-white/30">
            {filteredClients.length} {tr('clients', 'клиентов', 'mijoz')}
            {search ? ` ${tr('found', 'найдено', 'topildi')}` : ''}
          </p>
          {selectedClient && (
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge variant="info">{platformLabel(selectedClient.platform)}</Badge>
              <Badge variant="default">{languageLabel(selectedClient.preferred_language)}</Badge>
              {selectedClient.has_phone
                ? <Badge variant="success">{tr('Phone', 'Телефон', 'Telefon')}</Badge>
                : <Badge variant="warning">{tr('No phone', 'Нет телефона', "Telefon yo'q")}</Badge>}
              {selectedClient.can_receive_telegram && (
                <Badge variant="purple">Telegram</Badge>
              )}
            </div>
          )}
        </div>
      </Card>

      {/* ── No client selected ── */}
      {!selectedClient ? (
        <Card>
          <div className="flex flex-col items-center justify-center gap-3 py-14 text-center">
            <ShieldAlert size={32} className="text-slate-300 dark:text-white/20" />
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              {tr('No client selected', 'Клиент не выбран', 'Mijoz tanlanmagan')}
            </h2>
            <p className="max-w-sm text-sm text-slate-400 dark:text-white/40">
              {tr(
                'Choose a client above to manage their bottle balances and deposits.',
                'Выберите клиента выше для управления балансом бутылок и депозитами.',
                "Idish balansi va depozitni boshqarish uchun yuqoridan mijozni tanlang."
              )}
            </p>
          </div>
        </Card>
      ) : (
        <div className="space-y-6">

          {/* ── Client detail card ── */}
          <Card accent="blue">
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr),minmax(0,1fr)]">
              <div className="space-y-4">
                <div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="info">{platformLabel(selectedClient.platform)}</Badge>
                    <Badge variant="default">{languageLabel(selectedClient.preferred_language)}</Badge>
                    {selectedClient.is_platform_identity_verified
                      ? <Badge variant="success">{tr('Verified', 'Подтверждён', 'Tasdiqlangan')}</Badge>
                      : <Badge variant="warning">{tr('Unverified', 'Не подтверждён', 'Tasdiqlanmagan')}</Badge>}
                  </div>
                  <h2 className="mt-3 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                    {clientDisplayName(selectedClient)}
                  </h2>
                  <p className="mt-1.5 text-sm text-slate-500 dark:text-white/50">
                    {selectedClient.phone ?? tr('No phone', 'Нет телефона', "Telefon yo'q")}
                    {selectedClient.address ? ` · ${selectedClient.address}` : ''}
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <StatCard highlight label={tr('Outstanding', 'На руках', 'Mijozdagi')} value={summary?.total_outstanding_bottles_count ?? 0} />
                  <StatCard label={tr('Held deposit', 'Депозит', 'Depozit')} value={formatCurrency(summary?.deposit_held_total_uzs ?? 0)} />
                  <StatCard label={tr('Refunded', 'Возвращено', 'Qaytarilgan')} value={formatCurrency(summary?.total_deposit_refunded_uzs ?? 0)} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <StatCard label={tr('Balance rows', 'Строк баланса', 'Balans qatori')} value={balances.length} />
                <StatCard label={tr('Movements', 'Движений', 'Harakatlar')} value={movements.length} />
                <div className="col-span-2 rounded-2xl border border-light-border bg-slate-50 px-4 py-4 dark:border-white/10 dark:bg-navy-900">
                  <p className="text-xs font-medium uppercase tracking-widest text-slate-500 dark:text-white/40">
                    {tr('Client since', 'Klient sana', "Mijoz bo'lgan sana")}
                  </p>
                  <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">{formatDate(selectedClient.created_at)}</p>
                </div>
              </div>
            </div>
          </Card>

          {/* ── Action forms ── */}
          <div className="grid gap-6 2xl:grid-cols-3">

            {/* Add bottles */}
            <Card title={tr('Add bottles', 'Добавить бутылки', "Idish qo'shish")} action={<Droplets size={16} className="text-blue-500" />}>
              <form onSubmit={handleIncrementSubmit} className="space-y-4">
                <FormField label={tr('Product', 'Товар', 'Mahsulot')}>
                  <select
                    value={incrementForm.product_id}
                    onChange={(e) => setIncrementForm((s) => ({ ...s, product_id: e.target.value }))}
                    className={inputCls}
                  >
                    <option value="">{tr('Choose product', 'Выберите товар', 'Mahsulotni tanlang')}</option>
                    {returnableProducts.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}{p.size_liters ? ` · ${p.size_liters}L` : ''}
                      </option>
                    ))}
                  </select>
                </FormField>

                <FormField label={tr('Quantity', 'Количество', 'Soni')}>
                  <input
                    type="number" min="1" step="1"
                    value={incrementForm.quantity}
                    onChange={(e) => setIncrementForm((s) => ({ ...s, quantity: e.target.value }))}
                    className={inputCls}
                  />
                </FormField>

                <FormField label={tr('Note', 'Примечание', 'Izoh')}>
                  <textarea
                    rows={2}
                    value={incrementForm.note}
                    onChange={(e) => setIncrementForm((s) => ({ ...s, note: e.target.value }))}
                    placeholder={tr('Optional reason…', 'Причина (необяз.)…', 'Sabab (ixtiyoriy)…')}
                    className={inputCls}
                  />
                </FormField>

                <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm dark:border-blue-500/20 dark:bg-blue-500/10">
                  <p className="font-semibold text-blue-900 dark:text-blue-200">{tr('Preview', 'Предпросмотр', "Ko'rinish")}</p>
                  <p className="mt-0.5 text-blue-700 dark:text-blue-300">
                    {incrementPreviewQty} {tr('bottles', 'бутылок', 'idish')} · {formatCurrency(incrementPreviewAmount)}
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={incrementSaving || workspaceLoading || !incrementForm.product_id}
                  className={btnCls('bg-primary-blue hover:bg-blue-600')}
                >
                  {incrementSaving ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
                  {tr('Add bottles', 'Добавить бутылки', "Idish qo'shish")}
                </button>
              </form>
            </Card>

            {/* Return bottles */}
            <Card title={tr('Return bottles', 'Принять бутылки', 'Idish qaytimi')} action={<Undo2 size={16} className="text-amber-500" />}>
              <form onSubmit={handleReturnSubmit} className="space-y-4">
                <FormField label={tr('Product', 'Товар', 'Mahsulot')}>
                  <select
                    value={returnForm.product_id}
                    onChange={(e) => setReturnForm((s) => ({ ...s, product_id: e.target.value }))}
                    className={inputCls}
                  >
                    <option value="">{tr('Choose product', 'Выберите товар', 'Mahsulotni tanlang')}</option>
                    {balances.map((b) => (
                      <option key={b.id} value={b.product_id}>
                        {b.product_name}{b.product_size_liters ? ` · ${b.product_size_liters}L` : ''}
                      </option>
                    ))}
                  </select>
                </FormField>

                <FormField label={tr('Quantity', 'Количество', 'Soni')}>
                  <input
                    type="number" min="1" step="1"
                    value={returnForm.quantity}
                    onChange={(e) => setReturnForm((s) => ({ ...s, quantity: e.target.value }))}
                    className={inputCls}
                  />
                </FormField>

                <FormField label={tr('Note', 'Примечание', 'Izoh')}>
                  <textarea
                    rows={2}
                    value={returnForm.note}
                    onChange={(e) => setReturnForm((s) => ({ ...s, note: e.target.value }))}
                    placeholder={tr('Optional details…', 'Детали (необяз.)…', 'Tafsilot (ixtiyoriy)…')}
                    className={inputCls}
                  />
                </FormField>

                <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm dark:border-amber-500/20 dark:bg-amber-500/10">
                  <p className="font-semibold text-amber-900 dark:text-amber-200">{tr('Preview', 'Предпросмотр', "Ko'rinish")}</p>
                  <p className="mt-0.5 text-amber-700 dark:text-amber-300">
                    {returnPreviewQty} {tr('bottles returned', 'бутылок будет принято', 'idish qaytariladi')}
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={returnSaving || workspaceLoading || !returnForm.product_id}
                  className={btnCls('bg-amber-500 hover:bg-amber-600')}
                >
                  {returnSaving ? <Loader2 size={15} className="animate-spin" /> : <ArrowRightLeft size={15} />}
                  {tr('Save return', 'Сохранить возврат', 'Qaytimni saqlash')}
                </button>
              </form>
            </Card>

            {/* Refund deposit */}
            <Card title={tr('Refund deposit', 'Вернуть депозит', 'Depozit qaytarish')} action={<Wallet size={16} className="text-emerald-500" />}>
              <form onSubmit={handleRefundSubmit} className="space-y-4">
                <FormField label={tr('Product', 'Товар', 'Mahsulot')}>
                  <select
                    value={refundForm.product_id}
                    onChange={(e) => setRefundForm((s) => ({ ...s, product_id: e.target.value }))}
                    className={inputCls}
                  >
                    <option value="">{tr('Choose product', 'Выберите товар', 'Mahsulotni tanlang')}</option>
                    {balances.map((b) => (
                      <option key={b.id} value={b.product_id}>
                        {b.product_name}{b.product_size_liters ? ` · ${b.product_size_liters}L` : ''}
                      </option>
                    ))}
                  </select>
                </FormField>

                <div className="grid grid-cols-[1fr,auto] items-end gap-3">
                  <FormField label={tr('Quantity', 'Количество', 'Soni')}>
                    <input
                      type="number" min="1" step="1"
                      value={refundForm.quantity}
                      onChange={(e) => setRefundForm((s) => ({ ...s, quantity: e.target.value }))}
                      disabled={refundForm.refund_all}
                      className={inputCls}
                    />
                  </FormField>
                  <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-light-border px-3 py-2.5 text-sm text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:text-white/70 dark:hover:bg-white/5">
                    <input
                      type="checkbox"
                      checked={refundForm.refund_all}
                      onChange={(e) => setRefundForm((s) => ({ ...s, refund_all: e.target.checked }))}
                      className="h-4 w-4 rounded accent-primary-blue"
                    />
                    {tr('All', 'Все', 'Hammasi')}
                  </label>
                </div>

                <FormField label={tr('Note', 'Примечание', 'Izoh')}>
                  <textarea
                    rows={2}
                    value={refundForm.note}
                    onChange={(e) => setRefundForm((s) => ({ ...s, note: e.target.value }))}
                    placeholder={tr('Optional refund note…', 'Примечание к возврату…', 'Qaytim izohi…')}
                    className={inputCls}
                  />
                </FormField>

                <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm dark:border-emerald-500/20 dark:bg-emerald-500/10">
                  <p className="font-semibold text-emerald-900 dark:text-emerald-200">{tr('Preview', 'Предпросмотр', "Ko'rinish")}</p>
                  <p className="mt-0.5 text-emerald-700 dark:text-emerald-300">
                    {refundPreviewQty} {tr('bottles', 'бутылок', 'idish')} · {formatCurrency(refundPreviewAmount)}
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={refundSaving || workspaceLoading || !refundForm.product_id}
                  className={btnCls('bg-emerald-600 hover:bg-emerald-700')}
                >
                  {refundSaving ? <Loader2 size={15} className="animate-spin" /> : <Wallet size={15} />}
                  {tr('Save refund', 'Сохранить возврат', 'Qaytimni saqlash')}
                </button>
              </form>
            </Card>
          </div>

          {/* ── Bottle balances table ── */}
          <Card title={tr('Bottle balances', 'Баланс бутылок', 'Idish balansi')} action={<ClipboardList size={16} className="text-slate-400" />}>
            {workspaceLoading ? (
              <div className="flex items-center justify-center gap-2.5 rounded-xl border border-dashed border-light-border py-12 text-sm text-slate-400 dark:border-white/10 dark:text-white/30">
                <Loader2 size={15} className="animate-spin" />
                {tr('Loading…', 'Загрузка…', 'Yuklanmoqda…')}
              </div>
            ) : balances.length === 0 ? (
              <div className="rounded-xl border border-dashed border-light-border py-12 text-center text-sm text-slate-400 dark:border-white/10 dark:text-white/30">
                {tr('No bottle balances for this client yet.', 'У этого клиента нет баланса бутылок.', "Bu mijozda idish balansi yo'q.")}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr className="border-b border-light-border text-left dark:border-white/10">
                      {[
                        tr('Product', 'Товар', 'Mahsulot'),
                        tr('Outstanding', 'На руках', 'Mijozdagi'),
                        tr('Deposit held', 'Депозит', 'Depozit'),
                        tr('Updated', 'Обновлено', 'Yangilangan'),
                        tr('Actions', 'Действия', 'Amallar'),
                      ].map((h, i) => (
                        <th key={i} className={`pb-3 pr-4 text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-white/30 ${i === 4 ? 'text-right' : ''}`}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-light-border dark:divide-white/10">
                    {balances.map((b) => (
                      <tr key={b.id} className="align-middle">
                        <td className="py-4 pr-4">
                          <p className="font-semibold text-slate-900 dark:text-white">{b.product_name}</p>
                          <p className="mt-0.5 text-xs text-slate-400 dark:text-white/35">
                            {b.product_size_liters ? `${b.product_size_liters}L` : '—'}
                            {b.product_sku ? ` · ${b.product_sku}` : ''}
                          </p>
                        </td>
                        <td className="py-4 pr-4 text-sm font-bold text-slate-900 dark:text-white">
                          {b.outstanding_bottles_count}
                        </td>
                        <td className="py-4 pr-4 text-sm text-slate-600 dark:text-white/70">
                          {formatCurrency(b.deposit_held_uzs)}
                        </td>
                        <td className="py-4 pr-4 text-sm text-slate-400 dark:text-white/35">
                          {formatDate(b.updated_at)}
                        </td>
                        <td className="py-4 text-right">
                          <div className="inline-flex gap-2">
                            {(
                              [
                                { action: 'increment' as ActionType, label: tr('Add', 'Добавить', "Qo'shish"), cls: 'border-blue-200 text-blue-700 hover:bg-blue-50 dark:border-blue-500/30 dark:text-blue-400 dark:hover:bg-blue-500/10' },
                                { action: 'return' as ActionType, label: tr('Return', 'Принять', 'Qaytim'), cls: 'border-amber-200 text-amber-700 hover:bg-amber-50 dark:border-amber-500/30 dark:text-amber-400 dark:hover:bg-amber-500/10' },
                                { action: 'refund' as ActionType, label: tr('Refund', 'Вернуть', 'Qaytarish'), cls: 'border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-500/30 dark:text-emerald-400 dark:hover:bg-emerald-500/10' },
                              ] as const
                            ).map(({ action, label, cls }) => (
                              <button
                                key={action}
                                type="button"
                                onClick={() => selectBalanceForAction(b.product_id, action)}
                                className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${cls}`}
                              >
                                {label}
                              </button>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {/* ── Movements feed ── */}
          <Card title={tr('Recent movements', 'Последние движения', "So'nggi harakatlar")} action={<ShieldAlert size={16} className="text-slate-400" />}>
            {workspaceLoading ? (
              <div className="flex items-center justify-center gap-2.5 rounded-xl border border-dashed border-light-border py-12 text-sm text-slate-400 dark:border-white/10 dark:text-white/30">
                <Loader2 size={15} className="animate-spin" />
                {tr('Loading…', 'Загрузка…', 'Yuklanmoqda…')}
              </div>
            ) : movements.length === 0 ? (
              <div className="rounded-xl border border-dashed border-light-border py-12 text-center text-sm text-slate-400 dark:border-white/10 dark:text-white/30">
                {tr('No movement history yet.', 'История движений пуста.', "Harakatlar tarixi yo'q.")}
              </div>
            ) : (
              <div className="space-y-2.5">
                {movements.slice(0, 20).map((m) => {
                  const delta = typeof m.bottles_delta === 'number' ? m.bottles_delta : (m.quantity ?? 0);
                  return (
                    <div key={m.id} className="flex flex-col gap-3 rounded-xl border border-light-border bg-white px-4 py-4 sm:flex-row sm:items-start sm:justify-between dark:border-white/10 dark:bg-navy-900">
                      <div className="min-w-0 space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant={movementVariant(m.movement_type)}>{movementLabel(m.movement_type)}</Badge>
                          <span className={`text-sm font-bold ${delta >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                            {delta >= 0 ? '+' : ''}{delta}
                          </span>
                        </div>
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">
                          {m.product_name ?? tr('Unknown product', 'Неизвестный товар', "Noma'lum mahsulot")}
                        </p>
                        <p className="text-xs text-slate-400 dark:text-white/35">
                          {formatCurrency(m.deposit_delta_uzs ?? 0)}
                          {m.actor ? ` · ${m.actor}` : ''}
                          {m.order_id ? ` · #${m.order_id.slice(0, 8)}` : ''}
                        </p>
                        {m.note && <p className="text-sm text-slate-500 dark:text-white/60">{m.note}</p>}
                      </div>
                      <p className="shrink-0 text-xs text-slate-400 dark:text-white/30">{formatDate(m.created_at)}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

        </div>
      )}
    </div>
  );
};

export default BottleController;