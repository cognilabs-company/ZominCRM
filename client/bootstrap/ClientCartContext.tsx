import React from 'react';
import { ClientCartItem, ClientOrderDraft, ClientProduct } from '../types';

interface ClientCartContextValue {
  items: ClientCartItem[];
  orderDraft: ClientOrderDraft;
  itemsCount: number;
  productSubtotal: number;
  addProduct: (product: ClientProduct) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  removeProduct: (productId: string) => void;
  clearCart: () => void;
  setOrderDraft: (patch: Partial<ClientOrderDraft>) => void;
  getItemQuantity: (productId: string) => number;
}

const CART_STORAGE_KEY = 'client_webapp_cart_v1';
const DRAFT_STORAGE_KEY = 'client_webapp_order_draft_v1';

const defaultDraft: ClientOrderDraft = {
  payment_method: 'CASH',
  location_text: '',
  location_lat: '',
  location_lng: '',
  delivery_time_requested: '',
};

const ClientCartContext = React.createContext<ClientCartContextValue | undefined>(undefined);

const readStorage = <T,>(key: string, fallback: T): T => {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};

export const ClientCartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = React.useState<ClientCartItem[]>(() => readStorage<ClientCartItem[]>(CART_STORAGE_KEY, []));
  const [orderDraft, setOrderDraftState] = React.useState<ClientOrderDraft>(() => readStorage<ClientOrderDraft>(DRAFT_STORAGE_KEY, defaultDraft));

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    window.sessionStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    window.sessionStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(orderDraft));
  }, [orderDraft]);

  const addProduct = React.useCallback((product: ClientProduct) => {
    setItems((current) => {
      const existing = current.find((item) => item.product_id === product.id);
      if (existing) {
        return current.map((item) => item.product_id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [
        ...current,
        {
          product_id: product.id,
          name: product.name,
          sku: product.sku,
          size_liters: product.size_liters,
          unit_price_uzs: product.price_uzs,
          bottle_deposit_uzs: product.bottle_deposit_uzs,
          requires_returnable_bottle: product.requires_returnable_bottle,
          availability_status: product.availability_status,
          available_count: product.count,
          quantity: 1,
        },
      ];
    });
  }, []);

  const updateQuantity = React.useCallback((productId: string, quantity: number) => {
    setItems((current) => {
      if (quantity <= 0) {
        return current.filter((item) => item.product_id !== productId);
      }
      return current.map((item) => item.product_id === productId ? { ...item, quantity } : item);
    });
  }, []);

  const removeProduct = React.useCallback((productId: string) => {
    setItems((current) => current.filter((item) => item.product_id !== productId));
  }, []);

  const clearCart = React.useCallback(() => {
    setItems([]);
    setOrderDraftState(defaultDraft);
  }, []);

  const setOrderDraft = React.useCallback((patch: Partial<ClientOrderDraft>) => {
    setOrderDraftState((current) => ({ ...current, ...patch }));
  }, []);

  const getItemQuantity = React.useCallback((productId: string) => {
    const item = items.find((entry) => entry.product_id === productId);
    return item?.quantity || 0;
  }, [items]);

  const itemsCount = React.useMemo(() => items.reduce((sum, item) => sum + item.quantity, 0), [items]);
  const productSubtotal = React.useMemo(() => items.reduce((sum, item) => sum + (item.unit_price_uzs * item.quantity), 0), [items]);

  const value = React.useMemo<ClientCartContextValue>(() => ({
    items,
    orderDraft,
    itemsCount,
    productSubtotal,
    addProduct,
    updateQuantity,
    removeProduct,
    clearCart,
    setOrderDraft,
    getItemQuantity,
  }), [addProduct, clearCart, getItemQuantity, items, itemsCount, orderDraft, productSubtotal, removeProduct, setOrderDraft, updateQuantity]);

  return <ClientCartContext.Provider value={value}>{children}</ClientCartContext.Provider>;
};

export const useClientCart = () => {
  const context = React.useContext(ClientCartContext);
  if (!context) {
    throw new Error('useClientCart must be used within ClientCartProvider.');
  }
  return context;
};
