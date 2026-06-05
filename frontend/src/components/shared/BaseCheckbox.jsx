import { forwardRef } from 'react'
import clsx from 'clsx'

const BaseCheckbox = forwardRef(function BaseCheckbox({ label, className, ...props }, ref) {
  const input = (
    <input
      ref={ref}
      type="checkbox"
      className={clsx('h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-400', !label && className)}
      {...props}
    />
  )
  if (!label) return input
  return (
    <label className={clsx('inline-flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200 cursor-pointer', className)}>
      {input}
      {label}
    </label>
  )
})

export default BaseCheckbox
