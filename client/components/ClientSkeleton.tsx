import React from 'react';

// Base skeleton pulse animation is defined in index.html

interface SkeletonBaseProps {
  className?: string;
}

export const SkeletonBase: React.FC<SkeletonBaseProps> = ({ className = '' }) => (
  <div className={`animate-pulse rounded-lg bg-slate-200 ${className}`} />
);

export const SkeletonText: React.FC<{ width?: string; className?: string }> = ({
  width = 'w-full',
  className = ''
}) => (
  <SkeletonBase className={`h-4 ${width} ${className}`} />
);

export const SkeletonCircle: React.FC<{ size?: string; className?: string }> = ({
  size = 'h-10 w-10',
  className = ''
}) => (
  <SkeletonBase className={`rounded-full ${size} ${className}`} />
);

// Product Card Skeleton
export const SkeletonProductCard: React.FC = () => (
  <div className="rounded-[28px] border border-slate-200/85 bg-white shadow-[0_10px_28px_rgba(15,23,42,0.06)] p-4">
    <div className="flex items-start gap-4">
      <SkeletonBase className="h-14 w-14 shrink-0 rounded-3xl" />
      <div className="min-w-0 flex-1 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-2 flex-1">
            <SkeletonBase className="h-5 w-3/4 rounded-lg" />
            <SkeletonBase className="h-4 w-1/2 rounded-lg" />
          </div>
          <SkeletonBase className="h-6 w-16 rounded-full" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <SkeletonBase className="h-16 rounded-2xl" />
          <SkeletonBase className="h-16 rounded-2xl" />
        </div>
        <div className="flex items-center justify-between">
          <SkeletonBase className="h-4 w-20 rounded-lg" />
          <SkeletonBase className="h-10 w-24 rounded-2xl" />
        </div>
      </div>
    </div>
  </div>
);

// Order Card Skeleton
export const SkeletonOrderCard: React.FC = () => (
  <div className="w-full rounded-[28px] border border-slate-200 bg-white p-4">
    <div className="flex items-start justify-between gap-4">
      <div className="space-y-2">
        <SkeletonBase className="h-5 w-24 rounded-lg" />
        <SkeletonBase className="h-4 w-48 rounded-lg" />
      </div>
      <SkeletonBase className="h-6 w-20 rounded-full" />
    </div>
    <div className="mt-3 flex items-center justify-between">
      <SkeletonBase className="h-4 w-28 rounded-lg" />
      <SkeletonBase className="h-5 w-20 rounded-lg" />
    </div>
  </div>
);

// KPI Card Skeleton
export const SkeletonKPICard: React.FC = () => (
  <div className="rounded-[26px] border border-slate-200/85 bg-white shadow-[0_10px_28px_rgba(15,23,42,0.06)] p-4">
    <SkeletonBase className="h-3 w-20 rounded-lg" />
    <SkeletonBase className="mt-2 h-8 w-16 rounded-lg" />
    <SkeletonBase className="mt-1 h-4 w-32 rounded-lg" />
  </div>
);

// Profile Card Skeleton
export const SkeletonProfileCard: React.FC = () => (
  <div className="rounded-[26px] border border-slate-200/85 bg-white shadow-[0_10px_28px_rgba(15,23,42,0.06)] p-5">
    <div className="flex items-start gap-4">
      <SkeletonBase className="h-12 w-12 shrink-0 rounded-2xl" />
      <div className="min-w-0 flex-1 space-y-3">
        <SkeletonBase className="h-5 w-32 rounded-lg" />
        <SkeletonBase className="h-4 w-48 rounded-lg" />
        <div className="space-y-2 pt-2">
          <SkeletonBase className="h-4 w-full rounded-lg" />
          <SkeletonBase className="h-4 w-3/4 rounded-lg" />
          <SkeletonBase className="h-4 w-5/6 rounded-lg" />
          <SkeletonBase className="h-4 w-2/3 rounded-lg" />
        </div>
      </div>
    </div>
  </div>
);

// Cart Item Skeleton
export const SkeletonCartItem: React.FC = () => (
  <div className="rounded-[26px] border border-slate-200/85 bg-white shadow-[0_10px_28px_rgba(15,23,42,0.06)] p-4">
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0 flex-1 space-y-2">
        <SkeletonBase className="h-5 w-3/4 rounded-lg" />
        <SkeletonBase className="h-4 w-1/2 rounded-lg" />
        <SkeletonBase className="h-4 w-24 rounded-lg" />
      </div>
      <SkeletonBase className="h-10 w-20 rounded-2xl" />
    </div>
    <div className="mt-4 flex items-center justify-between">
      <SkeletonBase className="h-10 w-28 rounded-2xl" />
      <div className="text-right space-y-1">
        <SkeletonBase className="h-3 w-12 rounded-lg" />
        <SkeletonBase className="h-5 w-20 rounded-lg" />
      </div>
    </div>
  </div>
);

// Order Detail Skeleton
export const SkeletonOrderDetail: React.FC = () => (
  <div className="rounded-[26px] border border-slate-200/85 bg-white shadow-[0_10px_28px_rgba(15,23,42,0.06)] p-5">
    <div className="flex items-start justify-between gap-4">
      <div className="space-y-2">
        <SkeletonBase className="h-3 w-24 rounded-lg" />
        <SkeletonBase className="h-6 w-20 rounded-lg" />
        <SkeletonBase className="h-4 w-48 rounded-lg" />
      </div>
      <div className="text-right space-y-2">
        <SkeletonBase className="h-6 w-20 rounded-full" />
        <SkeletonBase className="h-6 w-24 rounded-lg" />
      </div>
    </div>
    <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
      <SkeletonBase className="h-20 rounded-2xl" />
      <SkeletonBase className="h-20 rounded-2xl" />
      <SkeletonBase className="h-20 rounded-2xl" />
    </div>
    <div className="mt-5 space-y-3">
      <SkeletonBase className="h-16 rounded-2xl" />
      <SkeletonBase className="h-16 rounded-2xl" />
      <SkeletonBase className="h-16 rounded-2xl" />
    </div>
  </div>
);

// Quick Action Skeleton
export const SkeletonQuickAction: React.FC = () => (
  <div className="rounded-[26px] border border-slate-200/85 bg-white shadow-[0_10px_28px_rgba(15,23,42,0.06)] p-4 flex items-center gap-4">
    <SkeletonBase className="h-12 w-12 shrink-0 rounded-2xl" />
    <SkeletonBase className="h-5 flex-1 rounded-lg" />
    <SkeletonBase className="h-5 w-5 rounded" />
  </div>
);

// Product List Skeleton
export const SkeletonProductList: React.FC<{ count?: number }> = ({ count = 3 }) => (
  <div className="grid grid-cols-1 gap-3">
    {Array.from({ length: count }).map((_, i) => (
      <SkeletonProductCard key={i} />
    ))}
  </div>
);

// Order List Skeleton
export const SkeletonOrderList: React.FC<{ count?: number }> = ({ count = 3 }) => (
  <div className="space-y-3">
    {Array.from({ length: count }).map((_, i) => (
      <SkeletonOrderCard key={i} />
    ))}
  </div>
);

// KPI Grid Skeleton
export const SkeletonKPIGrid: React.FC<{ count?: number }> = ({ count = 3 }) => (
  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
    {Array.from({ length: count }).map((_, i) => (
      <SkeletonKPICard key={i} />
    ))}
  </div>
);