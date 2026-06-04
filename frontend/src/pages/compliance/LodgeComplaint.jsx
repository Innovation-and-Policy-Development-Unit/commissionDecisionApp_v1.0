import { useState, useEffect, useCallback } from 'react'
import { Megaphone, Send, RefreshCw } from 'lucide-react'
import api from '../../api/client'
import PageHeader from '../../components/shared/PageHeader'

const STATUS_COLORS = {
  received:     'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  under_review: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  accepted:     'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  converted:    'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  rejected:     'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
}

const EMPTY = { title: '', description: '', subject_name: '', subject_position: '', subject_ministry: '' }

export default function LodgeComplaint() {
  const [form, setForm] = useState(EMPTY)
  const [mine, setMine] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/compliance/complaints/')
      setMine(res.data?.results ?? res.data ?? [])
    } catch { /* ignore */ } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const submit = async (e) => {
    e.preventDefault()
    if (!form.title.trim()) { setError('A title is required.'); return }
    setSaving(true); setError(''); setOk('')
    try {
      await api.post('/compliance/complaints/', form)
      setOk('Complaint lodged with the Compliance unit. You will see its status below.')
      setForm(EMPTY)
      await load()
    } catch (e) {
      setError(e.response?.data?.detail || 'Could not lodge the complaint.')
    } finally { setSaving(false) }
  }

  return (
    <div>
      <PageHeader title="Lodge a Complaint" subtitle="Refer a conduct or performance concern to the OPSC Compliance unit" />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <form onSubmit={submit} className="space-y-4">
          {error && <div className="rounded-lg bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-300">{error}</div>}
          {ok && <div className="rounded-lg bg-emerald-50 dark:bg-emerald-900/20 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">{ok}</div>}

          <div>
            <label className="block text-sm font-medium mb-1">Complaint title *</label>
            <input className="form-input w-full" value={form.title} onChange={set('title')} placeholder="e.g. Repeated unexplained absence" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Details</label>
            <textarea className="form-input w-full" rows={5} value={form.description} onChange={set('description')}
              placeholder="Describe the conduct or performance concern, dates, and any context." />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Subject name</label>
              <input className="form-input w-full" value={form.subject_name} onChange={set('subject_name')} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Subject position</label>
              <input className="form-input w-full" value={form.subject_position} onChange={set('subject_position')} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Subject ministry / agency</label>
            <input className="form-input w-full" value={form.subject_ministry} onChange={set('subject_ministry')} />
          </div>
          <button type="submit" disabled={saving} className="btn-primary flex items-center gap-2">
            <Send size={16} /> {saving ? 'Lodging…' : 'Lodge complaint'}
          </button>
          <p className="text-xs text-slate-400">
            The Compliance unit handles complaints confidentially. You will see only the status of your own complaint, not the case that may follow.
          </p>
        </form>

        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2"><Megaphone size={16} /> My complaints</h3>
            <button type="button" className="text-slate-400 hover:text-slate-600" onClick={load}><RefreshCw size={15} className={loading ? 'animate-spin' : ''} /></button>
          </div>
          {loading ? (
            <div className="py-8 text-center text-slate-400 text-sm">Loading…</div>
          ) : mine.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-sm">You have not lodged any complaints yet.</div>
          ) : (
            <ul className="space-y-2">
              {mine.map((c) => (
                <li key={c.id} className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-sm text-slate-800 dark:text-slate-100">{c.title}</span>
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[c.status] || ''}`}>{c.status_display}</span>
                  </div>
                  <div className="text-[11px] font-mono text-slate-400 mt-0.5">{c.reference_number}</div>
                  {c.status === 'rejected' && c.closed_reason && (
                    <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">Reason: {c.closed_reason}</div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
