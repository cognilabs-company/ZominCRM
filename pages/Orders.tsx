import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { useLanguage } from '../context/LanguageContext';
import { useToast } from '../context/ToastContext';
import { Filter, Plus, X, CreditCard, User, MapPin } from 'lucide-react';
import { Language, OrderStatus } from '../types';
import { ApiError, ENDPOINTS, apiRequest } from '../services/api';

interface ApiClient {
  id: string;
  full_name: string | null;
  phone: string | null;
}

interface ApiOrderItem {
  id: string;
  order_id: string;
  product_id?: string;
  product_name: string;
  product_available_count?: number | null;
  quantity: number;
  unit_price_uzs: number;
  line_total_uzs: number;
  status?: boolean;
  created_at?: string;
}

interface ApiOrder {
  id: string;
  client_id: string;
  lead_id?: string | null;
  courier_id: string | null;
  status: OrderStatus;
  payment_method: 'UNKNOWN' | 'CASH' | 'TRANSFER';
  total_amount_uzs: number;
  location_text: string;
  location_lat: number | null;
  location_lng: number | null;
  delivery_time_requested: string | null;
  created_at: string;
  updated_at: string;
  items?: ApiOrderItem[];
}

interface UiOrderItem {
  id: string;
  order_id: string;
  product_id?: string;
  product_name: string;
  product_available_count?: number | null;
  quantity: number;
  unit_price_uzs: number;
  line_total_uzs: number;
  status?: boolean;
  created_at?: string;
}

interface UiOrder {
  id: string;
  client_id: string;
  client_name: string;
  lead_id?: string | null;
  status: OrderStatus;
  payment_method: 'UNKNOWN' | 'CASH' | 'TRANSFER';
  total_uzs: number;
  delivery_address: string | null;
  delivery_lat: number | null;
  delivery_lng: number | null;
  requested_time: string | null;
  courier_id: string | null;
  created_at: string;
  updated_at: string;
  items: UiOrderItem[];
}

const STATUS_LABELS: Record<OrderStatus, Record<Language, string>> = {
  NEW_LEAD: { en: 'New Lead', ru: 'Новый лид', uz: 'Yangi lid' },
  INFO_COLLECTED: { en: 'Info Collected', ru: 'Инфо собрано', uz: "Ma'lumot yig'ilgan" },
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

const ORDER_STATUSES: OrderStatus[] = [
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
];

const mapOrder = (o: ApiOrder, clientsById: Record<string, ApiClient>): UiOrder => ({
  id: o.id,
  client_id: o.client_id,
  client_name: clientsById[o.client_id]?.full_name || clientsById[o.client_id]?.phone || o.client_id,
  lead_id: o.lead_id || null,
  status: o.status,
  payment_method: o.payment_method,
  total_uzs: o.total_amount_uzs,
  delivery_address: o.location_text || null,
  delivery_lat: o.location_lat,
  delivery_lng: o.location_lng,
  requested_time: o.delivery_time_requested,
  courier_id: o.courier_id,
  created_at: o.created_at,
  updated_at: o.updated_at,
  items: (o.items || []).map((i): UiOrderItem => ({
    id: i.id,
    order_id: i.order_id,
    product_id: i.product_id,
    product_name: i.product_name,
    product_available_count: i.product_available_count,
    quantity: i.quantity,
    unit_price_uzs: i.unit_price_uzs,
    line_total_uzs: i.line_total_uzs,
    status: i.status,
    created_at: i.created_at,
  })),
});

const Orders: React.FC = () => {
  const { t, language } = useLanguage();
  const toast = useToast();
  const tr = useCallback((en: string, ru: string, uz: string) => (language === 'ru' ? ru : language === 'uz' ? uz : en), [language]);
  const [searchParams, setSearchParams] = useSearchParams();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<UiOrder | null>(null);
  const [orders, setOrders] = useState<UiOrder[]>([]);
  const [clients, setClients] = useState<ApiClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createLoading, setCreateLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>(searchParams.get('status') || '');

  const clientsById = useMemo(() => {
    const byId: Record<string, ApiClient> = {};
    clients.forEach((c) => { byId[c.id] = c; });
    return byId;
  }, [clients]);

  const loadClients = async () => {
    const data = await apiRequest<{ results?: ApiClient[] }>(ENDPOINTS.CLIENTS.LIST);
    setClients(data.results || []);
  };

  const loadOrders = useCallback(async (currentClientsById: Record<string, ApiClient>, currentStatusFilter: string) => {
    try {
      setLoading(true);
      setError(null);
      const qs = currentStatusFilter ? `?status=${encodeURIComponent(currentStatusFilter)}` : '';
      const orderData = await apiRequest<{ results?: ApiOrder[] }>(`${ENDPOINTS.ORDERS.LIST}${qs}`);
      setOrders((orderData.results || []).map((o) => mapOrder(o, currentClientsById)));
    } catch (e) {
      const message = e instanceof Error ? e.message : tr('Failed to load orders', 'Buyurtmalarni yuklab bo‘lmadi', 'Buyurtmalarni yuklab bo‘lmadi');
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [toast, tr]);

  // Unified data fetching effect
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch clients if not already loaded (mostly for initial load)
        let localClientsById = clientsById;
        if (Object.keys(localClientsById).length === 0) {
          const clientData = await apiRequest<{ results?: ApiClient[] }>(ENDPOINTS.CLIENTS.LIST);
          const localClients = clientData.results || [];
          if (active) {
            setClients(localClients);
            const byId: Record<string, ApiClient> = {};
            localClients.forEach((c) => { byId[c.id] = c; });
            localClientsById = byId;
          }
        }

        if (!active) return;

        // Fetch orders and map them using the clients
        const qs = statusFilter ? `?status=${encodeURIComponent(statusFilter)}` : '';
        const orderData = await apiRequest<{ results?: ApiOrder[] }>(`${ENDPOINTS.ORDERS.LIST}${qs}`);
        if (active) {
          setOrders((orderData.results || []).map((o) => mapOrder(o, localClientsById)));
        }
      } catch (e) {
        if (!active) return;
        const message = e instanceof Error ? e.message : tr('Failed to load orders', 'Buyurtmalarni yuklab bo‘lmadi', 'Buyurtmalarni yuklab bo‘lmadi');
        setError(message);
        toast.error(message);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [statusFilter, toast, tr]); // Refetches only when statusFilter changes

  // Sync URL with state
  useEffect(() => {
    if (statusFilter) {
      setSearchParams({ status: statusFilter }, { replace: true });
    } else {
      setSearchParams({}, { replace: true });
    }
  }, [statusFilter, setSearchParams]);

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
  const getPaymentLabel = (payment: 'UNKNOWN' | 'CASH' | 'TRANSFER') => PAYMENT_LABELS[payment]?.[language] || payment;

  const handleAction = async (action: string, orderId: string) => {
    try {
      if (action === 'dispatch') {
        await apiRequest(ENDPOINTS.COURIERS.DISPATCH(orderId), { method: 'POST', body: JSON.stringify({ actor: 'admin-ui' }) });
        toast.success(tr('Order dispatched to courier.', 'Buyurtma kuryerga yuborildi.', 'Buyurtma kuryerga yuborildi.'));
      } else if (action === 'cancel') {
        await apiRequest(ENDPOINTS.ORDERS.UPDATE_STATUS(orderId), { method: 'POST', body: JSON.stringify({ to_status: 'CANCELED' }) });
        toast.success(tr('Order canceled successfully.', 'Buyurtma bekor qilindi.', 'Buyurtma bekor qilindi.'));
      }
      await loadOrders(clientsById, statusFilter);
    } catch (e) {
      let message = e instanceof Error ? e.message : tr('Action failed', 'Amal bajarilmadi', 'Amal bajarilmadi');
      if (e instanceof ApiError) {
        if (e.code === 'E-ORD-003') {
          message = action === 'dispatch'
            ? tr(
                'This order cannot be dispatched from its current status.',
                'Этот заказ нельзя отправить курьеру из текущего статуса.',
                'Bu buyurtmani hozirgi holatidan kuryerga yuborib bo‘lmaydi.'
              )
            : tr(
                'This status change is not allowed.',
                'Это изменение статуса недоступно.',
                'Bu status o‘zgarishiga ruxsat berilmagan.'
              );
        }
      }
      setError(message);
      toast.error(message);
    }
  };

  const handleCreateOrder = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    try {
      setCreateLoading(true);
      await apiRequest<{ order: ApiOrder }>(ENDPOINTS.ORDERS.CREATE, {
        method: 'POST',
        body: JSON.stringify({
          client_id: form.get('client_id'),
          payment_method: form.get('payment_method') || 'UNKNOWN',
          location_text: form.get('location_text') || '',
          delivery_time_requested: form.get('delivery_time_requested') || null,
        }),
      });
      setIsCreateOpen(false);
      toast.success(tr('Order created successfully.', 'Buyurtma yaratildi.', 'Buyurtma yaratildi.'));
      const updatedClientsInfo = await apiRequest<{ results?: ApiClient[] }>(ENDPOINTS.CLIENTS.LIST);
      const newClients = updatedClientsInfo.results || [];
      setClients(newClients);
      const newClientsById: Record<string, ApiClient> = {};
      newClients.forEach((c) => { newClientsById[c.id] = c; });
      await loadOrders(newClientsById, statusFilter);
    } catch (e2) {
      const message = e2 instanceof Error ? e2.message : tr('Failed to create order', 'Buyurtma yaratib bo‘lmadi', 'Buyurtma yaratib bo‘lmadi');
      setError(message);
      toast.error(message);
    } finally {
      setCreateLoading(false);
    }
  };

  const openOrderDetails = (order: UiOrder) => {
    setSelectedOrder(order);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-light-text dark:text-white">{t('nav_orders')}</h1>
        <div className="flex gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); setIsFilterOpen(!isFilterOpen); }}
            className={`flex items-center gap-2 px-4 py-2 border text-sm rounded-lg transition-colors ${isFilterOpen ? 'bg-blue-50 border-primary-blue text-primary-blue dark:bg-navy-700 dark:border-blue-500 dark:text-blue-400' : 'bg-white dark:bg-navy-800 border-light-border dark:border-navy-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-navy-700'}`}
          >
            <Filter size={16} /> {t('filter')}
          </button>
          <button
            onClick={() => setIsCreateOpen(true)}
            className="px-4 py-2 bg-primary-red hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
          >
            {t('create')} <Plus size={16} />
          </button>
        </div>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 text-red-700 px-4 py-3 text-sm">{error}</div>}

      {isFilterOpen && (
        <div className="bg-white dark:bg-navy-800 border border-light-border dark:border-navy-700 rounded-xl p-4 shadow-sm animate-fade-in-down" onClick={(e) => e.stopPropagation()}>
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold text-light-text dark:text-white text-sm">{t('filter')} {tr('Options', 'Parametrlar', 'Parametrlar')}</h3>
            <button onClick={() => setIsFilterOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"><X size={16} /></button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{t('status')}</label>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-full bg-gray-50 dark:bg-navy-900 border border-light-border dark:border-navy-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-blue dark:text-white">
                <option value="">{tr('All Statuses', 'Barcha holatlar', 'Barcha holatlar')}</option>
                {ORDER_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {getStatusLabel(status)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      <Card className="!p-0 overflow-hidden min-h-[400px]">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 dark:bg-navy-900/50 text-xs uppercase text-gray-500 dark:text-gray-400 border-b border-light-border dark:border-navy-700">
                <th className="px-6 py-4 font-semibold">{tr('Order ID', 'Buyurtma ID', 'Buyurtma ID')}</th>
                <th className="px-6 py-4 font-semibold">{tr('Client', 'Mijoz', 'Mijoz')}</th>
                <th className="px-6 py-4 font-semibold">{tr('Created', 'Yaratilgan', 'Yaratilgan')}</th>
                <th className="px-6 py-4 font-semibold">{tr('Total (UZS)', 'Jami (UZS)', 'Jami (UZS)')}</th>
                <th className="px-6 py-4 font-semibold">{tr('Status', 'Holat', 'Holat')}</th>
                <th className="px-6 py-4 font-semibold text-right">{tr('Actions', 'Amallar', 'Amallar')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-light-border dark:divide-navy-700">
              {loading && (
                <tr><td colSpan={6} className="px-6 py-8 text-center text-gray-500">{tr('Loading orders...', 'Buyurtmalar yuklanmoqda...', 'Buyurtmalar yuklanmoqda...')}</td></tr>
              )}
              {!loading && orders.length === 0 && (
                <tr><td colSpan={6} className="px-6 py-8 text-center text-gray-500">{tr('No orders found.', 'Buyurtmalar topilmadi.', 'Buyurtmalar topilmadi.')}</td></tr>
              )}
              {!loading && orders.map((order) => (
                <tr
                  key={order.id}
                  className="hover:bg-gray-50 dark:hover:bg-navy-700/50 transition-colors relative"
                >
                  <td onClick={() => openOrderDetails(order)} className="px-6 py-4 text-sm font-medium text-primary-blue dark:text-blue-400 cursor-pointer">{order.id}</td>
                  <td onClick={() => openOrderDetails(order)} className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">{order.client_name || '-'}</td>
                  <td onClick={() => openOrderDetails(order)} className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 cursor-pointer">{new Date(order.created_at).toLocaleDateString()}</td>
                  <td onClick={() => openOrderDetails(order)} className="px-6 py-4 text-sm font-semibold text-gray-900 dark:text-white cursor-pointer">{order.total_uzs.toLocaleString()}</td>
                  <td onClick={() => openOrderDetails(order)} className="px-6 py-4 cursor-pointer"><Badge variant={getStatusVariant(order.status) as any}>{getStatusLabel(order.status)}</Badge></td>
                  <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => handleAction('dispatch', order.id)}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium border border-light-border dark:border-navy-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-navy-700"
                      >
                        {tr('Dispatch', 'Yuborish', 'Yuborish')}
                      </button>
                      <button
                        onClick={() => handleAction('cancel', order.id)}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30"
                      >
                        {tr('Cancel', 'Bekor qilish', 'Bekor qilish')}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal isOpen={!!selectedOrder} onClose={() => setSelectedOrder(null)} maxWidthClass="max-w-2xl" title={`${t('view_details')}: ${selectedOrder?.id}`} footer={<div className="flex gap-2 w-full justify-end"><button onClick={() => setSelectedOrder(null)} className="px-4 py-2 rounded-lg text-sm border border-light-border dark:border-navy-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-navy-700 transition-colors">{t('cancel')}</button></div>}>
        {selectedOrder && (
          <div className="space-y-6">
            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-navy-900/50 rounded-lg border border-light-border dark:border-navy-700">
              <div><p className="text-xs text-gray-500 uppercase">{t('status')}</p><Badge variant={getStatusVariant(selectedOrder.status) as any} className="mt-1">{getStatusLabel(selectedOrder.status)}</Badge></div>
              <div><p className="text-xs text-gray-500 uppercase">{t('price')}</p><p className="text-lg font-bold text-gray-900 dark:text-white">{selectedOrder.total_uzs.toLocaleString()} UZS</p></div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white mb-2"><User size={16} /> {t('nav_clients')}</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">{selectedOrder.client_name || '-'}</p>
                <p className="text-xs text-gray-500 mt-1">{tr('Client ID', 'Mijoz ID', 'Mijoz ID')}: {selectedOrder.client_id || '-'}</p>
                <p className="text-xs text-gray-500 mt-1">{tr('Lead ID', 'Lid ID', 'Lid ID')}: {selectedOrder.lead_id || '-'}</p>
                <p className="text-xs text-gray-500 mt-1">{tr('Courier ID', 'Kuryer ID', 'Kuryer ID')}: {selectedOrder.courier_id || '-'}</p>
              </div>
              <div>
                <h4 className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white mb-2"><MapPin size={16} /> {t('in_delivery')}</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">{selectedOrder.delivery_address || tr('No address provided', 'Manzil kiritilmagan', 'Manzil kiritilmagan')}</p>
                <p className="text-xs text-gray-500 mt-1">{selectedOrder.requested_time ? `${tr('Requested', 'So‘ralgan', 'So‘ralgan')}: ${new Date(selectedOrder.requested_time).toLocaleString()}` : tr('As soon as possible', 'Iloji boricha tez', 'Iloji boricha tez')}</p>
                <p className="text-xs text-gray-500 mt-1">{tr('Lat/Lng', 'Lat/Lng', 'Lat/Lng')}: {selectedOrder.delivery_lat ?? '-'} / {selectedOrder.delivery_lng ?? '-'}</p>
                <p className="text-xs text-gray-500 mt-1">{tr('Created', 'Yaratilgan', 'Yaratilgan')}: {new Date(selectedOrder.created_at).toLocaleString()}</p>
                <p className="text-xs text-gray-500 mt-1">{tr('Updated', 'Yangilangan', 'Yangilangan')}: {new Date(selectedOrder.updated_at).toLocaleString()}</p>
              </div>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">{t('nav_orders')} {tr('Items', 'Elementlar', 'Elementlar')}</h4>
              <div className="border border-light-border dark:border-navy-700 rounded-lg overflow-hidden">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 dark:bg-navy-900">
                    <tr>
                      <th className="px-4 py-2 text-gray-500 font-medium">{t('product_name')}</th>
                      <th className="px-4 py-2 text-gray-500 font-medium text-right">ID</th>
                      <th className="px-4 py-2 text-gray-500 font-medium text-right">{tr('Qty', 'Soni', 'Soni')}</th>
                      <th className="px-4 py-2 text-gray-500 font-medium text-right">{tr('Unit', 'Birlik', 'Birlik')}</th>
                      <th className="px-4 py-2 text-gray-500 font-medium text-right">{t('stock')}</th>
                      <th className="px-4 py-2 text-gray-500 font-medium text-right">{tr('Total', 'Jami', 'Jami')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-light-border dark:divide-navy-700">
                    {selectedOrder.items?.length ? selectedOrder.items.map((item, idx) => (
                      <tr key={idx}>
                        <td className="px-4 py-2 text-gray-800 dark:text-gray-200">{item.product_name}</td>
                        <td className="px-4 py-2 text-gray-600 dark:text-gray-400 text-right">{item.product_id?.slice(0, 8) || '-'}</td>
                        <td className="px-4 py-2 text-gray-600 dark:text-gray-400 text-right">{item.quantity}</td>
                        <td className="px-4 py-2 text-gray-600 dark:text-gray-400 text-right">{item.unit_price_uzs.toLocaleString()}</td>
                        <td className="px-4 py-2 text-gray-600 dark:text-gray-400 text-right">{item.product_available_count ?? '-'}</td>
                        <td className="px-4 py-2 text-gray-800 dark:text-gray-200 text-right">{item.line_total_uzs.toLocaleString()}</td>
                      </tr>
                    )) : (
                      <tr><td colSpan={6} className="px-4 py-3 text-center text-gray-500 italic">{tr('No items found', 'Elementlar topilmadi', 'Elementlar topilmadi')}</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400"><CreditCard size={16} /> {t('payment_method')}: <span className="font-medium text-gray-900 dark:text-white">{getPaymentLabel(selectedOrder.payment_method)}</span></div>
          </div>
        )}
      </Modal>

      <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title={t('create') + " " + t('nav_orders')} footer={null}>
        <form className="space-y-4" onSubmit={handleCreateOrder}>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{tr('Client', 'Mijoz', 'Mijoz')}</label>
            <select name="client_id" required className="w-full bg-gray-50 dark:bg-navy-900 border border-light-border dark:border-navy-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-blue dark:text-white">
              <option value="">{tr('Select client', 'Mijozni tanlang', 'Mijozni tanlang')}</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.full_name || c.phone || c.id}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{tr('Payment Method', 'To‘lov usuli', 'To‘lov usuli')}</label>
            <select name="payment_method" defaultValue="UNKNOWN" className="w-full bg-gray-50 dark:bg-navy-900 border border-light-border dark:border-navy-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-blue dark:text-white">
              <option value="UNKNOWN">{tr('Unknown', 'Noma‘lum', "Noma'lum")}</option>
              <option value="CASH">{tr('Cash', 'Naqd', 'Naqd')}</option>
              <option value="TRANSFER">{tr('Transfer', 'O‘tkazma', "O'tkazma")}</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{tr('Location', 'Manzil', 'Manzil')}</label>
            <input name="location_text" type="text" className="w-full bg-gray-50 dark:bg-navy-900 border border-light-border dark:border-navy-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-blue dark:text-white" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{tr('Requested Delivery Time', 'So‘ralgan yetkazish vaqti', 'So‘ralgan yetkazish vaqti')}</label>
            <input name="delivery_time_requested" type="datetime-local" className="w-full bg-gray-50 dark:bg-navy-900 border border-light-border dark:border-navy-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-blue dark:text-white" />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-light-border dark:border-navy-700">
            <button type="button" onClick={() => setIsCreateOpen(false)} className="px-4 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-navy-700 transition-colors">{t('cancel')}</button>
            <button disabled={createLoading} type="submit" className="px-4 py-2 rounded-lg text-sm font-medium bg-primary-blue text-white hover:bg-blue-600 transition-colors disabled:opacity-50">{createLoading ? tr('Saving...', 'Saqlanmoqda...', 'Saqlanmoqda...') : t('save')}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Orders;
