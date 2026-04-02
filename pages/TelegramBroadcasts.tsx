import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  Clock3,
  Eye,
  ImagePlus,
  Languages,
  Megaphone,
  RefreshCw,
  SendHorizontal,
  Users,
  UserRound,
  X,
} from 'lucide-react';
import { Badge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';
import { Modal } from '../components/ui/Modal';
import { useActionConfirm } from '../components/ui/useActionConfirm';
import { useLanguage } from '../context/LanguageContext';
import { useToast } from '../context/ToastContext';
import { ENDPOINTS, apiRequest, resolveAdminMediaUrl } from '../services/api';

type CampaignStatus = 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | string;

interface CampaignUser {
  id: string;
  username: string;
  first_name?: string | null;
  last_name?: string | null;
  role?: string | null;
}

interface BroadcastCampaign {
  id: string;
  title?: string | null;
  text: string;
  text_preview?: string | null;
  image_url?: string | null;
  has_image?: boolean;
  status: CampaignStatus;
  celery_task_id?: string | null;
  audience_total: number;
  successful_count: number;
  pending_count: number;
  processing_count: number;
  unsuccessful_count: number;
  failed_count: number;
  skipped_count: number;
  processed_count: number;
  progress_percent: number;
  success_rate_percent: number;
  last_error?: string | null;
  created_by_user?: CampaignUser | null;
  started_at?: string | null;
  finished_at?: string | null;
  created_at: string;
  updated_at: string;
  last_delivery_updated_at?: string | null;
  is_active: boolean;
  meta?: Record<string, unknown> | null;
}

interface TelegramUserStats {
  all_clients_total: number;
  telegram_clients_total: number;
  reachable_telegram_clients_total: number;
  unreachable_telegram_clients_total: number;
  telegram_clients_with_phone_total: number;
  telegram_clients_with_username_total: number;
  language_breakdown?: Partial<Record<'uz' | 'ru' | 'en', number>>;
  latest_telegram_client_created_at?: string | null;
}

interface BroadcastListResponse {
  telegram_user_stats?: TelegramUserStats;
  active_count?: number;
  active_campaigns?: BroadcastCampaign[];
  count?: number;
  total?: number;
  limit?: number;
  offset?: number;
  results?: BroadcastCampaign[];
}

interface BroadcastCreateResponse {
  queued: boolean;
  campaign: BroadcastCampaign;
}

interface DeliveryClient {
  id: string;
  full_name?: string | null;
  phone?: string | null;
  username?: string | null;
  preferred_language?: string | null;
  platform?: string | null;
}

interface BroadcastDelivery {
  id: string;
  campaign_id: string;
  client?: DeliveryClient | null;
  chat_id?: string | null;
  status: string;
  telegram_message_id?: number | null;
  error_message?: string | null;
  meta?: Record<string, unknown> | null;
  attempted_at?: string | null;
  sent_at?: string | null;
  created_at: string;
  updated_at: string;
}

interface BroadcastDetailResponse {
  campaign: BroadcastCampaign;
  recent_deliveries_count?: number;
  recent_deliveries?: BroadcastDelivery[];
  recent_failures_count?: number;
  recent_failures?: BroadcastDelivery[];
}

const LIST_LIMIT = 20;
const DETAIL_LIMIT = 20;

const statusVariant = (status: CampaignStatus) => {
  switch (status) {
    case 'COMPLETED':
      return 'success' as const;
    case 'QUEUED':
      return 'warning' as const;
    case 'RUNNING':
      return 'info' as const;
    case 'FAILED':
      return 'error' as const;
    default:
      return 'default' as const;
  }
};

const deliveryVariant = (status: string) => {
  switch (status) {
    case 'SENT':
      return 'success' as const;
    case 'PENDING':
    case 'PROCESSING':
      return 'warning' as const;
    case 'FAILED':
    case 'SKIPPED':
      return 'error' as const;
    default:
      return 'default' as const;
  }
};

const isCampaignActive = (campaign?: BroadcastCampaign | null) =>
  Boolean(campaign && (campaign.is_active || campaign.status === 'QUEUED' || campaign.status === 'RUNNING'));

const percentText = (value?: number | null) => `${Math.max(0, Math.min(100, Number(value || 0))).toFixed(0)}%`;
const amountText = (value?: number | null) => Number(value || 0).toLocaleString();

const TelegramBroadcasts: React.FC = () => {
  const { t, language } = useLanguage();
  const toast = useToast();
  const { confirm, confirmationModal } = useActionConfirm();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const tr = useCallback(
    (en: string, ru: string, uz: string) => (language === 'ru' ? ru : language === 'uz' ? uz : en),
    [language]
  );

  const locale = useMemo(() => {
    if (language === 'ru') return 'ru-RU';
    if (language === 'uz') return 'uz-UZ';
    return 'en-US';
  }, [language]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);

  const [stats, setStats] = useState<TelegramUserStats | null>(null);
  const [activeCampaigns, setActiveCampaigns] = useState<BroadcastCampaign[]>([]);
  const [campaigns, setCampaigns] = useState<BroadcastCampaign[]>([]);
  const [total, setTotal] = useState(0);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [detail, setDetail] = useState<BroadcastDetailResponse | null>(null);

  useEffect(() => {
    if (!imageFile) {
      setImagePreviewUrl(null);
      return;
    }
    const objectUrl = URL.createObjectURL(imageFile);
    setImagePreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [imageFile]);

  const statusLabel = useCallback((status: CampaignStatus) => {
    switch (status) {
      case 'QUEUED':
        return tr('Queued', 'В очереди', 'Navbatda');
      case 'RUNNING':
        return tr('Running', 'Идёт отправка', 'Yuborilmoqda');
      case 'COMPLETED':
        return tr('Completed', 'Завершено', 'Tugallangan');
      case 'FAILED':
        return tr('Failed', 'Неуспешно', 'Muvaffaqiyatsiz');
      default:
        return status;
    }
  }, [tr]);

  const deliveryStatusLabel = useCallback((status: string) => {
    switch (status) {
      case 'SENT':
        return tr('Sent', 'Отправлено', 'Yuborildi');
      case 'FAILED':
        return tr('Failed', 'Ошибка', 'Xatolik');
      case 'SKIPPED':
        return tr('Skipped', 'Пропущено', "O'tkazib yuborildi");
      case 'PENDING':
        return tr('Pending', 'Ожидает', 'Kutilmoqda');
      case 'PROCESSING':
        return tr('Processing', 'Обрабатывается', 'Ishlanmoqda');
      default:
        return status;
    }
  }, [tr]);

  const formatDateTime = useCallback((value?: string | null) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleString(locale);
  }, [locale]);

  const audienceReach = stats?.reachable_telegram_clients_total ?? 0;
  const activePollingNeeded = activeCampaigns.some((campaign) => isCampaignActive(campaign)) || isCampaignActive(detail?.campaign);

  const loadCampaigns = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    if (silent) setRefreshing(true);
    try {
      const params = new URLSearchParams();
      params.set('limit', String(LIST_LIMIT));
      params.set('offset', '0');
      if (statusFilter) params.set('status', statusFilter);
      if (searchQuery.trim()) params.set('q', searchQuery.trim());
      const query = params.toString() ? `?${params.toString()}` : '';
      const response = await apiRequest<BroadcastListResponse>(`${ENDPOINTS.TELEGRAM_BROADCASTS.LIST_CREATE}${query}`);
      setStats(response.telegram_user_stats || null);
      setActiveCampaigns(response.active_campaigns || []);
      setCampaigns(response.results || []);
      setTotal(response.total || response.count || 0);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [searchQuery, statusFilter]);

  const loadDetail = useCallback(async (campaignId: string, silent = false) => {
    if (!silent) setDetailLoading(true);
    try {
      const response = await apiRequest<BroadcastDetailResponse>(`${ENDPOINTS.TELEGRAM_BROADCASTS.DETAIL(campaignId)}?limit=${DETAIL_LIMIT}`);
      setDetail(response);
    } finally {
      if (!silent) setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCampaigns();
  }, [loadCampaigns]);

  useEffect(() => {
    if (!selectedCampaignId) {
      setDetail(null);
      return;
    }
    void loadDetail(selectedCampaignId);
  }, [loadDetail, selectedCampaignId]);

  useEffect(() => {
    if (!activePollingNeeded) return;
    const intervalId = window.setInterval(() => {
      void loadCampaigns(true);
      if (selectedCampaignId) {
        void loadDetail(selectedCampaignId, true);
      }
    }, 5000);
    return () => window.clearInterval(intervalId);
  }, [activePollingNeeded, loadCampaigns, loadDetail, selectedCampaignId]);

  const openDetail = useCallback((campaignId: string) => {
    setSelectedCampaignId(campaignId);
  }, []);

  const closeDetail = useCallback(() => {
    setSelectedCampaignId(null);
    setDetail(null);
  }, []);

  const resetCreateForm = useCallback(() => {
    setTitle('');
    setText('');
    setImageFile(null);
    setImagePreviewUrl(null);
  }, []);

  const handleCreate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!text.trim()) {
      toast.error(tr('Broadcast text is required.', 'Текст рассылки обязателен.', 'Xabarnoma matni majburiy.'));
      return;
    }

    const confirmed = await confirm({
      title: tr('Send Telegram broadcast', 'Отправить Telegram-рассылку', 'Telegram xabarnoma yuborish'),
      message: tr(
        `Queue this campaign for ${audienceReach.toLocaleString()} reachable Telegram users?`,
        `Поставить эту рассылку в очередь для ${audienceReach.toLocaleString()} Telegram-пользователей?`,
        `Ushbu kampaniyani ${audienceReach.toLocaleString()} ta yetib boradigan Telegram foydalanuvchisiga navbatga qo‘yasizmi?`
      ),
      confirmLabel: tr('Queue broadcast', 'Поставить в очередь', 'Navbatga qo‘yish'),
      cancelLabel: t('cancel'),
      tone: 'warning',
    });

    if (!confirmed) return;

    try {
      setCreating(true);

      let response: BroadcastCreateResponse;
      if (imageFile) {
        const formData = new FormData();
        if (title.trim()) formData.append('title', title.trim());
        formData.append('text', text.trim());
        formData.append('image', imageFile);
        response = await apiRequest<BroadcastCreateResponse>(ENDPOINTS.TELEGRAM_BROADCASTS.LIST_CREATE, {
          method: 'POST',
          body: formData,
        });
      } else {
        response = await apiRequest<BroadcastCreateResponse>(ENDPOINTS.TELEGRAM_BROADCASTS.LIST_CREATE, {
          method: 'POST',
          body: JSON.stringify({
            title: title.trim(),
            text: text.trim(),
          }),
        });
      }

      if (response.queued) {
        toast.success(tr('Broadcast queued successfully.', 'Рассылка поставлена в очередь.', 'Xabarnoma navbatga qo‘yildi.'));
      } else {
        toast.warning(tr('Campaign was saved, but queueing failed.', 'Кампания сохранена, но очередь не запустилась.', 'Kampaniya saqlandi, lekin navbatga qo‘yish muvaffaqiyatsiz bo‘ldi.'));
      }

      resetCreateForm();
      await loadCampaigns(true);
      setSelectedCampaignId(response.campaign.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : tr('Failed to create broadcast.', 'Не удалось создать рассылку.', 'Xabarnomani yaratib bo‘lmadi.');
      toast.error(message);
    } finally {
      setCreating(false);
    }
  };

  const metricCards = useMemo(() => {
    const data = stats || {
      all_clients_total: 0,
      telegram_clients_total: 0,
      reachable_telegram_clients_total: 0,
      unreachable_telegram_clients_total: 0,
      telegram_clients_with_phone_total: 0,
      telegram_clients_with_username_total: 0,
    };

    return [
      {
        title: tr('Reachable Telegram users', 'Достижимые Telegram-пользователи', 'Yetib boradigan Telegram foydalanuvchilari'),
        value: data.reachable_telegram_clients_total,
        tone: 'emerald',
        icon: Users,
      },
      {
        title: tr('Telegram clients total', 'Всего Telegram-клиентов', 'Jami Telegram mijozlari'),
        value: data.telegram_clients_total,
        tone: 'blue',
        icon: Megaphone,
      },
      {
        title: tr('With username', 'С username', 'Username mavjud'),
        value: data.telegram_clients_with_username_total,
        tone: 'amber',
        icon: UserRound,
      },
      {
        title: tr('With phone', 'С телефоном', 'Telefon mavjud'),
        value: data.telegram_clients_with_phone_total,
        tone: 'none',
        icon: CheckCircle2,
      },
    ] as const;
  }, [stats, tr]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-blue-700 dark:border-blue-900/40 dark:bg-blue-900/20 dark:text-blue-300">
            <Megaphone size={13} />
            Telegram
          </div>
          <h1 className="mt-3 text-2xl font-bold text-light-text dark:text-white">
            {tr('Telegram Broadcasts', 'Telegram-рассылки', 'Telegram xabarnomalar')}
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-gray-500 dark:text-gray-400">
            {tr(
              'Create one campaign, queue it for every reachable Telegram user, and monitor live delivery progress from the same page.',
              'Создайте одну кампанию, поставьте её в очередь для всех достижимых Telegram-пользователей и отслеживайте прогресс отправки на этой же странице.',
              'Bitta kampaniya yarating, uni barcha yetib boradigan Telegram foydalanuvchilariga navbatga qo‘ying va yuborish jarayonini shu sahifada kuzating.'
            )}
          </p>
        </div>

        <button
          onClick={() => void loadCampaigns(true)}
          className="inline-flex items-center gap-2 rounded-xl border border-light-border bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-white/8 dark:bg-navy-800 dark:text-gray-200 dark:hover:bg-navy-700"
        >
          <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
          {tr('Refresh', 'Обновить', 'Yangilash')}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <Card accent="blue" className="overflow-hidden">
          <div className="space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {tr('Create broadcast', 'Создать рассылку', 'Xabarnoma yaratish')}
                </h2>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  {tr(
                    'Use a short title for internal history, write the full Telegram message, and optionally attach one image.',
                    'Используйте короткий заголовок для истории, напишите полный Telegram-текст и при необходимости прикрепите одно изображение.',
                    'Ichki tarix uchun qisqa sarlavha yozing, to‘liq Telegram matnini kiriting va xohlasangiz bitta rasm biriktiring.'
                  )}
                </p>
              </div>
              <div className="rounded-2xl bg-blue-50 p-3 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300">
                <SendHorizontal size={18} />
              </div>
            </div>

            <form className="space-y-4" onSubmit={handleCreate}>
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    {tr('Campaign title', 'Название кампании', 'Kampaniya sarlavhasi')}
                  </label>
                  <input
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder={tr('Optional. Backend can generate it from text.', 'Необязательно. Бэкенд может сгенерировать из текста.', 'Ixtiyoriy. Backend uni matndan yaratishi mumkin.')}
                    className="w-full rounded-xl border border-light-border bg-gray-50 px-4 py-3 text-sm text-gray-900 outline-none transition-colors focus:border-primary-blue dark:border-white/8 dark:bg-navy-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    {tr('Broadcast text', 'Текст рассылки', 'Xabarnoma matni')}
                  </label>
                  <textarea
                    value={text}
                    onChange={(event) => setText(event.target.value)}
                    placeholder={tr('Write the Telegram message that should reach every target user.', 'Напишите Telegram-сообщение, которое должно получить каждый пользователь.', 'Har bir foydalanuvchiga yuboriladigan Telegram xabarini yozing.')}
                    className="h-40 w-full rounded-xl border border-light-border bg-gray-50 px-4 py-3 text-sm text-gray-900 outline-none transition-colors focus:border-primary-blue dark:border-white/8 dark:bg-navy-900 dark:text-white"
                  />
                </div>

                <div className="rounded-2xl border border-dashed border-light-border bg-gray-50/70 p-4 dark:border-white/8 dark:bg-navy-900/40">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">
                        {tr('Optional image', 'Необязательное изображение', 'Ixtiyoriy rasm')}
                      </p>
                      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        {tr(
                          'If attached, backend sends the photo first and handles Telegram caption fallback automatically.',
                          'Если прикрепить, бэкенд сам отправит фото и корректно обработает ограничения подписи Telegram.',
                          'Agar rasm qo‘shilsa, backend uni Telegram caption cheklovlari bilan avtomatik boshqaradi.'
                        )}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="inline-flex items-center gap-2 rounded-xl bg-[#21404d] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#1a3340]"
                      >
                        <ImagePlus size={16} />
                        {imageFile
                          ? tr('Replace image', 'Заменить изображение', 'Rasmni almashtirish')
                          : tr('Choose image', 'Выбрать изображение', 'Rasm tanlash')}
                      </button>
                      {imageFile ? (
                        <button
                          type="button"
                          onClick={() => setImageFile(null)}
                          className="inline-flex items-center gap-2 rounded-xl border border-red-200 px-4 py-2.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 dark:border-red-900/40 dark:text-red-400 dark:hover:bg-red-900/20"
                        >
                          <X size={16} />
                          {tr('Remove', 'Убрать', 'Olib tashlash')}
                        </button>
                      ) : null}
                    </div>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) => setImageFile(event.target.files?.[0] || null)}
                  />

                  <div className="mt-4 overflow-hidden rounded-2xl border border-light-border bg-white dark:border-white/8 dark:bg-navy-900">
                    {imagePreviewUrl ? (
                      <div className="grid grid-cols-1 gap-0 md:grid-cols-[180px_1fr]">
                        <div className="h-44 bg-gray-100 dark:bg-navy-800">
                          <img src={imagePreviewUrl} alt="Broadcast preview" className="h-full w-full object-cover" />
                        </div>
                        <div className="p-4">
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">
                            {tr('Image preview', 'Предпросмотр', 'Oldindan ko‘rish')}
                          </p>
                          <p className="mt-3 text-sm font-semibold text-gray-900 dark:text-white">{imageFile?.name}</p>
                          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                            {tr('Telegram recipients will receive the image with this campaign, and backend will automatically fall back to text-only if photo sending fails.', 'Получатели в Telegram увидят это изображение вместе с рассылкой, а бэкенд автоматически переключится на текст, если отправка фото не удастся.', 'Telegram foydalanuvchilari ushbu rasmni kampaniya bilan birga oladi, rasm yuborish muvaffaqiyatsiz bo‘lsa backend avtomatik matnga o‘tadi.')}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex min-h-[176px] flex-col items-center justify-center px-6 py-10 text-center">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-100 text-gray-500 dark:bg-navy-800 dark:text-gray-300">
                          <ImagePlus size={20} />
                        </div>
                        <p className="mt-4 text-sm font-medium text-gray-700 dark:text-gray-300">
                          {tr('No image attached yet', 'Изображение пока не прикреплено', 'Hali rasm biriktirilmagan')}
                        </p>
                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                          {tr('This campaign can still be sent as a text-only Telegram message.', 'Эту кампанию всё равно можно отправить как текстовую Telegram-рассылку.', 'Bu kampaniyani baribir matnli Telegram xabarnoma sifatida yuborish mumkin.')}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-blue-100 bg-blue-50/80 px-4 py-3 dark:border-blue-900/30 dark:bg-blue-900/10">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600 dark:text-blue-300">
                        {tr('Current audience', 'Текущая аудитория', 'Joriy auditoriya')}
                      </p>
                      <p className="mt-1 text-sm text-blue-700 dark:text-blue-200">
                        {tr(
                          'Only verified Telegram users are included when this campaign is queued.',
                          'Когда кампания ставится в очередь, учитываются только подтверждённые Telegram-пользователи.',
                          'Kampaniya navbatga qo‘yilganda faqat tasdiqlangan Telegram foydalanuvchilari olinadi.'
                        )}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-white px-4 py-3 text-right shadow-sm dark:bg-navy-800">
                      <p className="text-xs uppercase tracking-[0.18em] text-gray-400">
                        {tr('Reachable now', 'Доступно сейчас', 'Hozir yetib boradi')}
                      </p>
                      <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">
                        {amountText(audienceReach)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={creating}
                    className="inline-flex items-center gap-2 rounded-xl bg-primary-blue px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
                  >
                    <SendHorizontal size={16} />
                    {creating
                      ? tr('Queueing broadcast...', 'Постановка в очередь...', 'Navbatga qo‘yilmoqda...')
                      : tr('Queue broadcast', 'Поставить в очередь', 'Navbatga qo‘yish')}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </Card>

        <div className="space-y-6">
          <Card accent="emerald">
            <div className="space-y-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {tr('Audience snapshot', 'Снимок аудитории', 'Auditoriya ko‘rinishi')}
                  </h2>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    {tr(
                      'Use this before launching a campaign to understand how much of your Telegram audience is actually reachable right now.',
                      'Используйте это перед запуском, чтобы понять, сколько Telegram-аудитории реально достижимо сейчас.',
                      'Kampaniyani ishga tushirishdan oldin, ayni paytda qancha Telegram auditoriyasiga yetib borish mumkinligini ko‘rish uchun foydalaning.'
                    )}
                  </p>
                </div>
                <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300">
                  <Users size={18} />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {metricCards.map((item) => (
                  <div key={item.title} className="rounded-2xl border border-light-border bg-gray-50/80 p-4 dark:border-white/8 dark:bg-navy-900/50">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{item.title}</p>
                        <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">{amountText(item.value)}</p>
                      </div>
                      <div className="rounded-xl bg-white p-2 text-gray-600 shadow-sm dark:bg-navy-800 dark:text-gray-300">
                        <item.icon size={16} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_auto]">
                <div className="rounded-2xl border border-light-border bg-gray-50/80 p-4 dark:border-white/8 dark:bg-navy-900/50">
                  <div className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
                    <Languages size={16} />
                    {tr('Language breakdown', 'Разбивка по языкам', 'Til bo‘yicha taqsimot')}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(['uz', 'ru', 'en'] as const).map((code) => (
                      <div key={code} className="inline-flex items-center gap-2 rounded-full border border-light-border bg-white px-3 py-2 text-sm text-gray-700 dark:border-white/8 dark:bg-navy-800 dark:text-gray-200">
                        <span className="font-semibold uppercase">{code}</span>
                        <span>{amountText(stats?.language_breakdown?.[code] || 0)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-light-border bg-gray-50/80 px-4 py-4 dark:border-white/8 dark:bg-navy-900/50">
                  <div className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
                    <Clock3 size={16} />
                    {tr('Latest Telegram client', 'Последний Telegram-клиент', 'So‘nggi Telegram mijoz')}
                  </div>
                  <p className="mt-3 text-sm text-gray-600 dark:text-gray-300">
                    {formatDateTime(stats?.latest_telegram_client_created_at)}
                  </p>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>

      <Card accent="blue">
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {tr('Active campaigns', 'Активные кампании', 'Faol kampaniyalar')}
              </h2>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {tr(
                  'This section refreshes while a campaign is queued or actively sending.',
                  'Этот блок обновляется, пока кампания стоит в очереди или активно отправляется.',
                  'Kampaniya navbatda turganda yoki yuborilayotganda ushbu bo‘lim yangilanadi.'
                )}
              </p>
            </div>
            <Badge variant={activeCampaigns.length ? 'info' : 'default'} dot>
              {activeCampaigns.length
                ? tr(`${activeCampaigns.length} running`, `${activeCampaigns.length} активна`, `${activeCampaigns.length} faol`)
                : tr('No active campaigns', 'Нет активных кампаний', 'Faol kampaniya yo‘q')}
            </Badge>
          </div>

          {activeCampaigns.length ? (
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              {activeCampaigns.map((campaign) => {
                const imageUrl = resolveAdminMediaUrl(campaign.image_url);
                return (
                  <div key={campaign.id} className="overflow-hidden rounded-2xl border border-light-border bg-gray-50/80 dark:border-white/8 dark:bg-navy-900/40">
                    <div className="grid grid-cols-1 md:grid-cols-[112px_1fr]">
                      <div className="h-full min-h-[148px] bg-gradient-to-br from-[#21404d] via-[#2f6bff] to-[#8bbec8]">
                        {imageUrl ? (
                          <img src={imageUrl} alt={campaign.title || campaign.text_preview || campaign.id} className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full items-center justify-center text-white/85">
                            <Megaphone size={24} />
                          </div>
                        )}
                      </div>
                      <div className="p-5">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <Badge variant={statusVariant(campaign.status)} dot>{statusLabel(campaign.status)}</Badge>
                              {campaign.has_image ? <Badge variant="cyan">{tr('Image', 'Фото', 'Rasm')}</Badge> : null}
                            </div>
                            <h3 className="mt-3 text-base font-semibold text-gray-900 dark:text-white">
                              {campaign.title || tr('Auto-generated title', 'Автозаголовок', 'Avto sarlavha')}
                            </h3>
                            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                              {campaign.text_preview || campaign.text}
                            </p>
                          </div>
                          <button
                            onClick={() => openDetail(campaign.id)}
                            className="inline-flex items-center gap-2 rounded-xl border border-light-border bg-white px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-white/8 dark:bg-navy-800 dark:text-gray-200 dark:hover:bg-navy-700"
                          >
                            <Eye size={16} />
                            {tr('Open', 'Открыть', 'Ochish')}
                          </button>
                        </div>

                        <div className="mt-4">
                          <div className="mb-2 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                            <span>{tr('Progress', 'Прогресс', 'Jarayon')}</span>
                            <span>{percentText(campaign.progress_percent)}</span>
                          </div>
                          <div className="h-2 rounded-full bg-gray-200 dark:bg-navy-800">
                            <div
                              className="h-2 rounded-full bg-gradient-to-r from-[#21404d] via-[#2f6bff] to-[#2fcf97] transition-all"
                              style={{ width: percentText(campaign.progress_percent) }}
                            />
                          </div>
                        </div>

                        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
                          <div className="rounded-xl bg-white px-3 py-3 dark:bg-navy-800">
                            <p className="text-xs text-gray-400">{tr('Audience', 'Аудитория', 'Auditoriya')}</p>
                            <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-white">{amountText(campaign.audience_total)}</p>
                          </div>
                          <div className="rounded-xl bg-white px-3 py-3 dark:bg-navy-800">
                            <p className="text-xs text-gray-400">{tr('Successful', 'Успешно', 'Muvaffaqiyatli')}</p>
                            <p className="mt-1 text-sm font-semibold text-emerald-600 dark:text-emerald-400">{amountText(campaign.successful_count)}</p>
                          </div>
                          <div className="rounded-xl bg-white px-3 py-3 dark:bg-navy-800">
                            <p className="text-xs text-gray-400">{tr('Pending', 'Ожидает', 'Kutilmoqda')}</p>
                            <p className="mt-1 text-sm font-semibold text-amber-600 dark:text-amber-400">{amountText(campaign.pending_count)}</p>
                          </div>
                          <div className="rounded-xl bg-white px-3 py-3 dark:bg-navy-800">
                            <p className="text-xs text-gray-400">{tr('Unsuccessful', 'Неуспешно', 'Muvaffaqiyatsiz')}</p>
                            <p className="mt-1 text-sm font-semibold text-red-600 dark:text-red-400">{amountText(campaign.unsuccessful_count)}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-light-border px-6 py-12 text-center dark:border-white/8">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100 text-gray-500 dark:bg-navy-800 dark:text-gray-300">
                <Megaphone size={22} />
              </div>
              <p className="mt-4 text-sm font-semibold text-gray-900 dark:text-white">
                {tr('No running campaigns right now', 'Сейчас нет активных кампаний', 'Hozir faol kampaniya yo‘q')}
              </p>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {tr('Once you queue a broadcast, live progress will appear here automatically.', 'После постановки рассылки в очередь здесь автоматически появится живой прогресс.', 'Xabarnoma navbatga qo‘yilgandan keyin jonli jarayon shu yerda ko‘rinadi.')}
              </p>
            </div>
          )}
        </div>
      </Card>

      <Card accent="amber">
        <div className="space-y-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {tr('Broadcast history', 'История рассылок', 'Xabarnomalar tarixi')}
              </h2>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {tr(
                  'Search campaigns, filter by status, and inspect delivery quality without leaving the page.',
                  'Ищите кампании, фильтруйте по статусу и проверяйте качество доставки, не покидая страницу.',
                  'Kampaniyalarni qidiring, status bo‘yicha filtrlang va yetkazish sifatini sahifani tark etmasdan tekshiring.'
                )}
              </p>
            </div>
            <div className="rounded-full border border-light-border bg-gray-50 px-4 py-2 text-sm text-gray-600 dark:border-white/8 dark:bg-navy-900 dark:text-gray-300">
              {tr('Showing latest', 'Показаны последние', 'So‘nggilari ko‘rsatilmoqda')} <span className="font-semibold text-gray-900 dark:text-white">{amountText(campaigns.length)}</span> / {amountText(total)}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_220px]">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                {t('search')}
              </label>
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder={tr('Search by title or text preview…', 'Поиск по названию или превью текста…', 'Sarlavha yoki matn bo‘yicha qidirish…')}
                className="w-full rounded-xl border border-light-border bg-gray-50 px-4 py-3 text-sm text-gray-900 outline-none transition-colors focus:border-primary-blue dark:border-white/8 dark:bg-navy-900 dark:text-white"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                {t('status')}
              </label>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="w-full rounded-xl border border-light-border bg-gray-50 px-4 py-3 text-sm text-gray-900 outline-none transition-colors focus:border-primary-blue dark:border-white/8 dark:bg-navy-900 dark:text-white"
              >
                <option value="">{tr('All statuses', 'Все статусы', 'Barcha holatlar')}</option>
                <option value="QUEUED">{statusLabel('QUEUED')}</option>
                <option value="RUNNING">{statusLabel('RUNNING')}</option>
                <option value="COMPLETED">{statusLabel('COMPLETED')}</option>
                <option value="FAILED">{statusLabel('FAILED')}</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div className="rounded-2xl border border-dashed border-light-border px-6 py-12 text-center text-sm text-gray-500 dark:border-white/8 dark:text-gray-400">
              {tr('Loading broadcast history…', 'Загрузка истории рассылок…', 'Xabarnomalar tarixi yuklanmoqda…')}
            </div>
          ) : campaigns.length ? (
            <div className="space-y-4">
              {campaigns.map((campaign) => {
                const imageUrl = resolveAdminMediaUrl(campaign.image_url);
                return (
                  <div key={campaign.id} className="rounded-2xl border border-light-border bg-white p-5 shadow-sm dark:border-white/8 dark:bg-navy-900/30">
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                      <div className="flex min-w-0 gap-4">
                        <div className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-gradient-to-br from-[#21404d] via-[#2f6bff] to-[#8bbec8]">
                          {imageUrl ? (
                            <img src={imageUrl} alt={campaign.title || campaign.text_preview || campaign.id} className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-white/85">
                              <Megaphone size={20} />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant={statusVariant(campaign.status)} dot>{statusLabel(campaign.status)}</Badge>
                            {campaign.has_image ? <Badge variant="cyan">{tr('Image attached', 'Есть изображение', 'Rasm biriktirilgan')}</Badge> : null}
                            {campaign.is_active ? <Badge variant="info">{tr('Live', 'В процессе', 'Faol')}</Badge> : null}
                          </div>
                          <h3 className="mt-3 text-base font-semibold text-gray-900 dark:text-white">
                            {campaign.title || tr('Auto-generated title', 'Автозаголовок', 'Avto sarlavha')}
                          </h3>
                          <p className="mt-1 max-w-3xl text-sm text-gray-500 dark:text-gray-400">
                            {campaign.text_preview || campaign.text}
                          </p>
                          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-gray-500 dark:text-gray-400">
                            <span>{tr('Created', 'Создано', 'Yaratilgan')}: {formatDateTime(campaign.created_at)}</span>
                            <span>{tr('Created by', 'Создал', 'Yaratgan')}: {campaign.created_by_user?.username || '-'}</span>
                            <span>{tr('Success rate', 'Доля успеха', 'Muvaffaqiyat ulushi')}: {percentText(campaign.success_rate_percent)}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openDetail(campaign.id)}
                          className="inline-flex items-center gap-2 rounded-xl border border-light-border bg-gray-50 px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-white dark:border-white/8 dark:bg-navy-800 dark:text-gray-200 dark:hover:bg-navy-700"
                        >
                          <Eye size={16} />
                          {tr('Details', 'Детали', 'Tafsilotlar')}
                        </button>
                      </div>
                    </div>

                    <div className="mt-4">
                      <div className="mb-2 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                        <span>{tr('Progress', 'Прогресс', 'Jarayon')}</span>
                        <span>{percentText(campaign.progress_percent)}</span>
                      </div>
                      <div className="h-2 rounded-full bg-gray-100 dark:bg-navy-800">
                        <div
                          className="h-2 rounded-full bg-gradient-to-r from-[#21404d] via-[#2f6bff] to-[#2fcf97]"
                          style={{ width: percentText(campaign.progress_percent) }}
                        />
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
                      <div className="rounded-xl bg-gray-50 px-3 py-3 dark:bg-navy-800">
                        <p className="text-xs text-gray-400">{tr('Audience', 'Аудитория', 'Auditoriya')}</p>
                        <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-white">{amountText(campaign.audience_total)}</p>
                      </div>
                      <div className="rounded-xl bg-gray-50 px-3 py-3 dark:bg-navy-800">
                        <p className="text-xs text-gray-400">{tr('Successful', 'Успешно', 'Muvaffaqiyatli')}</p>
                        <p className="mt-1 text-sm font-semibold text-emerald-600 dark:text-emerald-400">{amountText(campaign.successful_count)}</p>
                      </div>
                      <div className="rounded-xl bg-gray-50 px-3 py-3 dark:bg-navy-800">
                        <p className="text-xs text-gray-400">{tr('Pending', 'Ожидает', 'Kutilmoqda')}</p>
                        <p className="mt-1 text-sm font-semibold text-amber-600 dark:text-amber-400">{amountText(campaign.pending_count)}</p>
                      </div>
                      <div className="rounded-xl bg-gray-50 px-3 py-3 dark:bg-navy-800">
                        <p className="text-xs text-gray-400">{tr('Processing', 'Обрабатывается', 'Ishlanmoqda')}</p>
                        <p className="mt-1 text-sm font-semibold text-blue-600 dark:text-blue-400">{amountText(campaign.processing_count)}</p>
                      </div>
                      <div className="rounded-xl bg-gray-50 px-3 py-3 dark:bg-navy-800">
                        <p className="text-xs text-gray-400">{tr('Failed', 'Ошибка', 'Xatolik')}</p>
                        <p className="mt-1 text-sm font-semibold text-red-600 dark:text-red-400">{amountText(campaign.failed_count)}</p>
                      </div>
                      <div className="rounded-xl bg-gray-50 px-3 py-3 dark:bg-navy-800">
                        <p className="text-xs text-gray-400">{tr('Skipped', 'Пропущено', 'O‘tkazib yuborildi')}</p>
                        <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-white">{amountText(campaign.skipped_count)}</p>
                      </div>
                    </div>

                    {campaign.last_error ? (
                      <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-900/10 dark:text-red-300">
                        <span className="font-semibold">{tr('Last error', 'Последняя ошибка', 'So‘nggi xatolik')}:</span> {campaign.last_error}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-light-border px-6 py-12 text-center dark:border-white/8">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100 text-gray-500 dark:bg-navy-800 dark:text-gray-300">
                <Clock3 size={22} />
              </div>
              <p className="mt-4 text-sm font-semibold text-gray-900 dark:text-white">
                {tr('No campaigns match this view', 'Нет кампаний для этого фильтра', 'Bu ko‘rinish uchun kampaniyalar topilmadi')}
              </p>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {tr('Try a different search or status filter, or queue your first campaign above.', 'Попробуйте другой поиск или фильтр, либо запустите первую кампанию выше.', 'Boshqa qidiruv yoki filtrni sinab ko‘ring, yoki yuqoridan birinchi kampaniyani navbatga qo‘ying.')}
              </p>
            </div>
          )}
        </div>
      </Card>

      <Modal
        isOpen={Boolean(selectedCampaignId)}
        onClose={closeDetail}
        title={detail?.campaign?.title || tr('Campaign details', 'Детали кампании', 'Kampaniya tafsilotlari')}
        maxWidthClass="max-w-6xl"
        footer={
          <div className="flex w-full justify-between gap-3">
            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
              {detail?.campaign ? (
                <>
                  <Badge variant={statusVariant(detail.campaign.status)} dot>{statusLabel(detail.campaign.status)}</Badge>
                  <span>{tr('Updated', 'Обновлено', 'Yangilangan')}: {formatDateTime(detail.campaign.updated_at)}</span>
                </>
              ) : null}
            </div>
            <button
              onClick={closeDetail}
              className="rounded-xl border border-light-border px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-white/8 dark:text-gray-200 dark:hover:bg-navy-700"
            >
              {t('cancel')}
            </button>
          </div>
        }
      >
        {detailLoading && !detail ? (
          <div className="flex min-h-[280px] items-center justify-center">
            <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
              <RefreshCw size={18} className="animate-spin" />
              {tr('Loading campaign details…', 'Загрузка деталей кампании…', 'Kampaniya tafsilotlari yuklanmoqda…')}
            </div>
          </div>
        ) : detail?.campaign ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.1fr_0.9fr]">
              <div className="rounded-2xl border border-light-border bg-gray-50/80 p-5 dark:border-white/8 dark:bg-navy-900/40">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={statusVariant(detail.campaign.status)} dot>{statusLabel(detail.campaign.status)}</Badge>
                  {detail.campaign.has_image ? <Badge variant="cyan">{tr('Image attached', 'Есть изображение', 'Rasm biriktirilgan')}</Badge> : null}
                  {detail.campaign.is_active ? <Badge variant="info">{tr('Live progress', 'Живой прогресс', 'Jonli jarayon')}</Badge> : null}
                </div>

                <h3 className="mt-4 text-xl font-semibold text-gray-900 dark:text-white">
                  {detail.campaign.title || tr('Auto-generated title', 'Автозаголовок', 'Avto sarlavha')}
                </h3>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-gray-600 dark:text-gray-300">
                  {detail.campaign.text}
                </p>

                <div className="mt-5">
                  <div className="mb-2 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                    <span>{tr('Overall progress', 'Общий прогресс', 'Umumiy jarayon')}</span>
                    <span>{percentText(detail.campaign.progress_percent)}</span>
                  </div>
                  <div className="h-2 rounded-full bg-gray-200 dark:bg-navy-800">
                    <div
                      className="h-2 rounded-full bg-gradient-to-r from-[#21404d] via-[#2f6bff] to-[#2fcf97]"
                      style={{ width: percentText(detail.campaign.progress_percent) }}
                    />
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
                  <div className="rounded-xl bg-white px-4 py-3 dark:bg-navy-800">
                    <p className="text-xs text-gray-400">{tr('Audience', 'Аудитория', 'Auditoriya')}</p>
                    <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-white">{amountText(detail.campaign.audience_total)}</p>
                  </div>
                  <div className="rounded-xl bg-white px-4 py-3 dark:bg-navy-800">
                    <p className="text-xs text-gray-400">{tr('Successful', 'Успешно', 'Muvaffaqiyatli')}</p>
                    <p className="mt-1 text-sm font-semibold text-emerald-600 dark:text-emerald-400">{amountText(detail.campaign.successful_count)}</p>
                  </div>
                  <div className="rounded-xl bg-white px-4 py-3 dark:bg-navy-800">
                    <p className="text-xs text-gray-400">{tr('Pending', 'Ожидает', 'Kutilmoqda')}</p>
                    <p className="mt-1 text-sm font-semibold text-amber-600 dark:text-amber-400">{amountText(detail.campaign.pending_count)}</p>
                  </div>
                  <div className="rounded-xl bg-white px-4 py-3 dark:bg-navy-800">
                    <p className="text-xs text-gray-400">{tr('Success rate', 'Доля успеха', 'Muvaffaqiyat ulushi')}</p>
                    <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-white">{percentText(detail.campaign.success_rate_percent)}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="overflow-hidden rounded-2xl border border-light-border bg-gray-50/80 dark:border-white/8 dark:bg-navy-900/40">
                  {detail.campaign.image_url ? (
                    <img
                      src={resolveAdminMediaUrl(detail.campaign.image_url) || detail.campaign.image_url}
                      alt={detail.campaign.title || detail.campaign.text_preview || detail.campaign.id}
                      className="h-56 w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-56 items-center justify-center bg-gradient-to-br from-[#21404d] via-[#2f6bff] to-[#8bbec8] text-white/85">
                      <Megaphone size={30} />
                    </div>
                  )}
                </div>

                <div className="rounded-2xl border border-light-border bg-gray-50/80 p-5 dark:border-white/8 dark:bg-navy-900/40">
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                    {tr('Campaign audit', 'Аудит кампании', 'Kampaniya auditi')}
                  </h4>
                  <div className="mt-4 space-y-3 text-sm text-gray-600 dark:text-gray-300">
                    <div className="flex items-start justify-between gap-4">
                      <span>{tr('Created by', 'Создал', 'Yaratgan')}</span>
                      <span className="text-right font-medium text-gray-900 dark:text-white">{detail.campaign.created_by_user?.username || '-'}</span>
                    </div>
                    <div className="flex items-start justify-between gap-4">
                      <span>{tr('Created at', 'Создано', 'Yaratilgan')}</span>
                      <span className="text-right font-medium text-gray-900 dark:text-white">{formatDateTime(detail.campaign.created_at)}</span>
                    </div>
                    <div className="flex items-start justify-between gap-4">
                      <span>{tr('Started at', 'Запущено', 'Boshlangan')}</span>
                      <span className="text-right font-medium text-gray-900 dark:text-white">{formatDateTime(detail.campaign.started_at)}</span>
                    </div>
                    <div className="flex items-start justify-between gap-4">
                      <span>{tr('Finished at', 'Завершено', 'Tugagan')}</span>
                      <span className="text-right font-medium text-gray-900 dark:text-white">{formatDateTime(detail.campaign.finished_at)}</span>
                    </div>
                    <div className="flex items-start justify-between gap-4">
                      <span>{tr('Last delivery update', 'Последнее обновление доставки', 'So‘nggi yetkazish yangilanishi')}</span>
                      <span className="text-right font-medium text-gray-900 dark:text-white">{formatDateTime(detail.campaign.last_delivery_updated_at)}</span>
                    </div>
                    <div className="flex items-start justify-between gap-4">
                      <span>{tr('Processed', 'Обработано', 'Qayta ishlangan')}</span>
                      <span className="text-right font-medium text-gray-900 dark:text-white">{amountText(detail.campaign.processed_count)}</span>
                    </div>
                  </div>

                  {detail.campaign.last_error ? (
                    <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-900/10 dark:text-red-300">
                      <span className="font-semibold">{tr('Last error', 'Последняя ошибка', 'So‘nggi xatolik')}:</span> {detail.campaign.last_error}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
              <div className="rounded-2xl border border-light-border bg-gray-50/80 p-5 dark:border-white/8 dark:bg-navy-900/40">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h4 className="text-base font-semibold text-gray-900 dark:text-white">
                      {tr('Recent deliveries', 'Последние доставки', 'So‘nggi yetkazishlar')}
                    </h4>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                      {tr('Most recent delivery attempts for this campaign.', 'Последние попытки доставки для этой кампании.', 'Ushbu kampaniya uchun eng so‘nggi yetkazish urinishlari.')}
                    </p>
                  </div>
                  <Badge variant="default">{amountText(detail.recent_deliveries_count || 0)}</Badge>
                </div>

                <div className="mt-4 space-y-3">
                  {detail.recent_deliveries?.length ? detail.recent_deliveries.map((delivery) => (
                    <div key={delivery.id} className="rounded-2xl border border-light-border bg-white p-4 dark:border-white/8 dark:bg-navy-800/70">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-gray-900 dark:text-white">
                            {delivery.client?.full_name || delivery.client?.username || delivery.chat_id || delivery.id}
                          </p>
                          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            {delivery.client?.username ? `@${delivery.client.username}` : delivery.client?.phone || delivery.chat_id || '-'}
                          </p>
                        </div>
                        <Badge variant={deliveryVariant(delivery.status)}>{deliveryStatusLabel(delivery.status)}</Badge>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-gray-500 dark:text-gray-400">
                        <span>{tr('Attempted', 'Попытка', 'Urinish')}: {formatDateTime(delivery.attempted_at || delivery.created_at)}</span>
                        <span>{tr('Sent', 'Отправлено', 'Yuborilgan')}: {formatDateTime(delivery.sent_at)}</span>
                        {delivery.telegram_message_id ? <span>#{delivery.telegram_message_id}</span> : null}
                      </div>
                    </div>
                  )) : (
                    <div className="rounded-2xl border border-dashed border-light-border px-4 py-8 text-center text-sm text-gray-500 dark:border-white/8 dark:text-gray-400">
                      {tr('No delivery rows yet.', 'Пока нет строк доставки.', 'Hali yetkazish qatorlari yo‘q.')}
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-light-border bg-gray-50/80 p-5 dark:border-white/8 dark:bg-navy-900/40">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h4 className="text-base font-semibold text-gray-900 dark:text-white">
                      {tr('Recent failures', 'Последние ошибки', 'So‘nggi xatoliklar')}
                    </h4>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                      {tr('Use this list to spot delivery issues quickly.', 'Используйте этот список, чтобы быстро увидеть проблемы с доставкой.', 'Yetkazishdagi muammolarni tez ko‘rish uchun shu ro‘yxatdan foydalaning.')}
                    </p>
                  </div>
                  <Badge variant={(detail.recent_failures_count || 0) > 0 ? 'error' : 'default'}>
                    {amountText(detail.recent_failures_count || 0)}
                  </Badge>
                </div>

                <div className="mt-4 space-y-3">
                  {detail.recent_failures?.length ? detail.recent_failures.map((failure) => (
                    <div key={failure.id} className="rounded-2xl border border-red-200 bg-red-50/70 p-4 dark:border-red-900/30 dark:bg-red-900/10">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-red-800 dark:text-red-300">
                            {failure.client?.full_name || failure.client?.username || failure.chat_id || failure.id}
                          </p>
                          <p className="mt-1 text-xs text-red-700/80 dark:text-red-300/80">
                            {failure.client?.username ? `@${failure.client.username}` : failure.client?.phone || failure.chat_id || '-'}
                          </p>
                        </div>
                        <Badge variant={deliveryVariant(failure.status)}>{deliveryStatusLabel(failure.status)}</Badge>
                      </div>
                      <p className="mt-3 text-sm text-red-700 dark:text-red-300">
                        {failure.error_message || tr('No error message provided.', 'Сообщение об ошибке отсутствует.', 'Xatolik matni berilmagan.')}
                      </p>
                      <div className="mt-3 text-xs text-red-700/80 dark:text-red-300/80">
                        {tr('Updated', 'Обновлено', 'Yangilangan')}: {formatDateTime(failure.updated_at)}
                      </div>
                    </div>
                  )) : (
                    <div className="rounded-2xl border border-dashed border-light-border px-4 py-8 text-center text-sm text-gray-500 dark:border-white/8 dark:text-gray-400">
                      {tr('No recent failures in this detail window.', 'В этом окне нет недавних ошибок.', 'Bu ko‘rinishda so‘nggi xatoliklar yo‘q.')}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex min-h-[240px] items-center justify-center text-sm text-gray-500 dark:text-gray-400">
            {tr('Campaign details are unavailable.', 'Детали кампании недоступны.', 'Kampaniya tafsilotlari mavjud emas.')}
          </div>
        )}
      </Modal>

      {confirmationModal}
    </div>
  );
};

export default TelegramBroadcasts;
