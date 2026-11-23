import { useCallback, useEffect, useState } from 'react'
import { CheckCircle2, Clock, Eye, BellRing } from 'lucide-react'
import clsx from 'clsx'
import api from '../../api/client'

// Who may see the whole list, and who may press "Remind now". The backend
// enforces both; these only decide what to draw.
const VIEW_ALL_ROLES = new Set(['psc_secretary', 'deputy_secretary', 'psc_admin', 'senior_admin_officer', 'chairperson', 'csu_manager'])
const REMIND_ROLES = new Set(['psc_secretary', 'psc_admin', 'senior_admin_officer'])

const STATUS_STYLE = {
  not_opened: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800',
  opened: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800',
  commented: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800',
  no_comments: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800',
}

const when = (iso) => (iso ? new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '')

/**
 * Review tracker for circulated draft minutes.
 * Commissioners: opening the minutes is recorded, and a button confirms
 * "read, no comments". Secretariat: a live list of who has read them.
 */
export default function MinutesReviewTracker({ minutes, role, commentCount = 0 }) {
  const [data, setData] = useState(null)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')
  const [error, setError] = useState('')

  const circulated = minutes?.status === 'circulated_to_commissioners'
  const isCommissioner = role === 'psc_commissioner'
  const canSeeAll = VIEW_ALL_ROLES.has(role)
  const visible = Boolean(minutes?.id) && (circulated || minutes?.status === 'returned') && (isCommissioner || canSeeAll)

  const load = useCallback(async () => {
    if (!visible) return
    try {
      const res = await api.get(`/minutes/${minutes.id}/review-tracker/`)
      setData(res.data)
    } catch {
      setData(null)
    }
  }, [visible, minutes?.id])

  // A Commissioner opening the circulated minutes is recorded once.
  useEffect(() => {
    if (!visible || !circulated || !isCommissioner) { load(); return }
    api.post(`/minutes/${minutes.id}/review-opened/`).catch(() => {}).finally(load)
  }, [visible, circulated, isCommissioner, minutes?.id, load])

  // A posted comment changes the Commissioner's status.
  useEffect(() => { load() }, [commentCount, load])

  if (!visible || !data) return null

  const mine = isCommissioner ? data.rows[0] : null
  const responded = (s) => s === 'commented' || s === 'no_comments'

  const confirmRead = async () => {
    setBusy(true); setError(''); setNote('')
    try {
      const res = await api.post(`/minutes/${minutes.id}/confirm-read/`)
      setNote(res.data?.detail || 'Recorded.')
      await load()
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not record this.')
    } finally { setBusy(false) }
  }

  const remind = async () => {
    setBusy(true); setError(''); setNote('')
    try {
      const res = await api.post(`/minutes/${minutes.id}/remind-commissioners/`)
      setNote(res.data.reminded ? `Reminder sent to ${res.data.reminded} Commissioner(s).` : 'Everyone has already responded.')
      await load()
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not send reminders.')
    } finally { setBusy(false) }
  }

  return (
    <div className="mt-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <p className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
          <Eye size={16} className="text-cyan-600" /> Who has read the draft minutes
        </p>
        <p className={clsx('text-xs font-semibold flex items-center gap-1', data.overdue ? 'text-red-600' : 'text-slate-500')}>
          <Clock size={13} />
          {data.responded} of {data.total} responded{data.overdue ? ' · review period has ended' : ''}
        </p>
      </div>

      {isCommissioner && mine && (
        <div className="flex flex-wrap items-center gap-3">
          <span className={clsx('text-xs font-semibold px-2 py-1 rounded-full border', STATUS_STYLE[mine.status])}>
            Your status: {mine.status_label}
          </span>
          {circulated && !responded(mine.status) && (
            <button onClick={confirmRead} disabled={busy} className="btn-secondary px-3 py-1.5 text-sm inline-flex items-center gap-1.5 disabled:opacity-60">
              <CheckCircle2 size={14} /> I have read these minutes. No comments.
            </button>
          )}
          {circulated && !responded(mine.status) && (
            <span className="text-xs text-slate-500">Or add a comment below. Either one counts as your response.</span>
          )}
        </div>
      )}

      {canSeeAll && (
        <>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500 border-b border-slate-100 dark:border-slate-700">
                <th className="py-1 pr-2">Commissioner</th><th className="py-1 pr-2">Status</th>
                <th className="py-1 pr-2">Opened</th><th className="py-1">Last reminded</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map(r => (
                <tr key={r.user_id} className="border-b border-slate-50 dark:border-slate-700/50 last:border-0">
                  <td className="py-1.5 pr-2 font-medium text-slate-700 dark:text-slate-200">{r.name}</td>
                  <td className="py-1.5 pr-2">
                    <span className={clsx('text-xs font-semibold px-2 py-0.5 rounded-full border', STATUS_STYLE[r.status])}>{r.status_label}</span>
                  </td>
                  <td className="py-1.5 pr-2 text-slate-500">{when(r.opened_at) || '—'}</td>
                  <td className="py-1.5 text-slate-500">{when(r.last_reminded_at) || '—'}</td>
                </tr>
              ))}
              {data.rows.length === 0 && (
                <tr><td colSpan={4} className="py-2 text-slate-500 italic">No active Commissioners.</td></tr>
              )}
            </tbody>
          </table>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            {REMIND_ROLES.has(role) && circulated && data.outstanding > 0 && (
              <button onClick={remind} disabled={busy} className="btn-secondary px-3 py-1.5 text-sm inline-flex items-center gap-1.5 disabled:opacity-60">
                <BellRing size={14} /> Remind the {data.outstanding} outstanding now
              </button>
            )}
            <span className="text-xs text-slate-500">
              A reminder also goes each morning to anyone who has not responded. Signing is never blocked: you decide whether to go ahead.
            </span>
          </div>
        </>
      )}
      {note && <p className="mt-2 text-xs text-emerald-600">{note}</p>}
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  )
}
