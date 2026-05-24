import { forwardRef, useId, useState } from 'react'
import { Field, Input, Button } from '@fluentui/react-components'
import { Eye24Regular, EyeOff24Regular } from '@fluentui/react-icons'
import clsx from 'clsx'

const BasePasswordInput = forwardRef(function BasePasswordInput(
  {
    label,
    hint,
    error,
    className,
    inputClassName,
    id: idProp,
    required,
    hideLabel,
    showToggle = true,
    ...props
  },
  ref,
) {
  const autoId = useId()
  const id = idProp || autoId
  const [visible, setVisible] = useState(false)

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
        type={visible ? 'text' : 'password'}
        required={required}
        className={inputClassName}
        contentAfter={
          showToggle ? (
            <Button
              appearance="transparent"
              icon={visible ? <EyeOff24Regular /> : <Eye24Regular />}
              aria-label={visible ? 'Hide password' : 'Show password'}
              onClick={() => setVisible(v => !v)}
              type="button"
            />
          ) : undefined
        }
        {...props}
      />
    </Field>
  )
})

export default BasePasswordInput
