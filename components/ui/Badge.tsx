import React from 'react';

type Variant = 'success' | 'warning' | 'error' | 'info' | 'default' | 'purple' | 'cyan';

interface BadgeProps {
  children: React.ReactNode;
  variant?: Variant;
  className?: string;
  dot?: boolean;
}

const styles: Record<Variant, { base: string; dot: string }> = {
  success: {
    base: 'bg-emerald-50   text-emerald-700   dark:bg-emerald-900/20 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40',
    dot: 'bg-emerald-500',
  },
  warning: {
    base: 'bg-amber-50     text-amber-700     dark:bg-amber-900/20   dark:text-amber-400   border border-amber-200   dark:border-amber-800/40',
    dot: 'bg-amber-500',
  },
  error: {
    base: 'bg-red-50       text-red-700       dark:bg-red-900/20     dark:text-red-400     border border-red-200     dark:border-red-900/40',
    dot: 'bg-red-500',
  },
  info: {
    base: 'bg-blue-50      text-blue-700      dark:bg-blue-900/20    dark:text-blue-400    border border-blue-200    dark:border-blue-900/40',
    dot: 'bg-blue-500',
  },
  default: {
    base: 'bg-gray-100     text-gray-600      dark:bg-white/8        dark:text-white/55    border border-gray-200    dark:border-white/10',
    dot: 'bg-gray-400',
  },
  purple: {
    base: 'bg-purple-50    text-purple-700    dark:bg-purple-900/20  dark:text-purple-400  border border-purple-200  dark:border-purple-900/40',
    dot: 'bg-purple-500',
  },
  cyan: {
    base: 'bg-cyan-50      text-cyan-700      dark:bg-cyan-900/20    dark:text-cyan-400    border border-cyan-200    dark:border-cyan-900/40',
    dot: 'bg-cyan-500',
  },
};

export const Badge: React.FC<BadgeProps> = ({ children, variant = 'default', className = '', dot = false }) => {
  const { base, dot: dotColor } = styles[variant];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${base} ${className}`}>
      {dot && (
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColor}`} />
      )}
      {children}
    </span>
  );
};