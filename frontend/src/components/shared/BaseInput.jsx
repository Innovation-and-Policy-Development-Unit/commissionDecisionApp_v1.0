import { forwardRef, useId } from 'react'
import { Field, Input } from '@fluentui/react-components'
import clsx from 'clsx'

/**
 * Accessible text input — Fluent UI Field + Input.
 */
const BaseInput = forwardRef(function BaseInput(
  {
    label,
    hint,
    error,
    className,
    inputClassName,
    id: idProp,
    required,
    hideLabel,
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
      <Input
        ref={ref}
        id={id}
        required={required}
        className={clsx('w-full min-w-0', inputClassName)}
        {...props}
      />
    </Field>
  )
})

export default BaseInput
