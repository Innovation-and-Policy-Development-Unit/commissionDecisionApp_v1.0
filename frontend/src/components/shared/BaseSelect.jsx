import { forwardRef, useId, useMemo, useState, useEffect, useRef, useCallback } from 'react'
import { ChevronDown } from 'lucide-react'
import clsx from 'clsx'

/**
 * Searchable dropdown (Tailwind). Drop-in replacement for the prior Fluent version:
 * same `options`, `value`, `onChange(event, value)` API.
 * @typedef {{ value: string, label: string }} SelectOption
 */
const BaseSelect = forwardRef(function BaseSelect(
  {
    label,
    hint,
    error,
    className,
    inputClassName,
    id: idProp,
    required,
    hideLabel,
    options = [],
    placeholder = 'Search or select…',
    value,
    onChange,
    disabled,
    ...props
  },
  ref,
) {
  const autoId = useId()
  const id = idProp || autoId
  const wrapRef = useRef(null)

  const normalised = useMemo(
    () => options.map(o => (typeof o === 'string' ? { value: o, label: o } : { value: String(o.value), label: o.label })),
    [options],
  )
  const labelFor = useCallback(
    (val) => {
      if (val == null || val === '') return ''
      const f = normalised.find(o => o.value === String(val))
      return f ? f.label : ''
    },
    [normalised],
  )

  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [text, setText] = useState(() => labelFor(value))

  useEffect(() => { setText(labelFor(value)) }, [value, labelFor])

  useEffect(() => {
    if (!open) return undefined
    const onDocClick = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false); setQuery(''); setText(labelFor(value))
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open, value, labelFor])

  const filtered = useMemo(() => {
    if (!query) return normalised
    const q = query.toLowerCase()
    return normalised.filter(o => o.label.toLowerCase().includes(q))
  }, [normalised, query])

  const choose = (opt, e) => {
    onChange?.(e, opt.value)
    setText(opt.label)
    setQuery('')
    setOpen(false)
  }

  return (
    <div className={clsx('w-full min-w-0', className)} ref={wrapRef}>
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
          role="combobox"
          aria-expanded={open}
          aria-controls={`${id}-listbox`}
          autoComplete="off"
          disabled={disabled}
          required={required}
          aria-invalid={error ? true : undefined}
          placeholder={placeholder}
          className={clsx('input w-full min-w-0 pr-8', error && '!border-red-400', inputClassName)}
          value={open ? query : text}
          onFocus={() => { if (!disabled) setOpen(true) }}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
            if (e.target.value === '') onChange?.(e, '')
          }}
          {...props}
        />
        <ChevronDown size={16} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        {open && (
          <ul id={`${id}-listbox`} role="listbox" className="absolute z-50 mt-1 w-full max-h-60 overflow-auto rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-card-lg py-1">
            {filtered.length === 0 && <li className="px-3 py-2 text-sm text-slate-400">No matches</li>}
            {filtered.map(opt => (
              <li
                key={opt.value}
                role="option"
                aria-selected={String(value) === opt.value}
                onMouseDown={(e) => { e.preventDefault(); choose(opt, e) }}
                className={clsx(
                  'px-3 py-1.5 text-sm cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50',
                  String(value) === opt.value && 'bg-primary-50 text-primary-700 dark:bg-primary-900/40 dark:text-primary-200',
                )}
              >
                {opt.label}
              </li>
            ))}
          </ul>
        )}
      </div>
      {error
        ? <p className="text-xs text-red-600 dark:text-red-400 mt-1">{error}</p>
        : hint ? <p className="text-xs text-slate-500 mt-1">{hint}</p> : null}
    </div>
  )
})

export default BaseSelect
