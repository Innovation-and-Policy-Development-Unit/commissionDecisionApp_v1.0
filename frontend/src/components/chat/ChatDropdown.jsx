import { useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { MoreHorizontal, Plus, Search } from 'lucide-react'
import { useChat } from '../../context/ChatContext'
import { useDismissible } from '../../hooks/useDismissible'
import NewConversationModal from './NewConversationModal'
import ConversationRow from './ConversationRow'

const FILTERS = ['all', 'unread', 'groups']

/** Header flyout — mirrors the notifications dropdown's shell, lists
 * conversations, and pops a floating window (Messenger-style) on click
 * rather than navigating to a full page. */
export default function ChatDropdown({ onClose }) {
  const { t } = useTranslation()
  const { conversations, openChatWindow, markAllRead } = useChat()
  const [modalOpen, setModalOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)
  useDismissible({ open: menuOpen, onClose: () => setMenuOpen(false), containerRef: menuRef })

  const handleSelect = (conversationId) => {
    openChatWindow(conversationId)
    onClose?.()
  }

  const filtered = useMemo(() => {
    let list = conversations
    if (filter === 'unread') list = list.filter((c) => c.unread_count > 0)
    if (filter === 'groups') list = list.filter((c) => c.is_group)
    const q = query.trim().toLowerCase()
    if (q) {
      list = list.filter((c) => {
        const name = c.display_name || (c.is_group ? t('chat.group_chat') : '')
        return name.toLowerCase().includes(q)
      })
    }
    return list
  }, [conversations, filter, query, t])

  const hasUnread = conversations.some((c) => c.unread_count > 0)

  return (
    <div
      role="dialog"
      aria-label={t('header.chat')}
      className="absolute end-0 top-full mt-2 w-80 card shadow-card-lg animate-fade-in z-50"
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-700">
        <h3 className="font-semibold text-slate-800 dark:text-slate-200">{t('chat.title')}</h3>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            aria-label={t('chat.new_conversation')}
            title={t('chat.new_conversation')}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-primary-600 dark:text-primary-400"
          >
            <Plus size={16} />
          </button>
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              aria-label={t('chat.more_options')}
              title={t('chat.more_options')}
              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400"
            >
              <MoreHorizontal size={16} />
            </button>
            {menuOpen && (
              <div className="absolute end-0 top-full mt-1 w-44 card shadow-card-lg py-1 z-10">
                <button
                  type="button"
                  disabled={!hasUnread}
                  onClick={() => { markAllRead(); setMenuOpen(false) }}
                  className="w-full text-start px-3 py-1.5 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {t('chat.mark_all_read')}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="px-3 pt-3 pb-2 space-y-2 border-b border-slate-100 dark:border-slate-700">
        <div className="relative">
          <Search size={14} className="absolute start-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('chat.search_conversations')}
            aria-label={t('chat.search_conversations')}
            className="w-full input text-sm py-1.5 ps-8"
          />
        </div>
        <div className="flex gap-1">
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                filter === f
                  ? 'bg-primary-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
              }`}
            >
              {t(`chat.filter_${f}`)}
            </button>
          ))}
        </div>
      </div>

      <div className="max-h-96 overflow-y-auto custom-scrollbar">
        {filtered.length === 0 && (
          <p className="px-4 py-6 text-sm text-slate-400 text-center" role="status">
            {t('chat.no_conversations')}
          </p>
        )}
        {filtered.map((c) => (
          <ConversationRow key={c.id} conversation={c} active={false} onSelect={handleSelect} t={t} />
        ))}
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
