import React, { useMemo, useState, useEffect } from 'react';
import { Card } from '../components/ui/Card';
import { Modal } from '../components/ui/Modal';
import { Badge } from '../components/ui/Badge';
import { useLanguage } from '../context/LanguageContext';
import { useToast } from '../context/ToastContext';
import { ApiError, ENDPOINTS, apiRequest } from '../services/api';
import type { OrderStatus } from '../types';
import { AlertTriangle, Edit2, Plus, Search, Trash2, UserCircle2 } from 'lucide-react';

type Platform = 'telegram' | 'instagram' | 'manual';

interface ClientRow {
  id: string;
  platform: Platform;
  platform_user_id?: string | null;
  username: string | null;
  full_name: string | null;
  phone: string | null;
  address: string | null;
  preferred_language?: 'en' | 'ru' | 'uz' | null;
  created_at: string;
  updated_at: string;
  has_phone?: boolean;
  is_platform_identity_verified?: boolean;
  can_receive_telegram?: boolean;
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
  product_size_liters?: string | null;
  requires_returnable_bottle: boolean;
  bottle_deposit_uzs: number;
  outstanding_bottles_count: number;
  deposit_held_uzs: number;
  total_deposit_charged_uzs: number;
  total_deposit_refunded_uzs: number;
  updated_at?: string;
}

interface BottleMovement {
  id: string;
  client_id: string;
  product_id?: string | null;
  product_name?: string | null;
  product_size_liters?: string | null;
  order_id?: string | null;
  movement_type: 'ORDER_DELIVERED' | 'REFUND' | 'MANUAL_ADJUST' | string;
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

interface ClientOrder {
  id: string;
  client_id: string;
  status: OrderStatus;
  payment_method?: 'CASH' | 'TRANSFER' | 'UNKNOWN' | string;
  total_amount_uzs: number;
  location_text?: string | null;
  created_at: string;
  updated_at?: string;
}

const ACTIVE_ORDER_STATUSES: OrderStatus[] = [
  'NEW_LEAD',
  'INFO_COLLECTED',
  'PAYMENT_PENDING',
  'PAYMENT_CONFIRMED',
  'DISPATCHED',
  'ASSIGNED',
  'OUT_FOR_DELIVERY',
];

const Clients: React.FC = () => {
  const { t, language } = useLanguage();
  const toast = useToast();
  const tr = (en: string, ru: string, uz: string) => (language === 'ru' ? ru : language === 'uz' ? uz : en);

  const [clients, setClients] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<ClientRow | null>(null);
  const [selectedClient, setSelectedClient] = useState<ClientRow | null>(null);
  const [clientToDelete, setClientToDelete] = useState<ClientRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [bottleLoading, setBottleLoading] = useState(false);
  const [bottleSummary, setBottleSummary] = useState<BottleSummary | null>(null);
  const [bottleBalances, setBottleBalances] = useState<BottleBalance[]>([]);
  const [bottleMovements, setBottleMovements] = useState<BottleMovement[]>([]);
  const [clientOrders, setClientOrders] = useState<ClientOrder[]>([]);
  const [isRefundOpen, setIsRefundOpen] = useState(false);
  const [refundSaving, setRefundSaving] = useState(false);
  const [refundForm, setRefundForm] = useState({
    product_id: '',
    quantity: '1',
    refund_all: false,
    note: '',
  });

  const loadClients = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiRequest<{ results?: ClientRow[] } | ClientRow[]>(ENDPOINTS.CLIENTS.LIST);
      const rows = Array.isArray(data) ? data : (data.results || []);
      setClients(rows);
    } catch (e) {
      const message = e instanceof Error ? e.message : tr('Failed to load clients', 'Failed to load clients', 'Mijozlarni yuklab bolmadi');
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadClients();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!selectedClient) {
      setBottleSummary(null);
      setBottleBalances([]);
      setBottleMovements([]);
      setClientOrders([]);
      setIsRefundOpen(false);
      setRefundForm({ product_id: '', quantity: '1', refund_all: false, note: '' });
      return;
    }

    let active = true;

    (async () => {
      try {
        setBottleLoading(true);
        const [balanceData, movementData, orderData] = await Promise.all([
          apiRequest<{ summary?: BottleSummary; results?: BottleBalance[] }>(ENDPOINTS.CLIENTS.BOTTLE_BALANCES(selectedClient.id)),
          apiRequest<{ results?: BottleMovement[] }>(`${ENDPOINTS.BOTTLES.MOVEMENTS}?client_id=${encodeURIComponent(selectedClient.id)}`),
          apiRequest<{ results?: ClientOrder[] }>(ENDPOINTS.ORDERS.LIST),
        ]);

        if (!active) return;
        setBottleSummary(balanceData.summary || null);
        setBottleBalances(balanceData.results || []);
        setBottleMovements(movementData.results || []);
        setClientOrders(
          (orderData.results || [])
            .filter((order) => order.client_id === selectedClient.id && ACTIVE_ORDER_STATUSES.includes(order.status))
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
            .slice(0, 6)
        );
      } catch (e) {
        if (!active) return;
        const message = e instanceof Error ? e.message : tr('Failed to load bottle data', 'Failed to load bottle data', "Idish ma'lumotlarini yuklab bo'lmadi");
        toast.error(message);
      } finally {
        if (active) setBottleLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [selectedClient, toast]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    const keyword = q.trim().toLowerCase();
    if (!keyword) return clients;
    return clients.filter((c) => (
      (c.full_name || '').toLowerCase().includes(keyword) ||
      (c.phone || '').toLowerCase().includes(keyword) ||
      (c.username || '').toLowerCase().includes(keyword) ||
      (c.address || '').toLowerCase().includes(keyword) ||
      c.id.toLowerCase().includes(keyword)
    ));
  }, [clients, q]);

  const platformLabel = (p: Platform) => (
    p === 'instagram'
      ? tr('Instagram', 'Instagram', 'Instagram')
      : p === 'manual'
        ? tr('Manual', 'Manual', "Qo\'lda")
        : tr('Telegram', 'Telegram', 'Telegram')
  );

  const languageLabel = (lang?: ClientRow['preferred_language']) => {
    if (lang === 'ru') return tr('Russian', 'Russian', 'Ruscha');
    if (lang === 'uz') return tr("Uzbek", 'Uzbek', "O\'zbek");
    if (lang === 'en') return tr('English', 'English', 'Inglizcha');
    return '-';
  };

  const languageBadgeVariant = (lang?: ClientRow['preferred_language']) => {
    if (lang === 'uz') return 'success' as const;
    if (lang === 'ru') return 'info' as const;
    if (lang === 'en') return 'purple' as const;
    return 'default' as const;
  };

  const movementLabel = (movementType: BottleMovement['movement_type']) => {
    if (movementType === 'ORDER_DELIVERED') return tr('Delivered order', 'Delivered order', 'Yetkazilgan buyurtma');
    if (movementType === 'REFUND') return tr('Refund', 'Refund', 'Qaytarish');
    if (movementType === 'MANUAL_ADJUST') return tr('Manual adjust', 'Manual adjust', "Qo'lda tuzatish");
    return movementType;
  };

  const movementBadgeVariant = (movementType: BottleMovement['movement_type']) => {
    if (movementType === 'ORDER_DELIVERED') return 'info' as const;
    if (movementType === 'REFUND') return 'success' as const;
    if (movementType === 'MANUAL_ADJUST') return 'warning' as const;
    return 'default' as const;
  };

  const orderStatusLabel = (status: OrderStatus) => {
    switch (status) {
      case 'NEW_LEAD': return tr('New lead', 'New lead', 'Yangi lid');
      case 'INFO_COLLECTED': return tr('Info collected', 'Info collected', "Ma\'lumot yig\'ilgan");
      case 'PAYMENT_PENDING': return tr('Payment pending', 'Payment pending', "To\'lov kutilmoqda");
      case 'PAYMENT_CONFIRMED': return tr('Payment confirmed', 'Payment confirmed', "To\'lov tasdiqlangan");
      case 'DISPATCHED': return tr('Dispatched', 'Dispatched', 'Yuborilgan');
      case 'ASSIGNED': return tr('Assigned', 'Assigned', 'Biriktirilgan');
      case 'OUT_FOR_DELIVERY': return tr('Out for delivery', 'Out for delivery', 'Yetkazib berishda');
      case 'DELIVERED': return tr('Delivered', 'Delivered', 'Yetkazildi');
      case 'CANCELED': return tr('Canceled', 'Canceled', 'Bekor qilingan');
      case 'FAILED': return tr('Failed', 'Failed', 'Muvaffaqiyatsiz');
      default: return status;
    }
  };

  const orderStatusVariant = (status: OrderStatus) => {
    switch (status) {
      case 'PAYMENT_PENDING':
      case 'INFO_COLLECTED':
        return 'warning' as const;
      case 'DISPATCHED':
      case 'ASSIGNED':
      case 'OUT_FOR_DELIVERY':
        return 'info' as const;
      case 'DELIVERED':
        return 'success' as const;
      case 'CANCELED':
      case 'FAILED':
        return 'error' as const;
      default:
        return 'default' as const;
    }
  };

  const openRefund = () => {
    const defaultProductId = bottleBalances[0]?.product_id || '';
    setRefundForm({
      product_id: defaultProductId,
      quantity: '1',
      refund_all: false,
      note: '',
    });
    setIsRefundOpen(true);
  };

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const username = String(form.get('username') || '').trim() || null;
    const fullName = String(form.get('full_name') || '').trim() || null;
    const phone = String(form.get('phone') || '').trim() || null;
    const address = String(form.get('address') || '').trim() || null;
    const preferredLanguage = String(form.get('preferred_language') || '').trim() || null;

    try {
      setSaving(true);
      setError(null);
      if (editing?.id) {
        try {
          await apiRequest(ENDPOINTS.CLIENTS.DETAIL(editing.id), {
            method: 'PATCH',
            body: JSON.stringify({
              username,
              full_name: fullName,
              phone,
              address,
              preferred_language: preferredLanguage,
            }),
          });
        } catch (saveError) {
          if (!(saveError instanceof ApiError) || (saveError.status !== 404 && saveError.status !== 405)) {
            throw saveError;
          }
          await apiRequest(ENDPOINTS.CLIENTS.UPSERT, {
            method: 'POST',
            body: JSON.stringify({
              client_id: editing.id,
              platform: editing.platform,
              platform_user_id: editing.platform_user_id || null,
              username,
              full_name: fullName,
              phone,
              address,
            }),
          });
        }
      } else {
        const platform = String(form.get('platform') || 'telegram');
        const platformUserId = String(form.get('platform_user_id') || '').trim();
        if (!platformUserId) {
          const message = tr('Platform user ID is required', 'Platform user ID is required', 'Platform user ID majburiy');
          setError(message);
          toast.error(message);
          setSaving(false);
          return;
        }
        await apiRequest(ENDPOINTS.CLIENTS.UPSERT, {
          method: 'POST',
          body: JSON.stringify({
            platform,
            platform_user_id: platformUserId,
            username,
            full_name: fullName,
            phone,
            address,
          }),
        });
      }
      toast.success(editing ? tr('Client updated', 'Client updated', 'Mijoz yangilandi') : tr('Client created', 'Client created', 'Mijoz yaratildi'));
      setIsModalOpen(false);
      setEditing(null);
      await loadClients();
    } catch (e) {
      const message = e instanceof Error ? e.message : tr('Failed to save client', "Mijozni saqlab bo\'lmadi", "Mijozni saqlab bo\'lmadi");
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const handleRefund = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
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

      setIsRefundOpen(false);
      setRefundForm({ product_id: '', quantity: '1', refund_all: false, note: '' });
      toast.success(tr('Bottle refund recorded', 'Bottle refund recorded', 'Idish qaytarilishi saqlandi'));

      const [balanceData, movementData] = await Promise.all([
        apiRequest<{ summary?: BottleSummary; results?: BottleBalance[] }>(ENDPOINTS.CLIENTS.BOTTLE_BALANCES(selectedClient.id)),
        apiRequest<{ results?: BottleMovement[] }>(`${ENDPOINTS.BOTTLES.MOVEMENTS}?client_id=${encodeURIComponent(selectedClient.id)}`),
      ]);

      setBottleSummary(balanceData.summary || null);
      setBottleBalances(balanceData.results || []);
      setBottleMovements(movementData.results || []);
    } catch (refundError) {
      const message = refundError instanceof Error ? refundError.message : tr('Failed to save bottle refund', 'Failed to save bottle refund', "Idish qaytarilishini saqlab bo'lmadi");
      toast.error(message);
    } finally {
      setRefundSaving(false);
    }
  };

  const handleDeleteClient = async () => {
    if (!clientToDelete) return;

    try {
      setDeleting(true);
      setError(null);
      await apiRequest(ENDPOINTS.CLIENTS.DETAIL(clientToDelete.id), {
        method: 'DELETE',
      });
      toast.success(tr('Client deleted', 'Client deleted', "Mijoz o'chirildi"));
      if (selectedClient?.id === clientToDelete.id) {
        setSelectedClient(null);
      }
      if (editing?.id === clientToDelete.id) {
        setEditing(null);
        setIsModalOpen(false);
      }
      setClientToDelete(null);
      await loadClients();
    } catch (deleteError) {
      const message = deleteError instanceof Error ? deleteError.message : tr('Failed to delete client', 'Failed to delete client', "Mijozni o'chirib bo'lmadi");
      setError(message);
      toast.error(message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center gap-3">
        <h1 className="text-2xl font-bold text-light-text dark:text-white">{t('nav_clients')}</h1>
        <button
          onClick={() => { setEditing(null); setIsModalOpen(true); }}
          className="px-4 py-2 bg-primary-blue hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
        >
          {t('create')} <Plus size={16} />
        </button>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 text-red-700 px-4 py-3 text-sm">{error}</div>}

      <Card className="!p-0 overflow-hidden">
        <div className="p-4 border-b border-light-border dark:border-navy-700 bg-white dark:bg-navy-800">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-white">{tr('Clients list', 'Clients list', 'Mijozlar royxati')}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{tr('Total clients', 'Total clients', 'Jami mijozlar')}: {clients.length}</p>
            </div>
            <div className="relative w-full md:max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={`${t('search')}...`}
                className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-navy-900 border border-light-border dark:border-navy-600 rounded-lg text-sm focus:outline-none focus:border-primary-blue dark:text-white"
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 dark:bg-navy-900/50 text-xs uppercase text-gray-500 dark:text-gray-400 border-b border-light-border dark:border-navy-700">
                <th className="px-6 py-4 font-semibold">{tr('Client', 'Client', 'Mijoz')}</th>
                <th className="px-6 py-4 font-semibold">{tr('Phone', 'Phone', 'Telefon')}</th>
                <th className="px-6 py-4 font-semibold">{tr('Platform', 'Platform', 'Platforma')}</th>
                <th className="px-6 py-4 font-semibold">{tr('Language', 'Language', 'Til')}</th>
                <th className="px-6 py-4 font-semibold">{tr('Updated', 'Updated', 'Yangilangan')}</th>
                <th className="px-6 py-4 font-semibold text-right">{t('actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-light-border dark:divide-navy-700">
              {loading ? (
                <tr><td colSpan={6} className="px-6 py-10 text-center text-gray-400">{tr('Loading clients...', 'Loading clients...', 'Mijozlar yuklanmoqda...')}</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="px-6 py-10 text-center text-gray-400">{tr('No clients found', 'No clients found', 'Mijozlar topilmadi')}</td></tr>
              ) : (
                filtered.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => setSelectedClient(c)}
                    className="hover:bg-gray-50 dark:hover:bg-navy-700/50 transition-colors cursor-pointer"
                  >
                    <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">
                      <div className="flex items-start gap-3">
                        <UserCircle2 size={16} className="text-gray-400" />
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">{c.full_name || c.username || '-'}</p>
                          <p className="text-xs text-gray-500 font-mono mt-1">{c.id.slice(0, 8)}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">{c.phone || '-'}</td>
                    <td className="px-6 py-4 text-sm">
                      <Badge variant={c.platform === 'instagram' ? 'warning' : c.platform === 'manual' ? 'default' : 'info'}>{platformLabel(c.platform)}</Badge>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {c.preferred_language ? (
                        <Badge variant={languageBadgeVariant(c.preferred_language)}>{languageLabel(c.preferred_language)}</Badge>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">{c.updated_at ? new Date(c.updated_at).toLocaleDateString() : '-'}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          onClick={(e) => { e.stopPropagation(); setEditing(c); setIsModalOpen(true); }}
                          className="p-1.5 text-gray-500 dark:text-gray-300 hover:text-primary-blue dark:hover:text-blue-400 transition-colors"
                          title={tr('Edit client', 'Edit client', 'Mijozni tahrirlash')}
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setClientToDelete(c); }}
                          className="p-1.5 text-gray-500 dark:text-gray-300 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                          title={tr('Delete client', 'Delete client', "Mijozni o'chirish")}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal
        isOpen={!!selectedClient}
        onClose={() => setSelectedClient(null)}
        title={tr('Client details', 'Client details', 'Mijoz tafsilotlari')}
        footer={
          selectedClient ? (
            <div className="flex justify-end gap-3 w-full">
              <button
                type="button"
                onClick={() => setClientToDelete(selectedClient)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border border-red-200 text-red-600 hover:bg-red-50 transition-colors mr-auto"
              >
                <Trash2 size={16} />
                {tr('Delete client', 'Delete client', "Mijozni o'chirish")}
              </button>
              <button
                type="button"
                onClick={() => setSelectedClient(null)}
                className="px-4 py-2 rounded-lg text-sm border border-light-border dark:border-navy-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-navy-700 transition-colors"
              >
                {t('cancel')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditing(selectedClient);
                  setSelectedClient(null);
                  setIsModalOpen(true);
                }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-primary-blue text-white hover:bg-blue-600 transition-colors"
              >
                <Edit2 size={16} />
                {tr('Edit client', 'Edit client', 'Mijozni tahrirlash')}
              </button>
            </div>
          ) : null
        }
      >
        {selectedClient && (
          <div className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="rounded-lg border border-light-border dark:border-navy-700 p-4 bg-gray-50 dark:bg-navy-900/40">
                <p className="text-xs text-gray-500">{tr('Full Name', 'Full Name', 'Toliq ism')}</p>
                <p className="text-base font-semibold text-gray-900 dark:text-white">{selectedClient.full_name || '-'}</p>
              </div>
              <div className="rounded-lg border border-light-border dark:border-navy-700 p-4 bg-gray-50 dark:bg-navy-900/40">
                <p className="text-xs text-gray-500">ID</p>
                <p className="text-sm font-mono text-gray-900 dark:text-white break-all">{selectedClient.id}</p>
              </div>
              <div className="rounded-lg border border-light-border dark:border-navy-700 p-4">
                <p className="text-xs text-gray-500">{tr('Phone', 'Phone', 'Telefon')}</p>
                <p className="text-sm text-gray-900 dark:text-white">{selectedClient.phone || '-'}</p>
              </div>
              <div className="rounded-lg border border-light-border dark:border-navy-700 p-4">
                <p className="text-xs text-gray-500">{tr('Username', 'Username', 'Username')}</p>
                <p className="text-sm text-gray-900 dark:text-white">{selectedClient.username || '-'}</p>
              </div>
              <div className="rounded-lg border border-light-border dark:border-navy-700 p-4">
                <p className="text-xs text-gray-500">{tr('Platform', 'Platform', 'Platforma')}</p>
                <div className="mt-1">
                  <Badge variant={selectedClient.platform === 'instagram' ? 'warning' : selectedClient.platform === 'manual' ? 'default' : 'info'}>{platformLabel(selectedClient.platform)}</Badge>
                </div>
              </div>
              <div className="rounded-lg border border-light-border dark:border-navy-700 p-4">
                <p className="text-xs text-gray-500">{tr('Preferred Language', 'Preferred Language', 'Afzal til')}</p>
                <div className="mt-1">
                  {selectedClient.preferred_language ? (
                    <Badge variant={languageBadgeVariant(selectedClient.preferred_language)}>{languageLabel(selectedClient.preferred_language)}</Badge>
                  ) : (
                    <span className="text-sm text-gray-400">-</span>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="rounded-lg border border-light-border dark:border-navy-700 p-4 bg-gray-50 dark:bg-navy-900/40">
                <p className="text-xs text-gray-500">{tr('Has phone', 'Has phone', 'Telefon mavjud')}</p>
                <p className="mt-1 text-sm font-medium text-gray-900 dark:text-white">{selectedClient.has_phone ? tr('Yes', 'Yes', 'Ha') : tr('No', 'No', "Yo\'q")}</p>
              </div>
              <div className="rounded-lg border border-light-border dark:border-navy-700 p-4 bg-gray-50 dark:bg-navy-900/40">
                <p className="text-xs text-gray-500">{tr('Identity verified', 'Identity verified', 'Identifikatsiya tasdiqlangan')}</p>
                <p className="mt-1 text-sm font-medium text-gray-900 dark:text-white">{selectedClient.is_platform_identity_verified ? tr('Yes', 'Yes', 'Ha') : tr('No', 'No', "Yo\'q")}</p>
              </div>
              <div className="rounded-lg border border-light-border dark:border-navy-700 p-4 bg-gray-50 dark:bg-navy-900/40">
                <p className="text-xs text-gray-500">{tr('Can receive Telegram', 'Can receive Telegram', 'Telegram qabul qila oladi')}</p>
                <p className="mt-1 text-sm font-medium text-gray-900 dark:text-white">{selectedClient.can_receive_telegram ? tr('Yes', 'Yes', 'Ha') : tr('No', 'No', "Yo\'q")}</p>
              </div>
            </div>

            <div className="rounded-lg border border-light-border dark:border-navy-700 p-4">
              <p className="text-xs text-gray-500">{tr('Address', 'Address', 'Manzil')}</p>
              <p className="mt-1 text-sm text-gray-900 dark:text-white whitespace-pre-wrap">{selectedClient.address || '-'}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="rounded-lg border border-light-border dark:border-navy-700 p-4">
                <p className="text-xs text-gray-500">{tr('Created', 'Created', 'Yaratilgan')}</p>
                <p className="text-sm text-gray-900 dark:text-white">{selectedClient.created_at ? new Date(selectedClient.created_at).toLocaleString() : '-'}</p>
              </div>
              <div className="rounded-lg border border-light-border dark:border-navy-700 p-4">
                <p className="text-xs text-gray-500">{tr('Updated', 'Updated', 'Yangilangan')}</p>
                <p className="text-sm text-gray-900 dark:text-white">{selectedClient.updated_at ? new Date(selectedClient.updated_at).toLocaleString() : '-'}</p>
              </div>
            </div>

            <div className="rounded-lg border border-light-border dark:border-navy-700 overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 dark:bg-navy-900 border-b border-light-border dark:border-navy-700">
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{tr('Active orders', 'Active orders', 'Faol buyurtmalar')}</p>
                <p className="text-xs text-gray-500">{tr('Current open orders for this client', 'Current open orders for this client', 'Bu mijozning joriy ochiq buyurtmalari')}</p>
              </div>
              <div className="divide-y divide-light-border dark:divide-navy-700">
                {bottleLoading ? (
                  <div className="px-4 py-4 text-sm text-gray-500">{tr('Loading active orders...', 'Loading active orders...', 'Faol buyurtmalar yuklanmoqda...')}</div>
                ) : clientOrders.length ? (
                  clientOrders.map((order) => (
                    <div key={order.id} className="px-4 py-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-gray-900 dark:text-white">#{order.id.slice(0, 8)}</p>
                          <Badge variant={orderStatusVariant(order.status)}>{orderStatusLabel(order.status)}</Badge>
                        </div>
                        <p className="mt-1 text-xs text-gray-500">{order.location_text || '-'}</p>
                        <p className="mt-1 text-xs text-gray-500">{new Date(order.created_at).toLocaleString()}</p>
                      </div>
                      <div className="text-left md:text-right">
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">{order.total_amount_uzs.toLocaleString()} UZS</p>
                        <p className="text-xs text-gray-500">{tr('Payment', 'Payment', "To\'lov")}: {order.payment_method || '-'}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="px-4 py-4 text-sm text-gray-500">{tr('No active orders found', 'No active orders found', 'Faol buyurtmalar topilmadi')}</div>
                )}
              </div>
            </div>

            <div className="rounded-lg border border-light-border dark:border-navy-700 p-4 space-y-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{tr('Bottle balance', 'Bottle balance', 'Idish balansi')}</p>
                  <p className="text-xs text-gray-500">{tr('Current held deposit and reusable bottle coverage by product', 'Current held deposit and reusable bottle coverage by product', 'Mahsulot kesimida idish qoplami va depozit')}</p>
                </div>
                {bottleBalances.length ? (
                  <button
                    type="button"
                    onClick={openRefund}
                    className="inline-flex items-center justify-center px-4 py-2 rounded-lg text-sm font-medium bg-primary-blue text-white hover:bg-blue-600 transition-colors"
                  >
                    {tr('Manual refund', 'Manual refund', "Qo'lda qaytarish")}
                  </button>
                ) : null}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="rounded-lg border border-light-border dark:border-navy-700 p-4 bg-gray-50 dark:bg-navy-900/40">
                  <p className="text-xs text-gray-500">{tr('Outstanding bottles', 'Outstanding bottles', "Qo'ldagi idishlar")}</p>
                  <p className="text-lg font-semibold text-gray-900 dark:text-white">{bottleSummary?.total_outstanding_bottles_count ?? 0}</p>
                </div>
                <div className="rounded-lg border border-light-border dark:border-navy-700 p-4 bg-gray-50 dark:bg-navy-900/40">
                  <p className="text-xs text-gray-500">{tr('Deposit held', 'Deposit held', 'Ushlab turilgan depozit')}</p>
                  <p className="text-lg font-semibold text-gray-900 dark:text-white">{(bottleSummary?.deposit_held_total_uzs ?? 0).toLocaleString()} UZS</p>
                </div>
                <div className="rounded-lg border border-light-border dark:border-navy-700 p-4 bg-gray-50 dark:bg-navy-900/40">
                  <p className="text-xs text-gray-500">{tr('Charged total', 'Charged total', 'Jami olingan')}</p>
                  <p className="text-lg font-semibold text-gray-900 dark:text-white">{(bottleSummary?.total_deposit_charged_uzs ?? 0).toLocaleString()} UZS</p>
                </div>
                <div className="rounded-lg border border-light-border dark:border-navy-700 p-4 bg-gray-50 dark:bg-navy-900/40">
                  <p className="text-xs text-gray-500">{tr('Refunded total', 'Refunded total', 'Jami qaytarilgan')}</p>
                  <p className="text-lg font-semibold text-gray-900 dark:text-white">{(bottleSummary?.total_deposit_refunded_uzs ?? 0).toLocaleString()} UZS</p>
                </div>
              </div>

              <div className="rounded-lg border border-light-border dark:border-navy-700 overflow-hidden">
                <div className="px-4 py-3 bg-gray-50 dark:bg-navy-900 border-b border-light-border dark:border-navy-700">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{tr('Balances by product', 'Balances by product', "Mahsulotlar bo'yicha balans")}</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50/80 dark:bg-navy-900/70 text-gray-500 dark:text-gray-400">
                      <tr>
                        <th className="px-4 py-3 font-medium">{t('product_name')}</th>
                        <th className="px-4 py-3 font-medium text-right">{tr('Size', 'Size', 'Hajm')}</th>
                        <th className="px-4 py-3 font-medium text-right">{tr('Covered bottles', 'Covered bottles', 'Qoplama')}</th>
                        <th className="px-4 py-3 font-medium text-right">{tr('Deposit held', 'Deposit held', 'Depozit')}</th>
                        <th className="px-4 py-3 font-medium text-right">{tr('Refunded', 'Refunded', 'Qaytarilgan')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-light-border dark:divide-navy-700">
                      {bottleLoading ? (
                        <tr><td colSpan={5} className="px-4 py-4 text-center text-gray-500">{tr('Loading bottle balances...', 'Loading bottle balances...', 'Idish balansi yuklanmoqda...')}</td></tr>
                      ) : bottleBalances.length ? (
                        bottleBalances.map((balance) => (
                          <tr key={balance.id}>
                            <td className="px-4 py-3 text-gray-900 dark:text-white">{balance.product_name}</td>
                            <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-400">{balance.product_size_liters || '-'}</td>
                            <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-400">{balance.outstanding_bottles_count}</td>
                            <td className="px-4 py-3 text-right text-gray-900 dark:text-white">{balance.deposit_held_uzs.toLocaleString()}</td>
                            <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-400">{balance.total_deposit_refunded_uzs.toLocaleString()}</td>
                          </tr>
                        ))
                      ) : (
                        <tr><td colSpan={5} className="px-4 py-4 text-center text-gray-500">{tr('No bottle balances found', 'No bottle balances found', 'Idish balansi topilmadi')}</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="rounded-lg border border-light-border dark:border-navy-700 overflow-hidden">
                <div className="px-4 py-3 bg-gray-50 dark:bg-navy-900 border-b border-light-border dark:border-navy-700">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{tr('Recent bottle movements', 'Recent bottle movements', "So'nggi idish harakatlari")}</p>
                </div>
                <div className="divide-y divide-light-border dark:divide-navy-700 max-h-72 overflow-y-auto">
                  {bottleLoading ? (
                    <div className="px-4 py-4 text-sm text-gray-500">{tr('Loading movements...', 'Loading movements...', 'Harakatlar yuklanmoqda...')}</div>
                  ) : bottleMovements.length ? (
                    bottleMovements.map((movement) => (
                      <div key={movement.id} className="px-4 py-4 space-y-2">
                        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant={movementBadgeVariant(movement.movement_type)}>{movementLabel(movement.movement_type)}</Badge>
                            <span className="text-sm font-medium text-gray-900 dark:text-white">{movement.product_name || '-'}</span>
                            {movement.product_size_liters ? <span className="text-xs text-gray-500">{movement.product_size_liters}L</span> : null}
                          </div>
                          <span className="text-xs text-gray-500">{movement.created_at ? new Date(movement.created_at).toLocaleString() : '-'}</span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs text-gray-500">
                          <p>{tr('Bottle delta', 'Bottle delta', "Idish o'zgarishi")}: <span className="text-gray-900 dark:text-white">{movement.bottles_delta}</span></p>
                          <p>{tr('Deposit delta', 'Deposit delta', "Depozit o'zgarishi")}: <span className="text-gray-900 dark:text-white">{movement.deposit_delta_uzs.toLocaleString()} UZS</span></p>
                          <p>{tr('Balance after', 'Balance after', 'Yakuniy balans')}: <span className="text-gray-900 dark:text-white">{movement.balance_after_count ?? '-'}</span></p>
                          <p>{tr('Actor', 'Actor', 'Amal bajaruvchi')}: <span className="text-gray-900 dark:text-white">{movement.actor || '-'}</span></p>
                        </div>
                        {movement.note ? <p className="text-xs text-gray-500">{movement.note}</p> : null}
                      </div>
                    ))
                  ) : (
                    <div className="px-4 py-4 text-sm text-gray-500">{tr('No bottle movements yet', 'No bottle movements yet', "Hali idish harakati yo'q")}</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={!!clientToDelete}
        onClose={() => { if (!deleting) setClientToDelete(null); }}
        title={tr('Delete client', 'Delete client', "Mijozni o'chirish")}
        footer={null}
      >
        {clientToDelete ? (
          <div className="space-y-5">
            <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-4 text-red-700">
              <AlertTriangle size={18} className="mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold">{tr('This action will permanently remove the client.', 'This action will permanently remove the client.', "Bu amal mijozni butunlay o'chiradi.")}</p>
                <p className="mt-1 text-sm">
                  {tr('Deleted clients cannot be restored from this screen.', 'Deleted clients cannot be restored from this screen.', "O'chirilgan mijozni bu sahifadan qayta tiklab bo'lmaydi.")}
                </p>
              </div>
            </div>

            <div className="rounded-lg border border-light-border dark:border-navy-700 p-4">
              <p className="text-xs text-gray-500">{tr('Client', 'Client', 'Mijoz')}</p>
              <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-white">{clientToDelete.full_name || clientToDelete.username || clientToDelete.id}</p>
              <p className="mt-1 text-xs text-gray-500">{clientToDelete.phone || clientToDelete.id}</p>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setClientToDelete(null)}
                className="px-4 py-2 rounded-lg text-sm border border-light-border dark:border-navy-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-navy-700 transition-colors disabled:opacity-50"
              >
                {t('cancel')}
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={() => void handleDeleteClient()}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                <Trash2 size={16} />
                {deleting ? tr('Deleting...', 'Deleting...', "O'chirilmoqda...") : tr('Delete client', 'Delete client', "Mijozni o'chirish")}
              </button>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        isOpen={isRefundOpen}
        onClose={() => setIsRefundOpen(false)}
        title={tr('Manual bottle refund', 'Manual bottle refund', "Qo'lda idish qaytarish")}
        footer={null}
      >
        <form onSubmit={handleRefund} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('product_name')}</label>
            <select
              value={refundForm.product_id}
              onChange={(e) => setRefundForm((state) => ({ ...state, product_id: e.target.value }))}
              className="w-full bg-gray-50 dark:bg-navy-900 border border-light-border dark:border-navy-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-blue dark:text-white"
            >
              <option value="">{tr('Select product', 'Select product', 'Mahsulotni tanlang')}</option>
              {bottleBalances.map((balance) => (
                <option key={balance.id} value={balance.product_id}>
                  {balance.product_name}{balance.product_size_liters ? ` - ${balance.product_size_liters}L` : ''} - {balance.outstanding_bottles_count}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{tr('Quantity', 'Quantity', 'Soni')}</label>
              <input
                type="number"
                min="1"
                value={refundForm.quantity}
                onChange={(e) => setRefundForm((state) => ({ ...state, quantity: e.target.value }))}
                disabled={refundForm.refund_all}
                className="w-full bg-gray-50 dark:bg-navy-900 border border-light-border dark:border-navy-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-blue dark:text-white disabled:opacity-60"
              />
            </div>
            <div className="flex items-end">
              <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={refundForm.refund_all}
                  onChange={(e) => setRefundForm((state) => ({ ...state, refund_all: e.target.checked }))}
                />
                {tr('Refund all covered bottles', 'Refund all covered bottles', 'Barcha qoplangan idishlarni qaytarish')}
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{tr('Note', 'Note', 'Izoh')}</label>
            <textarea
              value={refundForm.note}
              onChange={(e) => setRefundForm((state) => ({ ...state, note: e.target.value }))}
              className="w-full h-24 bg-gray-50 dark:bg-navy-900 border border-light-border dark:border-navy-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-blue dark:text-white"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-light-border dark:border-navy-700">
            <button type="button" onClick={() => setIsRefundOpen(false)} className="px-4 py-2 rounded-lg text-sm border border-light-border dark:border-navy-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-navy-700 transition-colors">{t('cancel')}</button>
            <button disabled={refundSaving} type="submit" className="px-4 py-2 rounded-lg text-sm font-medium bg-primary-blue text-white hover:bg-blue-600 transition-colors disabled:opacity-50">
              {refundSaving ? tr('Saving...', 'Saving...', 'Saqlanmoqda...') : tr('Save refund', 'Save refund', 'Qaytarishni saqlash')}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setEditing(null); }}
        title={editing ? tr('Edit Client', 'Edit Client', 'Mijozni tahrirlash') : tr('New Client', 'New Client', 'Yangi mijoz')}
        footer={null}
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{tr('Platform', 'Platform', 'Platforma')}</label>
              <select
                name="platform"
                required
                defaultValue={editing?.platform || 'telegram'}
                disabled={!!editing}
                className="w-full bg-gray-50 dark:bg-navy-900 border border-light-border dark:border-navy-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-blue dark:text-white disabled:opacity-60"
              >
                <option value="telegram">{tr('Telegram', 'Telegram', 'Telegram')}</option>
                <option value="instagram">{tr('Instagram', 'Instagram', 'Instagram')}</option>
                {editing?.platform === 'manual' ? (
                  <option value="manual">{tr('Manual', 'Manual', "Qo'lda")}</option>
                ) : null}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{tr('Username', 'Username', 'Username')}</label>
              <input
                name="username"
                defaultValue={editing?.username || ''}
                className="w-full bg-gray-50 dark:bg-navy-900 border border-light-border dark:border-navy-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-blue dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{tr('Preferred Language', 'Preferred Language', 'Afzal til')}</label>
              <select
                name="preferred_language"
                defaultValue={editing?.preferred_language || ''}
                className="w-full bg-gray-50 dark:bg-navy-900 border border-light-border dark:border-navy-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-blue dark:text-white"
              >
                <option value="">{tr('Not set', 'Not set', 'Belgilanmagan')}</option>
                <option value="uz">{tr("Uzbek", 'Uzbek', "O\'zbek")}</option>
                <option value="ru">{tr('Russian', 'Russian', 'Ruscha')}</option>
                <option value="en">{tr('English', 'English', 'Inglizcha')}</option>
              </select>
            </div>
            {!editing ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{tr('Platform User ID', 'Platform User ID', 'Platform User ID')}</label>
                <input
                  name="platform_user_id"
                  required
                  className="w-full bg-gray-50 dark:bg-navy-900 border border-light-border dark:border-navy-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-blue dark:text-white"
                />
              </div>
            ) : null}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{tr('Full Name', 'Full Name', 'Toliq ism')}</label>
            <input
              name="full_name"
              defaultValue={editing?.full_name || ''}
              className="w-full bg-gray-50 dark:bg-navy-900 border border-light-border dark:border-navy-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-blue dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{tr('Phone', 'Phone', 'Telefon')}</label>
            <input
              name="phone"
              defaultValue={editing?.phone || ''}
              className="w-full bg-gray-50 dark:bg-navy-900 border border-light-border dark:border-navy-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-blue dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{tr('Address', 'Address', 'Manzil')}</label>
            <textarea
              name="address"
              defaultValue={editing?.address || ''}
              className="w-full h-24 bg-gray-50 dark:bg-navy-900 border border-light-border dark:border-navy-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-blue dark:text-white"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-light-border dark:border-navy-700">
            <button
              type="button"
              onClick={() => { setIsModalOpen(false); setEditing(null); }}
              className="px-4 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-navy-700 transition-colors"
            >
              {t('cancel')}
            </button>
            <button
              disabled={saving}
              type="submit"
              className="px-4 py-2 rounded-lg text-sm font-medium bg-primary-blue text-white hover:bg-blue-600 transition-colors disabled:opacity-50"
            >
              {saving ? tr('Saving...', 'Saving...', 'Saqlanmoqda...') : t('save')}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Clients;
