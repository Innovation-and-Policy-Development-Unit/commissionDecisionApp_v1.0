import { forwardRef } from 'react'
import clsx from 'clsx'

const BaseSwitch = forwardRef(function BaseSwitch({ label, className, ...props }, ref) {
  const toggle = (
    <span className="relative inline-flex items-center shrink-0">
      <input ref={ref} type="checkbox" role="switch" className="peer sr-only" {...props} />
      <span className="w-9 h-5 rounded-full bg-slate-300 dark:bg-slate-600 peer-checked:bg-primary-600 peer-focus-visible:ring-2 peer-focus-visible:ring-primary-400 transition-colors" />
      <span className="absolute left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform peer-checked:translate-x-4" />
    </span>
  )
  if (!label) return <label className={clsx('inline-flex cursor-pointer', className)}>{toggle}</label>
  return (
    <label className={clsx('inline-flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200 cursor-pointer', className)}>
      {toggle}
      {label}
    </label>
  )
})

export default BaseSwitch
