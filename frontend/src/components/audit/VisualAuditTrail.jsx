import { useEffect, useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Text,
  Badge,
  Button,
  Skeleton,
  SkeletonItem,
  tokens,
} from '@fluentui/react-components'
import {
  ArrowRightRegular,
  HistoryRegular,
  ShieldLockRegular,
  DocumentRegular,
} from '@fluentui/react-icons'
import clsx from 'clsx'
import api from '../../api/client'
import { stageLabel } from '../../constants/stages'
import VerificationBadge from './VerificationBadge'

function stageColor(stage) {
  if (stage === 'approved') return tokens.colorPaletteGreenForeground1
  if (stage === 'rejected') return tokens.colorPaletteRedForeground1
  if (stage?.includes('return')) return tokens.colorPaletteMarigoldForeground2
  return tokens.colorBrandForeground1
}

function AuditEntryIcon({ entry }) {
  if (entry.has_decision_proof) {
    return <ShieldLockRegular style={{ color: tokens.colorPaletteGreenForeground1 }} />
  }
  if (entry.entry_type === 'audit') {
    return <HistoryRegular style={{ color: tokens.colorNeutralForeground3 }} />
  }
  return <DocumentRegular style={{ color: tokens.colorBrandForeground1 }} />
}

function entryMatchesStageFilter(entry, stageSet) {
  if (!stageSet?.size) return true
  if (entry.entry_type === 'workflow') {
    return stageSet.has(entry.previous_stage) || stageSet.has(entry.new_stage)
  }
  const extra = entry.extra_data || {}
  if (stageSet.has(extra.previous_stage) || stageSet.has(extra.new_stage)) return true
  const desc = entry.description || ''
  for (const code of stageSet) {
    if (desc.includes(code)) return true
  }
  return false
}

export default function VisualAuditTrail({
  submissionId,
  className,
  stageFilter = null,
  filterLabel = '',
  onClearFilter,
}) {
  const { t } = useTranslation()
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!submissionId) return undefined
    let cancelled = false
    setLoading(true)
    setError(false)
    api
      .get(`/submissions/${submissionId}/visual-audit-trail/`)
      .then((res) => {
        if (!cancelled) setEntries(res.data.entries || [])
      })
      .catch(() => {
        if (!cancelled) {
          setError(true)
          setEntries([])
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [submissionId])

  if (loading) {
    return (
      <div className={clsx('space-y-3 py-2', className)} role="status" aria-busy="true">
        <Skeleton className="flex flex-col gap-2">
          {Array.from({ length: 4 }, (_, i) => (
            <SkeletonItem key={i} size={14} style={{ width: `${85 - i * 8}%` }} />
          ))}
        </Skeleton>
      </div>
    )
  }

  if (error) {
    return (
      <Text size={200} className={className} style={{ color: tokens.colorPaletteRedForeground1 }}>
        {t('decision_proof.trail_load_failed')}
      </Text>
    )
  }

  if (!entries.length) {
    return (
      <Text size={200} className={className} style={{ color: tokens.colorNeutralForeground3 }}>
        {t('decision_proof.trail_empty')}
      </Text>
    )
  }

  if (stageSet && !visibleEntries.length) {
    return (
      <Text size={200} className={className} style={{ color: tokens.colorNeutralForeground3 }}>
        {t('subway.trail_filter_empty', { station: filterLabel || t('subway.station_fallback') })}
      </Text>
    )
  }

  return (
  <>
    {filterLabel && stageSet && (
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Badge appearance="outline" color="brand" size="small">
          {t('subway.trail_filter_active', { station: filterLabel })}
        </Badge>
        {onClearFilter && (
          <Button appearance="subtle" size="small" onClick={onClearFilter}>
            {t('subway.trail_clear_filter')}
          </Button>
        )}
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
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                style={{ backgroundColor: tokens.colorNeutralBackground3 }}
              >
                <AuditEntryIcon entry={entry} />
              </div>
              {!isLast && (
                <div
                  className="w-px flex-1 mt-1 min-h-[24px]"
                  style={{ backgroundColor: tokens.colorNeutralStroke2 }}
                />
              )}
            </div>

            <div className="min-w-0 flex-1 pt-0.5">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                {isWorkflow ? (
                  <>
                    <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
                      {stageLabel(entry.previous_stage)}
                    </Text>
                    <ArrowRightRegular fontSize={12} />
                    <Text
                      size={200}
                      weight="semibold"
                      style={{ color: stageColor(entry.new_stage) }}
                    >
                      {stageLabel(entry.new_stage)}
                    </Text>
                  </>
                ) : (
                  <Badge appearance="outline" size="small">
                    {entry.action}
                  </Badge>
                )}
                {entry.has_decision_proof && (
                  <VerificationBadge
                    submissionId={submissionId}
                    workflowEventId={entry.workflow_event_id}
                    contentHash={entry.content_hash}
                    compact
                  />
                )}
              </div>

              <Text size={100} block style={{ color: tokens.colorNeutralForeground3 }}>
                {entry.actor_username} ·{' '}
                {ts.toLocaleString('en-VU', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
                {entry.ip_address ? ` · ${entry.ip_address}` : ''}
              </Text>

              {entry.remarks && (
                <Text
                  size={200}
                  block
                  className="mt-2 italic rounded-lg px-3 py-2"
                  style={{
                    backgroundColor: tokens.colorNeutralBackground2,
                    color: tokens.colorNeutralForeground2,
                  }}
                >
                  &ldquo;{entry.remarks}&rdquo;
                </Text>
              )}

              {!isWorkflow && entry.description && (
                <Text size={200} block className="mt-1">
                  {entry.description}
                </Text>
              )}

              {entry.content_hash_short && !entry.workflow_event_id && (
                <Text
                  size={100}
                  block
                  className="mt-1 font-mono"
                  style={{ color: tokens.colorNeutralForeground3 }}
                >
                  {t('decision_proof.hash_short', { hash: entry.content_hash_short })}
                </Text>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  </>
  )
}
