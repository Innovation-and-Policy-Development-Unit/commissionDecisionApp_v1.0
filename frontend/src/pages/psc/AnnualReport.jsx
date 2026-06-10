import { useState, useEffect, useCallback } from 'react'
import {
  FileDown, RefreshCw, AlertCircle, BookOpen, Gavel, Inbox, Target, Loader2,
} from 'lucide-react'
import api from '../../api/client'
import PageHeader from '../../components/shared/PageHeader'
import StatCard from '../../components/shared/StatCard'

const yearOptions = () => {
  const current = new Date().getFullYear()
  return [current, current - 1, current - 2, current - 3]
}

export default function AnnualReport() {
  const [year, setYear] = useState(new Date().getFullYear() - 1)
  const [preview, setPreview] = useState(null)
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')

  const loadPreview = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const r = await api.get('/reports/annual/preview/', { params: { year } })
      setPreview(r.data)
    } catch (e) {
      setError(e.response?.data?.detail || 'Could not load the statistics preview.')
    } finally {
      setLoading(false)
    }
  }, [year])

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

  const generate = async () => {
    setGenerating(true)
    setError('')
    try {
      await api.post('/reports/annual/generate/', { year })
      await loadReports()
    } catch (e) {
      setError(e.response?.data?.detail || 'Could not generate the report.')
    } finally {
      setGenerating(false)
    }
  }

  const download = async (report) => {
    try {
      const r = await api.get(`/reports/annual/${report.id}/download/`, { responseType: 'blob' })
      const url = URL.createObjectURL(new Blob([r.data], { type: 'application/pdf' }))
      const a = document.createElement('a')
      a.href = url
      a.download = `psc_annual_report_statistics_${report.year}.pdf`
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 5000)
    } catch {
      setError('Could not download the PDF.')
    }
  }

  const d = preview
  const maxMonthly = Math.max(1, ...(d?.intake?.monthly ?? []).map(m => m.count))
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

  return (
    <div>
      <PageHeader
        title="Annual Report — Statistics"
        subtitle="The statistics chapter of the PSC Annual Report, generated directly from the workflow record."
        action={
          <div className="flex gap-2 items-center">
            <select className="input text-sm w-auto" value={year} onChange={e => setYear(Number(e.target.value))}>
              {yearOptions().map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <button
              type="button"
              className="btn-outline flex items-center gap-2 py-2 px-3 text-sm"
              onClick={loadPreview}
              disabled={loading}
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
            <button
              type="button"
              className="btn-primary btn-sm flex items-center gap-1.5"
              onClick={generate}
              disabled={generating}
            >
              {generating ? <Loader2 size={14} className="animate-spin" /> : <FileDown size={14} />}
              Generate {year} PDF
            </button>
          </div>
        }
      />

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {/* Preview KPIs */}
      {d && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4 mb-4">
            <StatCard title="Submissions received" value={d.intake.total_received} icon={Inbox} color="blue" />
            <StatCard title="Sittings held" value={d.sittings.total} icon={BookOpen} color="purple" />
            <StatCard title="Decisions recorded" value={d.decisions.total_decided} icon={Gavel} color="emerald" />
            <StatCard title="Approval rate" value={d.decisions.approval_rate} suffix="%" icon={Gavel} color="amber" />
            <StatCard title="Implemented within target" value={d.implementation.overall.pct_within_target} suffix="%" icon={Target} color="red" />
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">
            Live preview for {d.year} — generating the PDF freezes this dataset so published figures stay reproducible.
            Median days to decision: {d.timeliness.median_days_to_decision ?? '—'} ·
            decisions formally served: {d.decision_service.served} ({d.decision_service.pct_acknowledged}% acknowledged).
          </p>
        </>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-6">
        {/* Monthly intake */}
        <div className="card p-5">
          <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-1">Monthly intake</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">Submissions received per month, {year}</p>
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

        {/* Ministry table */}
        <div className="card overflow-hidden">
          <div className="p-5 border-b border-slate-100 dark:border-slate-700">
            <h3 className="font-semibold text-slate-800 dark:text-slate-200">Activity by ministry</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Highest intake first</p>
          </div>
          <div className="table-wrapper max-h-80 overflow-y-auto">
            <table className="table w-full">
              <thead>
                <tr>
                  <th>Ministry</th>
                  <th>Received</th>
                  <th>Decided</th>
                  <th>Approved</th>
                </tr>
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
                  <tr><td colSpan={4} className="p-6 text-sm text-slate-500">No activity recorded in {year}.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
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
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-200">Statistics chapter {r.year}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {r.summary?.total_received ?? '—'} received · {r.summary?.total_decided ?? '—'} decided ·{' '}
                    {r.summary?.approval_rate ?? '—'}% approved · {r.summary?.pct_within_target ?? '—'}% implemented within target
                    {' '}· {r.requested_by ? `by ${r.requested_by}` : 'scheduled'}
                    {' '}· {new Date(r.created_at).toLocaleDateString('en-VU', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </p>
                </div>
                <button
                  type="button"
                  className="btn-outline btn-sm flex items-center gap-1.5"
                  onClick={() => download(r)}
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
  )
}
