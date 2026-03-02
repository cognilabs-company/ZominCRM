import React from 'react';

export const ClientPage: React.FC<{
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}> = ({ title, subtitle, action, children }) => (
  <div className="space-y-5">
    <header className="rounded-[30px] border border-white/75 bg-[linear-gradient(135deg,rgba(255,248,238,0.96)_0%,rgba(245,239,228,0.88)_100%)] px-5 py-5 shadow-[0_18px_40px_rgba(86,63,42,0.08)]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#9a6b3a]">Client WebApp</p>
          <h1 className="mt-2 text-[30px] font-semibold tracking-[-0.04em] text-[#1f2933]">{title}</h1>
          {subtitle ? <p className="mt-2 max-w-[28rem] text-sm leading-6 text-[#5b6770]">{subtitle}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </header>
    {children}
  </div>
);
