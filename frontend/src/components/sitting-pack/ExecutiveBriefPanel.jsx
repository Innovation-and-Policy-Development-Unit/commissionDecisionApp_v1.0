import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Sparkles, RefreshCw } from 'lucide-react'
import AiTextSkeleton from '../shared/AiTextSkeleton'
import BaseBadge from '../shared/BaseBadge'
import BaseButton from '../shared/BaseButton'
import api from '../../api/client'
import { isTabVisible } from '../../hooks/useVisibilityAwareInterval'

const POLL_MS = 3000
const POLL_MAX = 40

export default function ExecutiveBriefPanel({ submissionId, itemLabel, canRegenerate = false }) {
  const { t } = useTranslation()
  const [submission, setSubmission] = useState(null)
  const [loading, setLoading] = useState(false)
  const [pollTimedOut, setPollTimedOut] = useState(false)
  const [regenerating, setRegenerating] = useState(false)

  useEffect(() => {
    if (!submissionId) { setSubmission(null); return undefined }
    let cancelled = false
    setLoading(true); setPollTimedOut(false)
    api.get(`/submissions/${submissionId}/`)
      .then((res) => { if (!cancelled) setSubmission(res.data) })
      .catch(() => { if (!cancelled) setSubmission(null) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [submissionId])

  useEffect(() => {
    if (!submissionId || submission?.ai_brief_processed) return undefined
    let attempts = 0
    const interval = setInterval(async () => {
      if (!isTabVisible()) return
      attempts += 1
      if (attempts > POLL_MAX) { clearInterval(interval); setPollTimedOut(true); return }
      try {
        const res = await api.get(`/submissions/${submissionId}/`)
        setSubmission(res.data)
        if (res.data.ai_brief_processed) { clearInterval(interval); setPollTimedOut(false) }
      } catch { /* ignore */ }
    }, POLL_MS)
    return () => clearInterval(interval)
  }, [submissionId, submission?.ai_brief_processed])

  const handleRegenerate = async () => {
    if (!canRegenerate || !submissionId) return
    setRegenerating(true); setPollTimedOut(false)
    setSubmission((s) => (s ? { ...s, ai_brief_processed: false, ai_brief_summary: '' } : s))
    try {
      const res = await api.post(`/submissions/${submissionId}/generate-brief/`)
      setSubmission(res.data)
    } catch { /* silent */ } finally { setRegenerating(false) }
  }

  if (!submissionId) {
    return (
      <div className="card h-full flex items-center justify-center">
        <p className="text-center text-slate-500 px-6">{t('sitting_pack.select_item')}</p>
      </div>
    )
  }

  const isBriefLoading = submission && !submission.ai_brief_processed && !pollTimedOut
  const showBrief = submission?.ai_brief_processed && submission?.ai_brief_summary
  const generatedAt = submission?.ai_brief_generated_at
    ? new Date(submission.ai_brief_generated_at).toLocaleString('en-VU', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : null

  return (
    <div className="card h-full flex flex-col overflow-hidden">
      <div className="p-4 border-b border-slate-100 dark:border-slate-700">
        <div className="flex items-start justify-between gap-2 w-full">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Sparkles size={16} className="text-primary-500" />
              <span className="font-semibold text-slate-800 dark:text-slate-100">{t('submission.ai_brief_title')}</span>
              <BaseBadge color="info" size="small">{t('sitting_pack.ai_draft_badge')}</BaseBadge>
            </div>
            {itemLabel && <span className="block mt-1 truncate text-xs text-slate-500" title={itemLabel}>{itemLabel}</span>}
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t('submission.ai_brief_subtitle')}</p>
          </div>
          {canRegenerate && (
            <BaseButton variant="ghost" size="sm" icon={<RefreshCw size={15} className={regenerating ? 'animate-spin' : ''} />}
              disabled={regenerating || isBriefLoading || loading} onClick={handleRegenerate}>
              {t('submission.ai_brief_regenerate')}
            </BaseButton>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4 pt-3 min-h-0">
        {loading && !submission ? (
          <AiTextSkeleton lines={6} statusLabel={t('submission.ai_brief_generating')} />
        ) : isBriefLoading ? (
          <AiTextSkeleton lines={8} statusLabel={t('submission.ai_brief_generating')} />
        ) : showBrief ? (
          <div className="whitespace-pre-wrap leading-relaxed text-sm text-slate-800 dark:text-slate-100">{submission.ai_brief_summary}</div>
        ) : (
          <p className="text-amber-700 dark:text-amber-300 text-sm">
            {pollTimedOut ? t('submission.ai_brief_timeout') : t('submission.ai_brief_empty')}
          </p>
        )}
        {generatedAt && showBrief && (
          <span className="block mt-4 uppercase tracking-widest text-[10px] text-slate-500">
            {t('submission.ai_brief_generated', { time: generatedAt })}
          </span>
        )}
      </div>
    </div>
  )
}
