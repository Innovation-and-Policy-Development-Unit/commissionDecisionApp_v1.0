import clsx from 'clsx'

/** Inline text skeleton for AI-generated copy (Tailwind). */
export default function AiTextSkeleton({
  lines = 3,
  statusLabel = 'Generating…',
  className,
}) {
  return (
    <div
      className={clsx('space-y-2', className)}
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={statusLabel}
    >
      <div className="flex flex-col gap-1.5">
        {Array.from({ length: lines }, (_, i) => (
          <div
            key={i}
            className="h-3 rounded bg-slate-200 dark:bg-slate-700 animate-pulse"
            style={{ width: `${Math.max(50, 100 - i * 10)}%` }}
          />
        ))}
      </div>
      {statusLabel && (
        <span className="text-[10px] text-violet-600 dark:text-violet-400">{statusLabel}</span>
      )}
    </div>
  )
}
