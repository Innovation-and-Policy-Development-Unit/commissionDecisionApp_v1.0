import { forwardRef } from 'react'
import clsx from 'clsx'
import { MIN_TOUCH } from '../../utils/a11y'

const VARIANTS = {
  primary: 'bg-primary-600 text-white hover:bg-primary-700 focus-visible:ring-primary-400',
  secondary: 'bg-slate-100 text-slate-800 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600 focus-visible:ring-slate-400',
  outline: 'border border-slate-300 text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700/50 focus-visible:ring-slate-400',
  ghost: 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700/50 focus-visible:ring-slate-400',
  danger: 'bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-400',
  unstyled: '',
}

const SIZES = {
  sm: 'text-xs px-2.5 py-1.5 gap-1',
  md: 'text-sm px-3.5 py-2 gap-1.5',
  lg: 'text-base px-5 py-2.5 gap-2',
  icon: 'p-2',
}

/** Accessible button (Tailwind), mapped from liner template variants. */
const BaseButton = forwardRef(function BaseButton(
  {
    variant = 'ghost',
    size = 'md',
    className,
    children,
    type = 'button',
    disabled,
    loading,
    loadingLabel = 'Loading',
    icon,
    iconOnly = false,
    touchTarget = false,
    ...props
  },
  ref,
) {
  const isIconOnly = iconOnly || (size === 'icon' && !children)
  return (
    <button
      ref={ref}
      {...props}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      aria-label={isIconOnly && !props['aria-label'] ? loadingLabel : props['aria-label']}
      className={clsx(
        'inline-flex items-center justify-center rounded-lg font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed',
        VARIANTS[variant] ?? VARIANTS.ghost,
        isIconOnly ? SIZES.icon : (SIZES[size] ?? SIZES.md),
        touchTarget && MIN_TOUCH,
        className,
      )}
    >
      {loading ? (
        <>
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="sr-only">{loadingLabel}</span>
        </>
      ) : (
        <>{icon}{children}</>
      )}
    </button>
  )
})

export default BaseButton
