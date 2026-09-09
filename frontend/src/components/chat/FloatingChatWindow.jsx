import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Minus, Users, X } from 'lucide-react'
import { useChat } from '../../context/ChatContext'
import { useAuth } from '../../context/AuthContext'
import Avatar from '../shared/Avatar'
import MessageBubble from './MessageBubble'
import MessageComposer from './MessageComposer'

/** One Messenger-style popup window, positioned by its parent container. */
export default function FloatingChatWindow({ conversationId, minimized }) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const {
    conversations, messagesByConversation, typingByConversation,
    sendMessage, sendAttachments, editMessage, deleteMessage, reactToMessage,
    setTyping, markRead, closeChatWindow, minimizeChatWindow,
  } = useChat()

  const conversation = useMemo(
    () => conversations.find((c) => c.id === conversationId),
    [conversations, conversationId],
  )
  const messages = messagesByConversation[conversationId] || []
  const typingUserIds = typingByConversation[conversationId] || []
  const isOtherTyping = typingUserIds.some((id) => id !== user?.id)

  const [replyTo, setReplyTo] = useState(null)
  const scrollRef = useRef(null)

  useEffect(() => {
    if (!minimized) markRead(conversationId)
  }, [conversationId, minimized, messages.length, markRead])

  useEffect(() => {
    if (!minimized) scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [messages.length, minimized])

  if (!conversation) return null
  const displayName = conversation.display_name || (conversation.is_group ? t('chat.group_chat') : '')

  const handleSend = ({ body, files, replyToId }) => {
    if (files.length > 0) {
      sendAttachments(conversationId, { body, files, replyToId })
    } else {
      sendMessage(conversationId, body, replyToId)
    }
    setReplyTo(null)
  }

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
          <div ref={scrollRef} className="flex-1 h-80 overflow-y-auto custom-scrollbar p-3 space-y-2.5">
            {messages.length === 0 && (
              <p className="text-center text-xs text-slate-400 mt-6">{t('chat.no_messages')}</p>
            )}
            {messages.map((m) => (
              <MessageBubble
                key={m.id}
                message={m}
                isOwn={m.sender === user?.id}
                compact
                onReply={(msg) => setReplyTo({ id: msg.id, sender_name: msg.sender_name, body: msg.body, is_deleted: msg.is_deleted })}
                onEdit={(id, body) => editMessage(conversationId, id, body)}
                onDelete={(id) => deleteMessage(conversationId, id)}
                onReact={(id, emoji) => reactToMessage(conversationId, id, emoji)}
              />
            ))}
          </div>
          <MessageComposer
            compact
            participants={(conversation.participants || []).filter((p) => p.id !== user?.id)}
            replyTo={replyTo}
            onClearReply={() => setReplyTo(null)}
            onSend={handleSend}
            onTypingChange={(isTyping) => setTyping(conversationId, isTyping)}
          />
        </>
      )}
    </div>
  )
}
