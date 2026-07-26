import { useState, useEffect, useCallback } from 'react'
import {
  FileDown, RefreshCw, AlertCircle, BookOpen, Gavel, Inbox, Target, Loader2, CalendarRange, Trash2,
} from 'lucide-react'
import api from '../../api/client'
import PageHeader from '../../components/shared/PageHeader'
import StatCard from '../../components/shared/StatCard'

const currentYear = () => new Date().getFullYear()
const yearOptions = () => {
  const c = currentYear()
  return [c, c - 1, c - 2, c - 3, c - 4]
}
const QUARTERS = [
  { value: 1, label: 'Q1 — Jan–Mar' },
  { value: 2, label: 'Q2 — Apr–Jun' },
  { value: 3, label: 'Q3 — Jul–Sep' },
  { value: 4, label: 'Q4 — Oct–Dec' },
]
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December']

// Sections the user can include; order drives the toggle list.
const SECTIONS = [
  { key: 'intake', label: 'Submission intake & types' },
  { key: 'sittings', label: 'Sittings & agenda load' },
  { key: 'decisions', label: 'Decisions & outcomes' },
  { key: 'timeliness', label: 'Processing timeliness' },
  { key: 'implementation', label: 'Implementation performance' },
  { key: 'ministries', label: 'Activity by ministry' },
  { key: 'tasks', label: 'Post-decision tasks' },
  { key: 'decision_service', label: 'Decision service' },
]
const ALL_KEYS = SECTIONS.map(s => s.key)
const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export default function AnnualReport() {
  const [periodType, setPeriodType] = useState('annual')
  const [year, setYear] = useState(currentYear() - 1)
  const [quarter, setQuarter] = useState(1)
  const [month, setMonth] = useState(1)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [include, setInclude] = useState(ALL_KEYS)

  const [preview, setPreview] = useState(null)
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [error, setError] = useState('')

  const buildParams = useCallback(() => {
    const p = { period_type: periodType }
    if (periodType === 'annual') p.year = year
    else if (periodType === 'quarterly') { p.year = year; p.quarter = quarter }
    else if (periodType === 'monthly') { p.year = year; p.month = month }
    else { p.date_from = dateFrom; p.date_to = dateTo }
    return p
  }, [periodType, year, quarter, month, dateFrom, dateTo])

  const customIncomplete = periodType === 'custom' && (!dateFrom || !dateTo)

  const loadPreview = useCallback(async () => {
    if (customIncomplete) { setPreview(null); setLoading(false); return }
    setLoading(true)
    setError('')
    try {
      const r = await api.get('/reports/annual/preview/', {
        params: { ...buildParams(), include: include.join(',') },
      })
      setPreview(r.data)
    } catch (e) {
      setError(e.response?.data?.detail || 'Could not load the statistics preview.')
    } finally {
      setLoading(false)
    }
  }, [buildParams, include, customIncomplete])

  const loadReports = useCallback(async () => {
    try {
      const r = await api.get('/reports/annual/')
      setReports(r.data.reports ?? [])
    } catch {
      setReports([])
    }
  }, [])

  useEffect(() => { loadPreview() }, [loadPreview])
  useEffect(() => { loadReports() }, [loadReports])

  const toggleSection = (key) =>
    setInclude(cur => cur.includes(key) ? cur.filter(k => k !== key) : [...cur, key])

  const generate = async () => {
    if (customIncomplete) { setError('Choose both a start and end date.'); return }
    if (include.length === 0) { setError('Select at least one section to include.'); return }
    setGenerating(true)
    setError('')
    try {
      await api.post('/reports/annual/generate/', { ...buildParams(), include })
      await loadReports()
    } catch (e) {
      setError(e.response?.data?.detail || 'Could not generate the report.')
    } finally {
      setGenerating(false)
    }
  }

  const remove = async (report) => {
    const label = report.period_label || `Statistics ${report.year}`
    if (!window.confirm(`Delete the generated report "${label}"? This cannot be undone.`)) return
    setDeletingId(report.id)
    setError('')
    try {
      await api.delete(`/reports/annual/${report.id}/`)
      await loadReports()
    } catch (e) {
      setError(e.response?.data?.detail || 'Could not delete the report.')
    } finally {
      setDeletingId(null)
    }
  }

  const download = async (report) => {
    try {
      const r = await api.get(`/reports/annual/${report.id}/download/`, { responseType: 'blob' })
      const url = URL.createObjectURL(new Blob([r.data], { type: 'application/pdf' }))
      const a = document.createElement('a')
      a.href = url
      a.download = `psc_report_${report.period_label || report.year}.pdf`.replace(/\s+/g, '_')
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 5000)
    } catch {
      setError('Could not download the PDF.')
    }
  }

  const d = preview
  const has = (key) => include.includes(key)
  const maxMonthly = Math.max(1, ...(d?.intake?.monthly ?? []).map(m => m.count))
  const periodLabel = d?.period?.label ?? ''

  const yearSelect = (
    <select className="input text-sm w-auto" value={year} onChange={e => setYear(Number(e.target.value))}>
      {yearOptions().map(y => <option key={y} value={y}>{y}</option>)}
    </select>
  )

  return (
    <div>
      <PageHeader
        title="Reports"
        subtitle="Generate the Commission's statistics report for any period — annual, quarterly, monthly, or a custom range."
        action={
          <button
            type="button"
            className="btn-primary btn-sm flex items-center gap-1.5"
            onClick={generate}
            disabled={generating || customIncomplete || include.length === 0}
          >
            {generating ? <Loader2 size={14} className="animate-spin" /> : <FileDown size={14} />}
            Generate PDF
          </button>
        }
      />

      {/* ── Parameters ─────────────────────────────────────────────────────── */}
      <div className="card p-5 mb-4">
        <div className="flex items-center gap-2 mb-4">
          <CalendarRange size={16} className="text-primary-500" />
          <h3 className="font-semibold text-slate-800 dark:text-slate-200 text-sm">Report parameters</h3>
        </div>

        <div className="flex flex-wrap items-end gap-3 mb-4">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-slate-500 dark:text-slate-400">Period</span>
            <select
              className="input text-sm w-auto"
              value={periodType}
              onChange={e => setPeriodType(e.target.value)}
            >
              <option value="annual">Annual</option>
              <option value="quarterly">Quarterly</option>
              <option value="monthly">Monthly</option>
              <option value="custom">Custom range</option>
            </select>
          </label>

          {periodType !== 'custom' && (
            <label className="flex flex-col gap-1">
              <span className="text-xs text-slate-500 dark:text-slate-400">Year</span>
              {yearSelect}
            </label>
          )}
          {periodType === 'quarterly' && (
            <label className="flex flex-col gap-1">
              <span className="text-xs text-slate-500 dark:text-slate-400">Quarter</span>
              <select className="input text-sm w-auto" value={quarter} onChange={e => setQuarter(Number(e.target.value))}>
                {QUARTERS.map(q => <option key={q.value} value={q.value}>{q.label}</option>)}
              </select>
            </label>
          )}
          {periodType === 'monthly' && (
            <label className="flex flex-col gap-1">
              <span className="text-xs text-slate-500 dark:text-slate-400">Month</span>
              <select className="input text-sm w-auto" value={month} onChange={e => setMonth(Number(e.target.value))}>
                {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
              </select>
            </label>
          )}
          {periodType === 'custom' && (
            <>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-slate-500 dark:text-slate-400">From</span>
                <input type="date" className="input text-sm w-auto" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-slate-500 dark:text-slate-400">To</span>
                <input type="date" className="input text-sm w-auto" value={dateTo} onChange={e => setDateTo(e.target.value)} />
              </label>
            </>
          )}

          <button
            type="button"
            className="btn-outline flex items-center gap-2 py-2 px-3 text-sm"
            onClick={loadPreview}
            disabled={loading}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        <div>
          <span className="text-xs text-slate-500 dark:text-slate-400">Include in report</span>
          <div className="flex flex-wrap gap-x-5 gap-y-2 mt-2">
            {SECTIONS.map(s => (
              <label key={s.key} className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                <input
                  type="checkbox"
                  className="rounded border-slate-300"
                  checked={include.includes(s.key)}
                  onChange={() => toggleSection(s.key)}
                />
                {s.label}
              </label>
            ))}
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {/* ── Preview KPIs ───────────────────────────────────────────────────── */}
      {d && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4 mb-4">
            {has('intake') && <StatCard title="Submissions received" value={d.intake?.total_received ?? 0} icon={Inbox} color="blue" />}
            {has('sittings') && <StatCard title="Sittings held" value={d.sittings?.total ?? 0} icon={BookOpen} color="purple" />}
            {has('sittings') && <StatCard title="Avg agenda / sitting" value={d.sittings?.avg_agenda_per_sitting ?? 0} icon={BookOpen} color="cyan" />}
            {has('decisions') && <StatCard title="Decisions recorded" value={d.decisions?.total_decided ?? 0} icon={Gavel} color="emerald" />}
            {has('decisions') && <StatCard title="Approval rate" value={d.decisions?.approval_rate ?? 0} suffix="%" icon={Gavel} color="amber" />}
            {has('implementation') && <StatCard title="Implemented within target" value={d.implementation?.overall?.pct_within_target ?? 0} suffix="%" icon={Target} color="red" />}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">
            Live preview for <strong>{periodLabel}</strong> — generating the PDF freezes this dataset so published figures stay reproducible.
            {has('timeliness') && <> Median days to decision: {d.timeliness?.median_days_to_decision ?? '—'}.</>}
            {has('decision_service') && <> Decisions served: {d.decision_service?.served ?? 0} ({d.decision_service?.pct_acknowledged ?? 0}% acknowledged).</>}
          </p>
        </>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-6">
        {/* Monthly intake */}
        {has('intake') && (
          <div className="card p-5">
            <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-1">Monthly intake</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">Submissions received per month</p>
            {loading ? (
              <div className="p-8 text-center text-sm text-slate-400">Loading…</div>
            ) : (
              <div className="space-y-1.5">
                {(d?.intake?.monthly ?? []).map(m => (
                  <div key={m.month} className="flex items-center gap-2">
                    <span className="text-xs text-slate-400 w-8">{monthNames[m.month - 1]}</span>
                    <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div className="h-full bg-primary-500 rounded-full" style={{ width: `${(m.count / maxMonthly) * 100}%` }} />
                    </div>
                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 w-8 text-right">{m.count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Agenda load per sitting */}
        {has('sittings') && (
          <div className="card overflow-hidden">
            <div className="p-5 border-b border-slate-100 dark:border-slate-700">
              <h3 className="font-semibold text-slate-800 dark:text-slate-200">Agenda load per sitting</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {d?.sittings?.total_agenda_items ?? 0} agenda items across {d?.sittings?.total ?? 0} sittings ·
                {' '}avg {d?.sittings?.avg_agenda_per_sitting ?? 0} per sitting
              </p>
            </div>
            <div className="table-wrapper max-h-80 overflow-y-auto">
              <table className="table w-full">
                <thead>
                  <tr><th>Date</th><th>Type</th><th>Agenda items</th></tr>
                </thead>
                <tbody>
                  {(d?.sittings?.detail ?? []).map((s, i) => (
                    <tr key={i}>
                      <td className="text-sm">{s.date}</td>
                      <td className="text-sm">{s.type}</td>
                      <td className="text-sm">{s.agenda_count}</td>
                    </tr>
                  ))}
                  {(d?.sittings?.detail ?? []).length === 0 && (
                    <tr><td colSpan={3} className="p-6 text-sm text-slate-500">No completed sittings in this period.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Ministry table */}
        {has('ministries') && (
          <div className="card overflow-hidden">
            <div className="p-5 border-b border-slate-100 dark:border-slate-700">
              <h3 className="font-semibold text-slate-800 dark:text-slate-200">Activity by ministry</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Highest intake first</p>
            </div>
            <div className="table-wrapper max-h-80 overflow-y-auto">
              <table className="table w-full">
                <thead>
                  <tr><th>Ministry</th><th>Received</th><th>Decided</th><th>Approved</th></tr>
                </thead>
                <tbody>
                  {(d?.ministries ?? []).map(m => (
                    <tr key={m.ministry}>
                      <td className="text-sm">{m.ministry}</td>
                      <td className="text-sm">{m.received}</td>
                      <td className="text-sm">{m.decided}</td>
                      <td className="text-sm">{m.approved}</td>
                    </tr>
                  ))}
                  {(d?.ministries ?? []).length === 0 && (
                    <tr><td colSpan={4} className="p-6 text-sm text-slate-500">No activity recorded.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Generated reports */}
      <div className="card overflow-hidden">
        <div className="p-5 border-b border-slate-100 dark:border-slate-700">
          <h3 className="font-semibold text-slate-800 dark:text-slate-200">Generated reports</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Frozen snapshots — the 15 January schedule generates the previous year automatically.
          </p>
        </div>
        {reports.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">No reports generated yet.</div>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-700">
            {reports.map(r => (
              <li key={r.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                    {r.period_label || `Statistics ${r.year}`}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {r.summary?.total_received ?? '—'} received · {r.summary?.total_decided ?? '—'} decided ·{' '}
                    {r.summary?.approval_rate ?? '—'}% approved · {r.summary?.pct_within_target ?? '—'}% implemented within target
                    {' '}· {r.requested_by ? `by ${r.requested_by}` : 'scheduled'}
                    {' '}· {new Date(r.created_at).toLocaleDateString('en-VU', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="btn-outline btn-sm flex items-center gap-1.5"
                    onClick={() => download(r)}
                    disabled={!r.download_url}
                  >
                    <FileDown size={13} /> PDF
                  </button>
                  {r.can_delete && (
                    <button
                      type="button"
                      className="btn-outline btn-sm flex items-center gap-1.5 text-red-600 hover:bg-red-50 hover:border-red-300 dark:hover:bg-red-900/20"
                      onClick={() => remove(r)}
                      disabled={deletingId === r.id}
                      aria-label="Delete report"
                      title="Delete report"
                    >
                      {deletingId === r.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
