import { useCallback, useEffect, useRef, useState } from 'react'

function read(key) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function hasContent(value) {
  return Object.values(value || {}).some(v => (Array.isArray(v) ? v.length > 0 : String(v ?? '').trim() !== ''))
}

/**
 * Autosaves a form's values to localStorage so a dropped connection, closed tab
 * or accidental navigation doesn't lose a half-written submission. Nothing is
 * restored silently: if a draft exists on mount the caller shows a banner and
 * decides via `restore()` / `discard()`. Call `clear()` once the form is submitted.
 *
 * Drafts hold form text only (never files) and live in this browser only.
 */
export function useDraftAutosave(key, values, setValues, { enabled = true, delay = 800 } = {}) {
  const [draft, setDraft] = useState(() => (enabled && key ? read(key) : null))
  const [savedAt, setSavedAt] = useState(null)
  // Don't overwrite a stored draft with the empty form before the user has chosen.
  const decided = useRef(!draft)

  useEffect(() => {
    if (!enabled || !key || !decided.current) return undefined
    if (!hasContent(values)) return undefined
    const id = setTimeout(() => {
      try {
        localStorage.setItem(key, JSON.stringify({ values, savedAt: Date.now() }))
        setSavedAt(Date.now())
      } catch {
        // storage full or blocked — autosave is best-effort
      }
    }, delay)
    return () => clearTimeout(id)
  }, [key, values, enabled, delay])

  const clear = useCallback(() => {
    decided.current = false
    try { localStorage.removeItem(key) } catch { /* ignore */ }
    setDraft(null)
  }, [key])

  const restore = useCallback(() => {
    if (draft?.values) setValues(prev => ({ ...prev, ...draft.values }))
    decided.current = true
    setDraft(null)
  }, [draft, setValues])

  const discard = useCallback(() => {
    try { localStorage.removeItem(key) } catch { /* ignore */ }
    decided.current = true
    setDraft(null)
  }, [key])

  return { draft, savedAt, restore, discard, clear }
}
