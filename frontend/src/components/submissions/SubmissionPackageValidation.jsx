import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ClipboardCheck, Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react'
import clsx from 'clsx'
import api from '../../api/client'
import { formatApiError } from '../../utils/apiError'

const SEVERITY_ORDER = ['critical', 'warning', 'info']
const POLL_MS = 3000
const POLL_MAX = 40

function severityClass(severity) {
  if (severity === 'critical') {
    return 'border-red-200 bg-red-50 text-red-900 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-100'
  }
  if (severity === 'warning') {
    return 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-100'
  }
  return 'border-slate-200 bg-slate-50 text-slate-800 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-200'
}

export default function SubmissionPackageValidation({
  submission,
  submissionId,
  onUpdated,
}) {
  const { t } = useTranslation()
  const [validating, setValidating] = useState(false)
  const [localError, setLocalError] = useState('')
  const [pollTimedOut, setPollTimedOut] = useState(false)

  if (!submission || submission.current_stage !== 'draft') return null

  const gaps = submission.ai_package_gaps || []
  const sortedGaps = [...gaps].sort(
    (a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity),
  )
  const hasResult = submission.ai_package_processed
  const ready = submission.ai_package_ready
  const processing = !hasResult && validating

  useEffect(() => {
    if (!submissionId || hasResult) return undefined
    if (!validating && submission.ai_package_processed) return undefined

    let attempts = 0
    const interval = setInterval(async () => {
      attempts += 1
      if (attempts > POLL_MAX) {
        clearInterval(interval)
        setPollTimedOut(true)
        setValidating(false)
        return
      }
      try {
        const res = await api.get(`/submissions/${submissionId}/`)
        onUpdated?.(res.data)
        if (res.data.ai_package_processed) {
          clearInterval(interval)
          setValidating(false)
          setPollTimedOut(false)
        }
      } catch {
        /* ignore */
      }
    }, POLL_MS)

    return () => clearInterval(interval)
  }, [submissionId, hasResult, validating, onUpdated])

  const handleValidate = async () => {
    setValidating(true)
    setLocalError('')
    setPollTimedOut(false)
    onUpdated?.({ ...submission, ai_package_processed: false })
    try {
      await api.post(`/submissions/${submissionId}/validate-package/`)
      const res = await api.get(`/submissions/${submissionId}/`)
      onUpdated?.(res.data)
      if (!res.data.ai_package_processed) {
        /* polling effect continues */
        return
      }
    } catch (err) {
      setLocalError(formatApiError(err, t('submission.package_validate_failed')))
      setValidating(false)
    }
  }

  return (
    <div
      className={clsx(
        'card p-5 mb-4 border-l-4',
        hasResult && ready && 'border-emerald-500',
        hasResult && !ready && 'border-amber-500',
        !hasResult && 'border-primary-400',
      )}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <ClipboardCheck size={20} className="shrink-0 text-primary-600 dark:text-primary-400" aria-hidden />
          <div>
            <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">
              {t('submission.package_title')}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {t('submission.package_subtitle')}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleValidate}
          disabled={validating || processing}
          className="btn-outline text-xs py-1.5 px-3 inline-flex items-center gap-1.5 shrink-0"
        >
          {(validating || processing) ? <Loader2 size={14} className="animate-spin" /> : <ClipboardCheck size={14} />}
          {(validating || processing) ? t('submission.package_validating') : t('submission.package_validate')}
        </button>
      </div>

      <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300 mb-2">
        AI draft — verify before submitting
      </p>

      {localError && (
        <p className="text-sm text-red-600 dark:text-red-400 mb-3">{localError}</p>
      )}

      {pollTimedOut && !hasResult && (
        <p className="text-sm text-amber-700 dark:text-amber-300 mb-3">
          Validation is taking longer than expected. Refresh the page or try again.
        </p>
      )}

      {hasResult && (
        <div className="space-y-3">
          <div
            className={clsx(
              'flex items-start gap-2 rounded-lg px-3 py-2 text-sm border',
              ready
                ? 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-900/25 dark:text-emerald-100'
                : 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-900/25 dark:text-amber-100',
            )}
          >
            {ready ? (
              <CheckCircle2 size={18} className="shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle size={18} className="shrink-0 mt-0.5" />
            )}
            <p>{submission.ai_package_summary || t('submission.package_no_summary')}</p>
          </div>

          {sortedGaps.length > 0 && (
            <ul className="space-y-2">
              {sortedGaps.map((gap, idx) => (
                <li
                  key={`${gap.severity}-${idx}`}
                  className={clsx(
                    'rounded-lg border px-3 py-2 text-sm',
                    severityClass(gap.severity),
                  )}
                >
                  <span className="text-[10px] font-bold uppercase tracking-wide opacity-70 mr-2">
                    {t(`submission.package_severity_${gap.severity}`, { defaultValue: gap.severity })}
                  </span>
                  {gap.message}
                </li>
              ))}
            </ul>
          )}

          {!ready && (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t('submission.package_block_hint')}
            </p>
          )}
        </div>
      )}

      {!hasResult && !validating && (
        <p className="text-sm text-slate-600 dark:text-slate-300">
          {t('submission.package_prompt')}
        </p>
      )}
    </div>
  )
}
