import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Sparkles, RefreshCw, AlertCircle } from 'lucide-react'
import AiProcessingIndicator from '../shared/AiProcessingIndicator'
import api from '../../api/client'

const POLL_MS = 3000
const POLL_MAX = 40

export default function SecretariatBriefCard({ submission, submissionId, onUpdated }) {
  const { t } = useTranslation()
  const [regenerating, setRegenerating] = useState(false)
  const [pollTimedOut, setPollTimedOut] = useState(false)

  useEffect(() => {
    setPollTimedOut(false)
  }, [submissionId, submission?.ai_brief_processed])

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
        onUpdated?.(res.data)
        if (res.data.ai_brief_processed) {
          clearInterval(interval)
          setPollTimedOut(false)
        }
      } catch {
        /* ignore poll errors */
      }
    }, POLL_MS)

    return () => clearInterval(interval)
  }, [submissionId, submission?.ai_brief_processed, onUpdated])

  const handleRegenerate = async () => {
    setRegenerating(true)
    setPollTimedOut(false)
    onUpdated?.({ ...submission, ai_brief_processed: false, ai_brief_summary: '' })
    try {
      const res = await api.post(`/submissions/${submissionId}/generate-brief/`)
      onUpdated?.(res.data)
    } catch {
      /* parent may show toast */
    } finally {
      setRegenerating(false)
    }
  }

  const generatedAt = submission?.ai_brief_generated_at
    ? new Date(submission.ai_brief_generated_at).toLocaleString('en-VU', {
        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
      })
    : null

  const isLoading = !submission?.ai_brief_processed && !pollTimedOut
  const showBrief = submission?.ai_brief_processed && submission?.ai_brief_summary
  const showError =
    pollTimedOut ||
    (submission?.ai_brief_processed && !submission?.ai_brief_summary)

  return (
    <div className="card p-5 mb-4 border-l-4 border-l-indigo-500 bg-gradient-to-br from-indigo-50/80 to-white dark:from-indigo-950/30 dark:to-slate-900">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300 mb-2">
        AI draft — verify before Commission routing
      </p>

      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center text-indigo-600 dark:text-indigo-300">
            <Sparkles size={18} />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              {t('submission.ai_brief_title')}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t('submission.ai_brief_subtitle')}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleRegenerate}
          disabled={regenerating || isLoading}
          className="btn-outline btn-sm shrink-0 disabled:opacity-50"
        >
          {regenerating ? (
            <span className="inline-block w-3.5 h-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" aria-hidden />
          ) : (
            <RefreshCw size={14} />
          )}
          {t('submission.ai_brief_regenerate')}
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-3 py-2">
          <div className="text-sm text-slate-600 dark:text-slate-300 rounded-lg border border-indigo-100 dark:border-indigo-900/50 px-3 py-2 bg-white/50 dark:bg-slate-800/30">
            <p className="font-semibold text-slate-800 dark:text-slate-100">{submission.title}</p>
            <p className="text-xs mt-1 text-slate-500">
              {submission.reference_number}
              {submission.ministry?.name ? ` · ${submission.ministry.name}` : ''}
              {' · '}{submission.current_stage?.replace(/_/g, ' ')}
            </p>
            <p className="text-[10px] text-indigo-600 dark:text-indigo-400 mt-2">AI executive brief loading…</p>
          </div>
          <AiProcessingIndicator
            label={t('submission.ai_brief_generating', { defaultValue: 'AI is thinking…' })}
            size="lg"
            variant="indigo"
          />
        </div>
      ) : showBrief ? (
        <div className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed bg-white/60 dark:bg-slate-800/40 rounded-xl px-4 py-3 border border-indigo-100 dark:border-indigo-900/50">
          {submission.ai_brief_summary}
        </div>
      ) : showError ? (
        <div className="flex items-start gap-2 text-sm text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-3">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          <p>
            {pollTimedOut
              ? t('submission.ai_brief_timeout')
              : submission?.ai_brief_summary || t('submission.ai_brief_empty')}
          </p>
        </div>
      ) : null}

      {generatedAt && submission?.ai_brief_processed && showBrief && (
        <p className="text-[10px] text-slate-400 mt-2 uppercase tracking-widest">
          {t('submission.ai_brief_generated', { time: generatedAt })}
        </p>
      )}
    </div>
  )
}
