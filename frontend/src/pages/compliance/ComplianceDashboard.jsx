import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ShieldCheck, AlertCircle, Clock, CheckCircle2, RefreshCw,
  ListChecks, Scale, Users, TrendingUp,
} from 'lucide-react'
import api from '../../api/client'
import PageHeader from '../../components/shared/PageHeader'

const FAMILY_COLORS = {
  employee_disciplinary:       'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  serious_misconduct_employee: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  temporary_suspension:        'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  grievance:                   'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  senior_serious_misconduct:   'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  senior_poor_performance:     'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
  policy_review:               'bg-slate-100 text-slate-700 dark:bg-slate-700/40 dark:text-slate-300',
}

function StatCard({ label, value, icon: Icon, colorCls = 'text-primary-600 dark:text-primary-400', bg = 'bg-primary-50 dark:bg-primary-900/20' }) {
  return (
    <div className={`rounded-xl border border-slate-200 dark:border-slate-700 p-5 flex items-center gap-4`}>
      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${bg}`}>
        <Icon size={21} className={colorCls} />
      </div>
      <div>
        <div className="text-2xl font-bold text-slate-800 dark:text-slate-100">{value ?? '—'}</div>
        <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{label}</div>
      </div>
    </div>
  )
}

export default function ComplianceDashboard() {
  const navigate = useNavigate()
  const [cases, setCases] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const res = await api.get('/compliance/cases/')
      setCases(res.data?.results ?? res.data ?? [])
    } catch (e) {
      setError(e.response?.data?.detail || 'Could not load compliance data.')
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const open = cases.filter((c) => c.status !== 'closed' && c.status !== 'archived')
  const overdue = cases.filter((c) => c.sla_summary?.overdue > 0)
  const atRisk  = cases.filter((c) => c.sla_summary?.at_risk  > 0 && (c.sla_summary?.overdue ?? 0) === 0)
  const senior  = cases.filter((c) => c.is_senior_executive)

  // Case counts by family
  const byFamily = {}
  cases.forEach((c) => {
    if (!byFamily[c.case_family]) byFamily[c.case_family] = { label: c.case_family_display, count: 0 }
    byFamily[c.case_family].count++
  })

  const urgentCases = [...overdue, ...atRisk].slice(0, 10)

  return (
    <div>
      <PageHeader
        title="Compliance Dashboard"
        subtitle="Live overview of all open statutory compliance cases"
        action={
          <button className="btn-outline flex items-center gap-2 py-2 px-3 text-sm" onClick={load} disabled={loading}>
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        }
      />

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-300">{error}</div>
      )}

      {loading ? (
        <div className="py-16 text-center text-slate-400">Loading…</div>
      ) : (
        <>
          {/* Stats */}
          <div className="mb-6 grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Open cases"    value={open.length}    icon={ListChecks}   />
            <StatCard label="Overdue SLA"   value={overdue.length} icon={AlertCircle}  colorCls="text-red-600 dark:text-red-400"   bg="bg-red-50 dark:bg-red-900/20"   />
            <StatCard label="At risk"       value={atRisk.length}  icon={Clock}        colorCls="text-amber-600 dark:text-amber-400" bg="bg-amber-50 dark:bg-amber-900/20" />
            <StatCard label="Senior exec"   value={senior.length}  icon={Users}        colorCls="text-purple-600 dark:text-purple-400" bg="bg-purple-50 dark:bg-purple-900/20" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Urgent cases */}
            <section className="lg:col-span-2 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
              <h3 className="mb-3 flex items-center gap-2 font-semibold text-slate-700 dark:text-slate-200">
                <AlertCircle size={16} className="text-red-500" /> Cases needing attention
              </h3>
              {urgentCases.length === 0 ? (
                <div className="py-8 text-center text-slate-400">
                  <CheckCircle2 size={32} className="mx-auto mb-2 text-emerald-500 opacity-70" />
                  All cases are on track.
                </div>
              ) : (
                <ul className="divide-y divide-slate-100 dark:divide-slate-700/60">
                  {urgentCases.map((c) => {
                    const hasOverdue = (c.sla_summary?.overdue ?? 0) > 0
                    return (
                      <li key={c.id}
                        className="flex items-center gap-3 py-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40 -mx-1 px-1 rounded-lg"
                        onClick={() => navigate(`/compliance/cases/${c.id}`)}
                      >
                        <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${hasOverdue ? 'bg-red-100 dark:bg-red-900/40' : 'bg-amber-100 dark:bg-amber-900/40'}`}>
                          {hasOverdue
                            ? <AlertCircle size={14} className="text-red-600 dark:text-red-400" />
                            : <Clock       size={14} className="text-amber-600 dark:text-amber-400" />
                          }
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-slate-800 dark:text-slate-100 truncate">{c.subject_name}</div>
                          <div className="text-xs text-slate-400">{c.case_family_display} · {c.reference_number}</div>
                        </div>
                        <span className={`shrink-0 inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${hasOverdue ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'}`}>
                          {hasOverdue ? `${c.sla_summary.overdue} overdue` : `${c.sla_summary.at_risk} at risk`}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>

            {/* Caseload by family */}
            <section className="rounded-xl border border-slate-200 dark:border-slate-700 p-5">
              <h3 className="mb-3 flex items-center gap-2 font-semibold text-slate-700 dark:text-slate-200">
                <TrendingUp size={16} /> Caseload by family
              </h3>
              {Object.keys(byFamily).length === 0 ? (
                <p className="text-sm text-slate-400 py-4">No cases.</p>
              ) : (
                <ul className="space-y-2">
                  {Object.entries(byFamily)
                    .sort((a, b) => b[1].count - a[1].count)
                    .map(([key, { label, count }]) => (
                      <li key={key} className="flex items-center gap-2">
                        <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${FAMILY_COLORS[key] || 'bg-slate-100 text-slate-600'}`}>{label}</span>
                        <span className="ml-auto font-semibold text-slate-700 dark:text-slate-200 text-sm">{count}</span>
                      </li>
                    ))
                  }
                </ul>
              )}
              <button
                className="mt-4 w-full text-center text-xs text-primary-600 dark:text-primary-400 hover:underline"
                onClick={() => navigate('/compliance/cases')}
              >
                View all cases →
              </button>
            </section>
          </div>
        </>
      )}
    </div>
  )
}
