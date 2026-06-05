import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Download, RefreshCw, Loader2, AlertCircle } from 'lucide-react'
import { smartReportsApi } from '../../api/smartReports'

const POLL_MS = 2500

/**
 * Polls a SmartReport job until ready, then renders the self-contained HTML in an
 * iframe (srcDoc) and offers download / re-run.
 */
export default function SmartReportViewer({ reportId, onRerun }) {
  const { t } = useTranslation()
  const [report, setReport] = useState(null)
  const [html, setHtml] = useState('')
  const [loadingHtml, setLoadingHtml] = useState(false)
  const timer = useRef(null)

  useEffect(() => {
    if (!reportId) return undefined
    let cancelled = false
    setHtml('')
    setReport(null)

    const poll = async () => {
      try {
        const data = await smartReportsApi.get(reportId)
        if (cancelled) return
        setReport(data)
        if (data.status === 'ready') {
          setLoadingHtml(true)
          try {
            const body = await smartReportsApi.fetchHtml(reportId)
            if (!cancelled) setHtml(body)
          } catch {
            // Don't re-poll on a fetch failure once the report is ready.
          } finally {
            if (!cancelled) setLoadingHtml(false)
          }
          return  // stop polling — report is ready
        }
        if (data.status === 'failed') return
        timer.current = setTimeout(poll, POLL_MS)
      } catch {
        if (!cancelled) timer.current = setTimeout(poll, POLL_MS)
      }
    }
    poll()

    return () => {
      cancelled = true
      if (timer.current) clearTimeout(timer.current)
    }
  }, [reportId])

  if (!reportId) return null

  const status = report?.status
  const isWorking = status === 'pending' || status === 'processing' || !status

  return (
    <div className="card p-0 overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-200 dark:border-slate-700">
        <div className="min-w-0">
          <div className="font-semibold text-slate-800 dark:text-slate-100 truncate">
            {report?.title || t('smart_reports.generating')}
          </div>
          {report?.subtitle && (
            <div className="text-xs text-slate-500 dark:text-slate-400 truncate">{report.subtitle}</div>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {status === 'ready' && (
            <>
              <button
                type="button"
                className="btn-ghost text-sm flex items-center gap-1"
                onClick={() => smartReportsApi.downloadHtml(reportId, `${report?.title || 'report'}.html`)}
              >
                <Download size={16} /> {t('smart_reports.download')}
              </button>
              <button
                type="button"
                className="btn-ghost text-sm flex items-center gap-1"
                onClick={() => onRerun?.(reportId)}
              >
                <RefreshCw size={16} /> {t('smart_reports.rerun')}
              </button>
            </>
          )}
        </div>
      </div>

      {isWorking && (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-slate-500">
          <Loader2 className="animate-spin" size={28} />
          <p className="text-sm">{t('smart_reports.generating_hint')}</p>
        </div>
      )}

      {status === 'failed' && (
        <div className="flex items-start gap-2 m-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
          <AlertCircle className="shrink-0 mt-0.5" size={18} />
          <span>{report?.error_message || t('smart_reports.failed')}</span>
        </div>
      )}

      {status === 'ready' && (
        loadingHtml ? (
          <div className="flex items-center justify-center py-16 text-slate-500">
            <Loader2 className="animate-spin" size={24} />
          </div>
        ) : (
          <iframe
            title={report?.title || 'Smart Report'}
            srcDoc={html}
            className="w-full"
            style={{ height: '75vh', border: 'none' }}
          />
        )
      )}
    </div>
  )
}
