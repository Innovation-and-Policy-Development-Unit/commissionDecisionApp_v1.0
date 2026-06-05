import { forwardRef, useId } from 'react'
import clsx from 'clsx'

/** Accessible text input (Tailwind). */
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
    contentBefore,
    contentAfter,
    size,            // eslint-disable-line no-unused-vars -- back-compat (Fluent size)
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
      <div className="relative">
        {contentBefore && <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400 pointer-events-none">{contentBefore}</span>}
        <input
          ref={ref}
          id={id}
          required={required}
          aria-invalid={error ? true : undefined}
          className={clsx('input w-full min-w-0', contentBefore && 'pl-9', contentAfter && 'pr-9', error && '!border-red-400', inputClassName)}
          {...props}
        />
        {contentAfter && <span className="absolute inset-y-0 right-0 flex items-center pr-2">{contentAfter}</span>}
      </div>
      {error
        ? <p className="text-xs text-red-600 dark:text-red-400 mt-1">{error}</p>
        : hint ? <p className="text-xs text-slate-500 mt-1">{hint}</p> : null}
    </div>
  )
})

export default BaseInput
