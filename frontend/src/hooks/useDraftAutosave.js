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
  const [draft, setDraft] = useState(null)
  const [savedAt, setSavedAt] = useState(null)
  // Don't overwrite a stored draft with the form before the user has chosen.
  const decided = useRef(false)
  const valuesRef = useRef(values)
  valuesRef.current = values

  // Look for a stored draft whenever the key or `enabled` changes — so a form that
  // loads its values from the server first (enabled flips on later) still gets one.
  // A draft identical to what is already on screen is stale and silently dropped.
  useEffect(() => {
    if (!enabled || !key) {
      decided.current = false
      setDraft(null)
      return
    }
    const stored = read(key)
    const same = stored && JSON.stringify(stored.values) === JSON.stringify(valuesRef.current)
    if (stored && !same) {
      decided.current = false
      setDraft(stored)
    } else {
      decided.current = true
      setDraft(null)
    }
  }, [key, enabled])

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

  // The values were saved to the server: drop the stored copy but keep autosaving
  // (clear() is for a form that is finished and about to close).
  const markSaved = useCallback(() => {
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

  return { draft, savedAt, restore, discard, clear, markSaved }
}
