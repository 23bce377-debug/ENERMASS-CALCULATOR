'use client';

/**
 * Skeleton loader components — warm shimmer that respects both light and dark themes.
 */

export function SkeletonBlock({ className = '' }: { className?: string }) {
  return (
    <div
      className={`rounded-lg animate-pulse ${className}`}
      style={{
        background: 'var(--srf-hover)',
      }}
    />
  );
}

/** BOM Table skeleton */
export function BOMTableSkeleton() {
  return (
    <div className="bg-surface rounded-2xl border border-border p-5 space-y-3">
      <div className="flex items-center justify-between mb-4">
        <SkeletonBlock className="w-36 h-4" />
        <SkeletonBlock className="w-20 h-4" />
      </div>
      {/* Header */}
      <div className="flex gap-3 pb-3 border-b border-border">
        <SkeletonBlock className="w-8 h-3" />
        <SkeletonBlock className="flex-1 h-3" />
        <SkeletonBlock className="w-14 h-3" />
        <SkeletonBlock className="w-18 h-3" />
        <SkeletonBlock className="w-14 h-3" />
        <SkeletonBlock className="w-22 h-3" />
      </div>
      {/* Rows */}
      {Array.from({ length: 12 }).map((_, i) => (
        <div key={i} className="flex gap-3 py-1.5" style={{ animationDelay: `${i * 40}ms` }}>
          <SkeletonBlock className="w-8 h-3.5" />
          <SkeletonBlock className="flex-1 h-3.5" />
          <SkeletonBlock className="w-14 h-3.5" />
          <SkeletonBlock className="w-18 h-3.5" />
          <SkeletonBlock className="w-14 h-3.5" />
          <SkeletonBlock className="w-22 h-3.5" />
        </div>
      ))}
    </div>
  );
}

/** Summary card skeleton */
export function SummaryCardSkeleton() {
  return (
    <div className="bg-surface rounded-2xl border border-border p-5 space-y-4">
      <SkeletonBlock className="w-28 h-4 mb-4" />
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="space-y-2 p-3 rounded-xl" style={{ background: 'var(--srf-2)' }}>
            <SkeletonBlock className="w-20 h-2.5" />
            <SkeletonBlock className="w-28 h-4" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Generic card skeleton */
export function CardSkeleton() {
  return (
    <div className="bg-surface rounded-2xl border border-border p-5 space-y-3">
      <SkeletonBlock className="w-24 h-3.5" />
      <SkeletonBlock className="w-full h-7" />
      <SkeletonBlock className="w-3/4 h-3.5" />
      <SkeletonBlock className="w-1/2 h-3.5" />
    </div>
  );
}
