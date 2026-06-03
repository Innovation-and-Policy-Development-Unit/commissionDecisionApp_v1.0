import { forwardRef, useId, useMemo, useState, useEffect, useCallback } from 'react'
import { Field, Combobox, Option } from '@fluentui/react-components'
import clsx from 'clsx'

/**
 * Searchable dropdown — Fluent UI v9 Combobox.
 * Drop-in replacement for BaseSelect: same `options`, `value`, `onChange(event, value)` API.
 *
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
    disabled,
    ...props
  },
  ref,
) {
  const autoId = useId()
  const id = idProp || autoId

  // Resolve the display label for the currently selected value.
  const getLabelForValue = useCallback((val) => {
    if (val === '' || val == null) return ''
    const found = options.find(o =>
      String(typeof o === 'string' ? o : o.value) === String(val),
    )
    return found ? (typeof found === 'string' ? found : found.label) : ''
  }, [options])

  // Local state drives the text shown in the combobox input so the user can
  // type to filter while we keep track of the confirmed selection separately.
  const [inputValue, setInputValue] = useState(() => getLabelForValue(value))

  // Sync display text whenever the external value changes.
  useEffect(() => {
    setInputValue(getLabelForValue(value))
  }, [value, getLabelForValue])

  const handleOptionSelect = (event, data) => {
    setInputValue(data.optionText ?? '')
    onChange?.(event, data.optionValue ?? '')
  }

  // When the user types, update the visible text (Combobox filters automatically)
  // and clear the confirmed selection if they erased everything.
  const handleInputChange = (event) => {
    setInputValue(event.target.value)
    if (!event.target.value) {
      onChange?.(event, '')
    }
  }

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

  const normalised = useMemo(() =>
    options.map(o =>
      typeof o === 'string'
        ? { value: o, label: o }
        : { value: String(o.value), label: o.label },
    ),
  [options])

  // Filter rendered options to those matching what the user typed.
  // This makes the dropdown filter, not just circle/highlight matches.
  const filteredOptions = useMemo(() => {
    if (!inputValue) return normalised
    const q = inputValue.toLowerCase()
    return normalised.filter(({ label: l }) => l.toLowerCase().includes(q))
  }, [normalised, inputValue])

  // Show placeholder option only when it matches the typed text.
  const showPlaceholder =
    placeholder != null &&
    (!inputValue || placeholder.toLowerCase().includes(inputValue.toLowerCase()))

  return (
    <Field
      className={clsx('w-full min-w-0', className)}
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
      <Combobox
        ref={ref}
        id={id}
        required={required}
        disabled={disabled}
        placeholder={placeholder ?? 'Search or select…'}
        value={inputValue}
        selectedOptions={value != null && value !== '' ? [String(value)] : []}
        onOptionSelect={handleOptionSelect}
        onChange={handleInputChange}
        style={{ minWidth: 0 }}
        className={clsx('w-full min-w-0', inputClassName)}
        {...props}
      >
        {showPlaceholder && (
          <Option key="__none__" value="" text={placeholder}>
            {placeholder}
          </Option>
        )}
        {filteredOptions.map(({ value: v, label: l }) => (
          <Option key={v} value={v} text={l}>
            {l}
          </Option>
        ))}
        {filteredOptions.length === 0 && !showPlaceholder && (
          <Option key="__no-match__" value="" disabled text="">
            No matches
          </Option>
        )}
      </Combobox>
    </Field>
  )
})

export default BaseSelect
