import { Sparkles } from 'lucide-react'
import clsx from 'clsx'

const SIZES = {
  sm: { text: 'text-xs', icon: 14, gap: 'gap-1.5', pad: 'px-2 py-1' },
  md: { text: 'text-sm', icon: 16, gap: 'gap-2', pad: 'px-3 py-1.5' },
  lg: { text: 'text-sm', icon: 18, gap: 'gap-2', pad: 'px-4 py-2' },
}

/**
 * Pulsating “AI is thinking…” status for async Claude/Celery fields.
 * Use role="status" + aria-live so screen readers announce progress.
 */
export default function AiProcessingIndicator({
  label = 'AI is thinking…',
  size = 'md',
  className,
  variant = 'violet',
}) {
  const s = SIZES[size] ?? SIZES.md

  const variantClasses = {
    violet:
      'bg-violet-50 text-violet-900 border-violet-200 dark:bg-violet-950/40 dark:text-violet-100 dark:border-violet-800',
    indigo:
      'bg-indigo-50 text-indigo-900 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-100 dark:border-indigo-800',
    slate:
      'bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:border-slate-600',
  }

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className={clsx(
        'ai-processing inline-flex items-center rounded-full border font-medium',
        s.gap,
        s.pad,
        s.text,
        variantClasses[variant] ?? variantClasses.violet,
        className,
      )}
    >
      <span className="ai-processing-dot" aria-hidden="true" />
      <Sparkles size={s.icon} className="ai-processing-icon shrink-0" aria-hidden="true" />
      <span>{label}</span>
    </div>
  )
}
