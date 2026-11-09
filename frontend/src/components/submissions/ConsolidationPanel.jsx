/**
 * ConsolidationPanel.jsx
 * On an ODU consolidated paper (all Business Plans, all Corporate Plans or all Annual Reports):
 * which ministry submissions it covers, which it will cover when it goes up, which ODU has not
 * noted yet (these hold the paper back), and which ministries have not lodged.
 */
import { useState, useEffect, useCallback } from 'react'
import { Layers, RefreshCw, AlertTriangle, CheckCircle2, Clock } from 'lucide-react'
import api from '../../api/client'
import BaseButton from '../shared/BaseButton'
import BaseBadge from '../shared/BaseBadge'
import BaseSpinner from '../shared/BaseSpinner'

export const CONSOLIDATED_CODES = ['ODU-BUSINESS-PLANS', 'ODU-CORPORATE-PLANS', 'ODU-ANNUAL-REPORTS']

const STATE = {
  covered: { label: 'Covered', color: 'success' },
  will_cover: { label: 'Will be covered', color: 'info' },
  waiting: { label: 'Receipt not acknowledged', color: 'warning' },
}
const REC = {
  accept: 'Looks complete',
  accept_with_follow_up: 'Minor gaps',
  return_for_clarification: 'Material gaps',
}

export default function ConsolidationPanel({ submissionId }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get(`/submissions/${submissionId}/coverage/`)
      setData(res.data)
      setError('')
    } catch (err) {
      setData(null)
      setError(err?.response?.data?.detail || '')
    } finally {
      setLoading(false)
    }
  }, [submissionId])

  useEffect(() => { load() }, [load])

  if (loading && !data) return <div className="card p-4"><BaseSpinner size="sm" label="Loading coverage" /></div>
  if (!data || !data.plan_label) return error ? <p className="text-sm text-slate-500">{error}</p> : null

  const c = data.counts || {}
  const plural = data.plan_label_plural
  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 mb-2">
        <Layers size={20} className="text-primary-600" />
        <span className="font-bold text-base text-slate-800 dark:text-slate-100">{plural} this paper covers</span>
        <BaseButton variant="ghost" size="sm" className="ml-auto" icon={<RefreshCw size={15} />} onClick={load} disabled={loading}>
          Refresh
        </BaseButton>
      </div>

      <p className="text-sm text-slate-600 dark:text-slate-300 mb-3">
        {c.covered || 0} covered · {c.will_cover || 0} acknowledged and will be covered when this paper goes up · {c.waiting || 0} not acknowledged yet.
        {data.receipt_due_date ? ` Receipt due date: ${data.receipt_due_date}.` : ''}
        Every lodged {data.plan_label.toLowerCase()} must be covered, so the paper cannot go up while any is still with ODU or back with its ministry.
      </p>

      {data.gaps?.length > 0 ? (
        <div className="flex items-start gap-2 text-sm text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-lg px-3 py-2 mb-3">
          <AlertTriangle size={16} className="shrink-0 mt-0.5" />
          <span>Not ready to go up: {data.gaps.join(' ')}</span>
        </div>
      ) : (
        <div className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-300 mb-3">
          <CheckCircle2 size={16} /> Every lodged {data.plan_label.toLowerCase()} is noted. The paper can go up.
        </div>
      )}

      {data.rows?.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500">
                <th className="py-1 pr-3">Ministry</th><th className="py-1 pr-3">Reference</th>
                <th className="py-1 pr-3">Status</th><th className="py-1 pr-3">Lodged</th>
                <th className="py-1 pr-3">Timeliness</th><th className="py-1 pr-3">AI first-pass review</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map(r => (
                <tr key={r.id} className="border-t border-slate-200 dark:border-slate-700 align-top">
                  <td className="py-1.5 pr-3 font-medium text-slate-800 dark:text-slate-100">{r.ministry}</td>
                  <td className="py-1.5 pr-3">{r.reference_number}</td>
                  <td className="py-1.5 pr-3">
                    <BaseBadge color={STATE[r.state]?.color || 'info'} size="small">{STATE[r.state]?.label}</BaseBadge>
                    {r.state === 'waiting' && <span className="block text-xs text-slate-500">{r.stage_label}</span>}
                  </td>
                  <td className="py-1.5 pr-3">{r.received_at ? new Date(r.received_at).toLocaleDateString() : '—'}</td>
                  <td className="py-1.5 pr-3">
                    {r.late
                      ? <span className="text-rose-700 dark:text-rose-300">Late: {r.days_late} day{r.days_late === 1 ? '' : 's'} after {r.deadline_text}</span>
                      : <span className="text-slate-500">{r.deadline_text ? 'On time' : '—'}</span>}
                  </td>
                  <td className="py-1.5 pr-3 text-slate-600 dark:text-slate-300">
                    {r.ai_review?.recommendation ? `${REC[r.ai_review.recommendation] || r.ai_review.recommendation}${r.ai_review.total ? ` (${r.ai_review.met}/${r.ai_review.total})` : ''}` : '—'}
                    {r.ai_review?.plan_period?.found && (
                      <span className={`block text-xs ${r.ai_review.plan_period.five_years ? 'text-slate-500' : 'text-amber-700 dark:text-amber-300'}`}>
                        Period {r.ai_review.plan_period.start_year}–{r.ai_review.plan_period.end_year} ({r.ai_review.plan_period.years} yr)
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-slate-500">No {plural.toLowerCase()} have been lodged yet.</p>
      )}

      {data.not_lodged?.length > 0 && (
        <div className="mt-3 text-sm text-slate-600 dark:text-slate-300">
          <span className="inline-flex items-center gap-1 font-semibold"><Clock size={14} /> Not lodged this year ({data.not_lodged.length}):</span>{' '}
          {data.not_lodged.join(', ')}.
          <span className="block text-xs text-slate-500 mt-0.5">
            ODU waits for every ministry before making this paper. If a ministry is still late when it goes up, the Commission decides what to do about it.
          </span>
        </div>
      )}
    </div>
  )
}
