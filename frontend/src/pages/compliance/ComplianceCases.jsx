import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ShieldCheck, RefreshCw, AlertCircle, Clock, CheckCircle2, CircleDot, Plus, Send, Check, Search, X } from 'lucide-react'
import api from '../../api/client'
import PageHeader from '../../components/shared/PageHeader'
import { useAuth } from '../../context/AuthContext'
import { CASE_FAMILIES } from '../../constants/compliance'
import NewComplianceCaseForm from './NewComplianceCaseForm'

const MANAGER_ROLES = ['compliance_manager', 'psc_admin']

const FAMILY_COLORS = {
  employee_disciplinary:       'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  serious_misconduct_employee: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  temporary_suspension:        'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  grievance:                   'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  senior_serious_misconduct:   'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  senior_poor_performance:     'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
  policy_review:               'bg-slate-100 text-slate-700 dark:bg-slate-700/40 dark:text-slate-300',
}

function SlaPills({ summary }) {
  if (!summary) return null
  const items = [
    { key: 'overdue',   n: summary.overdue,   cls: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',       Icon: AlertCircle },
    { key: 'at_risk',   n: summary.at_risk,   cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300', Icon: Clock },
    { key: 'on_track',  n: summary.on_track,  cls: 'bg-slate-100 text-slate-600 dark:bg-slate-700/40 dark:text-slate-300', Icon: CircleDot },
    { key: 'completed', n: summary.completed, cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300', Icon: CheckCircle2 },
  ].filter((i) => i.n > 0)
  if (items.length === 0) return <span className="text-xs text-slate-400">—</span>
  return (
    <div className="flex flex-wrap gap-1">
      {items.map(({ key, n, cls, Icon }) => (
        <span key={key} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
          <Icon size={12} /> {n}
        </span>
      ))}
    </div>
  )
}

export default function ComplianceCases() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const isManager = user && MANAGER_ROLES.includes(user.role)
  const [cases, setCases] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState(null)
  const [search, setSearch] = useState('')
  const [filterFamily, setFilterFamily] = useState('')
  const [filterSla, setFilterSla] = useState('')
  const [showNewCase, setShowNewCase] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await api.get('/compliance/cases/')
      setCases(res.data?.results ?? res.data ?? [])
    } catch (e) {
      setError(e.response?.data?.detail || 'Could not load compliance cases.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = useMemo(() => {
    let out = cases
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      out = out.filter((c) =>
        c.subject_name?.toLowerCase().includes(q) ||
        c.reference_number?.toLowerCase().includes(q) ||
        c.subject_ministry?.toLowerCase().includes(q)
      )
    }
    if (filterFamily) out = out.filter((c) => c.case_family === filterFamily)
    if (filterSla === 'overdue') out = out.filter((c) => (c.sla_summary?.overdue ?? 0) > 0)
    if (filterSla === 'at_risk')  out = out.filter((c) => (c.sla_summary?.at_risk  ?? 0) > 0)
    if (filterSla === 'on_track') out = out.filter((c) => (c.sla_summary?.overdue ?? 0) === 0 && (c.sla_summary?.at_risk ?? 0) === 0)
    return out
  }, [cases, search, filterFamily, filterSla])

  const hasFilters = search || filterFamily || filterSla

  const act = async (c, verb) => {
    setBusyId(c.id)
    try {
      await api.post(`/compliance/cases/${c.id}/${verb}/`)
      await load()
    } catch (e) {
      alert(e.response?.data?.detail || `Could not ${verb} the case.`)
    } finally { setBusyId(null) }
  }

  return (
    <div>
      <PageHeader
        title="Compliance Cases"
        subtitle="Statutory disciplinary, suspension, and grievance matters managed by the Compliance unit"
        action={
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="btn-primary flex items-center gap-2 py-2 px-3 text-sm"
              onClick={() => setShowNewCase(true)}
            >
              <Plus size={16} /> New Case
            </button>
            <button
              type="button"
              className="btn-outline flex items-center gap-2 py-2 px-3 text-sm"
              onClick={load}
              disabled={loading}
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Refresh
            </button>
          </div>
        }
      />

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Filter bar */}
      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            className="form-input pl-8 py-1.5 text-sm w-full"
            placeholder="Search by name, reference, ministry…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select className="form-input py-1.5 text-sm" value={filterFamily} onChange={(e) => setFilterFamily(e.target.value)}>
          <option value="">All case families</option>
          {CASE_FAMILIES.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>
        <select className="form-input py-1.5 text-sm" value={filterSla} onChange={(e) => setFilterSla(e.target.value)}>
          <option value="">All SLA statuses</option>
          <option value="overdue">Overdue</option>
          <option value="at_risk">At risk</option>
          <option value="on_track">On track</option>
        </select>
        {hasFilters && (
          <button className="btn-outline py-1.5 px-3 text-sm flex items-center gap-1" onClick={() => { setSearch(''); setFilterFamily(''); setFilterSla('') }}>
            <X size={13} /> Clear
          </button>
        )}
        <span className="self-center text-xs text-slate-400 ml-auto">{filtered.length} of {cases.length}</span>
      </div>

      {loading ? (
        <div className="py-16 text-center text-slate-400">Loading…</div>
      ) : cases.length === 0 ? (
        <div className="py-16 text-center text-slate-400">
          <ShieldCheck size={40} className="mx-auto mb-3 opacity-50" />
          No compliance cases yet.
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-12 text-center text-slate-400">No cases match the current filters.</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-left text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3">Reference</th>
                <th className="px-4 py-3">Officer</th>
                <th className="px-4 py-3">Nature of Offence</th>
                <th className="px-4 py-3">Stage</th>
                <th className="px-4 py-3">SLA</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
              {filtered.map((c) => (
                <tr key={c.id} onClick={() => navigate(`/compliance/cases/${c.id}`)}
                  className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="px-4 py-3 font-mono text-xs text-primary-600 dark:text-primary-400">{c.reference_number}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-800 dark:text-slate-100">{c.subject_name}</div>
                    {c.subject_ministry && <div className="text-xs text-slate-400">{c.subject_ministry}</div>}
                    {c.is_senior_executive && (
                      <span className="mt-0.5 inline-block rounded bg-purple-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">
                        Senior Executive
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${FAMILY_COLORS[c.case_family] || 'bg-slate-100 text-slate-600'}`}>
                      {c.case_family_display}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400">{c.current_stage}</td>
                  <td className="px-4 py-3"><SlaPills summary={c.sla_summary} /></td>
                  <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400">{c.status_display}</td>
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-end gap-2">
                      {c.current_stage === 'draft' && (
                        <button disabled={busyId === c.id} onClick={() => act(c, 'submit')}
                          className="inline-flex items-center gap-1 rounded-md bg-primary-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-primary-700 disabled:opacity-50">
                          <Send size={13} /> Submit
                        </button>
                      )}
                      {c.current_stage === 'pending_manager_approval' && isManager && (
                        <button disabled={busyId === c.id} onClick={() => act(c, 'approve')}
                          className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50">
                          <Check size={13} /> Approve
                        </button>
                      )}
                      {!(c.current_stage === 'draft' || (c.current_stage === 'pending_manager_approval' && isManager)) && (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showNewCase && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setShowNewCase(false)}
        >
          <div
            className="w-full max-w-2xl rounded-xl bg-white dark:bg-slate-800 shadow-2xl flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 px-5 py-4 shrink-0">
              <div>
                <h2 className="font-semibold text-slate-800 dark:text-slate-100">New Compliance Case</h2>
                <p className="text-xs text-slate-400 mt-0.5">Open a statutory disciplinary, suspension, or grievance matter</p>
              </div>
              <button
                className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-200"
                onClick={() => setShowNewCase(false)}
              >
                <X size={18} />
              </button>
            </div>
            <div className="overflow-y-auto px-5 py-5">
              <NewComplianceCaseForm
                modal
                onSuccess={() => { setShowNewCase(false); load() }}
                onClose={() => setShowNewCase(false)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
