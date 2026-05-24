import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Download, Loader2, Sparkles } from 'lucide-react'
import api from '../../api/client'
import { formatApiError } from '../../utils/apiError'

export default function MeetingBriefingPack({ meetingId, meetingRef }) {
  const { t } = useTranslation()
  const [job, setJob] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!job?.id || job.status === 'ready' || job.status === 'failed') return undefined
    const timer = setInterval(async () => {
      try {
        const res = await api.get(`/meetings/briefing-packs/${job.id}/`)
        setJob(res.data)
      } catch {
        /* polling */
      }
    }, 2500)
    return () => clearInterval(timer)
  }, [job?.id, job?.status])

  const download = async (url, filename) => {
    const res = await api.get(url, { responseType: 'blob' })
    const blobUrl = URL.createObjectURL(res.data)
    const a = document.createElement('a')
    a.href = blobUrl
    a.download = filename
    a.click()
    setTimeout(() => URL.revokeObjectURL(blobUrl), 5000)
  }

  const generate = useCallback(async () => {
    setBusy(true)
    setError('')
    setJob(null)
    try {
      const res = await api.post(`/meetings/${meetingId}/briefing-pack/generate/`)
      const statusRes = await api.get(`/meetings/briefing-packs/${res.data.id}/`)
      setJob(statusRes.data)
    } catch (err) {
      setError(formatApiError(err, t('meeting_briefing.generate_failed')))
    } finally {
      setBusy(false)
    }
  }, [meetingId, t])

  const ready = job?.status === 'ready'
  const failed = job?.status === 'failed'
  const processing = job && !ready && !failed

  return (
    <div className="rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-900/20 p-3 mt-2">
      <p className="text-xs font-semibold text-indigo-900 dark:text-indigo-200 mb-1">
        {t('meeting_briefing.title')}
      </p>
      <p className="text-[11px] text-indigo-800/80 dark:text-indigo-300/80 mb-2">
        {t('meeting_briefing.subtitle')}
      </p>
      <button
        type="button"
        onClick={generate}
        disabled={busy || processing}
        className="btn-outline text-xs py-1 px-2 inline-flex items-center gap-1"
      >
        {busy || processing ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
        {processing ? t('meeting_briefing.generating') : t('meeting_briefing.generate')}
      </button>
      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
      {failed && job?.error_message && (
        <p className="text-xs text-red-600 mt-2">{job.error_message}</p>
      )}
      {ready && job?.downloads && (
        <div className="flex flex-wrap gap-2 mt-2">
          <button
            type="button"
            className="text-xs text-indigo-700 dark:text-indigo-300 inline-flex items-center gap-1 hover:underline"
            onClick={() => download(job.downloads.pdf, `${meetingRef || 'sitting'}_briefing.pdf`)}
          >
            <Download size={12} /> PDF
          </button>
          <button
            type="button"
            className="text-xs text-indigo-700 dark:text-indigo-300 inline-flex items-center gap-1 hover:underline"
            onClick={() => download(job.downloads.html, `${meetingRef || 'sitting'}_briefing.html`)}
          >
            <Download size={12} /> HTML
          </button>
        </div>
      )}
    </div>
  )
}
