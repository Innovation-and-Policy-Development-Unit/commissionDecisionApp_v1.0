import { forwardRef } from 'react'
import { Button, Spinner } from '@fluentui/react-components'
import clsx from 'clsx'
import { MIN_TOUCH } from '../../utils/a11y'

const APPEARANCE = {
  primary: 'primary',
  secondary: 'secondary',
  outline: 'outline',
  ghost: 'subtle',
  danger: 'primary',
  unstyled: 'transparent',
}

const SIZE = {
  sm: 'small',
  md: 'medium',
  lg: 'large',
  icon: 'medium',
}

/**
 * Accessible button — Fluent UI v9, mapped from liner template variants.
 */
const BaseButton = forwardRef(function BaseButton(
  {
    variant = 'ghost',
    size = 'md',
    className,
    children,
    type = 'button',
    disabled,
    loading,
    loadingLabel = 'Loading',
    iconOnly = false,
    touchTarget = false,
    ...props
  },
  ref,
) {
  const isIconOnly = iconOnly || (size === 'icon' && !children)
  const appearance = APPEARANCE[variant] ?? 'subtle'

  return (
    <Button
      ref={ref}
      type={type}
      appearance={appearance}
      size={SIZE[size] ?? 'medium'}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      aria-disabled={disabled || loading || undefined}
      aria-label={isIconOnly && !props['aria-label'] ? loadingLabel : props['aria-label']}
      className={clsx(
        variant === 'danger' && '!bg-red-600 hover:!bg-red-700 !text-white',
        touchTarget && MIN_TOUCH,
        className,
      )}
      icon={loading ? <Spinner size="tiny" aria-hidden /> : undefined}
      {...props}
    >
      {loading && <span className="sr-only">{loadingLabel}</span>}
      {!loading && children}
    </Button>
  )
})

export default BaseButton
