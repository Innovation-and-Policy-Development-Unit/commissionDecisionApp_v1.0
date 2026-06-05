import clsx from 'clsx'

/** Section divider for dynamic / long forms (Tailwind). */
export default function BaseFieldSection({ label, className }) {
  return (
    <div className={clsx('pt-2 pb-1', className)} role="group" aria-label={label}>
      <hr className="mb-2 border-slate-200 dark:border-slate-700" />
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
        {label}
      </div>
    </div>
  )
}
