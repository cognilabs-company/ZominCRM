import React, { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { ArrowRightLeft, ClipboardList, Droplets, Loader2, RefreshCw, Search, ShieldAlert, Undo2, Wallet } from 'lucide-react';
import { Badge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';
import { useLanguage } from '../context/LanguageContext';
import { useToast } from '../context/ToastContext';
import { ENDPOINTS, apiRequest } from '../services/api';

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

interface RefundFormState {
  product_id: string;
  quantity: string;
  refund_all: boolean;
  note: string;
}

const emptyReturnForm: ReturnFormState = {
  product_id: '',
  quantity: '1',
  return_all: false,
  note: '',
};

const emptyRefundForm: RefundFormState = {
  product_id: '',
  quantity: '1',
  refund_all: false,
  note: '',
};

const BottleController: React.FC = () => {
  const location = useLocation();
  const { language } = useLanguage();
  const toast = useToast();
  const tr = (en: string, ru: string, uz: string) => (language === 'ru' ? ru : language === 'uz' ? uz : en);

  const [clients, setClients] = useState<ClientRow[]>([]);
  const [clientsLoading, setClientsLoading] = useState(true);
  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const [returnSaving, setReturnSaving] = useState(false);
  const [refundSaving, setRefundSaving] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [summary, setSummary] = useState<BottleSummary | null>(null);
  const [balances, setBalances] = useState<BottleBalance[]>([]);
  const [movements, setMovements] = useState<BottleMovement[]>([]);
  const [returnForm, setReturnForm] = useState<ReturnFormState>(emptyReturnForm);
  const [refundForm, setRefundForm] = useState<RefundFormState>(emptyRefundForm);

  const requestedClientId = useMemo(
    () => new URLSearchParams(location.search).get('client_id'),
    [location.search]
  );

  const selectedClient = useMemo(
    () => clients.find((client) => client.id === selectedClientId) || null,
    [clients, selectedClientId]
  );

  const filteredClients = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return clients;

    return clients.filter((client) =>
      [
        client.full_name,
        client.phone,
        client.username,
        client.address,
        client.id,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(keyword)
    );
  }, [clients, search]);

  const selectedReturnBalance = useMemo(
    () => balances.find((balance) => balance.product_id === returnForm.product_id) || null,
    [balances, returnForm.product_id]
  );

  const selectedRefundBalance = useMemo(
    () => balances.find((balance) => balance.product_id === refundForm.product_id) || null,
    [balances, refundForm.product_id]
  );

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat(language === 'ru' ? 'ru-RU' : language === 'uz' ? 'uz-UZ' : 'en-US').format(value);

  const formatDate = (value?: string | null) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat(language === 'ru' ? 'ru-RU' : language === 'uz' ? 'uz-UZ' : 'en-US', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  const platformLabel = (platform: Platform) => {
    if (platform === 'instagram') return 'Instagram';
    if (platform === 'manual') return tr('Manual', 'Manual', "Qo'lda");
    return 'Telegram';
  };

  const movementLabel = (movementType: BottleMovement['movement_type']) => {
    if (movementType === 'RETURNED') return tr('Returned', 'Возврат бутылей', 'Qaytarildi');
    if (movementType === 'REFUND') return tr('Refunded', 'Возврат депозита', 'Depozit qaytarildi');
    if (movementType === 'ORDER_DELIVERED') return tr('Delivered order', 'Доставка', 'Yetkazilgan buyurtma');
    if (movementType === 'MANUAL_ADJUST') return tr('Manual adjust', 'Ручная корректировка', "Qo'lda tuzatish");
    return movementType;
  };

  const movementVariant = (movementType: BottleMovement['movement_type']) => {
    if (movementType === 'RETURNED') return 'success' as const;
    if (movementType === 'REFUND') return 'warning' as const;
    if (movementType === 'ORDER_DELIVERED') return 'info' as const;
    if (movementType === 'MANUAL_ADJUST') return 'purple' as const;
    return 'default' as const;
  };

  const resetActionForms = (rows: BottleBalance[]) => {
    const defaultProductId = rows[0]?.product_id || '';
    setReturnForm({
      product_id: defaultProductId,
      quantity: '1',
      return_all: false,
      note: '',
    });
    setRefundForm({
      product_id: defaultProductId,
      quantity: '1',
      refund_all: false,
      note: '',
    });
  };

  const loadClients = async () => {
    try {
      setClientsLoading(true);
      const data = await apiRequest<{ results?: ClientRow[] } | ClientRow[]>(ENDPOINTS.CLIENTS.LIST);
      const rows = Array.isArray(data) ? data : (data.results || []);
      setClients(rows);
      if (!selectedClientId && rows[0]) {
        setSelectedClientId(requestedClientId || rows[0].id);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : tr('Failed to load clients', 'Failed to load clients', 'Mijozlarni yuklab bo\'lmadi'));
    } finally {
      setClientsLoading(false);
    }
  };

  const loadWorkspace = async (clientId: string) => {
    try {
      setWorkspaceLoading(true);
      const [balanceData, movementData] = await Promise.all([
        apiRequest<{ summary?: BottleSummary; results?: BottleBalance[] }>(ENDPOINTS.CLIENTS.BOTTLE_BALANCES(clientId)),
        apiRequest<{ results?: BottleMovement[] }>(`${ENDPOINTS.BOTTLES.MOVEMENTS}?client_id=${encodeURIComponent(clientId)}&limit=30`),
      ]);
      const nextBalances = balanceData.results || [];
      setSummary(balanceData.summary || null);
      setBalances(nextBalances);
      setMovements(movementData.results || []);
      resetActionForms(nextBalances);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : tr('Failed to load bottle workspace', 'Failed to load bottle workspace', 'Idish oynasini yuklab bo\'lmadi'));
      setSummary(null);
      setBalances([]);
      setMovements([]);
      resetActionForms([]);
    } finally {
      setWorkspaceLoading(false);
    }
  };

  useEffect(() => {
    void loadClients();
  }, []);

  useEffect(() => {
    if (!clients.length || !requestedClientId) return;
    if (clients.some((client) => client.id === requestedClientId)) {
      setSelectedClientId(requestedClientId);
    }
  }, [clients, requestedClientId]);

  useEffect(() => {
    if (!selectedClientId) {
      setSummary(null);
      setBalances([]);
      setMovements([]);
      resetActionForms([]);
      return;
    }
    void loadWorkspace(selectedClientId);
  }, [selectedClientId]);

  const returnPreview = useMemo(() => {
    if (!selectedReturnBalance) return { quantity: 0, deposit: 0 };
    const quantity = returnForm.return_all
      ? selectedReturnBalance.outstanding_bottles_count
      : Math.max(0, Math.min(Number(returnForm.quantity || 0), selectedReturnBalance.outstanding_bottles_count));
    return {
      quantity,
      deposit: quantity * Number(selectedReturnBalance.bottle_deposit_uzs || 0),
    };
  }, [returnForm.quantity, returnForm.return_all, selectedReturnBalance]);

  const refundPreview = useMemo(() => {
    if (!selectedRefundBalance) return { quantity: 0, deposit: 0 };
    const quantity = refundForm.refund_all
      ? selectedRefundBalance.outstanding_bottles_count
      : Math.max(0, Math.min(Number(refundForm.quantity || 0), selectedRefundBalance.outstanding_bottles_count));
    return {
      quantity,
      deposit: quantity * Number(selectedRefundBalance.bottle_deposit_uzs || 0),
    };
  }, [refundForm.quantity, refundForm.refund_all, selectedRefundBalance]);

  const handleReturnSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedClient) return;
    if (!returnForm.product_id) {
      toast.error(tr('Select a product balance first', 'Select a product balance first', 'Avval mahsulotni tanlang'));
      return;
    }

    try {
      setReturnSaving(true);
      await apiRequest(ENDPOINTS.CLIENTS.BOTTLE_RETURNS(selectedClient.id), {
        method: 'POST',
        body: JSON.stringify({
          product_id: returnForm.product_id,
          quantity: Number(returnForm.quantity || 0),
          return_all: returnForm.return_all,
          note: returnForm.note.trim(),
          actor: 'admin-ui',
        }),
      });
      toast.success(tr('Bottle return recorded', 'Возврат бутылей сохранен', 'Idish qaytishi saqlandi'));
      await loadWorkspace(selectedClient.id);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : tr('Failed to save bottle return', 'Failed to save bottle return', 'Idish qaytishini saqlab bo\'lmadi'));
    } finally {
      setReturnSaving(false);
    }
  };

  const handleRefundSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedClient) return;
    if (!refundForm.product_id) {
      toast.error(tr('Select a product balance first', 'Select a product balance first', 'Avval mahsulotni tanlang'));
      return;
    }

    try {
      setRefundSaving(true);
      await apiRequest(ENDPOINTS.CLIENTS.BOTTLE_REFUNDS(selectedClient.id), {
        method: 'POST',
        body: JSON.stringify({
          product_id: refundForm.product_id,
          quantity: Number(refundForm.quantity || 0),
          refund_all: refundForm.refund_all,
          note: refundForm.note.trim(),
        }),
      });
      toast.success(tr('Bottle refund recorded', 'Возврат депозита сохранен', 'Depozit qaytarilishi saqlandi'));
      await loadWorkspace(selectedClient.id);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : tr('Failed to save bottle refund', 'Failed to save bottle refund', 'Depozit qaytarilishini saqlab bo\'lmadi'));
    } finally {
      setRefundSaving(false);
    }
  };

  const selectBalanceForAction = (productId: string, mode: 'return' | 'refund') => {
    if (mode === 'return') {
      setReturnForm((current) => ({ ...current, product_id: productId, return_all: false, quantity: '1' }));
      return;
    }
    setRefundForm((current) => ({ ...current, product_id: productId, refund_all: false, quantity: '1' }));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-light-text dark:text-white">{tr('Bottle Controller', 'Контроль бутылей', 'Idish nazorati')}</h1>
          <p className="mt-2 max-w-3xl text-sm text-gray-500 dark:text-gray-400">
            {tr(
              'A dedicated operator workspace for bottle returns, explicit refunds, and balance audit by client.',
              'Отдельное рабочее место оператора для возврата бутылей, явного возврата депозита и аудита баланса по клиенту.',
              'Mijoz bo\'yicha idish qaytarish, aniq depozit refund va balans auditini boshqarish uchun alohida operator oynasi.'
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            void loadClients();
            if (selectedClientId) {
              void loadWorkspace(selectedClientId);
            }
          }}
          className="inline-flex items-center gap-2 rounded-xl border border-light-border bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 dark:border-navy-700 dark:bg-navy-800 dark:text-gray-200 dark:hover:bg-navy-700"
        >
          <RefreshCw size={16} />
          {tr('Refresh workspace', 'Обновить', 'Oynani yangilash')}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="bg-[linear-gradient(135deg,rgba(237,248,244,0.96)_0%,rgba(255,255,255,1)_100%)]" accent="emerald">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-emerald-100 p-3 text-emerald-700">
              <ArrowRightLeft size={18} />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">{tr('Operational return flow', 'Операционный возврат', 'Operatsion qaytarish')}</p>
              <p className="mt-1 text-sm text-gray-600">
                {tr('Use this when empty bottles physically come back from the client.', 'Используйте, когда пустые бутыли физически возвращаются от клиента.', 'Bo\'sh idish mijozdan qaytganda shu oqimdan foydalaning.')}
              </p>
            </div>
          </div>
        </Card>

        <Card className="bg-[linear-gradient(135deg,rgba(255,248,233,0.96)_0%,rgba(255,255,255,1)_100%)]" accent="amber">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-amber-100 p-3 text-amber-700">
              <Wallet size={18} />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">{tr('Explicit refund flow', 'Явный возврат депозита', 'Aniq refund oqimi')}</p>
              <p className="mt-1 text-sm text-gray-600">
                {tr('Keep this for admin refund-style corrections or special financial actions.', 'Используйте только для явного возврата депозита или особых финансовых корректировок.', 'Buni faqat maxsus refund yoki moliyaviy tuzatishlar uchun qoldiring.')}
              </p>
            </div>
          </div>
        </Card>

        <Card className="bg-[linear-gradient(135deg,rgba(239,243,255,0.96)_0%,rgba(255,255,255,1)_100%)]" accent="blue">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-blue-100 p-3 text-blue-700">
              <ShieldAlert size={18} />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">{tr('Manual bottle add', 'Ручное добавление бутылей', 'Qo\'lda idish qo\'shish')}</p>
              <p className="mt-1 text-sm text-gray-600">
                {tr('A dedicated backend API for manual bottle increase is not connected yet, so this page only exposes the safe supported flows.', 'Отдельный API для ручного увеличения количества бутылей пока не подключен, поэтому страница показывает только безопасные поддерживаемые операции.', 'Qo\'lda idish sonini oshirish uchun alohida backend API hali ulanmagan, shu sabab bu sahifada faqat xavfsiz qo\'llab-quvvatlangan amallar ochiladi.')}
              </p>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <Card className="overflow-hidden !p-0">
          <div className="border-b border-light-border bg-white p-4 dark:border-navy-700 dark:bg-navy-800">
            <p className="text-sm font-semibold text-gray-900 dark:text-white">{tr('Clients', 'Клиенты', 'Mijozlar')}</p>
            <p className="mt-1 text-xs text-gray-500">{tr('Select a client to open bottle controls.', 'Выберите клиента, чтобы открыть управление бутылками.', 'Idish boshqaruvini ochish uchun mijozni tanlang.')}</p>
            <label className="relative mt-4 block">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={tr('Search by name, phone, username, or ID', 'Поиск по имени, телефону, username или ID', 'Ism, telefon, username yoki ID bo\'yicha qidiring')}
                className="w-full rounded-xl border border-light-border bg-gray-50 py-2.5 pl-9 pr-3 text-sm text-gray-800 outline-none focus:border-primary-blue dark:border-navy-700 dark:bg-navy-900 dark:text-white"
              />
            </label>
          </div>

          <div className="max-h-[720px] overflow-y-auto">
            {clientsLoading ? (
              <div className="flex items-center gap-2 px-4 py-5 text-sm text-gray-500">
                <Loader2 size={16} className="animate-spin" />
                {tr('Loading clients...', 'Загрузка клиентов...', 'Mijozlar yuklanmoqda...')}
              </div>
            ) : filteredClients.length ? (
              filteredClients.map((client) => {
                const isActive = client.id === selectedClientId;
                return (
                  <button
                    key={client.id}
                    type="button"
                    onClick={() => setSelectedClientId(client.id)}
                    className={`w-full border-b border-light-border px-4 py-4 text-left transition last:border-b-0 dark:border-navy-700 ${
                      isActive
                        ? 'bg-[linear-gradient(90deg,rgba(47,107,255,0.12)_0%,rgba(47,107,255,0.03)_100%)]'
                        : 'bg-white hover:bg-gray-50 dark:bg-navy-800 dark:hover:bg-navy-700/60'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className={`truncate text-sm font-semibold ${isActive ? 'text-primary-blue' : 'text-gray-900 dark:text-white'}`}>
                          {client.full_name || client.username || client.phone || client.id.slice(0, 8)}
                        </p>
                        <p className="mt-1 truncate text-xs text-gray-500">{client.phone || client.username || client.address || client.id}</p>
                      </div>
                      <Badge variant={client.platform === 'telegram' ? 'info' : client.platform === 'instagram' ? 'purple' : 'default'}>
                        {platformLabel(client.platform)}
                      </Badge>
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="px-4 py-8 text-sm text-gray-500">{tr('No clients found.', 'Клиенты не найдены.', 'Mijoz topilmadi.')}</div>
            )}
          </div>
        </Card>

        <div className="space-y-6">
          {!selectedClient ? (
            <Card className="bg-[linear-gradient(135deg,rgba(255,255,255,0.96)_0%,rgba(245,247,252,1)_100%)]">
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="rounded-3xl bg-blue-50 p-4 text-primary-blue">
                  <Droplets size={28} />
                </div>
                <p className="mt-4 text-lg font-semibold text-gray-900 dark:text-white">{tr('Choose a client first', 'Сначала выберите клиента', 'Avval mijozni tanlang')}</p>
                <p className="mt-2 max-w-md text-sm text-gray-500">{tr('The bottle controller opens balance, return actions, refund actions, and movement history for the selected client.', 'Контроллер бутылей откроет баланс, возвраты, refund-действия и историю движений для выбранного клиента.', 'Tanlangan mijoz uchun idish balansi, qaytarish, refund va harakatlar tarixi shu yerda ochiladi.')}</p>
              </div>
            </Card>
          ) : (
            <>
              <Card className="overflow-hidden bg-[linear-gradient(145deg,rgba(17,36,58,0.98)_0%,rgba(28,64,94,0.96)_55%,rgba(56,119,143,0.92)_100%)] text-white shadow-[0_18px_50px_rgba(11,18,32,0.18)]">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="info" className="border-white/10 bg-white/10 text-white">{platformLabel(selectedClient.platform)}</Badge>
                      {selectedClient.preferred_language ? (
                        <Badge variant="default" className="border-white/10 bg-white/10 text-white">
                          {selectedClient.preferred_language.toUpperCase()}
                        </Badge>
                      ) : null}
                    </div>
                    <h2 className="mt-4 truncate text-2xl font-semibold">{selectedClient.full_name || selectedClient.username || selectedClient.id.slice(0, 8)}</h2>
                    <p className="mt-2 text-sm text-white/75">{selectedClient.phone || tr('No phone', 'Телефон не указан', 'Telefon yo\'q')}</p>
                    <p className="mt-1 max-w-2xl text-sm text-white/65">{selectedClient.address || tr('No saved address', 'Адрес не указан', 'Saqlangan manzil yo\'q')}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:w-[480px]">
                    <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-white/55">{tr('Outstanding', 'Остаток', 'Qoldiq')}</p>
                      <p className="mt-2 text-xl font-semibold">{summary?.total_outstanding_bottles_count ?? 0}</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-white/55">{tr('Held deposit', 'Удержано', 'Ushlab turilgan')}</p>
                      <p className="mt-2 text-xl font-semibold">{formatCurrency(summary?.deposit_held_total_uzs ?? 0)}</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-white/55">{tr('Charged', 'Начислено', 'Olingan')}</p>
                      <p className="mt-2 text-xl font-semibold">{formatCurrency(summary?.total_deposit_charged_uzs ?? 0)}</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-white/55">{tr('Refunded', 'Возвращено', 'Qaytarilgan')}</p>
                      <p className="mt-2 text-xl font-semibold">{formatCurrency(summary?.total_deposit_refunded_uzs ?? 0)}</p>
                    </div>
                  </div>
                </div>
              </Card>

              <div className="grid grid-cols-1 gap-6 2xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
                <Card accent="emerald" className="bg-[linear-gradient(135deg,rgba(245,252,248,0.98)_0%,rgba(255,255,255,1)_100%)]">
                  <div className="flex items-start gap-3">
                    <div className="rounded-2xl bg-emerald-100 p-3 text-emerald-700">
                      <Undo2 size={18} />
                    </div>
                    <div>
                      <p className="text-base font-semibold text-gray-900 dark:text-white">{tr('Return bottles', 'Возврат бутылей', 'Idish qaytarish')}</p>
                      <p className="mt-1 text-sm text-gray-500">{tr('Use when the client physically gives empty bottles back.', 'Используйте, когда клиент физически отдает пустые бутыли.', 'Mijoz bo\'sh idishni qaytarib berganda ishlating.')}</p>
                    </div>
                  </div>

                  <form onSubmit={handleReturnSubmit} className="mt-6 space-y-4">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">{tr('Product balance', 'Баланс продукта', 'Mahsulot balansi')}</label>
                        <select
                          value={returnForm.product_id}
                          onChange={(event) => setReturnForm((current) => ({ ...current, product_id: event.target.value }))}
                          className="w-full rounded-xl border border-light-border bg-white px-3 py-2.5 text-sm text-gray-800 outline-none focus:border-primary-blue dark:border-navy-700 dark:bg-navy-900 dark:text-white"
                        >
                          <option value="">{tr('Select product', 'Выберите продукт', 'Mahsulotni tanlang')}</option>
                          {balances.map((balance) => (
                            <option key={balance.id} value={balance.product_id}>
                              {balance.product_name}{balance.product_size_liters ? ` - ${balance.product_size_liters}L` : ''} ({balance.outstanding_bottles_count})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">{tr('Quantity', 'Количество', 'Soni')}</label>
                        <input
                          type="number"
                          min="1"
                          value={returnForm.quantity}
                          onChange={(event) => setReturnForm((current) => ({ ...current, quantity: event.target.value }))}
                          disabled={returnForm.return_all}
                          className="w-full rounded-xl border border-light-border bg-white px-3 py-2.5 text-sm text-gray-800 outline-none focus:border-primary-blue disabled:opacity-60 dark:border-navy-700 dark:bg-navy-900 dark:text-white"
                        />
                      </div>
                    </div>

                    <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                      <input
                        type="checkbox"
                        checked={returnForm.return_all}
                        onChange={(event) => setReturnForm((current) => ({ ...current, return_all: event.target.checked }))}
                      />
                      {tr('Return all bottles for this balance', 'Вернуть все бутыли по этому балансу', 'Bu balansdagi barcha idishni qaytarish')}
                    </label>

                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-900">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <span>{tr('This action will reduce outstanding bottles immediately.', 'Это действие сразу уменьшит количество бутылей у клиента.', 'Bu amal mijozdagi idish qoldig\'ini darhol kamaytiradi.')}</span>
                        <span className="font-semibold">{returnPreview.quantity} {tr('bottles', 'бутылей', 'ta idish')} / {formatCurrency(returnPreview.deposit)} UZS</span>
                      </div>
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">{tr('Operator note', 'Комментарий оператора', 'Operator izohi')}</label>
                      <textarea
                        value={returnForm.note}
                        onChange={(event) => setReturnForm((current) => ({ ...current, note: event.target.value }))}
                        placeholder={tr('Example: client returned 2 empty bottles at the gate.', 'Например: клиент вернул 2 пустые бутыли у входа.', 'Masalan: mijoz eshik oldida 2 ta bo\'sh idish qaytardi.')}
                        className="h-24 w-full rounded-xl border border-light-border bg-white px-3 py-2.5 text-sm text-gray-800 outline-none focus:border-primary-blue dark:border-navy-700 dark:bg-navy-900 dark:text-white"
                      />
                    </div>

                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={returnSaving || !balances.length}
                        className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:opacity-50"
                      >
                        {returnSaving ? <Loader2 size={16} className="animate-spin" /> : <Undo2 size={16} />}
                        {returnSaving ? tr('Saving...', 'Сохранение...', 'Saqlanmoqda...') : tr('Save return', 'Сохранить возврат', 'Qaytarishni saqlash')}
                      </button>
                    </div>
                  </form>
                </Card>

                <Card accent="amber" className="bg-[linear-gradient(135deg,rgba(255,251,243,0.98)_0%,rgba(255,255,255,1)_100%)]">
                  <div className="flex items-start gap-3">
                    <div className="rounded-2xl bg-amber-100 p-3 text-amber-700">
                      <Wallet size={18} />
                    </div>
                    <div>
                      <p className="text-base font-semibold text-gray-900 dark:text-white">{tr('Refund deposit', 'Возврат депозита', 'Depozit refund')}</p>
                      <p className="mt-1 text-sm text-gray-500">{tr('Use only for explicit admin refund operations that should stay separate from normal bottle return flow.', 'Используйте только для явных admin-refund операций, которые должны быть отделены от обычного возврата бутылей.', 'Buni oddiy idish qaytarishdan alohida turishi kerak bo\'lgan maxsus refund amallari uchun ishlating.')}</p>
                    </div>
                  </div>

                  <form onSubmit={handleRefundSubmit} className="mt-6 space-y-4">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">{tr('Product balance', 'Баланс продукта', 'Mahsulot balansi')}</label>
                        <select
                          value={refundForm.product_id}
                          onChange={(event) => setRefundForm((current) => ({ ...current, product_id: event.target.value }))}
                          className="w-full rounded-xl border border-light-border bg-white px-3 py-2.5 text-sm text-gray-800 outline-none focus:border-primary-blue dark:border-navy-700 dark:bg-navy-900 dark:text-white"
                        >
                          <option value="">{tr('Select product', 'Выберите продукт', 'Mahsulotni tanlang')}</option>
                          {balances.map((balance) => (
                            <option key={balance.id} value={balance.product_id}>
                              {balance.product_name}{balance.product_size_liters ? ` - ${balance.product_size_liters}L` : ''} ({balance.outstanding_bottles_count})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">{tr('Quantity', 'Количество', 'Soni')}</label>
                        <input
                          type="number"
                          min="1"
                          value={refundForm.quantity}
                          onChange={(event) => setRefundForm((current) => ({ ...current, quantity: event.target.value }))}
                          disabled={refundForm.refund_all}
                          className="w-full rounded-xl border border-light-border bg-white px-3 py-2.5 text-sm text-gray-800 outline-none focus:border-primary-blue disabled:opacity-60 dark:border-navy-700 dark:bg-navy-900 dark:text-white"
                        />
                      </div>
                    </div>

                    <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                      <input
                        type="checkbox"
                        checked={refundForm.refund_all}
                        onChange={(event) => setRefundForm((current) => ({ ...current, refund_all: event.target.checked }))}
                      />
                      {tr('Refund all bottles for this balance', 'Вернуть депозит по всем бутылям этого баланса', 'Bu balansdagi barcha idish bo\'yicha refund qilish')}
                    </label>

                    <div className="rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm text-amber-900">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <span>{tr('This is a financial correction flow. Keep notes specific.', 'Это финансовая корректировка. Оставляйте точный комментарий.', 'Bu moliyaviy tuzatish oqimi. Izohni aniq yozing.')}</span>
                        <span className="font-semibold">{refundPreview.quantity} {tr('bottles', 'бутылей', 'ta idish')} / {formatCurrency(refundPreview.deposit)} UZS</span>
                      </div>
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">{tr('Admin note', 'Комментарий администратора', 'Admin izohi')}</label>
                      <textarea
                        value={refundForm.note}
                        onChange={(event) => setRefundForm((current) => ({ ...current, note: event.target.value }))}
                        placeholder={tr('Example: refund approved after manual reconciliation.', 'Например: возврат подтвержден после ручной сверки.', 'Masalan: qo\'lda solishtirilgandan keyin refund tasdiqlandi.')}
                        className="h-24 w-full rounded-xl border border-light-border bg-white px-3 py-2.5 text-sm text-gray-800 outline-none focus:border-primary-blue dark:border-navy-700 dark:bg-navy-900 dark:text-white"
                      />
                    </div>

                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={refundSaving || !balances.length}
                        className="inline-flex items-center gap-2 rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-amber-700 disabled:opacity-50"
                      >
                        {refundSaving ? <Loader2 size={16} className="animate-spin" /> : <Wallet size={16} />}
                        {refundSaving ? tr('Saving...', 'Сохранение...', 'Saqlanmoqda...') : tr('Save refund', 'Сохранить refund', 'Refundni saqlash')}
                      </button>
                    </div>
                  </form>
                </Card>
              </div>

              <Card title={tr('Balances by product', 'Балансы по продуктам', 'Mahsulotlar bo\'yicha balans')} action={workspaceLoading ? <span className="text-xs text-gray-500">{tr('Loading...', 'Загрузка...', 'Yuklanmoqda...')}</span> : null}>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-light-border text-gray-500 dark:border-navy-700 dark:text-gray-400">
                      <tr>
                        <th className="pb-3 font-medium">{tr('Product', 'Продукт', 'Mahsulot')}</th>
                        <th className="pb-3 font-medium text-right">{tr('Bottles', 'Бутыли', 'Idishlar')}</th>
                        <th className="pb-3 font-medium text-right">{tr('Held deposit', 'Удержано', 'Ushlab turilgan')}</th>
                        <th className="pb-3 font-medium text-right">{tr('Charged', 'Начислено', 'Olingan')}</th>
                        <th className="pb-3 font-medium text-right">{tr('Refunded', 'Возвращено', 'Qaytarilgan')}</th>
                        <th className="pb-3 font-medium text-right">{tr('Actions', 'Действия', 'Amallar')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-light-border dark:divide-navy-700">
                      {balances.length ? (
                        balances.map((balance) => (
                          <tr key={balance.id}>
                            <td className="py-4">
                              <p className="font-medium text-gray-900 dark:text-white">{balance.product_name}</p>
                              <p className="mt-1 text-xs text-gray-500">{balance.product_size_liters ? `${balance.product_size_liters}L` : '-'} {balance.product_sku ? `| ${balance.product_sku}` : ''}</p>
                            </td>
                            <td className="py-4 text-right text-gray-700 dark:text-gray-300">{balance.outstanding_bottles_count}</td>
                            <td className="py-4 text-right text-gray-900 dark:text-white">{formatCurrency(balance.deposit_held_uzs)} UZS</td>
                            <td className="py-4 text-right text-gray-700 dark:text-gray-300">{formatCurrency(balance.total_deposit_charged_uzs)} UZS</td>
                            <td className="py-4 text-right text-gray-700 dark:text-gray-300">{formatCurrency(balance.total_deposit_refunded_uzs)} UZS</td>
                            <td className="py-4 text-right">
                              <div className="flex justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => selectBalanceForAction(balance.product_id, 'return')}
                                  className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 transition hover:bg-emerald-100"
                                >
                                  {tr('Return', 'Возврат', 'Qaytarish')}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => selectBalanceForAction(balance.product_id, 'refund')}
                                  className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700 transition hover:bg-amber-100"
                                >
                                  {tr('Refund', 'Refund', 'Refund')}
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-gray-500">
                            {workspaceLoading
                              ? tr('Loading bottle balances...', 'Загрузка балансов...', 'Idish balanslari yuklanmoqda...')
                              : tr('No bottle balances found for this client.', 'Для этого клиента не найден баланс бутылей.', 'Bu mijoz uchun idish balansi topilmadi.')}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>

              <Card title={tr('Recent movement audit', 'Последние движения', 'So\'nggi harakatlar')} action={<Badge variant="default">{movements.length}</Badge>}>
                <div className="space-y-3">
                  {movements.length ? (
                    movements.map((movement) => (
                      <div key={movement.id} className="rounded-2xl border border-light-border bg-gray-50/70 p-4 dark:border-navy-700 dark:bg-navy-900/40">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant={movementVariant(movement.movement_type)}>{movementLabel(movement.movement_type)}</Badge>
                              <span className="text-sm font-semibold text-gray-900 dark:text-white">{movement.product_name || '-'}</span>
                              {movement.product_size_liters ? <span className="text-xs text-gray-500">{movement.product_size_liters}L</span> : null}
                            </div>
                            <p className="mt-2 text-xs text-gray-500">{formatDate(movement.created_at)}</p>
                          </div>
                          <div className="grid grid-cols-2 gap-3 text-sm lg:min-w-[340px]">
                            <div className="rounded-xl bg-white px-3 py-2 dark:bg-navy-800">
                              <p className="text-xs text-gray-500">{tr('Bottle delta', 'Изменение бутылей', 'Idish o\'zgarishi')}</p>
                              <p className={`mt-1 font-semibold ${movement.bottles_delta < 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'}`}>{movement.bottles_delta}</p>
                            </div>
                            <div className="rounded-xl bg-white px-3 py-2 dark:bg-navy-800">
                              <p className="text-xs text-gray-500">{tr('Deposit delta', 'Изменение депозита', 'Depozit o\'zgarishi')}</p>
                              <p className={`mt-1 font-semibold ${movement.deposit_delta_uzs < 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'}`}>{formatCurrency(movement.deposit_delta_uzs)} UZS</p>
                            </div>
                            <div className="rounded-xl bg-white px-3 py-2 dark:bg-navy-800">
                              <p className="text-xs text-gray-500">{tr('Balance', 'Баланс', 'Balans')}</p>
                              <p className="mt-1 font-semibold text-gray-900 dark:text-white">{movement.balance_before_count ?? '-'} {'->'} {movement.balance_after_count ?? '-'}</p>
                            </div>
                            <div className="rounded-xl bg-white px-3 py-2 dark:bg-navy-800">
                              <p className="text-xs text-gray-500">{tr('Actor', 'Исполнитель', 'Bajargan')}</p>
                              <p className="mt-1 font-semibold text-gray-900 dark:text-white">{movement.actor || '-'}</p>
                            </div>
                          </div>
                        </div>
                        {movement.note ? <p className="mt-3 text-sm text-gray-600 dark:text-gray-300">{movement.note}</p> : null}
                      </div>
                    ))
                  ) : (
                    <div className="rounded-2xl border border-dashed border-light-border px-4 py-10 text-center text-sm text-gray-500 dark:border-navy-700">
                      <ClipboardList size={18} className="mx-auto mb-3 text-gray-400" />
                      {workspaceLoading
                        ? tr('Loading movement history...', 'Загрузка истории...', 'Harakat tarixi yuklanmoqda...')
                        : tr('No bottle movements yet for this client.', 'Для этого клиента пока нет движений бутылей.', 'Bu mijoz uchun hali idish harakati yo\'q.')}
                    </div>
                  )}
                </div>
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default BottleController;
