/**
 * CaseChatPanel.jsx
 * "Ask about this paper": a private Q&A thread with the AI about one submission.
 * Answers cite their sources and are advisory only.
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import { MessageSquare, Send, Trash2 } from 'lucide-react'
import api from '../../api/client'
import { useToast } from '../../context/ToastContext'
import BaseButton from '../shared/BaseButton'
import BaseSpinner from '../shared/BaseSpinner'

const MAX_LEN = 2000

const SUGGESTIONS = [
  'Summarise this paper in five lines.',
  'What is missing or inconsistent?',
  'What are the risks of approving this?',
]

export default function CaseChatPanel({ submissionId, draft, onDraftUsed }) {
  const toast = useToast()
  const [messages, setMessages] = useState([])
  const [disclaimer, setDisclaimer] = useState('')
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const endRef = useRef(null)
  const url = `/submissions/${submissionId}/case-chat/`

  const load = useCallback(async () => {
    try {
      const res = await api.get(url)
      setMessages(res.data.messages || [])
      setDisclaimer(res.data.disclaimer || '')
    } catch {
      /* the panel stays empty; sending will surface any real error */
    } finally {
      setLoaded(true)
    }
  }, [url])

  useEffect(() => { load() }, [load])

  // A question picked on the review card lands in the box, ready to send.
  useEffect(() => {
    if (draft) {
      setText(draft)
      onDraftUsed?.()
    }
  }, [draft, onDraftUsed])

  useEffect(() => { endRef.current?.scrollIntoView?.({ block: 'nearest' }) }, [messages, sending])

  const send = async (message) => {
    const q = (message ?? text).trim()
    if (!q || sending) return
    setSending(true)
    try {
      const res = await api.post(url, { message: q })
      setMessages(prev => [...prev, ...(res.data.messages || [])])
      setDisclaimer(res.data.disclaimer || disclaimer)
      setText('')
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'The assistant could not answer just now.')
    } finally {
      setSending(false)
    }
  }

  const clear = async () => {
    try {
      await api.delete(url)
      setMessages([])
    } catch {
      toast.error('Could not clear the conversation.')
    }
  }

  return (
    <div className="card p-4 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <MessageSquare size={20} className="text-primary-600" />
        <span className="font-bold text-base text-slate-800 dark:text-slate-100">Ask about this paper</span>
        {messages.length > 0 && (
          <BaseButton variant="ghost" size="sm" className="ml-auto" icon={<Trash2 size={14} />} onClick={clear}>
            Clear
          </BaseButton>
        )}
      </div>
      <p className="text-xs text-amber-700 dark:text-amber-300">
        {disclaimer || 'AI draft — verify against the documents before relying on it.'} Only you see your questions.
      </p>

      <div className="flex flex-col gap-2 max-h-96 overflow-y-auto" role="log" aria-live="polite" aria-label="Conversation about this paper">
        {!loaded && <BaseSpinner size="sm" label="Loading conversation" />}
        {loaded && messages.length === 0 && (
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map(s => (
              <button
                key={s} type="button" disabled={sending}
                onClick={() => send(s)}
                className="text-xs rounded-full border border-slate-300 dark:border-slate-600 px-3 py-1 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50"
              >
                {s}
              </button>
            ))}
          </div>
        )}
        {messages.map(m => (
          <div
            key={m.id}
            className={
              m.role === 'user'
                ? 'self-end max-w-[85%] rounded-lg bg-primary-600 text-white px-3 py-2 text-sm whitespace-pre-wrap'
                : 'self-start max-w-[92%] rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-100 px-3 py-2 text-sm whitespace-pre-wrap'
            }
          >
            {m.content}
          </div>
        ))}
        {sending && <div className="self-start text-sm text-slate-500 flex items-center gap-2"><BaseSpinner size="sm" label="" /> Reading the paper…</div>}
        <div ref={endRef} />
      </div>

      <form
        className="flex items-end gap-2"
        onSubmit={e => { e.preventDefault(); send() }}
      >
        <label htmlFor={`case-chat-${submissionId}`} className="sr-only">Your question about this paper</label>
        <textarea
          id={`case-chat-${submissionId}`}
          value={text}
          onChange={e => setText(e.target.value.slice(0, MAX_LEN))}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
          rows={2}
          placeholder="Ask about the form, the documents, the risks…"
          className="flex-1 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
        />
        <BaseButton type="submit" variant="primary" disabled={sending || !text.trim()} icon={<Send size={15} />}>
          Ask
        </BaseButton>
      </form>
    </div>
  )
}
