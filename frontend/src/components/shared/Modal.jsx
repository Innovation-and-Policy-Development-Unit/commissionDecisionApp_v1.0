import { Fragment } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { X } from 'lucide-react'

const SIZES = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  full: 'max-w-5xl',
}

/**
 * Accessible modal — focus trap, Escape to close, and ARIA via Headless UI Dialog.
 */
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
  const showHeader = Boolean(title || subtitle)

  return (
    <Transition show={!!open} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" aria-hidden="true" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto p-4">
          <div className="flex min-h-full items-center justify-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-200"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-150"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel
                className={`relative w-full ${SIZES[size] || SIZES.md} bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-h-[90vh] flex flex-col ${panelClassName}`}
              >
                {showHeader ? (
                  <div className="flex items-start justify-between gap-3 p-5 border-b border-slate-200 dark:border-slate-700 shrink-0">
                    <div className="min-w-0 pe-2">
                      {title && (
                        <Dialog.Title className="font-semibold text-slate-900 dark:text-slate-100">
                          {title}
                        </Dialog.Title>
                      )}
                      {subtitle && (
                        <Dialog.Description className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                          {subtitle}
                        </Dialog.Description>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={onClose}
                      aria-label={closeLabel}
                      className="w-8 h-8 shrink-0 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                    >
                      <X size={16} aria-hidden="true" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={onClose}
                    aria-label={closeLabel}
                    className="absolute top-3 end-3 z-10 w-8 h-8 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                  >
                    <X size={16} aria-hidden="true" />
                  </button>
                )}
                <div className="p-5 overflow-y-auto flex-1">{children}</div>
                {footer && (
                  <div className="p-5 border-t border-slate-200 dark:border-slate-700 shrink-0">
                    {footer}
                  </div>
                )}
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  )
}
