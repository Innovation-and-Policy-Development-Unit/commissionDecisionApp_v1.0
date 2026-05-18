import { createContext, useContext, useState, useCallback, useRef } from 'react'
import { AlertTriangle, Trash2 } from 'lucide-react'

const ConfirmContext = createContext(null)

function ConfirmDialog({ dialog, onResolve }) {
  if (!dialog) return null
  const { title, message, confirmLabel = 'Delete', cancelLabel = 'Cancel', variant = 'danger' } = dialog

  const btnClass = variant === 'danger'
    ? 'bg-red-600 hover:bg-red-700 text-white'
    : 'bg-primary-600 hover:bg-primary-700 text-white'

  const iconClass = variant === 'danger' ? 'text-red-500' : 'text-amber-500'

  return (
    /* Backdrop */
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
        onClick={() => onResolve(false)}
      />
      {/* Dialog */}
      <div className="relative z-10 w-full max-w-sm bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-6 animate-scale-in">
        <div className="flex items-start gap-4">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0
            ${variant === 'danger' ? 'bg-red-100 dark:bg-red-900/30' : 'bg-amber-100 dark:bg-amber-900/30'}`}>
            {variant === 'danger'
              ? <Trash2 size={18} className={iconClass} />
              : <AlertTriangle size={18} className={iconClass} />
            }
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-1">{title}</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{message}</p>
          </div>
        </div>

        <div className="flex gap-3 mt-6 justify-end">
          <button
            autoFocus
            onClick={() => onResolve(false)}
            className="px-4 py-2 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300
              bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            onClick={() => onResolve(true)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${btnClass}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

export function ConfirmProvider({ children }) {
  const [dialog, setDialog] = useState(null)
  const resolverRef = useRef(null)

  const confirm = useCallback((options) => {
    // options: { title, message, confirmLabel, cancelLabel, variant }
    return new Promise((resolve) => {
      resolverRef.current = resolve
      setDialog(typeof options === 'string' ? { title: 'Are you sure?', message: options } : options)
    })
  }, [])

  const handleResolve = useCallback((value) => {
    setDialog(null)
    resolverRef.current?.(value)
    resolverRef.current = null
  }, [])

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <ConfirmDialog dialog={dialog} onResolve={handleResolve} />
    </ConfirmContext.Provider>
  )
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error('useConfirm must be used inside ConfirmProvider')
  return ctx
}
