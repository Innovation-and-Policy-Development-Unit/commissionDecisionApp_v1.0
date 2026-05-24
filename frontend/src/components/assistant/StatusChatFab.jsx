import { MessageCircle, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import clsx from 'clsx'

export default function StatusChatFab({ open, onClick, hidden }) {
  const { t } = useTranslation()

  if (hidden) return null

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={open ? t('status_chat.close') : t('status_chat.open_fab')}
      title={open ? t('status_chat.close') : t('status_chat.open_fab')}
      className={clsx(
        'fixed flex items-center justify-center rounded-full shadow-2xl',
        'transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 focus-visible:ring-offset-2',
        'bottom-6 right-6 w-14 h-14 z-[75]',
        open
          ? 'bg-slate-700 hover:bg-slate-800 text-white'
          : 'bg-gradient-to-br from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white',
      )}
    >
      {!open && (
        <span
          className="absolute inset-0 rounded-full bg-teal-400/30 animate-ping"
          aria-hidden="true"
        />
      )}
      <span className="relative z-10">
        {open ? <X size={24} /> : <MessageCircle size={26} />}
      </span>
    </button>
  )
}
