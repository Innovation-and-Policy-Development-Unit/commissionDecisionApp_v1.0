import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, AlertTriangle, CheckCircle2 } from 'lucide-react'
import api from '../../api/client'
import PageHeader from '../../components/shared/PageHeader'
import BaseSelect from '../../components/shared/BaseSelect'
import BaseButton from '../../components/shared/BaseButton'
import BaseBadge from '../../components/shared/BaseBadge'
import BaseSpinner from '../../components/shared/BaseSpinner'

const FEATURE_LABELS = {
  submission_brief: 'AI executive brief',
  quality_score: 'Submission quality score',
  duplicate_detection: 'Duplicate detection',
  risk_assessment: 'Risk assessment',
  recommended_outcome: 'Recommended outcome',
  notice_of_allegation: 'Notice of allegation',
  outcome_letter: 'Outcome letter',
  smart_report: 'Smart report (AI query)',
  agenda_blurb: 'Agenda item blurb',
  nl_search: 'Natural language search',
  checklist_autofill: 'Checklist autofill',
  workload_suggestion: 'Workload assignment suggestion',
}

const WINDOW_OPTIONS = [
  { value: '24', label: 'Last 24 hours' },
  { value: '168', label: 'Last 7 days' },
  { value: '720', label: 'Last 30 days' },
]

function successRateColor(pct) {
  if (pct === null || pct === undefined) return 'default'
  if (pct >= 95) return 'success'
  if (pct >= 80) return 'warning'
  return 'danger'
}

function fmtLatency(ms) {
  if (!ms) return '—'
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`
}

export default function AIReliabilityPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [windowHours, setWindowHours] = useState('24')
  const [error, setError] = useState('')

  const load = useCallback(async (hours) => {
    setLoading(true)
    setError('')
    try {
      const res = await api.get('/ai-reliability/', { params: { window_hours: hours } })
      setData(res.data)
    } catch (e) {
      setError(e.response?.data?.detail || 'Could not load AI reliability data.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load(windowHours) }, [load, windowHours])

  const features = data?.features || []
  const activeFeatures = features.filter(f => f.total > 0)
  const idleFeatures = features.filter(f => f.total === 0)
  const overallFailing = activeFeatures.filter(f => f.success_rate_pct !== null && f.success_rate_pct < 80)

  return (
    <div className="flex flex-col gap-6 max-w-[1200px] mx-auto pb-10">
      <PageHeader
        title="AI Reliability"
        subtitle="Success/failure rates for every AI feature — catches a provider outage across the board, not just one submission at a time"
        action={
          <div className="flex items-center gap-2">
            <BaseSelect
              hideLabel label="Window" className="w-40"
              value={windowHours} options={WINDOW_OPTIONS}
              onChange={(_, v) => setWindowHours(v)}
            />
            <BaseButton
              variant="outline" size="sm" icon={<RefreshCw size={14} className={loading ? 'animate-spin' : ''} />}
              onClick={() => load(windowHours)}
            >
              Refresh
            </BaseButton>
          </div>
        }
      />

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-200">
          {error}
        </div>
      )}

      {overallFailing.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-900/20 px-4 py-3 flex items-start gap-2">
          <AlertTriangle size={16} className="text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
          <p className="text-sm text-amber-800 dark:text-amber-200">
            {overallFailing.length} feature{overallFailing.length === 1 ? '' : 's'} below 80% success in this window:{' '}
            {overallFailing.map(f => FEATURE_LABELS[f.feature] || f.feature).join(', ')}.
          </p>
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="px-4 py-3 flex items-center gap-2 border-b border-slate-100 dark:border-slate-700">
          <span className="font-semibold text-slate-700 dark:text-slate-200">
            Per-feature ({activeFeatures.length} active{idleFeatures.length ? `, ${idleFeatures.length} idle` : ''})
          </span>
          {loading && <BaseSpinner size="sm" label="" />}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 dark:border-slate-700 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2">Feature</th>
                <th className="px-3 py-2 w-20 text-right">Total</th>
                <th className="px-3 py-2 w-24 text-right">Success</th>
                <th className="px-3 py-2 w-24 text-right">Failed</th>
                <th className="px-3 py-2 w-24 text-right">Retrying</th>
                <th className="px-3 py-2 w-32">Success rate</th>
                <th className="px-3 py-2 w-24 text-right">Avg latency</th>
                <th className="px-3 py-2 w-40">Last failure</th>
              </tr>
            </thead>
            <tbody>
              {features.map(f => (
                <tr key={f.feature} className="border-b border-slate-100 dark:border-slate-800 last:border-0 text-slate-700 dark:text-slate-300">
                  <td className="px-3 py-2 font-medium">{FEATURE_LABELS[f.feature] || f.feature}</td>
                  <td className="px-3 py-2 text-right">{f.total}</td>
                  <td className="px-3 py-2 text-right text-emerald-600 dark:text-emerald-400">{f.success}</td>
                  <td className="px-3 py-2 text-right text-red-600 dark:text-red-400">{f.failed}</td>
                  <td className="px-3 py-2 text-right text-amber-600 dark:text-amber-400">{f.retrying}</td>
                  <td className="px-3 py-2">
                    {f.success_rate_pct === null ? (
                      <span className="text-slate-400">—</span>
                    ) : (
                      <BaseBadge color={successRateColor(f.success_rate_pct)} size="small">
                        {f.success_rate_pct}%
                      </BaseBadge>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-xs">{fmtLatency(f.avg_latency_ms)}</td>
                  <td className="px-3 py-2 text-xs text-slate-500" title={f.last_failure_detail}>
                    {f.last_failure_at ? new Date(f.last_failure_at).toLocaleString() : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700">
          <span className="font-semibold text-slate-700 dark:text-slate-200">
            Recent failures ({(data?.recent_failures || []).length})
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 dark:border-slate-700 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2 w-40">When</th>
                <th className="px-3 py-2 w-48">Feature</th>
                <th className="px-3 py-2 w-32">Submission</th>
                <th className="px-3 py-2">Detail</th>
              </tr>
            </thead>
            <tbody>
              {(data?.recent_failures || []).map((f, i) => (
                <tr key={i} className="border-b border-slate-100 dark:border-slate-800 last:border-0 text-slate-700 dark:text-slate-300">
                  <td className="px-3 py-2 text-xs">{new Date(f.created_at).toLocaleString()}</td>
                  <td className="px-3 py-2">{FEATURE_LABELS[f.feature] || f.feature}</td>
                  <td className="px-3 py-2 font-mono text-xs">{f.submission_ref || '—'}</td>
                  <td className="px-3 py-2 text-xs text-slate-600 dark:text-slate-400">{f.detail}</td>
                </tr>
              ))}
              {(data?.recent_failures || []).length === 0 && !loading && (
                <tr>
                  <td colSpan={4} className="p-6 text-slate-500 flex items-center gap-2">
                    <CheckCircle2 size={15} className="text-emerald-500" /> No failures in this window.
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
