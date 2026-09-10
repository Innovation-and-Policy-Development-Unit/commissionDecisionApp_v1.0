import { useRef, useState } from 'react'
import { BellOff, MoreHorizontal, Users } from 'lucide-react'
import { useChat } from '../../context/ChatContext'
import { useAuth } from '../../context/AuthContext'
import { useDismissible } from '../../hooks/useDismissible'
import Avatar from '../shared/Avatar'
import { formatNotificationTime } from '../../utils/browserNotifications'

/** One conversation-list row, shared by the header dropdown and the full
 * /chat page — avatar/online dot, sender-prefixed preview, unread badge,
 * muted indicator, and a per-row "…" menu (mute/unmute, delete). */
export default function ConversationRow({ conversation: c, active, onSelect, t }) {
  const { user } = useAuth()
  const { muteConversation, deleteConversation } = useChat()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)
  useDismissible({ open: menuOpen, onClose: () => setMenuOpen(false), containerRef: menuRef })

  const displayName = c.display_name || (c.is_group ? t('chat.group_chat') : '')
  const preview = c.last_message?.is_deleted
    ? t('chat.deleted_message')
    : (c.last_message?.body || '')
  const previewPrefix = c.last_message
    ? (c.last_message.sender === user?.id ? t('chat.you') : c.last_message.sender_name)
    : null

  const handleDelete = () => {
    setMenuOpen(false)
    if (window.confirm(t('chat.confirm_delete_conversation'))) deleteConversation(c.id)
  }

  return (
    <div
      className={`group relative flex w-full items-center gap-3 px-4 py-2.5 border-b border-slate-50 dark:border-slate-700/50 transition-colors ${
        active ? 'bg-primary-50 dark:bg-primary-900/30' : 'hover:bg-slate-50 dark:hover:bg-slate-700/30'
      }`}
    >
      <button type="button" onClick={() => onSelect(c.id)} className="flex items-center gap-3 flex-1 min-w-0 text-start">
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
            {previewPrefix ? `${previewPrefix}: ${preview}` : preview}
          </span>
        </span>
      </button>
      {c.muted && <BellOff size={12} className="text-slate-400 shrink-0" aria-label={t('chat.muted')} />}
      {c.unread_count > 0 && (
        <span className="shrink-0 min-w-[1.25rem] h-5 px-1 rounded-full bg-primary-600 text-white text-[10px] font-bold flex items-center justify-center">
          {c.unread_count}
        </span>
      )}
      <div className="relative shrink-0" ref={menuRef}>
        <button
          type="button"
          onClick={() => setMenuOpen((o) => !o)}
          aria-label={t('chat.more_options')}
          title={t('chat.more_options')}
          className={`p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-400 ${menuOpen ? 'flex' : 'hidden group-hover:flex'}`}
        >
          <MoreHorizontal size={14} />
        </button>
        {menuOpen && (
          <div className="absolute end-0 top-full mt-1 w-48 card shadow-card-lg py-1 z-20">
            <button
              type="button"
              onClick={() => { muteConversation(c.id, !c.muted); setMenuOpen(false) }}
              className="w-full text-start px-3 py-1.5 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50"
            >
              {c.muted ? t('chat.unmute') : t('chat.mute')}
            </button>
            <button
              type="button"
              onClick={handleDelete}
              className="w-full text-start px-3 py-1.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
            >
              {t('chat.delete_conversation')}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
