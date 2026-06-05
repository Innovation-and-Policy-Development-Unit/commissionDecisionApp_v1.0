import { useState, useEffect, useCallback } from 'react'
import { TrendingUp } from 'lucide-react'
import api from '../../api/client'
import PageHeader from '../../components/shared/PageHeader'
import StatCard from '../../components/shared/StatCard'
import BaseSpinner from '../../components/shared/BaseSpinner'

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export default function AnalyticsDashboard() {
  const [overview, setOverview] = useState(null)
  const [trends, setTrends] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const [ovRes, trRes] = await Promise.all([
        api.get('/analytics/overview/'),
        api.get('/analytics/trends/'),
      ])
      setOverview(ovRes.data)
      setTrends(trRes.data)
    } catch (e) {
      console.error('Analytics error', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) {
    return (
      <div className="flex flex-col gap-6 max-w-[1400px] mx-auto pb-10">
        <PageHeader title="Analytics Dashboard" subtitle="Submission trends and outcome analysis" />
        <div className="text-center p-16"><BaseSpinner label="Loading analytics…" /></div>
      </div>
    )
  }

  const maxMonthly = Math.max(1, ...(overview?.monthly_submissions || []).map(m => m.count))
  const maxWeekly = Math.max(1, ...(trends?.weekly_trends || []).map(w => w.count))
  const byFormType = overview?.by_form_type || []
  const maxFormType = Math.max(1, ...byFormType.map(f => f.count))

  return (
    <div className="flex flex-col gap-6 max-w-[1400px] mx-auto pb-10">
      <PageHeader title="Analytics Dashboard" subtitle="Submission trends and outcome analysis" />

      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))' }}>
        <StatCard title="Total" value={overview?.total ?? 0} color="blue" />
        <StatCard title="Approved" value={overview?.approved ?? 0} color="emerald" />
        <StatCard title="Rejected" value={overview?.rejected ?? 0} color="red" />
        <StatCard title="Deferred" value={overview?.deferred ?? 0} color="amber" />
        <StatCard title="Pending" value={overview?.pending ?? 0} color="purple" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly chart */}
        <div className="card">
          <div className="p-4 border-b border-slate-100 dark:border-slate-700"><span className="font-bold text-slate-800 dark:text-slate-100">Monthly Submissions ({overview?.year})</span></div>
          <div className="p-4">
            <div className="flex items-end gap-1.5 h-[120px] pb-2">
              {(overview?.monthly_submissions || []).map(({ month, count }) => {
                const pct = Math.round((count / maxMonthly) * 100)
                return (
                  <div key={month} className="flex flex-col items-center flex-1 gap-1">
                    <span className="text-[10px] font-semibold text-slate-700 dark:text-slate-200">{count}</span>
                    <div className="w-full bg-primary-500 rounded-t" style={{ height: `${Math.max(4, pct)}%`, minHeight: '4px' }} />
                    <span className="text-[10px] text-slate-500">{MONTH_NAMES[month - 1]}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* By Form Type */}
        <div className="card">
          <div className="p-4 border-b border-slate-100 dark:border-slate-700"><span className="font-bold text-slate-800 dark:text-slate-100">By Form Type</span></div>
          <div className="flex flex-col gap-2 p-4">
            {byFormType.map(({ form_type, count }) => (
              <div key={form_type} className="flex items-center gap-2">
                <span className="text-sm w-28 shrink-0 font-mono text-slate-600 dark:text-slate-300">{form_type || 'Unknown'}</span>
                <div className="flex-1 h-2.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div className="h-full bg-primary-500 rounded-full" style={{ width: `${Math.round(count / maxFormType * 100)}%` }} />
                </div>
                <span className="text-sm w-8 text-right text-slate-600 dark:text-slate-300">{count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Weekly Trends */}
      <div className="card">
        <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex items-center gap-2">
          <TrendingUp size={20} className="text-primary-500" />
          <span className="font-bold text-slate-800 dark:text-slate-100">12-Week Submission Trend</span>
        </div>
        <div className="p-4 flex gap-1.5 items-end h-[120px]">
          {(trends?.weekly_trends || []).map((w, i) => {
            const pct = Math.round((w.count / maxWeekly) * 100)
            const d = new Date(w.week_end)
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-[10px] font-semibold text-slate-700 dark:text-slate-200">{w.count}</span>
                <div className="w-full bg-teal-500 rounded-t" style={{ height: `${Math.max(4, pct)}%`, minHeight: '4px' }} />
                <span className="text-[10px] text-slate-500">{MONTH_NAMES[d.getMonth()]}{d.getDate()}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
