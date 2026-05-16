'use client';

/**
 * Skeleton loader components for loading states.
 * Uses Tailwind animate-pulse with neutral gray blocks.
 */

export function SkeletonBlock({ className = '' }: { className?: string }) {
  return <div className={`bg-border/40 rounded-lg animate-pulse ${className}`} />;
}

/** BOM Table skeleton — shown while system is loading */
export function BOMTableSkeleton() {
  return (
    <div className="bg-surface rounded-xl border border-border p-4 space-y-3">
      <div className="flex items-center justify-between mb-4">
        <SkeletonBlock className="w-40 h-5" />
        <SkeletonBlock className="w-24 h-5" />
      </div>
      {/* Header row */}
      <div className="flex gap-3 pb-3 border-b border-border/50">
        <SkeletonBlock className="w-8 h-4" />
        <SkeletonBlock className="flex-1 h-4" />
        <SkeletonBlock className="w-16 h-4" />
        <SkeletonBlock className="w-20 h-4" />
        <SkeletonBlock className="w-16 h-4" />
        <SkeletonBlock className="w-24 h-4" />
      </div>
      {/* Data rows */}
      {Array.from({ length: 12 }).map((_, i) => (
        <div key={i} className="flex gap-3 py-2" style={{ animationDelay: `${i * 50}ms` }}>
          <SkeletonBlock className="w-8 h-4" />
          <SkeletonBlock className="flex-1 h-4" />
          <SkeletonBlock className="w-16 h-4" />
          <SkeletonBlock className="w-20 h-4" />
          <SkeletonBlock className="w-16 h-4" />
          <SkeletonBlock className="w-24 h-4" />
        </div>
      ))}
    </div>
  );
}

/** Summary card skeleton — shown while calculating */
export function SummaryCardSkeleton() {
  return (
    <div className="bg-surface rounded-xl border border-border p-5 space-y-4">
      <SkeletonBlock className="w-32 h-5 mb-4" />
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="space-y-2 p-3 rounded-lg bg-background/50">
            <SkeletonBlock className="w-20 h-3" />
            <SkeletonBlock className="w-28 h-5" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Generic card skeleton */
export function CardSkeleton() {
  return (
    <div className="bg-surface rounded-xl border border-border p-5 space-y-3">
      <SkeletonBlock className="w-24 h-4" />
      <SkeletonBlock className="w-full h-8" />
      <SkeletonBlock className="w-3/4 h-4" />
      <SkeletonBlock className="w-1/2 h-4" />
    </div>
  );
}
