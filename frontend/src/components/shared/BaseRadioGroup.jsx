import { useId } from 'react'
import { Field, Radio, RadioGroup } from '@fluentui/react-components'
import clsx from 'clsx'

/**
 * Accessible radio group — Fluent Field + RadioGroup.
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

  const labelNode = label ? (
    <>
      {label}
      {required && (
        <span className="text-red-600 dark:text-red-400 ms-0.5" aria-hidden>
          *
        </span>
      )}
    </>
  ) : undefined

  const normalized = options.map(opt =>
    typeof opt === 'string' ? { value: opt, label: opt } : opt,
  )

  return (
    <Field
      className={clsx('w-full', className)}
      label={labelNode}
      hint={hint && !error ? hint : undefined}
      validationMessage={error || undefined}
      validationState={error ? 'error' : 'none'}
      required={required}
    >
      <RadioGroup
        id={id}
        value={value ?? ''}
        onChange={(_e, data) => onChange?.(data.value)}
        layout={layout}
        required={required}
      >
        {normalized.map(opt => (
          <Radio key={opt.value} value={opt.value} label={opt.label} />
        ))}
      </RadioGroup>
    </Field>
  )
}
