import { Spinner } from '@fluentui/react-components'
import clsx from 'clsx'

const SIZE = {
  sm: 'extra-tiny',
  md: 'tiny',
  lg: 'small',
}

export default function BaseSpinner({ size = 'md', label = 'Loading', className, ...props }) {
  return (
    <Spinner
      size={SIZE[size] || SIZE.md}
      label={label}
      className={clsx(className)}
      {...props}
    />
  )
}
