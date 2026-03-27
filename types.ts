export type Language = 'en' | 'ru' | 'uz';

export interface Translation {
  [key: string]: {
    en: string;
    ru: string;
    uz: string;
  };
}

export type Theme = 'dark' | 'light';

export interface NavItem {
  id: string;
  icon: any; // LucideIcon
  path: string;
  labelKey: string;
}

// --- CORE ENUMS ---

export type Platform = 'telegram' | 'instagram' | 'manual';

export type ConversationChannel = 'telegram' | 'instagram';

export type MessageRole = 'client' | 'bot' | 'admin' | 'system';

export type LeadStatus = 'NEW' | 'QUALIFIED' | 'CONVERTED' | 'LOST';

export type OrderStatus =
  | 'NEW_LEAD'
  | 'INFO_COLLECTED'
  | 'PAYMENT_PENDING'
  | 'PAYMENT_CONFIRMED'
  | 'DISPATCHED'
  | 'ASSIGNED'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'CANCELED'
  | 'FAILED';

export type PaymentMethod = 'UNKNOWN' | 'CASH' | 'TRANSFER';

export type PaymentProvider = 'PAYME' | 'CLICK';

export type CourierEventType = 'BROADCASTED' | 'ACCEPTED' | 'REJECTED' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'PROBLEM';

// --- DATA MODELS ---

export interface User {
  id: string;
  name: string;
  role: 'admin' | 'manager' | 'courier';
  avatar?: string;
}

export interface Client {
  id: string;
  platform: Platform;
  username: string | null;
  full_name: string | null;
  phone: string | null;
  address: string | null;
  preferred_language?: Language | null;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  image_url?: string | null;
  image_thumb_url?: string | null;
  images?: Array<{
    id: string;
    url: string;
    thumb_url?: string | null;
    sort_order?: number;
    created_at?: string;
  }>;
  size_liters: string;
  price_uzs: number;
  count: number;
  min_stock_threshold: number;
  availability_status: 'in_stock' | 'low_stock' | 'out_of_stock';
  requires_returnable_bottle?: boolean;
  bottle_deposit_uzs?: number;
  is_active: boolean;
  updated_at: string | null;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_name: string;
  product_size_liters?: string | number | null;
  qty: number;
  price_uzs: number;
  line_total_uzs: number;
  bottle_deposit_unit_uzs?: number;
  bottle_deposit_charge_quantity?: number;
  bottle_deposit_total_uzs?: number;
}

export interface Order {
  id: string;
  client_id: string | null;
  client_name?: string; // Frontend helper
  conversation_id: string | null;
  status: OrderStatus;
  payment_method: PaymentMethod;
  total_uzs: number;
  product_subtotal_uzs?: number;
  bottle_deposit_total_uzs?: number;
  order_source?: 'LIVE' | 'MANUAL_OFFLINE';
  is_offline_recorded?: boolean;
  auto_dispatch_enabled?: boolean;
  delivery_address: string | null;
  delivery_lat: number | null;
  delivery_lng: number | null;
  requested_time: string | null;
  courier_id: string | null;
  created_at: string;
  updated_at: string;
  items?: OrderItem[]; // Frontend helper for detail view
}

export interface Conversation {
  id: string;
  channel: ConversationChannel;
  channel_account_id?: string | null;
  external_thread_id: string;
  client_id: string | null;
  linked_order_id: string | null;
  last_message_preview: string | null;
  updated_at: string;
  unreadCount?: number; // Frontend helper
  clientName?: string; // Frontend helper
}

export interface Message {
  id: string;
  conversation_id: string;
  role: MessageRole;
  text: string;
  created_at: string;
}
