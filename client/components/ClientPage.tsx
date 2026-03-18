import React from 'react';

export const ClientPage: React.FC<{
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}> = ({ title, subtitle, action, children }) => (
  <div className="space-y-4">
    <header className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-xl font-bold text-slate-950">{title}</h1>
        {subtitle ? <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
    {children}
  </div>
);
