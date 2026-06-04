import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Eye, Download, RefreshCw, Loader2 } from 'lucide-react'
import Badge from '../shared/Badge'
import { smartReportsApi } from '../../api/smartReports'

const STATUS_VARIANT = {
  ready: 'success',
  failed: 'danger',
  processing: 'warning',
  pending: 'secondary',
}

export default function SmartReportLibrary({ refreshKey, onView, onRerun }) {
  const { t } = useTranslation()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setRows(await smartReportsApi.list(true))
    } catch {
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load, refreshKey])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-slate-500">
        <Loader2 className="animate-spin" size={24} />
      </div>
    )
  }

  if (!rows.length) {
    return (
      <div className="card p-10 text-center text-slate-500 dark:text-slate-400">
        {t('smart_reports.library_empty')}
      </div>
    )
  }

  return (
    <div className="card overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-slate-500 border-b border-slate-200 dark:border-slate-700">
            <th className="px-4 py-2.5">{t('smart_reports.col_title')}</th>
            <th className="px-4 py-2.5">{t('smart_reports.col_type')}</th>
            <th className="px-4 py-2.5">{t('smart_reports.col_status')}</th>
            <th className="px-4 py-2.5">{t('smart_reports.col_rows')}</th>
            <th className="px-4 py-2.5">{t('smart_reports.col_created')}</th>
            <th className="px-4 py-2.5 text-right">{t('smart_reports.col_actions')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-slate-100 dark:border-slate-800 last:border-0">
              <td className="px-4 py-2.5 font-medium text-slate-800 dark:text-slate-100">
                {r.title || t('smart_reports.untitled')}
              </td>
              <td className="px-4 py-2.5 text-slate-500">
                {r.report_type === 'adhoc' ? t('smart_reports.adhoc') : r.report_type}
              </td>
              <td className="px-4 py-2.5">
                <Badge variant={STATUS_VARIANT[r.status] || 'secondary'}>{r.status}</Badge>
              </td>
              <td className="px-4 py-2.5 text-slate-500">{r.row_count}</td>
              <td className="px-4 py-2.5 text-slate-500">
                {r.created_at ? new Date(r.created_at).toLocaleString() : ''}
              </td>
              <td className="px-4 py-2.5">
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    className="btn-ghost text-xs flex items-center gap-1"
                    onClick={() => onView?.(r.id)}
                  >
                    <Eye size={15} /> {t('smart_reports.view')}
                  </button>
                  {r.status === 'ready' && (
                    <button
                      type="button"
                      className="btn-ghost text-xs flex items-center gap-1"
                      onClick={() => smartReportsApi.downloadHtml(r.id, `${r.title || 'report'}.html`)}
                    >
                      <Download size={15} />
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn-ghost text-xs flex items-center gap-1"
                    onClick={() => onRerun?.(r.id)}
                  >
                    <RefreshCw size={15} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
