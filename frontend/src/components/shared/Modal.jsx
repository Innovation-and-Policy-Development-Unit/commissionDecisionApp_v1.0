import { X } from 'lucide-react'

export default function Modal({ open, onClose, size = 'md', title, children, footer }) {
  if (!open) return null
  const sizes = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl', full: 'max-w-5xl' }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative w-full ${sizes[size]} bg-white dark:bg-slate-800 rounded-2xl shadow-2xl z-10 max-h-[90vh] flex flex-col animate-scale-in`}>
        {title && (
          <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-700 shrink-0">
            <h3 className="font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
            <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors">
              <X size={16} />
            </button>
          </div>
        )}
        <div className="p-5 overflow-y-auto flex-1">{children}</div>
        {footer && <div className="p-5 border-t border-slate-200 dark:border-slate-700 shrink-0">{footer}</div>}
      </div>
    </div>
  )
}
