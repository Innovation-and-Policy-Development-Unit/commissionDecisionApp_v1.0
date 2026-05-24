import { Card, CardHeader, CardPreview } from '@fluentui/react-components'
import clsx from 'clsx'

/**
 * Fluent Card wrapper — optional header and preview slots.
 */
export default function BaseCard({
  children,
  className,
  title,
  description,
  headerAction,
  preview,
}) {
  return (
    <Card className={clsx('shadow-card border border-slate-200 dark:border-slate-700', className)}>
      {preview && <CardPreview>{preview}</CardPreview>}
      {(title || description) && (
        <CardHeader
          header={title ? <span className="font-semibold text-slate-900 dark:text-slate-100">{title}</span> : undefined}
          description={description}
          action={headerAction}
        />
      )}
      {children}
    </Card>
  )
}
