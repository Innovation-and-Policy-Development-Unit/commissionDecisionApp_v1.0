/**
 * Renders a dynamic PSC form based on PSCFormField definitions.
 * Used in SubmissionDetail for any form type designed via the Form Builder.
 */
export default function DynamicFormRenderer({ fields = [], values = {}, onChange, readOnly = false }) {
  const handle = (key, value) => {
    if (onChange) onChange({ ...values, [key]: value })
  }

  return (
    <div className="space-y-5">
      {fields.map(field => (
        <FieldRow
          key={field.id}
          field={field}
          value={values[field.field_key]}
          onChange={v => handle(field.field_key, v)}
          readOnly={readOnly}
        />
      ))}
    </div>
  )
}

function FieldRow({ field, value, onChange, readOnly }) {
  if (field.field_type === 'section_header') {
    return (
      <div className="pt-3 pb-1 border-b border-slate-200 dark:border-slate-700">
        <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wide">
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
      <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
        {field.label}
        {field.is_required && !readOnly && <span className="text-red-500 ml-0.5">*</span>}
      </label>

      {readOnly ? (
        <ReadValue field={field} value={value} choices={choices} />
      ) : (
        <EditValue field={field} value={value} onChange={onChange} choices={choices} />
      )}

      {field.help_text && (
        <p className="mt-1 text-xs text-slate-400">{field.help_text}</p>
      )}
    </div>
  )
}

function EditValue({ field, value, onChange, choices }) {
  const base = 'input'

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
        <input
          type="number"
          className={base}
          value={value ?? ''}
          placeholder={field.placeholder}
          onChange={e => onChange(e.target.value)}
        />
      )

    case 'date':
      return (
        <input
          type="date"
          className={base}
          value={value ?? ''}
          onChange={e => onChange(e.target.value)}
        />
      )

    case 'datetime':
      return (
        <input
          type="datetime-local"
          className={base}
          value={value ?? ''}
          onChange={e => onChange(e.target.value)}
        />
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
        <input
          type="text"
          className={base}
          value={value ?? ''}
          placeholder={field.placeholder}
          onChange={e => onChange(e.target.value)}
        />
      )
  }
}

function ReadValue({ field, value, choices }) {
  if (value === null || value === undefined || value === '') {
    return <p className="text-sm text-slate-400 italic">—</p>
  }

  if (field.field_type === 'checkbox') {
    return <p className="text-sm text-slate-700 dark:text-slate-300">{value ? 'Yes' : 'No'}</p>
  }

  if (field.field_type === 'textarea') {
    return (
      <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
        {String(value)}
      </p>
    )
  }

  return <p className="text-sm text-slate-700 dark:text-slate-300">{String(value)}</p>
}
