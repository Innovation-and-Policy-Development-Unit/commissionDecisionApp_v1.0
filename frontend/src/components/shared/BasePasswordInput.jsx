import { forwardRef, useId, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import clsx from 'clsx'

const BasePasswordInput = forwardRef(function BasePasswordInput(
  {
    label,
    hint,
    error,
    className,
    inputClassName,
    id: idProp,
    required,
    hideLabel,
    showToggle = true,
    ...props
  },
  ref,
) {
  const autoId = useId()
  const id = idProp || autoId
  const [visible, setVisible] = useState(false)

  return (
    <div className={clsx('w-full', className)}>
      {label && (
        <label htmlFor={id} className={clsx('block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1', hideLabel && 'sr-only')}>
          {label}
          {required && <span className="text-red-600 dark:text-red-400 ms-0.5" aria-hidden="true">*</span>}
        </label>
      )}
      <div className="relative">
        <input
          ref={ref}
          id={id}
          type={visible ? 'text' : 'password'}
          required={required}
          aria-invalid={error ? true : undefined}
          className={clsx('input w-full min-w-0', showToggle && 'pr-10', error && '!border-red-400', inputClassName)}
          {...props}
        />
        {showToggle && (
          <button
            type="button"
            onClick={() => setVisible(v => !v)}
            aria-label={visible ? 'Hide password' : 'Show password'}
            className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            {visible ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        )}
      </div>
      {error
        ? <p className="text-xs text-red-600 dark:text-red-400 mt-1">{error}</p>
        : hint ? <p className="text-xs text-slate-500 mt-1">{hint}</p> : null}
    </div>
  )
})

export default BasePasswordInput
