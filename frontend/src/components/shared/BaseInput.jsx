import { forwardRef, useId } from 'react'
import clsx from 'clsx'
import { FOCUS_RING } from '../../utils/a11y'

/**
 * Accessible text input — linked label, describedby, invalid state.
 */
const BaseInput = forwardRef(function BaseInput(
  {
    label,
    hint,
    error,
    className,
    inputClassName,
    id: idProp,
    required,
    hideLabel,
    ...props
  },
  ref,
) {
  const autoId = useId()
  const id = idProp || autoId
  const hintId = hint ? `${id}-hint` : undefined
  const errorId = error ? `${id}-error` : undefined
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined

  return (
    <div className={clsx('w-full', className)}>
      {label && (
        <label
          htmlFor={id}
          className={clsx(
            'block text-sm font-medium text-slate-800 dark:text-slate-200 mb-1',
            hideLabel && 'sr-only',
          )}
        >
          {label}
          {required && (
            <span className="text-red-600 dark:text-red-400 ms-0.5" aria-hidden>
              *
            </span>
          )}
        </label>
      )}
      <input
        ref={ref}
        id={id}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={clsx(
          'input w-full',
          FOCUS_RING,
          error && 'border-red-500 dark:border-red-500',
          inputClassName,
        )}
        {...props}
      />
      {hint && !error && (
        <p id={hintId} className="mt-1 text-xs text-slate-600 dark:text-slate-300">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="mt-1 text-xs text-red-700 dark:text-red-300">
          {error}
        </p>
      )}
    </div>
  )
})

export default BaseInput
