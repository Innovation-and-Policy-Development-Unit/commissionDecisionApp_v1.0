import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ShieldCheck, X, RefreshCw } from 'lucide-react'
import clsx from 'clsx'
import api from '../../api/client'
import BaseBadge from '../shared/BaseBadge'
import BaseButton from '../shared/BaseButton'
import BaseSpinner from '../shared/BaseSpinner'
import { isTabVisible } from '../../hooks/useVisibilityAwareInterval'
import { formatApiError } from '../../utils/apiError'
import { confidenceTone, policyGuardrailApplies } from '../../utils/policyGuardrail'

const POLL_MS = 3000
const POLL_MAX = 50
const SEVERITY_ORDER = ['high', 'medium', 'low']

function severityBadgeColor(severity) {
  if (severity === 'high') return 'danger'
  if (severity === 'medium') return 'warning'
  return 'info'
}

function observationBorder(severity) {
  if (severity === 'high') return 'border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-900/20'
  if (severity === 'medium') return 'border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-900/20'
  return 'border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/40'
}

/** Right drawer for AI policy observations during draft form fill. */
export default function PolicyGuardrailDrawer({ submission, submissionId, onUpdated, open, onOpenChange }) {
  const { t } = useTranslation()
  const [scanning, setScanning] = useState(false)
  const [localError, setLocalError] = useState('')
  const [pollTimedOut, setPollTimedOut] = useState(false)
  const autoStarted = useRef(false)

  const applies = policyGuardrailApplies(submission)
  const processed = submission?.ai_policy_processed
  const observations = submission?.ai_policy_observations || []
  const sortedObs = [...observations].sort((a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity))
  const confidence = submission?.ai_policy_confidence
  const tone = confidenceTone(confidence)
  const processing = scanning && !processed
  const toneColor = tone === 'success' ? 'success' : tone === 'warning' ? 'warning' : 'danger'
  const toneBar = tone === 'success' ? 'bg-emerald-500' : tone === 'warning' ? 'bg-amber-500' : 'bg-red-500'

  const runScan = useCallback(async () => {
    if (!submissionId) return
    setScanning(true); setLocalError(''); setPollTimedOut(false)
    onUpdated?.({ ...submission, ai_policy_processed: false })
    try {
      await api.post(`/submissions/${submissionId}/scan-policy/`)
    } catch (err) {
      const detail = err.response?.data?.detail
      if (err.response?.status === 400 && err.response?.data?.skipped) {
        setLocalError(detail || t('policy_guardrail.not_applicable')); setScanning(false); return
      }
      setLocalError(formatApiError(err, t('policy_guardrail.scan_failed'))); setScanning(false)
    }
  }, [submissionId, submission, onUpdated, t])

  useEffect(() => {
    if (!open || !applies || autoStarted.current || processed) return
    autoStarted.current = true
    runScan()
  }, [open, applies, processed, runScan])

  useEffect(() => {
    if (!submissionId || !scanning || processed) return undefined
    let attempts = 0
    const interval = setInterval(async () => {
      if (!isTabVisible()) return
      attempts += 1
      if (attempts > POLL_MAX) { clearInterval(interval); setPollTimedOut(true); setScanning(false); return }
      try {
        const res = await api.get(`/submissions/${submissionId}/`)
        onUpdated?.(res.data)
        if (res.data.ai_policy_processed) { clearInterval(interval); setScanning(false); setPollTimedOut(false) }
      } catch { /* ignore */ }
    }, POLL_MS)
    return () => clearInterval(interval)
  }, [submissionId, scanning, processed, onUpdated])

  if (!applies) return null

  return (
    <>
      {open && (
        <button type="button" className="fixed inset-0 z-[65] bg-black/20 lg:hidden" aria-label={t('common.close')} onClick={() => onOpenChange?.(false)} />
      )}

      <aside
        className={clsx(
          'fixed top-[104px] bottom-0 right-0 z-[70] w-full max-w-md flex flex-col border-l shadow-2xl transition-transform duration-300 ease-out',
          'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700',
          open ? 'translate-x-0' : 'translate-x-full pointer-events-none',
        )}
        aria-hidden={!open}
        aria-label={t('policy_guardrail.drawer_title')}
      >
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-slate-100 dark:border-slate-700 shrink-0 bg-primary-50 dark:bg-primary-900/20">
          <div className="flex items-center gap-2 min-w-0">
            <ShieldCheck size={20} className="text-primary-600 shrink-0" />
            <div className="min-w-0">
              <span className="font-semibold text-sm block truncate text-slate-800 dark:text-slate-100">{t('policy_guardrail.drawer_title')}</span>
              <span className="text-[10px] text-slate-500">{t('policy_guardrail.drawer_subtitle')}</span>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <BaseButton variant="ghost" size="icon" iconOnly icon={<RefreshCw size={16} className={scanning ? 'animate-spin' : ''} />} onClick={runScan} disabled={scanning} aria-label={t('policy_guardrail.rescan')} />
            <BaseButton variant="ghost" size="icon" iconOnly icon={<X size={16} />} onClick={() => onOpenChange?.(false)} aria-label={t('common.close')} />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <span className="uppercase tracking-wide block text-[10px] font-semibold text-amber-600 dark:text-amber-400">{t('policy_guardrail.ai_draft_label')}</span>

          {localError && <p className="text-sm text-red-600 dark:text-red-400">{localError}</p>}
          {pollTimedOut && !processed && <p className="text-sm text-amber-700 dark:text-amber-300">{t('policy_guardrail.poll_timeout')}</p>}

          {processing && (
            <div className="flex flex-col items-center gap-3 py-8">
              <BaseSpinner size="lg" label={t('policy_guardrail.scanning')} />
              <p className="text-sm text-center text-slate-500">{t('policy_guardrail.scanning_hint')}</p>
            </div>
          )}

          {processed && !processing && (
            <>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-sm text-slate-700 dark:text-slate-200">{t('policy_guardrail.confidence_label')}</span>
                  <BaseBadge color={toneColor} size="large">{confidence != null ? `${confidence}%` : '—'}</BaseBadge>
                </div>
                <div className="h-2.5 w-full rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                  <div className={clsx('h-full rounded-full transition-all', toneBar)} style={{ width: `${confidence ?? 0}%` }} />
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-300">{submission.ai_policy_summary || t('policy_guardrail.no_summary')}</p>
              </div>

              <p className="font-semibold text-sm pt-1 text-slate-700 dark:text-slate-200">{t('policy_guardrail.observations_title')}</p>

              {sortedObs.length === 0 ? (
                <p className="text-sm text-slate-500">{t('policy_guardrail.no_observations')}</p>
              ) : (
                <ul className="space-y-2">
                  {sortedObs.map((obs, idx) => (
                    <li key={`${obs.category}-${idx}`} className={clsx('rounded-lg border px-3 py-2.5', observationBorder(obs.severity))}>
                      <div className="flex items-center gap-2 mb-1">
                        <BaseBadge color={severityBadgeColor(obs.severity)} size="small">
                          {t(`policy_guardrail.severity_${obs.severity}`, { defaultValue: obs.severity })}
                        </BaseBadge>
                        {obs.category && <span className="text-[10px] uppercase opacity-60">{obs.category}</span>}
                      </div>
                      <span className="text-sm font-semibold block text-slate-800 dark:text-slate-100">{obs.message}</span>
                      {obs.evidence && <span className="text-[10px] block mt-1 italic text-slate-500 dark:text-slate-400">{obs.evidence}</span>}
                    </li>
                  ))}
                </ul>
              )}

              <p className="text-[10px] text-slate-500">{t('policy_guardrail.footer_hint')}</p>
            </>
          )}

          {!processed && !processing && !localError && <p className="text-sm text-slate-600 dark:text-slate-300">{t('policy_guardrail.prompt')}</p>}
        </div>
      </aside>
    </>
  )
}
