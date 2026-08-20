import { useEffect, useState, useCallback, useRef } from 'react'
import { Lock } from 'lucide-react'
import api from '../../api/client'

/**
 * A Commission member's own prep notes on a submission — GET/PUT
 * /submissions/{id}/my-note/, always scoped server-side to the logged-in
 * user. Strictly private: nobody else, PSC Admin included, can read this
 * through the API. Auto-saves shortly after the user stops typing.
 *
 * Reused on the submission detail page, in the Sitting Pack, and in the
 * consolidated "My Notes" agenda review page.
 *
 * Props:
 *   submissionId  – required
 *   initialBody   – skips the initial GET when the caller already has the
 *                   note body on hand (the consolidated My Notes page fetches
 *                   every item's note in one call) — avoids one request per
 *                   item and the loading flash.
 *   compact       – renders just the textarea + save indicator, no card
 *                   wrapper or "My Notes" heading, for embedding inside a
 *                   page/list that already provides its own heading.
 */
export default function PrivateNotePanel({ submissionId, initialBody, compact = false }) {
  const [body, setBody] = useState(initialBody ?? '')
  const [loaded, setLoaded] = useState(initialBody !== undefined)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const saveTimer = useRef(null)

  useEffect(() => {
    if (initialBody !== undefined) return undefined
    let cancelled = false
    setLoaded(false)
    api.get(`/submissions/${submissionId}/my-note/`)
      .then(r => { if (!cancelled) setBody(r.data.body || '') })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoaded(true) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initialBody is only read on mount
  }, [submissionId])

  useEffect(() => () => clearTimeout(saveTimer.current), [])

  const save = useCallback(async (value) => {
    setSaving(true)
    try {
      await api.put(`/submissions/${submissionId}/my-note/`, { body: value })
      setSaved(true)
    } catch {
      // Not critical — the next edit will retry the save.
    } finally {
      setSaving(false)
    }
  }, [submissionId])

  const onChange = (e) => {
    const value = e.target.value
    setBody(value)
    setSaved(false)
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => save(value), 1000)
  }

  if (!loaded) return null

  // A <textarea>'s scrolled-off content doesn't reliably print past its
  // visible height in most browsers — a note longer than the box would
  // silently get cut off in the printed/exported output. Print a plain,
  // unclipped text block instead and hide the textarea for print.
  const textarea = (
    <textarea
      className="input min-h-[100px] text-sm w-full print:hidden"
      value={body}
      onChange={onChange}
      placeholder="Jot down questions or points to raise during the sitting…"
    />
  )
  const printBody = (
    <p className="hidden print:block text-sm text-black whitespace-pre-wrap">
      {body.trim() || '—'}
    </p>
  )

  if (compact) {
    return (
      <div>
        <div className="flex items-center justify-between mb-1 print:hidden">
          <span className="text-[11px] text-slate-400 dark:text-slate-500">
            Private to you — not visible to other Commission members or staff.
          </span>
          <span className="text-[11px] text-slate-400">
            {saving ? 'Saving…' : saved ? 'Saved' : ''}
          </span>
        </div>
        {textarea}
        {printBody}
      </div>
    )
  }

  return (
    <div className="card card-compact">
      <div className="flex items-center gap-2 mb-1">
        <Lock size={13} className="text-slate-400" />
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">My Notes</h3>
        <span className="text-[11px] text-slate-400 ml-auto">
          {saving ? 'Saving…' : saved ? 'Saved' : ''}
        </span>
      </div>
      <p className="text-xs text-slate-400 dark:text-slate-500 mb-2">
        Private to you — not visible to other Commission members or staff.
      </p>
      {textarea}
      {printBody}
    </div>
  )
}
