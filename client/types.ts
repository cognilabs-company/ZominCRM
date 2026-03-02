export type ClientAppStatus = 'loading' | 'ready' | 'error';

export type ClientAppMode = 'telegram' | 'preview';

export type ClientPreferredLanguage = 'en' | 'ru' | 'uz' | string;

export type ClientUiLanguage = 'uz' | 'ru' | 'en';

export type ClientPaymentMethod = 'UNKNOWN' | 'CASH' | 'TRANSFER';

export type ClientOrderStatus =
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

export interface ClientTelegramUser {
  id?: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

export interface ClientProfile {
  id: string;
  full_name: string;
  phone: string;
  address: string;
  username: string;
  preferred_language: ClientPreferredLanguage;
  platform: string;
  platform_user_id: string;
  created_at?: string;
}

export interface ClientBottleSummary {
  total_outstanding_bottles_count: number;
  total_deposit_held_uzs: number;
}

export interface ClientOrderItem {
  id?: string;
  order_id?: string;
  product_id: string;
  product_name: string;
  product_size_liters?: string | number | null;
  product_available_count?: number | null;
  quantity: number;
  unit_price_uzs: number;
  line_total_uzs: number;
  requires_returnable_bottle?: boolean;
  bottle_deposit_unit_uzs?: number;
  bottle_deposit_charge_quantity?: number;
  bottle_deposit_total_uzs?: number;
  already_covered_bottle_count?: number;
  status?: boolean;
  created_at?: string;
}

export interface ClientOrder {
  id: string;
  client_id?: string;
  lead_id?: string | null;
  courier_id?: string | null;
  status: ClientOrderStatus;
  payment_method: ClientPaymentMethod;
  product_subtotal_uzs?: number;
  bottle_deposit_total_uzs?: number;
  total_amount_uzs: number;
  location_text?: string | null;
  location_lat?: number | null;
  location_lng?: number | null;
  delivery_time_requested?: string | null;
  client_confirmed_at?: string | null;
  created_at: string;
  updated_at: string;
  items_count?: number;
  items?: ClientOrderItem[];
}

export interface ClientProduct {
  id: string;
  name: string;
  sku: string;
  image_url?: string | null;
  size_liters: string;
  price_uzs: number;
  count: number;
  is_active: boolean;
  requires_returnable_bottle: boolean;
  bottle_deposit_uzs: number;
  availability_status: string;
}

export interface ClientBottleBalance {
  id: string;
  client_id: string;
  product_id: string;
  product_name: string;
  product_size_liters?: string | null;
  outstanding_bottles_count: number;
  deposit_held_uzs: number;
  total_deposit_charged_uzs: number;
  total_deposit_refunded_uzs: number;
  updated_at: string;
}

export interface ClientBottleMovement {
  id: string;
  movement_type: 'DELIVERY' | 'REFUND' | 'MANUAL_ADJUST' | string;
  quantity: number;
  deposit_delta_uzs: number;
  created_at: string;
  product_id?: string;
  product_name?: string;
  product_size_liters?: string | null;
  order_id?: string | null;
}

export interface ClientBootstrapResponse {
  ok: boolean;
  token: string;
  token_expires_at: string;
  token_expires_in: number;
  client_created: boolean;
  client: ClientProfile;
  active_order: ClientOrder | null;
  bottle_summary: ClientBottleSummary | null;
  telegram_user: ClientTelegramUser | null;
  entry?: ClientWebAppEntry | null;
}

export interface ClientWebAppEntry {
  webapp_url: string;
  bot_username?: string;
  bot_url?: string;
  start_url?: string;
  startapp_url?: string;
  open_in_telegram_required?: boolean;
}

export interface ClientWebAppConfigResponse {
  ok: boolean;
  entry: ClientWebAppEntry;
}

export interface ClientBootstrapState {
  status: ClientAppStatus;
  mode: ClientAppMode;
  telegramAvailable: boolean;
  initData: string;
  telegramUser: ClientTelegramUser | null;
  apiBaseUrl: string;
  error: string | null;
  sessionToken: string | null;
  tokenExpiresAt: string | null;
  tokenExpiresIn: number | null;
  clientCreated: boolean;
  client: ClientProfile | null;
  activeOrder: ClientOrder | null;
  bottleSummary: ClientBottleSummary | null;
  isAuthenticated: boolean;
  entry: ClientWebAppEntry | null;
  openInTelegramUrl: string | null;
}

export interface ClientProductsResponse {
  ok?: boolean;
  count?: number;
  results?: ClientProduct[];
}

export interface ClientOrderDraft {
  payment_method: ClientPaymentMethod;
  location_text: string;
  location_lat: string;
  location_lng: string;
  delivery_time_requested: string;
}

export interface ClientCartItem {
  product_id: string;
  name: string;
  sku: string;
  size_liters: string;
  unit_price_uzs: number;
  bottle_deposit_uzs: number;
  requires_returnable_bottle: boolean;
  availability_status: string;
  available_count: number;
  quantity: number;
}

export interface ClientOrderPreview {
  product_subtotal_uzs: number;
  bottle_deposit_total_uzs: number;
  total_amount_uzs: number;
  items_count: number;
  items: ClientOrderItem[];
}

export interface ClientOrderPreviewResponse {
  ok: boolean;
  blocked_by_active_order: boolean;
  active_order?: ClientOrder | null;
  bottle_summary?: ClientBottleSummary | null;
  preview?: ClientOrderPreview | null;
}

export interface ClientCreateOrderResponse {
  ok: boolean;
  order: ClientOrder;
  bottle_summary: ClientBottleSummary | null;
}

export interface ClientOrdersListResponse {
  ok?: boolean;
  count?: number;
  results?: ClientOrder[];
}

export interface ClientOrderDetailResponse {
  ok?: boolean;
  order?: ClientOrder;
}

export interface ClientProfileResponse {
  ok?: boolean;
  client?: ClientProfile;
}

export interface ClientBottlesResponse {
  ok: boolean;
  summary: ClientBottleSummary;
  balances_count: number;
  balances: ClientBottleBalance[];
  movements_count: number;
  movements: ClientBottleMovement[];
}

