import { forwardRef, useId } from 'react'
import { Field, Textarea } from '@fluentui/react-components'
import clsx from 'clsx'

const BaseTextarea = forwardRef(function BaseTextarea(
  {
    label,
    hint,
    error,
    className,
    inputClassName,
    id: idProp,
    required,
    hideLabel,
    rows = 4,
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
      <Textarea
        ref={ref}
        id={id}
        required={required}
        rows={rows}
        className={inputClassName}
        {...props}
      />
    </Field>
  )
})

export default BaseTextarea
