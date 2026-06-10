import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, Cell,
} from 'recharts'
import {
  RefreshCw, AlertCircle, ClipboardCheck, Target, Clock, FileDown,
  CheckCircle2, Loader2,
} from 'lucide-react'
import api from '../../api/client'
import useChartColors from '../../hooks/useChartColors'
import ChartCard from '../../components/shared/ChartCard'
import StatCard from '../../components/shared/StatCard'
import PageHeader from '../../components/shared/PageHeader'

const PERIODS = [
  { key: 'all',       label: 'All time',       params: () => ({}) },
  { key: 'this_year', label: 'This year',      params: () => ({ date_from: `${new Date().getFullYear()}-01-01` }) },
  { key: 'last_year', label: 'Last year',      params: () => {
    const y = new Date().getFullYear() - 1
    return { date_from: `${y}-01-01`, date_to: `${y}-12-31` }
  } },
  { key: '12m',       label: 'Last 12 months', params: () => {
    const d = new Date(); d.setFullYear(d.getFullYear() - 1)
    return { date_from: d.toISOString().slice(0, 10) }
  } },
]

function pctClass(pct) {
  if (pct >= 70) return 'text-emerald-600 dark:text-emerald-400'
  if (pct >= 40) return 'text-amber-600 dark:text-amber-400'
  return 'text-red-600 dark:text-red-400'
}

export default function ImplementationDashboard() {
  const C = useChartColors()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [period, setPeriod] = useState('all')
  const [reports, setReports] = useState([])
  const [generating, setGenerating] = useState(false)
  const [reportError, setReportError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = PERIODS.find(p => p.key === period)?.params() ?? {}
      const res = await api.get('/analytics/implementation/', { params })
      setData(res.data)
    } catch (e) {
      setError(e.response?.data?.detail || 'Could not load implementation data.')
    } finally {
      setLoading(false)
    }
  }, [period])

  const loadReports = useCallback(async () => {
    try {
      const res = await api.get('/analytics/implementation/reports/')
      setReports(res.data.reports ?? [])
    } catch {
      setReports([])
    }
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => { loadReports() }, [loadReports])

  const generateReport = async () => {
    setGenerating(true)
    setReportError('')
    try {
      await api.post('/analytics/implementation/reports/generate/', {})
      await loadReports()
    } catch (e) {
      setReportError(e.response?.data?.detail || 'Could not generate the report.')
    } finally {
      setGenerating(false)
    }
  }

  const downloadReport = async (report) => {
    try {
      const res = await api.get(
        `/analytics/implementation/reports/${report.id}/download/`,
        { responseType: 'blob' },
      )
      const url = URL.createObjectURL(res.data)
      const a = document.createElement('a')
      a.href = url
      a.download = `implementation_report_${report.label.replace(' ', '_')}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      setReportError('Could not download the PDF.')
    }
  }

  const overall = data?.overall
  const ministries = data?.by_ministry ?? []
  const quarters = data?.quarterly ?? []
  const topOverdue = data?.top_overdue ?? []

  const ministryChart = ministries.slice(0, 12).map(m => ({
    name: m.ministry_code || m.ministry,
    fullName: m.ministry,
    pct: m.pct_within_target,
    overdue: m.overdue,
  }))

  const trendChart = quarters.map(q => ({
    quarter: q.quarter,
    'Within target %': q.pct_within_target,
    'Implemented %': q.pct_implemented,
    Decisions: q.total,
  }))

  return (
    <div>
      <PageHeader
        title="Implementation Dashboard"
        subtitle="Does anything happen after we decide? Decisions implemented within target, by ministry, over time."
        action={
          <div className="flex gap-2 items-center">
            <select
              className="input text-sm w-auto"
              value={period}
              onChange={e => setPeriod(e.target.value)}
            >
              {PERIODS.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
            </select>
            <button
              type="button"
              className="btn-outline flex items-center gap-2 py-2 px-3 text-sm"
              onClick={load}
              disabled={loading}
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
        }
      />

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {/* KPI cards */}
      {overall && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4 mb-6">
          <StatCard title="Decisions approved" value={overall.total} icon={ClipboardCheck} color="blue" />
          <StatCard title="Implemented" value={overall.implemented} icon={CheckCircle2} color="emerald" />
          <StatCard title="Within target" value={overall.pct_within_target} suffix="%" icon={Target} color="purple" />
          <StatCard title="Overdue now" value={overall.overdue} icon={AlertCircle} color="red" />
          <StatCard
            title="Median days to implement"
            value={overall.median_days_to_implement ?? '—'}
            icon={Clock}
            color="amber"
          />
        </div>
      )}

      {overall && (
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">
          Target: implemented within {data.target_days} calendar days of Commission approval
          unless an explicit due date was set ({overall.explicit_target} of {overall.total} decisions
          had one).
          {overall.missing_timing > 0 && (
            <> {overall.missing_timing} implemented decision(s) have no completion date on record
            and are excluded from timing percentages.</>
          )}
        </p>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-6">
        {/* By-ministry bar — worst first */}
        <ChartCard
          title="% implemented within target, by ministry"
          subtitle="Worst-performing ministries first"
        >
          {ministryChart.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-400">No approved decisions in this period.</div>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(220, ministryChart.length * 34)}>
              <BarChart data={ministryChart} layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.grid} strokeOpacity={0.5} />
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: C.axis }} tickFormatter={v => `${v}%`} />
                <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 11, fill: C.axis }} />
                <Tooltip
                  formatter={(v, n) => n === 'pct' ? [`${v}%`, 'Within target'] : [v, n]}
                  labelFormatter={(label, payload) => payload?.[0]?.payload?.fullName ?? label}
                />
                <Bar dataKey="pct" radius={[0, 4, 4, 0]}>
                  {ministryChart.map((m, i) => (
                    <Cell key={i} fill={m.pct >= 70 ? C.emerald : m.pct >= 40 ? C.amber : C.rose} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* Quarterly trend */}
        <ChartCard title="Trend by quarter" subtitle="Approval-quarter cohorts">
          {trendChart.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-400">No data yet.</div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={trendChart} margin={{ top: 5, right: 20, left: -15, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.grid} strokeOpacity={0.5} />
                <XAxis dataKey="quarter" tick={{ fontSize: 11, fill: C.axis }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: C.axis }} tickFormatter={v => `${v}%`} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Line type="monotone" dataKey="Within target %" stroke={C.primary} strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="Implemented %" stroke={C.cyan} strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      {/* Ministry detail table */}
      <div className="card overflow-hidden mb-6">
        <div className="p-5 border-b border-slate-100 dark:border-slate-700">
          <h3 className="font-semibold text-slate-800 dark:text-slate-200">Implementation by ministry</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Worst-first by % implemented within target</p>
        </div>
        {loading ? (
          <div className="p-12 text-center text-sm text-slate-400">Loading…</div>
        ) : ministries.length === 0 ? (
          <div className="p-12 text-center text-sm text-slate-500">No approved decisions in this period.</div>
        ) : (
          <div className="table-wrapper">
            <table className="table w-full">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Ministry</th>
                  <th>Decisions</th>
                  <th>Implemented</th>
                  <th>Within target</th>
                  <th>% within target</th>
                  <th>In progress</th>
                  <th className="text-red-600 dark:text-red-400">Overdue</th>
                  <th>Median days</th>
                </tr>
              </thead>
              <tbody>
                {ministries.map((m, idx) => (
                  <tr key={m.ministry_id} className="hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors">
                    <td className="text-xs text-slate-400 font-mono w-8">{idx + 1}</td>
                    <td className="text-sm font-medium text-slate-800 dark:text-slate-200">{m.ministry}</td>
                    <td className="text-sm">{m.total}</td>
                    <td className="text-sm">{m.implemented}</td>
                    <td className="text-sm">{m.implemented_within_target}</td>
                    <td className={`text-sm font-bold ${pctClass(m.pct_within_target)}`}>{m.pct_within_target}%</td>
                    <td className="text-sm">{m.in_progress}</td>
                    <td>
                      {m.overdue > 0 ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 dark:text-red-400">
                          <AlertCircle size={12} /> {m.overdue}
                        </span>
                      ) : (
                        <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">0</span>
                      )}
                    </td>
                    <td className="text-sm">{m.median_days_to_implement ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-6">
        {/* Longest overdue */}
        <div className="card overflow-hidden">
          <div className="p-5 border-b border-slate-100 dark:border-slate-700">
            <h3 className="font-semibold text-slate-800 dark:text-slate-200">Longest-overdue decisions</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Approved, past target, not yet implemented</p>
          </div>
          {topOverdue.length === 0 ? (
            <div className="p-10 text-center text-sm text-emerald-600 dark:text-emerald-400">
              Nothing overdue — all decisions are on track.
            </div>
          ) : (
            <div className="table-wrapper">
              <table className="table w-full">
                <thead>
                  <tr>
                    <th>Reference</th>
                    <th>Ministry</th>
                    <th>Target date</th>
                    <th>Days overdue</th>
                  </tr>
                </thead>
                <tbody>
                  {topOverdue.map(row => (
                    <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors">
                      <td>
                        <Link
                          to={`/submissions/${row.id}`}
                          className="text-sm font-medium text-primary-600 dark:text-primary-400 hover:underline"
                          title={row.title}
                        >
                          {row.reference_number}
                        </Link>
                      </td>
                      <td className="text-sm">{row.ministry}</td>
                      <td className="text-sm">{row.target_date}</td>
                      <td className="text-sm font-bold text-red-600 dark:text-red-400">{row.days_overdue}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Quarterly PDF reports */}
        <div className="card overflow-hidden">
          <div className="p-5 border-b border-slate-100 dark:border-slate-700 flex items-start justify-between gap-3">
            <div>
              <h3 className="font-semibold text-slate-800 dark:text-slate-200">Quarterly PDF reports</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Generated automatically each quarter; the Secretariat can also generate on demand.
              </p>
            </div>
            <button
              type="button"
              className="btn-primary btn-sm flex items-center gap-1.5 shrink-0"
              onClick={generateReport}
              disabled={generating}
            >
              {generating ? <Loader2 size={14} className="animate-spin" /> : <FileDown size={14} />}
              Generate latest quarter
            </button>
          </div>
          {reportError && (
            <div className="mx-5 mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {reportError}
            </div>
          )}
          {reports.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500">No reports generated yet.</div>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-700">
              {reports.map(r => (
                <li key={r.id} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{r.label}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {r.summary?.total ?? 0} decision(s) ·{' '}
                      <span className={pctClass(r.summary?.pct_within_target ?? 0)}>
                        {r.summary?.pct_within_target ?? 0}% within target
                      </span>
                      {' '}· {r.requested_by ? `by ${r.requested_by}` : 'scheduled'}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn-outline btn-sm flex items-center gap-1.5"
                    onClick={() => downloadReport(r)}
                    disabled={!r.download_url}
                  >
                    <FileDown size={13} /> PDF
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
