import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Card,
  CardHeader,
  Text,
  Button,
  Badge,
  tokens,
} from '@fluentui/react-components'
import { SparkleRegular, ArrowSyncRegular } from '@fluentui/react-icons'
import AiTextSkeleton from '../shared/AiTextSkeleton'
import api from '../../api/client'

const POLL_MS = 3000
const POLL_MAX = 40

export default function ExecutiveBriefPanel({
  submissionId,
  itemLabel,
  canRegenerate = false,
}) {
  const { t } = useTranslation()
  const [submission, setSubmission] = useState(null)
  const [loading, setLoading] = useState(false)
  const [pollTimedOut, setPollTimedOut] = useState(false)
  const [regenerating, setRegenerating] = useState(false)

  useEffect(() => {
    if (!submissionId) {
      setSubmission(null)
      return undefined
    }
    let cancelled = false
    setLoading(true)
    setPollTimedOut(false)
    api
      .get(`/submissions/${submissionId}/`)
      .then((res) => {
        if (!cancelled) setSubmission(res.data)
      })
      .catch(() => {
        if (!cancelled) setSubmission(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [submissionId])

  useEffect(() => {
    if (!submissionId || submission?.ai_brief_processed) return undefined

    let attempts = 0
    const interval = setInterval(async () => {
      attempts += 1
      if (attempts > POLL_MAX) {
        clearInterval(interval)
        setPollTimedOut(true)
        return
      }
      try {
        const res = await api.get(`/submissions/${submissionId}/`)
        setSubmission(res.data)
        if (res.data.ai_brief_processed) {
          clearInterval(interval)
          setPollTimedOut(false)
        }
      } catch {
        /* ignore */
      }
    }, POLL_MS)

    return () => clearInterval(interval)
  }, [submissionId, submission?.ai_brief_processed])

  const handleRegenerate = async () => {
    if (!canRegenerate || !submissionId) return
    setRegenerating(true)
    setPollTimedOut(false)
    setSubmission((s) => (s ? { ...s, ai_brief_processed: false, ai_brief_summary: '' } : s))
    try {
      const res = await api.post(`/submissions/${submissionId}/generate-brief/`)
      setSubmission(res.data)
    } catch {
      /* silent */
    } finally {
      setRegenerating(false)
    }
  }

  if (!submissionId) {
    return (
      <Card className="h-full flex items-center justify-center">
        <Text className="text-center text-neutral-500 px-6">
          {t('sitting_pack.select_item')}
        </Text>
      </Card>
    )
  }

  const isBriefLoading = submission && !submission.ai_brief_processed && !pollTimedOut
  const showBrief = submission?.ai_brief_processed && submission?.ai_brief_summary
  const generatedAt = submission?.ai_brief_generated_at
    ? new Date(submission.ai_brief_generated_at).toLocaleString('en-VU', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null

  return (
    <Card className="h-full flex flex-col overflow-hidden">
      <CardHeader
        header={
          <div className="flex items-start justify-between gap-2 w-full pr-1">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <SparkleRegular style={{ color: tokens.colorBrandForeground1 }} />
                <Text weight="semibold">{t('submission.ai_brief_title')}</Text>
                <Badge appearance="outline" color="informative" size="small">
                  {t('sitting_pack.ai_draft_badge')}
                </Badge>
              </div>
              {itemLabel && (
                <Text size={200} className="block mt-1 truncate" title={itemLabel}>
                  {itemLabel}
                </Text>
              )}
            </div>
            {canRegenerate && (
              <Button
                appearance="subtle"
                size="small"
                icon={<ArrowSyncRegular />}
                disabled={regenerating || isBriefLoading || loading}
                onClick={handleRegenerate}
              >
                {t('submission.ai_brief_regenerate')}
              </Button>
            )}
          </div>
        }
        description={t('submission.ai_brief_subtitle')}
      />

      <div className="flex-1 overflow-y-auto px-4 pb-4 min-h-0">
        {loading && !submission ? (
          <AiTextSkeleton lines={6} statusLabel={t('submission.ai_brief_generating')} />
        ) : isBriefLoading ? (
          <AiTextSkeleton lines={8} statusLabel={t('submission.ai_brief_generating')} />
        ) : showBrief ? (
          <Text
            as="div"
            className="whitespace-pre-wrap leading-relaxed text-sm"
            style={{ color: tokens.colorNeutralForeground1 }}
          >
            {submission.ai_brief_summary}
          </Text>
        ) : (
          <Text className="text-amber-700 dark:text-amber-300 text-sm">
            {pollTimedOut
              ? t('submission.ai_brief_timeout')
              : t('submission.ai_brief_empty')}
          </Text>
        )}

        {generatedAt && showBrief && (
          <Text
            size={100}
            className="block mt-4 uppercase tracking-widest"
            style={{ color: tokens.colorNeutralForeground3 }}
          >
            {t('submission.ai_brief_generated', { time: generatedAt })}
          </Text>
        )}
      </div>
    </Card>
  )
}
