import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Paperclip, Send, Smile, X, FileText } from 'lucide-react'
import EmojiPicker from './EmojiPicker'
import { ACCEPT, MAX_FILES, fileProblem } from './chatMedia'

const TYPING_IDLE_MS = 2000
const TRIGGER_RE = /(?:^|\s)@([\w.\-]*)$/

function Thumb({ file, onRemove }) {
  const isImage = file.type.startsWith('image/')
  const url = useMemo(() => (isImage ? URL.createObjectURL(file) : null), [file, isImage])
  useEffect(() => () => { if (url) URL.revokeObjectURL(url) }, [url])
  return (
    <div className="relative">
      {isImage
        ? <img src={url} alt={file.name} className="h-16 w-16 rounded-lg object-cover border border-slate-200 dark:border-slate-600" />
        : (
          <div className="h-16 w-24 rounded-lg bg-slate-100 dark:bg-slate-700 text-[10px] text-slate-600 dark:text-slate-300 p-1.5 flex flex-col justify-between">
            <FileText size={14} /><span className="truncate">{file.name}</span>
          </div>
        )}
      <button type="button" onClick={onRemove} aria-label="Remove" className="absolute -top-1.5 -right-1.5 p-0.5 rounded-full bg-slate-700 text-white"><X size={10} /></button>
    </div>
  )
}

/** Shared composer for both the full /chat page and floating popup windows — multi-line draft
 * (Enter sends, Shift+Enter is a new line), @mention autocomplete (this conversation's
 * participants), file attachments by button, paste (screenshots) or drag-and-drop with
 * thumbnails and upload progress, an emoji picker, reply preview, and typing debounce. */
export default function MessageComposer({
  participants = [], replyTo, onClearReply, onSend, onTypingChange, compact = false,
}) {
  const { t } = useTranslation()
  const [draft, setDraft] = useState('')
  const [files, setFiles] = useState([])
  const [problem, setProblem] = useState('')
  const [progress, setProgress] = useState(null) // null = not uploading, else 0..100
  const [dragging, setDragging] = useState(false)
  const [emojiOpen, setEmojiOpen] = useState(false)
  const [mentionOpen, setMentionOpen] = useState(false)
  const [mentionQuery, setMentionQuery] = useState('')
  const [atPos, setAtPos] = useState(null)
  const rootRef = useRef(null)
  const inputRef = useRef(null)
  const fileInputRef = useRef(null)
  const typingTimeoutRef = useRef(null)
  const wasTypingRef = useRef(false)
  const uploading = progress !== null

  useEffect(() => () => clearTimeout(typingTimeoutRef.current), [])

  // Grow the box with its text, up to about six lines.
  useEffect(() => {
    const el = inputRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 132)}px`
  }, [draft])

  const addFiles = useCallback((incoming) => {
    const list = Array.from(incoming || [])
    if (!list.length) return
    const bad = list.map(fileProblem).find(Boolean)
    const good = list.filter((f) => !fileProblem(f))
    setFiles((prev) => {
      const next = [...prev, ...good]
      if (next.length > MAX_FILES) {
        setProblem(`You can send up to ${MAX_FILES} files at once.`)
        return next.slice(0, MAX_FILES)
      }
      return next
    })
    if (bad) setProblem(bad)
    else if (good.length) setProblem('')
  }, [])

  // Drag files anywhere over the conversation pane (or just the composer if it has no pane marker).
  useEffect(() => {
    const zone = rootRef.current?.closest('[data-chat-drop]') || rootRef.current
    if (!zone) return undefined
    const hasFiles = (e) => Array.from(e.dataTransfer?.types || []).includes('Files')
    let depth = 0
    const enter = (e) => { if (hasFiles(e)) { depth += 1; setDragging(true) } }
    const over = (e) => { if (hasFiles(e)) e.preventDefault() }
    const leave = () => { depth = Math.max(0, depth - 1); if (!depth) setDragging(false) }
    const drop = (e) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      depth = 0
      setDragging(false)
      addFiles(e.dataTransfer.files)
    }
    zone.addEventListener('dragenter', enter)
    zone.addEventListener('dragover', over)
    zone.addEventListener('dragleave', leave)
    zone.addEventListener('drop', drop)
    return () => {
      zone.removeEventListener('dragenter', enter)
      zone.removeEventListener('dragover', over)
      zone.removeEventListener('dragleave', leave)
      zone.removeEventListener('drop', drop)
    }
  }, [addFiles])

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

  const insertAtCaret = (text) => {
    const input = inputRef.current
    const start = input ? input.selectionStart : draft.length
    const end = input ? input.selectionEnd : draft.length
    setDraft(draft.slice(0, start) + text + draft.slice(end))
    requestAnimationFrame(() => {
      if (!input) return
      input.focus()
      const pos = start + text.length
      input.setSelectionRange(pos, pos)
    })
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

  const submit = async () => {
    if (uploading || (!draft.trim() && files.length === 0)) return
    const sending = { body: draft, files, replyToId: replyTo?.id }
    setProblem('')
    clearTimeout(typingTimeoutRef.current)
    if (wasTypingRef.current) {
      wasTypingRef.current = false
      onTypingChange?.(false)
    }
    if (files.length === 0) {
      onSend(sending)
      setDraft('')
      return
    }
    // With files, keep everything on screen until the upload succeeds, so a failure loses nothing.
    setProgress(0)
    try {
      await onSend({ ...sending, onProgress: setProgress })
      setDraft('')
      setFiles([])
    } catch (err) {
      const detail = err?.response?.data?.files || err?.response?.data?.detail
      setProblem(Array.isArray(detail) ? detail[0] : detail || t('chat.upload_failed', 'The files could not be sent. Check your connection and try again.'))
    } finally {
      setProgress(null)
    }
  }

  const handleKeyDown = (e) => {
    if (mentionOpen && suggestions.length > 0) {
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); insertMention(suggestions[0]); return }
      if (e.key === 'Escape') { e.preventDefault(); setMentionOpen(false); return }
    }
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      submit()
    }
  }

  // Pasting a screenshot (or copied image file) attaches it; pasted text behaves as normal.
  const handlePaste = (e) => {
    const pasted = Array.from(e.clipboardData?.files || [])
    if (!pasted.length) return
    e.preventDefault()
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    addFiles(pasted.map((f, i) => (
      f.name && f.name !== 'image.png' ? f : new File([f], `screenshot-${stamp}${i ? `-${i + 1}` : ''}.${(f.type.split('/')[1] || 'png').replace('jpeg', 'jpg')}`, { type: f.type })
    )))
  }

  const handleFilePick = (e) => {
    addFiles(e.target.files)
    e.target.value = ''
  }

  const canSend = !uploading && (draft.trim() !== '' || files.length > 0)

  return (
    <div ref={rootRef} className="border-t border-slate-100 dark:border-slate-700 shrink-0 relative">
      {dragging && (
        <div className="px-3 py-2 text-xs text-center text-primary-700 dark:text-primary-300 bg-primary-50 dark:bg-primary-900/30 border-b border-dashed border-primary-400">
          {t('chat.drop_files', 'Drop files to attach them')}
        </div>
      )}
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
        <div className="flex flex-wrap gap-2 px-3 pt-2">
          {files.map((f, i) => (
            <Thumb key={`${f.name}-${f.size}-${i}`} file={f} onRemove={() => !uploading && setFiles((prev) => prev.filter((_, j) => j !== i))} />
          ))}
        </div>
      )}

      {uploading && (
        <div className="px-3 pt-2" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
            <div className="h-full bg-primary-600 transition-all" style={{ width: `${progress}%` }} />
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">{t('chat.sending', 'Sending…')} {progress}%</p>
        </div>
      )}
      {problem && <p className="px-3 pt-1.5 text-xs text-amber-700 dark:text-amber-300" role="alert">{problem}</p>}

      <div className="relative flex items-end gap-1.5 p-2">
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
        {emojiOpen && (
          <div className="absolute bottom-full mb-1 left-2 z-10">
            <EmojiPicker onPick={(e) => { insertAtCaret(e) }} />
          </div>
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
        <button
          type="button"
          onClick={() => setEmojiOpen((v) => !v)}
          aria-label={t('chat.emoji', 'Emoji')}
          title={t('chat.emoji', 'Emoji')}
          className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 shrink-0"
        >
          <Smile size={compact ? 14 : 16} />
        </button>
        <input ref={fileInputRef} type="file" multiple hidden accept={ACCEPT} onChange={handleFilePick} />
        <textarea
          ref={inputRef}
          rows={1}
          value={draft}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onFocus={() => setEmojiOpen(false)}
          placeholder={t('chat.message_placeholder')}
          className={`flex-1 input text-sm resize-none leading-snug ${compact ? 'py-1.5' : ''}`}
        />
        <button
          type="button"
          onClick={submit}
          disabled={!canSend}
          className={`btn btn-primary disabled:opacity-50 ${compact ? 'btn-sm px-2.5' : 'btn-sm'}`}
          aria-label={t('chat.send')}
        >
          <Send size={compact ? 14 : 16} />
        </button>
      </div>
    </div>
  )
}
