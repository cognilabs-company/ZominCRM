import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidthClass?: string;
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, footer, maxWidthClass = 'max-w-lg' }) => {
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    if (isOpen) {
      window.addEventListener('keydown', handleEsc);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      window.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-navy-950/70 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />

      {/* Panel */}
      <div className={`
        relative bg-white dark:bg-navy-800
        rounded-2xl shadow-modal w-full ${maxWidthClass}
        overflow-hidden flex flex-col max-h-[90vh]
        border border-light-border dark:border-white/8
        modal-enter
      `}>
        {/* Header */}
        <div className="px-6 py-4 border-b border-light-border dark:border-white/6 flex justify-between items-center shrink-0 bg-light-bg/60 dark:bg-white/3">
          <h3 className="text-base font-semibold text-light-text dark:text-white tracking-tight">{title}</h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-light-muted dark:text-white/40
              hover:text-light-text dark:hover:text-white
              hover:bg-light-border dark:hover:bg-white/8 transition-all"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="px-6 py-4 bg-light-bg/60 dark:bg-navy-900/50 border-t border-light-border dark:border-white/6 flex justify-end gap-3 shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};
