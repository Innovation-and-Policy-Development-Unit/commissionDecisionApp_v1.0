import { Field, Text } from '@fluentui/react-components'
import clsx from 'clsx'

/** Read-only field display — Fluent Field + Text (forms in view mode). */
export default function BaseReadonlyField({
  label,
  hint,
  value,
  emptyLabel = '—',
  className,
  multiline = false,
}) {
  const isEmpty = value === null || value === undefined || value === ''

  return (
    <Field className={clsx('w-full', className)} label={label} hint={hint}>
      <Text
        block
        className={clsx(
          'text-sm',
          multiline && 'whitespace-pre-wrap',
          isEmpty
            ? 'text-slate-400 italic'
            : 'text-slate-800 dark:text-slate-200',
        )}
      >
        {isEmpty ? emptyLabel : value}
      </Text>
    </Field>
  )
}
