import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Button,
  ProgressBar,
  Badge,
  Text,
  Spinner,
  tokens,
} from '@fluentui/react-components'
import { ShieldCheckmarkRegular, DismissRegular, ArrowSyncRegular } from '@fluentui/react-icons'
import clsx from 'clsx'
import api from '../../api/client'
import { formatApiError } from '../../utils/apiError'
import { confidenceTone, policyGuardrailApplies } from '../../utils/policyGuardrail'

const POLL_MS = 3000
const POLL_MAX = 50
const SEVERITY_ORDER = ['high', 'medium', 'low']

function severityBadgeColor(severity) {
  if (severity === 'high') return 'danger'
  if (severity === 'medium') return 'warning'
  return 'informative'
}

function observationBorder(severity) {
  if (severity === 'high') {
    return 'border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-900/20'
  }
  if (severity === 'medium') {
    return 'border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-900/20'
  }
  return 'border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/40'
}

/**
 * Fluent-styled right drawer for AI policy observations during draft form fill.
 */
export default function PolicyGuardrailDrawer({
  submission,
  submissionId,
  onUpdated,
  open,
  onOpenChange,
}) {
  const { t } = useTranslation()
  const [scanning, setScanning] = useState(false)
  const [localError, setLocalError] = useState('')
  const [pollTimedOut, setPollTimedOut] = useState(false)
  const autoStarted = useRef(false)

  const applies = policyGuardrailApplies(submission)
  const processed = submission?.ai_policy_processed
  const observations = submission?.ai_policy_observations || []
  const sortedObs = [...observations].sort(
    (a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity),
  )
  const confidence = submission?.ai_policy_confidence
  const tone = confidenceTone(confidence)
  const processing = scanning && !processed

  const runScan = useCallback(async () => {
    if (!submissionId) return
    setScanning(true)
    setLocalError('')
    setPollTimedOut(false)
    onUpdated?.({ ...submission, ai_policy_processed: false })
    try {
      await api.post(`/submissions/${submissionId}/scan-policy/`)
    } catch (err) {
      const detail = err.response?.data?.detail
      if (err.response?.status === 400 && err.response?.data?.skipped) {
        setLocalError(detail || t('policy_guardrail.not_applicable'))
        setScanning(false)
        return
      }
      setLocalError(formatApiError(err, t('policy_guardrail.scan_failed')))
      setScanning(false)
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
      attempts += 1
      if (attempts > POLL_MAX) {
        clearInterval(interval)
        setPollTimedOut(true)
        setScanning(false)
        return
      }
      try {
        const res = await api.get(`/submissions/${submissionId}/`)
        onUpdated?.(res.data)
        if (res.data.ai_policy_processed) {
          clearInterval(interval)
          setScanning(false)
          setPollTimedOut(false)
        }
      } catch {
        /* ignore */
      }
    }, POLL_MS)

    return () => clearInterval(interval)
  }, [submissionId, scanning, processed, onUpdated])

  if (!applies) return null

  return (
    <>
      {open && (
        <button
          type="button"
          className="fixed inset-0 z-[65] bg-black/20 lg:hidden"
          aria-label={t('common.close')}
          onClick={() => onOpenChange?.(false)}
        />
      )}

      <aside
        className={clsx(
          'fixed top-[104px] bottom-0 right-0 z-[70] w-full max-w-md flex flex-col',
          'border-l shadow-2xl transition-transform duration-300 ease-out',
          'bg-[var(--colorNeutralBackground1)] dark:bg-slate-900',
          'border-slate-200 dark:border-slate-700',
          open ? 'translate-x-0' : 'translate-x-full pointer-events-none',
        )}
        aria-hidden={!open}
        aria-label={t('policy_guardrail.drawer_title')}
      >
        <div
          className="flex items-center justify-between gap-2 px-4 py-3 border-b border-slate-100 dark:border-slate-700 shrink-0"
          style={{ backgroundColor: tokens.colorBrandBackground2 }}
        >
          <div className="flex items-center gap-2 min-w-0">
            <ShieldCheckmarkRegular className="text-xl shrink-0" style={{ color: tokens.colorBrandForeground1 }} />
            <div className="min-w-0">
              <Text weight="semibold" size={300} className="block truncate">
                {t('policy_guardrail.drawer_title')}
              </Text>
              <Text size={100} style={{ color: tokens.colorNeutralForeground3 }}>
                {t('policy_guardrail.drawer_subtitle')}
              </Text>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button
              appearance="subtle"
              size="small"
              icon={<ArrowSyncRegular />}
              onClick={runScan}
              disabled={scanning}
              title={t('policy_guardrail.rescan')}
            />
            <Button
              appearance="subtle"
              size="small"
              icon={<DismissRegular />}
              onClick={() => onOpenChange?.(false)}
              title={t('common.close')}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <Text
            size={100}
            weight="semibold"
            className="uppercase tracking-wide block"
            style={{ color: tokens.colorPaletteMarigoldForeground2 }}
          >
            {t('policy_guardrail.ai_draft_label')}
          </Text>

          {localError && (
            <Text size={200} className="text-red-600 dark:text-red-400 block">{localError}</Text>
          )}

          {pollTimedOut && !processed && (
            <Text size={200} className="text-amber-700 dark:text-amber-300 block">
              {t('policy_guardrail.poll_timeout')}
            </Text>
          )}

          {processing && (
            <div className="flex flex-col items-center gap-3 py-8">
              <Spinner size="large" label={t('policy_guardrail.scanning')} />
              <Text size={200} align="center" style={{ color: tokens.colorNeutralForeground3 }}>
                {t('policy_guardrail.scanning_hint')}
              </Text>
            </div>
          )}

          {processed && !processing && (
            <>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Text weight="semibold" size={200}>{t('policy_guardrail.confidence_label')}</Text>
                  <Badge
                    appearance="filled"
                    color={tone === 'success' ? 'success' : tone === 'warning' ? 'warning' : 'danger'}
                    size="large"
                  >
                    {confidence != null ? `${confidence}%` : '—'}
                  </Badge>
                </div>
                <ProgressBar
                  value={confidence ?? 0}
                  max={100}
                  thickness="large"
                  color={tone === 'success' ? 'success' : tone === 'warning' ? 'warning' : 'danger'}
                />
                <Text size={200} style={{ color: tokens.colorNeutralForeground2 }}>
                  {submission.ai_policy_summary || t('policy_guardrail.no_summary')}
                </Text>
              </div>

              <Text weight="semibold" size={200} className="pt-1">
                {t('policy_guardrail.observations_title')}
              </Text>

              {sortedObs.length === 0 ? (
                <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
                  {t('policy_guardrail.no_observations')}
                </Text>
              ) : (
                <ul className="space-y-2">
                  {sortedObs.map((obs, idx) => (
                    <li
                      key={`${obs.category}-${idx}`}
                      className={clsx('rounded-lg border px-3 py-2.5', observationBorder(obs.severity))}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Badge appearance="outline" color={severityBadgeColor(obs.severity)} size="small">
                          {t(`policy_guardrail.severity_${obs.severity}`, { defaultValue: obs.severity })}
                        </Badge>
                        {obs.category && (
                          <Text size={100} className="uppercase opacity-60">{obs.category}</Text>
                        )}
                      </div>
                      <Text size={200} weight="semibold" className="block text-slate-800 dark:text-slate-100">
                        {obs.message}
                      </Text>
                      {obs.evidence && (
                        <Text size={100} className="block mt-1 italic text-slate-500 dark:text-slate-400">
                          {obs.evidence}
                        </Text>
                      )}
                    </li>
                  ))}
                </ul>
              )}

              <Text size={100} style={{ color: tokens.colorNeutralForeground3 }}>
                {t('policy_guardrail.footer_hint')}
              </Text>
            </>
          )}

          {!processed && !processing && !localError && (
            <Text size={200}>{t('policy_guardrail.prompt')}</Text>
          )}
        </div>
      </aside>
    </>
  )
}
