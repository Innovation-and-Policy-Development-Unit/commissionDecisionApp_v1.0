/**
 * CommissionerReviewCard.jsx
 * "Review and recommend": one place for what the AI checks concluded about a
 * paper — recommended action, risks, gaps, and questions worth asking.
 * Advisory only; reads stored results and re-runs them on request.
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import { ClipboardCheck, RefreshCw, AlertTriangle, HelpCircle, Scale } from 'lucide-react'
import api from '../../api/client'
import { isTabVisible } from '../../hooks/useVisibilityAwareInterval'
import { useToast } from '../../context/ToastContext'
import BaseButton from '../shared/BaseButton'
import BaseBadge from '../shared/BaseBadge'
import BaseSpinner from '../shared/BaseSpinner'

const POLL_MS = 3000
const POLL_TIMEOUT_MS = 90000

const ACTIONS = {
  approve: { label: 'Approve', color: 'success' },
  approve_with_conditions: { label: 'Approve with conditions', color: 'warning' },
  defer: { label: 'Defer', color: 'warning' },
  reject: { label: 'Reject', color: 'danger' },
}

const RISK_COLOR = { critical: 'danger', high: 'danger', medium: 'warning', low: 'success', minimal: 'success' }

function Section({ icon, title, children }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200">
        {icon}{title}
      </div>
      {children}
    </div>
  )
}

const bullets = 'ml-4 list-disc text-sm text-slate-600 dark:text-slate-300 flex flex-col gap-1'

export default function CommissionerReviewCard({ submissionId, onAsk }) {
  const toast = useToast()
  const [data, setData] = useState(null)
  const [error, setError] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [timedOut, setTimedOut] = useState(false)
  const startedRef = useRef(null)

  const load = useCallback(async () => {
    try {
      const res = await api.get(`/submissions/${submissionId}/review-card/`)
      setData(res.data)
      setError(false)
      return res.data
    } catch {
      setError(true)
      return null
    }
  }, [submissionId])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!refreshing) return undefined
    const id = setInterval(async () => {
      if (Date.now() - startedRef.current > POLL_TIMEOUT_MS) {
        setRefreshing(false)
        setTimedOut(true)
        return
      }
      if (!isTabVisible()) return
      const d = await load()
      if (d?.questions?.processed) setRefreshing(false)
    }, POLL_MS)
    return () => clearInterval(id)
  }, [refreshing, load])

  const refresh = async () => {
    try {
      await api.post(`/submissions/${submissionId}/review-card/refresh/`)
      startedRef.current = Date.now()
      setTimedOut(false)
      setRefreshing(true)
      toast.info('Reviewing the paper…')
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Could not start the review.')
    }
  }

  if (error && !data) return null
  if (!data) return <div className="card p-4"><BaseSpinner size="sm" label="Loading review" /></div>

  const rec = data.recommendation
  const action = ACTIONS[rec?.action]
  const questions = data.questions?.items || []
  const gaps = (data.package?.gaps || []).filter(g => g && typeof g === 'object')
  const riskFactors = (data.risk?.factors || []).map(f => (typeof f === 'string' ? f : f?.factor || f?.description || '')).filter(Boolean)
  const hasAnything = rec || data.risk || data.quality || questions.length > 0

  return (
    <div className="card p-4" aria-busy={refreshing}>
      <div className="flex items-center gap-2 mb-1">
        <ClipboardCheck size={20} className="text-primary-600" />
        <span className="font-bold text-base text-slate-800 dark:text-slate-100">Review and recommend</span>
        <BaseButton
          variant="ghost" size="sm" className="ml-auto"
          icon={refreshing ? <BaseSpinner size="sm" label="" /> : <RefreshCw size={15} />}
          onClick={refresh} disabled={refreshing}
        >
          {refreshing ? 'Reviewing…' : hasAnything ? 'Re-run' : 'Run review'}
        </BaseButton>
      </div>
      <p className="text-xs text-amber-700 dark:text-amber-300 mb-3">
        {data.disclaimer} The Commission decides.
      </p>

      {timedOut && (
        <p className="text-sm text-amber-700 dark:text-amber-300 mb-3">This is taking longer than expected. Click Re-run to try again.</p>
      )}

      {!hasAnything && !refreshing ? (
        <span className="text-sm text-slate-500">Not reviewed yet. Click Run review for a recommendation, risks and questions to ask.</span>
      ) : (
        <div className="flex flex-col gap-4">
          {rec && (
            <Section icon={<Scale size={15} />} title="Recommended action">
              <div className="flex flex-wrap items-center gap-2">
                {action
                  ? <BaseBadge color={action.color}>{action.label}</BaseBadge>
                  : rec.failed
                    ? <span className="text-sm text-amber-700 dark:text-amber-300">The review could not run just now. Click Re-run to try again.</span>
                    : <span className="text-sm text-slate-500">No clear recommendation recorded — re-run to refresh.</span>}
                {rec.confidence != null && action && (
                  <span className="text-xs text-slate-500">{rec.confidence}% confidence</span>
                )}
              </div>
              {rec.rationale && <p className="text-sm text-slate-600 dark:text-slate-300 mt-1.5">{rec.rationale}</p>}
              {rec.conditions?.length > 0 && (
                <ul className={`${bullets} mt-1.5`}>{rec.conditions.map((c, i) => <li key={i}>{c}</li>)}</ul>
              )}
              {rec.legal_basis && (
                <p className="text-xs text-slate-500 mt-1.5"><span className="font-semibold">Basis:</span> {rec.legal_basis}</p>
              )}
              {rec.precedents?.length > 0 && (
                <ul className={`${bullets} mt-1.5`}>
                  {rec.precedents.map((p, i) => <li key={i}><span className="font-medium">{p.reference}</span> — {p.relevance}</li>)}
                </ul>
              )}
            </Section>
          )}

          {(data.risk || gaps.length > 0 || data.quality) && (
            <Section icon={<AlertTriangle size={15} />} title="Risks and gaps">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                {data.risk?.level && <BaseBadge color={RISK_COLOR[data.risk.level.toLowerCase()] || 'info'}>Risk: {data.risk.level}</BaseBadge>}
                {data.quality && <BaseBadge color={data.quality.score >= 75 ? 'success' : data.quality.score >= 50 ? 'warning' : 'danger'}>Quality {data.quality.score}/100</BaseBadge>}
                {data.package && <BaseBadge color={data.package.ready ? 'success' : 'warning'}>{data.package.ready ? 'Package complete' : 'Package gaps'}</BaseBadge>}
              </div>
              {(riskFactors.length > 0 || gaps.length > 0) && (
                <ul className={bullets}>
                  {riskFactors.slice(0, 5).map((f, i) => <li key={`r${i}`}>{f}</li>)}
                  {gaps.slice(0, 5).map((g, i) => <li key={`g${i}`}>{g.message || g.title || g.description}</li>)}
                </ul>
              )}
            </Section>
          )}

          <Section icon={<HelpCircle size={15} />} title="Questions worth asking">
            {refreshing && !questions.length ? (
              <span className="text-sm text-slate-500">Preparing questions…</span>
            ) : questions.length === 0 ? (
              <span className="text-sm text-slate-500">None yet. Click Run review.</span>
            ) : (
              <ol className="ml-4 list-decimal text-sm text-slate-700 dark:text-slate-200 flex flex-col gap-2">
                {questions.map((q, i) => (
                  <li key={i}>
                    <span>{q.question}</span>
                    {q.why && <span className="block text-xs text-slate-500">{q.why}{q.source ? ` (${q.source})` : ''}</span>}
                    {onAsk && (
                      <button
                        type="button"
                        className="text-xs text-primary-700 dark:text-primary-300 underline"
                        onClick={() => onAsk(q.question)}
                      >
                        Ask the assistant
                      </button>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </Section>
        </div>
      )}
    </div>
  )
}
