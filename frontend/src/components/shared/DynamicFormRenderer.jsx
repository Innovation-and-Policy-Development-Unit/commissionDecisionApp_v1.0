/**
 * Renders a dynamic PSC form based on PSCFormField definitions.
 * Uses Fluent-backed Base* inputs where applicable.
 */
import { useId } from 'react'
import { Radio, RadioGroup } from '@fluentui/react-components'
import BaseInput from './BaseInput'
import BaseTextarea from './BaseTextarea'
import BaseSelect from './BaseSelect'
import BaseCheckbox from './BaseCheckbox'

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
  const groupId = useId()

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

  if (readOnly) {
    return (
      <div>
        <p className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
          {field.label}
        </p>
        <ReadValue field={field} value={value} />
        {field.help_text && (
          <p className="mt-1 text-xs text-slate-400">{field.help_text}</p>
        )}
      </div>
    )
  }

  switch (field.field_type) {
    case 'textarea':
      return (
        <BaseTextarea
          label={field.label}
          hint={field.help_text}
          required={field.is_required}
          value={value ?? ''}
          placeholder={field.placeholder}
          onChange={e => onChange(e.target.value)}
        />
      )

    case 'number':
      return (
        <BaseInput
          type="number"
          label={field.label}
          hint={field.help_text}
          required={field.is_required}
          value={value ?? ''}
          placeholder={field.placeholder}
          onChange={e => onChange(e.target.value)}
        />
      )

    case 'date':
      return (
        <BaseInput
          type="date"
          label={field.label}
          hint={field.help_text}
          required={field.is_required}
          value={value ?? ''}
          onChange={e => onChange(e.target.value)}
        />
      )

    case 'datetime':
      return (
        <BaseInput
          type="datetime-local"
          label={field.label}
          hint={field.help_text}
          required={field.is_required}
          value={value ?? ''}
          onChange={e => onChange(e.target.value)}
        />
      )

    case 'select':
      return (
        <BaseSelect
          label={field.label}
          hint={field.help_text}
          required={field.is_required}
          placeholder="— Select —"
          options={choices}
          value={value ?? ''}
          onChange={(_e, v) => onChange(v)}
        />
      )

    case 'radio':
      return (
        <fieldset>
          <legend className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">
            {field.label}
            {field.is_required && <span className="text-red-500 ml-0.5">*</span>}
          </legend>
          <RadioGroup
            id={groupId}
            value={value ?? ''}
            onChange={(_e, data) => onChange(data.value)}
            layout="vertical"
            required={field.is_required}
          >
            {choices.map(c => (
              <Radio key={c} value={c} label={c} />
            ))}
          </RadioGroup>
          {field.help_text && (
            <p className="mt-1 text-xs text-slate-400">{field.help_text}</p>
          )}
        </fieldset>
      )

    case 'checkbox':
      return (
        <div>
          {field.label && field.label !== (field.placeholder || 'Yes') && (
            <p className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              {field.label}
              {field.is_required && <span className="text-red-500 ml-0.5">*</span>}
            </p>
          )}
          <BaseCheckbox
            checked={!!value}
            onChange={(_e, data) => onChange(data.checked)}
            label={field.placeholder || 'Yes'}
            required={field.is_required}
          />
          {field.help_text && (
            <p className="mt-1 text-xs text-slate-400">{field.help_text}</p>
          )}
        </div>
      )

    default:
      return (
        <BaseInput
          label={field.label}
          hint={field.help_text}
          required={field.is_required}
          value={value ?? ''}
          placeholder={field.placeholder}
          onChange={e => onChange(e.target.value)}
        />
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
    return (
      <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
        {String(value)}
      </p>
    )
  }

  return <p className="text-sm text-slate-700 dark:text-slate-300">{String(value)}</p>
}
