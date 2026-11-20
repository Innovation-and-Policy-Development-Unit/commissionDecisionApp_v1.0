import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import PageHeader from '../../components/shared/PageHeader'
import EmptyState from '../../components/shared/EmptyState'
import { SkeletonRow } from '../../components/shared/Skeleton'
import ImplementationTabs from '../../components/implementation/ImplementationTabs'
import StatCard from '../../components/shared/StatCard'
import api from '../../api/client'
import { useToast } from '../../context/ToastContext'
import { Download, Printer, RefreshCw, CheckCircle2, ListTodo, Circle, Loader, AlertTriangle } from 'lucide-react'
import clsx from 'clsx'

const STATUS_CLS = {
  open: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  in_progress: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  completed: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
}

export default function DecisionImplementationReport() {
  const { t } = useTranslation()
  const toast = useToast()
  const [data, setData] = useState(null)
  const [since, setSince] = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/commission-tasks/implementation-report/', { params: since ? { since } : {} })
      setData(res.data)
      if (!since && res.data.since) setSince(res.data.since)
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Could not load the report.')
    } finally {
      setLoading(false)
    }
  }, [since, toast])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load() }, [])

  const downloadPdf = async () => {
    try {
      const res = await api.get('/commission-tasks/implementation-report/', {
        params: { output: 'pdf', ...(since ? { since } : {}) }, responseType: 'blob',
      })
      const url = URL.createObjectURL(res.data)
      const a = document.createElement('a')
      a.href = url
      a.download = `decision_implementation_report_${data?.as_of || 'today'}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error('Could not create the PDF.')
    }
  }

  const s = data?.summary

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('page.implementation_report_title')}
        subtitle={t('page.implementation_report_sub')}
      />

      <ImplementationTabs />

      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs text-slate-500">
          Completed since
          <input
            type="date" value={since} onChange={e => setSince(e.target.value)}
            className="block mt-1 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
          />
        </label>
        <button onClick={load} className="btn-secondary px-4 py-2 text-sm inline-flex items-center gap-2">
          <RefreshCw size={14} /> Refresh
        </button>
        <button onClick={downloadPdf} disabled={!data} className="btn-secondary px-4 py-2 text-sm inline-flex items-center gap-2 disabled:opacity-60">
          <Download size={14} /> Download PDF
        </button>
        <button onClick={() => window.print()} disabled={!data} className="btn-secondary px-4 py-2 text-sm inline-flex items-center gap-2 disabled:opacity-60">
          <Printer size={14} /> Print
        </button>
      </div>

      {loading && !data && (
        <div className="card overflow-hidden py-2">
          {Array.from({ length: 5 }, (_, i) => <SkeletonRow key={i} cols={5} />)}
        </div>
      )}

      {data && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <StatCard variant="quiet" label="Decisions listed" value={s.total} icon={ListTodo} color="blue" />
            <StatCard variant="quiet" label="Not started" value={s.open} icon={Circle} color="slate" />
            <StatCard variant="quiet" label="In progress" value={s.in_progress} icon={Loader} color="amber" />
            <StatCard variant="quiet" label="Completed since last sitting" value={s.completed_since} icon={CheckCircle2} color="emerald" />
            <StatCard variant="quiet" label="Overdue" value={s.overdue} icon={AlertTriangle} color={s.overdue > 0 ? 'red' : 'slate'} />
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800 text-xs uppercase text-slate-500">
                <tr>
                  {['Unit', 'Not started', 'In progress', 'Completed', 'Overdue'].map(h => (
                    <th key={h} className="px-3 py-2 text-left">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.by_unit.map(u => (
                  <tr key={u.unit} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="px-3 py-2 font-medium">{u.unit}</td>
                    <td className="px-3 py-2">{u.open}</td>
                    <td className="px-3 py-2">{u.in_progress}</td>
                    <td className="px-3 py-2">{u.completed}</td>
                    <td className={clsx('px-3 py-2', u.overdue > 0 && 'text-red-600 font-semibold')}>{u.overdue}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800 text-xs uppercase text-slate-500">
                <tr>
                  {['Decision', 'Sitting', 'Title', 'Unit / Manager', 'Status', 'Due', 'Latest progress'].map(h => (
                    <th key={h} className="px-3 py-2 text-left">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.decisions.length === 0 && (
                  <tr><td colSpan={7}>
                    <EmptyState
                      icon={CheckCircle2}
                      title="Nothing to table"
                      description="Every decision is closed, and none was completed since the date above."
                    />
                  </td></tr>
                )}
                {data.decisions.map(d => (
                  <tr key={d.task_id} className="border-t border-slate-100 dark:border-slate-800 align-top">
                    <td className="px-3 py-2 whitespace-nowrap">{d.decision_number || '—'}</td>
                    <td className="px-3 py-2">{d.meeting}</td>
                    <td className="px-3 py-2">
                      {d.title}
                      {d.subtask_total > 0 && <div className="text-xs text-slate-500">Steps {d.subtask_done}/{d.subtask_total}</div>}
                    </td>
                    <td className="px-3 py-2">
                      {d.unit}
                      <div className="text-xs text-slate-500">{d.manager}{d.staff.length ? ` → ${d.staff.join(', ')}` : ''}</div>
                    </td>
                    <td className="px-3 py-2">
                      <span className={clsx('px-2 py-0.5 rounded-full text-xs font-semibold', STATUS_CLS[d.status])}>{d.status_label}</span>
                      {d.completed_at && <div className="text-xs text-slate-500 mt-1">{d.completed_at}</div>}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {d.due_date || '—'}
                      {d.days_overdue > 0 && <div className="text-xs text-red-600 font-semibold">{d.days_overdue}d overdue</div>}
                    </td>
                    <td className="px-3 py-2 max-w-xs">
                      {d.latest_note
                        ? <>{d.latest_note.body}<div className="text-xs text-slate-500">{d.latest_note.author}, {d.latest_note.at}</div></>
                        : <span className="text-slate-400">No update yet</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
