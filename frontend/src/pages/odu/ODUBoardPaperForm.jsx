/**
 * ODUBoardPaperForm.jsx
 *
 * The PSC Board Submission Paper ODU prepares after its checklist review and
 * assessment. This — not the ministry's original PSC 2-1 request — is what
 * the Commission actually receives and votes on.
 *
 * Approval chain: an ODU Principal drafts and submits it to the Manager ODU
 * (or the Manager drafts it directly, skipping that step); the Manager
 * approves it; the Secretary gives final sign-off.
 *
 * Props:
 *   submissionId  – numeric ID of the parent Submission
 *   submission    – the submission object (for stage/role gating)
 */

import { useEffect, useState, useCallback, useRef } from 'react'
import { FileSignature, Save, Send, ThumbsUp, CheckCircle2, Plus, Trash2, Sparkles, Paperclip, Download } from 'lucide-react'
import api from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import {
  userIsOduPrincipalWorker, userIsBoardPaperSecretary, submissionInBoardPaperEditPhase,
} from '../../utils/oduChecklist'

const STATUS_LABELS = {
  draft: 'Draft',
  submitted: 'Submitted to Manager ODU',
  manager_approved: 'Approved by Manager — Pending Secretary',
  secretary_approved: 'Approved by Secretary',
}

const STATUS_STYLES = {
  draft: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
  submitted: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  manager_approved: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  secretary_approved: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
}

function StatusBadge({ status }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${STATUS_STYLES[status] || STATUS_STYLES.draft}`}>
      {STATUS_LABELS[status] || status}
    </span>
  )
}

function fmtDateTime(v) {
  if (!v) return null
  return new Date(v).toLocaleDateString('en-VU', { day: '2-digit', month: 'short', year: 'numeric' })
}

function Field({ label, children, span }) {
  return (
    <div className={span ? 'sm:col-span-2' : ''}>
      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{label}</label>
      {children}
    </div>
  )
}

function ReadField({ label, value, span, placeholder = '—' }) {
  return (
    <div className={span ? 'sm:col-span-2' : ''}>
      <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-0.5">{label}</p>
      <p className="text-sm font-medium text-slate-800 dark:text-slate-100 whitespace-pre-wrap break-words">
        {value || <span className="text-slate-500 dark:text-slate-400 font-normal italic">{placeholder}</span>}
      </p>
    </div>
  )
}

function SectionHeader({ title }) {
  return (
    <div className="mt-6 mb-3 pb-1 border-b border-slate-200 dark:border-slate-700">
      <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{title}</h3>
    </div>
  )
}

const EMPTY_ROW = {
  current_post_no: '', current_title: '', current_level: '', current_salary: '',
  proposed_post_no: '', proposed_title: '', proposed_level: '', proposed_salary: '',
  salary_difference: '',
}

const COSTING_COLUMNS = [
  ['current_post_no', 'Current Post No'],
  ['current_title', 'Current Title / Occupant'],
  ['current_level', 'Current Level'],
  ['current_salary', 'Current Salary (VT)'],
  ['proposed_post_no', 'Proposed Post No'],
  ['proposed_title', 'Proposed Title'],
  ['proposed_level', 'Proposed Level'],
  ['proposed_salary', 'Proposed Salary (VT)'],
  ['salary_difference', 'Salary Difference (VT)'],
]

function CostingTable({ rows, onChange, readOnly }) {
  const set = (idx, key, value) => {
    const next = rows.map((r, i) => (i === idx ? { ...r, [key]: value } : r))
    onChange(next)
  }
  const addRow = () => onChange([...rows, { ...EMPTY_ROW }])
  const removeRow = (idx) => onChange(rows.filter((_, i) => i !== idx))

  if (readOnly) {
    if (!rows.length) {
      return <p className="text-sm text-slate-500 dark:text-slate-400 italic">No costing rows entered.</p>
    }
    return (
      <div className="overflow-x-auto">
        <table className="min-w-full text-xs border border-slate-200 dark:border-slate-700">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-800/60">
              {COSTING_COLUMNS.map(([key, label]) => (
                <th key={key} className="px-2 py-1.5 text-left font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">{label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={idx} className="border-b border-slate-100 dark:border-slate-700/60">
                {COSTING_COLUMNS.map(([key]) => (
                  <td key={key} className="px-2 py-1.5 text-slate-700 dark:text-slate-300 whitespace-nowrap">{row[key] || '—'}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto">
        <table className="min-w-full text-xs border border-slate-200 dark:border-slate-700">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-800/60">
              {COSTING_COLUMNS.map(([key, label]) => (
                <th key={key} className="px-2 py-1.5 text-left font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">{label}</th>
              ))}
              <th className="border-b border-slate-200 dark:border-slate-700" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={idx} className="border-b border-slate-100 dark:border-slate-700/60">
                {COSTING_COLUMNS.map(([key]) => (
                  <td key={key} className="px-1 py-1">
                    <input
                      className="input text-xs py-1 px-1.5 min-w-[90px]"
                      value={row[key] || ''}
                      onChange={e => set(idx, key, e.target.value)}
                    />
                  </td>
                ))}
                <td className="px-1 py-1">
                  <button type="button" onClick={() => removeRow(idx)} className="text-slate-400 hover:text-red-500 transition-colors">
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button
        type="button"
        onClick={addRow}
        className="inline-flex items-center gap-1 text-xs font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400"
      >
        <Plus size={13} /> Add position row
      </button>
    </div>
  )
}

// Meeting/item number, "Submitted By", and "submitted to PSCB" aren't part
// of the editable form any more — they're read-only, computed server-side
// (meeting_reference/agenda_item_number on the fetched `paper`; "Submitted
// By" and "submitted to PSCB" reuse the existing secretary_approved_by_name/
// submitted_for_review_at approval-chain fields), since there's nothing
// correct for the drafter to type here before any of those have happened.
const EMPTY_FORM = {
  action_officer: '', psc_file: '', prepared_by: '',
  date_submitted_to_psc_by_ministry: '',
  subject: '', background: '', issues: '', discussions: '', odu_assessment: '',
  dsspac_summary: '', grt_summary: '', finance_summary: '',
  costing_rows: [], costing_notes: '',
}

const AI_FIELD_LABELS = {
  subject: 'Subject', background: 'Background', issues: 'Issues', discussions: 'Discussions',
  odu_assessment: 'ODU Assessment', dsspac_summary: 'DSSPAC summary', grt_summary: 'GRT summary',
  finance_summary: 'Finance summary',
}

/** One analysis: the attached file (ODU uploads it) and ODU's summary of it for the paper. */
function AnalysisBlock({ item, summary, onSummary, readOnly, canUpload, onUpload, uploading, onDownload }) {
  const inputRef = useRef(null)
  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{item.label} analysis</p>
        <div className="flex items-center gap-2 text-xs">
          {item.document_id ? (
            <button type="button" onClick={() => onDownload(item)} className="inline-flex items-center gap-1 text-primary-600 hover:text-primary-700 dark:text-primary-400">
              <Download size={12} /> {item.file_name}
            </button>
          ) : (
            <span className="text-amber-700 dark:text-amber-400">Not attached yet</span>
          )}
          {canUpload && (
            <>
              <input ref={inputRef} type="file" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) onUpload(item, f); e.target.value = '' }} />
              <button type="button" disabled={uploading} onClick={() => inputRef.current?.click()} className="btn-outline inline-flex items-center gap-1 py-1 px-2 text-xs">
                <Paperclip size={12} /> {uploading ? 'Uploading…' : (item.document_id ? 'Replace' : 'Attach')}
              </button>
            </>
          )}
        </div>
      </div>
      {readOnly ? (
        <ReadField label={`Summary of the ${item.label} analysis`} value={summary} span />
      ) : (
        <Field label={`Summary of the ${item.label} analysis (goes into the paper)`}>
          <textarea className="input min-h-[90px]" value={summary} onChange={e => onSummary(e.target.value)} />
        </Field>
      )}
    </div>
  )
}

export default function ODUBoardPaperForm({ submissionId, submission, onDirtyChange }) {
  const { user } = useAuth()
  const toast = useToast()

  const [paper, setPaper] = useState(undefined) // undefined = loading
  const [loadMessage, setLoadMessage] = useState('')
  const [form, setForm] = useState(EMPTY_FORM)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [managerApproving, setManagerApproving] = useState(false)
  const [secretaryApproving, setSecretaryApproving] = useState(false)
  const [uploadingKey, setUploadingKey] = useState('')
  const [aiBusy, setAiBusy] = useState(false)

  const isOduPrincipal = userIsOduPrincipalWorker(user?.role)
  const isOduManager = user?.role === 'odu_manager'
  const isSecretary = userIsBoardPaperSecretary(user?.role)
  const inEditWindow = submissionInBoardPaperEditPhase(submission)
  const status = paper?.status || 'draft'

  const canEdit = inEditWindow && (
    (status === 'draft' && (isOduPrincipal || isOduManager))
    || (status === 'submitted' && isOduManager)
  )
  const readOnly = !canEdit
  const canSubmit = inEditWindow && isOduPrincipal && status === 'draft'
  const canManagerApprove = inEditWindow && isOduManager && (status === 'draft' || status === 'submitted')
  // Not gated to the ODU edit window — by the time it's Manager Approved the
  // submission may already have moved past ODU's own stages to the Secretary.
  const canSecretaryApprove = isSecretary && status === 'manager_approved'

  const populateForm = useCallback((data) => {
    const filled = { ...EMPTY_FORM }
    Object.keys(EMPTY_FORM).forEach(k => {
      if (data[k] !== undefined && data[k] !== null) filled[k] = data[k]
    })
    setForm(filled)
    setDirty(false)
  }, [])

  useEffect(() => { onDirtyChange?.(dirty) }, [dirty, onDirtyChange])
  // Unmounting (e.g. navigating away) counts as exiting too — clear the flag
  // on the parent so it doesn't linger past this form's lifetime.
  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange])

  const fetchPaper = useCallback(async () => {
    if (!submissionId) return
    setPaper(undefined)
    setLoadMessage('')
    try {
      const r = await api.get(`/odu-board-papers/ensure/?submission=${submissionId}`)
      setPaper(r.data)
      populateForm(r.data)
    } catch (err) {
      const s = err.response?.status
      const detail = err.response?.data?.detail
      setPaper(null)
      if (s === 404) {
        setLoadMessage(typeof detail === 'string' ? detail : 'The Commission paper has not been started for this submission.')
      } else if (s === 400) {
        setLoadMessage(typeof detail === 'string' ? detail : 'The Commission paper is not available for this submission.')
      } else {
        setLoadMessage('Unable to load the Commission paper.')
      }
    }
  }, [submissionId, populateForm])

  useEffect(() => { fetchPaper() }, [fetchPaper])

  const set = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }))
    setDirty(true)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const payload = {
        submission: submissionId,
        ...form,
        date_submitted_to_psc_by_ministry: form.date_submitted_to_psc_by_ministry || null,
      }
      let r
      if (paper?.id) {
        r = await api.patch(`/odu-board-papers/${paper.id}/`, payload)
      } else {
        r = await api.post('/odu-board-papers/', payload)
      }
      setPaper(r.data)
      setDirty(false)
      toast.success('Commission paper saved.')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save Commission paper.')
    } finally {
      setSaving(false)
    }
  }

  const handleSubmit = async () => {
    if (!paper?.id) return
    setSubmitting(true)
    try {
      const r = await api.post(`/odu-board-papers/${paper.id}/submit/`)
      setPaper(r.data)
      toast.success('Commission paper submitted to Manager ODU.')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to submit Commission paper.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleManagerApprove = async () => {
    if (!paper?.id) return
    setManagerApproving(true)
    try {
      const r = await api.post(`/odu-board-papers/${paper.id}/manager-approve/`)
      setPaper(r.data)
      toast.success('Commission paper approved — ready for Secretary sign-off.')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to approve Commission paper.')
    } finally {
      setManagerApproving(false)
    }
  }

  const handleSecretaryApprove = async () => {
    if (!paper?.id) return
    setSecretaryApproving(true)
    try {
      const r = await api.post(`/odu-board-papers/${paper.id}/secretary-approve/`)
      setPaper(r.data)
      toast.success('Commission paper approved by Secretary.')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to approve Commission paper.')
    } finally {
      setSecretaryApproving(false)
    }
  }

  // While the AI is drafting, check back until it finishes.
  useEffect(() => {
    if (paper?.ai_draft_state !== 'running' || !paper?.id) return undefined
    const t = setInterval(async () => {
      try {
        const r = await api.get(`/odu-board-papers/${paper.id}/`)
        setPaper(prev => ({ ...prev, ...r.data }))
      } catch { /* try again on the next tick */ }
    }, 4000)
    return () => clearInterval(t)
  }, [paper?.ai_draft_state, paper?.id])

  const handleAiDraft = async () => {
    if (!paper?.id) return
    setAiBusy(true)
    try {
      const r = await api.post(`/odu-board-papers/${paper.id}/ai-draft/`)
      setPaper(prev => ({ ...prev, ...r.data }))
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Could not start the AI draft.')
    } finally {
      setAiBusy(false)
    }
  }

  const useSuggestion = (field) => {
    const text = paper?.ai_draft?.[field]
    if (text) set(field, text)
  }
  const useAllSuggestions = () => {
    const d = paper?.ai_draft || {}
    setForm(prev => {
      const next = { ...prev }
      Object.keys(AI_FIELD_LABELS).forEach(k => { if (d[k]) next[k] = d[k] })
      return next
    })
    setDirty(true)
  }
  const useMinistryCosting = () => {
    const rows = paper?.ai_draft?.costing_rows || []
    if (rows.length) set('costing_rows', rows.map(r => ({ ...EMPTY_ROW, ...r })))
  }

  const handleUploadAnalysis = async (item, file) => {
    if (!paper?.id) return
    setUploadingKey(item.key)
    try {
      const fd = new FormData()
      fd.append('kind', item.key)
      fd.append('file', file)
      const r = await api.post(`/odu-board-papers/${paper.id}/analysis/`, fd)
      setPaper(prev => ({ ...prev, ...r.data }))
      toast.success(`${item.label} analysis attached.`)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Could not attach the file.')
    } finally {
      setUploadingKey('')
    }
  }

  const handleDownloadAnalysis = async (item) => {
    try {
      const r = await api.get(`/submissions/${submissionId}/documents/${item.document_id}/`, { responseType: 'blob' })
      const url = URL.createObjectURL(r.data)
      const a = document.createElement('a')
      a.href = url
      a.download = item.file_name || 'analysis'
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error('Could not download the file.')
    }
  }

  if (paper === undefined) {
    return (
      <div className="card card-compact">
        <p className="text-sm text-slate-500 dark:text-slate-400 italic py-4 text-center">Loading Commission paper…</p>
      </div>
    )
  }

  if (paper === null) {
    return (
      <div className="card card-compact">
        <div className="flex items-center gap-2 mb-2">
          <FileSignature size={14} className="text-slate-400" />
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">ODU Commission Submission Paper</h3>
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400 italic py-2">{loadMessage}</p>
      </div>
    )
  }

  return (
    <div className="card card-compact">
      <div className="mb-5 pb-3 border-b border-slate-100 dark:border-slate-700">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <FileSignature size={14} className="text-slate-400" />
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">ODU Commission Submission Paper</h3>
            <StatusBadge status={status} />
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {readOnly ? 'This is the paper that was — or will be — presented to the Commission.' : 'This paper, not the ministry’s original request, is what the Commission will receive.'}
          </p>
        </div>
        {(isOduPrincipal || isOduManager) && submission?.assigned_to_name && (
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            Assigned to <span className="font-medium text-slate-600 dark:text-slate-300">{submission.assigned_to_name}</span>
          </p>
        )}
        {(paper?.submitted_for_review_at || paper?.manager_approved_at || paper?.secretary_approved_at) && (
          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
            {paper?.submitted_for_review_at && (
              <span>Submitted by {paper.submitted_for_review_by_name || '—'} on {fmtDateTime(paper.submitted_for_review_at)}</span>
            )}
            {paper?.manager_approved_at && (
              <span>Manager-approved by {paper.manager_approved_by_name || '—'} on {fmtDateTime(paper.manager_approved_at)}</span>
            )}
            {paper?.secretary_approved_at && (
              <span>Secretary-approved by {paper.secretary_approved_by_name || '—'} on {fmtDateTime(paper.secretary_approved_at)}</span>
            )}
          </div>
        )}
      </div>

      {!readOnly && status === 'draft' && (
        <div className="mb-5 rounded-lg border border-violet-200 bg-violet-50 dark:border-violet-800 dark:bg-violet-950/30 p-3 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-violet-900 dark:text-violet-200">
              <Sparkles size={13} className="inline mr-1" />
              Draft the paper from the ministry’s submission, your checklist and the attached analyses. Suggestions only — nothing is filled in until you use it.
            </p>
            <button type="button" onClick={handleAiDraft} disabled={aiBusy || paper?.ai_draft_state === 'running'} className="btn-outline inline-flex items-center gap-1.5 text-xs py-1 px-2.5">
              <Sparkles size={13} />
              {paper?.ai_draft_state === 'running' ? 'Drafting…' : (paper?.ai_draft_at ? 'Draft again' : 'Draft with AI')}
            </button>
          </div>
          {paper?.ai_draft_state === 'failed' && (
            <p className="mt-2 text-xs text-red-700 dark:text-red-400">{paper.ai_draft_error || 'The draft could not be produced.'}</p>
          )}
          {paper?.ai_draft_at && paper?.ai_draft_state !== 'running' && (
            <div className="mt-3 space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">AI draft — verify every line before using it</p>
              {Object.keys(AI_FIELD_LABELS).filter(k => paper.ai_draft?.[k]).map(k => (
                <div key={k} className="rounded border border-violet-200 dark:border-violet-800 bg-white dark:bg-slate-900 p-2">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">{AI_FIELD_LABELS[k]}</span>
                    <button type="button" onClick={() => useSuggestion(k)} className="text-xs font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400">Use this</button>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 whitespace-pre-wrap">{paper.ai_draft[k]}</p>
                </div>
              ))}
              {(paper.ai_draft?.costing_rows || []).length > 0 && (
                <button type="button" onClick={useMinistryCosting} className="text-xs font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400">
                  Copy the ministry’s costing table ({paper.ai_draft.costing_rows.length} rows, as entered)
                </button>
              )}
              {(paper.ai_draft?.gaps || []).length > 0 && (
                <ul className="list-disc pl-5 text-xs text-amber-800 dark:text-amber-300">
                  {paper.ai_draft.gaps.map((g, i) => <li key={i}>{g}</li>)}
                </ul>
              )}
              {Object.keys(AI_FIELD_LABELS).some(k => paper.ai_draft?.[k]) && (
                <button type="button" onClick={useAllSuggestions} className="btn-outline text-xs py-1 px-2.5">Use all text suggestions</button>
              )}
            </div>
          )}
        </div>
      )}

      {status === 'draft' && (paper?.gaps || []).length > 0 && (
        <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 p-3 text-xs text-amber-900 dark:text-amber-200">
          <p className="font-semibold mb-1">Still to do before this goes to the Manager (save first to refresh):</p>
          <ul className="list-disc pl-5">{paper.gaps.map(g => <li key={g}>{g}</li>)}</ul>
        </div>
      )}

      <div className="space-y-6 text-sm">
        {/* Header */}
        <div>
          <SectionHeader title="Header" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Meeting Number, Item Number, Submitted By, and Date Submitted
                to PSCB are always read-only — computed from the submission's
                actual agenda placement and approval chain, never hand-typed. */}
            <ReadField
              label="Meeting Number"
              value={paper?.meeting_reference}
              placeholder="— pending agenda placement —"
            />
            <ReadField
              label="Item Number"
              value={paper?.agenda_item_number}
              placeholder="— pending agenda placement —"
            />
            <ReadField
              label="Submitted By"
              value={paper?.secretary_approved_by_name || 'Secretary'}
            />
            <ReadField
              label="Date Submitted to PSCB"
              value={fmtDateTime(paper?.submitted_for_review_at)}
              placeholder="— not yet submitted —"
            />
            {readOnly ? (
              <>
                <ReadField label="Action Officer" value={form.action_officer} />
                <ReadField label="PSC File" value={form.psc_file} />
                <ReadField label="Prepared By" value={form.prepared_by} />
                <ReadField label="Date Submitted to PSC by Ministry" value={form.date_submitted_to_psc_by_ministry} />
              </>
            ) : (
              <>
                <Field label="Action Officer"><input className="input" value={form.action_officer} onChange={e => set('action_officer', e.target.value)} placeholder="Name, Manager ODU" /></Field>
                <Field label="PSC File"><input className="input" value={form.psc_file} onChange={e => set('psc_file', e.target.value)} placeholder="Physical/paper file no., if applicable — optional" /></Field>
                <Field label="Prepared By"><input className="input" value={form.prepared_by} onChange={e => set('prepared_by', e.target.value)} placeholder="Name, Principal OD Analyst" /></Field>
                <Field label="Date Submitted to PSC by Ministry">
                  <input type="date" className="input" value={form.date_submitted_to_psc_by_ministry || ''} onChange={e => set('date_submitted_to_psc_by_ministry', e.target.value)} />
                </Field>
              </>
            )}
          </div>
        </div>

        {/* Subject */}
        <div>
          <SectionHeader title="Subject" />
          {readOnly ? (
            <ReadField label="Subject" value={form.subject} span />
          ) : (
            <Field label="Subject">
              <input className="input" value={form.subject} onChange={e => set('subject', e.target.value)} placeholder="Proposed Restructure of..." />
            </Field>
          )}
        </div>

        {/* Background */}
        <div>
          <SectionHeader title="Background" />
          {readOnly ? (
            <ReadField label="Background" value={form.background} span />
          ) : (
            <Field label="Background">
              <textarea className="input min-h-[120px]" value={form.background} onChange={e => set('background', e.target.value)} />
            </Field>
          )}
        </div>

        {/* Issues */}
        <div>
          <SectionHeader title="Issues" />
          {readOnly ? (
            <ReadField label="Issues" value={form.issues} span />
          ) : (
            <Field label="Issues">
              <textarea className="input min-h-[80px]" value={form.issues} onChange={e => set('issues', e.target.value)} placeholder="Whether or not..." />
            </Field>
          )}
        </div>

        {/* Discussions */}
        <div>
          <SectionHeader title="Discussions" />
          {readOnly ? (
            <ReadField label="Discussions" value={form.discussions} span />
          ) : (
            <Field label="Discussions">
              <textarea className="input min-h-[220px]" value={form.discussions} onChange={e => set('discussions', e.target.value)} placeholder="Structure rationale, new/upgraded/removed positions, justification for restructuring..." />
            </Field>
          )}
        </div>

        {/* ODU Assessment */}
        <div>
          <SectionHeader title="ODU Assessment" />
          {readOnly ? (
            <ReadField label="ODU Assessment" value={form.odu_assessment} span />
          ) : (
            <Field label="ODU Assessment">
              <textarea className="input min-h-[140px]" value={form.odu_assessment} onChange={e => set('odu_assessment', e.target.value)} />
            </Field>
          )}
        </div>

        {/* The three analyses: attached in full, summarised in the paper */}
        <div>
          <SectionHeader title="Analyses — DSSPAC, GRT and Finance" />
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
            Attach each full analysis, then summarise it here. The Commission reads the summaries; the attachments stay on the file.
          </p>
          <div className="space-y-3">
            {(paper?.analysis_documents || []).map(item => (
              <AnalysisBlock
                key={item.key}
                item={item}
                summary={form[`${item.key}_summary`] || ''}
                onSummary={v => set(`${item.key}_summary`, v)}
                readOnly={readOnly}
                canUpload={canEdit}
                onUpload={handleUploadAnalysis}
                uploading={uploadingKey === item.key}
                onDownload={handleDownloadAnalysis}
              />
            ))}
          </div>
        </div>

        {/* Costing */}
        <div>
          <SectionHeader title="Financial Implications — Costing" />
          <CostingTable
            rows={form.costing_rows || []}
            onChange={rows => set('costing_rows', rows)}
            readOnly={readOnly}
          />
          <div className="mt-3">
            {readOnly ? (
              <ReadField label="Costing Notes" value={form.costing_notes} span />
            ) : (
              <Field label="Costing Notes">
                <textarea className="input min-h-[70px]" value={form.costing_notes} onChange={e => set('costing_notes', e.target.value)} />
              </Field>
            )}
          </div>
        </div>
      </div>

      {(!readOnly || canSubmit || canManagerApprove || canSecretaryApprove) && (
        <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-700 flex flex-wrap items-center gap-3">
          {!readOnly && (
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="btn-outline inline-flex items-center gap-1.5"
            >
              <Save size={14} />
              {saving ? 'Saving…' : 'Save Draft'}
            </button>
          )}
          {canSubmit && (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="inline-flex items-center gap-1.5 text-sm font-medium bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <Send size={14} />
              {submitting ? 'Submitting…' : 'Submit to Manager ODU'}
            </button>
          )}
          {canManagerApprove && (
            <button
              type="button"
              onClick={handleManagerApprove}
              disabled={managerApproving}
              className="inline-flex items-center gap-1.5 text-sm font-medium bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <ThumbsUp size={14} />
              {managerApproving ? 'Approving…' : 'Approve — Send to Secretary'}
            </button>
          )}
          {canSecretaryApprove && (
            <button
              type="button"
              onClick={handleSecretaryApprove}
              disabled={secretaryApproving}
              className="inline-flex items-center gap-1.5 text-sm font-medium bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <CheckCircle2 size={14} />
              {secretaryApproving ? 'Approving…' : 'Secretary Sign-off'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
