import { ClientOrderStatus } from './types';

export const formatAmount = (value?: number | null) => `${Number(value || 0).toLocaleString()} UZS`;

export const formatDateTime = (value?: string | null) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString();
};

export const formatDate = (value?: string | null) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString();
};

export const formatOrderRef = (orderId?: string | null) => (orderId ? `#${orderId.slice(0, 8)}` : '-');

export const getOrderStatusLabel = (status?: ClientOrderStatus | string | null) => {
  switch (status) {
    case 'NEW_LEAD': return 'New lead';
    case 'INFO_COLLECTED': return 'Info collected';
    case 'PAYMENT_PENDING': return 'Payment pending';
    case 'PAYMENT_CONFIRMED': return 'Payment confirmed';
    case 'DISPATCHED': return 'Dispatched';
    case 'ASSIGNED': return 'Assigned';
    case 'OUT_FOR_DELIVERY': return 'Out for delivery';
    case 'DELIVERED': return 'Delivered';
    case 'CANCELED': return 'Canceled';
    case 'FAILED': return 'Failed';
    default: return status || '-';
  }
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

export const getAvailabilityLabel = (status?: string | null) => {
  switch (status) {
    case 'in_stock': return 'In stock';
    case 'low_stock': return 'Low stock';
    case 'out_of_stock': return 'Out of stock';
    default: return status || '-';
  }
};

export const getAvailabilityClasses = (status?: string | null) => {
  switch (status) {
    case 'in_stock': return 'bg-emerald-100 text-emerald-700';
    case 'low_stock': return 'bg-amber-100 text-amber-700';
    case 'out_of_stock': return 'bg-rose-100 text-rose-700';
    default: return 'bg-slate-100 text-slate-600';
  }
};

export const getMovementLabel = (movementType?: string | null) => {
  switch (movementType) {
    case 'ORDER_DELIVERED': return 'Order delivered';
    case 'REFUND': return 'Refund';
    case 'MANUAL_ADJUST': return 'Manual adjust';
    default: return movementType || '-';
  }
};

export const parseNumericInput = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const numeric = Number(trimmed);
  return Number.isFinite(numeric) ? numeric : null;
};
