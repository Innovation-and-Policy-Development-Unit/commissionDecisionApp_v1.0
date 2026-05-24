import { X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import StatusChatWidget from './StatusChatWidget'
import clsx from 'clsx'

export default function StatusChatPanel({ open, onClose }) {
  const { t } = useTranslation()

  return (
    <>
      {open && (
        <button
          type="button"
          className="fixed inset-0 bg-slate-900/25 backdrop-blur-[2px] z-[65] animate-fade-in"
          aria-label={t('status_chat.close')}
          onClick={onClose}
        />
      )}

      <div
        className={clsx(
          'fixed z-[70] flex flex-col bg-white dark:bg-slate-800 shadow-2xl border border-slate-200 dark:border-slate-700',
          'transition-all duration-300 ease-out overflow-hidden',
          'bottom-0 right-0 w-full sm:bottom-6 sm:right-6 sm:w-[400px] sm:rounded-2xl',
          'sm:max-h-[min(70vh,560px)] h-[85vh] sm:h-[min(70vh,560px)]',
          open
            ? 'opacity-100 translate-y-0 pointer-events-auto'
            : 'opacity-0 translate-y-4 pointer-events-none sm:translate-y-8',
        )}
        role="dialog"
        aria-modal="true"
        aria-label={t('status_chat.title')}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-2 right-2 z-10 p-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
          aria-label={t('status_chat.close')}
        >
          <X size={18} />
        </button>
        <StatusChatWidget variant="panel" enabled={open} showHistory />
      </div>
    </>
  )
}
