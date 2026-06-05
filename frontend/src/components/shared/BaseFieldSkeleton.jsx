import clsx from 'clsx'

function bars(variant, lines) {
  if (variant === 'textarea') {
    return Array.from({ length: lines }, (_, i) => (
      <div
        key={i}
        className="h-4 rounded bg-slate-200 dark:bg-slate-700 animate-pulse"
        style={{ width: `${Math.max(55, 100 - i * 12)}%` }}
      />
    ))
  }
  return <div className="h-8 rounded bg-slate-200 dark:bg-slate-700 animate-pulse" />
}

/**
 * Skeleton preset for async / AI-populated fields (Tailwind).
 * @param {'input'|'textarea'|'select'} variant
 */
export default function BaseFieldSkeleton({
  label,
  hint,
  variant = 'textarea',
  lines = 3,
  className,
  ariaLabel = 'Loading field content',
}) {
  return (
    <div className={clsx('w-full', className)}>
      {label && <div className="text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">{label}</div>}
      <div role="status" aria-label={ariaLabel} className="flex flex-col gap-2">
        {bars(variant, lines)}
      </div>
      {hint && <div className="text-xs text-slate-500 mt-1">{hint}</div>}
    </div>
  )
}
