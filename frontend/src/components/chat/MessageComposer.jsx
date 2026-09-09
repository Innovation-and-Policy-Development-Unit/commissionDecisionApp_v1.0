import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Paperclip, Send, X } from 'lucide-react'

const TYPING_IDLE_MS = 2000
const TRIGGER_RE = /(?:^|\s)@([\w.\-]*)$/

/** Shared composer for both the full /chat page and floating popup windows —
 * draft input with @mention autocomplete (scoped to this conversation's own
 * participants), file attachments, reply preview, and typing debounce. */
export default function MessageComposer({
  participants = [], replyTo, onClearReply, onSend, onTypingChange, compact = false,
}) {
  const { t } = useTranslation()
  const [draft, setDraft] = useState('')
  const [files, setFiles] = useState([])
  const [mentionOpen, setMentionOpen] = useState(false)
  const [mentionQuery, setMentionQuery] = useState('')
  const [atPos, setAtPos] = useState(null)
  const inputRef = useRef(null)
  const fileInputRef = useRef(null)
  const typingTimeoutRef = useRef(null)
  const wasTypingRef = useRef(false)

  useEffect(() => () => clearTimeout(typingTimeoutRef.current), [])

  const suggestions = participants.filter((p) => (
    p.name.toLowerCase().includes(mentionQuery.toLowerCase())
  )).slice(0, 6)

  const detectMention = useCallback((text, caret) => {
    const upto = text.slice(0, caret)
    const m = upto.match(TRIGGER_RE)
    if (!m) { setMentionOpen(false); return }
    setMentionQuery(m[1])
    setAtPos(upto.lastIndexOf('@'))
    setMentionOpen(true)
  }, [])

  const handleChange = (e) => {
    const value = e.target.value
    setDraft(value)
    detectMention(value, e.target.selectionStart)
    if (!wasTypingRef.current) {
      wasTypingRef.current = true
      onTypingChange?.(true)
    }
    clearTimeout(typingTimeoutRef.current)
    typingTimeoutRef.current = setTimeout(() => {
      wasTypingRef.current = false
      onTypingChange?.(false)
    }, TYPING_IDLE_MS)
  }

  const insertMention = (person) => {
    const input = inputRef.current
    const caret = input ? input.selectionStart : draft.length
    const start = atPos != null ? atPos : caret
    const token = `@[${person.name}](user:${person.id}) `
    const next = draft.slice(0, start) + token + draft.slice(caret)
    setDraft(next)
    setMentionOpen(false)
    requestAnimationFrame(() => {
      if (!input) return
      const pos = start + token.length
      input.focus()
      input.setSelectionRange(pos, pos)
    })
  }

  const handleKeyDown = (e) => {
    if (mentionOpen && suggestions.length > 0) {
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); insertMention(suggestions[0]); return }
      if (e.key === 'Escape') { e.preventDefault(); setMentionOpen(false); return }
    }
  }

  const handleFilePick = (e) => {
    setFiles((prev) => [...prev, ...Array.from(e.target.files || [])])
    e.target.value = ''
  }

  const removeFile = (idx) => setFiles((prev) => prev.filter((_, i) => i !== idx))

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!draft.trim() && files.length === 0) return
    onSend({ body: draft, files, replyToId: replyTo?.id })
    setDraft('')
    setFiles([])
    clearTimeout(typingTimeoutRef.current)
    if (wasTypingRef.current) {
      wasTypingRef.current = false
      onTypingChange?.(false)
    }
  }

  return (
    <div className="border-t border-slate-100 dark:border-slate-700 shrink-0">
      {replyTo && (
        <div className="flex items-center justify-between gap-2 px-3 py-1.5 bg-slate-50 dark:bg-slate-700/40 text-xs">
          <span className="truncate text-slate-500 dark:text-slate-400">
            <span className="font-medium">{t('chat.replying_to')} {replyTo.sender_name}: </span>
            {replyTo.is_deleted ? t('chat.deleted_message') : replyTo.body}
          </span>
          <button type="button" onClick={onClearReply} aria-label={t('chat.cancel')} className="shrink-0 p-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-600">
            <X size={12} />
          </button>
        </div>
      )}

      {files.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-3 pt-2">
          {files.map((f, i) => (
            <span key={`${f.name}-${i}`} className="flex items-center gap-1 px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-700 text-[11px] text-slate-600 dark:text-slate-300">
              {f.name}
              <button type="button" onClick={() => removeFile(i)} aria-label={t('chat.cancel')}><X size={10} /></button>
            </span>
          ))}
        </div>
      )}

      <form onSubmit={handleSubmit} className="relative flex items-center gap-1.5 p-2">
        {mentionOpen && suggestions.length > 0 && (
          <ul className="absolute bottom-full mb-1 left-2 w-56 max-h-48 overflow-auto rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-lg py-1 z-10">
            {suggestions.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); insertMention(p) }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-slate-50 dark:hover:bg-slate-700/50 text-sm"
                >
                  {p.name}
                </button>
              </li>
            ))}
          </ul>
        )}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          aria-label={t('chat.attach_file')}
          title={t('chat.attach_file')}
          className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 shrink-0"
        >
          <Paperclip size={compact ? 14 : 16} />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          hidden
          accept="image/png,image/jpeg,image/gif,image/webp,application/pdf,.doc,.docx,.xls,.xlsx,.zip"
          onChange={handleFilePick}
        />
        <input
          ref={inputRef}
          type="text"
          value={draft}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={t('chat.message_placeholder')}
          className={`flex-1 input text-sm ${compact ? 'py-1.5' : ''}`}
        />
        <button
          type="submit"
          disabled={!draft.trim() && files.length === 0}
          className={`btn btn-primary disabled:opacity-50 ${compact ? 'btn-sm px-2.5' : 'btn-sm'}`}
          aria-label={t('chat.send')}
        >
          <Send size={compact ? 14 : 16} />
        </button>
      </form>
    </div>
  )
}
