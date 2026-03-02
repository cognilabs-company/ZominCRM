import React from 'react';
import { LucideIcon, Package, ShoppingCart, ShoppingBag, Inbox, FileX, Search } from 'lucide-react';

interface ClientEmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export const ClientEmptyState: React.FC<ClientEmptyStateProps> = ({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className = ''
}) => (
  <div className={`flex flex-col items-center justify-center py-12 px-6 text-center ${className}`}>
    <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-slate-100 text-slate-400">
      <Icon size={36} strokeWidth={1.5} />
    </div>
    <h3 className="mt-5 text-base font-semibold text-slate-950">{title}</h3>
    {description ? (
      <p className="mt-2 max-w-xs text-sm leading-6 text-slate-500">{description}</p>
    ) : null}
    {action ? <div className="mt-5">{action}</div> : null}
  </div>
);

// Preset empty states for common use cases

interface EmptyProductsProps {
  onAction?: () => void;
  actionLabel?: string;
}

export const EmptyProducts: React.FC<EmptyProductsProps> = ({
  onAction,
  actionLabel
}) => (
  <ClientEmptyState
    icon={ShoppingBag}
    title="No products available"
    description="There are no products available at the moment. Check back later for updates."
    action={onAction ? (
      <button
        type="button"
        onClick={onAction}
        className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 active:bg-slate-900 shadow-md hover:shadow-lg"
      >
        <Search size={16} />
        {actionLabel || 'Refresh'}
      </button>
    ) : undefined}
  />
);

interface EmptyOrdersProps {
  onAction?: () => void;
  actionLabel?: string;
}

export const EmptyOrders: React.FC<EmptyOrdersProps> = ({
  onAction,
  actionLabel
}) => (
  <ClientEmptyState
    icon={Package}
    title="No orders yet"
    description="You haven't placed any orders yet. Start shopping to see your orders here."
    action={onAction ? (
      <button
        type="button"
        onClick={onAction}
        className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 active:bg-slate-900 shadow-md hover:shadow-lg"
      >
        <ShoppingBag size={16} />
        {actionLabel || 'Browse Products'}
      </button>
    ) : undefined}
  />
);

interface EmptyCartProps {
  onAction?: () => void;
  actionLabel?: string;
}

export const EmptyCart: React.FC<EmptyCartProps> = ({
  onAction,
  actionLabel
}) => (
  <ClientEmptyState
    icon={ShoppingCart}
    title="Your cart is empty"
    description="Add some products to your cart to get started with your order."
    action={onAction ? (
      <button
        type="button"
        onClick={onAction}
        className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 active:bg-slate-900 shadow-md hover:shadow-lg"
      >
        <ShoppingBag size={16} />
        {actionLabel || 'Browse Products'}
      </button>
    ) : undefined}
  />
);

interface EmptySearchProps {
  query?: string;
  onAction?: () => void;
  actionLabel?: string;
}

export const EmptySearch: React.FC<EmptySearchProps> = ({
  query,
  onAction,
  actionLabel
}) => (
  <ClientEmptyState
    icon={Search}
    title="No results found"
    description={query ? `No products match "${query}". Try a different search term.` : 'No products match your search criteria.'}
    action={onAction ? (
      <button
        type="button"
        onClick={onAction}
        className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 active:bg-slate-100"
      >
        {actionLabel || 'Clear Search'}
      </button>
    ) : undefined}
  />
);

interface EmptyErrorProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  retryLabel?: string;
}

export const EmptyError: React.FC<EmptyErrorProps> = ({
  title = 'Something went wrong',
  message = 'We couldn't load this content. Please try again.',
  onRetry,
  retryLabel
}) => (
  <ClientEmptyState
    icon={FileX}
    title={title}
    description={message}
    action={onRetry ? (
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 active:bg-slate-900 shadow-md hover:shadow-lg"
      >
        {retryLabel || 'Try Again'}
      </button>
    ) : undefined}
  />
);