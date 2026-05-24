import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ClipboardCheck, Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react'
import clsx from 'clsx'
import api from '../../api/client'
import { formatApiError } from '../../utils/apiError'

const SEVERITY_ORDER = ['critical', 'warning', 'info']

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

  if (!submission || submission.current_stage !== 'draft') return null

  const gaps = submission.ai_package_gaps || []
  const sortedGaps = [...gaps].sort(
    (a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity),
  )
  const hasResult = submission.ai_package_processed
  const ready = submission.ai_package_ready

  const handleValidate = async () => {
    setValidating(true)
    setLocalError('')
    try {
      const res = await api.post(`/submissions/${submissionId}/validate-package/`)
      onUpdated?.(res.data)
    } catch (err) {
      setLocalError(formatApiError(err, t('submission.package_validate_failed')))
    } finally {
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
          disabled={validating}
          className="btn-outline text-xs py-1.5 px-3 inline-flex items-center gap-1.5 shrink-0"
        >
          {validating ? <Loader2 size={14} className="animate-spin" /> : <ClipboardCheck size={14} />}
          {validating ? t('submission.package_validating') : t('submission.package_validate')}
        </button>
      </div>

      {localError && (
        <p className="text-sm text-red-600 dark:text-red-400 mb-3">{localError}</p>
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

      {!hasResult && (
        <p className="text-sm text-slate-600 dark:text-slate-300">
          {t('submission.package_prompt')}
        </p>
      )}
    </div>
  )
}
