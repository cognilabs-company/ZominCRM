import React from 'react';

interface SwitchProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}

export const Switch: React.FC<SwitchProps> = ({ checked, onChange, label, description, disabled = false }) => {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`
        w-full flex items-center justify-between gap-4 rounded-xl border px-4 py-3
        transition-all duration-150 text-left group
        ${checked
          ? 'bg-primary-blue/5 dark:bg-primary-blue/10 border-primary-blue/25 dark:border-primary-blue/30'
          : 'bg-white dark:bg-white/3 border-light-border dark:border-white/8 hover:border-light-border dark:hover:border-white/12'}
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:shadow-sm'}
      `}
    >
      {/* Label */}
      <div className="min-w-0">
        <span className={`text-sm font-medium block truncate transition-colors ${checked ? 'text-primary-blue dark:text-blue-400' : 'text-light-text dark:text-white/80'
          }`}>
          {label}
        </span>
        {description && (
          <span className="text-xs text-light-muted dark:text-white/35 block mt-0.5 truncate">{description}</span>
        )}
      </div>

      {/* Track */}
      <span
        className={`relative h-6 w-11 shrink-0 rounded-full transition-all duration-200 ${checked
            ? 'bg-primary-blue shadow-glow-blue'
            : 'bg-gray-200 dark:bg-white/12'
          }`}
      >
        {/* Thumb */}
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-md transition-all duration-200 ${checked ? 'translate-x-6' : 'translate-x-0.5'
            }`}
          style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.25)' }}
        />
      </span>
    </button>
  );
};
