import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import PageHeader from '../../components/shared/PageHeader'
import {
  FileText,
  RefreshCw,
  PenSquare,
  ExternalLink,
  CheckCircle2,
  Clock,
  AlertCircle,
} from 'lucide-react'
import clsx from 'clsx'
import api from '../../api/client'

const STATUS_META = {
  draft: {
    i18nKey: 'secretariat.minutes_status_draft',
    cls: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
    icon: Clock,
  },
  reviewed: {
    i18nKey: 'secretariat.minutes_status_reviewed',
    cls: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    icon: AlertCircle,
  },
  signed: {
    i18nKey: 'secretariat.minutes_status_signed',
    cls: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
    icon: CheckCircle2,
  },
}

const LOCALE_MAP = { en: 'en-GB', fr: 'fr-FR', bi: 'en-GB' }

function StatusBadge({ status }) {
  const { t } = useTranslation()
  const meta = STATUS_META[status] || STATUS_META.draft
  const Icon = meta.icon
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${meta.cls}`}>
      <Icon size={12} aria-hidden="true" />
      {t(meta.i18nKey)}
    </span>
  )
}

function SummaryBar({ minutes }) {
  const { t } = useTranslation()
  const stats = [
    { key: 'all', label: t('secretariat.minutes_stat_total'), value: minutes.length },
    { key: 'draft', label: t('secretariat.minutes_status_draft'), value: minutes.filter(m => m.status === 'draft').length },
    { key: 'reviewed', label: t('secretariat.minutes_status_reviewed'), value: minutes.filter(m => m.status === 'reviewed').length },
    { key: 'signed', label: t('secretariat.minutes_status_signed'), value: minutes.filter(m => m.status === 'signed').length },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
      {stats.map(({ key, label, value }) => (
        <div key={key} className="card px-3 py-2.5">
          <p className="text-xl font-bold text-slate-800 dark:text-slate-100 leading-none">{value}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{label}</p>
        </div>
      ))}
    </div>
  )
}

export default function MinutesIndex() {
  const { t, i18n } = useTranslation()
  const locale = LOCALE_MAP[i18n.resolvedLanguage] || LOCALE_MAP[i18n.language] || 'en-GB'
  const [minutes, setMinutes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [q, setQ] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const fetchMinutes = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const { data } = await api.get('/minutes/')
      setMinutes(Array.isArray(data) ? data : data.results || [])
    } catch (err) {
      setError(err.response?.data?.detail || t('secretariat.minutes_load_failed'))
      setMinutes([])
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    fetchMinutes()
  }, [fetchMinutes])

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    return minutes
      .filter(m => (statusFilter ? m.status === statusFilter : true))
      .filter(m => {
        if (!s) return true
        return (
          (m.meeting_reference || '').toLowerCase().includes(s)
          || (m.meeting_title || '').toLowerCase().includes(s)
        )
      })
      .sort((a, b) => {
        const da = a.meeting_date || ''
        const db = b.meeting_date || ''
        return db.localeCompare(da)
      })
  }, [minutes, q, statusFilter])

  return (
    <div>
      <PageHeader
        title={t('secretariat.minutes_title')}
        subtitle={t('secretariat.minutes_subtitle')}
        actions={(
          <div className="flex flex-wrap gap-2">
            <Link to="/secretariat/meeting-room/minutes-pipeline" className="btn-secondary flex items-center gap-2 text-sm">
              <ExternalLink size={16} aria-hidden="true" />
              {t('secretariat.minutes_pipeline_link')}
            </Link>
            <Link to="/secretariat/meetings" className="btn-primary flex items-center gap-2 text-sm">
              <FileText size={16} aria-hidden="true" />
              {t('secretariat.minutes_open_sittings')}
            </Link>
          </div>
        )}
      />

      <SummaryBar minutes={minutes} />

      <div className="card overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex flex-col sm:flex-row gap-3">
          <input
            type="search"
            className="input flex-1 text-sm"
            placeholder={t('secretariat.minutes_search_placeholder')}
            value={q}
            onChange={e => setQ(e.target.value)}
            aria-label={t('secretariat.minutes_search_placeholder')}
          />
          <select
            className="input sm:w-44 text-sm"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            aria-label={t('secretariat.minutes_filter_status')}
          >
            <option value="">{t('secretariat.minutes_filter_all_statuses')}</option>
            <option value="draft">{t('secretariat.minutes_status_draft')}</option>
            <option value="reviewed">{t('secretariat.minutes_status_reviewed')}</option>
            <option value="signed">{t('secretariat.minutes_status_signed')}</option>
          </select>
          <button
            type="button"
            onClick={fetchMinutes}
            className="btn-outline flex items-center justify-center gap-2 text-sm px-4"
            aria-label={t('common.refresh')}
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} aria-hidden="true" />
            {t('common.refresh')}
          </button>
        </div>

        {error && (
          <p className="px-4 py-3 text-sm text-red-600 dark:text-red-400" role="alert">
            {error}
          </p>
        )}

        <div className="overflow-x-auto">
          <table className="table w-full">
            <thead>
              <tr>
                <th>{t('secretariat.minutes_col_sitting')}</th>
                <th>{t('secretariat.minutes_col_title')}</th>
                <th>{t('common.date')}</th>
                <th>{t('common.status')}</th>
                <th>{t('secretariat.minutes_col_updated')}</th>
                <th className="text-end">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-400">
                    <RefreshCw size={20} className="animate-spin mx-auto mb-2" aria-hidden="true" />
                    {t('secretariat.minutes_loading')}
                  </td>
                </tr>
              )}
              {!loading && filtered.map(row => (
                <tr key={row.id}>
                  <td className="font-mono text-xs font-semibold text-primary-600 dark:text-primary-400 whitespace-nowrap">
                    {row.meeting_reference}
                  </td>
                  <td className="max-w-xs">
                    <p className="font-medium text-slate-800 dark:text-slate-200 truncate">
                      {row.meeting_title}
                    </p>
                  </td>
                  <td className="text-sm text-slate-600 dark:text-slate-300 whitespace-nowrap">
                    {row.meeting_date
                      ? new Date(`${row.meeting_date}T00:00`).toLocaleDateString(locale, {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })
                      : '—'}
                  </td>
                  <td>
                    <StatusBadge status={row.status} />
                  </td>
                  <td className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                    {row.updated_at
                      ? new Date(row.updated_at).toLocaleString(locale, {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                      : '—'}
                  </td>
                  <td className="text-end">
                    <Link
                      to={`/secretariat/meetings/${row.meeting}/minutes`}
                      className={clsx(
                        'inline-flex items-center gap-1.5 text-sm font-medium',
                        'text-primary-600 dark:text-primary-400 hover:underline',
                      )}
                    >
                      <PenSquare size={14} aria-hidden="true" />
                      {row.status === 'signed'
                        ? t('secretariat.minutes_action_view')
                        : t('secretariat.minutes_action_edit')}
                    </Link>
                  </td>
                </tr>
              ))}
              {!loading && !filtered.length && !error && (
                <tr>
                  <td colSpan={6} className="py-12 text-center">
                    <FileText size={32} className="mx-auto text-slate-300 dark:text-slate-600 mb-3" aria-hidden="true" />
                    <p className="text-slate-500 dark:text-slate-400 text-sm mb-3">
                      {q || statusFilter
                        ? t('secretariat.minutes_no_matches')
                        : t('secretariat.minutes_empty')}
                    </p>
                    {!q && !statusFilter && (
                      <Link to="/secretariat/meetings" className="btn-primary text-sm inline-flex items-center gap-2">
                        {t('secretariat.minutes_start_from_sitting')}
                      </Link>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
