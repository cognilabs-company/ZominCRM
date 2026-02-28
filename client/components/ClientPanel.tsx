import React from 'react';

export const ClientPanel: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <section className={`rounded-[28px] border border-slate-200/80 bg-white/95 shadow-[0_12px_40px_rgba(15,23,42,0.08)] backdrop-blur ${className}`}>
    {children}
  </section>
);
