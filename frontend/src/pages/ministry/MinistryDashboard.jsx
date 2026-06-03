import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts'
import {
  ArrowRight, Building2, FileEdit, PenLine, Send, Undo2, Activity, Gavel,
  TrendingUp, TrendingDown,
} from 'lucide-react'
import api from '../../api/client'
import useChartColors from '../../hooks/useChartColors'
import { useAuth } from '../../context/AuthContext'
import { stageLabel, stageBadgeClass, stageMeta } from '../../constants/stages'
import { normalizeListPayload } from '../../utils/listPayload'
import StatCard from '../../components/shared/StatCard'

// ── Stage groupings (mirror backend tracker.models.WorkflowStage) ─────────────
const STAGE_GROUPS = {
  draft:        ['draft'],
  awaiting_dg:  ['pending_dg_endorsement'],
  dg_endorsed:  ['dg_approved'],
  returned:     ['returned_for_clarification', 'deferred_back_to_hr'],
  psc_review: [
    'pending_manager_approval', 'pending_second_approval', 'submitted',
    'received_by_psc', 'registered_routed', 'manager_checklist_review',
    'under_assessment', 'compliance_under_review', 'resubmitted', 'deferred',
    'tabled', 'awaiting_legal_advice', 'awaiting_cabinet_decision',
    'forwarded_to_commission', 'commission_sitting', 'matters_arising',
  ],
  decided: [
    'approved', 'rejected', 'returned', 'minutes_drafted_signed',
    'decision_entered_assigned', 'under_implementation', 'implementation_report',
  ],
}
const DECIDED_SET = new Set(STAGE_GROUPS.decided)

const sumStages = (byStage, codes) => codes.reduce((total, code) => total + (byStage[code] || 0), 0)

// Workflow-status KPI cards (ministry-specific framing for DG + HR).
const KPIS = [
  { id: 'draft',       labelKey: 'ministry_dashboard.hr.drafts',           icon: FileEdit, color: 'blue',    stages: STAGE_GROUPS.draft },
  { id: 'awaiting_dg', labelKey: 'ministry_dashboard.hr.awaiting_dg',      icon: PenLine,  color: 'amber',   stages: STAGE_GROUPS.awaiting_dg },
  { id: 'ready',       labelKey: 'ministry_dashboard.hr.ready_to_submit',  icon: Send,     color: 'cyan',    stages: STAGE_GROUPS.dg_endorsed },
  { id: 'returned',    labelKey: 'ministry_dashboard.hr.returned',         icon: Undo2,    color: 'red',     stages: STAGE_GROUPS.returned },
  { id: 'psc_review',  labelKey: 'ministry_dashboard.hr.under_psc_review', icon: Activity, color: 'purple',  stages: STAGE_GROUPS.psc_review },
  { id: 'decided',     labelKey: 'ministry_dashboard.hr.decided',          icon: Gavel,    color: 'emerald', stages: STAGE_GROUPS.decided },
]

const TREND_WINDOWS = [
  { key: '3m', months: 3,  labelKey: 'ministry_dashboard.range_3m', fallback: '3M' },
  { key: '6m', months: 6,  labelKey: 'ministry_dashboard.range_6m', fallback: '6M' },
  { key: '1y', months: 12, labelKey: 'ministry_dashboard.range_1y', fallback: '1Y' },
]

// Build a real monthly Received-vs-Decided trend from the ministry's own
// submissions, bucketed by received month (last 12 months).
function buildMonthlyTrend(submissions) {
  const now = new Date()
  const months = []
  const index = {}
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${d.getMonth()}`
    index[key] = months.length
    months.push({ key, label: d.toLocaleString(undefined, { month: 'short' }), received: 0, decided: 0 })
  }
  for (const s of submissions) {
    if (!s.received_at) continue
    const d = new Date(s.received_at)
    const i = index[`${d.getFullYear()}-${d.getMonth()}`]
    if (i == null) continue
    months[i].received += 1
    if (DECIDED_SET.has(s.current_stage)) months[i].decided += 1
  }
  return months
}

function chartColorForStage(code, colors) {
  const name = stageMeta(code).color
  const map = {
    slate: colors.axis, blue: colors.primary, indigo: colors.violet,
    violet: colors.violet, orange: colors.amber, amber: colors.amber,
    cyan: colors.cyan, purple: colors.violet, emerald: colors.emerald,
    red: '#ef4444', rose: '#f43f5e', teal: colors.cyan, green: colors.emerald,
  }
  return map[name] || colors.primary
}

// ── Small presentational helpers ──────────────────────────────────────────────
function TrendBadge({ value, inversed = false }) {
  if (value == null || Number.isNaN(value)) return null
  const up = value >= 0
  const positive = inversed ? !up : up
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-semibold ${positive ? 'text-emerald-500' : 'text-red-500'}`}>
      {up ? <TrendingUp size={12} /> : <TrendingDown size={12} />}{up ? '+' : ''}{value}%
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

function SparkStat({ title, value, sub, sparkData, sparkType, color, gradId }) {
  return (
    <div className="card card-compact flex flex-col gap-2">
      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider leading-snug">{title}</p>
      <p className="text-3xl font-bold text-slate-900 dark:text-slate-50 leading-none">{value}</p>
      <div className="-mx-1"><Sparkline data={sparkData} color={color} type={sparkType} gradId={gradId} /></div>
      {sub && <p className="text-xs text-slate-400 dark:text-slate-500 -mt-1">{sub}</p>}
    </div>
  )
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg px-3 py-2">
      <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">{label}</p>
      {payload.map(p => (
        <p key={p.dataKey} className="text-xs" style={{ color: p.color }}>{p.name}: <strong>{p.value}</strong></p>
      ))}
    </div>
  )
}

/**
 * Ministry dashboard for Head of Agency (DG) and Ministry HR. All figures are
 * ministry-scoped server-side by `_submission_queryset_for` (backend/tracker/views.py);
 * the monthly trend is built client-side from the ministry's own submissions.
 */
export default function MinistryDashboard() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const colors = useChartColors()
  const [state, setState] = useState({ loading: true, stats: null, subs: [] })
  const [range, setRange] = useState('1y')

  useEffect(() => {
    let cancelled = false
    Promise.all([
      api.get('/dashboard/').then(r => r.data).catch(() => null),
      api.get('/dashboard/stats/').then(r => r.data).catch(() => null),
      api.get('/submissions/?page_size=500').then(r => normalizeListPayload(r.data)).catch(() => []),
    ]).then(([dashboard, stats, subs]) => {
      if (cancelled) return
      setState({ loading: false, stats: { dashboard, stats }, subs })
    })
    return () => { cancelled = true }
  }, [])

  const m = useMemo(() => {
    const dashboard = state.stats?.dashboard || {}
    const stats = state.stats?.stats || {}
    const byStage = stats.stage_breakdown || dashboard.by_stage || {}
    const total = dashboard.total_submissions ?? stats.total_submissions ?? 0
    const overdue = stats.overdue_count ?? dashboard.assessment_overdue_count ?? 0
    const decided = sumStages(byStage, STAGE_GROUPS.decided)
    const active = Math.max(0, total - decided)
    const completionRate = total > 0 ? (decided / total) * 100 : 0
    return {
      byStage, total, overdue, decided, active, completionRate,
      submittedThisWeek: stats.submitted_this_week ?? 0,
      submittedThisMonth: stats.submitted_this_month ?? 0,
      slaPct: stats.sla_compliance_pct,
    }
  }, [state.stats])

  const monthly = useMemo(() => buildMonthlyTrend(state.subs), [state.subs])
  const trendData = useMemo(() => {
    const win = TREND_WINDOWS.find(w => w.key === range) || TREND_WINDOWS[2]
    return monthly.slice(-win.months)
  }, [monthly, range])

  const spkReceived = monthly.map(x => ({ v: x.received }))
  const spkDecided = monthly.map(x => ({ v: x.decided }))
  const spkActive = monthly.map(x => ({ v: Math.max(0, x.received - x.decided) }))

  const stageData = useMemo(() => (
    Object.entries(m.byStage)
      .filter(([, count]) => count > 0)
      .map(([code, count]) => ({ code, label: stageLabel(code, t), count, fill: chartColorForStage(code, colors) }))
      .sort((a, b) => b.count - a.count)
  ), [m.byStage, colors, t])

  const recent = useMemo(() => (
    [...state.subs]
      .sort((a, b) => new Date(b.received_at || 0) - new Date(a.received_at || 0))
      .slice(0, 8)
  ), [state.subs])

  const ministryName = user?.ministry?.name
  const empty = !state.loading && m.total === 0
  const completionStr = m.total > 0 ? m.completionRate.toFixed(1) : '—'

  return (
    <div className="space-y-4">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-slate-900 dark:text-slate-50">
            {t('ministry_dashboard.title', { defaultValue: 'Ministry Dashboard' })}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {t('ministry_dashboard.subtitle', { defaultValue: "Your ministry's submissions across the lodging workflow" })}
          </p>
        </div>
        {ministryName && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 dark:bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300">
            <Building2 size={13} aria-hidden="true" />{ministryName}
          </span>
        )}
      </div>

      {empty && (
        <div className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950 dark:border-sky-900/50 dark:bg-sky-950/40 dark:text-sky-100">
          <p className="font-medium">{t('ministry_dashboard.empty_title')}</p>
          <p className="mt-1 text-sky-900/90 dark:text-sky-200/90">{t('ministry_dashboard.empty_hint')}</p>
        </div>
      )}

      {/* ── Hero: activity overview + mini cards ───────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 card card-compact">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200">{t('ministry_dashboard.activity_title', { defaultValue: 'Submission Activity' })}</h2>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{t('ministry_dashboard.activity_sub', { defaultValue: 'Received and decided over time' })}</p>
            </div>
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-700 rounded-lg p-1" role="group">
              {TREND_WINDOWS.map(w => (
                <button
                  key={w.key}
                  type="button"
                  onClick={() => setRange(w.key)}
                  aria-pressed={range === w.key}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${range === w.key ? 'bg-white dark:bg-slate-600 text-slate-800 dark:text-slate-200 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
                >
                  {t(w.labelKey, { defaultValue: w.fallback })}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-4 gap-4 mb-5 pb-4 border-b border-slate-100 dark:border-slate-700">
            {[
              { label: t('dashboard.submissions_total', { defaultValue: 'Submissions' }), value: m.total, color: 'text-slate-800 dark:text-slate-100' },
              { label: t('dashboard.completion_rate', { defaultValue: 'Completion Rate' }), value: `${completionStr}%`, color: 'text-emerald-600 dark:text-emerald-400' },
              { label: t('dashboard.active_cases', { defaultValue: 'Active Cases' }), value: m.active, color: 'text-sky-600 dark:text-sky-400' },
              { label: t('dashboard.overdue_21', { defaultValue: 'Overdue (21-day)' }), value: m.overdue, color: 'text-amber-600 dark:text-amber-400' },
            ].map(s => (
              <div key={s.label}>
                <p className="text-xs text-slate-400 dark:text-slate-500 mb-1">{s.label}</p>
                <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              </div>
            ))}
          </div>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                <defs>
                  <linearGradient id="mdReceived" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={colors.primary} stopOpacity={0.20} />
                    <stop offset="95%" stopColor={colors.primary} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="mdDecided" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={colors.cyan} stopOpacity={0.20} />
                    <stop offset="95%" stopColor={colors.cyan} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: colors.axis }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: colors.axis }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="received" name={t('dashboard.received', { defaultValue: 'Received' })} stroke={colors.primary} strokeWidth={2} fill="url(#mdReceived)" dot={false} />
                <Area type="monotone" dataKey="decided" name={t('dashboard.decided', { defaultValue: 'Decided' })} stroke={colors.cyan} strokeWidth={2} fill="url(#mdDecided)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center gap-4 mt-3">
            <span className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400"><span className="w-3 h-0.5 rounded" style={{ backgroundColor: colors.primary }} />{t('dashboard.received', { defaultValue: 'Received' })}</span>
            <span className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400"><span className="w-3 h-0.5 rounded" style={{ backgroundColor: colors.cyan }} />{t('dashboard.decided', { defaultValue: 'Decided' })}</span>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <SparkStat
            title={t('dashboard.completion_rate', { defaultValue: 'Completion Rate' })}
            value={<>{completionStr}<span className="text-lg text-slate-400 dark:text-slate-500">%</span></>}
            sub={t('dashboard.completion_rate_sub', { defaultValue: 'Cases decided vs. total received' })}
            sparkData={spkDecided} sparkType="area" color={colors.emerald} gradId="mdSpkCr"
          />
          <SparkStat
            title={t('ministry_dashboard.all_submissions', { defaultValue: 'All Submissions' })}
            value={m.total}
            sub={t('ministry_dashboard.all_submissions_sub', { defaultValue: 'Total lodged by your ministry' })}
            sparkData={spkReceived} sparkType="bar" color={colors.violet || '#8b5cf6'} gradId="mdSpkAll"
          />
        </div>
      </div>

      {/* ── Workflow-status KPI cards ──────────────────────────────────────── */}
      <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">
        {KPIS.map(({ id, labelKey, icon, color, stages }) => (
          <StatCard
            key={id}
            title={t(labelKey)}
            value={state.loading ? '—' : sumStages(m.byStage, stages)}
            icon={icon}
            color={color}
          />
        ))}
      </div>

      {/* ── Pipeline + key metrics ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 card card-compact">
          <div className="flex items-start justify-between mb-1">
            <div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">{t('ministry_dashboard.pipeline_title', { defaultValue: 'Monthly Pipeline' })}</h3>
              <p className="text-xs text-primary-500 dark:text-primary-400 mt-0.5">{t('ministry_dashboard.pipeline_sub', { defaultValue: 'Received vs decided per month' })}</p>
            </div>
          </div>
          <div className="h-64 mt-3">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trendData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: colors.axis }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: colors.axis }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="received" name={t('dashboard.received', { defaultValue: 'Received' })} fill={colors.primary} radius={[3, 3, 0, 0]} maxBarSize={18} />
                <Bar dataKey="decided" name={t('dashboard.decided', { defaultValue: 'Decided' })} fill={colors.cyan} radius={[3, 3, 0, 0]} maxBarSize={18} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card card-compact">
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-4">{t('ministry_dashboard.key_metrics', { defaultValue: 'Key Metrics' })}</h3>
          <div className="space-y-4">
            {[
              { label: t('ministry_dashboard.metric_this_week', { defaultValue: 'Lodged this week' }), value: m.submittedThisWeek },
              { label: t('ministry_dashboard.metric_this_month', { defaultValue: 'Lodged this month' }), value: m.submittedThisMonth },
              { label: t('dashboard.active_cases', { defaultValue: 'Active cases' }), value: m.active },
              { label: t('ministry_dashboard.metric_sla', { defaultValue: 'SLA compliance' }), value: m.slaPct == null ? '—' : `${m.slaPct}%` },
            ].map(row => (
              <div key={row.label} className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center shrink-0">
                    <Activity size={13} className="text-slate-500 dark:text-slate-400" />
                  </div>
                  <p className="text-xs font-medium text-slate-700 dark:text-slate-300">{row.label}</p>
                </div>
                <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{row.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Stage breakdown + recent submissions ───────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-1 card card-compact">
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-1">{t('ministry_dashboard.stage_breakdown')}</h3>
          <p className="text-xs text-slate-400 dark:text-slate-500 mb-3">{t('ministry_dashboard.stage_breakdown_sub')}</p>
          {stageData.length === 0 ? (
            <p className="text-xs text-slate-500 dark:text-slate-400 py-6 text-center">{t('ministry_dashboard.no_data')}</p>
          ) : (
            <div style={{ height: Math.max(160, stageData.length * 34) }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stageData} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: colors.axis }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <YAxis type="category" dataKey="label" width={150} tick={{ fontSize: 10, fill: colors.axis }} axisLine={false} tickLine={false} />
                  <Tooltip cursor={{ fill: 'rgba(148,163,184,0.08)' }} />
                  <Bar dataKey="count" name={t('ministry_dashboard.count')} radius={[0, 4, 4, 0]} maxBarSize={20}>
                    {stageData.map(d => <Cell key={d.code} fill={d.fill} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="xl:col-span-2 card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-700">
            <div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">{t('ministry_dashboard.recent_submissions')}</h3>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{t('ministry_dashboard.recent_submissions_sub')}</p>
            </div>
            <Link to="/submissions" className="text-xs text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-0.5">
              {t('dashboard.view_all')} <ArrowRight size={11} aria-hidden="true" />
            </Link>
          </div>
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('submission.reference_short')}</th>
                  <th>{t('ministry_dashboard.subject')}</th>
                  <th>{t('submission.stage')}</th>
                  <th>{t('ministry_dashboard.received')}</th>
                </tr>
              </thead>
              <tbody>
                {recent.length === 0 && (
                  <tr><td colSpan={4} className="text-xs text-slate-500 dark:text-slate-400 py-6 text-center">{t('ministry_dashboard.no_submissions')}</td></tr>
                )}
                {recent.map(row => (
                  <tr key={row.id}>
                    <td className="font-mono text-xs font-semibold text-primary-600 dark:text-primary-400 whitespace-nowrap">
                      <Link to={`/submissions/${row.id}`} className="hover:underline">{row.reference_number}</Link>
                    </td>
                    <td className="text-xs text-slate-700 dark:text-slate-300 max-w-[240px] truncate">{row.title || '—'}</td>
                    <td className="whitespace-nowrap">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${stageBadgeClass(row.current_stage)}`}>
                        {stageLabel(row.current_stage, t)}
                      </span>
                    </td>
                    <td className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      {row.received_at ? new Date(row.received_at).toLocaleDateString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
