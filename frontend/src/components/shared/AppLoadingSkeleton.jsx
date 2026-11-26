import { Skeleton } from './Skeleton'

/** Page-shaped placeholder shown while the session is being restored. */
export default function AppLoadingSkeleton() {
  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-slate-900" role="status" aria-label="Loading">
      <div className="hidden md:block w-60 shrink-0 border-r border-slate-200 dark:border-slate-800 p-4 space-y-3">
        <Skeleton className="h-9 w-32" />
        {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-5 w-full" />)}
      </div>
      <div className="flex-1 p-6 space-y-5">
        <Skeleton className="h-8 w-56" />
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
      <span className="sr-only">Loading session…</span>
    </div>
  )
}
