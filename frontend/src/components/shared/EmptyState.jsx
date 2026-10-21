import clsx from 'clsx'

/**
 * Friendly empty state: says what this place is for and what to do next,
 * instead of leaving a blank table. `action` is any node (usually a button).
 */
export default function EmptyState({ icon: Icon, title, description, action, className }) {
  return (
    <div className={clsx('flex flex-col items-center text-center py-12 px-4', className)}>
      {Icon && (
        <span className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-primary-50 text-primary-600 dark:bg-primary-900/30 dark:text-primary-300">
          <Icon size={26} aria-hidden="true" />
        </span>
      )}
      <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{title}</p>
      {description && (
        <p className="mt-1 max-w-sm text-sm text-slate-500 dark:text-slate-400">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
