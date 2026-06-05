import { useEffect, useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowRight, History, ShieldCheck, FileText } from 'lucide-react'
import clsx from 'clsx'
import api from '../../api/client'
import { normalizeFieldPayload } from '../../utils/listPayload'
import { stageLabel } from '../../constants/stages'
import BaseBadge from '../shared/BaseBadge'
import BaseButton from '../shared/BaseButton'
import VerificationBadge from './VerificationBadge'

function stageColorClass(stage) {
  if (stage === 'approved') return 'text-emerald-600 dark:text-emerald-400'
  if (stage === 'rejected') return 'text-red-600 dark:text-red-400'
  if (stage?.includes('return')) return 'text-amber-600 dark:text-amber-400'
  return 'text-primary-600 dark:text-primary-400'
}

function AuditEntryIcon({ entry }) {
  if (entry.has_decision_proof) return <ShieldCheck size={16} className="text-emerald-600" />
  if (entry.entry_type === 'audit') return <History size={16} className="text-slate-400" />
  return <FileText size={16} className="text-primary-600" />
}

function entryMatchesStageFilter(entry, stageSet) {
  if (!stageSet?.size) return true
  if (entry.entry_type === 'workflow') {
    return stageSet.has(entry.previous_stage) || stageSet.has(entry.new_stage)
  }
  const extra = entry.extra_data || {}
  if (stageSet.has(extra.previous_stage) || stageSet.has(extra.new_stage)) return true
  const desc = entry.description || ''
  for (const code of stageSet) { if (desc.includes(code)) return true }
  return false
}

export default function VisualAuditTrail({ submissionId, className, stageFilter = null, filterLabel = '', onClearFilter }) {
  const { t } = useTranslation()
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!submissionId) return undefined
    let cancelled = false
    setLoading(true); setError(false)
    api.get(`/submissions/${submissionId}/visual-audit-trail/`)
      .then((res) => { if (!cancelled) setEntries(normalizeFieldPayload(res.data, 'entries')) })
      .catch(() => { if (!cancelled) { setError(true); setEntries([]) } })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [submissionId])

  const stageSet = useMemo(() => {
    if (!stageFilter) return null
    const codes = Array.isArray(stageFilter) ? stageFilter : [stageFilter]
    const set = new Set(codes.filter(Boolean))
    return set.size ? set : null
  }, [stageFilter])

  const visibleEntries = useMemo(
    () => entries.filter((entry) => entryMatchesStageFilter(entry, stageSet)),
    [entries, stageSet],
  )

  if (loading) {
    return (
      <div className={clsx('space-y-2 py-2', className)} role="status" aria-busy="true">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-3.5 rounded bg-slate-200 dark:bg-slate-700 animate-pulse" style={{ width: `${85 - i * 8}%` }} />
        ))}
      </div>
    )
  }
  if (error) return <p className={clsx('text-xs text-red-600 dark:text-red-400', className)}>{t('decision_proof.trail_load_failed')}</p>
  if (!entries.length) return <p className={clsx('text-xs text-slate-500', className)}>{t('decision_proof.trail_empty')}</p>
  if (stageSet && !visibleEntries.length) {
    return <p className={clsx('text-xs text-slate-500', className)}>{t('subway.trail_filter_empty', { station: filterLabel || t('subway.station_fallback') })}</p>
  }

  return (
    <>
      {filterLabel && stageSet && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <BaseBadge color="primary" size="small">{t('subway.trail_filter_active', { station: filterLabel })}</BaseBadge>
          {onClearFilter && <BaseButton variant="ghost" size="sm" onClick={onClearFilter}>{t('subway.trail_clear_filter')}</BaseButton>}
        </div>
      )}
      <ol className={clsx('relative', className)} aria-label={t('decision_proof.trail_aria')}>
        {visibleEntries.map((entry, idx) => {
          const isLast = idx === visibleEntries.length - 1
          const isWorkflow = entry.entry_type === 'workflow'
          const ts = new Date(entry.timestamp)
          return (
            <li key={entry.id} className="flex gap-3 pb-5 last:pb-0">
              <div className="flex flex-col items-center w-6 shrink-0">
                <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-slate-100 dark:bg-slate-700">
                  <AuditEntryIcon entry={entry} />
                </div>
                {!isLast && <div className="w-px flex-1 mt-1 min-h-[24px] bg-slate-200 dark:bg-slate-700" />}
              </div>
              <div className="min-w-0 flex-1 pt-0.5">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  {isWorkflow ? (
                    <>
                      <span className="text-xs text-slate-500">{stageLabel(entry.previous_stage)}</span>
                      <ArrowRight size={12} className="text-slate-400" />
                      <span className={clsx('text-xs font-semibold', stageColorClass(entry.new_stage))}>{stageLabel(entry.new_stage)}</span>
                    </>
                  ) : (
                    <BaseBadge color="outline" size="small">{entry.action}</BaseBadge>
                  )}
                  {entry.has_decision_proof && (
                    <VerificationBadge submissionId={submissionId} workflowEventId={entry.workflow_event_id} contentHash={entry.content_hash} compact />
                  )}
                </div>
                <span className="block text-[10px] text-slate-500">
                  {entry.actor_username} ·{' '}
                  {ts.toLocaleString('en-VU', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  {entry.ip_address ? ` · ${entry.ip_address}` : ''}
                </span>
                {entry.remarks && (
                  <p className="text-xs block mt-2 italic rounded-lg px-3 py-2 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                    &ldquo;{entry.remarks}&rdquo;
                  </p>
                )}
                {!isWorkflow && entry.description && <p className="text-xs block mt-1 text-slate-600 dark:text-slate-300">{entry.description}</p>}
                {entry.content_hash_short && !entry.workflow_event_id && (
                  <span className="block mt-1 font-mono text-[10px] text-slate-500">{t('decision_proof.hash_short', { hash: entry.content_hash_short })}</span>
                )}
              </div>
            </li>
          )
        })}
      </ol>
    </>
  )
}
