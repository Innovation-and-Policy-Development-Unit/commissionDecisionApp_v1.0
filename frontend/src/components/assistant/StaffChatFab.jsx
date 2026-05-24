import { Bot, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import clsx from 'clsx'

export default function StaffChatFab({ open, onClick, hidden, label }) {
  const { t } = useTranslation()
  const resolvedLabel = label || t('staff_chat.open_fab')

  if (hidden) return null

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={open ? t('staff_chat.close') : resolvedLabel}
      title={open ? t('staff_chat.close') : resolvedLabel}
      className={clsx(
        'fixed flex items-center justify-center rounded-full shadow-2xl',
        'transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2',
        'bottom-6 right-6 w-14 h-14 z-[75]',
        open
          ? 'bg-slate-700 hover:bg-slate-800 text-white rotate-0'
          : 'bg-gradient-to-br from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white',
      )}
    >
      {!open && (
        <span
          className="absolute inset-0 rounded-full bg-indigo-400/30 animate-ping"
          aria-hidden="true"
        />
      )}
      <span className="relative z-10">
        {open ? <X size={24} /> : <Bot size={26} />}
      </span>
    </button>
  )
}
