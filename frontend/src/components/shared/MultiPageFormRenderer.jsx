import { useState, useMemo } from 'react'
import { Check, ChevronLeft, ChevronRight } from 'lucide-react'
import { useToast } from '../../context/ToastContext'

// ── Page splitter ─────────────────────────────────────────────────────────────
// A new page starts at any section_header that has start_new_page === true.
// All other fields (including non-page-break section headers) flow into the
// current page as normal content.

function splitIntoPages(fields) {
  const pages = []
  let current = null

  for (const field of fields) {
    const isPageBreak = field.field_type === 'section_header' && field.start_new_page

    if (isPageBreak) {
      current = { title: field.label, fields: [] }
      pages.push(current)
    } else {
      if (!current) {
        // Fields before the first page-break go into an implicit first page.
        // Use the first section_header label as the page title if available.
        const firstHeader = fields.find(f => f.field_type === 'section_header')
        current = { title: firstHeader?.label ?? 'Form', fields: [] }
        pages.push(current)
      }
      // Regular fields AND non-page-break section headers render inside the page.
      current.fields.push(field)
    }
  }

  return pages.length > 0 ? pages : [{ title: 'Form', fields }]
}

// ── Main component ────────────────────────────────────────────────────────────

export default function MultiPageFormRenderer({
  fields = [],
  values = {},
  onChange,
  readOnly = false,
  onSave,
  saving = false,
}) {
  const toast = useToast()
  const pages = useMemo(() => splitIntoPages(fields), [fields])
  const [step, setStep] = useState(0)
  const [errors, setErrors] = useState({})

  const page = pages[step] ?? pages[0]
  const total = pages.length

  const validate = () => {
    const errs = {}
    for (const field of (page?.fields ?? [])) {
      if (field.is_required) {
        const val = values[field.field_key]
        if (val === undefined || val === null || val === '' || val === false) {
          errs[field.field_key] = true
        }
      }
    }
    setErrors(errs)
    if (Object.keys(errs).length > 0) toast.warning('Please fill in all required fields before continuing.')
    return Object.keys(errs).length === 0
  }

  const goNext = () => {
    if (!readOnly && !validate()) return
    setStep(s => Math.min(s + 1, total - 1))
    setErrors({})
  }

  const goBack = () => {
    setStep(s => Math.max(s - 1, 0))
    setErrors({})
  }

  const jumpTo = (i) => {
    if (i < step || readOnly) { setStep(i); setErrors({}) }
  }

  const handle = (key, val) => {
    if (onChange) onChange({ ...values, [key]: val })
    if (errors[key]) setErrors(e => { const n = { ...e }; delete n[key]; return n })
  }

  if (!page) return null

  const compactStepper = total > 7

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden">

      {/* ── Stepper ── */}
      <div className="px-6 pt-5 pb-4 border-b border-slate-100 dark:border-slate-700">
        {compactStepper ? (
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-primary-600 text-white flex items-center justify-center text-sm font-semibold flex-shrink-0">
              {step + 1}
            </div>
            <div>
              <p className="text-xs text-slate-400">Step {step + 1} of {total}</p>
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{page.title}</p>
            </div>
          </div>
        ) : (
          <>
            {/* Step circles + connectors */}
            <div className="flex items-center">
              {pages.map((p, i) => (
                <div key={i} className="flex items-center flex-1 last:flex-none">
                  <button
                    type="button"
                    onClick={() => jumpTo(i)}
                    className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-all ${
                      i < step
                        ? 'bg-primary-500 text-white cursor-pointer hover:bg-primary-600'
                        : i === step
                          ? 'bg-primary-600 text-white ring-4 ring-primary-100 dark:ring-primary-900/40'
                          : 'bg-slate-100 dark:bg-slate-700 text-slate-400'
                    }`}
                    title={p.title}
                    disabled={i > step && !readOnly}
                  >
                    {i < step ? <Check size={13} /> : i + 1}
                  </button>
                  {i < pages.length - 1 && (
                    <div className={`flex-1 h-0.5 mx-1 transition-colors ${i < step ? 'bg-primary-500' : 'bg-slate-200 dark:bg-slate-700'}`} />
                  )}
                </div>
              ))}
            </div>

            {/* Step labels */}
            <div className="flex mt-2">
              {pages.map((p, i) => (
                <div key={i} className="flex-1 last:flex-none pr-1">
                  <p className={`text-[11px] text-center leading-tight line-clamp-1 ${
                    i === step
                      ? 'text-primary-600 dark:text-primary-400 font-semibold'
                      : i < step
                        ? 'text-slate-500 dark:text-slate-400'
                        : 'text-slate-300 dark:text-slate-600'
                  }`}>
                    {p.title}
                  </p>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* ── Step counter + section title ── */}
      <div className="px-6 pt-5 pb-2">
        <p className="text-xs text-slate-400 dark:text-slate-500 mb-1">
          Step {step + 1} of {total}
        </p>
        <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">{page.title}</h3>
      </div>

      {/* ── Fields ── */}
      <div className="px-6 pb-6 pt-4 space-y-5">
        {page.fields.length === 0 ? (
          <p className="text-sm text-slate-400 italic text-center py-6">No fields in this section.</p>
        ) : (
          page.fields.map(field => (
            <FieldRow
              key={field.id}
              field={field}
              value={values[field.field_key]}
              onChange={v => handle(field.field_key, v)}
              readOnly={readOnly}
              hasError={!!errors[field.field_key]}
            />
          ))
        )}

      </div>

      {/* ── Navigation footer ── */}
      <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between gap-4">
        {/* Back */}
        <button
          type="button"
          onClick={goBack}
          disabled={step === 0}
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft size={15} />
          Back
        </button>

        {/* Dot indicators */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {pages.map((_, i) => (
            <div
              key={i}
              className={`rounded-full transition-all duration-200 ${
                i === step
                  ? 'w-5 h-2 bg-primary-500'
                  : i < step
                    ? 'w-2 h-2 bg-primary-300 dark:bg-primary-700'
                    : 'w-2 h-2 bg-slate-200 dark:bg-slate-700'
              }`}
            />
          ))}
        </div>

        {/* Next / Save */}
        {step < total - 1 ? (
          <button
            type="button"
            onClick={goNext}
            className="inline-flex items-center gap-1 text-sm font-medium bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg transition-colors"
          >
            Next
            <ChevronRight size={15} />
          </button>
        ) : onSave ? (
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="inline-flex items-center gap-1 text-sm font-medium bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving…' : 'Save Form'}
          </button>
        ) : (
          <div className="w-20" />
        )}
      </div>
    </div>
  )
}

// ── Field rendering ───────────────────────────────────────────────────────────

function FieldRow({ field, value, onChange, readOnly, hasError }) {
  // Non-page-break section headers render as inline subheadings within the page
  if (field.field_type === 'section_header') {
    return (
      <div className="pt-2 pb-1 border-b border-slate-200 dark:border-slate-700">
        <h4 className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wide">
          {field.label}
        </h4>
      </div>
    )
  }

  const choices = field.choices
    ? field.choices.split('\n').map(s => s.trim()).filter(Boolean)
    : []

  return (
    <div>
      <label className={`block text-xs font-medium mb-1 ${hasError ? 'text-red-500' : 'text-slate-600 dark:text-slate-400'}`}>
        {field.label}
        {field.is_required && !readOnly && <span className="text-red-500 ml-0.5">*</span>}
      </label>

      {readOnly ? (
        <ReadValue field={field} value={value} choices={choices} />
      ) : (
        <EditValue field={field} value={value} onChange={onChange} choices={choices} hasError={hasError} />
      )}

      {field.help_text && !hasError && (
        <p className="mt-1 text-xs text-slate-400">{field.help_text}</p>
      )}
      {hasError && (
        <p className="mt-1 text-xs text-red-500">This field is required.</p>
      )}
    </div>
  )
}

function EditValue({ field, value, onChange, choices, hasError }) {
  const base = `input${hasError ? ' border-red-400 dark:border-red-600 focus:ring-red-400' : ''}`

  switch (field.field_type) {
    case 'textarea':
      return (
        <textarea
          className={`${base} min-h-[80px]`}
          value={value ?? ''}
          placeholder={field.placeholder}
          onChange={e => onChange(e.target.value)}
        />
      )
    case 'number':
      return (
        <input type="number" className={base} value={value ?? ''} placeholder={field.placeholder} onChange={e => onChange(e.target.value)} />
      )
    case 'date':
      return (
        <input type="date" className={base} value={value ?? ''} onChange={e => onChange(e.target.value)} />
      )
    case 'datetime':
      return (
        <input type="datetime-local" className={base} value={value ?? ''} onChange={e => onChange(e.target.value)} />
      )
    case 'select':
      return (
        <select className={base} value={value ?? ''} onChange={e => onChange(e.target.value)}>
          <option value="">— Select —</option>
          {choices.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      )
    case 'radio':
      return (
        <div className="space-y-1.5 mt-1">
          {choices.map(c => (
            <label key={c} className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
              <input
                type="radio"
                name={field.field_key}
                value={c}
                checked={value === c}
                onChange={() => onChange(c)}
                className="w-4 h-4"
              />
              {c}
            </label>
          ))}
        </div>
      )
    case 'checkbox':
      return (
        <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 cursor-pointer mt-1">
          <input
            type="checkbox"
            className="w-4 h-4 rounded"
            checked={!!value}
            onChange={e => onChange(e.target.checked)}
          />
          {field.placeholder || 'Yes'}
        </label>
      )
    default:
      return (
        <input type="text" className={base} value={value ?? ''} placeholder={field.placeholder} onChange={e => onChange(e.target.value)} />
      )
  }
}

function ReadValue({ field, value }) {
  if (value === null || value === undefined || value === '') {
    return <p className="text-sm text-slate-400 italic">—</p>
  }
  if (field.field_type === 'checkbox') {
    return <p className="text-sm text-slate-700 dark:text-slate-300">{value ? 'Yes' : 'No'}</p>
  }
  if (field.field_type === 'textarea') {
    return <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{String(value)}</p>
  }
  return <p className="text-sm text-slate-700 dark:text-slate-300">{String(value)}</p>
}
