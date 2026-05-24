import { useCallback, useEffect, useState } from 'react'
import { Mail, Loader2, Send, RefreshCw } from 'lucide-react'
import api from '../../api/client'

export default function DeadlineReminderDrafts({ submissionId }) {
  const [drafts, setDrafts] = useState([])
  const [loading, setLoading] = useState(true)
  const [sendingId, setSendingId] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get(`/submissions/${submissionId}/deadline-reminder-drafts/`)
      setDrafts(res.data || [])
    } catch {
      setDrafts([])
    } finally {
      setLoading(false)
    }
  }, [submissionId])

  useEffect(() => { load() }, [load])

  const sendDraft = async (id) => {
    setSendingId(id)
    try {
      await api.post(`/deadline-reminder-drafts/${id}/send/`)
      await load()
    } finally {
      setSendingId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-400 py-2">
        <Loader2 size={16} className="animate-spin" /> Loading reminder drafts…
      </div>
    )
  }

  if (!drafts.length) {
    return (
      <p className="text-sm text-slate-400 dark:text-slate-500 py-2">
        No AI-drafted deadline reminders for this case yet. The system drafts them automatically when the assessment deadline is within 5 days.
      </p>
    )
  }

  return (
    <ul className="space-y-3">
      {drafts.map(d => (
        <li key={d.id} className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 bg-slate-50/50 dark:bg-slate-800/30">
          <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
              <Mail size={14} className="text-primary-500" />
              {d.recipient_name}
              <span className="text-xs font-normal text-slate-500">({d.recipient_role})</span>
            </div>
            <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
              d.status === 'sent' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
            }`}>
              {d.status}
            </span>
          </div>
          <p className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">{d.subject}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 whitespace-pre-wrap line-clamp-4 mb-2">{d.body}</p>
          {(d.subject_bi || d.body_bi) && (
            <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-600 space-y-1">
              <p className="text-[10px] font-semibold uppercase text-amber-700 dark:text-amber-300">AI draft — verify (Bislama)</p>
              {d.subject_bi && <p className="text-xs font-medium text-slate-700 dark:text-slate-300">{d.subject_bi}</p>}
              {d.body_bi && <p className="text-xs text-slate-500 dark:text-slate-400 whitespace-pre-wrap line-clamp-4">{d.body_bi}</p>}
            </div>
          )}
          {d.outstanding_summary && (
            <p className="text-[11px] text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-900/20 rounded px-2 py-1 mb-2">
              Outstanding: {d.outstanding_summary}
            </p>
          )}
          {d.status === 'draft' && (
            <button
              type="button"
              onClick={() => sendDraft(d.id)}
              disabled={sendingId === d.id}
              className="btn-secondary btn-sm inline-flex items-center gap-1"
            >
              {sendingId === d.id ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
              Send email
            </button>
          )}
        </li>
      ))}
      <button type="button" onClick={load} className="text-xs font-bold text-slate-500 hover:text-slate-700 inline-flex items-center gap-1">
        <RefreshCw size={12} /> Refresh
      </button>
    </ul>
  )
}
