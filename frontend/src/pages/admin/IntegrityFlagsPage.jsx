import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, CheckCircle2, AlertTriangle, Play } from 'lucide-react'
import { Link } from 'react-router-dom'
import api from '../../api/client'
import PageHeader from '../../components/shared/PageHeader'
import BaseSelect from '../../components/shared/BaseSelect'
import BaseButton from '../../components/shared/BaseButton'
import BaseBadge from '../../components/shared/BaseBadge'
import BaseSpinner from '../../components/shared/BaseSpinner'
import { useToast } from '../../context/ToastContext'

const CHECK_LABELS = {
  orphaned_commission_sitting: 'Orphaned Commission Sitting',
  stale_after_meeting: 'Stale after meeting',
  stale_stage: 'Stale stage',
}

const SHOW_OPTIONS = [
  { value: 'open', label: 'Open only' },
  { value: 'resolved', label: 'Resolved only' },
  { value: 'all', label: 'All' },
]

export default function IntegrityFlagsPage() {
  const toast = useToast()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [sweeping, setSweeping] = useState(false)
  const [show, setShow] = useState('open')
  const [error, setError] = useState('')

  const load = useCallback(async (showVal) => {
    setLoading(true)
    setError('')
    try {
      const res = await api.get('/integrity-flags/', { params: { show: showVal } })
      setData(res.data)
    } catch (e) {
      setError(e.response?.data?.detail || 'Could not load integrity flags.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load(show) }, [load, show])

  const runSweepNow = async () => {
    setSweeping(true)
    try {
      await api.post('/integrity-flags/')
      toast.success('Sweep complete.')
      await load(show)
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Sweep failed.')
    } finally {
      setSweeping(false)
    }
  }

  const flags = data?.flags || []

  return (
    <div className="flex flex-col gap-6 max-w-[1200px] mx-auto pb-10">
      <PageHeader
        title="Integrity Flags"
        subtitle="Submissions caught by the daily workflow-integrity sweep in a state that shouldn't be reachable"
        action={
          <div className="flex items-center gap-2">
            <BaseSelect
              hideLabel label="Show" className="w-40"
              value={show} options={SHOW_OPTIONS}
              onChange={(_, v) => setShow(v)}
            />
            <BaseButton
              variant="outline" size="sm" icon={<RefreshCw size={14} className={loading ? 'animate-spin' : ''} />}
              onClick={() => load(show)}
            >
              Refresh
            </BaseButton>
            <BaseButton
              variant="primary" size="sm" icon={<Play size={14} />}
              onClick={runSweepNow} disabled={sweeping} loading={sweeping}
            >
              Run sweep now
            </BaseButton>
          </div>
        }
      />

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-200">
          {error}
        </div>
      )}

      {data && data.open_count > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-900/20 px-4 py-3 flex items-start gap-2">
          <AlertTriangle size={16} className="text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
          <p className="text-sm text-amber-800 dark:text-amber-200">
            {data.open_count} open integrity flag{data.open_count === 1 ? '' : 's'} — runs automatically every night at 3am.
          </p>
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="px-4 py-3 flex items-center gap-2 border-b border-slate-100 dark:border-slate-700">
          <span className="font-semibold text-slate-700 dark:text-slate-200">{flags.length} flag{flags.length === 1 ? '' : 's'}</span>
          {loading && <BaseSpinner size="sm" label="" />}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 dark:border-slate-700 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2 w-44">Check</th>
                <th className="px-3 py-2 w-32">Submission</th>
                <th className="px-3 py-2">Detail</th>
                <th className="px-3 py-2 w-36">Detected</th>
                <th className="px-3 py-2 w-24">Status</th>
              </tr>
            </thead>
            <tbody>
              {flags.map(f => (
                <tr key={f.id} className="border-b border-slate-100 dark:border-slate-800 last:border-0 text-slate-700 dark:text-slate-300">
                  <td className="px-3 py-2">
                    <BaseBadge color={f.resolved_at ? 'default' : 'danger'} size="small">
                      {CHECK_LABELS[f.check_name] || f.check_name}
                    </BaseBadge>
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">
                    {f.submission_id ? (
                      <Link to={`/submissions/${f.submission_id}`} className="text-primary-600 dark:text-primary-400 hover:underline">
                        {f.submission_ref || f.submission_id}
                      </Link>
                    ) : '—'}
                    {f.submission_title && (
                      <span className="block text-[10px] text-slate-400 font-sans">{f.submission_title}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs">{f.detail}</td>
                  <td className="px-3 py-2 text-xs">{new Date(f.detected_at).toLocaleString()}</td>
                  <td className="px-3 py-2">
                    {f.resolved_at ? (
                      <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 size={12} /> Resolved
                      </span>
                    ) : (
                      <span className="text-xs text-red-600 dark:text-red-400">Open</span>
                    )}
                  </td>
                </tr>
              ))}
              {flags.length === 0 && !loading && (
                <tr>
                  <td colSpan={5} className="p-6 text-slate-500">
                    <span className="inline-flex items-center gap-2">
                      <CheckCircle2 size={15} className="text-emerald-500" /> No flags to show.
                    </span>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
