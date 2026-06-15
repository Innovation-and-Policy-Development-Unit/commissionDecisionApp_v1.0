import { useState, useEffect, useCallback } from 'react'
import { Megaphone, Send, RefreshCw, X } from 'lucide-react'
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

/**
 * LodgeComplaintForm — reusable form used both in the modal and the standalone page.
 * onSuccess() is called after a complaint is successfully lodged.
 */
export function LodgeComplaintForm({ onSuccess }) {
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    if (!form.title.trim()) { setError('A title is required.'); return }
    setSaving(true); setError(''); setOk('')
    try {
      await api.post('/compliance/complaints/', form)
      setOk('Complaint lodged. The Compliance unit will review it shortly.')
      setForm(EMPTY)
      onSuccess?.()
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not lodge the complaint.')
    } finally { setSaving(false) }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {error && <div className="rounded-lg bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-300">{error}</div>}
      {ok    && <div className="rounded-lg bg-emerald-50 dark:bg-emerald-900/20 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">{ok}</div>}

      <div>
        <label className="block text-sm font-medium mb-1">Complaint title *</label>
        <input className="form-input w-full" value={form.title} onChange={set('title')} placeholder="e.g. Repeated unexplained absence" />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Details</label>
        <textarea className="form-input w-full" rows={4} value={form.description} onChange={set('description')}
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
        <Send size={15} /> {saving ? 'Lodging…' : 'Lodge complaint'}
      </button>
      <p className="text-xs text-slate-400">
        The Compliance unit handles complaints confidentially. You will receive a reference number and can track the status in the Complaints Register.
      </p>
    </form>
  )
}

/**
 * Modal wrapper — rendered by ComplaintsRegister.
 */
export function LodgeComplaintModal({ onClose, onLodged }) {
  const handleSuccess = () => {
    onLodged?.()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-xl bg-white dark:bg-slate-800 shadow-2xl flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal header */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 px-5 py-4 shrink-0">
          <div className="flex items-center gap-2">
            <Megaphone size={18} className="text-primary-600 dark:text-primary-400" />
            <div>
              <h2 className="font-semibold text-slate-800 dark:text-slate-100">Lodge a Complaint</h2>
              <p className="text-xs text-slate-400">Refer a conduct or performance concern to the Compliance unit</p>
            </div>
          </div>
          <button
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-200"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal body */}
        <div className="overflow-y-auto px-5 py-4">
          <LodgeComplaintForm onSuccess={handleSuccess} />
        </div>
      </div>
    </div>
  )
}

/**
 * Standalone page — kept so the /compliance/lodge-complaint route still works.
 * Shows the form alongside the user's own complaint history.
 */
export default function LodgeComplaint() {
  const [mine, setMine] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/compliance/complaints/')
      setMine(res.data?.results ?? res.data ?? [])
    } catch { /* ignore */ } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  return (
    <div>
      <PageHeader title="Lodge a Complaint" subtitle="Refer a conduct or performance concern to the OPSC Compliance unit" />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <LodgeComplaintForm onSuccess={load} />

        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2">
              <Megaphone size={16} /> My complaints
            </h3>
            <button type="button" className="text-slate-400 hover:text-slate-600" onClick={load}>
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            </button>
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
