import React from 'react';

export const ClientPanel: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <section className={`rounded-[30px] border border-white/70 bg-[rgba(255,252,247,0.88)] shadow-[0_24px_60px_rgba(58,44,28,0.10)] backdrop-blur-xl ${className}`}>
    {children}
  </section>
);
