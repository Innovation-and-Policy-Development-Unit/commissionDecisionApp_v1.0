import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  Bot, ExternalLink, Loader2, MessageSquarePlus, Send, Sparkles, Trash2,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { STAFF_CHAT_SUGGESTIONS, useStaffChat } from '../../hooks/useStaffChat'
import clsx from 'clsx'

/**
 * Shared Staff Assistant UI — full page or compact floating panel.
 */
export default function StaffChatWidget({
  variant = 'page',
  enabled = true,
  showHistory = true,
}) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const chat = useStaffChat({ enabled })
  const {
    sessions,
    activeId,
    messages,
    input,
    setInput,
    loading,
    loadingSessions,
    bottomRef,
    loadSession,
    startNewChat,
    sendMessage,
    deleteSession,
  } = chat

  const isPanel = variant === 'panel'
  const suggestions = STAFF_CHAT_SUGGESTIONS

  const historySidebar = showHistory && (
    <aside
      className={clsx(
        'shrink-0 flex flex-col border-slate-100 dark:border-slate-800',
        isPanel ? 'w-full border-b max-h-28' : 'w-56 hidden md:flex flex-col card p-3 border-0',
      )}
    >
      <button
        type="button"
        onClick={startNewChat}
        className={clsx(
          'btn-gradient flex items-center justify-center gap-2',
          isPanel ? 'w-full py-1.5 text-xs' : 'w-full py-2 text-sm mb-3',
        )}
      >
        <MessageSquarePlus size={isPanel ? 14 : 16} />
        {t('staff_chat.new_chat')}
      </button>
      {!isPanel && (
        <p className="text-[10px] uppercase tracking-widest text-slate-400 mb-2 px-1">
          {t('staff_chat.history')}
        </p>
      )}
      <div
        className={clsx(
          'overflow-y-auto custom-scrollbar space-y-1',
          isPanel ? 'mt-2 flex gap-2 flex-wrap' : 'flex-1',
        )}
      >
        {loadingSessions ? (
          <p className="text-xs text-slate-400 px-2">{t('common.loading')}</p>
        ) : sessions.length === 0 ? (
          !isPanel && <p className="text-xs text-slate-400 px-2">{t('staff_chat.no_history')}</p>
        ) : (
          sessions.slice(0, isPanel ? 5 : undefined).map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => loadSession(s.id)}
              className={clsx(
                'text-left rounded-lg text-xs group flex items-center gap-1',
                isPanel
                  ? 'px-2 py-1 border border-slate-200 dark:border-slate-700 max-w-[140px] truncate'
                  : 'w-full px-2 py-2',
                activeId === s.id
                  ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-800 dark:text-primary-200'
                  : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300',
              )}
            >
              <span className="truncate font-medium">{s.title || t('staff_chat.untitled')}</span>
              {!isPanel && (
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => deleteSession(s.id, e)}
                  onKeyDown={(e) => e.key === 'Enter' && deleteSession(s.id, e)}
                  className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-500 shrink-0"
                >
                  <Trash2 size={12} />
                </span>
              )}
            </button>
          ))
        )}
      </div>
    </aside>
  )

  const chatBody = (
    <div className={clsx('flex flex-col min-h-0', isPanel ? 'flex-1' : 'flex-1 card')}>
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-slate-100 dark:border-slate-800 shrink-0">
        <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center text-indigo-600 dark:text-indigo-300">
          <Bot size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            {t('staff_chat.assistant_name')}
          </p>
          {user?.role && (
            <p className="text-[10px] text-slate-500 truncate">
              {t('staff_chat.signed_in_as', { role: user.role })}
            </p>
          )}
        </div>
        {isPanel && (
          <Link
            to="/assistant"
            className="btn-outline btn-sm p-1.5"
            title={t('staff_chat.open_full')}
          >
            <ExternalLink size={14} />
          </Link>
        )}
        {!isPanel && (
          <button type="button" className="btn-outline btn-sm md:hidden" onClick={startNewChat}>
            <MessageSquarePlus size={14} />
          </button>
        )}
      </div>

      <div
        className={clsx(
          'flex-1 overflow-y-auto custom-scrollbar p-3 space-y-3',
          isPanel ? 'min-h-0' : 'p-4 space-y-4',
        )}
      >
        {messages.length === 0 && !loading && (
          <div className={clsx('text-center', isPanel ? 'py-4' : 'py-8 max-w-lg mx-auto')}>
            <Sparkles className="mx-auto text-indigo-400 mb-2" size={isPanel ? 24 : 32} />
            <p className="text-xs text-slate-600 dark:text-slate-300 mb-3">
              {t('staff_chat.welcome_short')}
            </p>
            <div className="flex flex-wrap gap-1.5 justify-center">
              {suggestions.slice(0, isPanel ? 2 : 4).map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => sendMessage(q)}
                  className="text-[10px] px-2 py-1 rounded-full border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 text-left"
                >
                  {q.length > 48 ? `${q.slice(0, 48)}…` : q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m) => (
          <div
            key={m.id}
            className={clsx('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}
          >
            <div
              className={clsx(
                'rounded-2xl whitespace-pre-wrap leading-relaxed',
                isPanel ? 'max-w-[90%] px-3 py-2 text-xs' : 'max-w-[85%] px-4 py-2.5 text-sm',
                m.role === 'user'
                  ? 'bg-primary-600 text-white rounded-br-md'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-bl-md',
              )}
            >
              {m.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex items-center gap-2 text-xs text-indigo-600 dark:text-indigo-300">
            <Loader2 size={16} className="animate-spin shrink-0" />
            {t('staff_chat.thinking')}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <form
        className="p-2 border-t border-slate-100 dark:border-slate-800 flex gap-2 shrink-0"
        onSubmit={(e) => {
          e.preventDefault()
          sendMessage()
        }}
      >
        <input
          type="text"
          className="input flex-1 text-sm py-2"
          placeholder={t('staff_chat.placeholder')}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={loading}
          maxLength={8000}
        />
        <button
          type="submit"
          className="btn-gradient px-3 disabled:opacity-50 shrink-0"
          disabled={loading || !input.trim()}
          aria-label={t('staff_chat.send')}
        >
          <Send size={18} />
        </button>
      </form>
    </div>
  )

  if (isPanel) {
    return (
      <div className="flex flex-col h-full min-h-0 bg-white dark:bg-slate-800">
        {historySidebar}
        {chatBody}
      </div>
    )
  }

  return (
    <div className="flex flex-1 min-h-0 gap-4">
      {historySidebar}
      {chatBody}
    </div>
  )
}
