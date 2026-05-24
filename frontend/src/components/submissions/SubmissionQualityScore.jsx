import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Gauge, Loader2, RefreshCw, AlertCircle } from 'lucide-react'
import clsx from 'clsx'
import api from '../../api/client'

const DIMENSION_KEYS = [
  'completeness',
  'clarity',
  'evidence_quality',
  'psc_formatting',
]

function scoreTone(score) {
  if (score == null) return 'slate'
  if (score >= 80) return 'emerald'
  if (score >= 60) return 'amber'
  return 'red'
}

function toneClasses(tone) {
  return {
    emerald: 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-900/25 dark:text-emerald-100',
    amber: 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-900/25 dark:text-amber-100',
    red: 'border-red-300 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-900/25 dark:text-red-100',
    slate: 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-200',
  }[tone]
}

function effortBadgeClass(effort) {
  if (effort === 'low') return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
  if (effort === 'high') return 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300'
  return 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
}

export function QualityScoreBadge({ submission, compact = false }) {
  const { t } = useTranslation()
  if (!submission || submission.current_stage === 'draft') return null

  const loading = !submission.ai_quality_processed
  const score = submission.ai_quality_score
  const tone = scoreTone(score)

  if (loading) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] text-slate-400">
        <Loader2 size={12} className="animate-spin" aria-hidden />
        {compact ? '…' : t('submission.quality_scoring')}
      </span>
    )
  }

  if (score == null) return null

  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold',
        compact ? 'text-[10px]' : 'text-xs',
        tone === 'emerald' && 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
        tone === 'amber' && 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
        tone === 'red' && 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
      )}
      title={submission.ai_quality_explanation || ''}
    >
      <Gauge size={compact ? 10 : 12} aria-hidden />
      {score}/100
    </span>
  )
}

export default function SubmissionQualityScore({ submission, submissionId, onUpdated, canRescore = false }) {
  const { t } = useTranslation()
  const [rescoring, setRescoring] = useState(false)

  const poll = useCallback(async () => {
    if (!submissionId) return
    try {
      const res = await api.get(`/submissions/${submissionId}/`)
      onUpdated?.(res.data)
    } catch {
      /* ignore */
    }
  }, [submissionId, onUpdated])

  useEffect(() => {
    if (!submissionId || submission?.ai_quality_processed || submission?.current_stage === 'draft') {
      return undefined
    }
    const interval = setInterval(poll, 3000)
    return () => clearInterval(interval)
  }, [submissionId, submission?.ai_quality_processed, submission?.current_stage, poll])

  if (!submission || submission.current_stage === 'draft') return null

  const loading = !submission.ai_quality_processed
  const failed = submission.ai_quality_processed && submission.ai_quality_score == null
  const score = submission.ai_quality_score
  const tone = scoreTone(score)
  const dimensions = submission.ai_quality_dimensions || {}

  const handleRescore = async () => {
    setRescoring(true)
    onUpdated?.({ ...submission, ai_quality_processed: false, ai_quality_score: null })
    try {
      const res = await api.post(`/submissions/${submissionId}/score-quality/`)
      onUpdated?.(res.data)
    } catch {
      await poll()
    } finally {
      setRescoring(false)
    }
  }

  return (
    <div className={clsx('card p-5 mb-4 border-l-4', toneClasses(tone), 'border-l-current')}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <Gauge size={20} className="shrink-0 opacity-80" aria-hidden />
          <div>
            <h2 className="text-sm font-bold">{t('submission.quality_title')}</h2>
            <p className="text-xs opacity-80 mt-0.5">{t('submission.quality_subtitle')}</p>
          </div>
        </div>
        {canRescore && (
          <button
            type="button"
            onClick={handleRescore}
            disabled={rescoring || loading}
            className="btn-outline text-xs py-1 px-2 inline-flex items-center gap-1 shrink-0"
          >
            {rescoring || loading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
            {t('submission.quality_rescore')}
          </button>
        )}
      </div>

      <p className="text-[10px] font-semibold uppercase tracking-wide opacity-80 mb-2">
        AI draft — verify before routing decisions
      </p>

      {loading && (
        <div className="flex items-center gap-2 text-sm opacity-90">
          <Loader2 size={16} className="animate-spin" />
          {t('submission.quality_scoring')}
        </div>
      )}

      {failed && (
        <div className="flex items-start gap-2 text-sm">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          <p>{submission.ai_quality_explanation || t('submission.quality_failed')}</p>
        </div>
      )}

      {!loading && !failed && score != null && (
        <>
          <div className="flex flex-wrap items-baseline gap-3 mb-3">
            <span className="text-4xl font-bold tabular-nums">{score}</span>
            <span className="text-lg opacity-70">/ 100</span>
            {submission.ai_quality_review_effort && (
              <span className={clsx('rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide', effortBadgeClass(submission.ai_quality_review_effort))}>
                {t(`submission.quality_effort_${submission.ai_quality_review_effort}`)}
              </span>
            )}
          </div>

          {submission.ai_quality_explanation && (
            <p className="text-sm leading-relaxed mb-4 opacity-95">{submission.ai_quality_explanation}</p>
          )}

          {DIMENSION_KEYS.some(k => dimensions[k]?.score != null) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {DIMENSION_KEYS.map(key => {
                const dim = dimensions[key]
                if (!dim) return null
                return (
                  <div
                    key={key}
                    className="rounded-lg bg-white/60 dark:bg-slate-900/30 px-3 py-2 border border-black/5 dark:border-white/10"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-semibold uppercase tracking-wide opacity-80">
                        {t(`submission.quality_dim_${key}`)}
                      </span>
                      <span className="text-sm font-bold tabular-nums">{dim.score}</span>
                    </div>
                    {dim.note && (
                      <p className="text-[11px] mt-1 opacity-75 leading-snug">{dim.note}</p>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}
