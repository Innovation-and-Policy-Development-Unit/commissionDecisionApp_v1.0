import { MessageBar, MessageBarBody, MessageBarTitle } from '@fluentui/react-components'
import clsx from 'clsx'
import LiveRegion from './LiveRegion'

const INTENT = {
  error: 'error',
  success: 'success',
  warning: 'warning',
  info: 'info',
}

/**
 * Inline alert — Fluent MessageBar + screen reader announcement.
 */
export default function BaseMessageBar({
  intent = 'info',
  title,
  children,
  className,
  announce = true,
}) {
  if (!title && !children) return null

  const fluentIntent = INTENT[intent] || 'info'
  const message = [title, children].filter(Boolean).join(': ')

  return (
    <>
      {announce && (
        <LiveRegion
          message={message}
          politeness={intent === 'error' ? 'assertive' : 'polite'}
        />
      )}
      <MessageBar intent={fluentIntent} className={clsx('mb-4', className)}>
        <MessageBarBody>
          {title && <MessageBarTitle>{title}</MessageBarTitle>}
          {children}
        </MessageBarBody>
      </MessageBar>
    </>
  )
}
