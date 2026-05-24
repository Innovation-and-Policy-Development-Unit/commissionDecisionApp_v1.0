import { forwardRef } from 'react'
import { Switch } from '@fluentui/react-components'
import clsx from 'clsx'

const BaseSwitch = forwardRef(function BaseSwitch(
  { label, className, ...props },
  ref,
) {
  return (
    <Switch
      ref={ref}
      label={label}
      className={clsx(className)}
      {...props}
    />
  )
})

export default BaseSwitch
