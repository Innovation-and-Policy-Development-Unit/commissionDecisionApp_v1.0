/**
 * Skeleton loaders — Facebook-style animated shimmer placeholders.
 * Use <Skeleton /> for inline blocks, or the page-level presets below.
 */

/** Base shimmer block */
export function Skeleton({ className = '' }) {
  return (
    <div
      className={`relative overflow-hidden rounded bg-slate-200 dark:bg-slate-700 before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_1.4s_infinite] before:bg-gradient-to-r before:from-transparent before:via-white/40 dark:before:via-white/10 before:to-transparent ${className}`}
    />
  )
}

/** A skeleton that looks like a page header (title + subtitle + action button) */
export function SkeletonPageHeader() {
  return (
    <div className="flex items-start justify-between mb-6">
      <div className="space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>
      <Skeleton className="h-9 w-28 rounded-lg" />
    </div>
  )
}

/** A skeleton card row (mimics a table row or list card) */
export function SkeletonRow({ cols = 4 }) {
  const widths = ['w-24', 'w-40', 'w-32', 'w-20', 'w-16', 'w-28']
  return (
    <div className="flex items-center gap-4 px-4 py-3 border-b border-slate-100 dark:border-slate-700/60 last:border-0">
      {Array.from({ length: cols }).map((_, i) => (
        <Skeleton key={i} className={`h-4 ${widths[i % widths.length]} flex-shrink-0`} />
      ))}
      <Skeleton className="h-4 w-16 ml-auto" />
    </div>
  )
}

/** A skeleton card (mimics a .card block with a header and body) */
export function SkeletonCard({ rows = 5, showHeader = true }) {
  return (
    <div className="card overflow-hidden p-0">
      {showHeader && (
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-700">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-8 w-24 rounded-lg" />
        </div>
      )}
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonRow key={i} cols={4} />
      ))}
    </div>
  )
}

/** A skeleton that looks like a detail/form card */
export function SkeletonDetailCard() {
  return (
    <div className="card space-y-4">
      <Skeleton className="h-5 w-40" />
      <div className="grid grid-cols-2 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="space-y-1.5">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-5 w-full" />
          </div>
        ))}
      </div>
    </div>
  )
}

/** Full-page skeleton — page header + table card. Used as the route Suspense fallback. */
export function PageSkeleton({ cards = 1, detailMode = false }) {
  return (
    <div className="animate-pulse-none">
      <SkeletonPageHeader />
      {detailMode ? (
        <div className="space-y-4">
          <SkeletonDetailCard />
          <SkeletonDetailCard />
        </div>
      ) : (
        <div className="space-y-4">
          {Array.from({ length: cards }).map((_, i) => (
            <SkeletonCard key={i} rows={6} />
          ))}
        </div>
      )}
    </div>
  )
}
