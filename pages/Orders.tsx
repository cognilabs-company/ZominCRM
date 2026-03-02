import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Badge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';
import { Modal } from '../components/ui/Modal';
import { useLanguage } from '../context/LanguageContext';
import { useToast } from '../context/ToastContext';
import { ApiError, ENDPOINTS, apiRequest } from '../services/api';
import { Language, OrderStatus } from '../types';
import { CreditCard, Filter, MapPin, Minus, Package, Plus, User, X } from 'lucide-react';

interface ApiClient {
  id: string;
  platform?: string | null;
  username?: string | null;
  full_name: string | null;
  phone: string | null;
  address?: string | null;
  preferred_language?: Language | null;
  has_phone?: boolean;
  is_platform_identity_verified?: boolean;
  can_receive_telegram?: boolean;
}

interface ApiProduct {
  id: string;
  name: string;
  sku?: string;
  size_liters: string;
  price_uzs: number;
  count: number;
  is_active?: boolean;
  requires_returnable_bottle?: boolean;
  bottle_deposit_uzs?: number;
}

interface ApiBottleSummary {
  client_id: string;
  total_outstanding_bottles_count: number;
  deposit_held_total_uzs: number;
  total_deposit_charged_uzs: number;
  total_deposit_refunded_uzs: number;
}

interface ApiBottleBalance {
  id: string;
  client_id: string;
  product_id: string;
  product_name: string;
  product_size_liters?: string | null;
  requires_returnable_bottle: boolean;
  bottle_deposit_uzs: number;
  outstanding_bottles_count: number;
  deposit_held_uzs: number;
  total_deposit_charged_uzs: number;
  total_deposit_refunded_uzs: number;
}

interface ApiOrderItem {
  id: string;
  order_id: string;
  product_id?: string;
  product_name: string;
  product_size_liters?: string | number | null;
  quantity: number;
  unit_price_uzs: number;
  line_total_uzs: number;
  bottle_deposit_unit_uzs?: number;
  bottle_deposit_charge_quantity?: number;
  bottle_deposit_total_uzs?: number;
}

interface ApiOrder {
  id: string;
  client_id: string;
  lead_id?: string | null;
  courier_id: string | null;
  status: OrderStatus;
  payment_method: 'UNKNOWN' | 'CASH' | 'TRANSFER';
  product_subtotal_uzs?: number;
  bottle_deposit_total_uzs?: number;
  total_amount_uzs: number;
  location_text: string;
  location_lat: number | null;
  location_lng: number | null;
  delivery_time_requested: string | null;
  client_confirmed_at?: string | null;
  created_at: string;
  updated_at: string;
  items?: ApiOrderItem[];
}

interface UiOrderItem {
  id: string;
  order_id: string;
  product_id?: string;
  product_name: string;
  product_size_liters?: string | number | null;
  quantity: number;
  unit_price_uzs: number;
  line_total_uzs: number;
  bottle_deposit_unit_uzs: number;
  bottle_deposit_charge_quantity: number;
  bottle_deposit_total_uzs: number;
}

interface UiOrder {
  id: string;
  client_id: string;
  client_name: string;
  lead_id?: string | null;
  status: OrderStatus;
  payment_method: 'UNKNOWN' | 'CASH' | 'TRANSFER';
  product_subtotal_uzs: number;
  bottle_deposit_total_uzs: number;
  total_uzs: number;
  delivery_address: string | null;
  delivery_lat: number | null;
  delivery_lng: number | null;
  requested_time: string | null;
  client_confirmed_at?: string | null;
  courier_id: string | null;
  created_at: string;
  updated_at: string;
  items: UiOrderItem[];
}

interface CreateItemRow {
  id: string;
  productId: string;
  quantity: string;
}

interface LinePreview {
  id: string;
  productName: string;
  productSizeLiters: string;
  quantity: number;
  unitPriceUzs: number;
  lineTotalUzs: number;
  requiresReturnableBottle: boolean;
  bottleDepositUnitUzs: number;
  bottleDepositChargeQuantity: number;
  bottleDepositTotalUzs: number;
  alreadyCoveredBottleCount: number;
}

const STATUS_LABELS: Record<OrderStatus, Record<Language, string>> = {
  NEW_LEAD: { en: 'New Lead', ru: 'Новый лид', uz: 'Yangi lid' },
  INFO_COLLECTED: { en: 'Info Collected', ru: 'Информация собрана', uz: "Ma'lumot yig'ilgan" },
  PAYMENT_PENDING: { en: 'Payment Pending', ru: 'Ожидает оплаты', uz: "To'lov kutilmoqda" },
  PAYMENT_CONFIRMED: { en: 'Payment Confirmed', ru: 'Оплата подтверждена', uz: "To'lov tasdiqlangan" },
  DISPATCHED: { en: 'Dispatched', ru: 'Отправлен', uz: 'Yuborilgan' },
  ASSIGNED: { en: 'Assigned', ru: 'Назначен', uz: 'Biriktirilgan' },
  OUT_FOR_DELIVERY: { en: 'Out for Delivery', ru: 'В доставке', uz: 'Yetkazib berishda' },
  DELIVERED: { en: 'Delivered', ru: 'Доставлен', uz: 'Yetkazildi' },
  CANCELED: { en: 'Canceled', ru: 'Отменен', uz: 'Bekor qilingan' },
  FAILED: { en: 'Failed', ru: 'Неудачно', uz: 'Muvaffaqiyatsiz' },
};

const PAYMENT_LABELS: Record<'UNKNOWN' | 'CASH' | 'TRANSFER', Record<Language, string>> = {
  UNKNOWN: { en: 'Unknown', ru: 'Неизвестно', uz: "Noma'lum" },
  CASH: { en: 'Cash', ru: 'Наличные', uz: 'Naqd' },
  TRANSFER: { en: 'Transfer', ru: 'Перевод', uz: "O'tkazma" },
};

const ORDER_STATUSES: OrderStatus[] = ['NEW_LEAD', 'INFO_COLLECTED', 'PAYMENT_PENDING', 'PAYMENT_CONFIRMED', 'DISPATCHED', 'ASSIGNED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELED', 'FAILED'];

const createItemRow = (): CreateItemRow => ({
  id: Math.random().toString(36).slice(2, 10),
  productId: '',
  quantity: '1',
});

const Orders: React.FC = () => {
  const { t, language } = useLanguage();
  const toast = useToast();
  const tr = useCallback((en: string, ru: string, uz: string) => (language === 'ru' ? ru : language === 'uz' ? uz : en), [language]);
  const [searchParams, setSearchParams] = useSearchParams();

  const [orders, setOrders] = useState<UiOrder[]>([]);
  const [clients, setClients] = useState<ApiClient[]>([]);
  const [products, setProducts] = useState<ApiProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [createLoading, setCreateLoading] = useState(false);
  const [bottleLoading, setBottleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<UiOrder | null>(null);
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || '');

  const [clientMode, setClientMode] = useState<'existing' | 'new'>('existing');
  const [selectedClientId, setSelectedClientId] = useState('');
  const [clientForm, setClientForm] = useState({ full_name: '', phone: '', username: '', address: '', preferred_language: 'uz' as Language });
  const [orderForm, setOrderForm] = useState({ payment_method: 'CASH' as 'UNKNOWN' | 'CASH' | 'TRANSFER', location_text: '', location_lat: '', location_lng: '', delivery_time_requested: '' });
  const [itemRows, setItemRows] = useState<CreateItemRow[]>([createItemRow()]);
  const [bottleSummary, setBottleSummary] = useState<ApiBottleSummary | null>(null);
  const [bottleBalances, setBottleBalances] = useState<ApiBottleBalance[]>([]);

  const targetOrderId = searchParams.get('order_id');

  const clientsById = useMemo(() => {
    const byId: Record<string, ApiClient> = {};
    clients.forEach((client) => {
      byId[client.id] = client;
    });
    return byId;
  }, [clients]);

  const productsById = useMemo(() => {
    const byId: Record<string, ApiProduct> = {};
    products.forEach((product) => {
      byId[product.id] = product;
    });
    return byId;
  }, [products]);

  const mapOrder = useCallback((order: ApiOrder, localClientsById: Record<string, ApiClient>): UiOrder => ({
    id: order.id,
    client_id: order.client_id,
    client_name: localClientsById[order.client_id]?.full_name || localClientsById[order.client_id]?.phone || order.client_id,
    lead_id: order.lead_id || null,
    status: order.status,
    payment_method: order.payment_method,
    product_subtotal_uzs: order.product_subtotal_uzs ?? (order.items || []).reduce((sum, item) => sum + (item.line_total_uzs || 0), 0),
    bottle_deposit_total_uzs: order.bottle_deposit_total_uzs ?? (order.items || []).reduce((sum, item) => sum + (item.bottle_deposit_total_uzs || 0), 0),
    total_uzs: order.total_amount_uzs,
    delivery_address: order.location_text || null,
    delivery_lat: order.location_lat,
    delivery_lng: order.location_lng,
    requested_time: order.delivery_time_requested,
    client_confirmed_at: order.client_confirmed_at || null,
    courier_id: order.courier_id,
    created_at: order.created_at,
    updated_at: order.updated_at,
    items: (order.items || []).map((item) => ({
      id: item.id,
      order_id: item.order_id,
      product_id: item.product_id,
      product_name: item.product_name,
      product_size_liters: item.product_size_liters,
      quantity: item.quantity,
      unit_price_uzs: item.unit_price_uzs,
      line_total_uzs: item.line_total_uzs,
      bottle_deposit_unit_uzs: item.bottle_deposit_unit_uzs ?? 0,
      bottle_deposit_charge_quantity: item.bottle_deposit_charge_quantity ?? 0,
      bottle_deposit_total_uzs: item.bottle_deposit_total_uzs ?? 0,
    })),
  }), []);

  const loadOrders = useCallback(async (localClientsById: Record<string, ApiClient>, currentStatusFilter: string) => {
    const query = currentStatusFilter ? `?status=${encodeURIComponent(currentStatusFilter)}` : '';
    const data = await apiRequest<{ results?: ApiOrder[] }>(`${ENDPOINTS.ORDERS.LIST}${query}`);
    setOrders((data.results || []).map((order) => mapOrder(order, localClientsById)));
  }, [mapOrder]);

  const loadReferenceData = useCallback(async () => {
    const [clientData, productData] = await Promise.all([
      apiRequest<{ results?: ApiClient[] } | ApiClient[]>(ENDPOINTS.CLIENTS.LIST),
      apiRequest<{ results?: ApiProduct[] } | ApiProduct[]>(ENDPOINTS.PRODUCTS.LIST_CREATE),
    ]);

    const clientRows = Array.isArray(clientData) ? clientData : clientData.results || [];
    const productRows = Array.isArray(productData) ? productData : productData.results || [];

    setClients(clientRows);
    setProducts(productRows.filter((product) => product.is_active !== false));

    const byId: Record<string, ApiClient> = {};
    clientRows.forEach((client) => {
      byId[client.id] = client;
    });

    return { byId };
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const reference = await loadReferenceData();
        if (!active) return;
        await loadOrders(reference.byId, statusFilter);
      } catch (e) {
        if (!active) return;
        const message = e instanceof Error ? e.message : tr('Failed to load orders', 'Не удалось загрузить заказы', "Buyurtmalarni yuklab bo'lmadi");
        setError(message);
        toast.error(message);
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [loadOrders, loadReferenceData, statusFilter, toast, tr]);

  useEffect(() => {
    if (!isCreateOpen) return;
    const shouldLoadBalances = clientMode === 'existing' && !!selectedClientId;
    if (!shouldLoadBalances) {
      setBottleSummary(null);
      setBottleBalances([]);
      return;
    }

    let active = true;
    (async () => {
      try {
        setBottleLoading(true);
        const data = await apiRequest<{ summary?: ApiBottleSummary; results?: ApiBottleBalance[] }>(ENDPOINTS.CLIENTS.BOTTLE_BALANCES(selectedClientId));
        if (!active) return;
        setBottleSummary(data.summary || null);
        setBottleBalances(data.results || []);
      } catch {
        if (!active) return;
        setBottleSummary(null);
        setBottleBalances([]);
      } finally {
        if (active) setBottleLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [clientMode, isCreateOpen, selectedClientId]);

  useEffect(() => {
    const nextParams = new URLSearchParams(searchParams);
    if (statusFilter) nextParams.set('status', statusFilter);
    else nextParams.delete('status');
    if (nextParams.toString() !== searchParams.toString()) {
      setSearchParams(nextParams, { replace: true });
    }
  }, [searchParams, setSearchParams, statusFilter]);

  useEffect(() => {
    if (!targetOrderId || !orders.length) return;
    const match = orders.find((order) => order.id === targetOrderId);
    if (match && selectedOrder?.id !== match.id) {
      setSelectedOrder(match);
    }
  }, [orders, selectedOrder?.id, targetOrderId]);

  const previewLines = useMemo<LinePreview[]>(() => {
    const coverageLeft: Record<string, number> = {};
    bottleBalances.forEach((balance) => {
      coverageLeft[balance.product_id] = balance.outstanding_bottles_count;
    });

    return itemRows
      .map((row) => {
        const product = productsById[row.productId];
        const quantity = Math.max(0, Number(row.quantity) || 0);
        if (!product || quantity <= 0) return null;

        const covered = product.requires_returnable_bottle ? Math.min(quantity, coverageLeft[product.id] || 0) : 0;
        if (product.requires_returnable_bottle) {
          coverageLeft[product.id] = Math.max(0, (coverageLeft[product.id] || 0) - covered);
        }

        const bottleDepositChargeQuantity = product.requires_returnable_bottle ? Math.max(0, quantity - covered) : 0;
        const bottleDepositUnitUzs = product.requires_returnable_bottle ? Number(product.bottle_deposit_uzs || 0) : 0;

        return {
          id: row.id,
          productName: product.name,
          productSizeLiters: product.size_liters,
          quantity,
          unitPriceUzs: Number(product.price_uzs || 0),
          lineTotalUzs: Number(product.price_uzs || 0) * quantity,
          requiresReturnableBottle: Boolean(product.requires_returnable_bottle),
          bottleDepositUnitUzs,
          bottleDepositChargeQuantity,
          bottleDepositTotalUzs: bottleDepositChargeQuantity * bottleDepositUnitUzs,
          alreadyCoveredBottleCount: covered,
        };
      })
      .filter((line): line is LinePreview => Boolean(line));
  }, [bottleBalances, itemRows, productsById]);

  const previewTotals = useMemo(() => {
    const productSubtotalUzs = previewLines.reduce((sum, line) => sum + line.lineTotalUzs, 0);
    const bottleDepositTotalUzs = previewLines.reduce((sum, line) => sum + line.bottleDepositTotalUzs, 0);
    return {
      productSubtotalUzs,
      bottleDepositTotalUzs,
      totalAmountUzs: productSubtotalUzs + bottleDepositTotalUzs,
    };
  }, [previewLines]);

  const getStatusVariant = (status: OrderStatus) => {
    switch (status) {
      case 'DELIVERED': return 'success';
      case 'PAYMENT_PENDING':
      case 'INFO_COLLECTED': return 'warning';
      case 'CANCELED':
      case 'FAILED': return 'error';
      case 'DISPATCHED':
      case 'ASSIGNED':
      case 'OUT_FOR_DELIVERY': return 'info';
      default: return 'default';
    }
  };

  const getStatusLabel = (status: OrderStatus) => STATUS_LABELS[status]?.[language] || status;
  const getPaymentLabel = (method: 'UNKNOWN' | 'CASH' | 'TRANSFER') => PAYMENT_LABELS[method]?.[language] || method;

  const resetCreateForm = () => {
    setClientMode('existing');
    setSelectedClientId('');
    setClientForm({ full_name: '', phone: '', username: '', address: '', preferred_language: 'uz' });
    setOrderForm({ payment_method: 'CASH', location_text: '', location_lat: '', location_lng: '', delivery_time_requested: '' });
    setItemRows([createItemRow()]);
    setBottleSummary(null);
    setBottleBalances([]);
  };

  const closeCreateModal = () => {
    setIsCreateOpen(false);
    resetCreateForm();
  };

  const handleAction = async (action: 'dispatch' | 'cancel', orderId: string) => {
    try {
      setError(null);
      if (action === 'dispatch') {
        await apiRequest(ENDPOINTS.COURIERS.DISPATCH(orderId), {
          method: 'POST',
          body: JSON.stringify({
            actor: 'admin-ui',
            details: 'manual dispatch',
            force_confirm: true,
          }),
        });
        toast.success(tr('Order dispatched to courier.', 'Заказ отправлен курьеру.', 'Buyurtma kuryerga yuborildi.'));
      } else {
        await apiRequest(ENDPOINTS.ORDERS.UPDATE_STATUS(orderId), {
          method: 'POST',
          body: JSON.stringify({ to_status: 'CANCELED' }),
        });
        toast.success(tr('Order canceled successfully.', 'Заказ отменен.', 'Buyurtma bekor qilindi.'));
      }
      await loadOrders(clientsById, statusFilter);
    } catch (e) {
      let message = e instanceof Error ? e.message : tr('Action failed', 'Ошибка операции', 'Amal bajarilmadi');
      if (e instanceof ApiError && e.code === 'E-ORD-003') {
        message = action === 'dispatch'
          ? tr('This order cannot be dispatched from its current status.', 'Этот заказ нельзя отправить курьеру из текущего статуса.', "Bu buyurtmani hozirgi holatidan kuryerga yuborib bo'lmaydi.")
          : tr('This status change is not allowed.', 'Это изменение статуса недоступно.', "Bu status o'zgarishiga ruxsat berilmagan.");
      }
      setError(message);
      toast.error(message);
    }
  };

  const handleCreateOrder = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const validItems = itemRows
      .map((row) => ({ product_id: row.productId, quantity: Math.max(0, Number(row.quantity) || 0) }))
      .filter((row) => row.product_id && row.quantity > 0);

    if (clientMode === 'existing' && !selectedClientId) {
      toast.error(tr('Please select a client.', 'Выберите клиента.', 'Mijozni tanlang.'));
      return;
    }
    if (clientMode === 'new' && !clientForm.full_name.trim()) {
      toast.error(tr('Client name is required.', 'Требуется имя клиента.', 'Mijoz ismi majburiy.'));
      return;
    }
    if (!orderForm.location_text.trim()) {
      toast.error(tr('Delivery address is required.', 'Требуется адрес доставки.', 'Yetkazib berish manzili majburiy.'));
      return;
    }
    if (!validItems.length) {
      toast.error(tr('Add at least one product.', 'Добавьте хотя бы один товар.', "Kamida bitta mahsulot qo'shing."));
      return;
    }

    const selectedClient = clientMode === 'existing' ? clientsById[selectedClientId] : null;

    const payload = {
      client: clientMode === 'existing' && selectedClient
        ? {
            full_name: selectedClient.full_name || '',
            phone: selectedClient.phone || '',
            platform: selectedClient.platform || 'manual',
            address: selectedClient.address || '',
            preferred_language: selectedClient.preferred_language || 'uz',
          }
        : {
            full_name: clientForm.full_name.trim(),
            phone: clientForm.phone.trim(),
            platform: 'manual',
            username: clientForm.username.trim(),
            address: clientForm.address.trim(),
            preferred_language: clientForm.preferred_language,
          },
      order: {
        payment_method: orderForm.payment_method,
        location_text: orderForm.location_text.trim(),
        location_lat: orderForm.location_lat ? Number(orderForm.location_lat) : null,
        location_lng: orderForm.location_lng ? Number(orderForm.location_lng) : null,
        delivery_time_requested: orderForm.delivery_time_requested || null,
      },
      items: validItems,
    };

    try {
      setCreateLoading(true);
      setError(null);
      await apiRequest(ENDPOINTS.ORDERS.CREATE_FULL, { method: 'POST', body: JSON.stringify(payload) });
      toast.success(tr('Order created successfully.', 'Заказ создан.', 'Buyurtma yaratildi.'));
      closeCreateModal();
      const reference = await loadReferenceData();
      await loadOrders(reference.byId, statusFilter);
    } catch (e) {
      const message = e instanceof Error ? e.message : tr('Failed to create order', 'Не удалось создать заказ', "Buyurtma yaratib bo'lmadi");
      setError(message);
      toast.error(message);
    } finally {
      setCreateLoading(false);
    }
  };

  const openOrderDetails = (order: UiOrder) => setSelectedOrder(order);

  const closeOrderDetails = useCallback(() => {
    setSelectedOrder(null);
    if (!targetOrderId) return;
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('order_id');
    setSearchParams(nextParams, { replace: true });
  }, [searchParams, setSearchParams, targetOrderId]);

  const selectedClient = selectedClientId ? clientsById[selectedClientId] : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-light-text dark:text-white">{t('nav_orders')}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{tr('Manual order creation now includes bottle deposit preview and client bottle coverage.', 'Ручное создание заказа теперь учитывает депозит за тару и покрытие клиента.', "Qo'lda buyurtma yaratish endi idish depoziti va mijoz qoplamasini hisoblaydi.")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setIsFilterOpen((value) => !value)} className={`flex items-center gap-2 px-4 py-2 border text-sm rounded-lg transition-colors ${isFilterOpen ? 'bg-blue-50 border-primary-blue text-primary-blue dark:bg-navy-700 dark:border-blue-500 dark:text-blue-400' : 'bg-white dark:bg-navy-800 border-light-border dark:border-navy-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-navy-700'}`}>
            <Filter size={16} />
            {t('filter')}
          </button>
          <button onClick={() => setIsCreateOpen(true)} className="px-4 py-2 bg-primary-blue hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2">
            {t('create')} <Plus size={16} />
          </button>
        </div>
      </div>

      {error ? <div className="rounded-lg border border-red-200 bg-red-50 text-red-700 px-4 py-3 text-sm">{error}</div> : null}

      {isFilterOpen ? (
        <Card>
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold text-light-text dark:text-white text-sm">{t('filter')} {tr('Options', 'Параметры', 'Parametrlar')}</h3>
            <button onClick={() => setIsFilterOpen(false)} className="text-gray-400 dark:text-gray-300 hover:text-gray-600 dark:hover:text-gray-200"><X size={16} /></button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{t('status')}</label>
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="w-full bg-gray-50 dark:bg-navy-900 border border-light-border dark:border-navy-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-blue dark:text-white">
                <option value="">{tr('All statuses', 'Все статусы', 'Barcha holatlar')}</option>
                {ORDER_STATUSES.map((status) => <option key={status} value={status}>{getStatusLabel(status)}</option>)}
              </select>
            </div>
          </div>
        </Card>
      ) : null}

      <Card className="!p-0 overflow-hidden min-h-[420px]">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 dark:bg-navy-900/50 text-xs uppercase text-gray-500 dark:text-gray-400 border-b border-light-border dark:border-navy-700">
                <th className="px-6 py-4 font-semibold">{tr('Order', 'Заказ', 'Buyurtma')}</th>
                <th className="px-6 py-4 font-semibold">{tr('Client', 'Клиент', 'Mijoz')}</th>
                <th className="px-6 py-4 font-semibold">{tr('Created', 'Создан', 'Yaratilgan')}</th>
                <th className="px-6 py-4 font-semibold">{tr('Product subtotal', 'Подытог товаров', 'Mahsulot summasi')}</th>
                <th className="px-6 py-4 font-semibold">{tr('Deposit', 'Депозит', 'Depozit')}</th>
                <th className="px-6 py-4 font-semibold">{tr('Total', 'Итого', 'Jami')}</th>
                <th className="px-6 py-4 font-semibold">{tr('Status', 'Статус', 'Holat')}</th>
                <th className="px-6 py-4 font-semibold text-right">{tr('Actions', 'Действия', 'Amallar')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-light-border dark:divide-navy-700">
              {loading ? (
                <tr><td colSpan={8} className="px-6 py-8 text-center text-gray-500">{tr('Loading orders...', 'Заказы загружаются...', 'Buyurtmalar yuklanmoqda...')}</td></tr>
              ) : orders.length === 0 ? (
                <tr><td colSpan={8} className="px-6 py-8 text-center text-gray-500">{tr('No orders found.', 'Заказы не найдены.', 'Buyurtmalar topilmadi.')}</td></tr>
              ) : orders.map((order) => (
                <tr key={order.id} className="hover:bg-gray-50 dark:hover:bg-navy-700/50 transition-colors">
                  <td onClick={() => openOrderDetails(order)} className="px-6 py-4 cursor-pointer"><p className="text-sm font-semibold text-primary-blue dark:text-blue-400">#{order.id.slice(0, 8)}</p><p className="text-xs text-gray-500 font-mono mt-1">{order.id}</p></td>
                  <td onClick={() => openOrderDetails(order)} className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">{order.client_name || '-'}</td>
                  <td onClick={() => openOrderDetails(order)} className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 cursor-pointer">{new Date(order.created_at).toLocaleDateString()}</td>
                  <td onClick={() => openOrderDetails(order)} className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white cursor-pointer">{order.product_subtotal_uzs.toLocaleString()}</td>
                  <td onClick={() => openOrderDetails(order)} className="px-6 py-4 text-sm text-amber-700 dark:text-amber-400 cursor-pointer">{order.bottle_deposit_total_uzs.toLocaleString()}</td>
                  <td onClick={() => openOrderDetails(order)} className="px-6 py-4 text-sm font-semibold text-gray-900 dark:text-white cursor-pointer">{order.total_uzs.toLocaleString()}</td>
                  <td onClick={() => openOrderDetails(order)} className="px-6 py-4 cursor-pointer"><Badge variant={getStatusVariant(order.status) as any}>{getStatusLabel(order.status)}</Badge></td>
                  <td className="px-6 py-4 text-right"><div className="flex justify-end gap-2">{order.status === 'INFO_COLLECTED' || order.status === 'PAYMENT_CONFIRMED' ? <button onClick={() => handleAction('dispatch', order.id)} className="px-3 py-1.5 rounded-lg text-xs font-medium border border-light-border dark:border-navy-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-navy-700">{tr('Dispatch', 'Отправить', 'Yuborish')}</button> : null}<button onClick={() => handleAction('cancel', order.id)} className="px-3 py-1.5 rounded-lg text-xs font-medium border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30">{tr('Cancel', 'Отменить', 'Bekor qilish')}</button></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal
        isOpen={!!selectedOrder}
        onClose={closeOrderDetails}
        title={selectedOrder ? `${tr('Order details', 'Детали заказа', 'Buyurtma tafsilotlari')} #${selectedOrder.id.slice(0, 8)}` : tr('Order details', 'Детали заказа', 'Buyurtma tafsilotlari')}
        maxWidthClass="max-w-5xl"
        footer={<div className="flex gap-3 w-full justify-end"><button onClick={closeOrderDetails} className="px-4 py-2 rounded-lg text-sm border border-light-border dark:border-navy-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-navy-700 transition-colors">{t('cancel')}</button></div>}
      >
        {selectedOrder ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="rounded-xl border border-light-border dark:border-navy-700 bg-gray-50 dark:bg-navy-900/50 p-4"><p className="text-xs text-gray-500 uppercase">{tr('Product subtotal', 'Подытог товаров', 'Mahsulot summasi')}</p><p className="mt-2 text-xl font-bold text-gray-900 dark:text-white">{selectedOrder.product_subtotal_uzs.toLocaleString()} UZS</p></div>
              <div className="rounded-xl border border-amber-200 dark:border-amber-900/40 bg-amber-50/70 dark:bg-amber-900/10 p-4"><p className="text-xs text-amber-700 dark:text-amber-400 uppercase">{tr('Bottle deposit', 'Депозит за тару', 'Idish depoziti')}</p><p className="mt-2 text-xl font-bold text-amber-800 dark:text-amber-300">{selectedOrder.bottle_deposit_total_uzs.toLocaleString()} UZS</p></div>
              <div className="rounded-xl border border-light-border dark:border-navy-700 bg-gray-50 dark:bg-navy-900/50 p-4"><p className="text-xs text-gray-500 uppercase">{tr('Final total', 'Итоговая сумма', 'Yakuniy summa')}</p><p className="mt-2 text-xl font-bold text-gray-900 dark:text-white">{selectedOrder.total_uzs.toLocaleString()} UZS</p></div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-xl border border-light-border dark:border-navy-700 p-4">
                <h4 className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white mb-3"><User size={16} /> {tr('Client and status', 'Клиент и статус', 'Mijoz va holat')}</h4>
                <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                  <p><span className="text-gray-500">{tr('Client', 'Клиент', 'Mijoz')}:</span> <span className="font-medium text-gray-900 dark:text-white">{selectedOrder.client_name}</span></p>
                  <p><span className="text-gray-500">ID:</span> <span className="font-mono">{selectedOrder.client_id}</span></p>
                  <p><span className="text-gray-500">{tr('Payment', 'Оплата', "To'lov")}:</span> <span className="font-medium text-gray-900 dark:text-white">{getPaymentLabel(selectedOrder.payment_method)}</span></p>
                  <p><span className="text-gray-500">{tr('Status', 'Статус', 'Holat')}:</span> <Badge variant={getStatusVariant(selectedOrder.status) as any} className="ml-2">{getStatusLabel(selectedOrder.status)}</Badge></p>
                  <p><span className="text-gray-500">{tr('Courier ID', 'ID курьера', 'Kuryer ID')}:</span> <span className="font-mono">{selectedOrder.courier_id || '-'}</span></p>
                  <p><span className="text-gray-500">{tr('Client confirmed', 'Подтверждение клиента', 'Mijoz tasdiqlagan')}:</span> <span className="font-medium text-gray-900 dark:text-white">{selectedOrder.client_confirmed_at ? new Date(selectedOrder.client_confirmed_at).toLocaleString() : tr('Not yet', 'Еще нет', "Hali yo'q")}</span></p>
                </div>
              </div>
              <div className="rounded-xl border border-light-border dark:border-navy-700 p-4">
                <h4 className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white mb-3"><MapPin size={16} /> {tr('Delivery details', 'Доставка', 'Yetkazib berish')}</h4>
                <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                  <p><span className="text-gray-500">{tr('Address', 'Адрес', 'Manzil')}:</span> <span className="font-medium text-gray-900 dark:text-white">{selectedOrder.delivery_address || '-'}</span></p>
                  <p><span className="text-gray-500">{tr('Requested time', 'Запрошенное время', "So'ralgan vaqt")}:</span> <span className="font-medium text-gray-900 dark:text-white">{selectedOrder.requested_time ? new Date(selectedOrder.requested_time).toLocaleString() : tr('As soon as possible', 'Как можно скорее', 'Iloji boricha tez')}</span></p>
                  <p><span className="text-gray-500">Lat/Lng:</span> <span className="font-medium text-gray-900 dark:text-white">{selectedOrder.delivery_lat ?? '-'} / {selectedOrder.delivery_lng ?? '-'}</span></p>
                  <p><span className="text-gray-500">{tr('Created', 'Создан', 'Yaratilgan')}:</span> <span className="font-medium text-gray-900 dark:text-white">{new Date(selectedOrder.created_at).toLocaleString()}</span></p>
                  <p><span className="text-gray-500">{tr('Updated', 'Обновлен', 'Yangilangan')}:</span> <span className="font-medium text-gray-900 dark:text-white">{new Date(selectedOrder.updated_at).toLocaleString()}</span></p>
                </div>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2"><Package size={16} /> {tr('Order items', 'Позиции заказа', 'Buyurtma elementlari')}</h4>
              <div className="border border-light-border dark:border-navy-700 rounded-lg overflow-hidden">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 dark:bg-navy-900">
                    <tr>
                      <th className="px-4 py-3 text-gray-500 font-medium">{t('product_name')}</th>
                      <th className="px-4 py-3 text-gray-500 font-medium text-right">{tr('Size (L)', 'Размер (л)', 'Hajmi (l)')}</th>
                      <th className="px-4 py-3 text-gray-500 font-medium text-right">{tr('Qty', 'Кол-во', 'Soni')}</th>
                      <th className="px-4 py-3 text-gray-500 font-medium text-right">{tr('Unit', 'Цена', 'Birlik')}</th>
                      <th className="px-4 py-3 text-gray-500 font-medium text-right">{tr('Product total', 'Сумма товара', 'Mahsulot summasi')}</th>
                      <th className="px-4 py-3 text-gray-500 font-medium text-right">{tr('Deposit qty', 'Кол-во депозита', 'Depozit soni')}</th>
                      <th className="px-4 py-3 text-gray-500 font-medium text-right">{tr('Deposit / unit', 'Депозит / ед.', 'Depozit / birlik')}</th>
                      <th className="px-4 py-3 text-gray-500 font-medium text-right">{tr('Deposit total', 'Итого депозит', 'Jami depozit')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-light-border dark:divide-navy-700">
                    {selectedOrder.items.length ? selectedOrder.items.map((item) => (
                      <tr key={item.id}>
                        <td className="px-4 py-3 text-gray-800 dark:text-gray-200">{item.product_name}</td>
                        <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-400">{item.product_size_liters ?? '-'}</td>
                        <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-400">{item.quantity}</td>
                        <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-400">{item.unit_price_uzs.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right text-gray-800 dark:text-gray-200">{item.line_total_uzs.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-400">{item.bottle_deposit_charge_quantity}</td>
                        <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-400">{item.bottle_deposit_unit_uzs.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right text-amber-700 dark:text-amber-400">{item.bottle_deposit_total_uzs.toLocaleString()}</td>
                      </tr>
                    )) : <tr><td colSpan={8} className="px-4 py-3 text-center text-gray-500 italic">{tr('No items found.', 'Позиции не найдены.', 'Elementlar topilmadi.')}</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400"><CreditCard size={16} /> {t('payment_method')}: <span className="font-medium text-gray-900 dark:text-white">{getPaymentLabel(selectedOrder.payment_method)}</span></div>
          </div>
        ) : null}
      </Modal>

      <Modal
        isOpen={isCreateOpen}
        onClose={closeCreateModal}
        title={tr('Create manual order', 'Создать заказ вручную', "Qo'lda buyurtma yaratish")}
        maxWidthClass="max-w-6xl"
        footer={null}
      >
        <form className="space-y-6" onSubmit={handleCreateOrder}>
          <div className="grid grid-cols-1 xl:grid-cols-[1.3fr_1fr] gap-6">
            <div className="space-y-6">
              <div className="rounded-xl border border-light-border dark:border-navy-700 p-5 space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold text-gray-900 dark:text-white">{tr('Client info', 'Информация о клиенте', "Mijoz ma'lumotlari")}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{tr('Use an existing CRM client or create a new manual client in one step.', 'Можно выбрать клиента CRM или создать нового вручную.', 'CRM mijozini tanlang yoki shu yerda yangi mijoz yarating.')}</p>
                  </div>
                  <div className="flex rounded-lg border border-light-border dark:border-navy-700 overflow-hidden">
                    <button type="button" onClick={() => setClientMode('existing')} className={`px-3 py-2 text-sm ${clientMode === 'existing' ? 'bg-primary-blue text-white' : 'bg-white dark:bg-navy-900 text-gray-700 dark:text-gray-200'}`}>{tr('Existing', 'Существующий', 'Mavjud')}</button>
                    <button type="button" onClick={() => setClientMode('new')} className={`px-3 py-2 text-sm ${clientMode === 'new' ? 'bg-primary-blue text-white' : 'bg-white dark:bg-navy-900 text-gray-700 dark:text-gray-200'}`}>{tr('New client', 'Новый клиент', 'Yangi mijoz')}</button>
                  </div>
                </div>

                {clientMode === 'existing' ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{tr('Client', 'Клиент', 'Mijoz')}</label>
                      <select value={selectedClientId} onChange={(event) => setSelectedClientId(event.target.value)} className="w-full bg-gray-50 dark:bg-navy-900 border border-light-border dark:border-navy-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-blue dark:text-white">
                        <option value="">{tr('Select client', 'Выберите клиента', 'Mijozni tanlang')}</option>
                        {clients.map((client) => <option key={client.id} value={client.id}>{client.full_name || client.phone || client.id}</option>)}
                      </select>
                    </div>
                    <div className="rounded-lg border border-light-border dark:border-navy-700 p-4 bg-gray-50 dark:bg-navy-900/40"><p className="text-xs text-gray-500">{tr('Phone', 'Телефон', 'Telefon')}</p><p className="mt-1 text-sm font-medium text-gray-900 dark:text-white">{selectedClient?.phone || '-'}</p></div>
                    <div className="rounded-lg border border-light-border dark:border-navy-700 p-4 bg-gray-50 dark:bg-navy-900/40"><p className="text-xs text-gray-500">{tr('Preferred language', 'Предпочтительный язык', 'Afzal til')}</p><p className="mt-1 text-sm font-medium text-gray-900 dark:text-white">{selectedClient?.preferred_language || '-'}</p></div>
                    <div className="rounded-lg border border-light-border dark:border-navy-700 p-4 bg-gray-50 dark:bg-navy-900/40"><p className="text-xs text-gray-500">{tr('Platform', 'Платформа', 'Platforma')}</p><p className="mt-1 text-sm font-medium text-gray-900 dark:text-white">{selectedClient?.platform || 'manual'}</p></div>
                    <div className="rounded-lg border border-light-border dark:border-navy-700 p-4 bg-gray-50 dark:bg-navy-900/40"><p className="text-xs text-gray-500">{tr('Identity', 'Идентичность', 'Identifikatsiya')}</p><p className="mt-1 text-sm font-medium text-gray-900 dark:text-white">{selectedClient?.is_platform_identity_verified ? tr('Verified', 'Подтверждено', 'Tasdiqlangan') : tr('Unverified', 'Не подтверждено', 'Tasdiqlanmagan')}</p></div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{tr('Full name', 'Полное имя', "To'liq ism")}</label><input value={clientForm.full_name} onChange={(event) => setClientForm((state) => ({ ...state, full_name: event.target.value }))} className="w-full bg-gray-50 dark:bg-navy-900 border border-light-border dark:border-navy-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-blue dark:text-white" /></div>
                    <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{tr('Phone', 'Телефон', 'Telefon')}</label><input value={clientForm.phone} onChange={(event) => setClientForm((state) => ({ ...state, phone: event.target.value }))} className="w-full bg-gray-50 dark:bg-navy-900 border border-light-border dark:border-navy-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-blue dark:text-white" /></div>
                    <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{tr('Username', 'Username', 'Username')}</label><input value={clientForm.username} onChange={(event) => setClientForm((state) => ({ ...state, username: event.target.value }))} className="w-full bg-gray-50 dark:bg-navy-900 border border-light-border dark:border-navy-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-blue dark:text-white" /></div>
                    <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{tr('Language', 'Язык', 'Til')}</label><select value={clientForm.preferred_language} onChange={(event) => setClientForm((state) => ({ ...state, preferred_language: event.target.value as Language }))} className="w-full bg-gray-50 dark:bg-navy-900 border border-light-border dark:border-navy-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-blue dark:text-white"><option value="uz">O'zbek</option><option value="ru">Русский</option><option value="en">English</option></select></div>
                    <div className="md:col-span-2"><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{tr('Address', 'Адрес', 'Manzil')}</label><textarea value={clientForm.address} onChange={(event) => setClientForm((state) => ({ ...state, address: event.target.value }))} className="w-full h-24 bg-gray-50 dark:bg-navy-900 border border-light-border dark:border-navy-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-blue dark:text-white" /></div>
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-light-border dark:border-navy-700 p-5 space-y-4">
                <div>
                  <h3 className="text-base font-semibold text-gray-900 dark:text-white">{tr('Delivery and payment', 'Доставка и оплата', "Yetkazib berish va to'lov")}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{tr('This data will be sent inside the new create-full backend contract.', 'Эти данные уйдут в новый create-full контракт.', "Bu ma'lumotlar yangi create-full kontrakti bilan yuboriladi.")}</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{tr('Payment method', 'Способ оплаты', "To'lov usuli")}</label><select value={orderForm.payment_method} onChange={(event) => setOrderForm((state) => ({ ...state, payment_method: event.target.value as 'UNKNOWN' | 'CASH' | 'TRANSFER' }))} className="w-full bg-gray-50 dark:bg-navy-900 border border-light-border dark:border-navy-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-blue dark:text-white"><option value="CASH">{getPaymentLabel('CASH')}</option><option value="TRANSFER">{getPaymentLabel('TRANSFER')}</option><option value="UNKNOWN">{getPaymentLabel('UNKNOWN')}</option></select></div>
                  <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{tr('Requested delivery time', 'Запрошенное время доставки', "So'ralgan yetkazish vaqti")}</label><input type="datetime-local" value={orderForm.delivery_time_requested} onChange={(event) => setOrderForm((state) => ({ ...state, delivery_time_requested: event.target.value }))} className="w-full bg-gray-50 dark:bg-navy-900 border border-light-border dark:border-navy-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-blue dark:text-white" /></div>
                  <div className="md:col-span-2"><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{tr('Location text', 'Текстовый адрес', 'Manzil matni')}</label><textarea value={orderForm.location_text} onChange={(event) => setOrderForm((state) => ({ ...state, location_text: event.target.value }))} className="w-full h-24 bg-gray-50 dark:bg-navy-900 border border-light-border dark:border-navy-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-blue dark:text-white" /></div>
                  <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Latitude</label><input type="number" step="any" value={orderForm.location_lat} onChange={(event) => setOrderForm((state) => ({ ...state, location_lat: event.target.value }))} className="w-full bg-gray-50 dark:bg-navy-900 border border-light-border dark:border-navy-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-blue dark:text-white" /></div>
                  <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Longitude</label><input type="number" step="any" value={orderForm.location_lng} onChange={(event) => setOrderForm((state) => ({ ...state, location_lng: event.target.value }))} className="w-full bg-gray-50 dark:bg-navy-900 border border-light-border dark:border-navy-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-blue dark:text-white" /></div>
                </div>
              </div>

              <div className="rounded-xl border border-light-border dark:border-navy-700 p-5 space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold text-gray-900 dark:text-white">{tr('Order items', 'Позиции заказа', 'Buyurtma elementlari')}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{tr('Choose products and quantities. Deposit preview uses real product deposit settings.', 'Выберите товары и количество. Депозит считается из настроек товара.', "Mahsulot va miqdorni tanlang. Depozit mahsulot sozlamalaridan olinadi.")}</p>
                  </div>
                  <button type="button" onClick={() => setItemRows((rows) => [...rows, createItemRow()])} className="inline-flex items-center gap-2 rounded-lg bg-primary-blue px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"><Plus size={16} /> {tr('Add line', 'Добавить строку', "Qator qo'shish")}</button>
                </div>
                <div className="space-y-3">
                  {itemRows.map((row, index) => (
                    <div key={row.id} className="grid grid-cols-1 md:grid-cols-[1.6fr_0.5fr_auto] gap-3 items-end rounded-lg border border-light-border dark:border-navy-700 p-3 bg-gray-50 dark:bg-navy-900/30">
                      <div>
                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{tr('Product', 'Товар', 'Mahsulot')} #{index + 1}</label>
                        <select value={row.productId} onChange={(event) => setItemRows((rows) => rows.map((current) => current.id === row.id ? { ...current, productId: event.target.value } : current))} className="w-full bg-white dark:bg-navy-900 border border-light-border dark:border-navy-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-blue dark:text-white">
                          <option value="">{tr('Select product', 'Выберите товар', 'Mahsulotni tanlang')}</option>
                          {products.map((product) => <option key={product.id} value={product.id}>{product.name} · {product.size_liters}L · {product.price_uzs.toLocaleString()} UZS</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{tr('Quantity', 'Количество', 'Soni')}</label>
                        <input type="number" min="1" value={row.quantity} onChange={(event) => setItemRows((rows) => rows.map((current) => current.id === row.id ? { ...current, quantity: event.target.value } : current))} className="w-full bg-white dark:bg-navy-900 border border-light-border dark:border-navy-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-blue dark:text-white" />
                      </div>
                      <button type="button" onClick={() => setItemRows((rows) => rows.length > 1 ? rows.filter((current) => current.id !== row.id) : rows)} className="inline-flex items-center justify-center rounded-lg border border-light-border dark:border-navy-600 px-3 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-navy-700 transition-colors"><Minus size={16} /></button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="rounded-xl border border-light-border dark:border-navy-700 p-5 space-y-4 sticky top-0">
                <div>
                  <h3 className="text-base font-semibold text-gray-900 dark:text-white">{tr('Price preview', 'Предпросмотр суммы', "Narx ko'rinishi")}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{tr('Frontend preview mirrors backend deposit rules as closely as possible.', 'Предпросмотр повторяет депозитную логику backend максимально близко.', "Oldindan ko'rish backend depozit qoidalariga maksimal yaqin ishlaydi.")}</p>
                </div>

                {clientMode === 'existing' ? (
                  <div className="rounded-lg border border-light-border dark:border-navy-700 p-4 bg-gray-50 dark:bg-navy-900/40">
                    <div className="flex items-center justify-between gap-2"><p className="text-sm font-semibold text-gray-900 dark:text-white">{tr('Bottle balance summary', 'Сводка по таре', 'Idish balansi')}</p>{bottleLoading ? <span className="text-xs text-gray-500">{tr('Loading...', 'Загрузка...', 'Yuklanmoqda...')}</span> : null}</div>
                    <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                      <div><p className="text-xs text-gray-500">{tr('Outstanding bottles', 'Бутылки на руках', "Qo'ldagi idishlar")}</p><p className="font-semibold text-gray-900 dark:text-white">{bottleSummary?.total_outstanding_bottles_count ?? 0}</p></div>
                      <div><p className="text-xs text-gray-500">{tr('Deposit held', 'Удерживаемый депозит', 'Ushlab turilgan depozit')}</p><p className="font-semibold text-gray-900 dark:text-white">{(bottleSummary?.deposit_held_total_uzs ?? 0).toLocaleString()} UZS</p></div>
                    </div>
                    {bottleBalances.length ? (
                      <div className="mt-3 space-y-2">{bottleBalances.map((balance) => <div key={balance.id} className="rounded-lg border border-light-border dark:border-navy-700 p-3 bg-white dark:bg-navy-800"><p className="text-sm font-medium text-gray-900 dark:text-white">{balance.product_name} {balance.product_size_liters ? `· ${balance.product_size_liters}L` : ''}</p><p className="text-xs text-gray-500 mt-1">{tr('Covered bottles', 'Покрытые бутылки', 'Qoplangan idishlar')}: {balance.outstanding_bottles_count}</p></div>)}</div>
                    ) : <p className="mt-3 text-sm text-gray-500">{selectedClientId ? tr('No active bottle balance for this client.', 'У клиента нет активного баланса тары.', "Bu mijozda faol idish balansi yo'q.") : tr('Select a client to load bottle balance.', 'Выберите клиента, чтобы загрузить баланс тары.', 'Idish balansini yuklash uchun mijozni tanlang.')}</p>}
                  </div>
                ) : null}

                <div className="space-y-3">
                  <div className="rounded-lg border border-light-border dark:border-navy-700 p-4 bg-gray-50 dark:bg-navy-900/40">
                    <div className="flex justify-between items-center gap-3"><span className="text-sm text-gray-600 dark:text-gray-400">{tr('Product subtotal', 'Подытог товаров', 'Mahsulot summasi')}</span><span className="text-sm font-semibold text-gray-900 dark:text-white">{previewTotals.productSubtotalUzs.toLocaleString()} UZS</span></div>
                    <div className="mt-2 flex justify-between items-center gap-3"><span className="text-sm text-amber-700 dark:text-amber-400">{tr('Bottle deposit', 'Депозит за тару', 'Idish depoziti')}</span><span className="text-sm font-semibold text-amber-800 dark:text-amber-300">{previewTotals.bottleDepositTotalUzs.toLocaleString()} UZS</span></div>
                    <div className="mt-3 pt-3 border-t border-light-border dark:border-navy-700 flex justify-between items-center gap-3"><span className="text-sm font-semibold text-gray-900 dark:text-white">{tr('Total payable', 'Итого к оплате', "Jami to'lov")}</span><span className="text-lg font-bold text-gray-900 dark:text-white">{previewTotals.totalAmountUzs.toLocaleString()} UZS</span></div>
                  </div>

                  <div className="rounded-lg border border-light-border dark:border-navy-700 overflow-hidden">
                    <div className="px-4 py-3 bg-gray-50 dark:bg-navy-900 border-b border-light-border dark:border-navy-700"><p className="text-sm font-semibold text-gray-900 dark:text-white">{tr('Preview lines', 'Строки предпросмотра', "Oldindan ko'rish qatorlari")}</p></div>
                    <div className="max-h-[420px] overflow-y-auto divide-y divide-light-border dark:divide-navy-700">
                      {previewLines.length ? previewLines.map((line) => (
                        <div key={line.id} className="p-4 space-y-2">
                          <div className="flex items-start justify-between gap-3"><div><p className="text-sm font-medium text-gray-900 dark:text-white">{line.productName}</p><p className="text-xs text-gray-500">{line.productSizeLiters}L · {line.quantity} × {line.unitPriceUzs.toLocaleString()} UZS</p></div><p className="text-sm font-semibold text-gray-900 dark:text-white">{line.lineTotalUzs.toLocaleString()} UZS</p></div>
                          {line.requiresReturnableBottle ? (
                            <div className="grid grid-cols-2 gap-2 text-xs text-gray-500">
                              <p>{tr('Covered bottles', 'Покрыто бутылок', 'Qoplangan idishlar')}: <span className="text-gray-900 dark:text-white">{line.alreadyCoveredBottleCount}</span></p>
                              <p>{tr('Deposit charged for', 'Депозит начислен за', 'Depozit olinadi')}: <span className="text-gray-900 dark:text-white">{line.bottleDepositChargeQuantity}</span></p>
                              <p>{tr('Deposit / unit', 'Депозит / ед.', 'Depozit / birlik')}: <span className="text-gray-900 dark:text-white">{line.bottleDepositUnitUzs.toLocaleString()} UZS</span></p>
                              <p>{tr('Deposit total', 'Итого депозит', 'Jami depozit')}: <span className="text-amber-700 dark:text-amber-400">{line.bottleDepositTotalUzs.toLocaleString()} UZS</span></p>
                            </div>
                          ) : <p className="text-xs text-gray-500">{tr('No bottle deposit for this product.', 'Для этого товара нет депозита за тару.', "Bu mahsulot uchun idish depoziti yo'q.")}</p>}
                        </div>
                      )) : <div className="p-4 text-sm text-gray-500">{tr('Add products to see preview.', 'Добавьте товары для предпросмотра.', "Oldindan ko'rish uchun mahsulot qo'shing.")}</div>}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-light-border dark:border-navy-700">
            <button type="button" onClick={closeCreateModal} className="px-4 py-2 rounded-lg text-sm border border-light-border dark:border-navy-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-navy-700 transition-colors">{t('cancel')}</button>
            <button disabled={createLoading} type="submit" className="px-4 py-2 rounded-lg text-sm font-medium bg-primary-blue text-white hover:bg-blue-700 transition-colors disabled:opacity-50">{createLoading ? tr('Saving...', 'Сохранение...', 'Saqlanmoqda...') : tr('Create order', 'Создать заказ', 'Buyurtma yaratish')}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Orders;
