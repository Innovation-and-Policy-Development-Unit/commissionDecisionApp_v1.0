import { Badge } from '@fluentui/react-components'
import clsx from 'clsx'

const COLOR = {
  default: 'informative',
  primary: 'brand',
  success: 'success',
  warning: 'warning',
  danger: 'danger',
  info: 'informative',
  outline: 'outline',
}

const APPEARANCE = {
  default: 'filled',
  outline: 'outline',
  subtle: 'tint',
}

/**
 * Status / count badge — maps liner variants to Fluent Badge.
 */
export default function BaseBadge({
  children,
  color = 'default',
  appearance,
  className,
  size = 'medium',
  ...props
}) {
  const fluentColor = COLOR[color] || color
  const fluentAppearance = appearance || APPEARANCE[color === 'outline' ? 'outline' : 'default'] || 'filled'

  return (
    <Badge
      color={fluentColor}
      appearance={fluentAppearance}
      size={size}
      className={clsx(className)}
      {...props}
    >
      {children}
    </Badge>
  )
}
