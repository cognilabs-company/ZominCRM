import React from 'react';

export const ClientPage: React.FC<{
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}> = ({ title, subtitle, action, children }) => (
  <div className="space-y-4">
    <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-slate-400">Zomin Suv</p>
        <h1 className="mt-2 text-[28px] font-semibold tracking-[-0.04em] text-slate-950">{title}</h1>
        {subtitle ? <p className="mt-1 max-w-[26rem] text-sm text-slate-500">{subtitle}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
    {children}
  </div>
);
