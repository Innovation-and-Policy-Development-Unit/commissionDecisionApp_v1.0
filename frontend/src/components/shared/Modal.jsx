import { useEffect } from 'react'
import { X } from 'lucide-react'
import clsx from 'clsx'

const SIZES = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  full: 'max-w-5xl',
}

/** Accessible modal (Tailwind) — overlay, Escape, focus, click-outside. */
export default function Modal({
  open,
  onClose,
  size = 'md',
  title,
  subtitle,
  children,
  footer,
  panelClassName = '',
  closeLabel = 'Close dialog',
}) {
  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => { if (e.key === 'Escape') onClose?.() }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null
  const showHeader = Boolean(title || subtitle)

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={typeof title === 'string' ? title : closeLabel}
    >
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[1px]" onClick={onClose} />
      <div className={clsx(
        'relative w-full bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 flex flex-col max-h-[90vh] animate-scale-in',
        SIZES[size] || SIZES.md,
        panelClassName,
      )}>
        {showHeader ? (
          <div className="flex items-start justify-between gap-3 p-5 border-b border-slate-100 dark:border-slate-700 shrink-0">
            <div className="min-w-0 flex-1">
              {title && <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{title}</h2>}
              {subtitle && <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>}
            </div>
            <button type="button" onClick={onClose} aria-label={closeLabel}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700">
              <X size={20} />
            </button>
          </div>
        ) : (
          <button type="button" onClick={onClose} aria-label={closeLabel}
            className="absolute top-3 right-3 z-10 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700">
            <X size={18} />
          </button>
        )}
        <div className="overflow-y-auto p-5 flex-1">{children}</div>
        {footer && (
          <div className="flex gap-2 justify-end flex-wrap p-4 border-t border-slate-100 dark:border-slate-700 shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
