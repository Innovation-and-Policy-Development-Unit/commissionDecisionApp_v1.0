import clsx from 'clsx'

const COLORS = {
  default: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200',
  primary: 'bg-primary-100 text-primary-800 dark:bg-primary-900/50 dark:text-primary-200',
  success: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  warning: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  danger: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  info: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300',
  outline: 'border border-slate-300 text-slate-600 dark:border-slate-600 dark:text-slate-300',
}

const SIZES = {
  small: 'text-[10px] px-1.5 py-0.5',
  medium: 'text-xs px-2 py-0.5',
  large: 'text-sm px-2.5 py-1',
}

/** Status / count badge (Tailwind). `appearance` accepted for back-compat, ignored. */
export default function BaseBadge({
  children,
  color = 'default',
  appearance,        // eslint-disable-line no-unused-vars -- back-compat
  className,
  size = 'medium',
  icon,
  ...props
}) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded-full font-semibold whitespace-nowrap',
        COLORS[color] || COLORS.default,
        SIZES[size] || SIZES.medium,
        className,
      )}
      {...props}
    >
      {icon}
      {children}
    </span>
  )
}
