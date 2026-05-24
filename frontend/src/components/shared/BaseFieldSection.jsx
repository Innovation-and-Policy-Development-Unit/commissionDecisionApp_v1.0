import { Divider, Label } from '@fluentui/react-components'
import clsx from 'clsx'

/** Section divider for dynamic / long forms (Fluent Label + Divider). */
export default function BaseFieldSection({ label, className }) {
  return (
    <div className={clsx('pt-2 pb-1', className)} role="group" aria-label={label}>
      <Divider className="!mb-2" />
      <Label weight="semibold" className="text-xs uppercase tracking-wide text-slate-600 dark:text-slate-300">
        {label}
      </Label>
    </div>
  )
}
