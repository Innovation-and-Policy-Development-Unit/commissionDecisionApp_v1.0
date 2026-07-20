import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import PageHeader from '../../components/shared/PageHeader'
import Modal from '../../components/shared/Modal'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { useConfirm } from '../../context/ConfirmContext'
import api from '../../api/client'
import {
  ClipboardList, Plus, RefreshCw, Search, User, Users, X,
  CheckCircle2, Circle, Loader, FileText, Download, Calendar,
  AlertTriangle, Trash2, ChevronDown, ChevronRight, ListChecks,
  Sparkles,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { formatApiError } from '../../utils/apiError'
import BaseButton from '../../components/shared/BaseButton'
import BaseInput from '../../components/shared/BaseInput'
import BaseSelect from '../../components/shared/BaseSelect'
import BaseTextarea from '../../components/shared/BaseTextarea'
import DecisionLetterPanel from '../../components/tasks/DecisionLetterPanel'
import BaseCheckbox from '../../components/shared/BaseCheckbox'
import { userCanWorkCommissionTask, userHasCommissionDecisionView } from '../../utils/opscAccess'
import clsx from 'clsx'

const TASK_LINK_STAGES = new Set([
  'minutes_drafted_signed', 'decision_entered_assigned',
  'under_implementation', 'implementation_report',
  'approved', 'rejected',
])

const STATUS_META = {
  open: { label: 'Open', cls: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' },
  in_progress: { label: 'In progress', cls: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' },
  completed: { label: 'Completed', cls: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300' },
  cancelled: { label: 'Cancelled', cls: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' },
}

const DECISION_TYPE_OPTIONS = [
  { value: '', label: '— Select type —' },
  { value: 'appointment', label: 'Appointment' },
  { value: 'discipline', label: 'Discipline' },
  { value: 'policy_change', label: 'Policy change' },
  { value: 'termination', label: 'Termination' },
  { value: 'promotion', label: 'Promotion' },
  { value: 'other', label: 'Other' },
]

const DECISION_OUTCOME_OPTIONS = [
  { value: '', label: '— Select outcome —' },
  { value: 'approved',      label: 'Approved',                       cls: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300' },
  { value: 'deferred_next', label: 'Deferred To Next Meeting',        cls: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300' },
  { value: 'deferred_info', label: 'Deferred — Need more info',       cls: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300' },
  { value: 'rejected',      label: 'Rejected',                        cls: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' },
]

const ACTION_UNIT_OPTIONS = [
  { value: '', label: '— Select unit —' },
  { value: 'CIU',            label: 'CIU' },
  { value: 'CSU',            label: 'CSU' },
  { value: 'FHU',            label: 'FHU' },
  { value: 'HRMU',           label: 'HRMU' },
  { value: 'ODU',            label: 'ODU' },
  { value: 'OPSC_Secretary', label: 'OPSC Secretary' },
  { value: 'VIPAM_HRDU',     label: 'VIPAM/HRDU' },
]

const IMPL_STATUS_OPTIONS = [
  { value: 'with_unit',       label: 'With Unit Responsible', cls: 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300' },
  { value: 'matters_arising', label: 'Matters Arising',       cls: 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300' },
  { value: 'actioned',        label: 'Actioned',              cls: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300' },
  { value: 'now_irrelevant',  label: 'Now Irrelevant',        cls: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400' },
]

function decisionTypeLabel(value) {
  return DECISION_TYPE_OPTIONS.find(o => o.value === value)?.label ?? value
}

function DecisionOutcomeBadge({ value }) {
  const opt = DECISION_OUTCOME_OPTIONS.find(o => o.value === value)
  if (!opt || !opt.cls) return null
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${opt.cls}`}>{opt.label}</span>
}

function ImplStatusBadge({ value }) {
  const opt = IMPL_STATUS_OPTIONS.find(o => o.value === value)
  if (!opt) return <span className="text-xs text-slate-400">—</span>
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${opt.cls}`}>{opt.label}</span>
}

function DecisionRegisterFields({ decisionNumber, setDecisionNumber, decisionOutcome, setDecisionOutcome, actionUnit, setActionUnit, implementationStatus, setImplementationStatus, wayForward, setWayForward, decisionDetail, setDecisionDetail }) {
  return (
    <div className="space-y-4 pt-2 border-t border-slate-100 dark:border-slate-700">
      <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">Decision Register</p>
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <BaseInput label="Decision number" value={decisionNumber} onChange={e => setDecisionNumber(e.target.value)} placeholder="e.g. 02-28-2025" hint="Format: decision#-meeting#-year" />
        </div>
        <BaseSelect
          label="Decision outcome"
          value={decisionOutcome}
          options={DECISION_OUTCOME_OPTIONS.filter(o => o.value).map(o => ({ value: o.value, label: o.label }))}
          placeholder={DECISION_OUTCOME_OPTIONS.find(o => !o.value)?.label ?? '— Select outcome —'}
          onChange={(_, v) => setDecisionOutcome(v)}
        />
        <BaseSelect
          label="Action unit"
          value={actionUnit}
          options={ACTION_UNIT_OPTIONS.filter(o => o.value).map(o => ({ value: o.value, label: o.label }))}
          placeholder={ACTION_UNIT_OPTIONS.find(o => !o.value)?.label ?? '— Select unit —'}
          onChange={(_, v) => setActionUnit(v)}
        />
        <BaseSelect
          label="Implementation status"
          value={implementationStatus}
          options={IMPL_STATUS_OPTIONS.map(o => ({ value: o.value, label: o.label }))}
          onChange={(_, v) => setImplementationStatus(v)}
        />
        <div className="sm:col-span-2">
          <BaseTextarea label="Decision detail" rows={3} value={decisionDetail} onChange={e => setDecisionDetail(e.target.value)} placeholder="Full text of what the Commission decided…" />
        </div>
        <div className="sm:col-span-2">
          <BaseTextarea label="Way forward / next steps" rows={2} value={wayForward} onChange={e => setWayForward(e.target.value)} placeholder="Notes on next steps or follow-up actions…" />
        </div>
      </div>
    </div>
  )
}

function TaskMetadataFields({ meetingReference, setMeetingReference, meetingDate, setMeetingDate, minuteReference, setMinuteReference, decisionType, setDecisionType, successCriteria, setSuccessCriteria, legalReference, setLegalReference }) {
  return (
    <div className="space-y-4 pt-2 border-t border-slate-100 dark:border-slate-700">
      <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">Commission context</p>
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <BaseInput label="Meeting / sitting reference" value={meetingReference} onChange={e => setMeetingReference(e.target.value)} placeholder="e.g. PSC Meeting 05/2026" hint="Identifies which sitting produced this action." />
        </div>
        <BaseInput label="Meeting date (optional)" type="date" value={meetingDate} onChange={e => setMeetingDate(e.target.value)} />
        <BaseInput label="Minute reference" value={minuteReference} onChange={e => setMinuteReference(e.target.value)} placeholder="e.g. Item 4.2, para. 12" hint="Paragraph or item number in the official minutes." />
        <div className="sm:col-span-2">
          <BaseSelect
            label="Decision type"
            value={decisionType}
            options={DECISION_TYPE_OPTIONS.filter(o => o.value).map(o => ({ value: o.value, label: o.label }))}
            placeholder={DECISION_TYPE_OPTIONS.find(o => !o.value)?.label ?? '— Select type —'}
            onChange={(_, v) => setDecisionType(v)}
          />
        </div>
        <div className="sm:col-span-2">
          <BaseTextarea label="Success criteria" rows={3} value={successCriteria} onChange={e => setSuccessCriteria(e.target.value)} placeholder='What does "complete" look like for this task?' />
        </div>
        <div className="sm:col-span-2">
          <BaseInput label="Legal / regulation reference (optional)" value={legalReference} onChange={e => setLegalReference(e.target.value)} placeholder="e.g. PSC Staff Manual §..., Act Cap. ..." />
        </div>
      </div>
    </div>
  )
}

function StatusBadge({ status }) {
  const m = STATUS_META[status] || { label: status, cls: 'bg-slate-100 text-slate-600' }
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${m.cls}`}>
      {status === 'completed' ? <CheckCircle2 size={11} /> : status === 'open' ? <Circle size={11} /> : null}
      {m.label}
    </span>
  )
}

function formatTaskUpdateTime(iso) {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
  } catch {
    return iso
  }
}

function TaskStatusUpdatesSection({ taskId }) {
  const toast = useToast()
  const [items, setItems] = useState([]); const [loading, setLoading] = useState(true); const [body, setBody] = useState(''); const [posting, setPosting] = useState(false)
  const load = useCallback(async () => {
    setLoading(true)
    try { const res = await api.get(`/commission-tasks/${taskId}/status-updates/`); setItems(Array.isArray(res.data) ? res.data : []) }
    catch { setItems([]) }
    finally { setLoading(false) }
  }, [taskId])
  useEffect(() => { load() }, [load])
  const add = async e => { e.preventDefault(); const t = body.trim(); if (!t) return; setPosting(true); try { await api.post(`/commission-tasks/${taskId}/status-updates/`, { body: t }); setBody(''); await load(); toast.success('Update added.') } catch (ex) { const d = ex.response?.data; toast.error(typeof d?.detail === 'string' ? d.detail : d ? JSON.stringify(d) : 'Could not add update.') } finally { setPosting(false) } }
  return (
    <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-700">
      <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">Status updates & comments</p>
      <p className="text-[11px] text-slate-400 mt-1">Log progress, reasons for missed deadlines, or other context. Entries are dated and attributed for reporting.</p>
      {loading ? <p className="text-xs text-slate-400 flex items-center gap-1"><Loader size={12} className="animate-spin" /> Loading...</p>
        : items.length === 0 ? <p className="text-xs text-slate-400 italic">No entries yet.</p>
        : <ul className="space-y-2 max-h-48 overflow-y-auto text-sm">
            {items.map(u => (
              <li key={u.id} className="rounded-lg border border-slate-100 dark:border-slate-600 bg-slate-50/80 dark:bg-slate-900/40 px-3 py-2">
                <p className="text-slate-800 dark:text-slate-100 whitespace-pre-wrap">{u.body}</p>
                <p className="text-[11px] text-slate-400 mt-1.5">{u.author_username} · {formatTaskUpdateTime(u.created_at)}</p>
              </li>
            ))}
          </ul>}
      <div className="space-y-2">
        <BaseTextarea label="Add update" rows={3} value={body} onChange={e => setBody(e.target.value)} placeholder="e.g. Awaiting legal advice; revised deadline proposed for ..." maxLength={8000} />
        <BaseButton variant="outline" size="sm" onClick={add} loading={posting} loadingLabel="Posting" disabled={!body.trim()}>Post update</BaseButton>
      </div>
    </div>
  )
}

// ── Subtask Section ──────────────────────────────────────────────────────────

function SubtaskSection({ taskId, subtasks, aiDrafts, onRefresh, onDraftRefresh }) {
  const toast   = useToast()
  const confirm = useConfirm()
  const [expanded, setExpanded] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [stitle, setStitle] = useState('')
  const [sdesc, setSdesc] = useState('')
  const [sdue, setSdue] = useState('')
  const [sstaff, setSstaff] = useState([])
  const [staffOpts, setStaffOpts] = useState([])
  const [subSaving, setSubSaving] = useState(false)
  const [subErr, setSubErr] = useState('')
  const [draftBusy, setDraftBusy] = useState(false)

  const loadStaff = useCallback(async () => {
    try { const r = await api.get('/commission-tasks/eligible-staff/'); setStaffOpts(Array.isArray(r.data) ? r.data : []) } catch { setStaffOpts([]) }
  }, [])
  useEffect(() => { if (showCreate) loadStaff() }, [showCreate, loadStaff])

  const createSub = async e => {
    e.preventDefault(); setSubErr(''); const t = stitle.trim()
    if (!t) { setSubErr('Title is required.'); return }
    setSubSaving(true)
    try {
      const payload = { title: t, description: sdesc, due_date: sdue || null, assigned_staff: sstaff }
      await api.post(`/commission-tasks/${taskId}/subtasks/`, payload)
      setStitle(''); setSdesc(''); setSdue(''); setSstaff([]); setShowCreate(false); onRefresh()
      toast.success('Subtask created.')
    } catch (ex) {
      const d = ex.response?.data
      if (d?.due_date) setSubErr(d.due_date[0])
      else setSubErr(typeof d?.detail === 'string' ? d.detail : d ? JSON.stringify(d) : 'Failed to create subtask.')
    } finally { setSubSaving(false) }
  }

  const updateSubStatus = async (subId, newStatus) => {
    try { await api.patch(`/commission-tasks/${taskId}/subtasks/?subtask_id=${subId}`, { status: newStatus }); onRefresh(); toast.success('Subtask updated.') }
    catch { toast.error('Failed to update subtask status.') }
  }

  const deleteSub = async subId => {
    const ok = await confirm({ title: 'Delete Subtask', message: 'Delete this subtask? This cannot be undone.', confirmLabel: 'Delete' })
    if (!ok) return
    try { await api.delete(`/commission-tasks/${taskId}/subtasks/?subtask_id=${subId}`); onRefresh(); toast.success('Subtask deleted.') }
    catch { toast.error('Failed to delete subtask.') }
  }

  const toggleStaff = (id) => {
    setSstaff(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const requestAiDrafts = async () => {
    setDraftBusy(true)
    try {
      await api.post(`/commission-tasks/${taskId}/draft-subtasks/`)
      onDraftRefresh?.()
      toast.success('AI subtask draft queued — refresh in a few seconds.')
    } catch {
      toast.error('Could not request subtask draft.')
    } finally { setDraftBusy(false) }
  }

  return (
    <div className="border-t border-slate-100 dark:border-slate-700 pt-4 mt-4">
      <div className="flex items-center gap-2 mb-3">
        <button type="button" onClick={() => setExpanded(!expanded)} className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          Subtasks ({subtasks?.length || 0})
        </button>
        <button
          type="button"
          onClick={requestAiDrafts}
          disabled={draftBusy}
          className="ml-auto text-xs inline-flex items-center gap-1 text-violet-600 dark:text-violet-400 hover:underline disabled:opacity-50"
        >
          {draftBusy ? <Loader size={12} className="animate-spin" /> : <Sparkles size={12} />}
          Draft from register
        </button>
      </div>
      {aiDrafts?.subtasks?.length > 0 && (
        <div className="mb-3 rounded-xl border border-violet-200 dark:border-violet-800 bg-violet-50/50 dark:bg-violet-950/20 p-3 space-y-2">
          <p className="text-[10px] font-semibold uppercase text-amber-700 dark:text-amber-300">AI draft — verify before creating subtasks</p>
          {aiDrafts.subtasks.map((s, i) => (
            <div key={i} className="text-xs text-slate-700 dark:text-slate-300">
              <p className="font-semibold">{s.title}</p>
              {s.description && <p className="text-slate-500 mt-0.5">{s.description}</p>}
              {s.suggested_due_days && (
                <p className="text-[10px] text-slate-400 mt-0.5">Suggested due: ~{s.suggested_due_days} days</p>
              )}
            </div>
          ))}
        </div>
      )}
      {expanded && (
        <div className="space-y-2">
          {(subtasks || []).map(sub => (
            <div key={sub.id} className="flex items-start gap-2 p-3 rounded-xl border border-slate-100 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-900/40">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{sub.title}</p>
                {sub.description && <p className="text-xs text-slate-500 mt-0.5">{sub.description}</p>}
                <div className="flex flex-wrap gap-2 mt-1.5">
                  <StatusBadge status={sub.status} />
                  {sub.due_date && (
                    <span className={clsx('inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full',
                      new Date(sub.due_date) < new Date() && sub.status !== 'completed' ? 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-300' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400')}>
                      <Calendar size={10} /> {new Date(sub.due_date).toLocaleDateString()}
                    </span>
                  )}
                  {sub.assigned_staff_usernames?.length > 0 && (
                    <span className="inline-flex items-center gap-1 text-[10px] text-slate-500">
                      <Users size={10} /> {sub.assigned_staff_usernames.join(', ')}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {sub.status !== 'completed' && (
                  <BaseButton variant="ghost" size="icon" iconOnly title="Mark completed" onClick={() => updateSubStatus(sub.id, 'completed')} icon={<CheckCircle2 size={14} />} />
                )}
                <BaseButton variant="ghost" size="icon" iconOnly title="Delete" onClick={() => deleteSub(sub.id)} icon={<Trash2 size={14} />} />
              </div>
            </div>
          ))}
          {showCreate ? (
            // Plain div, not <form> — this section renders inside EditTaskModal's own
            // <form onSubmit={submit}>, and nested forms are invalid HTML: the inner
            // submit silently gets swallowed by (or redirected to) the outer form,
            // so this never reached createSub and just closed the whole modal.
            <div className="p-3 rounded-xl border border-dashed border-primary-300 dark:border-primary-700 bg-primary-50/50 dark:bg-primary-900/10 space-y-2">
              {subErr && <p className="text-xs text-red-600">{subErr}</p>}
              <BaseInput hideLabel label="Subtask title" value={stitle} onChange={e => setStitle(e.target.value)} placeholder="Subtask title" required />
              <BaseTextarea hideLabel label="Description" rows={2} value={sdesc} onChange={e => setSdesc(e.target.value)} placeholder="Description (optional)" />
              <BaseInput hideLabel label="Due date" type="date" value={sdue} onChange={e => setSdue(e.target.value)} />
              {staffOpts.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold text-slate-500 mb-1">Assign staff:</p>
                  <div className="flex flex-wrap gap-2">
                    {staffOpts.map(s => (
                      <BaseCheckbox key={s.id} label={s.username} checked={sstaff.includes(s.id)} onChange={() => toggleStaff(s.id)} />
                    ))}
                  </div>
                </div>
              )}
              <div className="flex gap-2 pt-1">
                <BaseButton type="button" variant="primary" size="sm" onClick={createSub} loading={subSaving} loadingLabel="Creating">Create</BaseButton>
                <BaseButton type="button" variant="outline" size="sm" onClick={() => setShowCreate(false)}>Cancel</BaseButton>
              </div>
            </div>
          ) : (
            <BaseButton variant="ghost" size="sm" icon={<Plus size={12} />} onClick={() => setShowCreate(true)}>Add Subtask</BaseButton>
          )}
        </div>
      )}
    </div>
  )
}

// ── Multi-Staff Select ───────────────────────────────────────────────────────

function MultiStaffSelect({ selected, onChange, staffList, label }) {
  const toggle = (id) => {
    onChange(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">{label || 'Assign staff'}</label>
      <div className="flex flex-wrap gap-2 p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/40 min-h-[36px]">
        {staffList.length === 0 && <span className="text-xs text-slate-400 italic">No eligible staff</span>}
        {staffList.map(s => (
          <label key={s.id} className={clsx(
            'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer transition-colors border',
            selected.includes(s.id)
              ? 'bg-primary-100 dark:bg-primary-900/30 border-primary-300 dark:border-primary-700 text-primary-700 dark:text-primary-300'
              : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600',
          )}>
            <input type="checkbox" checked={selected.includes(s.id)} onChange={() => toggle(s.id)} className="sr-only" />
            <Users size={10} />
            {s.username}
          </label>
        ))}
      </div>
      {selected.length > 0 && (
        <p className="text-[10px] text-slate-400 mt-1">{selected.length} staff selected</p>
      )}
    </div>
  )
}

// ── Report View ──────────────────────────────────────────────────────────────

const AI_REPORT_EXAMPLES = [
  'Overdue decisions assigned to ODU with implementation still with unit',
  'All approved decisions from 2025 grouped by action unit with executive summary',
  'Open and in-progress tasks for HRMU including way forward notes',
  'Deferred decisions needing more information — full register table',
]

function ReportView() {
  const { t } = useTranslation()
  const [rows, setRows] = useState([]); const [loading, setLoading] = useState(false); const [error, setError] = useState('')
  const [dateFrom, setDateFrom] = useState(''); const [dateTo, setDateTo] = useState('')
  const [rStatus, setRStatus] = useState(''); const [rManagerId, setRManagerId] = useState('')
  const [managers, setManagers] = useState([])
  const [aiPrompt, setAiPrompt] = useState('')
  const [aiJob, setAiJob] = useState(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState('')

  useEffect(() => {
    api.get('/commission-tasks/eligible-managers/').then(r => setManagers(Array.isArray(r.data) ? r.data : [])).catch(() => {})
  }, [])

  useEffect(() => {
    if (!aiJob?.id || aiJob.status === 'ready' || aiJob.status === 'failed') return undefined
    const timer = setInterval(async () => {
      try {
        const res = await api.get(`/commission-tasks/register-reports/${aiJob.id}/`)
        setAiJob(res.data)
      } catch {
        /* keep polling */
      }
    }, 2500)
    return () => clearInterval(timer)
  }, [aiJob?.id, aiJob?.status])

  const filterPayload = () => {
    const p = {}
    if (dateFrom) p.date_from = dateFrom
    if (dateTo) p.date_to = dateTo
    if (rStatus) p.status = rStatus
    if (rManagerId) p.manager_id = rManagerId
    return p
  }

  const downloadAiReport = async (url, filename) => {
    const res = await api.get(url, { responseType: 'blob' })
    const blobUrl = URL.createObjectURL(res.data)
    const a = document.createElement('a')
    a.href = blobUrl
    a.download = filename
    a.click()
    setTimeout(() => URL.revokeObjectURL(blobUrl), 5000)
  }

  const generateAiReport = async () => {
    const prompt = aiPrompt.trim()
    if (!prompt) {
      setAiError(t('register_report.prompt_required'))
      return
    }
    setAiLoading(true)
    setAiError('')
    setAiJob(null)
    try {
      const res = await api.post('/commission-tasks/register-reports/generate/', {
        prompt,
        ...filterPayload(),
      })
      const statusRes = await api.get(`/commission-tasks/register-reports/${res.data.id}/`)
      setAiJob(statusRes.data)
    } catch (err) {
      setAiError(formatApiError(err, t('register_report.generate_failed')))
    } finally {
      setAiLoading(false)
    }
  }

  const fetchReport = async (format = 'json') => {
    setLoading(true); setError('')
    try {
      const params = {}
      if (dateFrom) params.date_from = dateFrom
      if (dateTo) params.date_to = dateTo
      if (rStatus) params.status = rStatus
      if (rManagerId) params.manager_id = rManagerId
      if (format === 'csv') params.format = 'csv'

      if (format === 'csv') {
        const res = await api.get('/commission-tasks/report/', { params, responseType: 'blob' })
        const url = URL.createObjectURL(res.data)
        const a = document.createElement('a'); a.href = url; a.download = 'task_report.csv'; a.click(); URL.revokeObjectURL(url)
        return
      }
      const res = await api.get('/commission-tasks/report/', { params })
      setRows(Array.isArray(res.data) ? res.data : [])
    } catch {
      setError('Failed to load report.')
    } finally { setLoading(false) }
  }

  const aiReady = aiJob?.status === 'ready'
  const aiFailed = aiJob?.status === 'failed'
  const aiBusy = aiJob && !aiReady && !aiFailed

  return (
    <div>
      <div className="card card-compact mb-4 border-l-4 border-l-indigo-500">
        <div className="flex items-start gap-3 mb-3">
          <div className="w-9 h-9 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center text-indigo-600 dark:text-indigo-300 shrink-0">
            <Sparkles size={18} aria-hidden />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              {t('register_report.ai_title')}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {t('register_report.ai_subtitle')}
            </p>
          </div>
        </div>
        <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
          {t('register_report.prompt_label')}
        </label>
        <BaseTextarea
          hideLabel label="AI prompt"
          rows={4}
          value={aiPrompt}
          onChange={e => setAiPrompt(e.target.value)}
          placeholder={t('register_report.prompt_placeholder')}
          className="mb-2"
        />
        <div className="flex flex-wrap gap-2 mb-3">
          {AI_REPORT_EXAMPLES.map(ex => (
            <button
              key={ex}
              type="button"
              className="text-[10px] px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-indigo-50 hover:text-indigo-700 dark:hover:bg-indigo-900/30 dark:hover:text-indigo-300 transition-colors"
              onClick={() => setAiPrompt(ex)}
            >
              {ex}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-slate-400 mb-3">{t('register_report.filters_hint')}</p>
        <BaseButton variant="primary" onClick={generateAiReport} loading={aiLoading || aiBusy} loadingLabel={t('register_report.generating')} icon={!aiLoading && !aiBusy ? <Sparkles size={14} /> : undefined}>
          {t('register_report.generate')}
        </BaseButton>
        {aiError && <p className="text-sm text-red-600 mt-3">{aiError}</p>}
        {aiFailed && aiJob?.error_message && (
          <p className="text-sm text-red-600 mt-3">{aiJob.error_message}</p>
        )}
        {aiReady && aiJob?.downloads && (
          <div className="mt-4 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
            <p className="text-[10px] font-semibold uppercase text-amber-800 dark:text-amber-300 mb-2">
              AI draft — verify before circulation
            </p>
            <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-200">
              {aiJob.title || t('register_report.ready')}
            </p>
            {aiJob.subtitle && (
              <p className="text-xs text-emerald-800/80 dark:text-emerald-300/80 mt-1">{aiJob.subtitle}</p>
            )}
            <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-1">
              {t('register_report.row_count', { count: aiJob.row_count ?? 0 })}
            </p>
            <div className="flex flex-wrap gap-2 mt-3">
              <BaseButton variant="outline" size="sm" icon={<Download size={14} />} onClick={() => downloadAiReport(aiJob.downloads.html, 'decision_register_report.html')}>
                {t('register_report.download_html')}
              </BaseButton>
            </div>
          </div>
        )}
      </div>

      <div className="card p-4 mb-4 flex flex-wrap gap-3 items-end">
        <BaseInput hideLabel label="From" type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
        <BaseInput hideLabel label="To" type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
        <BaseSelect hideLabel label="Status" placeholder="All" value={rStatus} options={Object.entries(STATUS_META).map(([k, v]) => ({ value: k, label: v.label }))} onChange={(_, v) => setRStatus(v)} className="min-w-36" />
        <BaseSelect hideLabel label="Manager" placeholder="All" value={rManagerId ? String(rManagerId) : ''} options={managers.map(m => ({ value: String(m.id), label: m.username }))} onChange={(_, v) => setRManagerId(v)} className="min-w-36" />
        <BaseButton variant="primary" onClick={() => fetchReport('json')} loading={loading} loadingLabel="Generating" icon={!loading ? <FileText size={14} /> : undefined}>Generate</BaseButton>
        <BaseButton variant="outline" onClick={() => fetchReport('csv')} icon={<Download size={14} />}>CSV</BaseButton>
      </div>

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      {rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60">
                <th className="px-3 py-2.5 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Dec. No.</th>
                <th className="px-3 py-2.5 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Agenda Item</th>
                <th className="px-3 py-2.5 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Meeting No.</th>
                <th className="px-3 py-2.5 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Decision</th>
                <th className="px-3 py-2.5 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Action Unit</th>
                <th className="px-3 py-2.5 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Manager Responsible</th>
                <th className="px-3 py-2.5 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Current Status</th>
                <th className="px-3 py-2.5 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Way Forward</th>
                <th className="px-3 py-2.5 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Task Status</th>
                <th className="px-3 py-2.5 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Due</th>
                <th className="px-3 py-2.5 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Overdue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
              {rows.map(r => (
                <tr key={r.task_id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 align-top">
                  <td className="px-3 py-2.5 font-mono text-xs font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">{r.decision_number || '—'}</td>
                  <td className="px-3 py-2.5">
                    <p className="text-xs font-medium text-slate-800 dark:text-slate-200">{r.title}</p>
                    {r.submission_ref && (
                      <Link to={`/submissions/${r.submission_ref}`} className="text-[10px] font-mono text-primary-600 dark:text-primary-400 hover:underline">{r.submission_ref}</Link>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-slate-500 whitespace-nowrap">{r.meeting_ref || '—'}</td>
                  <td className="px-3 py-2.5">
                    {r.decision_outcome
                      ? <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">{r.decision_outcome}</span>
                      : <span className="text-slate-300 text-xs">—</span>}
                    {r.decision_detail && <p className="text-[10px] text-slate-400 mt-1 line-clamp-2">{r.decision_detail}</p>}
                  </td>
                  <td className="px-3 py-2.5">
                    {r.action_unit ? (
                      <span className="inline-flex items-center rounded px-2 py-0.5 text-[10px] font-bold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300">{r.action_unit}</span>
                    ) : <span className="text-slate-400 text-xs">—</span>}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-slate-600 dark:text-slate-400">{r.manager}</td>
                  <td className="px-3 py-2.5">
                    {r.implementation_status
                      ? <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300">{r.implementation_status}</span>
                      : <span className="text-slate-300 text-xs">—</span>}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-slate-500 max-w-[160px]">
                    <p className="line-clamp-2">{r.way_forward || '—'}</p>
                  </td>
                  <td className="px-3 py-2.5"><StatusBadge status={r.status} /></td>
                  <td className="px-3 py-2.5 text-xs text-slate-500 whitespace-nowrap">{r.due_date ? new Date(r.due_date).toLocaleDateString() : '—'}</td>
                  <td className="px-3 py-2.5 text-xs">{r.days_overdue > 0 ? <span className="text-red-600 font-semibold">{r.days_overdue}d</span> : <span className="text-slate-400">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {!loading && rows.length === 0 && !error && (
        <div className="text-center py-16 text-slate-500 text-sm">
          <FileText size={28} className="mx-auto mb-2 opacity-40" />
          Apply filters and click Generate to build the report.
        </div>
      )}
    </div>
  )
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function TaskManagement() {
  const { user } = useAuth()
  const [tab, setTab] = useState('tasks')
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [canAllocate, setCanAllocate] = useState(false)
  const [canPickStaff, setCanPickStaff] = useState(false)
  const [submissions, setSubmissions] = useState([])
  const [managers, setManagers] = useState([])
  const [staffList, setStaffList] = useState([])
  const [createOpen, setCreateOpen] = useState(false)
  const [editTask, setEditTask] = useState(null)

  const fetchTasks = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/commission-tasks/')
      setTasks(Array.isArray(res.data) ? res.data : res.data?.results ?? [])
    } catch { setTasks([]) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchTasks() }, [fetchTasks])

  useEffect(() => {
    api.get('/commission-tasks/eligible-managers/').then(() => setCanAllocate(true)).catch(() => setCanAllocate(false))
    api.get('/commission-tasks/eligible-staff/').then(() => setCanPickStaff(true)).catch(() => setCanPickStaff(false))
  }, [])

  const loadCreateLookups = useCallback(async () => {
    try {
      const [subRes, mgrRes] = await Promise.all([api.get('/submissions/?page_size=500'), api.get('/commission-tasks/eligible-managers/')])
      setSubmissions(Array.isArray(subRes.data) ? subRes.data : subRes.data?.results ?? [])
      setManagers(Array.isArray(mgrRes.data) ? mgrRes.data : [])
    } catch { setSubmissions([]); setManagers([]) }
  }, [])

  const loadStaff = useCallback(async () => {
    try { const res = await api.get('/commission-tasks/eligible-staff/'); setStaffList(Array.isArray(res.data) ? res.data : []) }
    catch { setStaffList([]) }
  }, [])

  useEffect(() => { if (createOpen && canAllocate) loadCreateLookups() }, [createOpen, canAllocate, loadCreateLookups])
  useEffect(() => { if (editTask && (canPickStaff || canAllocate)) loadStaff() }, [editTask, canPickStaff, canAllocate, loadStaff])

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    return tasks.filter(t => {
      const matchQ = !s || t.title.toLowerCase().includes(s) || (t.submission_reference_number || '').toLowerCase().includes(s) || (t.submission_title || '').toLowerCase().includes(s) || (t.meeting_reference || '').toLowerCase().includes(s) || (t.minute_reference || '').toLowerCase().includes(s) || (t.success_criteria || '').toLowerCase().includes(s) || (t.legal_reference || '').toLowerCase().includes(s) || decisionTypeLabel(t.decision_type || '').toLowerCase().includes(s)
      const matchSt = !statusFilter || t.status === statusFilter
      return matchQ && matchSt
    })
  }, [tasks, q, statusFilter])

  const submissionChoices = useMemo(() => submissions.filter(sub => TASK_LINK_STAGES.has(sub.current_stage)), [submissions])

  const isCoordinatorEdit = canAllocate && editTask
  const isManagerEdit = editTask && canPickStaff && editTask.assigned_manager_username === user?.username
  const isStaffOnTask = editTask && (
    editTask.assigned_staff_username === user?.username
    || editTask.assigned_staff_m2m?.includes(user?.id)
  ) && editTask.assigned_manager_username !== user?.username

  const canEditTask = (t) => {
    if (t.status === 'cancelled') return false
    if (canAllocate) return true
    if (canPickStaff && t.assigned_manager_username === user?.username) return true
    if (t.assigned_staff_username === user?.username || t.assigned_staff_m2m?.includes(user?.id)) {
      return true
    }
    return userHasCommissionDecisionView(user) && userCanWorkCommissionTask(user, t)
  }

  const isViewOnlyRow = (t) => userHasCommissionDecisionView(user) && !canEditTask(t)

  return (
    <div className="p-6">
      <PageHeader
        title="Commission Decision Register"
        subtitle="PS Commission Implementation Tracker — decision outcomes, action units, and implementation progress."
        action={
          canAllocate ? (
            <BaseButton variant="primary" icon={<Plus size={16} />} onClick={() => setCreateOpen(true)}>Allocate task</BaseButton>
          ) : null
        }
      />

      {/* Tab Switcher */}
      <div className="flex items-center gap-1 mb-4 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl w-fit">
        {[
          { key: 'tasks', label: 'Tasks', icon: ListChecks },
          { key: 'report', label: 'Report', icon: FileText },
        ].map(t => (
          <BaseButton
            key={t.key}
            variant={tab === t.key ? 'outline' : 'ghost'}
            size="sm"
            icon={<t.icon size={14} />}
            onClick={() => setTab(t.key)}
            className={tab === t.key ? '!bg-white dark:!bg-slate-700 !shadow-sm' : ''}
          >
            {t.label}
          </BaseButton>
        ))}
      </div>

      {tab === 'report' ? (
        <ReportView />
      ) : (
        <>
          <div className="card p-4 mb-4 flex flex-col sm:flex-row gap-3">
            <BaseInput
              hideLabel label="Search"
              className="flex-1"
              placeholder="Search title or submission reference..."
              value={q}
              onChange={e => setQ(e.target.value)}
              contentBefore={<Search size={14} className="text-slate-400" />}
            />
            <BaseSelect
              hideLabel label="Status"
              className="sm:w-44"
              placeholder="All statuses"
              value={statusFilter}
              options={Object.keys(STATUS_META).map(st => ({ value: st, label: STATUS_META[st].label }))}
              onChange={(_, v) => setStatusFilter(v)}
            />
            <BaseButton variant="outline" onClick={fetchTasks} disabled={loading} icon={<RefreshCw size={14} className={loading ? 'animate-spin' : ''} />}>
              Refresh
            </BaseButton>
          </div>

          <div className="card overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-16 text-slate-500 text-sm"><Loader size={18} className="animate-spin" /> Loading...</div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-16 text-slate-500 text-sm"><ClipboardList size={28} className="mx-auto mb-2 opacity-40" />No records match your filters.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60">
                      <th className="px-3 py-2.5 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap w-24">Dec. No.</th>
                      <th className="px-3 py-2.5 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider min-w-[180px]">Agenda Item</th>
                      <th className="px-3 py-2.5 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap w-32">Meeting No.</th>
                      <th className="px-3 py-2.5 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider min-w-[200px]">Decision Detail</th>
                      <th className="px-3 py-2.5 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider w-36">Decision</th>
                      <th className="px-3 py-2.5 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider w-28">Action Unit</th>
                      <th className="px-3 py-2.5 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider w-28">Manager Responsible</th>
                      <th className="px-3 py-2.5 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider w-36">Current Status</th>
                      <th className="px-3 py-2.5 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider min-w-[160px]">Way Forward</th>
                      <th className="px-3 py-2.5 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider w-20">Task Status</th>
                      <th className="px-3 py-2.5 w-16 sr-only">Edit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                    {filtered.map(t => (
                      <tr key={t.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors align-top">

                        {/* Dec. No. */}
                        <td className="px-3 py-3">
                          <span className="font-mono text-xs font-semibold text-slate-700 dark:text-slate-300">
                            {t.decision_number || <span className="text-slate-300 dark:text-slate-600">—</span>}
                          </span>
                        </td>

                        {/* Agenda Item */}
                        <td className="px-3 py-3">
                          <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 leading-snug">{t.title}</p>
                          {t.submission ? (
                            <Link to={`/submissions/${t.submission}`} className="text-[10px] font-mono text-primary-600 dark:text-primary-400 hover:underline mt-0.5 block">
                              {t.submission_reference_number}
                            </Link>
                          ) : null}
                        </td>

                        {/* Meeting No. */}
                        <td className="px-3 py-3">
                          <span className="text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap">
                            {t.meeting_reference || t.meeting_title || <span className="text-slate-300 dark:text-slate-600">—</span>}
                          </span>
                          {t.meeting_date && (
                            <p className="text-[10px] text-slate-400 mt-0.5 whitespace-nowrap">
                              {new Date(t.meeting_date).toLocaleDateString()}
                            </p>
                          )}
                        </td>

                        {/* Decision Detail */}
                        <td className="px-3 py-3">
                          {t.decision_detail ? (
                            <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-3 leading-relaxed">
                              {t.decision_detail}
                            </p>
                          ) : <span className="text-slate-300 dark:text-slate-600 text-xs">—</span>}
                        </td>

                        {/* Decision (outcome) */}
                        <td className="px-3 py-3">
                          <DecisionOutcomeBadge value={t.decision_outcome} />
                          {!t.decision_outcome && <span className="text-slate-300 dark:text-slate-600 text-xs">—</span>}
                        </td>

                        {/* Action Unit */}
                        <td className="px-3 py-3">
                          {t.action_unit ? (
                            <span className="inline-flex items-center rounded px-2 py-0.5 text-[10px] font-bold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 tracking-wide">
                              {t.action_unit}
                            </span>
                          ) : <span className="text-slate-300 dark:text-slate-600 text-xs">—</span>}
                        </td>

                        {/* Manager Responsible */}
                        <td className="px-3 py-3">
                          <span className="inline-flex items-center gap-1 text-xs text-slate-600 dark:text-slate-400">
                            <User size={11} className="shrink-0" />
                            {t.assigned_manager_username}
                          </span>
                          {t.assigned_staff_m2m?.length > 0 && (
                            <span className="block text-[10px] text-slate-400 mt-0.5">
                              <Users size={10} className="inline mr-0.5" />{t.assigned_staff_m2m.length} staff
                            </span>
                          )}
                        </td>

                        {/* Current Status (implementation_status) */}
                        <td className="px-3 py-3">
                          <ImplStatusBadge value={t.implementation_status} />
                        </td>

                        {/* Way Forward */}
                        <td className="px-3 py-3">
                          {t.way_forward ? (
                            <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-3 leading-relaxed">
                              {t.way_forward}
                            </p>
                          ) : <span className="text-slate-300 dark:text-slate-600 text-xs">—</span>}
                        </td>

                        {/* Task Status */}
                        <td className="px-3 py-3">
                          <StatusBadge status={t.status} />
                        </td>

                        {/* Edit */}
                        <td className="px-3 py-3 text-right">
                          {canEditTask(t) ? (
                            <BaseButton variant="ghost" size="sm" onClick={() => setEditTask(t)}>Edit</BaseButton>
                          ) : isViewOnlyRow(t) ? (
                            <BaseButton variant="ghost" size="sm" onClick={() => setEditTask(t)}>View</BaseButton>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {createOpen && canAllocate && (
        <CreateTaskModal submissionChoices={submissionChoices} managers={managers} onClose={() => setCreateOpen(false)} onSaved={() => { setCreateOpen(false); fetchTasks() }} />
      )}

      {editTask && (
        <EditTaskModal
          key={editTask.id}
          task={editTask}
          staffList={staffList}
          readOnly={!canEditTask(editTask)}
          mode={isCoordinatorEdit ? 'coordinator' : isManagerEdit ? 'manager' : isStaffOnTask ? 'staff' : canAllocate ? 'coordinator' : 'manager'}
          onClose={() => setEditTask(null)}
          onSaved={() => { setEditTask(null); fetchTasks() }}
        />
      )}
    </div>
  )
}

// ── Create Task Modal ────────────────────────────────────────────────────────

function CreateTaskModal({ submissionChoices, managers, onClose, onSaved }) {
  const toast = useToast()
  const [submissionId, setSubmissionId] = useState('')
  const [managerId, setManagerId] = useState('')
  // Decision Register fields
  const [decisionNumber, setDecisionNumber] = useState('')
  const [decisionOutcome, setDecisionOutcome] = useState('')
  const [actionUnit, setActionUnit] = useState('')
  const [implementationStatus, setImplementationStatus] = useState('with_unit')
  const [wayForward, setWayForward] = useState('')
  const [decisionDetail, setDecisionDetail] = useState('')
  // Task fields
  const [meetingReference, setMeetingReference] = useState('')
  const [meetingDate, setMeetingDate] = useState('')
  const [minuteReference, setMinuteReference] = useState('')
  const [decisionType, setDecisionType] = useState('')
  const [successCriteria, setSuccessCriteria] = useState('')
  const [legalReference, setLegalReference] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  // Pending decisions from signed minutes that auto-allocation could not place
  const [pendingDecisions, setPendingDecisions] = useState([])
  const [pendingId, setPendingId] = useState('')
  const [agendaItemId, setAgendaItemId] = useState(null)
  const [extraSubmission, setExtraSubmission] = useState(null)

  useEffect(() => {
    api.get('/commission-tasks/unallocated-decisions/')
      .then(r => setPendingDecisions(Array.isArray(r.data) ? r.data : []))
      .catch(() => setPendingDecisions([]))
  }, [])

  const applyPendingDecision = id => {
    setPendingId(id)
    const p = pendingDecisions.find(x => String(x.agenda_item) === String(id))
    if (!p) { setAgendaItemId(null); setExtraSubmission(null); return }
    setAgendaItemId(p.agenda_item)
    setTitle(p.suggested_task_title || '')
    setDescription(p.description || '')
    setDecisionDetail(p.decision_detail || '')
    setDecisionOutcome(p.decision_outcome || '')
    setActionUnit(p.action_unit || '')
    setMeetingReference(p.meeting_reference || '')
    setMeetingDate(p.meeting_date || '')
    setMinuteReference(p.minute_reference || '')
    if (p.submission) {
      setSubmissionId(String(p.submission))
      // The submission may not be in the post-decision-stage choices yet
      setExtraSubmission(
        submissionChoices.some(s => s.id === p.submission)
          ? null
          : { id: p.submission, reference_number: p.submission_reference, title: p.item_title }
      )
    }
  }

  const submissionOptions = extraSubmission ? [...submissionChoices, extraSubmission] : submissionChoices

  const submit = async e => {
    e.preventDefault(); setErr('')
    if (!managerId || !title.trim()) { setErr('Manager and title are required.'); return }
    setSaving(true)
    try {
      await api.post('/commission-tasks/', {
        submission: submissionId ? Number(submissionId) : null,
        agenda_item: agendaItemId,
        assigned_manager: Number(managerId),
        title: title.trim(),
        description,
        // Decision Register
        decision_number: decisionNumber.trim(),
        decision_outcome: decisionOutcome || '',
        action_unit: actionUnit || '',
        implementation_status: implementationStatus || 'with_unit',
        way_forward: wayForward.trim(),
        decision_detail: decisionDetail.trim(),
        // Context
        meeting_reference: meetingReference.trim(),
        meeting_date: meetingDate || null,
        minute_reference: minuteReference.trim(),
        decision_type: decisionType || '',
        success_criteria: successCriteria.trim(),
        legal_reference: legalReference.trim(),
        due_date: dueDate || null,
        status: 'open',
      })
      toast.success('Task created.')
      onSaved()
    } catch (ex) {
      const d = ex.response?.data
      setErr(typeof d?.detail === 'string' ? d.detail : d ? JSON.stringify(d) : 'Could not create task.')
    } finally { setSaving(false) }
  }

  return (
    <Modal
      open
      title="Allocate commission task"
      subtitle="Record a decision and assign an OPSC Manager to action it."
      onClose={onClose}
      size="lg"
    >
      <form onSubmit={submit} className="space-y-4 max-h-[80vh] overflow-y-auto pr-1">
        {err && <p className="text-sm text-red-600 dark:text-red-400">{err}</p>}

        {pendingDecisions.length > 0 && (
          <div className="p-3 rounded-xl border border-primary-200 dark:border-primary-700 bg-primary-50/50 dark:bg-primary-900/10">
            <BaseSelect
              label={`Prefill from a pending decision (${pendingDecisions.length} awaiting allocation)`}
              placeholder="— Start from scratch —"
              value={pendingId}
              options={pendingDecisions.map(p => ({
                value: String(p.agenda_item),
                label: `${p.meeting_reference} ${p.minute_reference} — ${p.item_title.slice(0, 70)}`,
              }))}
              onChange={(_, v) => applyPendingDecision(v)}
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Decisions in signed minutes that have not been allocated yet. Selecting one fills the form — you only pick the manager.
            </p>
          </div>
        )}

        <DecisionRegisterFields {...{ decisionNumber, setDecisionNumber, decisionOutcome, setDecisionOutcome, actionUnit, setActionUnit, implementationStatus, setImplementationStatus, wayForward, setWayForward, decisionDetail, setDecisionDetail }} />

        <div className="pt-2 border-t border-slate-100 dark:border-slate-700">
          <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-3">Assignment</p>
          <div className="space-y-3">
            <BaseSelect
              label="OPSC Manager"
              required
              placeholder="Select manager..."
              value={managerId ? String(managerId) : ''}
              options={managers.map(m => ({ value: String(m.id), label: m.username }))}
              onChange={(_, v) => setManagerId(v)}
            />
            <div>
              <BaseSelect
                label="Submission (optional)"
                placeholder="— No linked submission —"
                value={submissionId ? String(submissionId) : ''}
                options={submissionOptions.map(s => ({ value: String(s.id), label: `${s.reference_number} — ${s.title.slice(0, 60)}` }))}
                onChange={(_, v) => setSubmissionId(v)}
              />
              <p className="text-[11px] text-slate-400 mt-1">Only post-decision / implementation stage items listed.</p>
            </div>
          </div>
        </div>

        <TaskMetadataFields {...{ meetingReference, setMeetingReference, meetingDate, setMeetingDate, minuteReference, setMinuteReference, decisionType, setDecisionType, successCriteria, setSuccessCriteria, legalReference, setLegalReference }} />

        <div className="pt-2 border-t border-slate-100 dark:border-slate-700 space-y-3">
          <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">Task</p>
          <BaseInput label="Task title" required value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Draft implementation memo" />
          <BaseTextarea label="Description" rows={3} value={description} onChange={e => setDescription(e.target.value)} />
          <BaseInput label="Due date (optional)" type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <BaseButton variant="secondary" onClick={onClose}>Cancel</BaseButton>
          <BaseButton type="submit" variant="primary" loading={saving} loadingLabel="Saving">Create task</BaseButton>
        </div>
      </form>
    </Modal>
  )
}

// ── Edit Task Modal ──────────────────────────────────────────────────────────

function EditTaskModal({ task, staffList, mode, readOnly = false, onClose, onSaved }) {
  const toast = useToast()
  const [title, setTitle] = useState(task.title)
  const [description, setDescription] = useState(task.description || '')
  // Decision Register fields
  const [decisionNumber, setDecisionNumber] = useState(task.decision_number || '')
  const [decisionOutcome, setDecisionOutcome] = useState(task.decision_outcome || '')
  const [actionUnit, setActionUnit] = useState(task.action_unit || '')
  const [implementationStatus, setImplementationStatus] = useState(task.implementation_status || 'with_unit')
  const [wayForward, setWayForward] = useState(task.way_forward || '')
  const [decisionDetail, setDecisionDetail] = useState(task.decision_detail || '')
  // Context fields
  const [meetingReference, setMeetingReference] = useState(task.meeting_reference || '')
  const [meetingDate, setMeetingDate] = useState(task.meeting_date || '')
  const [minuteReference, setMinuteReference] = useState(task.minute_reference || '')
  const [decisionType, setDecisionType] = useState(task.decision_type || '')
  const [successCriteria, setSuccessCriteria] = useState(task.success_criteria || '')
  const [legalReference, setLegalReference] = useState(task.legal_reference || '')
  const [dueDate, setDueDate] = useState(task.due_date || '')
  const [status, setStatus] = useState(task.status)
  const [selectedStaff, setSelectedStaff] = useState(task.assigned_staff_m2m || (task.assigned_staff ? [task.assigned_staff] : []))
  const [managerId, setManagerId] = useState(String(task.assigned_manager))
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const [managers, setManagers] = useState([])
  const [subtasks, setSubtasks] = useState(task.subtasks || [])
  const [aiDrafts, setAiDrafts] = useState(task.ai_subtask_drafts || null)
  const [showReassign, setShowReassign] = useState(false)

  useEffect(() => {
    if (mode === 'coordinator') { api.get('/commission-tasks/eligible-managers/').then(r => setManagers(Array.isArray(r.data) ? r.data : [])).catch(() => setManagers([])) }
  }, [mode])

  const refreshSubtasks = useCallback(async () => {
    try { const res = await api.get(`/commission-tasks/${task.id}/subtasks/`); setSubtasks(Array.isArray(res.data) ? res.data : []) } catch { }
  }, [task.id])

  const refreshAiDrafts = useCallback(async () => {
    try {
      const res = await api.get(`/commission-tasks/${task.id}/`)
      setAiDrafts(res.data.ai_subtask_drafts || null)
    } catch { /* ignore */ }
  }, [task.id])

  useEffect(() => {
    const pending = aiDrafts && !aiDrafts.subtasks?.length && !aiDrafts.error
    if (!pending) return undefined
    const t = setInterval(refreshAiDrafts, 4000)
    return () => clearInterval(t)
  }, [aiDrafts, refreshAiDrafts])

  const reassignStaff = async () => {
    if (!selectedStaff.length) return
    setSaving(true); setErr('')
    try {
      await api.post(`/commission-tasks/${task.id}/reassign/`, { assigned_staff_m2m: selectedStaff })
      onSaved()
    } catch (ex) { const d = ex.response?.data; setErr(typeof d?.detail === 'string' ? d.detail : d ? JSON.stringify(d) : 'Reassignment failed.') }
    finally { setSaving(false) }
  }

  const decisionRegisterPayload = () => ({
    decision_number: decisionNumber.trim(),
    decision_outcome: decisionOutcome || '',
    action_unit: actionUnit || '',
    implementation_status: implementationStatus || 'with_unit',
    way_forward: wayForward.trim(),
    decision_detail: decisionDetail.trim(),
  })

  const submit = async e => {
    e.preventDefault()
    if (readOnly) return
    setErr(''); setSaving(true)
    try {
      const payload = {}
      if (mode === 'staff') {
        payload.status = status
      } else if (mode === 'manager') {
        Object.assign(payload, {
          ...decisionRegisterPayload(),
          title: title.trim(), description,
          meeting_reference: meetingReference.trim(), meeting_date: meetingDate || null,
          minute_reference: minuteReference.trim(), decision_type: decisionType || '',
          success_criteria: successCriteria.trim(), legal_reference: legalReference.trim(),
          due_date: dueDate || null, status,
          assigned_staff_m2m: selectedStaff, assigned_staff: selectedStaff[0] || null,
        })
      } else {
        Object.assign(payload, {
          ...decisionRegisterPayload(),
          title: title.trim(), description,
          meeting_reference: meetingReference.trim(), meeting_date: meetingDate || null,
          minute_reference: minuteReference.trim(), decision_type: decisionType || '',
          success_criteria: successCriteria.trim(), legal_reference: legalReference.trim(),
          due_date: dueDate || null, status,
          assigned_manager: Number(managerId),
          assigned_staff_m2m: selectedStaff, assigned_staff: selectedStaff[0] || null,
        })
      }
      await api.patch(`/commission-tasks/${task.id}/`, payload)
      toast.success('Task updated.')
      onSaved()
    } catch (ex) {
      const d = ex.response?.data
      setErr(typeof d?.detail === 'string' ? d.detail : d ? JSON.stringify(d) : 'Update failed.')
    } finally { setSaving(false) }
  }

  return (
    <Modal
      open
      title={readOnly ? 'View task' : 'Update task'}
      subtitle={task.decision_number || task.submission_reference_number || 'Commission Task'}
      onClose={onClose}
      size="lg"
    >
      <form onSubmit={submit} className="space-y-4 max-h-[80vh] overflow-y-auto pr-1">
        <fieldset disabled={readOnly} className="space-y-4 border-0 p-0 m-0 min-w-0">
        {err && <p className="text-sm text-red-600 dark:text-red-400">{err}</p>}

        {mode === 'staff' ? (
          <div className="space-y-3">
            <BaseSelect
              label="Implementation status"
              value={implementationStatus}
              options={IMPL_STATUS_OPTIONS.map(o => ({ value: o.value, label: o.label }))}
              onChange={(_, v) => setImplementationStatus(v)}
            />
            <BaseTextarea label="Way forward / next steps" rows={2} value={wayForward} onChange={e => setWayForward(e.target.value)} />
            <BaseSelect
              label="Task status"
              value={status}
              options={[
                { value: 'open', label: 'Open' },
                { value: 'in_progress', label: 'In progress' },
                { value: 'completed', label: 'Completed' },
                { value: 'cancelled', label: 'Cancelled' },
              ]}
              onChange={(_, v) => setStatus(v)}
            />
          </div>
        ) : (
          <>
            {mode === 'coordinator' && (
              <BaseSelect
                label="OPSC Manager"
                value={managerId ? String(managerId) : ''}
                options={[
                  ...(!managers.some(m => String(m.id) === managerId) ? [{ value: String(managerId), label: task.assigned_manager_username }] : []),
                  ...managers.map(m => ({ value: String(m.id), label: m.username })),
                ]}
                onChange={(_, v) => setManagerId(v)}
              />
            )}

            <DecisionRegisterFields {...{ decisionNumber, setDecisionNumber, decisionOutcome, setDecisionOutcome, actionUnit, setActionUnit, implementationStatus, setImplementationStatus, wayForward, setWayForward, decisionDetail, setDecisionDetail }} />

            <TaskMetadataFields {...{ meetingReference, setMeetingReference, meetingDate, setMeetingDate, minuteReference, setMinuteReference, decisionType, setDecisionType, successCriteria, setSuccessCriteria, legalReference, setLegalReference }} />

            <BaseInput label="Title" value={title} onChange={e => setTitle(e.target.value)} />
            <BaseTextarea label="Description" rows={3} value={description} onChange={e => setDescription(e.target.value)} />
            <BaseInput label="Due date" type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />

            {/* Multi-Staff Assignment */}
            <MultiStaffSelect selected={selectedStaff} onChange={setSelectedStaff} staffList={staffList} label="Assign staff (one or more)" />

            {/* Reassign Button (for managers) */}
            {mode === 'manager' && selectedStaff.length > 0 && (
              <BaseButton variant="outline" size="sm" icon={<Users size={12} />} onClick={reassignStaff} disabled={saving}>
                Reassign to {selectedStaff.length} staff
              </BaseButton>
            )}

            <BaseSelect
              label="Status"
              value={status}
              options={[
                { value: 'open', label: 'Open' },
                { value: 'in_progress', label: 'In progress' },
                { value: 'completed', label: 'Completed' },
                { value: 'cancelled', label: 'Cancelled' },
              ]}
              onChange={(_, v) => setStatus(v)}
            />
          </>
        )}

        <TaskStatusUpdatesSection taskId={task.id} />

        {/* Subtask Section (for managers and coordinators) */}
        {mode !== 'staff' && !readOnly && (
          <SubtaskSection
            taskId={task.id}
            subtasks={subtasks}
            aiDrafts={aiDrafts}
            onRefresh={refreshSubtasks}
            onDraftRefresh={refreshAiDrafts}
          />
        )}

        {/* Decision letter workflow: prepare → Secretary signs → notify HR for pickup */}
        {task?.id && <DecisionLetterPanel task={task} />}

        </fieldset>

        <div className="flex justify-end gap-2 pt-2">
          <BaseButton variant="secondary" onClick={onClose}>{readOnly ? 'Close' : 'Cancel'}</BaseButton>
          {!readOnly && (
            <BaseButton type="submit" variant="primary" loading={saving} loadingLabel="Saving">Save</BaseButton>
          )}
        </div>
      </form>
    </Modal>
  )
}
