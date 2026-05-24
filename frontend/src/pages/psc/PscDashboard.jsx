import { useEffect, useState, useMemo } from 'react'
import {
  AreaChart, Area, BarChart, Bar,
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import api from '../../api/client'
import useChartColors from '../../hooks/useChartColors'
import { stageLabel } from '../../constants/stages'
import {
  TrendingUp, TrendingDown, FileText, CheckCircle2,
  AlertTriangle, Activity, Zap, ArrowRight,
} from 'lucide-react'

// ── Static mock data (replace with API when endpoints exist) ──────────────────

const MONTHLY_TREND = [
  { month: 'Jan', received: 22, decided: 14, target: 20 },
  { month: 'Feb', received: 31, decided: 22, target: 22 },
  { month: 'Mar', received: 27, decided: 20, target: 22 },
  { month: 'Apr', received: 35, decided: 28, target: 25 },
  { month: 'May', received: 29, decided: 18, target: 25 },
  { month: 'Jun', received: 38, decided: 30, target: 28 },
  { month: 'Jul', received: 42, decided: 33, target: 28 },
  { month: 'Aug', received: 36, decided: 29, target: 30 },
  { month: 'Sep', received: 44, decided: 35, target: 30 },
  { month: 'Oct', received: 39, decided: 32, target: 32 },
  { month: 'Nov', received: 47, decided: 38, target: 32 },
  { month: 'Dec', received: 51, decided: 41, target: 35 },
]

const WEEKLY_INTAKE = [
  { day: 'Mon', new: 8,  returned: 2 },
  { day: 'Tue', new: 12, returned: 1 },
  { day: 'Wed', new: 6,  returned: 3 },
  { day: 'Thu', new: 15, returned: 2 },
  { day: 'Fri', day2: 'Fri', new: 17, returned: 4 },
  { day: 'Sat', new: 5,  returned: 1 },
  { day: 'Sun', new: 3,  returned: 1 },
]

/** Radar dimensions keyed for translation; `metric` is filled at render time. */
const RADAR_KEYS = [
  { key: 'radar_processing', value: 76 },
  { key: 'radar_compliance', value: 88 },
  { key: 'radar_timeliness', value: 64 },
  { key: 'radar_completion', value: 74 },
  { key: 'radar_quality',    value: 82 },
  { key: 'radar_volume',     value: 91 },
]

const ACTIVITY_FEED = [
  { id: 1, icon: CheckCircle2, color: 'text-emerald-500', text: 'Decision recorded — PSC-2025-00044 approved', sub: '2 min ago' },
  { id: 2, icon: FileText,     color: 'text-sky-500',     text: 'New submission logged — PSC-2025-00051 received at PSC', sub: '18 min ago' },
  { id: 3, icon: Activity,     color: 'text-violet-500',  text: 'PSC-2025-00043 advanced to Commission Sitting', sub: '1 hr ago' },
  { id: 4, icon: AlertTriangle,color: 'text-amber-500',   text: '21-day deadline passed — PSC-2025-00036 overdue', sub: '2 hr ago' },
  { id: 5, icon: CheckCircle2, color: 'text-emerald-500', text: 'Notification issued to Ministry of Finance', sub: '3 hr ago' },
  { id: 6, icon: FileText,     color: 'text-sky-500',     text: 'PSC-2025-00040 registered and routed to ODU', sub: '5 hr ago' },
  { id: 7, icon: Activity,     color: 'text-violet-500',  text: 'MTG-2025-009 agenda finalised — 4 items', sub: '1 day ago' },
  { id: 8, icon: FileText,     color: 'text-sky-500',     text: 'PSC-2025-00038 submitted for commission review', sub: '1 day ago' },
]

const RECENT_SUBMISSIONS = [
  { ref: 'PSC-2025-00051', title: 'Appointment — Director of Lands', ministry: 'Ministry of Lands',          stage: 'received_by_psc',           overdue: false },
  { ref: 'PSC-2025-00050', title: 'Reclassification — IT Officer OGCIO', ministry: "Prime Minister's Office", stage: 'manager_checklist_review',  overdue: false },
  { ref: 'PSC-2025-00048', title: 'Appointment — Principal Lands Officer', ministry: 'Ministry of Lands',    stage: 'forwarded_to_commission',   overdue: false },
  { ref: 'PSC-2025-00045', title: 'Promotion — Senior Nurse to Nursing Officer', ministry: 'Ministry of Health', stage: 'under_assessment',       overdue: false },
  { ref: 'PSC-2025-00043', title: 'Termination — Ministry of Infrastructure', ministry: 'Ministry of Infrastructure', stage: 'commission_sitting', overdue: false },
  { ref: 'PSC-2025-00036', title: 'Transfer — Education Officer', ministry: 'Ministry of Education',         stage: 'under_assessment',          overdue: true  },
]

const DECIDED_STAGES = new Set([
  'approved','rejected','returned','minutes_drafted_signed',
  'decision_entered_assigned','under_implementation','implementation_report',
])

// ── Tiny helpers ──────────────────────────────────────────────────────────────

function TrendBadge({ value, inversed = false }) {
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
        {value}<span className="text-base font-medium text-slate-400 dark:text-slate-500 ml-1">{unit}</span>
      </p>
      <div className="-mx-1">
        <Sparkline data={sparkData} color={color} type={sparkType} gradId={gradId} />
      </div>
      <p className="text-xs text-slate-400 dark:text-slate-500 -mt-1">{sub}</p>
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
  const [timeRange, setTimeRange] = useState('month') // day | week | month

  const radarData = useMemo(
    () => RADAR_KEYS.map(r => ({ metric: t(`dashboard.${r.key}`), value: r.value })),
    [t],
  )

  useEffect(() => {
    api
      .get('/dashboard/')
      .then(r => setBoard({ loading: false, data: r.data }))
      .catch(() => setBoard({ loading: false, data: null }))
  }, [])

  const apiData = board.data
  /** While loading or if the request failed, keep illustrative defaults instead of forcing zeros. */
  const useLiveTotals = !board.loading && apiData != null

  // ── Derived metrics ────────────────────────────────────────────────────────

  const total = useLiveTotals ? (apiData.total_submissions ?? 0) : 441
  const overdue = useLiveTotals ? (apiData.assessment_overdue_count ?? 0) : 7

  const byStage = useLiveTotals ? (apiData.by_stage ?? {}) : {}
  const decidedCount = Object.entries(byStage)
    .filter(([s]) => DECIDED_STAGES.has(s))
    .reduce((sum, [, c]) => sum + c, 0)
  const activeCount = total - decidedCount

  const completionRate = total > 0 ? ((decidedCount / total) * 100).toFixed(1) : '—'

  const ministryData = useMemo(() => {
    const rows = apiData?.submissions_by_ministry
    const fallback = [
      { ministry__name: 'Ministry of Finance',        c: 68 },
      { ministry__name: 'Ministry of Education',       c: 54 },
      { ministry__name: 'Ministry of Health',          c: 49 },
      { ministry__name: 'Ministry of Infrastructure',  c: 41 },
      { ministry__name: 'Ministry of Agriculture',     c: 37 },
      { ministry__name: "Prime Minister's Office",     c: 29 },
    ]
    if (!useLiveTotals) return fallback.slice(0, 6)
    if (!rows || rows.length === 0) return []
    return rows.slice(0, 6)
  }, [apiData, useLiveTotals])

  const ministryMax = ministryData.reduce((m, r) => Math.max(m, r.c), 1)

  // Sparkline seeds
  const spkSubmissions = [8,12,7,15,10,13,9,11,14,8,12,16].map(v => ({ v }))
  const spkActive      = [52,55,48,61,57,63,59,65,61,68,64,70].map(v => ({ v }))
  const spkDecided     = [6,9,7,11,8,12,10,14,11,15,13,16].map(v => ({ v }))
  const spkOverdue     = [3,2,4,3,5,4,6,5,7,6,8,7].map(v => ({ v }))

  // Trend chart data sliced by timeRange
  const trendData = timeRange === 'day'
    ? MONTHLY_TREND.slice(-3).flatMap(m => [
        { month: `${m.month} W1`, received: Math.round(m.received * 0.22), decided: Math.round(m.decided * 0.20) },
        { month: `${m.month} W2`, received: Math.round(m.received * 0.26), decided: Math.round(m.decided * 0.25) },
        { month: `${m.month} W3`, received: Math.round(m.received * 0.24), decided: Math.round(m.decided * 0.28) },
        { month: `${m.month} W4`, received: Math.round(m.received * 0.28), decided: Math.round(m.decided * 0.27) },
      ])
    : timeRange === 'week'
    ? MONTHLY_TREND.slice(-6)
    : MONTHLY_TREND

  return (
    <div className="space-y-4">
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
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{t('dashboard.activity_overview_sub')}</p>
            </div>
            <div
              className="flex items-center gap-1 bg-slate-100 dark:bg-slate-700 rounded-lg p-1"
              role="group"
              aria-label={t('common.filter')}
            >
              {[
                { key: 'day',   label: t('dashboard.range_day') },
                { key: 'week',  label: t('dashboard.range_week') },
                { key: 'month', label: t('dashboard.range_month') },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTimeRange(key)}
                  aria-pressed={timeRange === key}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                    timeRange === key
                      ? 'bg-white dark:bg-slate-600 text-slate-800 dark:text-slate-200 shadow-sm'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Inline stats row */}
          <div className="grid grid-cols-4 gap-4 mb-5 pb-4 border-b border-slate-100 dark:border-slate-700">
            {[
              { label: t('dashboard.submissions_total'),  value: total,                color: 'text-slate-800 dark:text-slate-100' },
              { label: t('dashboard.completion_rate'),    value: `${completionRate}%`, color: 'text-emerald-600 dark:text-emerald-400' },
              { label: t('dashboard.active_cases'),       value: activeCount,          color: 'text-sky-600 dark:text-sky-400' },
              { label: t('dashboard.overdue_21'),         value: overdue,              color: 'text-amber-600 dark:text-amber-400' },
            ].map(({ label, value, color }) => (
              <div key={label}>
                <p className="text-xs text-slate-400 dark:text-slate-500 mb-1">{label}</p>
                <p className={`text-2xl font-bold ${color}`}>{value}</p>
              </div>
            ))}
          </div>

          {/* Area chart */}
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                <defs>
                  <linearGradient id="gradReceived" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={colors.primary} stopOpacity={0.20} />
                    <stop offset="95%" stopColor={colors.primary} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradDecided" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={colors.cyan} stopOpacity={0.20} />
                    <stop offset="95%" stopColor={colors.cyan} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: colors.axis }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: colors.axis }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="received" name={t('dashboard.received')} stroke={colors.primary} strokeWidth={2} fill="url(#gradReceived)" dot={false} />
                <Area type="monotone" dataKey="decided"  name={t('dashboard.decided')}  stroke={colors.cyan}    strokeWidth={2} fill="url(#gradDecided)"  dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="flex items-center gap-4 mt-3">
            <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <span className="w-3 h-0.5 rounded" style={{ backgroundColor: colors.primary }} aria-hidden="true" />
              {t('dashboard.received')}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <span className="w-3 h-0.5 rounded" style={{ backgroundColor: colors.cyan }} aria-hidden="true" />
              {t('dashboard.decided')}
            </div>
          </div>
        </div>

        {/* Right stacked mini cards */}
        <div className="flex flex-col gap-4">
          {/* Completion rate */}
          <div className="card card-compact flex-1">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t('dashboard.completion_rate')}</p>
              <TrendBadge value={3.2} />
            </div>
            <p className="text-4xl font-bold text-slate-900 dark:text-slate-50 mt-1">{completionRate}<span className="text-lg text-slate-400 dark:text-slate-500">%</span></p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 mb-3">{t('dashboard.completion_rate_sub')}</p>
            <div className="h-16">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={spkDecided} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="gradCR" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={colors.emerald} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={colors.emerald} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area type="monotone" dataKey="v" stroke={colors.emerald} strokeWidth={2} fill="url(#gradCR)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Total cases with bar sparkline */}
          <div className="card card-compact flex-1">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t('dashboard.all_submissions')}</p>
              <TrendBadge value={12.5} />
            </div>
            <p className="text-4xl font-bold text-slate-900 dark:text-slate-50 mt-1">{total}</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 mb-3">{t('dashboard.all_submissions_sub')}</p>
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
          value={total}
          trend={12.5}
          sub={t('dashboard.stat_total_submissions_sub')}
          sparkData={spkSubmissions}
          sparkType="area"
          color={colors.primary}
          gradId="spk1"
        />
        <StatCard
          title={t('dashboard.active_cases')}
          value={activeCount}
          trend={8.3}
          sub={t('dashboard.stat_active_sub')}
          sparkData={spkActive}
          sparkType="area"
          color={colors.cyan}
          gradId="spk2"
        />
        <StatCard
          title={t('dashboard.stat_decisions')}
          value={decidedCount}
          trend={15.2}
          sub={t('dashboard.stat_decisions_sub')}
          sparkData={spkDecided}
          sparkType="area"
          color={colors.emerald}
          gradId="spk3"
        />
        <StatCard
          title={t('dashboard.overdue_21')}
          value={overdue}
          trend={0.5}
          trendInversed
          sub={t('dashboard.stat_overdue_sub')}
          sparkData={spkOverdue}
          sparkType="bar"
          color={colors.amber}
          gradId="spk4"
        />
      </div>

      {/* ── Section 3: Pipeline chart + Key metrics + Radar ─────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">

        {/* Monthly submissions bar chart */}
        <div className="xl:col-span-2 card card-compact">
          <div className="flex items-start justify-between mb-1">
            <div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">{t('dashboard.pipeline')}</h3>
              <p className="text-xs text-primary-500 dark:text-primary-400 mt-0.5">{t('dashboard.pipeline_sub')}</p>
            </div>
          </div>
          <div className="flex items-center gap-4 mb-4 mt-2">
            {[
              { color: colors.primary, label: t('dashboard.received') },
              { color: colors.cyan,    label: t('dashboard.decided')  },
              { color: colors.amber,   label: t('dashboard.target'),  dashed: true },
            ].map(({ color, label, dashed }) => (
              <div key={label} className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                <span
                  aria-hidden="true"
                  className={`w-4 h-0.5 rounded ${dashed ? 'border-t-2 border-dashed' : ''}`}
                  style={{ backgroundColor: dashed ? 'transparent' : color, borderColor: color }}
                />
                {label}
              </div>
            ))}
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={MONTHLY_TREND} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: colors.axis }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: colors.axis }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="received" name={t('dashboard.received')} fill={colors.primary} radius={[3, 3, 0, 0]} maxBarSize={18} />
                <Bar dataKey="decided"  name={t('dashboard.decided')}  fill={colors.cyan}    radius={[3, 3, 0, 0]} maxBarSize={18} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right column: Key Metrics + Radar */}
        <div className="flex flex-col gap-4">

          {/* Key Metrics */}
          <div className="card card-compact">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">{t('dashboard.key_metrics')}</h3>
            </div>
            <div className="space-y-4">
              {[
                { label: t('dashboard.metric_processing_time'), value: t('dashboard.metric_days', { count: 18.4 }), trend: -2.1, good: true },
                { label: t('dashboard.metric_compliance'),      value: '88.2%',                                     trend: 3.4,  good: true },
                { label: t('dashboard.metric_decisions_month'), value: '47',                                        trend: 8.2,  good: true },
                { label: t('dashboard.metric_sitting_items'),   value: '9.2',                                       trend: 0.8,  good: true },
              ].map(({ label, value, trend, good }) => (
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
                  <TrendBadge value={trend} inversed={!good} />
                </div>
              ))}
            </div>
          </div>

          {/* Workflow Performance Radar */}
          <div className="card card-compact flex-1">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-3">{t('dashboard.workflow_performance')}</h3>
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="70%">
                  <PolarGrid stroke={colors.grid} />
                  <PolarAngleAxis dataKey="metric" tick={{ fontSize: 10, fill: colors.axis }} />
                  <Radar
                    dataKey="value"
                    stroke={colors.primary}
                    fill={colors.primary}
                    fillOpacity={0.25}
                    strokeWidth={2}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* ── Section 4: Weekly intake + Top Ministries ─────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">

        {/* Weekly intake */}
        <div className="xl:col-span-2 card card-compact">
          <div className="flex items-start justify-between mb-1">
            <div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">{t('dashboard.weekly_intake')}</h3>
              <p className="text-xs text-primary-500 dark:text-primary-400 mt-0.5">{t('dashboard.weekly_intake_sub')}</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 text-xs text-slate-500"><span className="w-3 h-2 rounded-sm" style={{ backgroundColor: colors.primary }} aria-hidden="true" /> {t('dashboard.new')}</div>
              <div className="flex items-center gap-1.5 text-xs text-slate-500"><span className="w-3 h-2 rounded-sm" style={{ backgroundColor: colors.cyan }} aria-hidden="true" /> {t('dashboard.resubmitted')}</div>
            </div>
          </div>
          <div className="h-56 mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={WEEKLY_INTAKE} margin={{ top: 4, right: 4, bottom: 0, left: -20 }} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: colors.axis }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: colors.axis }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="new"       name={t('dashboard.new')}         fill={colors.primary} radius={[3, 3, 0, 0]} maxBarSize={28} />
                <Bar dataKey="returned"  name={t('dashboard.resubmitted')} fill={colors.cyan}    radius={[3, 3, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
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
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">{t('dashboard.ministry_count', { count })}</p>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* ── Section 5: Recent Submissions + Activity feed ─────────────────── */}
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
                  <th>{t('submission.reference_short')}</th>
                  <th>{t('dashboard.subject')}</th>
                  <th>{t('submission.ministry')}</th>
                  <th>{t('submission.stage')}</th>
                  <th>{t('submission.status')}</th>
                </tr>
              </thead>
              <tbody>
                {RECENT_SUBMISSIONS.map(row => (
                  <tr key={row.ref}>
                    <td className="font-mono text-xs font-semibold text-primary-600 dark:text-primary-400 whitespace-nowrap">
                      {row.ref}
                    </td>
                    <td className="text-xs text-slate-700 dark:text-slate-300 max-w-[200px] truncate">{row.title}</td>
                    <td className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      {row.ministry.replace('Ministry of ', 'Min. ')}
                    </td>
                    <td className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      {stageLabel(row.stage, t)}
                    </td>
                    <td>
                      {row.overdue ? (
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

        {/* Recent Activity feed */}
        <div className="card card-compact">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">{t('dashboard.recent_activity')}</h3>
            <span className="flex items-center gap-1.5 text-xs text-emerald-500 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" aria-hidden="true" />
              {t('dashboard.live')}
            </span>
          </div>
          <div className="space-y-4">
            {ACTIVITY_FEED.map(({ id, icon: Icon, color, text, sub }) => (
              <div key={id} className="flex items-start gap-3">
                <div className={`mt-0.5 shrink-0 ${color}`}>
                  <Icon size={15} aria-hidden="true" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-700 dark:text-slate-300 leading-snug">{text}</p>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 flex items-center gap-1">
                    <Zap size={10} aria-hidden="true" />
                    {sub}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <Link
            to="/submissions"
            className="mt-5 flex items-center justify-center gap-1.5 text-xs text-primary-600 dark:text-primary-400 hover:text-primary-700 font-medium py-2 border-t border-slate-100 dark:border-slate-700"
          >
            {t('dashboard.view_all_submissions')} <ArrowRight size={12} aria-hidden="true" />
          </Link>
        </div>
      </div>

    </div>
  )
}
