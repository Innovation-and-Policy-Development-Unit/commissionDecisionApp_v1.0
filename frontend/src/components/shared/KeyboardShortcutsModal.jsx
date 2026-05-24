import { useEffect } from 'react'
import { X, Keyboard } from 'lucide-react'
import { SHORTCUT_DEFS } from '../../hooks/useGlobalShortcuts'

function Kbd({ children }) {
  return (
    <kbd className="inline-flex items-center justify-center min-w-[1.5rem] h-6 px-1.5 rounded-md border border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-mono text-[11px] font-semibold shadow-[0_1px_0_1px_rgba(0,0,0,.08)] dark:shadow-none">
      {children}
    </kbd>
  )
}

export default function KeyboardShortcutsModal({ open, onClose }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard shortcuts"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="relative w-full max-w-md bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden animate-fade-in">
        {/* Header */}
        <div className="flex items-center gap-2.5 px-5 py-4 border-b border-slate-100 dark:border-slate-700">
          <Keyboard size={16} className="text-slate-400" />
          <h2 className="font-semibold text-slate-800 dark:text-slate-100 text-sm flex-1">
            Keyboard shortcuts
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
          >
            <X size={15} />
          </button>
        </div>

        {/* Shortcut list */}
        <ul className="divide-y divide-slate-50 dark:divide-slate-700/50 px-1 py-1 max-h-[70vh] overflow-y-auto">
          {SHORTCUT_DEFS.map((def, i) => (
            <li
              key={i}
              className="flex items-center justify-between px-4 py-2.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors"
            >
              <span className="text-sm text-slate-600 dark:text-slate-300">
                {def.description}
              </span>
              <span className="flex items-center gap-1 shrink-0">
                {def.keys.map((k, ki) => (
                  <span key={ki} className="flex items-center gap-1">
                    {ki > 0 && (
                      <span className="text-slate-300 dark:text-slate-600 text-[10px]">then</span>
                    )}
                    <Kbd>{k}</Kbd>
                  </span>
                ))}
              </span>
            </li>
          ))}
        </ul>

        {/* Footer hint */}
        <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
          <p className="text-[11px] text-slate-400 text-center">
            Press <Kbd>?</Kbd> at any time to toggle this panel
          </p>
        </div>
      </div>
    </div>
  )
}
