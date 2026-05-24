/**
 * Renders PSC dynamic forms from PSCFormField definitions.
 * All editable types use Fluent-backed Base* primitives (Field, Input, accessibility).
 */
import { useMemo } from 'react'
import BaseInput from './BaseInput'
import BaseTextarea from './BaseTextarea'
import BaseSelect from './BaseSelect'
import BaseCheckbox from './BaseCheckbox'
import BaseRadioGroup from './BaseRadioGroup'
import BaseFieldSection from './BaseFieldSection'
import BaseReadonlyField from './BaseReadonlyField'
import BaseFieldSkeleton from './BaseFieldSkeleton'

function skeletonVariant(fieldType) {
  if (fieldType === 'textarea') return 'textarea'
  if (fieldType === 'select' || fieldType === 'radio') return 'select'
  return 'input'
}

function formatReadonlyValue(field, value) {
  if (value === null || value === undefined || value === '') return null
  if (field.field_type === 'checkbox') return value ? 'Yes' : 'No'
  if (field.field_type === 'textarea') return String(value)
  return String(value)
}

export default function DynamicFormRenderer({
  fields = [],
  values = {},
  onChange,
  readOnly = false,
  /** field_key[] — show Fluent skeleton while AI/async fills these keys */
  loadingFieldKeys = [],
  /** { [field_key]: string } — per-field validation messages */
  errors = {},
  className = 'space-y-4',
  'aria-label': ariaLabel = 'Form fields',
}) {
  const loadingSet = useMemo(
    () => new Set(loadingFieldKeys),
    [loadingFieldKeys],
  )

  const handle = (key, value) => {
    if (onChange) onChange({ ...values, [key]: value })
  }

  return (
    <div className={className} role="group" aria-label={ariaLabel}>
      {fields.map(field => (
        <FieldRow
          key={field.id}
          field={field}
          value={values[field.field_key]}
          error={errors[field.field_key]}
          loading={loadingSet.has(field.field_key)}
          onChange={v => handle(field.field_key, v)}
          readOnly={readOnly}
        />
      ))}
    </div>
  )
}

function FieldRow({ field, value, onChange, readOnly, loading, error }) {
  if (field.field_type === 'section_header') {
    return <BaseFieldSection label={field.label} />
  }

  if (loading && !readOnly) {
    return (
      <BaseFieldSkeleton
        label={field.label}
        hint={field.help_text}
        variant={skeletonVariant(field.field_type)}
        ariaLabel={`Loading ${field.label}`}
      />
    )
  }

  const choices = field.choices
    ? field.choices.split('\n').map(s => s.trim()).filter(Boolean)
    : []

  if (readOnly) {
    const display = formatReadonlyValue(field, value)
    return (
      <BaseReadonlyField
        label={field.label}
        hint={field.help_text}
        value={display}
        multiline={field.field_type === 'textarea'}
      />
    )
  }

  switch (field.field_type) {
    case 'textarea':
      return (
        <BaseTextarea
          label={field.label}
          hint={field.help_text}
          error={error}
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
          error={error}
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
          error={error}
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
          error={error}
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
          error={error}
          required={field.is_required}
          placeholder="— Select —"
          options={choices}
          value={value ?? ''}
          onChange={(_e, v) => onChange(v)}
        />
      )

    case 'radio':
      return (
        <BaseRadioGroup
          label={field.label}
          hint={field.help_text}
          error={error}
          required={field.is_required}
          options={choices}
          value={value ?? ''}
          onChange={onChange}
        />
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
          {field.help_text && !error && (
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{field.help_text}</p>
          )}
          {error && (
            <p className="mt-1 text-xs text-red-600 dark:text-red-400" role="alert">
              {error}
            </p>
          )}
        </div>
      )

    default:
      return (
        <BaseInput
          label={field.label}
          hint={field.help_text}
          error={error}
          required={field.is_required}
          value={value ?? ''}
          placeholder={field.placeholder}
          onChange={e => onChange(e.target.value)}
        />
      )
  }
}
