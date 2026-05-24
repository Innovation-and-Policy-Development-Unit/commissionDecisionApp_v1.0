import { forwardRef, useId } from 'react'
import { Field, Select } from '@fluentui/react-components'
import clsx from 'clsx'

/**
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
    placeholder,
    value,
    onChange,
    ...props
  },
  ref,
) {
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

  const handleChange = (event, data) => {
    if (onChange) {
      onChange(event, data.value)
    }
  }

  return (
    <Field
      className={clsx('w-full', className)}
      label={
        labelNode
          ? hideLabel
            ? { children: labelNode, htmlFor: id, className: 'sr-only' }
            : labelNode
          : undefined
      }
      hint={hint && !error ? hint : undefined}
      validationMessage={error || undefined}
      validationState={error ? 'error' : 'none'}
      required={required}
    >
      <Select
        ref={ref}
        id={id}
        required={required}
        className={inputClassName}
        value={value ?? ''}
        onChange={handleChange}
        {...props}
      >
        {placeholder != null && (
          <option value="">{placeholder}</option>
        )}
        {options.map(opt => {
          if (typeof opt === 'string') {
            return (
              <option key={opt} value={opt}>
                {opt}
              </option>
            )
          }
          return (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          )
        })}
      </Select>
    </Field>
  )
})

export default BaseSelect
