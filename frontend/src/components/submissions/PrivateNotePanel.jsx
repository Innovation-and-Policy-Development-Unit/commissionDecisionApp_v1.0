import { useEffect, useState, useCallback, useRef } from 'react'
import { Lock } from 'lucide-react'
import api from '../../api/client'

/**
 * A Commission member's own prep notes on a submission — GET/PUT
 * /submissions/{id}/my-note/, always scoped server-side to the logged-in
 * user. Strictly private: nobody else, PSC Admin included, can read this
 * through the API. Auto-saves shortly after the user stops typing.
 *
 * Reused on the submission detail page and in the Sitting Pack so a
 * Commissioner's pre-meeting notes are right there on the sitting day.
 */
export default function PrivateNotePanel({ submissionId }) {
  const [body, setBody] = useState('')
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const saveTimer = useRef(null)

  useEffect(() => {
    let cancelled = false
    setLoaded(false)
    api.get(`/submissions/${submissionId}/my-note/`)
      .then(r => { if (!cancelled) setBody(r.data.body || '') })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoaded(true) })
    return () => { cancelled = true }
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
      <textarea
        className="input min-h-[100px] text-sm w-full"
        value={body}
        onChange={onChange}
        placeholder="Jot down questions or points to raise during the sitting…"
      />
    </div>
  )
}
