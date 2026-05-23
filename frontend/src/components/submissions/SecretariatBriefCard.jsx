import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Sparkles, Loader2, RefreshCw } from 'lucide-react'
import api from '../../api/client'

const POLL_MS = 3000
const POLL_MAX = 40

export default function SecretariatBriefCard({ submission, submissionId, onUpdated }) {
  const { t } = useTranslation()
  const [regenerating, setRegenerating] = useState(false)

  useEffect(() => {
    if (!submissionId || submission?.ai_brief_processed) return undefined

    let attempts = 0
    const interval = setInterval(async () => {
      attempts += 1
      if (attempts > POLL_MAX) {
        clearInterval(interval)
        return
      }
      try {
        const res = await api.get(`/submissions/${submissionId}/`)
        onUpdated?.(res.data)
        if (res.data.ai_brief_processed) clearInterval(interval)
      } catch {
        /* ignore poll errors */
      }
    }, POLL_MS)

    return () => clearInterval(interval)
  }, [submissionId, submission?.ai_brief_processed, onUpdated])

  const handleRegenerate = async () => {
    setRegenerating(true)
    onUpdated?.({ ...submission, ai_brief_processed: false })
    try {
      await api.post(`/submissions/${submissionId}/generate-brief/`)
      const res = await api.get(`/submissions/${submissionId}/`)
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

  return (
    <div className="card p-5 mb-4 border-l-4 border-l-indigo-500 bg-gradient-to-br from-indigo-50/80 to-white dark:from-indigo-950/30 dark:to-slate-900">
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
          disabled={regenerating}
          className="btn-outline btn-sm shrink-0 disabled:opacity-50"
        >
          {regenerating ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          {t('submission.ai_brief_regenerate')}
        </button>
      </div>

      {!submission?.ai_brief_processed ? (
        <div className="flex items-center gap-2 text-sm text-indigo-700 dark:text-indigo-300 py-4">
          <Loader2 size={18} className="animate-spin shrink-0" />
          {t('submission.ai_brief_generating')}
        </div>
      ) : submission?.ai_brief_summary ? (
        <div className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed bg-white/60 dark:bg-slate-800/40 rounded-xl px-4 py-3 border border-indigo-100 dark:border-indigo-900/50">
          {submission.ai_brief_summary}
        </div>
      ) : (
        <p className="text-sm text-slate-500 italic">{t('submission.ai_brief_empty')}</p>
      )}

      {generatedAt && submission?.ai_brief_processed && (
        <p className="text-[10px] text-slate-400 mt-2 uppercase tracking-widest">
          {t('submission.ai_brief_generated', { time: generatedAt })}
        </p>
      )}
    </div>
  )
}
