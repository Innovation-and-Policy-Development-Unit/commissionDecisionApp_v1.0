import { useEffect, useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import PageHeader from '../../components/shared/PageHeader'
import { Plus, X, ClipboardList, RefreshCw, AlertCircle, Search } from 'lucide-react'
import clsx from 'clsx'
import api from '../../api/client'
import { useToast } from '../../context/ToastContext'
import { useConfirm } from '../../context/ConfirmContext'

const LOCALE_MAP = { en: 'en-GB', fr: 'fr-FR', bi: 'en-GB' }

// ── Components ──────────────────────────────────────────────────────────────

function Modal({ title, subtitle, onClose, children, closeLabel }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:p-8" role="dialog" aria-modal="true" aria-label={title}>
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div className="relative z-10 w-full max-w-lg bg-white dark:bg-slate-800 rounded-xl shadow-2xl my-auto animate-scale-in">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
            {subtitle && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p>}
          </div>
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

// ── Main ──────────────────────────────────────────────────────────────────────

export default function Agenda() {
  const { t, i18n } = useTranslation()
  const locale = LOCALE_MAP[i18n.resolvedLanguage] || LOCALE_MAP[i18n.language] || 'en-GB'
  const toast   = useToast()
  const confirm = useConfirm()
  const [meetings, setMeetings] = useState([])
  const [items, setItems] = useState([])
  const [selectedMeetingId, setSelectedMeetingId] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  
  const [modalOpen, setModalOpen] = useState(false)
  const [eligibleSubmissions, setEligibleSubmissions] = useState([])
  const [loadingSubmissions, setLoadingSubmissions] = useState(false)
  const [form, setForm] = useState({ submission_id: '', sequence: 0 })
  const [saving, setSaving] = useState(false)

  const extractList = (d) => d.results ?? d

  const fetchData = async () => {
    setLoading(true)
    setError('')
    try {
      const mRes = await api.get('/meetings/')
      const data = extractList(mRes.data)
      setMeetings(data)
      if (data.length > 0 && !selectedMeetingId) {
        setSelectedMeetingId(data[0].id)
      }
    } catch (err) {
      setError(t('secretariat.failed_load_data'))
    } finally {
      setLoading(false)
    }
  }

  const fetchItems = async () => {
    if (!selectedMeetingId) return
    try {
      const res = await api.get(`/agenda-items/?meeting=${selectedMeetingId}`)
      setItems(extractList(res.data))
    } catch (err) {
      console.error(err)
    }
  }

  const fetchEligible = async () => {
    setLoadingSubmissions(true)
    try {
      // Fetch submissions in FORWARDED_TO_COMMISSION stage
      const res = await api.get('/submissions/')
      // Filtering in frontend for simplicity since we don't have a specific endpoint yet
      setEligibleSubmissions(extractList(res.data).filter(s => s.current_stage === 'forwarded_to_commission'))
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingSubmissions(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  useEffect(() => {
    fetchItems()
  }, [selectedMeetingId])

  const selectedMeeting = meetings.find(m => m.id === Number(selectedMeetingId))

  const handleAdd = async e => {
    e.preventDefault()
    setSaving(true)
    try {
      await api.post('/agenda-items/', {
        meeting: selectedMeetingId,
        submission: form.submission_id,
        sequence: form.sequence || (items.length + 1),
      })
      await fetchItems()
      setModalOpen(false)
      setForm({ submission_id: '', sequence: 0 })
      toast.success(t('secretariat.agenda_added'))
    } catch (err) {
      toast.error(err.response?.data?.detail || t('secretariat.agenda_add_failed'))
    } finally {
      setSaving(false)
    }
  }

  const handleRemove = async id => {
    const ok = await confirm({
      title: t('secretariat.remove_agenda_title'),
      message: t('secretariat.remove_agenda_message'),
      confirmLabel: t('secretariat.remove'),
    })
    if (!ok) return
    try {
      await api.delete(`/agenda-items/${id}/`)
      await fetchItems()
      toast.success(t('secretariat.agenda_removed'))
    } catch (err) {
      toast.error(t('secretariat.agenda_remove_failed'))
    }
  }

  return (
    <div>
      <PageHeader
        title={t('secretariat.agenda_title')}
        subtitle={t('secretariat.agenda_subtitle')}
        action={
          selectedMeeting?.status !== 'completed' && (
            <button type="button" onClick={() => { fetchEligible(); setModalOpen(true) }} className="btn-primary flex items-center gap-2">
              <Plus size={16} aria-hidden="true" /> {t('secretariat.add_agenda_item')}
            </button>
          )
        }
      />

      {/* Meeting selector */}
      <div className="card p-4 mb-4 flex flex-col sm:flex-row gap-3 sm:items-center">
        <div className="flex flex-col gap-1">
          <label htmlFor="agenda-meeting" className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{t('secretariat.select_sitting')}</label>
          <select
            id="agenda-meeting"
            className="input sm:w-80"
            value={selectedMeetingId}
            onChange={e => setSelectedMeetingId(e.target.value)}
          >
            {meetings.map(m => (
              <option key={m.id} value={m.id}>
                {m.reference_number} — {m.title} ({new Date(m.date + 'T00:00').toLocaleDateString(locale, { day: '2-digit', month: 'short' })})
              </option>
            ))}
            {!meetings.length && <option value="">{t('secretariat.no_meetings_scheduled')}</option>}
          </select>
        </div>
        <div className="flex-1" />
        <button
          type="button"
          onClick={fetchItems}
          aria-label={t('submission.reload')}
          className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-primary-500 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
        >
          <RefreshCw size={15} aria-hidden="true" className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {error && (
        <div role="alert" className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 mb-4">
          <AlertCircle size={16} aria-hidden="true" />
          {error}
        </div>
      )}

      {/* Table */}
      <div className="card overflow-hidden">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <ClipboardList size={40} aria-hidden="true" className="mb-3 opacity-40" />
            <p className="text-sm">{t('secretariat.no_agenda_items')}</p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th className="w-12 text-center">{t('secretariat.seq')}</th>
                  <th>{t('secretariat.submission_col')}</th>
                  <th>{t('secretariat.title_subject')}</th>
                  <th className="sr-only">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {items.map(item => (
                  <tr key={item.id}>
                    <td className="text-center text-slate-400 font-medium">{item.sequence}</td>
                    <td className="font-mono text-xs">
                      <Link
                        to={`/submissions`}
                        className="text-primary-600 dark:text-primary-400 hover:underline"
                      >
                        {item.submission_reference}
                      </Link>
                    </td>
                    <td>
                      <p className="text-slate-800 dark:text-slate-200 leading-snug">{item.submission_title}</p>
                    </td>
                    <td>
                      {selectedMeeting?.status !== 'completed' && (
                        <div className="flex justify-end">
                          <button
                            type="button"
                            onClick={() => handleRemove(item.id)}
                            aria-label={t('secretariat.remove')}
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                          >
                            <X size={13} aria-hidden="true" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Agenda Item modal */}
      {modalOpen && (
        <Modal
          title={t('secretariat.add_agenda_modal_title')}
          subtitle={t('secretariat.add_agenda_modal_subtitle', { ref: selectedMeeting?.reference_number || '' })}
          closeLabel={t('common.close')}
          onClose={() => setModalOpen(false)}
        >
          <form onSubmit={handleAdd} className="space-y-4">
            <div>
              <label htmlFor="agenda-sub-select" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('secretariat.select_submission')}</label>
              <select
                id="agenda-sub-select"
                className="input"
                required
                value={form.submission_id}
                onChange={e => setForm(f => ({ ...f, submission_id: e.target.value }))}
                disabled={loadingSubmissions}
              >
                <option value="">{t('secretariat.select_submission_placeholder')}</option>
                {eligibleSubmissions.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.reference_number} — {s.title}
                  </option>
                ))}
                {!loadingSubmissions && eligibleSubmissions.length === 0 && (
                  <option disabled>{t('secretariat.no_submissions_ready')}</option>
                )}
              </select>
              <p className="text-xs text-slate-400 mt-1">{t('secretariat.submissions_filter_hint')}</p>
            </div>
            <div>
              <label htmlFor="agenda-seq" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('secretariat.sequence_optional')}</label>
              <input
                id="agenda-seq"
                type="number"
                className="input"
                placeholder={t('secretariat.sequence_placeholder')}
                value={form.sequence || ''}
                onChange={e => setForm(f => ({ ...f, sequence: e.target.value }))}
              />
            </div>
            <div className="flex items-center gap-3 pt-2">
              <button type="submit" disabled={saving || !form.submission_id} className="btn-primary px-6 py-2.5 disabled:opacity-50">
                {saving ? t('secretariat.adding') : t('secretariat.add_to_agenda')}
              </button>
              <button type="button" className="btn-secondary px-6 py-2.5" onClick={() => setModalOpen(false)}>{t('common.cancel')}</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
