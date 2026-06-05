import clsx from 'clsx'

/** Card wrapper (Tailwind) — optional header and preview slots. */
export default function BaseCard({
  children,
  className,
  title,
  description,
  headerAction,
  preview,
}) {
  return (
    <div className={clsx('card overflow-hidden', className)}>
      {preview && <div>{preview}</div>}
      {(title || description) && (
        <div className="flex items-start justify-between gap-2 p-4 border-b border-slate-100 dark:border-slate-700">
          <div className="min-w-0">
            {title && <div className="font-semibold text-slate-900 dark:text-slate-100">{title}</div>}
            {description && <div className="text-sm text-slate-500 dark:text-slate-400">{description}</div>}
          </div>
          {headerAction}
        </div>
      )}
      <div className="p-4">{children}</div>
    </div>
  )
}
