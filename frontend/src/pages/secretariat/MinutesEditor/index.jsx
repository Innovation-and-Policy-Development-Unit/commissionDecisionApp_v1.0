import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  FileText, Save, CheckCircle2, AlertCircle, ArrowLeft,
  Sparkles, Mic, Brain, Download, ChevronDown, ChevronRight,
  Plus, Trash2, Loader2, PenSquare, Copy, Upload, AlertTriangle, ExternalLink,
  ListTodo,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import PageHeader from '../../../components/shared/PageHeader'
import api from '../../../api/client'
import { formatApiError } from '../../../utils/apiError'
import { useAuth } from '../../../context/AuthContext'
import clsx from 'clsx'

const TRANSCRIPTION_ACTIVE = new Set(['pending', 'transcribing', 'refining'])

const TRANSCRIPTION_STATUS_LABEL = {
  pending: 'Queued for transcription…',
  transcribing: 'Transcribing with Whisper…',
  refining: 'Improving transcript with Claude…',
  ready: 'Transcript ready for review',
  failed: 'Transcription failed',
}

const MINUTES_STATUS = {
  draft:    { label: 'Draft',    bg: 'bg-amber-100 dark:bg-amber-900/20', text: 'text-amber-700 dark:text-amber-300', border: 'border-amber-200 dark:border-amber-800' },
  reviewed: { label: 'Reviewed', bg: 'bg-blue-100 dark:bg-blue-900/20',  text: 'text-blue-700 dark:text-blue-300',  border: 'border-blue-200 dark:border-blue-800'  },
  signed:   { label: 'Signed',   bg: 'bg-emerald-100 dark:bg-emerald-900/20', text: 'text-emerald-700 dark:text-emerald-300', border: 'border-emerald-200 dark:border-emerald-800' },
}

function SectionEditor({ label, value, onChange, placeholder }) {
  return (
    <div className="mb-4">
      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">{label}</label>
      <textarea
        className="input min-h-[80px] resize-y"
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder || `Enter ${label.toLowerCase()}...`}
      />
    </div>
  )
}

function AgendaItemEditor({ item, index, onChange }) {
  const [expanded, setExpanded] = useState(true)

  return (
    <div className="border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
      >
        <div className="flex items-center gap-2">
          {expanded ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />}
          <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
            {item.submission_ref || `Item ${index + 1}`}
          </span>
          {item.title && <span className="text-xs text-slate-500 ml-1">— {item.title}</span>}
        </div>
        <span className={clsx(
          'text-[10px] font-bold uppercase px-2 py-0.5 rounded-full',
          item.decision_type === 'approved' && 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300',
          item.decision_type === 'rejected' && 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-300',
          item.decision_type === 'deferred' && 'bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300',
          item.decision_type === 'returned' && 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300',
          item.decision_type === 'tabled' && 'bg-purple-100 text-purple-700 dark:bg-purple-900/20 dark:text-purple-300',
          !item.decision_type && 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
        )}>
          {item.decision_type || 'Pending'}
        </span>
      </button>
      {expanded && (
        <div className="p-4 space-y-3 border-t border-slate-100 dark:border-slate-700">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Ref</label>
              <input className="input text-sm" value={item.submission_ref || ''} onChange={e => onChange(index, 'submission_ref', e.target.value)} placeholder="e.g. PSC/01/2026" />
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Title</label>
              <input className="input text-sm" value={item.title || ''} onChange={e => onChange(index, 'title', e.target.value)} placeholder="Submission title" />
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Discussion</label>
            <textarea className="input min-h-[60px] resize-y text-sm" value={item.discussion || ''} onChange={e => onChange(index, 'discussion', e.target.value)} placeholder="Summary of discussion..." />
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Decision</label>
            <textarea className="input min-h-[40px] resize-y text-sm" value={item.decision || ''} onChange={e => onChange(index, 'decision', e.target.value)} placeholder="Formal resolution wording..." />
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Decision Type</label>
            <select className="input text-sm" value={item.decision_type || ''} onChange={e => onChange(index, 'decision_type', e.target.value)}>
              <option value="">— Select —</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="deferred">Deferred</option>
              <option value="returned">Returned</option>
              <option value="tabled">Tabled</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Action Items</label>
            {(item.action_items || []).map((ai, aiIdx) => (
              <div key={aiIdx} className="flex items-start gap-2 mb-2">
                <input className="input text-sm flex-1" value={ai.action || ''} onChange={e => {
                  const items = [...(item.action_items || [])]
                  items[aiIdx] = { ...items[aiIdx], action: e.target.value }
                  onChange(index, 'action_items', items)
                }} placeholder="Action description" />
                <input className="input text-sm w-36" value={ai.responsible || ''} onChange={e => {
                  const items = [...(item.action_items || [])]
                  items[aiIdx] = { ...items[aiIdx], responsible: e.target.value }
                  onChange(index, 'action_items', items)
                }} placeholder="Responsible" />
                <button type="button" onClick={() => {
                  const items = (item.action_items || []).filter((_, i) => i !== aiIdx)
                  onChange(index, 'action_items', items)
                }} className="p-2 text-red-400 hover:text-red-600 transition-colors">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            <button type="button" onClick={() => {
              const items = [...(item.action_items || []), { action: '', responsible: '', deadline: '' }]
              onChange(index, 'action_items', items)
            }} className="flex items-center gap-1 text-xs font-bold text-primary-600 hover:text-primary-700 transition-colors">
              <Plus size={12} /> Add Action Item
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function MinutesEditor() {
  const { t } = useTranslation()
  const { meetingId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [meeting, setMeeting] = useState(null)
  const [minutes, setMinutes] = useState(null)
  const [transcript, setTranscript] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [aiBusy, setAiBusy] = useState(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [pasteText, setPasteText] = useState('')
  const [savingTranscript, setSavingTranscript] = useState(false)
  const [copiedPrompt, setCopiedPrompt] = useState(false)
  const [actionPasteText, setActionPasteText] = useState('')

  const [content, setContent] = useState({
    opening: '',
    confirmation_previous_minutes: '',
    agenda_items: [],
    any_other_business: '',
    closing: '',
    next_meeting_date: '',
  })

  const applyTranscript = useCallback((tr) => {
    if (!tr) return
    setTranscript(tr)
    setPasteText(tr.raw_text || '')
  }, [])

  const fetchTranscript = useCallback(async () => {
    try {
      const tRes = await api.get(`/transcripts/?meeting=${meetingId}`)
      if (tRes.data?.length > 0) applyTranscript(tRes.data[0])
    } catch {
      // ignore poll errors
    }
  }, [meetingId, applyTranscript])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [mRes, minsRes, tRes] = await Promise.allSettled([
        api.get(`/meetings/${meetingId}/`),
        api.get(`/minutes/?meeting=${meetingId}`),
        api.get(`/transcripts/?meeting=${meetingId}`),
      ])

      if (mRes.status === 'fulfilled') setMeeting(mRes.value.data)
      if (minsRes.status === 'fulfilled' && minsRes.value.data.length > 0) {
        const m = minsRes.value.data[0]
        setMinutes(m)
        if (m.content && typeof m.content === 'object') {
          setContent(m.content)
          if (m.content.action_register?.summary) {
            setActionPasteText('')
          }
        }
      }
      if (tRes.status === 'fulfilled' && tRes.value.data.length > 0) {
        applyTranscript(tRes.value.data[0])
      }
    } catch (err) {
      setError('Failed to load meeting data.')
    } finally {
      setLoading(false)
    }
  }, [meetingId, applyTranscript])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    const status = transcript?.transcription_status
    if (!status || !TRANSCRIPTION_ACTIVE.has(status)) return undefined

    const poll = async () => {
      await fetchTranscript()
    }
    poll()
    const id = setInterval(poll, 4000)
    return () => clearInterval(id)
  }, [transcript?.transcription_status, fetchTranscript])

  useEffect(() => {
    const status = transcript?.transcription_status
    if (status === 'ready' && aiBusy === 'transcribe') {
      setAiBusy(null)
      setSuccess(t('meeting_room.minutes_transcribe_ready'))
    }
    if (status === 'failed' && aiBusy === 'transcribe') {
      setAiBusy(null)
      setError(transcript?.transcription_error || t('meeting_room.minutes_transcribe_failed'))
    }
  }, [transcript?.transcription_status, transcript?.transcription_error, aiBusy, t])

  const handleAgendaChange = (index, field, value) => {
    setContent(prev => {
      const items = [...(prev.agenda_items || [])]
      if (index >= items.length) {
        items.push({})
      }
      items[index] = { ...items[index], [field]: value }
      return { ...prev, agenda_items: items }
    })
  }

  const saveMinutes = async () => {
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      const payload = { meeting: parseInt(meetingId), content }
      if (minutes?.id) {
        const res = await api.patch(`/minutes/${minutes.id}/`, payload)
        setMinutes(res.data)
        setSuccess('Minutes saved as draft.')
      } else {
        const res = await api.post('/minutes/', payload)
        setMinutes(res.data)
        setSuccess('Minutes created.')
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save minutes.')
    } finally {
      setSaving(false)
    }
  }

  const runTranscribePipeline = async () => {
    setAiBusy('transcribe')
    setError('')
    setSuccess('')
    try {
      const res = await api.post(`/meetings/${meetingId}/transcribe/`)
      setSuccess(res.data.detail || t('meeting_room.minutes_transcribe_started'))
      await fetchTranscript()
    } catch (err) {
      setError(formatApiError(err, t('meeting_room.minutes_transcribe_failed')))
      setAiBusy(null)
    }
  }

  const runAiAction = async (action, endpoint, body) => {
    setAiBusy(action)
    setError('')
    setSuccess('')
    try {
      const res = await api.post(endpoint, body)
      setSuccess(res.data.detail)
      setTimeout(load, 2000)
    } catch (err) {
      setError(err.response?.data?.detail || `AI action failed: ${action}`)
    } finally {
      setAiBusy(null)
    }
  }

  const [showPinModal, setShowPinModal] = useState(false)
  const [pinInput, setPinInput] = useState('')
  const [pinError, setPinError] = useState('')

  const changeStatus = async (action, pin) => {
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      const method = action === 'sign' ? 'sign' : 'mark-reviewed'
      const payload = action === 'sign' ? { pin } : {}
      const res = await api.post(`/minutes/${minutes.id}/${method}/`, payload)
      setMinutes(res.data)
      setSuccess(action === 'sign' ? 'Minutes signed.' : 'Minutes marked as reviewed.')
    } catch (err) {
      setError(err.response?.data?.detail || `Failed to ${action} minutes.`)
    } finally {
      setSaving(false)
    }
  }

  const handleSignClick = () => {
    setPinInput('')
    setPinError('')
    setShowPinModal(true)
  }

  const handlePinSubmit = async (e) => {
    e.preventDefault()
    if (pinInput.length < 4) {
      setPinError('PIN must be at least 4 digits.')
      return
    }
    setShowPinModal(false)
    await changeStatus('sign', pinInput)
  }

  const saveTranscriptPaste = async () => {
    setSavingTranscript(true)
    setError('')
    setSuccess('')
    try {
      const res = await api.patch(`/meetings/${meetingId}/transcript/`, {
        raw_text: pasteText,
        source: 'manual_paste',
      })
      setTranscript(res.data)
      setSuccess(t('meeting_room.minutes_transcript_saved'))
    } catch (err) {
      setError(err.response?.data?.detail || t('meeting_room.minutes_transcript_save_failed'))
    } finally {
      setSavingTranscript(false)
    }
  }

  const copyClaudePrompt = async () => {
    setError('')
    try {
      const res = await api.get(`/meetings/${meetingId}/claude-prompt/`)
      await navigator.clipboard.writeText(res.data.prompt || '')
      setCopiedPrompt(true)
      setSuccess(t('meeting_room.copied'))
      setTimeout(() => setCopiedPrompt(false), 2500)
    } catch (err) {
      setError(err.response?.data?.detail || t('meeting_room.minutes_copy_failed'))
    }
  }

  const downloadPdf = async () => {
    setError('')
    setSuccess('')
    try {
      const res = await api.get(`/minutes/${minutes.id}/pdf/`, { responseType: 'blob' })
      const url = URL.createObjectURL(res.data)
      const a = document.createElement('a')
      a.href = url
      a.download = `minutes_${meeting?.reference_number || meetingId}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setError('PDF generation not available yet.')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={32} className="animate-spin text-slate-300" />
      </div>
    )
  }

  const statusCfg = minutes ? MINUTES_STATUS[minutes.status] || MINUTES_STATUS.draft : null

  return (
    <div>
      <div className="mb-4">
        <button onClick={() => navigate('/secretariat/meetings')} className="flex items-center gap-1.5 text-sm font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors">
          <ArrowLeft size={16} /> Back to Sittings
        </button>
      </div>

      <PageHeader
        title={meeting?.title || `Meeting #${meetingId}`}
        subtitle={
          <span className="flex items-center gap-3 mt-1">
            <span className="font-mono text-xs">{meeting?.reference_number}</span>
            <span>{meeting?.date}</span>
            {minutes && statusCfg && (
              <span className={clsx('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider border shadow-sm', statusCfg.bg, statusCfg.text, statusCfg.border)}>
                <CheckCircle2 size={10} />
                {statusCfg.label}
              </span>
            )}
          </span>
        }
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

      {/* Transcript workflow */}
      <div className="card card-compact mb-6">
        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-1">
          {t('meeting_room.minutes_workflow_title')}
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
          {t('meeting_room.minutes_workflow_desc')}
        </p>

        <ol className="list-decimal list-inside text-sm text-slate-600 dark:text-slate-400 space-y-1 mb-4">
          <li>
            <Link to={`/meetings/capture?meetingId=${meetingId}`} className="text-primary-600 font-semibold hover:underline inline-flex items-center gap-1">
              {t('meeting_room.minutes_step_upload')} <ExternalLink size={12} />
            </Link>
          </li>
          <li>{t('meeting_room.minutes_step_paste')}</li>
          <li>{t('meeting_room.minutes_step_claude')}</li>
          <li>{t('meeting_room.minutes_step_ai')}</li>
        </ol>

        {(transcript?.raw_text || pasteText) && (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200 flex items-start gap-2">
            <AlertTriangle size={14} className="shrink-0 mt-0.5" />
            {t('meeting_room.minutes_bislama_warning')}
          </div>
        )}

        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
          {t('meeting_room.minutes_transcript_label')}
        </label>
        <textarea
          className="input min-h-[120px] resize-y font-mono text-xs mb-3"
          value={pasteText}
          onChange={e => setPasteText(e.target.value)}
          placeholder={t('meeting_room.minutes_transcript_placeholder')}
        />
        <div className="flex flex-wrap gap-2 mb-4">
          <button
            type="button"
            onClick={saveTranscriptPaste}
            disabled={savingTranscript || !pasteText.trim()}
            className="btn-secondary btn-sm disabled:opacity-50"
          >
            {savingTranscript ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            {t('meeting_room.minutes_save_transcript')}
          </button>
          <button type="button" onClick={copyClaudePrompt} className="btn-secondary btn-sm">
            {copiedPrompt ? <CheckCircle2 size={14} /> : <Copy size={14} />}
            {t('meeting_room.copy_prompt')}
          </button>
          <Link
            to={`/secretariat/meeting-room/minutes-pipeline?meetingId=${meetingId}`}
            className="btn-outline btn-sm inline-flex items-center gap-1"
          >
            {t('meeting_room.pipeline_title')}
          </Link>
        </div>

        {transcript?.transcription_status && TRANSCRIPTION_STATUS_LABEL[transcript.transcription_status] && (
          <p className={clsx(
            'text-xs font-semibold mb-3',
            transcript.transcription_status === 'failed'
              ? 'text-red-600 dark:text-red-400'
              : 'text-indigo-600 dark:text-indigo-400',
          )}>
            {TRANSCRIPTION_ACTIVE.has(transcript.transcription_status) && (
              <Loader2 size={12} className="inline animate-spin mr-1" />
            )}
            {TRANSCRIPTION_STATUS_LABEL[transcript.transcription_status]}
          </p>
        )}

        <div className="flex flex-wrap gap-3 pt-3 border-t border-slate-100 dark:border-slate-700">
          <button
            type="button"
            onClick={runTranscribePipeline}
            disabled={
              aiBusy !== null
              || !transcript?.audio_file
              || TRANSCRIPTION_ACTIVE.has(transcript?.transcription_status)
            }
            title={!transcript?.audio_file ? t('meeting_room.minutes_transcribe_no_audio') : undefined}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-50 dark:bg-indigo-900/20 hover:bg-indigo-100 border border-indigo-200 dark:border-indigo-800 rounded-xl text-indigo-700 dark:text-indigo-300 font-bold text-xs disabled:opacity-50"
          >
            {aiBusy === 'transcribe' || TRANSCRIPTION_ACTIVE.has(transcript?.transcription_status)
              ? <Loader2 size={14} className="animate-spin" />
              : <Mic size={14} />}
            {t('meeting_room.minutes_run_transcribe')}
          </button>
          <button
            type="button"
            onClick={() => runAiAction('draft', '/minutes/generate-from-transcript/', { meeting_id: parseInt(meetingId) })}
            disabled={aiBusy !== null}
            className="flex items-center gap-2 px-4 py-2.5 bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-100 border border-purple-200 dark:border-purple-800 rounded-xl text-purple-700 dark:text-purple-300 font-bold text-xs disabled:opacity-50"
          >
            {aiBusy === 'draft' ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            {t('meeting_room.minutes_generate')}
          </button>
          <button
            type="button"
            onClick={() => runAiAction('extract', '/minutes/extract-decisions/', { meeting_id: parseInt(meetingId) })}
            disabled={aiBusy !== null}
            className="flex items-center gap-2 px-4 py-2.5 bg-cyan-50 dark:bg-cyan-900/20 hover:bg-cyan-100 border border-cyan-200 dark:border-cyan-800 rounded-xl text-cyan-700 dark:text-cyan-300 font-bold text-xs disabled:opacity-50"
          >
            {aiBusy === 'extract' ? <Loader2 size={14} className="animate-spin" /> : <Brain size={14} />}
            {t('meeting_room.minutes_extract')}
          </button>
          <button
            type="button"
            onClick={() => runAiAction(
              'actions',
              '/minutes/extract-action-items/',
              {
                meeting_id: parseInt(meetingId),
                minutes_text: actionPasteText.trim() || pasteText.trim(),
              },
            )}
            disabled={aiBusy !== null || (!actionPasteText.trim() && !pasteText.trim() && !(content.agenda_items?.length))}
            className="flex items-center gap-2 px-4 py-2.5 bg-teal-50 dark:bg-teal-900/20 hover:bg-teal-100 border border-teal-200 dark:border-teal-800 rounded-xl text-teal-700 dark:text-teal-300 font-bold text-xs disabled:opacity-50"
          >
            {aiBusy === 'actions' ? <Loader2 size={14} className="animate-spin" /> : <ListTodo size={14} />}
            Extract action register
          </button>
        </div>

        <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-700">
          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
            Paste minutes for action-item extraction (optional)
          </label>
          <textarea
            className="input min-h-[80px] resize-y text-xs font-mono mb-1"
            value={actionPasteText}
            onChange={e => setActionPasteText(e.target.value)}
            placeholder="Paste full minutes here, or leave blank to use saved minutes / transcript above."
          />
        </div>

        {transcript?.source && (
          <p className="text-[10px] text-slate-400 mt-2 uppercase tracking-widest">
            {t('meeting_room.minutes_source')}: {transcript.source}
            {transcript.ai_processed && ` · ${t('meeting_room.minutes_ai_processed')}`}
          </p>
        )}
      </div>

      {content.action_register && (
        <div className="card card-compact mb-6 border-teal-200 dark:border-teal-800">
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-2 flex items-center gap-2">
            <ListTodo size={18} className="text-teal-600" />
            AI action register
          </h2>
          {content.action_register.summary && (
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">{content.action_register.summary}</p>
          )}
          {(content.action_register.action_items || []).length > 0 && (
            <div className="mb-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Action items</p>
              <ul className="space-y-2">
                {content.action_register.action_items.map((ai, idx) => (
                  <li key={idx} className="text-sm rounded-lg bg-slate-50 dark:bg-slate-800/50 px-3 py-2 border border-slate-100 dark:border-slate-700">
                    <span className="font-medium text-slate-800 dark:text-slate-100">{ai.action}</span>
                    <span className="text-slate-500 dark:text-slate-400"> — {ai.owner || 'TBC'}</span>
                    {ai.deadline && <span className="text-xs text-amber-600 dark:text-amber-400"> · due {ai.deadline}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {(content.action_register.deferred_matters || []).length > 0 && (
            <div className="mb-4 text-sm">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Deferred</p>
              {content.action_register.deferred_matters.map((d, i) => (
                <p key={i} className="text-slate-600 dark:text-slate-400 mb-1">{d.matter} — {d.next_step}</p>
              ))}
            </div>
          )}
          {(content.action_register.follow_up_questions || []).length > 0 && (
            <div className="text-sm">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Follow-up questions</p>
              {content.action_register.follow_up_questions.map((q, i) => (
                <p key={i} className="text-slate-600 dark:text-slate-400 mb-1">{q.question} → {q.directed_to}</p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Minutes Editor */}
      <div className="space-y-4">
        <SectionEditor label="Opening" value={content.opening} placeholder="e.g. The meeting opened at 9:30 AM with a prayer led by..." onChange={v => setContent(prev => ({ ...prev, opening: v }))} />
        <SectionEditor label="Confirmation of Previous Minutes" value={content.confirmation_previous_minutes} placeholder="e.g. The minutes of the previous sitting were confirmed as a true record..." onChange={v => setContent(prev => ({ ...prev, confirmation_previous_minutes: v }))} />

        <div className="mb-4">
          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Agenda Items</label>
          {(content.agenda_items || []).map((item, idx) => (
            <div key={idx} className="mb-3">
              <AgendaItemEditor item={item} index={idx} onChange={handleAgendaChange} />
            </div>
          ))}
          <button
            type="button"
            onClick={() => setContent(prev => ({ ...prev, agenda_items: [...(prev.agenda_items || []), { sequence: (prev.agenda_items?.length || 0) + 1, submission_ref: '', title: '', discussion: '', decision: '', decision_type: '', action_items: [] }] }))}
            className="flex items-center gap-1.5 text-sm font-bold text-primary-600 hover:text-primary-700 transition-colors"
          >
            <Plus size={14} /> Add Agenda Item
          </button>
        </div>

        <SectionEditor label="Any Other Business" value={content.any_other_business} placeholder="e.g. The Commission noted the update on..." onChange={v => setContent(prev => ({ ...prev, any_other_business: v }))} />
        <SectionEditor label="Closing" value={content.closing} placeholder="e.g. There being no further business, the meeting closed at..." onChange={v => setContent(prev => ({ ...prev, closing: v }))} />

        <div className="mb-4">
          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Next Meeting Date</label>
          <input className="input" type="text" value={content.next_meeting_date || ''} placeholder="e.g. TBC, or a specific date" onChange={e => setContent(prev => ({ ...prev, next_meeting_date: e.target.value }))} />
        </div>
      </div>

      {/* Action Buttons */}
      <div className="mt-8 flex items-center justify-between border-t border-slate-200 dark:border-slate-700 pt-6">
        <div className="flex items-center gap-3">
          <button
            onClick={saveMinutes}
            disabled={saving}
            className="btn-gradient px-6 py-2.5 text-sm inline-flex items-center gap-2 disabled:opacity-60 shadow-lg shadow-primary-500/20"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {saving ? 'Saving...' : minutes?.id ? 'Save Draft' : 'Create Draft'}
          </button>
          {minutes?.id && minutes.status !== 'signed' && (
            <>
              {minutes.status === 'draft' && (
                <button onClick={() => changeStatus('review')} className="btn-secondary px-5 py-2.5 text-sm inline-flex items-center gap-2">
                  <CheckCircle2 size={16} />
                  Mark Reviewed
                </button>
              )}
              {minutes.status === 'reviewed' && (
                <>
                  {!user?.signature && (
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-xs">
                      <PenSquare size={14} />
                      <span>No signature uploaded — <a href="/pages/account" className="underline font-semibold">add one in Account settings</a> so it appears on the signed PDF.</span>
                    </div>
                  )}
                  <button onClick={handleSignClick} className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 text-sm font-bold rounded-xl inline-flex items-center gap-2 transition-colors shadow-lg shadow-emerald-500/20 disabled:opacity-60">
                    <CheckCircle2 size={16} />
                    Sign Minutes
                  </button>
                </>
              )}
            </>
          )}
        </div>
        {minutes?.id && (
          <button onClick={downloadPdf} className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors">
            <Download size={16} />
            Export PDF
          </button>
        )}
      </div>

      {/* PIN confirmation modal */}
      {showPinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowPinModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-600">
                <PenSquare size={18} />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">Confirm Signature</h3>
                <p className="text-xs text-slate-500">Enter your session PIN to sign the minutes.</p>
              </div>
            </div>

            {pinError && (
              <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{pinError}</div>
            )}

            <form onSubmit={handlePinSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
                  Session PIN
                </label>
                <input
                  type="password"
                  className="input text-center text-xl font-mono"
                  style={{ borderRadius: 10, letterSpacing: '0.4em' }}
                  maxLength={6}
                  placeholder="••••••"
                  value={pinInput}
                  onChange={e => setPinInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  required
                  autoFocus
                />
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  disabled={saving || pinInput.length < 4}
                  className="btn-gradient flex-1 py-2.5 text-sm"
                >
                  {saving ? 'Signing…' : 'Confirm & Sign'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowPinModal(false)}
                  className="btn-outline py-2.5 px-5 text-sm"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
