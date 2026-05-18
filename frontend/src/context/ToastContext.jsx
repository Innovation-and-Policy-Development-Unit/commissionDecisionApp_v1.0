import { createContext, useContext, useState, useCallback, useRef } from 'react'
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react'

const ToastContext = createContext(null)

const ICONS = {
  success: CheckCircle2,
  error:   XCircle,
  warning: AlertTriangle,
  info:    Info,
}

const STYLES = {
  success: 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200',
  error:   'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200',
  warning: 'bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200',
  info:    'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200',
}

const ICON_STYLES = {
  success: 'text-emerald-500',
  error:   'text-red-500',
  warning: 'text-amber-500',
  info:    'text-blue-500',
}

function ToastItem({ toast, onRemove }) {
  const Icon = ICONS[toast.type] || Info

  return (
    <div
      className={`flex items-start gap-3 w-80 rounded-xl border px-4 py-3 shadow-lg
        animate-slide-in-right pointer-events-auto ${STYLES[toast.type]}`}
    >
      <Icon size={18} className={`shrink-0 mt-0.5 ${ICON_STYLES[toast.type]}`} />
      <div className="flex-1 min-w-0">
        {toast.title && (
          <p className="text-sm font-semibold leading-snug">{toast.title}</p>
        )}
        <p className="text-sm leading-snug opacity-90">{toast.message}</p>
      </div>
      <button
        onClick={() => onRemove(toast.id)}
        className="shrink-0 rounded-md p-0.5 opacity-60 hover:opacity-100 transition-opacity"
      >
        <X size={14} />
      </button>
    </div>
  )
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const counterRef = useRef(0)

  const remove = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const add = useCallback((type, message, title, duration = 4000) => {
    const id = ++counterRef.current
    setToasts(prev => [...prev, { id, type, message, title }])
    if (duration > 0) setTimeout(() => remove(id), duration)
  }, [remove])

  const toast = {
    success: (message, title) => add('success', message, title),
    error:   (message, title) => add('error',   message, title, 6000),
    warning: (message, title) => add('warning', message, title),
    info:    (message, title) => add('info',    message, title),
  }

  return (
    <ToastContext.Provider value={toast}>
      {children}
      {/* Toast stack — bottom-right */}
      <div className="fixed bottom-6 right-6 z-[200] flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <ToastItem key={t.id} toast={t} onRemove={remove} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside ToastProvider')
  return ctx
}
