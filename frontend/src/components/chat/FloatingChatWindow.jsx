import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Minus, Send, Users, X } from 'lucide-react'
import { useChat } from '../../context/ChatContext'
import { useAuth } from '../../context/AuthContext'
import Avatar from '../shared/Avatar'

const TYPING_IDLE_MS = 2000

function messageTime(iso) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

/** One Messenger-style popup window, positioned by its parent container. */
export default function FloatingChatWindow({ conversationId, minimized }) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const {
    conversations, messagesByConversation, typingByConversation,
    sendMessage, setTyping, markRead, closeChatWindow, minimizeChatWindow,
  } = useChat()

  const conversation = useMemo(
    () => conversations.find((c) => c.id === conversationId),
    [conversations, conversationId],
  )
  const messages = messagesByConversation[conversationId] || []
  const typingUserIds = typingByConversation[conversationId] || []
  const isOtherTyping = typingUserIds.some((id) => id !== user?.id)

  const [draft, setDraft] = useState('')
  const typingTimeoutRef = useRef(null)
  const wasTypingRef = useRef(false)
  const scrollRef = useRef(null)

  useEffect(() => {
    if (!minimized) markRead(conversationId)
  }, [conversationId, minimized, messages.length, markRead])

  useEffect(() => {
    if (!minimized) scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [messages.length, minimized])

  const handleDraftChange = useCallback((e) => {
    const value = e.target.value
    setDraft(value)
    if (!wasTypingRef.current) {
      wasTypingRef.current = true
      setTyping(conversationId, true)
    }
    clearTimeout(typingTimeoutRef.current)
    typingTimeoutRef.current = setTimeout(() => {
      wasTypingRef.current = false
      setTyping(conversationId, false)
    }, TYPING_IDLE_MS)
  }, [conversationId, setTyping])

  const handleSend = useCallback((e) => {
    e.preventDefault()
    if (!draft.trim()) return
    sendMessage(conversationId, draft)
    setDraft('')
    clearTimeout(typingTimeoutRef.current)
    if (wasTypingRef.current) {
      wasTypingRef.current = false
      setTyping(conversationId, false)
    }
  }, [conversationId, draft, sendMessage, setTyping])

  if (!conversation) return null
  const displayName = conversation.display_name || (conversation.is_group ? t('chat.group_chat') : '')

  return (
    <div className="w-72 sm:w-80 bg-white dark:bg-slate-800 rounded-t-xl shadow-2xl border border-slate-200 dark:border-slate-700 flex flex-col overflow-hidden">
      {/* Header — always visible, doubles as the un-minimize control */}
      <button
        type="button"
        onClick={() => minimizeChatWindow(conversationId, !minimized)}
        className="flex items-center gap-2 px-3 py-2.5 bg-slate-50 dark:bg-slate-700/60 border-b border-slate-100 dark:border-slate-700 shrink-0 text-start"
      >
        {conversation.is_group ? (
          <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center shrink-0">
            <Users size={14} className="text-slate-500 dark:text-slate-400" />
          </div>
        ) : (
          <Avatar name={displayName} src={conversation.picture} size="xs" status={conversation.online ? 'online' : undefined} />
        )}
        <span className="flex-1 min-w-0">
          <span className="block text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">
            {displayName}
          </span>
          {!minimized && (
            <span className="block text-[11px] text-slate-400 truncate">
              {isOtherTyping
                ? t('chat.typing_generic')
                : (conversation.is_group ? t('chat.group_chat') : (conversation.online ? t('chat.online') : t('chat.offline')))}
            </span>
          )}
        </span>
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => { e.stopPropagation(); minimizeChatWindow(conversationId, !minimized) }}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); minimizeChatWindow(conversationId, !minimized) } }}
          aria-label={minimized ? t('chat.title') : 'Minimize'}
          className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-500 dark:text-slate-400 shrink-0"
        >
          <Minus size={14} />
        </span>
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => { e.stopPropagation(); closeChatWindow(conversationId) }}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); closeChatWindow(conversationId) } }}
          aria-label={t('chat.cancel')}
          className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-500 dark:text-slate-400 shrink-0"
        >
          <X size={14} />
        </span>
      </button>

      {!minimized && (
        <>
          <div ref={scrollRef} className="flex-1 h-80 overflow-y-auto custom-scrollbar p-3 space-y-2">
            {messages.length === 0 && (
              <p className="text-center text-xs text-slate-400 mt-6">{t('chat.no_messages')}</p>
            )}
            {messages.map((m) => {
              const isOwn = m.sender === user?.id
              return (
                <div key={m.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[75%] rounded-2xl px-3 py-1.5 text-sm ${
                    isOwn
                      ? 'bg-primary-600 text-white rounded-br-sm'
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-bl-sm'
                  } ${m.pending ? 'opacity-60' : ''}`}
                  >
                    <p className="whitespace-pre-wrap break-words">{m.body}</p>
                    <p className={`mt-0.5 text-[9px] ${isOwn ? 'text-primary-100' : 'text-slate-400'}`}>
                      {messageTime(m.created_at)}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
          <form onSubmit={handleSend} className="flex items-center gap-1.5 p-2 border-t border-slate-100 dark:border-slate-700 shrink-0">
            <input
              type="text"
              value={draft}
              onChange={handleDraftChange}
              placeholder={t('chat.message_placeholder')}
              className="flex-1 input text-sm py-1.5"
            />
            <button type="submit" disabled={!draft.trim()} className="btn btn-primary btn-sm disabled:opacity-50 px-2.5" aria-label={t('chat.send')}>
              <Send size={14} />
            </button>
          </form>
        </>
      )}
    </div>
  )
}
