import { useEffect, useState, useMemo } from 'react'
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import api from '../../api/client'
import useChartColors from '../../hooks/useChartColors'
import { stageLabel } from '../../constants/stages'
import { normalizeListPayload } from '../../utils/listPayload'
import InboxBriefCard from '../../components/dashboard/InboxBriefCard'
import { TrendingUp, TrendingDown, FileText, Activity, ArrowRight } from 'lucide-react'
import EmptyState from '../../components/shared/EmptyState'

const DECIDED_STAGES = new Set([
  'approved','rejected','returned','minutes_drafted_signed',
  'decision_entered_assigned','under_implementation','implementation_report',
])

// ── Tiny helpers ──────────────────────────────────────────────────────────────

function TrendBadge({ value, inversed = false }) {
  if (value == null || Number.isNaN(value)) return null
  const up = value >= 0
  const positive = inversed ? !up : up
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-semibold ${positive ? 'text-emerald-500' : 'text-red-500'}`}>
      {up ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
      {up ? '+' : ''}{value}%
    </span>
  )
}

function Sparkline({ data, color, type = 'area', gradId }) {
  if (type === 'bar') {
    return (
      <ResponsiveContainer width="100%" height={52}>
        <BarChart data={data} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
          <Bar dataKey="v" fill={color} radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    )
  }
  return (
    <ResponsiveContainer width="100%" height={52}>
      <AreaChart data={data} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.3} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey="v" stroke={color} strokeWidth={1.5} fill={`url(#${gradId})`} dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  )
}

function StatCard({ title, value, unit = '', trend, trendInversed = false, sub, sparkData, sparkType = 'area', color, gradId }) {
  return (
    <div className="card card-compact flex flex-col gap-2">
      <div className="flex items-start justify-between">
        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider leading-snug">{title}</p>
        <TrendBadge value={trend} inversed={trendInversed} />
      </div>
      <p className="text-3xl font-bold text-slate-900 dark:text-slate-50 leading-none">
        {value}<span className="text-base font-medium text-slate-500 dark:text-slate-400 ml-1">{unit}</span>
      </p>
      {sparkData && (
        <div className="-mx-1">
          <Sparkline data={sparkData} color={color} type={sparkType} gradId={gradId} />
        </div>
      )}
      <p className="text-xs text-slate-500 dark:text-slate-400">{sub}</p>
    </div>
  )
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg px-3 py-2">
      <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">{label}</p>
      {payload.map(p => (
        <p key={p.dataKey} className="text-xs" style={{ color: p.color }}>
          {p.name}: <strong>{p.value}</strong>
        </p>
      ))}
    </div>
  )
}

// ── Main dashboard ────────────────────────────────────────────────────────────

export default function PscDashboard() {
  const { t } = useTranslation()
  const colors = useChartColors()
  const [board, setBoard] = useState({ loading: true, data: null })
  const [stats, setStats] = useState(null)

  const [weekly, setWeekly] = useState([])
  const [recent, setRecent] = useState({ loading: true, rows: [] })

  useEffect(() => {
    api
      .get('/dashboard/')
      .then(r => setBoard({ loading: false, data: r.data }))
      .catch(() => setBoard({ loading: false, data: null }))
    api
      .get('/dashboard/stats/')
      .then(r => setStats(r.data))
      .catch(() => setStats(null))
    api
      .get('/analytics/trends/')
      .then(r => setWeekly((r.data?.weekly_trends ?? []).map(w => ({
        week: new Date(`${w.week_start}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        received: w.count,
      }))))
      .catch(() => setWeekly([]))
    api
      .get('/submissions/', { params: { page_size: 6 } })
      .then(r => setRecent({ loading: false, rows: normalizeListPayload(r.data) }))
      .catch(() => setRecent({ loading: false, rows: [] }))
  }, [])

  const apiData = board.data
  /** Until the request succeeds we show "—", never placeholder figures. */
  const useLiveTotals = !board.loading && apiData != null
  const show = v => (useLiveTotals ? v : '—')

  // ── Derived metrics ────────────────────────────────────────────────────────

  const total = useLiveTotals ? (apiData.total_submissions ?? 0) : 0
  const overdue = useLiveTotals ? (apiData.assessment_overdue_count ?? 0) : 0

  const byStage = useLiveTotals ? (apiData.by_stage ?? {}) : {}
  const decidedCount = Object.entries(byStage)
    .filter(([s]) => DECIDED_STAGES.has(s))
    .reduce((sum, [, c]) => sum + c, 0)
  const activeCount = total - decidedCount

  const completionRate = total > 0 ? ((decidedCount / total) * 100).toFixed(1) : '—'

  const ministryData = useMemo(() => {
    const rows = apiData?.submissions_by_ministry
    if (!useLiveTotals) return []
    if (!rows || rows.length === 0) return []
    return rows.slice(0, 6)
  }, [apiData, useLiveTotals])

  const stageData = useMemo(() => (
    Object.entries(byStage)
      .filter(([, count]) => count > 0)
      .map(([code, count]) => ({ code, label: stageLabel(code, t), count }))
      .sort((a, b) => b.count - a.count)
  ), [byStage, t])

  const ministryMax = ministryData.reduce((m, r) => Math.max(m, r.c), 1)

  const spkSubmissions = weekly.map(w => ({ v: w.received }))

  return (
    <div className="space-y-4">
      {/* Visually hidden — the page otherwise jumps straight to h2 widget
          titles with no h1 identifying the page itself (WCAG 1.3.1/2.4.6).
          The breadcrumb already shows "Dashboard" visibly, so no visible
          duplicate heading is needed. */}
      <h1 className="sr-only">{t('breadcrumb.dashboard')}</h1>
      <InboxBriefCard />
      {useLiveTotals && total === 0 && (
        <div className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950 dark:border-sky-900/50 dark:bg-sky-950/40 dark:text-sky-100">
          <p className="font-medium">{t('dashboard.seed_banner_title')}</p>
          <p className="mt-1 text-sky-900/90 dark:text-sky-200/90">
            {t('dashboard.seed_banner_hint', {
              seed: 'python manage.py seed_tracker',
              backend: 'backend',
              flag: 'AUTO_SEED=1',
            })}
          </p>
        </div>
      )}

      {/* ── Section 1: Hero row ───────────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">

        {/* Main activity card */}
        <div className="xl:col-span-2 card card-compact">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200">{t('dashboard.activity_overview')}</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{t('dashboard.activity_overview_sub')}</p>
            </div>
          </div>

          {/* Inline stats row */}
          <div className="grid grid-cols-4 gap-4 mb-5 pb-4 border-b border-slate-100 dark:border-slate-700">
            {[
              { label: t('dashboard.submissions_total'),  value: show(total),                color: 'text-slate-800 dark:text-slate-100' },
              { label: t('dashboard.completion_rate'),    value: useLiveTotals ? `${completionRate}%` : '—', color: 'text-emerald-600 dark:text-emerald-400' },
              { label: t('dashboard.active_cases'),       value: show(activeCount),          color: 'text-sky-600 dark:text-sky-400' },
              { label: t('dashboard.overdue_21'),         value: show(overdue),              color: 'text-amber-600 dark:text-amber-400' },
            ].map(({ label, value, color }) => (
              <div key={label}>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">{label}</p>
                <p className={`text-2xl font-bold ${color}`}>{value}</p>
              </div>
            ))}
          </div>

          {/* Area chart */}
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={weekly} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                <defs>
                  <linearGradient id="gradReceived" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={colors.primary} stopOpacity={0.20} />
                    <stop offset="95%" stopColor={colors.primary} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
                <XAxis dataKey="week" tick={{ fontSize: 11, fill: colors.axis }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: colors.axis }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="received" name={t('dashboard.received')} stroke={colors.primary} strokeWidth={2} fill="url(#gradReceived)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="flex items-center gap-4 mt-3">
            <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <span className="w-3 h-0.5 rounded" style={{ backgroundColor: colors.primary }} aria-hidden="true" />
              {t('dashboard.received')}
            </div>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {t('dashboard.weekly_window', { defaultValue: 'Last 12 weeks' })}
            </span>
          </div>
        </div>

        {/* Right stacked mini cards */}
        <div className="flex flex-col gap-4">
          {/* Completion rate */}
          <div className="card card-compact flex-1">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t('dashboard.completion_rate')}</p>
            </div>
            <p className="text-4xl font-bold text-slate-900 dark:text-slate-50 mt-1">{useLiveTotals ? completionRate : '—'}<span className="text-lg text-slate-500 dark:text-slate-400">%</span></p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 mb-3">{t('dashboard.completion_rate_sub')}</p>
            <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={useLiveTotals && total > 0 ? Math.round((decidedCount / total) * 100) : 0} aria-label={t('dashboard.completion_rate')}>
              <div className="h-full rounded-full transition-all duration-500" style={{ width: `${useLiveTotals && total > 0 ? (decidedCount / total) * 100 : 0}%`, backgroundColor: colors.emerald }} />
            </div>
          </div>

          {/* Total cases with bar sparkline */}
          <div className="card card-compact flex-1">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t('dashboard.all_submissions')}</p>
            </div>
            <p className="text-4xl font-bold text-slate-900 dark:text-slate-50 mt-1">{show(total)}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 mb-3">{t('dashboard.all_submissions_sub')}</p>
            <div className="h-16">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={spkSubmissions} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
                  <Bar dataKey="v" fill={colors.violet || '#8b5cf6'} radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* ── Section 2: 4 stat cards ───────────────────────────────────────── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          title={t('dashboard.stat_total_submissions')}
          value={show(total)}
          sub={stats ? t('dashboard.stat_total_submissions_sub', { count: stats.submitted_this_week }) : ''}
          sparkData={spkSubmissions}
          sparkType="area"
          color={colors.primary}
          gradId="spk1"
        />
        <StatCard
          title={t('dashboard.active_cases')}
          value={show(activeCount)}
          sub={t('dashboard.stat_active_sub', { count: overdue })}
          sparkType="area"
          color={colors.cyan}
          gradId="spk2"
        />
        <StatCard
          title={t('dashboard.stat_decisions')}
          value={show(decidedCount)}
          sub={t('dashboard.stat_decisions_sub')}
          sparkType="area"
          color={colors.emerald}
          gradId="spk3"
        />
        <StatCard
          title={t('dashboard.overdue_21')}
          value={show(overdue)}
          sub={t('dashboard.stat_overdue_sub')}
          sparkType="bar"
          color={colors.amber}
          gradId="spk4"
        />
      </div>

      {/* ── Section 3: Stage breakdown + Key metrics ─────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">

        {/* Submissions by stage — live counts from /dashboard/ */}
        <div className="xl:col-span-2 card card-compact">
          <div className="mb-1">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">{t('dashboard.pipeline')}</h3>
            <p className="text-xs text-primary-500 dark:text-primary-400 mt-0.5">{t('dashboard.pipeline_sub')}</p>
          </div>
          {stageData.length === 0 ? (
            <EmptyState icon={Activity} title={useLiveTotals ? t('dashboard.no_ministry_breakdown') : t('common.loading')} />
          ) : (
            <div className="h-64 mt-3">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stageData} layout="vertical" margin={{ top: 4, right: 16, bottom: 0, left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} horizontal={false} />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: colors.axis }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="label" width={150} tick={{ fontSize: 11, fill: colors.axis }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="count" name={t('dashboard.all_submissions')} fill={colors.primary} radius={[0, 3, 3, 0]} maxBarSize={18} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4">

          {/* Key Metrics */}
          <div className="card card-compact">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">{t('dashboard.key_metrics')}</h3>
            </div>
            <div className="space-y-4">
              {[
                { label: t('dashboard.metric_processing_time'), value: stats ? `${stats.ai_brief_processing_rate}%` : '—' },
                { label: t('dashboard.metric_compliance'),      value: stats ? `${stats.sla_compliance_pct}%` : '—' },
                { label: t('dashboard.metric_decisions_month'), value: stats ? stats.submitted_this_month : '—' },
                { label: t('dashboard.metric_sitting_items'),   value: stats ? stats.submitted_this_week : '—' },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5 flex-1">
                    <div className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center shrink-0">
                      <Activity size={13} className="text-slate-500 dark:text-slate-400" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-slate-700 dark:text-slate-300">{label}</p>
                      <p className="text-sm font-bold text-slate-900 dark:text-slate-100 leading-tight">{value}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Section 4: Recent submissions + Top ministries ───────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">

        {/* Recent Submissions table */}
        <div className="xl:col-span-2 card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-700">
            <div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">{t('dashboard.recent_submissions')}</h3>
              <p className="text-xs text-primary-500 dark:text-primary-400 mt-0.5">{t('dashboard.recent_submissions_sub')}</p>
            </div>
            <Link to="/submissions" className="text-xs text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-0.5">
              {t('dashboard.view_all')} <ArrowRight size={11} aria-hidden="true" />
            </Link>
          </div>
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">{t('submission.reference_short')}</th>
                  <th scope="col">{t('dashboard.subject')}</th>
                  <th scope="col">{t('submission.ministry')}</th>
                  <th scope="col">{t('submission.stage')}</th>
                  <th scope="col">{t('submission.status')}</th>
                </tr>
              </thead>
              <tbody>
                {recent.loading && Array.from({ length: 4 }, (_, i) => (
                  <tr key={`sk-${i}`} aria-hidden="true"><td colSpan={5} className="py-3"><div className="h-4 w-full rounded bg-slate-100 dark:bg-slate-700 animate-pulse" /></td></tr>
                ))}
                {!recent.loading && recent.rows.length === 0 && (
                  <tr><td colSpan={5}><EmptyState icon={FileText} title={t('submission.empty_state_title')} /></td></tr>
                )}
                {recent.rows.map(row => (
                  <tr key={row.id}>
                    <td className="whitespace-nowrap">
                      <Link to={`/submissions/${row.id}`} className="font-mono text-xs font-semibold text-primary-600 dark:text-primary-400 hover:underline">
                        {row.reference_number}
                      </Link>
                    </td>
                    <td className="text-xs text-slate-700 dark:text-slate-300 max-w-[200px] truncate">{row.title}</td>
                    <td className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      {(row.ministry_name || '—').replace('Ministry of ', 'Min. ')}
                    </td>
                    <td className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      {stageLabel(row.current_stage, t)}
                    </td>
                    <td>
                      {row.is_assessment_overdue ? (
                        <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/30 dark:text-red-300">{t('submission.overdue')}</span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">{t('dashboard.on_track')}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Top Ministries */}
        <div className="card card-compact">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">{t('dashboard.top_ministries')}</h3>
            <Link to="/submissions" className="text-xs text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-0.5">
              {t('dashboard.view_all_short')} <ArrowRight size={11} aria-hidden="true" />
            </Link>
          </div>
          <div className="space-y-3.5">
            {ministryData.length === 0 && (
              <p className="text-xs text-slate-500 dark:text-slate-400 py-2">
                {t('dashboard.no_ministry_breakdown')}
              </p>
            )}
            {ministryData.map((row, i) => {
              const name  = row.ministry__name || '—'
              const count = row.c
              const pct   = Math.round((count / ministryMax) * 100)
              const short = name.replace('Ministry of ', '').replace("Prime Minister's Office", "PM's Office")
              return (
                <div key={i}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-[10px] font-bold text-slate-500 dark:text-slate-400 shrink-0" aria-hidden="true">
                        {short.slice(0, 2).toUpperCase()}
                      </span>
                      <span className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate max-w-[130px]">{short}</span>
                    </div>
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{pct}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${pct}%`, backgroundColor: colors.primary }}
                    />
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">{t('dashboard.ministry_count', { count })}</p>
                </div>
              )
            })}
          </div>
        </div>
      </div>

    </div>
  )
}
