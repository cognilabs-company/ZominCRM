import React from 'react';

export const ClientPanel: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <section className={`rounded-[26px] border border-slate-200/85 bg-white shadow-[0_10px_28px_rgba(15,23,42,0.06)] ${className}`}>
    {children}
  </section>
);
