import { useEffect, useRef, useState, useCallback } from 'react'
import { suggestMentions } from '../../api/comments'

// Matches the in-progress @query immediately before the caret (no spaces).
const TRIGGER_RE = /(?:^|\s)@([\w.\-]*)$/

function initials(name) {
  return (name || '?').split(' ').filter(Boolean).slice(0, 2).map((s) => s[0]).join('').toUpperCase()
}

/**
 * Textarea with @mention autocomplete. Inserts @[Name](user:ID) tokens that the
 * backend (tracker/mentions.py) parses. Suggestions are scoped to users who can
 * access `target` (RBAC + ministry firewall enforced server-side).
 */
export default function MentionInput({
  value,
  onChange,
  target,
  placeholder = 'Add a comment…',
  rows = 3,
  onSubmit,
  autoFocus = false,
  className = '',
}) {
  const taRef = useRef(null)
  const [open, setOpen] = useState(false)
  const [suggestions, setSuggestions] = useState([])
  const [active, setActive] = useState(0)
  const [atPos, setAtPos] = useState(null)
  const debounceRef = useRef(null)

  const closeMenu = useCallback(() => {
    setOpen(false)
    setSuggestions([])
    setAtPos(null)
  }, [])

  const detectTrigger = useCallback((text, caret) => {
    const upto = text.slice(0, caret)
    const m = upto.match(TRIGGER_RE)
    if (!m) {
      closeMenu()
      return
    }
    const query = m[1]
    setAtPos(upto.lastIndexOf('@'))
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await suggestMentions(target, query)
        setSuggestions(res)
        setActive(0)
        setOpen(res.length > 0)
      } catch {
        closeMenu()
      }
    }, 150)
  }, [target, closeMenu])

  const handleChange = (e) => {
    const text = e.target.value
    onChange(text)
    detectTrigger(text, e.target.selectionStart)
  }

  const insertMention = (user) => {
    const ta = taRef.current
    const caret = ta ? ta.selectionStart : value.length
    const start = atPos != null ? atPos : caret
    const token = `@[${user.name}](user:${user.id}) `
    const next = value.slice(0, start) + token + value.slice(caret)
    onChange(next)
    closeMenu()
    // restore caret after the inserted token
    requestAnimationFrame(() => {
      if (!ta) return
      const pos = start + token.length
      ta.focus()
      ta.setSelectionRange(pos, pos)
    })
  }

  const handleKeyDown = (e) => {
    if (open && suggestions.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => (i + 1) % suggestions.length); return }
      if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => (i - 1 + suggestions.length) % suggestions.length); return }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); insertMention(suggestions[active]); return }
      if (e.key === 'Escape') { e.preventDefault(); closeMenu(); return }
    }
    if (onSubmit && (e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      onSubmit()
    }
  }

  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current) }, [])

  return (
    <div className="relative">
      <textarea
        ref={taRef}
        className={`input w-full text-sm ${className}`}
        rows={rows}
        placeholder={placeholder}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={() => setTimeout(closeMenu, 150)}
        autoFocus={autoFocus}
      />
      {open && suggestions.length > 0 && (
        <ul className="absolute z-30 left-0 right-0 mt-1 max-h-60 overflow-auto rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-lg py-1">
          {suggestions.map((u, i) => (
            <li key={u.id}>
              <button
                type="button"
                className={`w-full flex items-center gap-2 px-3 py-1.5 text-left ${i === active ? 'bg-primary-50 dark:bg-primary-900/30' : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'}`}
                onMouseDown={(e) => { e.preventDefault(); insertMention(u) }}
                onMouseEnter={() => setActive(i)}
              >
                <span className="w-6 h-6 shrink-0 rounded-full bg-primary-100 text-primary-700 dark:bg-primary-900/50 dark:text-primary-200 flex items-center justify-center text-[10px] font-semibold overflow-hidden">
                  {u.picture ? <img src={u.picture} alt="" className="w-full h-full object-cover" /> : initials(u.name)}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm text-slate-800 dark:text-slate-100 truncate">{u.name}</span>
                  {u.role_label && <span className="block text-[11px] text-slate-400 truncate">{u.role_label}</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
