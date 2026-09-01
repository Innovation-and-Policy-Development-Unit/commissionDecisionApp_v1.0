import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { History, Loader2 } from 'lucide-react'
import api from '../../api/client'

function fmtDate(d) {
  if (!d) return ''
  return new Date(`${d}T00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

/**
 * Read-only "History" pane for the Sitting Pack: every prior meeting this
 * submission has appeared on (deferred/carried-over items recur), with why
 * it was deferred and what was decided, if minuted — so a Commissioner
 * seeing a recurring item again has context beyond just this sitting's
 * papers.
 */
export default function MeetingHistoryPanel({ submissionId, itemLabel, excludeMeetingId }) {
  const { t } = useTranslation()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!submissionId) { setItems([]); return undefined }
    let cancelled = false
    setLoading(true)
    api.get(`/submissions/${submissionId}/meeting-history/`, {
      params: excludeMeetingId ? { exclude_meeting: excludeMeetingId } : {},
    })
      .then(r => { if (!cancelled) setItems(r.data?.items || []) })
      .catch(() => { if (!cancelled) setItems([]) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [submissionId, excludeMeetingId])

  if (!submissionId) {
    return (
      <div className="card h-full flex items-center justify-center">
        <p className="text-center text-slate-500 px-6">{t('sitting_pack.select_item')}</p>
      </div>
    )
  }

  return (
    <div className="card h-full flex flex-col overflow-hidden">
      <div className="p-4 border-b border-slate-100 dark:border-slate-700">
        <div className="flex items-center gap-2">
          <History size={16} className="text-primary-500" />
          <span className="font-semibold text-slate-800 dark:text-slate-100">{t('sitting_pack.history_tab')}</span>
          {items.length > 0 && <span className="text-xs text-slate-400">{items.length}</span>}
        </div>
        {itemLabel && <span className="block mt-1 truncate text-xs text-slate-500" title={itemLabel}>{itemLabel}</span>}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-4">
        {loading ? (
          <div className="h-full flex items-center justify-center">
            <Loader2 size={22} className="animate-spin text-slate-400" />
          </div>
        ) : items.length === 0 ? (
          <p className="text-center text-slate-500 px-6 py-8">{t('sitting_pack.history_empty')}</p>
        ) : (
          <div className="space-y-3">
            {items.map(row => (
              <div key={row.meeting_id} className="rounded-lg border border-slate-200 dark:border-slate-700 p-3">
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                  {row.meeting_reference}
                </p>
                <p className="text-xs text-slate-400 mb-2">{fmtDate(row.meeting_date)}</p>
                {row.deferral_type_display && (
                  <p className="text-xs text-amber-700 dark:text-amber-400 mb-1">
                    {t('sitting_pack.history_deferred_from')}: {row.deferral_type_display}
                    {row.deferral_reason && ` — ${row.deferral_reason}`}
                  </p>
                )}
                {row.decision_text && (
                  <div className="mt-1">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-0.5">
                      {t('sitting_pack.history_decision')}
                    </p>
                    <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                      {row.decision_text}
                    </p>
                  </div>
                )}
                {!row.deferral_type_display && !row.decision_text && (
                  <p className="text-xs text-slate-400 italic">
                    {t('sitting_pack.history_no_detail')}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
