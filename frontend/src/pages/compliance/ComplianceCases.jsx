import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ShieldCheck, RefreshCw, AlertCircle, Clock, CheckCircle2, CircleDot, Plus, Send, Check } from 'lucide-react'
import api from '../../api/client'
import PageHeader from '../../components/shared/PageHeader'
import { useAuth } from '../../context/AuthContext'

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
              onClick={() => navigate('/compliance/cases/new')}
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

      {loading ? (
        <div className="py-16 text-center text-slate-400">Loading…</div>
      ) : cases.length === 0 ? (
        <div className="py-16 text-center text-slate-400">
          <ShieldCheck size={40} className="mx-auto mb-3 opacity-50" />
          No compliance cases yet.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-left text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3">Reference</th>
                <th className="px-4 py-3">Subject</th>
                <th className="px-4 py-3">Case family</th>
                <th className="px-4 py-3">Stage</th>
                <th className="px-4 py-3">SLA</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
              {cases.map((c) => (
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
    </div>
  )
}
