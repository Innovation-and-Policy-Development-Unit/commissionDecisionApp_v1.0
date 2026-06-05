import { useId } from 'react'
import clsx from 'clsx'

/**
 * Accessible radio group (Tailwind).
 * @param {{ value: string, label: string }[] | string[]} options
 */
export default function BaseRadioGroup({
  label,
  hint,
  error,
  className,
  required,
  options = [],
  value,
  onChange,
  layout = 'vertical',
  id: idProp,
}) {
  const autoId = useId()
  const id = idProp || autoId
  const normalized = options.map(opt => (typeof opt === 'string' ? { value: opt, label: opt } : opt))

  return (
    <div className={clsx('w-full', className)} role="radiogroup" aria-label={typeof label === 'string' ? label : undefined}>
      {label && (
        <div className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
          {label}
          {required && <span className="text-red-600 dark:text-red-400 ms-0.5" aria-hidden="true">*</span>}
        </div>
      )}
      <div className={clsx('flex gap-3', layout === 'horizontal' ? 'flex-row flex-wrap' : 'flex-col')}>
        {normalized.map(opt => (
          <label key={opt.value} className="inline-flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200 cursor-pointer">
            <input
              type="radio"
              name={id}
              value={opt.value}
              checked={String(value ?? '') === String(opt.value)}
              onChange={() => onChange?.(opt.value)}
              required={required}
              className="border-slate-300 text-primary-600 focus:ring-primary-400"
            />
            {opt.label}
          </label>
        ))}
      </div>
      {error
        ? <p className="text-xs text-red-600 dark:text-red-400 mt-1">{error}</p>
        : hint ? <p className="text-xs text-slate-500 mt-1">{hint}</p> : null}
    </div>
  )
}
