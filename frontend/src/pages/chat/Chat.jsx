import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Send, Users } from 'lucide-react'
import { useChat } from '../../context/ChatContext'
import { useAuth } from '../../context/AuthContext'
import Avatar from '../../components/shared/Avatar'
import NewConversationModal from '../../components/chat/NewConversationModal'
import { formatNotificationTime } from '../../utils/browserNotifications'

const TYPING_IDLE_MS = 2000

function messageTime(iso) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function ConversationRow({ conversation, active, onSelect, t }) {
  const lastPreview = conversation.last_message?.body || ''
  const displayName = conversation.display_name || (conversation.is_group ? t('chat.group_chat') : '')
  return (
    <button
      type="button"
      onClick={() => onSelect(conversation.id)}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
        active ? 'bg-primary-50 dark:bg-primary-900/30' : 'hover:bg-slate-50 dark:hover:bg-slate-700/40'
      }`}
    >
      {conversation.is_group ? (
        <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center shrink-0">
          <Users size={18} className="text-slate-500 dark:text-slate-400" />
        </div>
      ) : (
        <Avatar
          name={displayName}
          src={conversation.picture}
          size="md"
          status={conversation.online ? 'online' : undefined}
        />
      )}
      <span className="flex-1 min-w-0">
        <span className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">
            {displayName}
          </span>
          {conversation.updated_at && (
            <span className="text-[10px] text-slate-400 shrink-0">
              {formatNotificationTime(conversation.updated_at)}
            </span>
          )}
        </span>
        <span className="flex items-center justify-between gap-2">
          <span className="text-xs text-slate-500 dark:text-slate-400 truncate">{lastPreview}</span>
          {conversation.unread_count > 0 && (
            <span className="shrink-0 min-w-[1.25rem] h-5 px-1 rounded-full bg-primary-600 text-white text-[10px] font-bold flex items-center justify-center">
              {conversation.unread_count}
            </span>
          )}
        </span>
      </span>
    </button>
  )
}

export default function Chat() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const {
    conversations, activeId, messages, typingUserIds,
    selectConversation, sendMessage, setTyping, markRead, fetchMessages,
  } = useChat()
  const [draft, setDraft] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const typingTimeoutRef = useRef(null)
  const wasTypingRef = useRef(false)
  const scrollRef = useRef(null)

  const activeConversation = useMemo(
    () => conversations.find((c) => c.id === activeId) || null,
    [conversations, activeId],
  )
  const activeDisplayName = activeConversation
    ? (activeConversation.display_name || (activeConversation.is_group ? t('chat.group_chat') : ''))
    : ''

  useEffect(() => {
    if (activeId) markRead(activeId)
  }, [activeId, messages.length, markRead])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [messages.length, activeId])

  const handleDraftChange = useCallback((e) => {
    const value = e.target.value
    setDraft(value)
    if (!activeId) return
    if (!wasTypingRef.current) {
      wasTypingRef.current = true
      setTyping(activeId, true)
    }
    clearTimeout(typingTimeoutRef.current)
    typingTimeoutRef.current = setTimeout(() => {
      wasTypingRef.current = false
      setTyping(activeId, false)
    }, TYPING_IDLE_MS)
  }, [activeId, setTyping])

  const handleSend = useCallback((e) => {
    e.preventDefault()
    if (!activeId || !draft.trim()) return
    sendMessage(activeId, draft)
    setDraft('')
    clearTimeout(typingTimeoutRef.current)
    if (wasTypingRef.current) {
      wasTypingRef.current = false
      setTyping(activeId, false)
    }
  }, [activeId, draft, sendMessage, setTyping])

  const isOtherTyping = activeConversation
    ? typingUserIds.some((id) => id !== user?.id)
    : false

  return (
    <div className="flex h-[calc(100vh-8rem)] card overflow-hidden">
      {/* Conversation list */}
      <div className="w-full sm:w-80 border-e border-slate-100 dark:border-slate-700 flex flex-col shrink-0">
        <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-700">
          <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">{t('chat.title')}</h1>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            aria-label={t('chat.new_conversation')}
            title={t('chat.new_conversation')}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-primary-600 dark:text-primary-400"
          >
            <Plus size={20} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-0.5">
          {conversations.length === 0 && (
            <div className="text-center py-10 px-4">
              <p className="text-sm font-medium text-slate-600 dark:text-slate-300">{t('chat.no_conversations')}</p>
              <p className="text-xs text-slate-400 mt-1">{t('chat.no_conversations_hint')}</p>
            </div>
          )}
          {conversations.map((c) => (
            <ConversationRow key={c.id} conversation={c} active={c.id === activeId} onSelect={selectConversation} t={t} />
          ))}
        </div>
      </div>

      {/* Thread */}
      <div className="hidden sm:flex flex-1 flex-col min-w-0">
        {!activeConversation ? (
          <div className="flex-1 flex items-center justify-center text-sm text-slate-400">
            {t('chat.select_conversation')}
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 p-4 border-b border-slate-100 dark:border-slate-700 shrink-0">
              {activeConversation.is_group ? (
                <div className="w-9 h-9 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
                  <Users size={16} className="text-slate-500 dark:text-slate-400" />
                </div>
              ) : (
                <Avatar
                  name={activeDisplayName}
                  src={activeConversation.picture}
                  size="sm"
                  status={activeConversation.online ? 'online' : undefined}
                />
              )}
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">
                  {activeDisplayName}
                </p>
                <p className="text-xs text-slate-400">
                  {isOtherTyping
                    ? t('chat.typing_generic')
                    : (activeConversation.is_group
                      ? t('chat.group_chat')
                      : (activeConversation.online ? t('chat.online') : t('chat.offline')))}
                </p>
              </div>
            </div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-2">
              {messages.length === 0 && (
                <p className="text-center text-xs text-slate-400 mt-8">{t('chat.no_messages')}</p>
              )}
              {messages.map((m) => {
                const isOwn = m.sender === user?.id
                return (
                  <div key={m.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[70%] rounded-2xl px-3.5 py-2 text-sm ${
                      isOwn
                        ? 'bg-primary-600 text-white rounded-br-sm'
                        : 'bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-bl-sm'
                    } ${m.pending ? 'opacity-60' : ''}`}
                    >
                      <p className="whitespace-pre-wrap break-words">{m.body}</p>
                      <p className={`mt-0.5 text-[10px] ${isOwn ? 'text-primary-100' : 'text-slate-400'}`}>
                        {messageTime(m.created_at)}
                      </p>
                    </div>
                  </div>
                )
              })}
              {activeId && messages.length > 0 && (
                <button
                  type="button"
                  onClick={() => fetchMessages(activeId, { before: messages[0].id })}
                  className="mx-auto block text-[11px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                >
                  {t('chat.load_earlier')}
                </button>
              )}
            </div>

            <form onSubmit={handleSend} className="flex items-center gap-2 p-3 border-t border-slate-100 dark:border-slate-700 shrink-0">
              <input
                type="text"
                value={draft}
                onChange={handleDraftChange}
                placeholder={t('chat.message_placeholder')}
                className="flex-1 input text-sm"
              />
              <button type="submit" disabled={!draft.trim()} className="btn btn-primary btn-sm disabled:opacity-50" aria-label={t('chat.send')}>
                <Send size={16} />
              </button>
            </form>
          </>
        )}
      </div>

      <NewConversationModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={(conversation) => selectConversation(conversation.id)}
      />
    </div>
  )
}
