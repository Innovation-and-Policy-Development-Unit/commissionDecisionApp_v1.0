/**
 * ComplianceDashboardPanel
 * Embedded in PscDashboard — live compliance case summary for OPSC internal staff.
 * Only fetches data if the user has a compliance or secretariat role.
 */
import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ShieldCheck, AlertCircle, Clock, CheckCircle2, Users, ArrowRight, Download, RefreshCw } from 'lucide-react'
import api from '../../api/client'

const FAMILY_COLORS = {
  employee_disciplinary:       { bar: 'bg-blue-500',   badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
  serious_misconduct_employee: { bar: 'bg-red-500',    badge: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' },
  temporary_suspension:        { bar: 'bg-amber-500',  badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' },
  grievance:                   { bar: 'bg-emerald-500',badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' },
  senior_serious_misconduct:   { bar: 'bg-purple-500', badge: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300' },
  senior_poor_performance:     { bar: 'bg-indigo-500', badge: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300' },
  policy_review:               { bar: 'bg-slate-400',  badge: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300' },
}

function MiniStat({ label, value, icon: Icon, valueCls = 'text-slate-900 dark:text-slate-50' }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 py-4 px-3 text-center gap-1 bg-white dark:bg-slate-800/50">
      <Icon size={16} className="text-slate-400 dark:text-slate-500 mb-0.5" />
      <span className={`text-2xl font-bold leading-none ${valueCls}`}>{value ?? '—'}</span>
      <span className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">{label}</span>
    </div>
  )
}

export default function ComplianceDashboardPanel({ userRole }) {
  const navigate = useNavigate()
  const [cases, setCases] = useState([])
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [exporting, setExporting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/compliance/cases/')
      setCases(res.data?.results ?? res.data ?? [])
    } catch {
      setFailed(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const handleExport = useCallback(async () => {
    setExporting(true)
    try {
      const res = await api.get('/compliance/cases/export-pptx/', { responseType: 'blob' })
      const url  = URL.createObjectURL(new Blob([res.data]))
      const a    = document.createElement('a')
      const today = new Date().toISOString().slice(0, 10).replace(/-/g, '')
      a.href     = url
      a.download = `PSC_Compliance_Cases_${today}.pptx`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      console.error('Export failed', e)
    } finally {
      setExporting(false)
    }
  }, [])

  if (failed) return null  // silently hide if user has no access

  // ── Aggregates ──────────────────────────────────────────────────────────────
  const open    = cases.filter((c) => c.status !== 'closed' && c.status !== 'archived')
  const overdue = cases.filter((c) => (c.sla_summary?.overdue ?? 0) > 0)
  const atRisk  = cases.filter((c) => (c.sla_summary?.at_risk ?? 0) > 0 && (c.sla_summary?.overdue ?? 0) === 0)
  const senior  = cases.filter((c) => c.is_senior_executive)

  // Cases by family
  const byFamily = {}
  cases.forEach((c) => {
    if (!byFamily[c.case_family]) byFamily[c.case_family] = { label: c.case_family_display, count: 0, key: c.case_family }
    byFamily[c.case_family].count++
  })
  const familyRows = Object.values(byFamily).sort((a, b) => b.count - a.count).slice(0, 5)
  const maxCount   = Math.max(...familyRows.map((f) => f.count), 1)

  // Top 4 urgent cases
  const urgent = [...overdue, ...atRisk].slice(0, 4)

  return (
    <div className="card card-compact">
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <ShieldCheck size={16} className="text-primary-600 dark:text-primary-400" />
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">Compliance Overview</h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            disabled={loading}
            className="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 px-2 py-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button
            onClick={handleExport}
            disabled={exporting || loading}
            className="inline-flex items-center gap-1 text-xs font-medium text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50 px-2.5 py-1 rounded transition-colors"
            title="Download PowerPoint report"
          >
            <Download size={12} />
            {exporting ? 'Generating…' : 'Export PPTX'}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-8 text-center text-xs text-slate-400">Loading compliance data…</div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">

          {/* Left: stat row + urgent cases */}
          <div className="xl:col-span-2 flex flex-col gap-4">

            {/* 4 mini stats */}
            <div className="grid grid-cols-4 gap-3">
              <MiniStat label="Open cases"   value={open.length}    icon={ShieldCheck} />
              <MiniStat label="Overdue SLA"  value={overdue.length} icon={AlertCircle} valueCls={overdue.length > 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-slate-50'} />
              <MiniStat label="At risk"      value={atRisk.length}  icon={Clock}       valueCls={atRisk.length  > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-900 dark:text-slate-50'} />
              <MiniStat label="Senior exec"  value={senior.length}  icon={Users}       valueCls={senior.length  > 0 ? 'text-purple-600 dark:text-purple-400' : 'text-slate-900 dark:text-slate-50'} />
            </div>

            {/* Urgent cases list */}
            <div>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                Cases needing attention
              </p>
              {urgent.length === 0 ? (
                <div className="flex items-center gap-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 px-3 py-2.5 text-xs text-emerald-700 dark:text-emerald-300">
                  <CheckCircle2 size={14} /> All cases are on track — no overdue or at-risk stages.
                </div>
              ) : (
                <ul className="divide-y divide-slate-100 dark:divide-slate-700/60">
                  {urgent.map((c) => {
                    const isOverdue = (c.sla_summary?.overdue ?? 0) > 0
                    return (
                      <li
                        key={c.id}
                        className="flex items-center gap-3 py-2 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40 -mx-1 px-1 rounded-lg"
                        onClick={() => navigate(`/compliance/cases/${c.id}`)}
                      >
                        {isOverdue
                          ? <AlertCircle size={14} className="shrink-0 text-red-500" />
                          : <Clock       size={14} className="shrink-0 text-amber-500" />
                        }
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium text-slate-800 dark:text-slate-100 truncate">{c.subject_name}</div>
                          <div className="text-[11px] text-slate-400 truncate">{c.case_family_display} · {c.reference_number}</div>
                        </div>
                        <span className={`shrink-0 text-[11px] font-medium rounded-full px-2 py-0.5 ${isOverdue ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'}`}>
                          {isOverdue ? `${c.sla_summary.overdue} overdue` : `${c.sla_summary.at_risk} at risk`}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </div>

          {/* Right: caseload by family */}
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
              Caseload by family
            </p>
            {familyRows.length === 0 ? (
              <p className="text-xs text-slate-400 py-4">No cases.</p>
            ) : (
              <div className="space-y-2.5">
                {familyRows.map(({ key, label, count }) => {
                  const colors = FAMILY_COLORS[key] || { bar: 'bg-slate-400', badge: '' }
                  const pct = Math.round((count / maxCount) * 100)
                  return (
                    <div key={key}>
                      <div className="flex items-center justify-between mb-1">
                        <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${colors.badge}`}>{label}</span>
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{count}</span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                        <div className={`h-full rounded-full ${colors.bar} transition-all duration-500`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
            <button
              className="mt-4 w-full text-center text-xs text-primary-600 dark:text-primary-400 hover:underline"
              onClick={() => navigate('/compliance/cases')}
            >
              View all cases →
            </button>
          </div>

        </div>
      )}
    </div>
  )
}
