import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileText, AlertTriangle, Clock, BarChart3, BrainCircuit } from 'lucide-react'
import api from '../../api/client'
import PageHeader from '../../components/shared/PageHeader'
import StatCard from '../../components/shared/StatCard'
import BaseBadge from '../../components/shared/BaseBadge'
import BaseSpinner from '../../components/shared/BaseSpinner'

const STAGE_LABELS = {
  draft: 'Draft',
  submitted: 'Submitted',
  secretary_review: 'Secretary Review',
  manager_checklist_review: 'Manager Review',
  under_assessment: 'Under Assessment',
  forwarded_to_commission: 'Forwarded to Commission',
  commission_sitting: 'Commission Sitting',
  decided_approved: 'Approved',
  decided_rejected: 'Rejected',
  deferred: 'Deferred',
  returned_for_clarification: 'Returned for Clarification',
  withdrawn: 'Withdrawn',
}

export default function ExecutiveDashboard() {
  const navigate = useNavigate()
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  const goToSubmissions = filter => navigate(`/submissions?filter=${filter}`)

  const loadStats = useCallback(async () => {
    try {
      const res = await api.get('/dashboard/stats/')
      setStats(res.data)
    } catch (e) {
      console.error('Dashboard stats error', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadStats() }, [loadStats])

  const slaColor = stats?.sla_compliance_pct >= 90 ? 'success'
    : stats?.sla_compliance_pct >= 70 ? 'warning' : 'danger'

  const stageEntries = Object.entries(stats?.stage_breakdown || {})
  const maxStageCount = Math.max(1, ...stageEntries.map(([, c]) => c))

  if (loading) {
    return (
      <div className="flex flex-col gap-6 max-w-[1400px] mx-auto pb-10">
        <PageHeader title="Executive Dashboard" subtitle="Commission-wide performance overview" />
        <div className="text-center p-16"><BaseSpinner size="lg" label="Loading metrics…" /></div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 max-w-[1400px] mx-auto pb-10">
      <PageHeader title="Executive Dashboard" subtitle="Commission-wide performance at a glance" />

      {/* KPI Row */}
      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
        <StatCard title="Total Submissions" value={stats?.total_submissions ?? 0} icon={FileText} color="blue" onClick={() => goToSubmissions('all')} />
        <StatCard title="Active / Pending" value={stats?.pending_active ?? 0} icon={Clock} color="amber" onClick={() => goToSubmissions('active')} />
        <StatCard title="Submitted This Week" value={stats?.submitted_this_week ?? 0} icon={BarChart3} color="emerald" onClick={() => goToSubmissions('this_week')} />
        <StatCard title="Submitted This Month" value={stats?.submitted_this_month ?? 0} icon={BarChart3} color="cyan" onClick={() => goToSubmissions('this_month')} />
        <StatCard title="Overdue (>30 days)" value={stats?.overdue_count ?? 0} icon={AlertTriangle} color={stats?.overdue_count > 0 ? 'red' : 'emerald'} onClick={() => goToSubmissions('overdue')} />
        <div className="card p-4">
          <span className="block font-semibold text-xs text-slate-500">SLA Compliance</span>
          <span className="block font-bold text-3xl leading-tight text-slate-900 dark:text-slate-100">{stats?.sla_compliance_pct ?? 100}%</span>
          <BaseBadge color={slaColor} size="small" className="mt-1">
            {slaColor === 'success' ? 'On Target' : slaColor === 'warning' ? 'At Risk' : 'Below Target'}
          </BaseBadge>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Stage Breakdown */}
        <div className="card">
          <div className="p-4 border-b border-slate-100 dark:border-slate-700"><span className="font-bold text-slate-800 dark:text-slate-100">Submissions by Stage</span></div>
          <div className="flex flex-col gap-2 p-4">
            {stageEntries.sort((a, b) => b[1] - a[1]).slice(0, 10).map(([stage, count]) => (
              <div key={stage} className="flex items-center gap-2">
                <span className="text-sm w-44 shrink-0 text-slate-600 dark:text-slate-300">{STAGE_LABELS[stage] || stage}</span>
                <div className="flex-1 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div className="h-full bg-primary-500 rounded-full" style={{ width: `${Math.round((count / maxStageCount) * 100)}%` }} />
                </div>
                <span className="text-sm w-8 text-right text-slate-600 dark:text-slate-300">{count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Ministry Breakdown */}
        <div className="card">
          <div className="p-4 border-b border-slate-100 dark:border-slate-700"><span className="font-bold text-slate-800 dark:text-slate-100">Top Ministries by Volume</span></div>
          {!stats?.ministry_breakdown?.length ? (
            <p className="text-sm text-slate-500 p-4">No data available or access restricted.</p>
          ) : (
            <div className="flex flex-col gap-2 p-4">
              {stats.ministry_breakdown.map(({ ministry, count }) => {
                const maxMinistry = Math.max(1, ...stats.ministry_breakdown.map(m => m.count))
                return (
                  <div key={ministry} className="flex items-center gap-2">
                    <span className="text-sm w-52 shrink-0 truncate text-slate-600 dark:text-slate-300">{ministry || 'Unknown'}</span>
                    <div className="flex-1 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div className="h-full bg-teal-500 rounded-full" style={{ width: `${Math.round((count / maxMinistry) * 100)}%` }} />
                    </div>
                    <span className="text-sm w-8 text-right text-slate-600 dark:text-slate-300">{count}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* AI Processing Stats */}
      <div className="card">
        <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex items-center gap-2">
          <BrainCircuit size={20} className="text-primary-500" />
          <span className="font-bold text-slate-800 dark:text-slate-100">AI Processing Rates</span>
        </div>
        <div className="flex gap-8 p-4 flex-wrap">
          <div>
            <span className="block text-sm text-slate-500">Executive Briefs</span>
            <span className="block font-bold text-xl text-slate-900 dark:text-slate-100">{stats?.ai_brief_processing_rate ?? 0}%</span>
          </div>
          <div>
            <span className="block text-sm text-slate-500">Risk Assessments</span>
            <span className="block font-bold text-xl text-slate-900 dark:text-slate-100">{stats?.ai_risk_processing_rate ?? 0}%</span>
          </div>
        </div>
      </div>
    </div>
  )
}
