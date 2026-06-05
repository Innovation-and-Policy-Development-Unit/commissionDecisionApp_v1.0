import clsx from 'clsx'

/** Read-only field display (Tailwind) — forms in view mode. */
export default function BaseReadonlyField({
  label,
  hint,
  value,
  emptyLabel = '—',
  className,
  multiline = false,
}) {
  const isEmpty = value === null || value === undefined || value === ''

  return (
    <div className={clsx('w-full', className)}>
      {label && <div className="text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">{label}</div>}
      <div className={clsx(
        'text-sm',
        multiline && 'whitespace-pre-wrap',
        isEmpty ? 'text-slate-400 italic' : 'text-slate-800 dark:text-slate-200',
      )}>
        {isEmpty ? emptyLabel : value}
      </div>
      {hint && <div className="text-xs text-slate-500 mt-1">{hint}</div>}
    </div>
  )
}
