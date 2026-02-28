import React from 'react';

export const ClientPage: React.FC<{
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}> = ({ title, subtitle, action, children }) => (
  <div className="space-y-4">
    <header className="flex items-start justify-between gap-4">
      <div>
        <h1 className="text-[28px] font-semibold tracking-tight text-slate-950">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm leading-6 text-slate-500">{subtitle}</p> : null}
      </div>
      {action}
    </header>
    {children}
  </div>
);
