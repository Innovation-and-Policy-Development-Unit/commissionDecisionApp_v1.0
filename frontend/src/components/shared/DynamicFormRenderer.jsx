/**
 * Renders a dynamic PSC form based on PSCFormField definitions.
 * Used in SubmissionDetail for any form type designed via the Form Builder.
 */
import { useId } from 'react'

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
  const inputId = useId()
  const helpId = useId()

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

  const isRadio = field.field_type === 'radio'
  const isCheckbox = field.field_type === 'checkbox'
  const describedBy = field.help_text ? helpId : undefined

  if (isRadio) {
    return (
      <fieldset>
        <legend className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
          {field.label}
          {field.is_required && !readOnly && <span className="text-red-500 ml-0.5">*</span>}
        </legend>
        {readOnly ? (
          <ReadValue field={field} value={value} choices={choices} />
        ) : (
          <EditValue
            field={field}
            value={value}
            onChange={onChange}
            choices={choices}
            groupName={`${field.field_key}-${inputId}`}
            describedBy={describedBy}
          />
        )}
        {field.help_text && (
          <p id={helpId} className="mt-1 text-xs text-slate-400">
            {field.help_text}
          </p>
        )}
      </fieldset>
    )
  }

  if (isCheckbox) {
    return (
      <div>
        {field.label && field.label !== (field.placeholder || 'Yes') && (
          <p className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
            {field.label}
            {field.is_required && !readOnly && <span className="text-red-500 ml-0.5">*</span>}
          </p>
        )}
        {readOnly ? (
          <ReadValue field={field} value={value} choices={choices} />
        ) : (
          <EditValue
            field={field}
            value={value}
            onChange={onChange}
            choices={choices}
            inputId={inputId}
            describedBy={describedBy}
          />
        )}
        {field.help_text && (
          <p id={helpId} className="mt-1 text-xs text-slate-400">
            {field.help_text}
          </p>
        )}
      </div>
    )
  }

  return (
    <div>
      <label htmlFor={readOnly ? undefined : inputId} className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
        {field.label}
        {field.is_required && !readOnly && <span className="text-red-500 ml-0.5">*</span>}
      </label>

      {readOnly ? (
        <ReadValue field={field} value={value} choices={choices} />
      ) : (
        <EditValue
          field={field}
          value={value}
          onChange={onChange}
          choices={choices}
          inputId={inputId}
          describedBy={describedBy}
        />
      )}

      {field.help_text && (
        <p id={helpId} className="mt-1 text-xs text-slate-400">
          {field.help_text}
        </p>
      )}
    </div>
  )
}

function EditValue({ field, value, onChange, choices, inputId, groupName, describedBy }) {
  const base = 'input'
  const aria = describedBy ? { 'aria-describedby': describedBy } : {}

  switch (field.field_type) {
    case 'textarea':
      return (
        <textarea
          id={inputId}
          className={`${base} min-h-[80px]`}
          value={value ?? ''}
          placeholder={field.placeholder}
          onChange={e => onChange(e.target.value)}
          required={field.is_required}
          {...aria}
        />
      )

    case 'number':
      return (
        <input
          id={inputId}
          type="number"
          className={base}
          value={value ?? ''}
          placeholder={field.placeholder}
          onChange={e => onChange(e.target.value)}
          required={field.is_required}
          {...aria}
        />
      )

    case 'date':
      return (
        <input
          id={inputId}
          type="date"
          className={base}
          value={value ?? ''}
          onChange={e => onChange(e.target.value)}
          required={field.is_required}
          {...aria}
        />
      )

    case 'datetime':
      return (
        <input
          id={inputId}
          type="datetime-local"
          className={base}
          value={value ?? ''}
          onChange={e => onChange(e.target.value)}
          required={field.is_required}
          {...aria}
        />
      )

    case 'select':
      return (
        <select
          id={inputId}
          className={base}
          value={value ?? ''}
          onChange={e => onChange(e.target.value)}
          required={field.is_required}
          {...aria}
        >
          <option value="">— Select —</option>
          {choices.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      )

    case 'radio':
      return (
        <div className="space-y-1.5 mt-1" role="radiogroup" aria-required={field.is_required || undefined}>
          {choices.map(c => {
            const optionId = `${groupName}-${c.replace(/\s+/g, '-')}`
            return (
              <label key={c} htmlFor={optionId} className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  id={optionId}
                  type="radio"
                  name={groupName}
                  value={c}
                  checked={value === c}
                  onChange={() => onChange(c)}
                  className="w-4 h-4"
                  required={field.is_required}
                />
                {c}
              </label>
            )
          })}
        </div>
      )

    case 'checkbox':
      return (
        <label htmlFor={inputId} className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 cursor-pointer mt-1">
          <input
            id={inputId}
            type="checkbox"
            className="w-4 h-4 rounded"
            checked={!!value}
            onChange={e => onChange(e.target.checked)}
            required={field.is_required}
            {...aria}
          />
          {field.placeholder || 'Yes'}
        </label>
      )

    default:
      return (
        <input
          id={inputId}
          type="text"
          className={base}
          value={value ?? ''}
          placeholder={field.placeholder}
          onChange={e => onChange(e.target.value)}
          required={field.is_required}
          {...aria}
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
