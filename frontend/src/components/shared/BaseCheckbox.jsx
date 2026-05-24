import { forwardRef } from 'react'
import { Checkbox } from '@fluentui/react-components'
import clsx from 'clsx'

const BaseCheckbox = forwardRef(function BaseCheckbox(
  { label, className, ...props },
  ref,
) {
  return (
    <Checkbox
      ref={ref}
      label={label}
      className={clsx(className)}
      {...props}
    />
  )
})

export default BaseCheckbox
