import React from 'react';
import { AlertTriangle, RefreshCw, Wifi, WifiOff, FileX } from 'lucide-react';

interface ClientErrorPanelProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
  variant?: 'error' | 'warning' | 'network';
  className?: string;
}

export const ClientErrorPanel: React.FC<ClientErrorPanelProps> = ({
  title,
  message,
  onRetry,
  retryLabel = 'Try Again',
  variant = 'error',
  className = ''
}) => {
  const variantStyles = {
    error: {
      container: 'border-rose-200 bg-rose-50',
      icon: 'text-rose-500',
      title: 'text-rose-800',
      message: 'text-rose-700',
      button: 'bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white',
    },
    warning: {
      container: 'border-amber-200 bg-amber-50',
      icon: 'text-amber-500',
      title: 'text-amber-800',
      message: 'text-amber-700',
      button: 'bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white',
    },
    network: {
      container: 'border-blue-200 bg-blue-50',
      icon: 'text-blue-500',
      title: 'text-blue-800',
      message: 'text-blue-700',
      button: 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white',
    },
  };

  const styles = variantStyles[variant];

  const IconComponent = variant === 'network' ? WifiOff : variant === 'warning' ? AlertTriangle : FileX;

  return (
    <div className={`rounded-[26px] border p-5 ${styles.container} ${className}`}>
      <div className="flex items-start gap-4">
        <div className={`shrink-0 ${styles.icon}`}>
          <IconComponent size={24} />
        </div>
        <div className="min-w-0 flex-1">
          {title ? (
            <h3 className={`text-base font-semibold ${styles.title}`}>{title}</h3>
          ) : null}
          <p className={`text-sm leading-6 ${styles.message} ${title ? 'mt-1' : ''}`}>
            {message}
          </p>
          {onRetry ? (
            <button
              type="button"
              onClick={onRetry}
              className={`mt-4 inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-medium transition shadow-md hover:shadow-lg ${styles.button}`}
            >
              <RefreshCw size={16} />
              {retryLabel}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
};

// Network error specifically for offline scenarios
interface NetworkErrorProps {
  onRetry?: () => void;
  retryLabel?: string;
}

export const NetworkError: React.FC<NetworkErrorProps> = ({
  onRetry,
  retryLabel = 'Retry Connection'
}) => (
  <ClientErrorPanel
    variant="network"
    title="Connection issue"
    message="Please check your internet connection and try again."
    onRetry={onRetry}
    retryLabel={retryLabel}
  />
);

// Inline error for small form errors
interface InlineErrorProps {
  message: string;
  className?: string;
}

export const InlineError: React.FC<InlineErrorProps> = ({
  message,
  className = ''
}) => (
  <div className={`flex items-center gap-2 text-sm text-rose-600 ${className}`}>
    <AlertTriangle size={14} />
    <span>{message}</span>
  </div>
);

// Toast-style error notification
interface ErrorNotificationProps {
  message: string;
  onDismiss?: () => void;
  onRetry?: () => void;
  className?: string;
}

export const ErrorNotification: React.FC<ErrorNotificationProps> = ({
  message,
  onDismiss,
  onRetry,
  className = ''
}) => (
  <div className={`rounded-2xl border border-rose-200 bg-rose-50 p-4 shadow-md ${className}`}>
    <div className="flex items-center gap-3">
      <div className="shrink-0 text-rose-500">
        <AlertTriangle size={20} />
      </div>
      <p className="flex-1 text-sm text-rose-700">{message}</p>
      <div className="flex items-center gap-2">
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="rounded-xl bg-rose-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-rose-700"
          >
            Retry
          </button>
        ) : null}
        {onDismiss ? (
          <button
            type="button"
            onClick={onDismiss}
            className="rounded-xl bg-white/50 px-2 py-1.5 text-xs font-medium text-rose-600 transition hover:bg-white"
          >
            Dismiss
          </button>
        ) : null}
      </div>
    </div>
  </div>
);