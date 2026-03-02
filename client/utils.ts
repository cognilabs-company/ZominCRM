import { ClientOrderStatus, ClientPaymentMethod, ClientUiLanguage } from './types';

const localeMap: Record<ClientUiLanguage, string> = {
  uz: 'uz-UZ',
  ru: 'ru-RU',
  en: 'en-US',
};

const currencySuffix: Record<ClientUiLanguage, string> = {
  uz: 'so\'m',
  ru: 'сум',
  en: 'UZS',
};

export const formatAmount = (value?: number | null, language: ClientUiLanguage = 'uz') => `${Intl.NumberFormat(localeMap[language]).format(Number(value || 0))} ${currencySuffix[language]}`;

export const formatDateTime = (value?: string | null, language: ClientUiLanguage = 'uz') => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString(localeMap[language]);
};

export const formatDate = (value?: string | null, language: ClientUiLanguage = 'uz') => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString(localeMap[language]);
};

export const formatOrderRef = (orderId?: string | null) => (orderId ? `#${orderId.slice(0, 8)}` : '-');

export const getOrderStatusLabel = (status?: ClientOrderStatus | string | null, language: ClientUiLanguage = 'uz') => {
  const labels: Record<string, Record<ClientUiLanguage, string>> = {
    NEW_LEAD: { uz: 'Yangi murojaat', ru: 'Новый лид', en: 'New lead' },
    INFO_COLLECTED: { uz: 'Ma\'lumot olindi', ru: 'Данные собраны', en: 'Info collected' },
    PAYMENT_PENDING: { uz: 'To\'lov kutilmoqda', ru: 'Ожидается оплата', en: 'Payment pending' },
    PAYMENT_CONFIRMED: { uz: 'To\'lov tasdiqlangan', ru: 'Оплата подтверждена', en: 'Payment confirmed' },
    DISPATCHED: { uz: 'Jo\'natildi', ru: 'Отправлен', en: 'Dispatched' },
    ASSIGNED: { uz: 'Biriktirildi', ru: 'Назначен', en: 'Assigned' },
    OUT_FOR_DELIVERY: { uz: 'Yetkazib berishda', ru: 'В доставке', en: 'Out for delivery' },
    DELIVERED: { uz: 'Yetkazildi', ru: 'Доставлен', en: 'Delivered' },
    CANCELED: { uz: 'Bekor qilindi', ru: 'Отменен', en: 'Canceled' },
    FAILED: { uz: 'Muvaffaqiyatsiz', ru: 'Неуспешно', en: 'Failed' },
  };
  return labels[status || '']?.[language] || status || '-';
};

export const getOrderStatusClasses = (status?: ClientOrderStatus | string | null) => {
  switch (status) {
    case 'DELIVERED':
      return 'bg-emerald-100 text-emerald-700';
    case 'PAYMENT_CONFIRMED':
    case 'DISPATCHED':
    case 'ASSIGNED':
    case 'OUT_FOR_DELIVERY':
      return 'bg-sky-100 text-sky-700';
    case 'PAYMENT_PENDING':
    case 'INFO_COLLECTED':
    case 'NEW_LEAD':
      return 'bg-amber-100 text-amber-700';
    case 'FAILED':
    case 'CANCELED':
      return 'bg-rose-100 text-rose-700';
    default:
      return 'bg-slate-100 text-slate-600';
  }
};

export const getAvailabilityLabel = (status?: string | null, language: ClientUiLanguage = 'uz') => {
  const labels: Record<string, Record<ClientUiLanguage, string>> = {
    in_stock: { uz: 'Bor', ru: 'В наличии', en: 'In stock' },
    low_stock: { uz: 'Kam qoldi', ru: 'Мало осталось', en: 'Low stock' },
    out_of_stock: { uz: 'Tugagan', ru: 'Нет в наличии', en: 'Out of stock' },
  };
  return labels[status || '']?.[language] || status || '-';
};

export const getAvailabilityClasses = (status?: string | null) => {
  switch (status) {
    case 'in_stock': return 'bg-emerald-100 text-emerald-700';
    case 'low_stock': return 'bg-amber-100 text-amber-700';
    case 'out_of_stock': return 'bg-rose-100 text-rose-700';
    default: return 'bg-slate-100 text-slate-600';
  }
};

export const getMovementLabel = (movementType?: string | null, language: ClientUiLanguage = 'uz') => {
  const labels: Record<string, Record<ClientUiLanguage, string>> = {
    DELIVERY: { uz: 'Yetkazib berish', ru: 'Доставка', en: 'Delivery' },
    ORDER_DELIVERED: { uz: 'Buyurtma yetkazildi', ru: 'Заказ доставлен', en: 'Order delivered' },
    REFUND: { uz: 'Qaytarildi', ru: 'Возврат', en: 'Refund' },
    MANUAL_ADJUST: { uz: 'Qo\'lda tuzatish', ru: 'Ручная корректировка', en: 'Manual adjust' },
  };
  return labels[movementType || '']?.[language] || movementType || '-';
};

export const getPaymentMethodLabel = (paymentMethod?: ClientPaymentMethod | string | null, language: ClientUiLanguage = 'uz') => {
  const labels: Record<string, Record<ClientUiLanguage, string>> = {
    CASH: { uz: 'Naqd pul', ru: 'Наличные', en: 'Cash' },
    TRANSFER: { uz: 'O\'tkazma', ru: 'Перевод', en: 'Transfer' },
    UNKNOWN: { uz: 'Noma\'lum', ru: 'Неизвестно', en: 'Unknown' },
  };
  return labels[paymentMethod || '']?.[language] || paymentMethod || '-';
};

export const getPaymentProviderLabel = (provider?: string | null, language: ClientUiLanguage = 'uz') => {
  const labels: Record<string, Record<ClientUiLanguage, string>> = {
    PAYME: { uz: 'Payme', ru: 'Payme', en: 'Payme' },
    CLICK: { uz: 'Click', ru: 'Click', en: 'Click' },
  };
  return labels[provider || '']?.[language] || provider || '-';
};

export const isClientOrderTerminal = (status?: ClientOrderStatus | string | null) =>
  status === 'DELIVERED' || status === 'CANCELED' || status === 'FAILED';

export const getClientLanguageLabel = (languageCode?: string | null, language: ClientUiLanguage = 'uz') => {
  const normalized = (languageCode || '').trim().toLowerCase();
  if (normalized.startsWith('ru')) {
    return language === 'uz' ? 'Ruscha' : language === 'ru' ? 'Русский' : 'Russian';
  }
  if (normalized.startsWith('en')) {
    return language === 'uz' ? 'Inglizcha' : language === 'ru' ? 'Английский' : 'English';
  }
  if (normalized.startsWith('uz')) {
    return language === 'uz' ? 'O\'zbekcha' : language === 'ru' ? 'Узбекский' : 'Uzbek';
  }
  return languageCode || '-';
};

export const parseNumericInput = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const numeric = Number(trimmed);
  return Number.isFinite(numeric) ? numeric : null;
};

