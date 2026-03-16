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
      bg-white dark:bg-navy-800
      border border-light-border dark:border-white/6
      rounded-lg shadow-card dark:shadow-card-dark
      transition-all duration-200
      ${accentBar[accent] || ''}
      ${className}
    `}>
      {(title || action) && (
        <div className="px-4 py-3 border-b border-light-border dark:border-white/6 flex justify-between items-center gap-2">
          {title && (
            <h3 className="text-sm font-semibold text-light-text dark:text-white/90 tracking-tight">
              {title}
            </h3>
          )}
          {action && <div>{action}</div>}
        </div>
      )}
      <div className="p-4">
        {children}
      </div>
    </div>
  );
};
