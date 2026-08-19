/**
 * IPDUBoardPaperForm.jsx
 *
 * The PSC Board Submission Paper Manager IPDU prepares for a Task Force or
 * Allowance Payment submission. Modeled closely on ODUBoardPaperForm.jsx,
 * but simpler: Manager IPDU drafts and submits it straight to the
 * Secretary — no separate principal/manager-approval step (see
 * IPDUBoardPaper's docstring in models.py).
 *
 * Props:
 *   submissionId  – numeric ID of the parent Submission
 *   submission    – the submission object (for stage/role gating)
 */

import { useEffect, useState, useCallback } from 'react'
import { FileSignature, Save, Send, CheckCircle2, RotateCcw, Plus, Trash2 } from 'lucide-react'
import api from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import {
  userIsIpduManager, userIsIpduBoardPaperSecretary, submissionInIpduBoardPaperEditPhase,
} from '../../utils/ipduBoardPaper'

const STATUS_LABELS = {
  draft: 'Draft',
  submitted: 'Submitted to Secretary',
  secretary_approved: 'Approved by Secretary',
}

const STATUS_STYLES = {
  draft: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
  submitted: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
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

function ReadField({ label, value, span }) {
  return (
    <div className={span ? 'sm:col-span-2' : ''}>
      <p className="text-[11px] text-slate-400 dark:text-slate-500 mb-0.5">{label}</p>
      <p className="text-sm font-medium text-slate-800 dark:text-slate-100 whitespace-pre-wrap break-words">
        {value || <span className="text-slate-400 dark:text-slate-500 font-normal italic">—</span>}
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

const EMPTY_DELIVERABLE_ROW = {
  deliverable_no: '', description: '', activities: '', proposed_allowance: '',
}

const DELIVERABLE_COLUMNS = [
  ['deliverable_no', 'Deliverable #'],
  ['description', 'Description'],
  ['activities', 'Activities'],
  ['proposed_allowance', 'Proposed Allowance (VT)'],
]

function DeliverableTable({ rows, onChange, readOnly }) {
  const set = (idx, key, value) => {
    const next = rows.map((r, i) => (i === idx ? { ...r, [key]: value } : r))
    onChange(next)
  }
  const addRow = () => onChange([...rows, { ...EMPTY_DELIVERABLE_ROW }])
  const removeRow = (idx) => onChange(rows.filter((_, i) => i !== idx))

  if (readOnly) {
    if (!rows.length) {
      return <p className="text-sm text-slate-400 dark:text-slate-500 italic">No deliverable rows entered.</p>
    }
    return (
      <div className="overflow-x-auto">
        <table className="min-w-full text-xs border border-slate-200 dark:border-slate-700">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-800/60">
              {DELIVERABLE_COLUMNS.map(([key, label]) => (
                <th key={key} className="px-2 py-1.5 text-left font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">{label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={idx} className="border-b border-slate-100 dark:border-slate-700/60">
                {DELIVERABLE_COLUMNS.map(([key]) => (
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
              {DELIVERABLE_COLUMNS.map(([key, label]) => (
                <th key={key} className="px-2 py-1.5 text-left font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">{label}</th>
              ))}
              <th className="border-b border-slate-200 dark:border-slate-700" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={idx} className="border-b border-slate-100 dark:border-slate-700/60">
                {DELIVERABLE_COLUMNS.map(([key]) => (
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
        <Plus size={13} /> Add deliverable row
      </button>
    </div>
  )
}

const EMPTY_FORM = {
  meeting_number: '', item_number: '', submitted_by: 'Secretary', action_officer: '',
  psc_file: '', prepared_by: '',
  date_submitted_to_psc_by_ministry: '', date_submitted_to_pscb: '',
  subject: '', background: '', issues: '', discussions: '', recommendation: '',
  deliverable_rows: [],
}

export default function IPDUBoardPaperForm({ submissionId, submission, onDirtyChange }) {
  const { user } = useAuth()
  const toast = useToast()

  const [paper, setPaper] = useState(undefined) // undefined = loading
  const [loadMessage, setLoadMessage] = useState('')
  const [form, setForm] = useState(EMPTY_FORM)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [secretaryApproving, setSecretaryApproving] = useState(false)
  const [returning, setReturning] = useState(false)
  const [returnNote, setReturnNote] = useState('')

  const isIpduManager = userIsIpduManager(user?.role)
  const isSecretary = userIsIpduBoardPaperSecretary(user?.role)
  const inEditWindow = submissionInIpduBoardPaperEditPhase(submission)
  const status = paper?.status || 'draft'

  const canEdit = inEditWindow && status === 'draft' && isIpduManager
  const readOnly = !canEdit
  const canSubmit = inEditWindow && isIpduManager && status === 'draft'
  // Not gated to the IPDU edit window — by the time it's Submitted the
  // submission may already have moved past IPDU's own stages to the Secretary.
  const canSecretaryApprove = isSecretary && status === 'submitted'
  const canReturnToManager = isSecretary && status === 'submitted'

  const populateForm = useCallback((data) => {
    const filled = { ...EMPTY_FORM }
    Object.keys(EMPTY_FORM).forEach(k => {
      if (data[k] !== undefined && data[k] !== null) filled[k] = data[k]
    })
    setForm(filled)
    setDirty(false)
  }, [])

  useEffect(() => { onDirtyChange?.(dirty) }, [dirty, onDirtyChange])
  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange])

  const fetchPaper = useCallback(async () => {
    if (!submissionId) return
    setPaper(undefined)
    setLoadMessage('')
    try {
      const r = await api.get(`/ipdu-board-papers/ensure/?submission=${submissionId}`)
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
        date_submitted_to_pscb: form.date_submitted_to_pscb || null,
      }
      let r
      if (paper?.id) {
        r = await api.patch(`/ipdu-board-papers/${paper.id}/`, payload)
      } else {
        r = await api.post('/ipdu-board-papers/', payload)
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
      const r = await api.post(`/ipdu-board-papers/${paper.id}/submit/`)
      setPaper(r.data)
      toast.success('Commission paper submitted to the Secretary.')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to submit Commission paper.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleSecretaryApprove = async () => {
    if (!paper?.id) return
    setSecretaryApproving(true)
    try {
      const r = await api.post(`/ipdu-board-papers/${paper.id}/secretary-approve/`)
      setPaper(r.data)
      toast.success('Commission paper approved by Secretary.')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to approve Commission paper.')
    } finally {
      setSecretaryApproving(false)
    }
  }

  const handleReturnToManager = async () => {
    if (!paper?.id || !returnNote.trim()) return
    setReturning(true)
    try {
      const r = await api.post(`/ipdu-board-papers/${paper.id}/return-to-manager/`, { note: returnNote.trim() })
      setPaper(r.data)
      setReturnNote('')
      toast.success('Commission paper returned to Manager IPDU for changes.')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to return Commission paper.')
    } finally {
      setReturning(false)
    }
  }

  if (paper === undefined) {
    return (
      <div className="card card-compact">
        <p className="text-sm text-slate-400 dark:text-slate-500 italic py-4 text-center">Loading Commission paper…</p>
      </div>
    )
  }

  if (paper === null) {
    return (
      <div className="card card-compact">
        <div className="flex items-center gap-2 mb-2">
          <FileSignature size={14} className="text-slate-400" />
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">IPDU Commission Submission Paper</h3>
        </div>
        <p className="text-sm text-slate-400 dark:text-slate-500 italic py-2">{loadMessage}</p>
      </div>
    )
  }

  return (
    <div className="card card-compact">
      <div className="mb-5 pb-3 border-b border-slate-100 dark:border-slate-700">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <FileSignature size={14} className="text-slate-400" />
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">IPDU Commission Submission Paper</h3>
            <StatusBadge status={status} />
          </div>
          <p className="text-xs text-slate-400 dark:text-slate-500">
            {readOnly ? 'This is the paper that was — or will be — presented to the Commission.' : 'Once submitted, only the Secretary can approve or return it.'}
          </p>
        </div>
        {paper?.return_note && status === 'draft' && (
          <div className="mt-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
            <span className="font-semibold">Returned for changes:</span> {paper.return_note}
          </div>
        )}
        {(paper?.submitted_for_review_at || paper?.secretary_approved_at) && (
          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
            {paper?.submitted_for_review_at && (
              <span>Submitted by {paper.submitted_for_review_by_name || '—'} on {fmtDateTime(paper.submitted_for_review_at)}</span>
            )}
            {paper?.secretary_approved_at && (
              <span>Secretary-approved by {paper.secretary_approved_by_name || '—'} on {fmtDateTime(paper.secretary_approved_at)}</span>
            )}
          </div>
        )}
      </div>

      <div className="space-y-6 text-sm">
        {/* Header */}
        <div>
          <SectionHeader title="Header" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {readOnly ? (
              <>
                <ReadField label="Meeting Number" value={form.meeting_number} />
                <ReadField label="Item Number" value={form.item_number} />
                <ReadField label="Submitted By" value={form.submitted_by} />
                <ReadField label="Action Officer" value={form.action_officer} />
                <ReadField label="PSC File" value={form.psc_file} />
                <ReadField label="Prepared By" value={form.prepared_by} />
                <ReadField label="Date Submitted to PSC by Ministry" value={form.date_submitted_to_psc_by_ministry} />
                <ReadField label="Date Submitted to PSCB" value={form.date_submitted_to_pscb} />
              </>
            ) : (
              <>
                <Field label="Meeting Number"><input className="input" value={form.meeting_number} onChange={e => set('meeting_number', e.target.value)} /></Field>
                <Field label="Item Number"><input className="input" value={form.item_number} onChange={e => set('item_number', e.target.value)} /></Field>
                <Field label="Submitted By"><input className="input" value={form.submitted_by} onChange={e => set('submitted_by', e.target.value)} placeholder="e.g. Secretary" /></Field>
                <Field label="Action Officer"><input className="input" value={form.action_officer} onChange={e => set('action_officer', e.target.value)} placeholder="Name, Manager IPDU" /></Field>
                <Field label="PSC File"><input className="input" value={form.psc_file} onChange={e => set('psc_file', e.target.value)} /></Field>
                <Field label="Prepared By"><input className="input" value={form.prepared_by} onChange={e => set('prepared_by', e.target.value)} placeholder="Name, Manager IPDU" /></Field>
                <Field label="Date Submitted to PSC by Ministry">
                  <input type="date" className="input" value={form.date_submitted_to_psc_by_ministry || ''} onChange={e => set('date_submitted_to_psc_by_ministry', e.target.value)} />
                </Field>
                <Field label="Date Submitted to PSCB">
                  <input type="date" className="input" value={form.date_submitted_to_pscb || ''} onChange={e => set('date_submitted_to_pscb', e.target.value)} />
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
              <input className="input" value={form.subject} onChange={e => set('subject', e.target.value)} placeholder="Endorsement of..." />
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

        {/* Issue */}
        <div>
          <SectionHeader title="Issue" />
          {readOnly ? (
            <ReadField label="Issue" value={form.issues} span />
          ) : (
            <Field label="Issue">
              <textarea className="input min-h-[80px]" value={form.issues} onChange={e => set('issues', e.target.value)} placeholder="Whether the Commission will endorse..." />
            </Field>
          )}
        </div>

        {/* Discussion */}
        <div>
          <SectionHeader title="Discussion" />
          {readOnly ? (
            <ReadField label="Discussion" value={form.discussions} span />
          ) : (
            <Field label="Discussion">
              <textarea className="input min-h-[220px]" value={form.discussions} onChange={e => set('discussions', e.target.value)} placeholder="Purpose, membership, TOR deliverables, meetings held..." />
            </Field>
          )}
        </div>

        {/* Recommendation */}
        <div>
          <SectionHeader title="Recommendation" />
          {readOnly ? (
            <ReadField label="Recommendation" value={form.recommendation} span />
          ) : (
            <Field label="Recommendation">
              <textarea className="input min-h-[140px]" value={form.recommendation} onChange={e => set('recommendation', e.target.value)} placeholder="It is therefore recommended that the Public Service Commission (PSC) Board endorse..." />
            </Field>
          )}
        </div>

        {/* Deliverables / Allowance */}
        <div>
          <SectionHeader title="TOR Deliverables / Proposed Allowance" />
          <DeliverableTable
            rows={form.deliverable_rows || []}
            onChange={rows => set('deliverable_rows', rows)}
            readOnly={readOnly}
          />
        </div>
      </div>

      {(!readOnly || canSubmit || canSecretaryApprove || canReturnToManager) && (
        <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-700 space-y-3">
          <div className="flex flex-wrap items-center gap-3">
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
                {submitting ? 'Submitting…' : 'Submit to Secretary'}
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
          {canReturnToManager && (
            <div className="flex flex-wrap items-center gap-2">
              <input
                className="input text-sm flex-1 min-w-[220px]"
                placeholder="Note on what needs to change…"
                value={returnNote}
                onChange={e => setReturnNote(e.target.value)}
              />
              <button
                type="button"
                onClick={handleReturnToManager}
                disabled={returning || !returnNote.trim()}
                className="inline-flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border border-rose-300 text-rose-600 hover:bg-rose-50 dark:border-rose-700 dark:text-rose-400 dark:hover:bg-rose-900/20 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <RotateCcw size={13} />
                {returning ? 'Returning…' : 'Return to Manager IPDU'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
