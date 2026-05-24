import { forwardRef } from 'react'
import clsx from 'clsx'
import { FOCUS_RING, MIN_TOUCH } from '../../utils/a11y'

const VARIANTS = {
  primary: 'bg-primary-600 hover:bg-primary-700 text-white shadow-sm',
  secondary:
    'bg-slate-100 hover:bg-slate-200 text-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-slate-100',
  outline:
    'border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200',
  ghost:
    'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300',
  danger: 'bg-red-600 hover:bg-red-700 text-white',
  unstyled: '',
}

const SIZES = {
  sm: 'px-3 py-1.5 text-xs gap-1.5',
  md: 'px-4 py-2 text-sm gap-2',
  lg: 'px-6 py-3 text-base gap-2',
  icon: 'p-2',
}

/**
 * Accessible button — focus ring, disabled state, optional icon-only label.
 */
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
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      aria-disabled={disabled || loading || undefined}
      className={clsx(
        'inline-flex items-center justify-center font-medium transition-colors duration-150',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        VARIANTS[variant] ?? VARIANTS.ghost,
        SIZES[size] ?? SIZES.md,
        touchTarget && MIN_TOUCH,
        FOCUS_RING,
        className,
      )}
      {...props}
    >
      {loading && (
        <span className="sr-only">{loadingLabel}</span>
      )}
      {children}
    </button>
  )
})

export default BaseButton
