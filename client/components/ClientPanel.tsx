import React from 'react';

export const ClientPanel: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <section className={`rounded-[24px] border border-slate-200/80 bg-white shadow-[0_14px_36px_rgba(15,23,42,0.06)] ${className}`}>
    {children}
  </section>
);
