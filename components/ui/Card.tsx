import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
  action?: React.ReactNode;
  accent?: 'none' | 'red' | 'blue' | 'emerald' | 'amber';
}

const accentBar: Record<string, string> = {
  none: '',
  red: 'border-t-2 border-t-primary-red',
  blue: 'border-t-2 border-t-primary-blue',
  emerald: 'border-t-2 border-t-accent-emerald',
  amber: 'border-t-2 border-t-accent-amber',
};

export const Card: React.FC<CardProps> = ({ children, className = '', title, action, accent = 'none' }) => {
  return (
    <div className={`
      bg-white dark:bg-navy-900
      border border-gray-200 dark:border-white/8
      rounded-lg shadow-sm
      transition-all duration-200
      hover:shadow-md dark:hover:shadow-lg
      ${accentBar[accent] || ''}
      ${className}
    `}>
      {(title || action) && (
        <div className="px-6 py-4 border-b border-gray-200 dark:border-white/10 flex justify-between items-center gap-4">
          {title && (
            <h3 className="text-base font-semibold text-gray-900 dark:text-white tracking-tight">
              {title}
            </h3>
          )}
          {action && <div>{action}</div>}
        </div>
      )}
      <div className="p-6">
        {children}
      </div>
    </div>
  );
};
