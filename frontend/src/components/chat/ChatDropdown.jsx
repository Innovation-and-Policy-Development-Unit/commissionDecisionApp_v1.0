import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Plus, Users } from 'lucide-react'
import { useChat } from '../../context/ChatContext'
import Avatar from '../shared/Avatar'
import NewConversationModal from './NewConversationModal'
import { formatNotificationTime } from '../../utils/browserNotifications'

/** Header flyout — mirrors the notifications dropdown's shell, lists
 * conversations, and pops a floating window (Messenger-style) on click
 * rather than navigating to a full page. */
export default function ChatDropdown({ onClose }) {
  const { t } = useTranslation()
  const { conversations, openChatWindow } = useChat()
  const [modalOpen, setModalOpen] = useState(false)

  const handleSelect = (conversationId) => {
    openChatWindow(conversationId)
    onClose?.()
  }

  return (
    <div
      role="dialog"
      aria-label={t('header.chat')}
      className="absolute end-0 top-full mt-2 w-80 card shadow-card-lg animate-fade-in z-50"
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-700">
        <h3 className="font-semibold text-slate-800 dark:text-slate-200">{t('chat.title')}</h3>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          aria-label={t('chat.new_conversation')}
          title={t('chat.new_conversation')}
          className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-primary-600 dark:text-primary-400"
        >
          <Plus size={16} />
        </button>
      </div>

      <div className="max-h-96 overflow-y-auto custom-scrollbar">
        {conversations.length === 0 && (
          <p className="px-4 py-6 text-sm text-slate-400 text-center" role="status">
            {t('chat.no_conversations')}
          </p>
        )}
        {conversations.map((c) => {
          const displayName = c.display_name || (c.is_group ? t('chat.group_chat') : '')
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => handleSelect(c.id)}
              className="flex w-full items-center gap-3 px-4 py-2.5 border-b border-slate-50 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors text-start"
            >
              {c.is_group ? (
                <div className="w-9 h-9 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center shrink-0">
                  <Users size={16} className="text-slate-500 dark:text-slate-400" />
                </div>
              ) : (
                <Avatar name={displayName} src={c.picture} size="sm" status={c.online ? 'online' : undefined} />
              )}
              <span className="flex-1 min-w-0">
                <span className="flex items-center justify-between gap-2">
                  <span className={`text-sm truncate ${c.unread_count > 0 ? 'font-semibold text-slate-900 dark:text-slate-100' : 'font-medium text-slate-700 dark:text-slate-300'}`}>
                    {displayName}
                  </span>
                  {c.updated_at && (
                    <span className="text-[10px] text-slate-400 shrink-0">
                      {formatNotificationTime(c.updated_at)}
                    </span>
                  )}
                </span>
                <span className="block text-xs text-slate-500 dark:text-slate-400 truncate">
                  {c.last_message?.is_deleted ? t('chat.deleted_message') : (c.last_message?.body || '')}
                </span>
              </span>
              {c.unread_count > 0 && (
                <span className="shrink-0 min-w-[1.25rem] h-5 px-1 rounded-full bg-primary-600 text-white text-[10px] font-bold flex items-center justify-center">
                  {c.unread_count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      <div className="p-2 border-t border-slate-100 dark:border-slate-700">
        <Link
          to="/chat"
          onClick={onClose}
          className="block w-full text-center text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 font-medium py-1.5 focus:outline-none focus-visible:underline"
        >
          {t('chat.title')} →
        </Link>
      </div>

      <NewConversationModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={(conversation) => { handleSelect(conversation.id) }}
      />
    </div>
  )
}
