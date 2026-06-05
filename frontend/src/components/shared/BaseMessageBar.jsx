import clsx from 'clsx'
import LiveRegion from './LiveRegion'

const INTENT = {
  error: 'border-red-200 bg-red-50 text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-200',
  warning: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200',
  info: 'border-cyan-200 bg-cyan-50 text-cyan-800 dark:border-cyan-900/50 dark:bg-cyan-950/40 dark:text-cyan-200',
}

/** Inline alert (Tailwind) + screen-reader announcement. */
export default function BaseMessageBar({
  intent = 'info',
  title,
  children,
  className,
  announce = true,
}) {
  if (!title && !children) return null
  const message = [title, children].filter(Boolean).join(': ')

  return (
    <>
      {announce && (
        <LiveRegion message={message} politeness={intent === 'error' ? 'assertive' : 'polite'} />
      )}
      <div role="alert" className={clsx('mb-4 rounded-lg border px-3 py-2 text-sm', INTENT[intent] || INTENT.info, className)}>
        {title && <div className="font-semibold">{title}</div>}
        {children && <div>{children}</div>}
      </div>
    </>
  )
}
