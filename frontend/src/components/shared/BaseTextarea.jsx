import { forwardRef, useId } from 'react'
import clsx from 'clsx'

const BaseTextarea = forwardRef(function BaseTextarea(
  {
    label,
    hint,
    error,
    className,
    inputClassName,
    id: idProp,
    required,
    hideLabel,
    rows = 4,
    ...props
  },
  ref,
) {
  const autoId = useId()
  const id = idProp || autoId

  return (
    <div className={clsx('w-full', className)}>
      {label && (
        <label htmlFor={id} className={clsx('block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1', hideLabel && 'sr-only')}>
          {label}
          {required && <span className="text-red-600 dark:text-red-400 ms-0.5" aria-hidden="true">*</span>}
        </label>
      )}
      <textarea
        ref={ref}
        id={id}
        required={required}
        rows={rows}
        aria-invalid={error ? true : undefined}
        className={clsx('input w-full min-w-0', error && '!border-red-400', inputClassName)}
        {...props}
      />
      {error
        ? <p className="text-xs text-red-600 dark:text-red-400 mt-1">{error}</p>
        : hint ? <p className="text-xs text-slate-500 mt-1">{hint}</p> : null}
    </div>
  )
})

export default BaseTextarea
