/**
 * ConsolidationPanel.jsx
 * On an ODU consolidated paper (all Business Plans, all Corporate Plans or all Annual Reports):
 * which ministry submissions it covers, which it will cover when it goes up, which ODU has not
 * noted yet (these hold the paper back), and which ministries have not lodged.
 */
import { useState, useEffect, useCallback } from 'react'
import { Layers, RefreshCw, AlertTriangle, CheckCircle2, Clock, ChevronDown, ChevronRight, Sparkles } from 'lucide-react'
import api from '../../api/client'
import { useToast } from '../../context/ToastContext'
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

const SUMMARY_NOTE = 'AI summary of what the ministry\'s own document says. Check it against the plan before you rely on it.'

function List({ title, items }) {
  if (!items?.length) return null
  return (
    <div>
      <span className="font-semibold">{title}</span>
      <ul className="ml-4 list-disc">{items.map((x, i) => <li key={i}>{x}</li>)}</ul>
    </div>
  )
}

/** The AI summary of one plan: a one-line headline in the table, the rest when opened. */
function SummaryCell({ row, open, onToggle, onRegenerate, busy }) {
  const d = row.digest || { state: 'none' }
  const acknowledged = row.state !== 'waiting'
  if (d.state === 'running') {
    return <span className="inline-flex items-center gap-1 text-slate-500"><BaseSpinner size="sm" label="" /> Summarising…</span>
  }
  if (d.state === 'none' || d.state === 'failed') {
    return (
      <div className="text-xs text-slate-500">
        {d.state === 'failed' ? <span className="text-amber-700 dark:text-amber-300">{d.error}</span>
          : acknowledged ? 'No summary yet.' : 'Made when ODU acknowledges receipt.'}
        {acknowledged && (
          <button type="button" onClick={onRegenerate} disabled={busy} className="ml-2 underline text-primary-700 dark:text-primary-300">
            {d.state === 'failed' ? 'Try again' : 'Summarise'}
          </button>
        )}
      </div>
    )
  }
  return (
    <div>
      <button type="button" onClick={onToggle} className="flex items-start gap-1 text-left" aria-expanded={open}>
        {open ? <ChevronDown size={14} className="mt-0.5 shrink-0" /> : <ChevronRight size={14} className="mt-0.5 shrink-0" />}
        <span className="text-slate-700 dark:text-slate-200">{d.headline || 'Summary'}{d.period ? ` (${d.period})` : ''}</span>
      </button>
      {open && (
        <div className="mt-2 ml-4 flex flex-col gap-1.5 text-xs text-slate-600 dark:text-slate-300">
          <p className="flex items-start gap-1 text-violet-700 dark:text-violet-300"><Sparkles size={12} className="mt-0.5 shrink-0" />{SUMMARY_NOTE}</p>
          <List title="Priorities" items={d.priorities} />
          <List title="Targets" items={d.targets} />
          {d.budget_staffing && <div><span className="font-semibold">Budget / staffing: </span>{d.budget_staffing}</div>}
          <List title="Notable" items={d.notable} />
          {d.truncated && (
            <p className="text-amber-700 dark:text-amber-300">
              This is a long plan: only the first {d.parts_read} parts were read, so later sections are not in the summary.
            </p>
          )}
          {acknowledged && (
            <button type="button" onClick={onRegenerate} disabled={busy} className="self-start underline text-primary-700 dark:text-primary-300">
              Summarise again
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export default function ConsolidationPanel({ submissionId }) {
  const toast = useToast()
  const [open, setOpen] = useState({})
  const [busyId, setBusyId] = useState(null)
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

  // While a summary is being made, look again every few seconds so it appears by itself.
  const summarising = (data?.rows || []).some(r => r.digest?.state === 'running')
  useEffect(() => {
    if (!summarising) return undefined
    const id = setInterval(async () => {
      try {
        const res = await api.get(`/submissions/${submissionId}/coverage/`)
        setData(res.data)
      } catch { /* try again next time */ }
    }, 4000)
    return () => clearInterval(id)
  }, [summarising, submissionId])

  const regenerate = async (row) => {
    setBusyId(row.id)
    try {
      await api.post(`/submissions/${submissionId}/coverage/${row.id}/summarise/`)
      setData(prev => ({ ...prev, rows: prev.rows.map(r => (r.id === row.id ? { ...r, digest: { state: 'running' } } : r)) }))
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Could not start the summary.')
    } finally {
      setBusyId(null)
    }
  }

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
                <th className="py-1 pr-3">Timeliness</th><th className="py-1 pr-3">What the plan says (AI summary)</th>
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
                  <td className="py-1.5 pr-3 text-slate-600 dark:text-slate-300 min-w-[16rem]">
                    <SummaryCell
                      row={r} open={!!open[r.id]} busy={busyId === r.id}
                      onToggle={() => setOpen(o => ({ ...o, [r.id]: !o[r.id] }))}
                      onRegenerate={() => regenerate(r)}
                    />
                    {r.ai_review?.recommendation && (
                      <span className="block text-xs text-slate-500 mt-1">
                        Earlier first-pass review: {REC[r.ai_review.recommendation] || r.ai_review.recommendation}
                        {r.ai_review.total ? ` (${r.ai_review.met}/${r.ai_review.total})` : ''}
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
