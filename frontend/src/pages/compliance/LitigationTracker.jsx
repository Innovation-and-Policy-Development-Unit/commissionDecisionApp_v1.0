import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Scale, RefreshCw, ExternalLink, Calendar, TrendingUp, AlertCircle, CheckCircle2, Pencil, X, Bell } from 'lucide-react'
import api from '../../api/client'
import PageHeader from '../../components/shared/PageHeader'
import { useAuth } from '../../context/AuthContext'

const MANAGER_ROLES = ['compliance_manager', 'psc_admin']

const STATUS_META = {
  active:   { label: 'Active',   cls: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' },
  settled:  { label: 'Settled',  cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' },
  closed:   { label: 'Closed',   cls: 'bg-slate-100 text-slate-600 dark:bg-slate-700/40 dark:text-slate-300' },
  appealed: { label: 'Appealed', cls: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300' },
}

function fmt(n) {
  if (n == null || n === '') return '—'
  return `VT ${Number(n).toLocaleString()}`
}

function isUpcoming(dateStr) {
  if (!dateStr) return false
  const d = new Date(dateStr)
  const now = new Date()
  const diff = (d - now) / 86400000
  return diff >= 0 && diff <= 14
}

function isPast(dateStr) {
  if (!dateStr) return false
  return new Date(dateStr) < new Date()
}

function daysUntil(dateStr) {
  if (!dateStr) return null
  return Math.ceil((new Date(dateStr) - new Date()) / 86400000)
}

function EditLitigationModal({ record, caseRef, onSave, onClose, saving }) {
  const [form, setForm] = useState({
    status: record.status,
    court_name: record.court_name || '',
    court_reference: record.court_reference || '',
    legal_counsel: record.legal_counsel || '',
    opposing_counsel: record.opposing_counsel || '',
    next_court_date: record.next_court_date || '',
    estimated_cost: record.estimated_cost ?? '',
    actual_cost: record.actual_cost ?? '',
    date_resolved: record.date_resolved || '',
    notes: record.notes || '',
  })
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 shadow-2xl p-6 space-y-3 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-slate-800 dark:text-slate-100">Edit Litigation Record — {caseRef}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="block text-xs font-medium mb-1">Status</label>
            <select className="form-input w-full text-sm" value={form.status} onChange={set('status')}>
              <option value="active">Active</option>
              <option value="settled">Settled</option>
              <option value="closed">Closed</option>
              <option value="appealed">Appealed</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Court / tribunal</label>
            <input className="form-input w-full text-sm" value={form.court_name} onChange={set('court_name')} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Court reference</label>
            <input className="form-input w-full text-sm" value={form.court_reference} onChange={set('court_reference')} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">PSC legal counsel</label>
            <input className="form-input w-full text-sm" value={form.legal_counsel} onChange={set('legal_counsel')} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Opposing counsel</label>
            <input className="form-input w-full text-sm" value={form.opposing_counsel} onChange={set('opposing_counsel')} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Next court date</label>
            <input type="date" className="form-input w-full text-sm" value={form.next_court_date} onChange={set('next_court_date')} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Date resolved</label>
            <input type="date" className="form-input w-full text-sm" value={form.date_resolved} onChange={set('date_resolved')} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Est. cost (VT)</label>
            <input type="number" className="form-input w-full text-sm" value={form.estimated_cost} onChange={set('estimated_cost')} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Actual cost (VT)</label>
            <input type="number" className="form-input w-full text-sm" value={form.actual_cost} onChange={set('actual_cost')} />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium mb-1">Notes</label>
            <textarea className="form-input w-full text-sm" rows={3} value={form.notes} onChange={set('notes')} />
          </div>
        </div>
        <div className="flex gap-2 pt-1">
          <button disabled={saving} className="btn-primary text-sm" onClick={() => onSave(form)}>Save changes</button>
          <button className="btn-outline text-sm" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  )
}

export default function LitigationTracker() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const isManager = user && MANAGER_ROLES.includes(user.role)

  const [cases, setCases] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [editing, setEditing] = useState(null) // { record, case_id, case_ref }
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const res = await api.get('/compliance/cases/')
      setCases(res.data?.results ?? res.data ?? [])
    } catch (e) {
      setError(e.response?.data?.detail || 'Could not load cases.')
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  // Flatten all litigation records with parent case info
  const allRecords = []
  cases.forEach((c) => {
    ;(c.litigation_records ?? []).forEach((lit) => {
      allRecords.push({
        ...lit,
        case_id: c.id,
        case_ref: c.reference_number,
        case_subject: c.subject_name,
        case_family_display: c.case_family_display,
      })
    })
  })

  const records = statusFilter === 'all'
    ? allRecords
    : allRecords.filter((r) => r.status === statusFilter)

  // Sort: upcoming court dates first, then by initiated desc
  records.sort((a, b) => {
    const aUp = isUpcoming(a.next_court_date)
    const bUp = isUpcoming(b.next_court_date)
    if (aUp && !bUp) return -1
    if (!aUp && bUp) return 1
    return new Date(b.date_initiated) - new Date(a.date_initiated)
  })

  const totalEst    = allRecords.reduce((s, l) => s + (parseFloat(l.estimated_cost) || 0), 0)
  const totalActual = allRecords.reduce((s, l) => s + (parseFloat(l.actual_cost)    || 0), 0)
  const activeCount = allRecords.filter((l) => l.status === 'active').length
  const upcomingCount = allRecords.filter((l) => isUpcoming(l.next_court_date)).length

  const handleSave = async (form) => {
    if (!editing) return
    setSaving(true)
    try {
      await api.patch(`/compliance/cases/${editing.case_id}/litigation/${editing.record.id}/`, form)
      await load()
      setEditing(null)
    } catch (e) {
      alert(e.response?.data?.detail || JSON.stringify(e.response?.data || {}) || 'Save failed.')
    } finally { setSaving(false) }
  }

  return (
    <div>
      <PageHeader
        title="Litigation Tracker"
        subtitle="Court matters, legal representation, and cost history across all compliance cases"
        action={
          <button className="btn-outline flex items-center gap-2 py-2 px-3 text-sm" onClick={load} disabled={loading}>
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        }
      />

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-300">{error}</div>
      )}

      {/* Summary cards */}
      <div className="mb-6 grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4">
          <div className="flex items-center gap-2 mb-1">
            <Scale size={15} className="text-slate-400" />
            <span className="text-xs text-slate-500">Total matters</span>
          </div>
          <div className="text-2xl font-bold text-slate-800 dark:text-slate-100">{allRecords.length}</div>
        </div>
        <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20 p-4">
          <div className="flex items-center gap-2 mb-1">
            <AlertCircle size={15} className="text-red-500" />
            <span className="text-xs text-red-600 dark:text-red-400">Active litigation</span>
          </div>
          <div className="text-2xl font-bold text-red-700 dark:text-red-300">{activeCount}</div>
        </div>
        <div className={`rounded-xl border p-4 ${upcomingCount > 0 ? 'border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20' : 'border-slate-200 dark:border-slate-700'}`}>
          <div className="flex items-center gap-2 mb-1">
            <Calendar size={15} className={upcomingCount > 0 ? 'text-amber-500' : 'text-slate-400'} />
            <span className={`text-xs ${upcomingCount > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500'}`}>Hearings within 14 days</span>
          </div>
          <div className={`text-2xl font-bold ${upcomingCount > 0 ? 'text-amber-700 dark:text-amber-300' : 'text-slate-800 dark:text-slate-100'}`}>{upcomingCount}</div>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp size={15} className="text-slate-400" />
            <span className="text-xs text-slate-500">Total actual cost</span>
          </div>
          <div className="text-xl font-bold text-slate-800 dark:text-slate-100">{fmt(totalActual || null)}</div>
          {totalEst > 0 && <div className="text-[11px] text-slate-400 mt-0.5">Est. {fmt(totalEst)}</div>}
        </div>
      </div>

      {/* Filter tabs */}
      <div className="mb-4 flex items-center gap-2 flex-wrap">
        {['all', 'active', 'appealed', 'settled', 'closed'].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              statusFilter === s
                ? 'bg-primary-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
            }`}
          >
            {s === 'all' ? `All (${allRecords.length})` : `${STATUS_META[s]?.label ?? s} (${allRecords.filter((r) => r.status === s).length})`}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-16 text-center text-slate-400">Loading…</div>
      ) : records.length === 0 ? (
        <div className="py-16 text-center text-slate-400">
          <Scale size={40} className="mx-auto mb-3 opacity-40" />
          {statusFilter === 'all' ? 'No litigation records across any compliance case.' : `No ${statusFilter} litigation records.`}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-left text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3">Case</th>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3">Court</th>
                <th className="px-4 py-3">Counsel</th>
                <th className="px-4 py-3">Next hearing</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Costs (est / actual)</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
              {records.map((l) => {
                const upcoming = isUpcoming(l.next_court_date)
                const past     = isPast(l.next_court_date) && l.status === 'active'
                const sm       = STATUS_META[l.status] ?? STATUS_META.closed
                return (
                  <tr key={l.id} className={`hover:bg-slate-50 dark:hover:bg-slate-800/40 ${upcoming ? 'bg-amber-50/50 dark:bg-amber-950/10' : ''}`}>
                    <td className="px-4 py-3">
                      <div className="font-mono text-xs text-primary-600 dark:text-primary-400">{l.case_ref}</div>
                      <div className="text-xs text-slate-500 truncate max-w-[120px]">{l.case_subject}</div>
                    </td>
                    <td className="px-4 py-3 max-w-[200px]">
                      <div className="truncate text-slate-800 dark:text-slate-100">{l.description}</div>
                      {l.notes && <div className="text-[11px] text-slate-400 truncate mt-0.5 italic">{l.notes}</div>}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <div className="text-slate-700 dark:text-slate-200">{l.court_name || '—'}</div>
                      {l.court_reference && <div className="font-mono text-slate-400">{l.court_reference}</div>}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {l.legal_counsel ? <div>PSC: {l.legal_counsel}</div> : null}
                      {l.opposing_counsel ? <div className="text-slate-400">Opp: {l.opposing_counsel}</div> : null}
                      {!l.legal_counsel && !l.opposing_counsel && '—'}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {l.next_court_date ? (
                        <span className={`font-medium ${upcoming ? 'text-amber-600 dark:text-amber-400' : past ? 'text-red-500 dark:text-red-400 line-through' : 'text-slate-600 dark:text-slate-300'}`}>
                          {l.next_court_date}
                          {(() => {
                            const d = daysUntil(l.next_court_date)
                            if (d == null || d < 0 || d > 14) return null
                            return <span className="ml-1 text-[10px] bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 rounded px-1">{d === 0 ? 'today' : `in ${d}d`}</span>
                          })()}
                          {l.court_date_notified === l.next_court_date && (
                            <span title="Reminder sent" className="ml-1 inline-flex items-center text-[10px] text-emerald-600 dark:text-emerald-400"><Bell size={10} className="mr-0.5" />alerted</span>
                          )}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${sm.cls}`}>{sm.label}</span>
                      {l.date_resolved && <div className="text-[10px] text-slate-400 mt-0.5">resolved {l.date_resolved}</div>}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                      <div>Est: {fmt(l.estimated_cost)}</div>
                      <div className={l.actual_cost ? 'text-slate-700 dark:text-slate-200 font-medium' : ''}>Act: {fmt(l.actual_cost)}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {isManager && (
                          <button
                            className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-200"
                            onClick={() => setEditing({ record: l, case_id: l.case_id, case_ref: l.case_ref })}
                          >
                            <Pencil size={11} /> Edit
                          </button>
                        )}
                        <button
                          className="inline-flex items-center gap-1 text-xs text-primary-600 dark:text-primary-400 hover:underline"
                          onClick={() => navigate(`/compliance/cases/${l.case_id}`)}
                        >
                          <ExternalLink size={11} /> Case
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <EditLitigationModal
          record={editing.record}
          caseRef={editing.case_ref}
          onSave={handleSave}
          onClose={() => setEditing(null)}
          saving={saving}
        />
      )}
    </div>
  )
}
