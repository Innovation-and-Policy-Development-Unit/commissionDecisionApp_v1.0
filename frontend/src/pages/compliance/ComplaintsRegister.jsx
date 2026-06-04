import { useState, useEffect, useCallback } from 'react'
import { Inbox, RefreshCw, Check, X } from 'lucide-react'
import api from '../../api/client'
import PageHeader from '../../components/shared/PageHeader'
import { CASE_FAMILIES } from '../../constants/compliance'

const STATUS_COLORS = {
  received:     'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  under_review: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  accepted:     'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  converted:    'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  rejected:     'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
}

export default function ComplaintsRegister() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState(null)
  const [acceptFor, setAcceptFor] = useState(null)
  const [family, setFamily] = useState('employee_disciplinary')

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const res = await api.get('/compliance/complaints/')
      setItems(res.data?.results ?? res.data ?? [])
    } catch (e) {
      setError(e.response?.data?.detail || 'Could not load the complaints register.')
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const confirmAccept = async () => {
    const c = acceptFor
    setBusyId(c.id)
    try {
      await api.post(`/compliance/complaints/${c.id}/accept/`, { case_family: family })
      setAcceptFor(null)
      await load()
    } catch (e) {
      alert(e.response?.data?.detail || 'Could not accept complaint.')
    } finally { setBusyId(null) }
  }

  const reject = async (c) => {
    const reason = window.prompt('Reason for rejecting this complaint (shown to the ministry):', '')
    if (reason === null) return
    setBusyId(c.id)
    try {
      await api.post(`/compliance/complaints/${c.id}/reject/`, { reason })
      await load()
    } catch (e) {
      alert(e.response?.data?.detail || 'Could not reject complaint.')
    } finally { setBusyId(null) }
  }

  return (
    <div>
      <PageHeader
        title="Complaints Register"
        subtitle="Complaints lodged by ministries — triage into a case or reject with a reason"
        action={
          <button type="button" className="btn-outline flex items-center gap-2 py-2 px-3 text-sm" onClick={load} disabled={loading}>
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        }
      />
      {error && <div className="mb-4 rounded-lg bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-300">{error}</div>}

      {loading ? (
        <div className="py-16 text-center text-slate-400">Loading…</div>
      ) : items.length === 0 ? (
        <div className="py-16 text-center text-slate-400"><Inbox size={40} className="mx-auto mb-3 opacity-50" />No complaints lodged.</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Reference</th>
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Subject</th>
                <th className="px-4 py-3">Ministry</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Triage</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
              {items.map((c) => {
                const open = c.status === 'received' || c.status === 'under_review'
                return (
                  <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="px-4 py-3 font-mono text-xs text-slate-600 dark:text-slate-300">{c.reference_number}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-800 dark:text-slate-100">{c.title}</div>
                      {c.description && <div className="text-xs text-slate-400 line-clamp-2 max-w-md">{c.description}</div>}
                    </td>
                    <td className="px-4 py-3">{c.subject_name || '—'}</td>
                    <td className="px-4 py-3 text-slate-500">{c.ministry_name || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[c.status] || ''}`}>
                        {c.status_display}
                      </span>
                      {c.case_reference && <div className="mt-0.5 text-[11px] text-slate-400 font-mono">{c.case_reference}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        {open ? (
                          <>
                            <button disabled={busyId === c.id} onClick={() => { setAcceptFor(c); setFamily('employee_disciplinary') }}
                              className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50">
                              <Check size={13} /> Accept
                            </button>
                            <button disabled={busyId === c.id} onClick={() => reject(c)}
                              className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700 disabled:opacity-50">
                              <X size={13} /> Reject
                            </button>
                          </>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {acceptFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setAcceptFor(null)}>
          <div className="w-full max-w-md rounded-xl bg-white dark:bg-slate-800 p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold text-slate-800 dark:text-slate-100">Open a case</h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              From complaint <span className="font-mono">{acceptFor.reference_number}</span> — “{acceptFor.title}”.
            </p>
            <label className="mt-4 block text-sm font-medium">Case family</label>
            <select className="form-input w-full mt-1" value={family} onChange={(e) => setFamily(e.target.value)}>
              {CASE_FAMILIES.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
            <div className="mt-5 flex justify-end gap-2">
              <button className="btn-outline" onClick={() => setAcceptFor(null)}>Cancel</button>
              <button className="btn-primary" disabled={busyId === acceptFor.id} onClick={confirmAccept}>Open case</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
