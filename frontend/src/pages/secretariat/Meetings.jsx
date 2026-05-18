import { useEffect, useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import PageHeader from '../../components/shared/PageHeader'
import { CalendarDays, Clock, MapPin, X, Plus, CheckCircle2, XCircle, Calendar, ListChecks, RefreshCw, AlertCircle } from 'lucide-react'
import clsx from 'clsx'
import api from '../../api/client'
import { useToast } from '../../context/ToastContext'

// ── Static reference data ─────────────────────────────────────────────────────

const MEETING_TYPE_KEYS = [
  { value: 'ordinary', i18nKey: 'secretariat.type_ordinary_full' },
  { value: 'special',  i18nKey: 'secretariat.type_special_full'  },
]

const VENUES = [
  'PSC Boardroom, Kumul Highway, Port Vila',
  'PSC Boardroom, Luganville, Santo',
  'Government House Conference Room, Port Vila',
  'Other',
]

const STATUS_META = {
  scheduled:   { i18nKey: 'meeting.status_scheduled',   cls: 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300' },
  in_progress: { i18nKey: 'meeting.status_in_progress', cls: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300' },
  completed:   { i18nKey: 'meeting.status_completed',   cls: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300' },
  cancelled:   { i18nKey: 'meeting.status_cancelled',   cls: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' },
}

const LOCALE_MAP = { en: 'en-GB', fr: 'fr-FR', bi: 'en-GB' }

// ── Helpers ───────────────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  const { t } = useTranslation()
  const m = STATUS_META[status]
  const label = m ? t(m.i18nKey) : status
  const cls = m ? m.cls : 'bg-slate-100 text-slate-600'
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>{label}</span>
}

function emptyForm() {
  const today = new Date().toISOString().split('T')[0]
  return { title: '', date: today, time: '09:00', venue: VENUES[0], type: 'ordinary', notes: '' }
}

function Modal({ title, onClose, children, closeLabel }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:p-8" role="dialog" aria-modal="true" aria-label={title}>
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div className="relative z-10 w-full max-w-lg bg-white dark:bg-slate-800 rounded-xl shadow-2xl my-auto animate-scale-in">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={closeLabel}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <div className="px-6 py-6">{children}</div>
      </div>
    </div>
  )
}

// ── Stats strip ───────────────────────────────────────────────────────────────

function StatsStrip({ meetings }) {
  const { t } = useTranslation()
  const total     = meetings.length
  const scheduled = meetings.filter(m => m.status === 'scheduled').length
  const completed = meetings.filter(m => m.status === 'completed').length
  const totalAgenda    = meetings.reduce((s, m) => s + (m.agenda_count || 0), 0)
  const totalDecisions = meetings.reduce((s, m) => s + (m.decisions_count || 0), 0)

  const stats = [
    { label: t('secretariat.total_sittings'),          value: total,          icon: Calendar       },
    { label: t('secretariat.stat_scheduled'),          value: scheduled,      icon: CalendarDays   },
    { label: t('secretariat.stat_completed'),          value: completed,      icon: CheckCircle2   },
    { label: t('secretariat.stat_agenda_items'),       value: totalAgenda,    icon: ListChecks     },
    { label: t('secretariat.stat_decisions_recorded'), value: totalDecisions, icon: CheckCircle2   },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-4">
      {stats.map(({ label, value, icon: Icon }) => (
        <div key={label} className="card px-4 py-3 flex items-center gap-3">
          <Icon size={18} className="text-primary-500 shrink-0" aria-hidden="true" />
          <div>
            <p className="text-xl font-bold text-slate-800 dark:text-slate-100 leading-none">{value}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{label}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function Meetings() {
  const { t, i18n } = useTranslation()
  const locale = LOCALE_MAP[i18n.resolvedLanguage] || LOCALE_MAP[i18n.language] || 'en-GB'
  const toast = useToast()
  const [meetings, setMeetings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [q, setQ] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState(emptyForm())
  const [saving, setSaving] = useState(false)

  const fetchMeetings = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await api.get('/meetings/')
      const data = Array.isArray(res.data) ? res.data : (res.data?.results || [])
      setMeetings(data)
    } catch (err) {
      setError(t('secretariat.failed_load_meetings'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchMeetings()
  }, [])

  const set = key => e => setForm(f => ({ ...f, [key]: e.target.value }))

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    return meetings.filter(m => {
      if (statusFilter && m.status !== statusFilter) return false
      if (typeFilter && m.type !== typeFilter) return false
      if (s && !m.reference_number.toLowerCase().includes(s) && !m.title.toLowerCase().includes(s) && !m.venue.toLowerCase().includes(s)) return false
      return true
    })
  }, [meetings, q, statusFilter, typeFilter])

  const handleCreate = async e => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      await api.post('/meetings/', form)
      await fetchMeetings()
      setModalOpen(false)
      setForm(emptyForm())
    } catch (err) {
      setError(err.response?.data?.detail || t('secretariat.failed_schedule'))
    } finally {
      setSaving(false)
    }
  }

  const handleUpdateStatus = async (id, newStatus) => {
    try {
      await api.patch(`/meetings/${id}/`, { status: newStatus })
      await fetchMeetings()
    } catch (err) {
      toast.error(t('secretariat.failed_update_status'))
    }
  }

  return (
    <div>
      <PageHeader
        title={t('secretariat.meetings_title')}
        subtitle={t('secretariat.meetings_subtitle')}
        action={
          <button type="button" onClick={() => { setForm(emptyForm()); setModalOpen(true) }} className="btn-primary flex items-center gap-2">
            <Plus size={16} aria-hidden="true" /> {t('secretariat.schedule_sitting')}
          </button>
        }
      />

      <StatsStrip meetings={meetings} />

      {/* Filters */}
      <div className="card p-4 mb-4 flex flex-col sm:flex-row gap-3 sm:items-center">
        <div className="relative flex-1">
          <label htmlFor="meetings-search" className="sr-only">{t('common.search')}</label>
          <input
            id="meetings-search"
            type="search"
            placeholder={t('secretariat.search_meetings_placeholder')}
            className="input pl-4 pr-10"
            value={q}
            onChange={e => setQ(e.target.value)}
          />
          <button
            type="button"
            onClick={fetchMeetings}
            aria-label={t('submission.reload')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-primary-500 focus:outline-none focus-visible:text-primary-500"
          >
            <RefreshCw size={14} aria-hidden="true" className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
        <label htmlFor="meetings-status" className="sr-only">{t('common.status')}</label>
        <select id="meetings-status" className="input sm:w-44" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">{t('secretariat.all_statuses')}</option>
          {Object.entries(STATUS_META).map(([v, m]) => (
            <option key={v} value={v}>{t(m.i18nKey)}</option>
          ))}
        </select>
        <label htmlFor="meetings-type" className="sr-only">{t('common.type')}</label>
        <select id="meetings-type" className="input sm:w-44" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
          <option value="">{t('secretariat.all_types')}</option>
          {MEETING_TYPE_KEYS.map(opt => <option key={opt.value} value={opt.value}>{t(opt.i18nKey)}</option>)}
        </select>
      </div>

      {error && (
        <div role="alert" className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 mb-4">
          <AlertCircle size={16} aria-hidden="true" />
          {error}
        </div>
      )}

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>{t('submission.reference_short')}</th>
                <th>{t('submission.title')}</th>
                <th>{t('secretariat.date_time')}</th>
                <th>{t('secretariat.venue')}</th>
                <th>{t('common.type')}</th>
                <th>{t('common.status')}</th>
                <th className="text-center">{t('secretariat.agenda_count_col')}</th>
                <th className="text-center">{t('secretariat.decisions_count_col')}</th>
                <th className="sr-only">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {loading && !meetings.length ? (
                <tr>
                  <td colSpan={9} className="py-10 text-center text-slate-400">
                    <RefreshCw size={20} aria-hidden="true" className="animate-spin mx-auto mb-2" />
                    {t('secretariat.loading_meetings')}
                  </td>
                </tr>
              ) : filtered.map(m => (
                <tr key={m.id}>
                  <td className="font-mono text-xs font-semibold text-primary-600 dark:text-primary-400">{m.reference_number}</td>
                  <td className="max-w-xs">
                    <p className="font-medium text-slate-800 dark:text-slate-200 truncate">{m.title}</p>
                  </td>
                  <td className="whitespace-nowrap text-slate-600 dark:text-slate-300">
                    <div className="flex items-center gap-1.5 text-xs">
                      <CalendarDays size={13} className="text-slate-400" aria-hidden="true" />
                      {new Date(m.date + 'T00:00').toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' })}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-0.5">
                      <Clock size={13} aria-hidden="true" />
                      {m.time?.slice(0, 5)}
                    </div>
                  </td>
                  <td className="text-xs text-slate-500 dark:text-slate-400 max-w-[180px]">
                    <div className="flex items-start gap-1.5">
                      <MapPin size={12} aria-hidden="true" className="mt-0.5 shrink-0 text-slate-400" />
                      <span className="truncate">{m.venue}</span>
                    </div>
                  </td>
                  <td className="text-xs text-slate-500 dark:text-slate-400">
                    {m.type === 'special' ? (
                      <span className="inline-flex rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">{t('secretariat.type_special')}</span>
                    ) : (
                      <span className="text-slate-500">{t('secretariat.type_ordinary')}</span>
                    )}
                  </td>
                  <td><StatusBadge status={m.status} /></td>
                  <td className="text-center">
                    <span className={clsx('font-semibold', m.agenda_count > 0 ? 'text-slate-700 dark:text-slate-200' : 'text-slate-400')}>
                      {m.agenda_count}
                    </span>
                  </td>
                  <td className="text-center">
                    <span className={clsx('font-semibold', m.decisions_count > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400')}>
                      {m.decisions_count}
                    </span>
                  </td>
                  <td>
                    <div className="flex items-center gap-0.5 justify-end">
                      {m.status === 'scheduled' && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleUpdateStatus(m.id, 'completed')}
                            aria-label={t('secretariat.mark_completed')}
                            title={t('secretariat.mark_completed')}
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors"
                          >
                            <CheckCircle2 size={13} aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleUpdateStatus(m.id, 'cancelled')}
                            aria-label={t('secretariat.cancel_sitting')}
                            title={t('secretariat.cancel_sitting')}
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                          >
                            <XCircle size={13} aria-hidden="true" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && !filtered.length && (
                <tr>
                  <td colSpan={9} className="py-10 text-center text-slate-400">
                    {t('secretariat.no_sittings')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Schedule Sitting modal */}
      {modalOpen && (
        <Modal
          title={t('secretariat.schedule_modal_title')}
          closeLabel={t('common.close')}
          onClose={() => setModalOpen(false)}
        >
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label htmlFor="m-title" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('secretariat.sitting_title')}</label>
              <input id="m-title" className="input" required placeholder={t('secretariat.sitting_title_placeholder')} value={form.title} onChange={set('title')} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="m-date" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('common.date')}</label>
                <input id="m-date" type="date" className="input" required value={form.date} onChange={set('date')} />
              </div>
              <div>
                <label htmlFor="m-time" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('common.time')}</label>
                <input id="m-time" type="time" className="input" required value={form.time} onChange={set('time')} />
              </div>
            </div>
            <div>
              <label htmlFor="m-venue" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('secretariat.venue')}</label>
              <select id="m-venue" className="input" value={form.venue} onChange={set('venue')}>
                {VENUES.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="m-type" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('common.type')}</label>
              <select id="m-type" className="input" value={form.type} onChange={set('type')}>
                {MEETING_TYPE_KEYS.map(opt => <option key={opt.value} value={opt.value}>{t(opt.i18nKey)}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="m-notes" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('secretariat.notes_optional')}</label>
              <textarea id="m-notes" className="input min-h-[80px]" value={form.notes} onChange={set('notes')} placeholder={t('secretariat.notes_placeholder')} />
            </div>
            <div className="flex items-center gap-3 pt-2">
              <button type="submit" disabled={saving} className="btn-primary px-6 py-2.5 disabled:opacity-50">
                {saving ? t('secretariat.scheduling') : t('secretariat.schedule')}
              </button>
              <button type="button" className="btn-secondary px-6 py-2.5" onClick={() => setModalOpen(false)}>{t('common.cancel')}</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
