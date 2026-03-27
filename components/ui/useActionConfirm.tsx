import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Modal } from './Modal';

type ConfirmTone = 'primary' | 'danger' | 'warning';

interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmTone;
}

interface ConfirmState extends ConfirmOptions {
  isOpen: boolean;
}

const toneClasses: Record<ConfirmTone, { badge: string; button: string }> = {
  primary: {
    badge: 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300',
    button: 'border-primary-blue bg-primary-blue text-white hover:bg-blue-700',
  },
  danger: {
    badge: 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300',
    button: 'border-red-600 bg-red-600 text-white hover:bg-red-700',
  },
  warning: {
    badge: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300',
    button: 'border-amber-500 bg-amber-500 text-white hover:bg-amber-600',
  },
};

export const useActionConfirm = () => {
  const [state, setState] = useState<ConfirmState | null>(null);
  const resolverRef = useRef<((result: boolean) => void) | null>(null);

  const closeConfirm = useCallback((result: boolean) => {
    resolverRef.current?.(result);
    resolverRef.current = null;
    setState(null);
  }, []);

  useEffect(() => {
    return () => {
      resolverRef.current?.(false);
      resolverRef.current = null;
    };
  }, []);

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
      setState({
        isOpen: true,
        tone: options.tone || 'primary',
        confirmLabel: options.confirmLabel || 'Confirm',
        cancelLabel: options.cancelLabel || 'Cancel',
        title: options.title,
        message: options.message,
      });
    });
  }, []);

  const tone = state?.tone || 'primary';
  const confirmationModal = state ? (
    <Modal
      isOpen={state.isOpen}
      onClose={() => closeConfirm(false)}
      title={state.title}
      maxWidthClass="max-w-md"
      footer={
        <>
          <button
            type="button"
            onClick={() => closeConfirm(false)}
            className="px-4 py-2 rounded-lg text-sm border border-light-border dark:border-navy-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-navy-700 transition-colors"
          >
            {state.cancelLabel}
          </button>
          <button
            type="button"
            onClick={() => closeConfirm(true)}
            className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${toneClasses[tone].button}`}
          >
            {state.confirmLabel}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium ${toneClasses[tone].badge}`}>
          <AlertTriangle size={16} />
          <span>{state.confirmLabel}</span>
        </div>
        <p className="text-sm leading-6 text-gray-600 dark:text-gray-300">{state.message}</p>
      </div>
    </Modal>
  ) : null;

  return { confirm, confirmationModal };
};
