import { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  ArrowLeft, Save, Sparkles, Loader2, AlertCircle, CheckCircle2,
  ChevronDown, ChevronRight, FileText,
} from 'lucide-react'
import clsx from 'clsx'
import PageHeader from '../../components/shared/PageHeader'
import api from '../../api/client'
import { formatApiError } from '../../utils/apiError'

const INTAKE_AGENDA_STATUSES = new Set(['chairman_approved', 'circulated'])

function IntakeItemCard({
  item,
  expanded,
  onToggle,
  onChange,
  onFormat,
  formatting,
}) {
  const { t } = useTranslation()

  return (
    <div className="border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-left"
      >
        <div className="flex items-center gap-2 min-w-0">
          {expanded
            ? <ChevronDown size={14} className="text-slate-400 shrink-0" />
            : <ChevronRight size={14} className="text-slate-400 shrink-0" />}
          <span className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate">
            {item.submission_ref || `#${item.sequence}`}
          </span>
          <span className="text-xs text-slate-500 truncate hidden sm:inline">
            — {item.agenda_title}
          </span>
        </div>
        {item.has_formatted && (
          <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300 shrink-0 ml-2">
            {t('minute_intake.formatted_badge')}
          </span>
        )}
      </button>
      {expanded && (
        <div className="p-4 space-y-4 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/20">
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
              {t('minute_intake.agenda_title')}
            </label>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{item.agenda_title}</p>
          </div>
          {item.agenda_description && (
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                {t('minute_intake.agenda_description')}
              </label>
              <p className="text-sm text-slate-600 dark:text-slate-400 whitespace-pre-wrap">
                {item.agenda_description}
              </p>
            </div>
          )}
          <div>
            <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">
              {t('minute_intake.discussion_notes')}
            </label>
            <textarea
              className="input min-h-[80px] resize-y text-sm bg-white"
              value={item.discussion_notes || ''}
              onChange={e => onChange(item.agenda_item_id, 'discussion_notes', e.target.value)}
              placeholder={t('minute_intake.discussion_placeholder')}
            />
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">
              {t('minute_intake.decision_text')}
            </label>
            <textarea
              className="input min-h-[60px] resize-y text-sm bg-white"
              value={item.decision_text || ''}
              onChange={e => onChange(item.agenda_item_id, 'decision_text', e.target.value)}
              placeholder={t('minute_intake.decision_placeholder')}
            />
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">
              {t('minute_intake.action_officer')}
            </label>
            <input
              className="input text-sm bg-white"
              value={item.action_officer || ''}
              onChange={e => onChange(item.agenda_item_id, 'action_officer', e.target.value)}
              placeholder={t('minute_intake.action_officer_placeholder')}
            />
          </div>
          <button
            type="button"
            onClick={() => onFormat(item.agenda_item_id)}
            disabled={formatting}
            className="btn-secondary btn-sm flex items-center gap-2 disabled:opacity-50"
          >
            {formatting
              ? <Loader2 size={14} className="animate-spin" />
              : <Sparkles size={14} />}
            {t('minute_intake.format_item')}
          </button>
          {item.has_formatted && (
            <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700 p-4 space-y-3">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                {t('minute_intake.preview_title')}
              </p>
              {item.formatted_discussion && (
                <div>
                  <p className="text-[10px] font-bold text-slate-500 mb-1">{t('minute_intake.preview_discussion')}</p>
                  <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                    {item.formatted_discussion}
                  </p>
                </div>
              )}
              {item.formatted_decision && (
                <div>
                  <p className="text-[10px] font-bold text-slate-500 mb-1">{t('minute_intake.preview_decision')}</p>
                  <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                    {item.formatted_decision}
                  </p>
                </div>
              )}
              {(item.formatted_action_items || []).length > 0 && (
                <div>
                  <p className="text-[10px] font-bold text-slate-500 mb-1">{t('minute_intake.preview_actions')}</p>
                  <ul className="text-sm text-slate-700 dark:text-slate-300 space-y-1 list-disc list-inside">
                    {item.formatted_action_items.map((ai, idx) => (
                      <li key={idx}>
                        {ai.action}
                        {ai.responsible ? ` — ${ai.responsible}` : ''}
                        {ai.deadline ? ` (${ai.deadline})` : ''}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function MinuteIntake() {
  const { t } = useTranslation()
  const { meetingId: meetingIdParam } = useParams()
  const navigate = useNavigate()
  const meetingId = meetingIdParam ? String(meetingIdParam) : ''

  const [meetings, setMeetings] = useState([])
  const [pickerId, setPickerId] = useState(meetingId)
  const [payload, setPayload] = useState(null)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(!!meetingId)
  const [loadingMeetings, setLoadingMeetings] = useState(!meetingId)
  const [saving, setSaving] = useState(false)
  const [formattingId, setFormattingId] = useState(null)
  const [formattingAll, setFormattingAll] = useState(false)
  const [applying, setApplying] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [expanded, setExpanded] = useState({})

  const activeMeetingId = meetingId || pickerId

  const eligibleMeetings = useMemo(
    () => meetings.filter(m => INTAKE_AGENDA_STATUSES.has(m.agenda_status)),
    [meetings],
  )

  const loadMeetings = useCallback(async () => {
    setLoadingMeetings(true)
    try {
      const { data } = await api.get('/meetings/')
      const list = data.results ?? data
      setMeetings(list)
      if (!meetingId && list.length > 0) {
        const first = list.find(m => INTAKE_AGENDA_STATUSES.has(m.agenda_status))
        if (first) setPickerId(String(first.id))
      }
    } catch (err) {
      setError(formatApiError(err, t('minute_intake.load_meetings_failed')))
    } finally {
      setLoadingMeetings(false)
    }
  }, [meetingId, t])

  const loadIntake = useCallback(async (id) => {
    if (!id) return
    setLoading(true)
    setError('')
    try {
      const { data } = await api.get(`/meetings/${id}/minute-intake/`)
      setPayload(data)
      setItems(data.items || [])
      const exp = {}
      for (const it of data.items || []) {
        exp[it.agenda_item_id] = true
      }
      setExpanded(exp)
    } catch (err) {
      setError(formatApiError(err, t('minute_intake.load_failed')))
      setPayload(null)
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => { if (!meetingId) loadMeetings() }, [meetingId, loadMeetings])
  useEffect(() => {
    if (activeMeetingId) loadIntake(activeMeetingId)
  }, [activeMeetingId, loadIntake])

  const updateItem = (agendaItemId, field, value) => {
    setItems(prev => prev.map(it => (
      it.agenda_item_id === agendaItemId ? { ...it, [field]: value } : it
    )))
  }

  const patchDraft = useCallback(async () => {
    if (!activeMeetingId) return null
    const { data } = await api.patch(`/meetings/${activeMeetingId}/minute-intake/`, {
      items: items.map(it => ({
        agenda_item_id: it.agenda_item_id,
        discussion_notes: it.discussion_notes ?? '',
        decision_text: it.decision_text ?? '',
        action_officer: it.action_officer ?? '',
      })),
    })
    setPayload(data)
    setItems(data.items || [])
    return data
  }, [activeMeetingId, items])

  const saveDraft = async () => {
    if (!activeMeetingId) return
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      await patchDraft()
      setSuccess(t('minute_intake.save_success'))
    } catch (err) {
      setError(formatApiError(err, t('minute_intake.save_failed')))
    } finally {
      setSaving(false)
    }
  }

  const formatItem = async (agendaItemId) => {
    if (!activeMeetingId) return
    setFormattingId(agendaItemId)
    setError('')
    try {
      await patchDraft()
      const { data } = await api.post(
        `/meetings/${activeMeetingId}/minute-intake/${agendaItemId}/format/`,
      )
      setItems(prev => prev.map(it => (
        it.agenda_item_id === agendaItemId ? { ...it, ...data } : it
      )))
      setSuccess(t('minute_intake.format_success'))
    } catch (err) {
      setError(formatApiError(err, t('minute_intake.format_failed')))
    } finally {
      setFormattingId(null)
    }
  }

  const formatAll = async () => {
    if (!activeMeetingId) return
    setFormattingAll(true)
    setError('')
    try {
      await patchDraft()
      const { data } = await api.post(`/meetings/${activeMeetingId}/minute-intake/format-all/`)
      const byId = Object.fromEntries((data.items || []).map(it => [it.agenda_item_id, it]))
      setItems(prev => prev.map(it => ({ ...it, ...(byId[it.agenda_item_id] || {}) })))
      setSuccess(t('minute_intake.format_all_success', { count: data.formatted_count ?? 0 }))
      if (data.errors?.length) {
        setError(t('minute_intake.format_all_partial', { count: data.errors.length }))
      }
    } catch (err) {
      setError(formatApiError(err, t('minute_intake.format_all_failed')))
    } finally {
      setFormattingAll(false)
    }
  }

  const applyToMinutes = async () => {
    if (!activeMeetingId) return
    setApplying(true)
    setError('')
    try {
      await patchDraft()
      await api.post(`/meetings/${activeMeetingId}/minute-intake/apply-to-minutes/`)
      navigate(`/secretariat/meetings/${activeMeetingId}/minutes`)
    } catch (err) {
      setError(formatApiError(err, t('minute_intake.apply_failed')))
      setApplying(false)
    }
  }

  const openMeeting = (id) => {
    navigate(`/secretariat/minute-intake/${id}`)
  }

  const notAllowed = payload && payload.allowed === false

  if (!meetingId) {
    return (
      <div>
        <PageHeader
          title={t('minute_intake.title')}
          subtitle={t('minute_intake.subtitle_picker')}
        />
        {error && (
          <div className="mb-4 flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-300 text-sm">
            <AlertCircle size={14} />
            {error}
          </div>
        )}
        <div className="card p-6 max-w-xl">
          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
            {t('minute_intake.select_meeting')}
          </label>
          {loadingMeetings ? (
            <Loader2 size={20} className="animate-spin text-slate-400" />
          ) : eligibleMeetings.length === 0 ? (
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {t('minute_intake.no_eligible_meetings')}
            </p>
          ) : (
            <select
              className="input mb-4"
              value={pickerId}
              onChange={e => setPickerId(e.target.value)}
            >
              {eligibleMeetings.map(m => (
                <option key={m.id} value={m.id}>
                  {m.reference_number} — {m.title} ({m.date})
                </option>
              ))}
            </select>
          )}
          <button
            type="button"
            className="btn-primary"
            disabled={!pickerId || eligibleMeetings.length === 0}
            onClick={() => openMeeting(pickerId)}
          >
            {t('minute_intake.open_meeting')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-4 flex-wrap">
        <button
          type="button"
          onClick={() => navigate('/secretariat/minute-intake')}
          className="flex items-center gap-1.5 text-sm font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
        >
          <ArrowLeft size={16} />
          {t('minute_intake.back_picker')}
        </button>
        <Link
          to={`/secretariat/meetings/${activeMeetingId}/minutes`}
          className="flex items-center gap-1.5 text-sm font-bold text-primary-600 hover:underline"
        >
          <FileText size={14} />
          {t('minute_intake.open_minutes_editor')}
        </Link>
      </div>

      <PageHeader
        title={t('minute_intake.title')}
        subtitle={t('minute_intake.subtitle')}
      />

      {error && (
        <div className="mb-4 flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-300 text-sm">
          <AlertCircle size={14} />
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 flex items-center gap-2 p-3 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800 rounded-xl text-emerald-700 dark:text-emerald-300 text-sm">
          <CheckCircle2 size={14} />
          {success}
        </div>
      )}

      {notAllowed && (
        <div className="mb-4 card p-4 text-sm text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
          {t('minute_intake.not_allowed')}
        </div>
      )}

      <div className="flex flex-wrap gap-2 mb-6">
        <button
          type="button"
          onClick={saveDraft}
          disabled={saving || loading || notAllowed}
          className="btn-primary flex items-center gap-2 disabled:opacity-50"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          {t('minute_intake.save_draft')}
        </button>
        <button
          type="button"
          onClick={formatAll}
          disabled={formattingAll || loading || notAllowed}
          className="btn-secondary flex items-center gap-2 disabled:opacity-50"
        >
          {formattingAll ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
          {t('minute_intake.format_all')}
        </button>
        <button
          type="button"
          onClick={applyToMinutes}
          disabled={applying || loading || notAllowed}
          className="btn-secondary flex items-center gap-2 disabled:opacity-50"
        >
          {applying ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
          {t('minute_intake.apply_to_minutes')}
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 size={28} className="animate-spin text-slate-400" />
        </div>
      ) : (
        <div className="space-y-4">
          {items.map(item => (
            <IntakeItemCard
              key={item.agenda_item_id}
              item={item}
              expanded={expanded[item.agenda_item_id] !== false}
              onToggle={() => setExpanded(prev => ({
                ...prev,
                [item.agenda_item_id]: !prev[item.agenda_item_id],
              }))}
              onChange={updateItem}
              onFormat={formatItem}
              formatting={formattingId === item.agenda_item_id}
            />
          ))}
          {items.length === 0 && !loading && (
            <p className="text-sm text-slate-500">{t('minute_intake.empty_items')}</p>
          )}
        </div>
      )}
    </div>
  )
}
