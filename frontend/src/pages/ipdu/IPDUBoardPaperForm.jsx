/**
 * IPDUBoardPaperForm.jsx
 *
 * The PSC Board Submission Paper Manager IPDU prepares for a Task Force or
 * Allowance Payment submission — the content itself, editable while the
 * parent Submission is still in Draft. This has no submit/approve chain of
 * its own: the hand-off to the Secretary is the Submission's own single
 * "Submit" action (see the Actions panel on the submission detail page),
 * and the Secretary's approve/return decision is that same page's generic
 * workflow-transition buttons — exactly like every other submission type.
 * A second, disconnected "submit the paper" button here was confusing (two
 * unrelated-looking submit actions for what's really one), so this form
 * only ever saves content.
 *
 * Props:
 *   submissionId  – numeric ID of the parent Submission
 *   submission    – the submission object (for stage/role gating)
 */

import { useEffect, useState, useCallback } from 'react'
import { FileSignature, Save, Plus, Trash2 } from 'lucide-react'
import api from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { userIsIpduManager, submissionInIpduBoardPaperEditPhase } from '../../utils/ipduBoardPaper'

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
      <p className="text-[11px] text-slate-400 dark:text-slate-500 mb-0.5">{label}</p>
      <p className="text-sm font-medium text-slate-800 dark:text-slate-100 whitespace-pre-wrap break-words">
        {value || <span className="text-slate-400 dark:text-slate-500 font-normal italic">{placeholder}</span>}
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

// Meeting/item number, "Submitted By", and "submitted to PSCB" aren't part
// of the editable form any more — they're read-only, computed server-side
// (meeting_reference/agenda_item_number/date_submitted_to_pscb on the fetched
// `paper`), since there's nothing correct for the drafter to type here before
// any of those things have actually happened.
const EMPTY_FORM = {
  action_officer: '', psc_file: '', prepared_by: '',
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

  const isIpduManager = userIsIpduManager(user?.role)
  const inEditWindow = submissionInIpduBoardPaperEditPhase(submission)
  const canEdit = inEditWindow && isIpduManager
  const readOnly = !canEdit

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
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
              readOnly
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
            }`}>
              {readOnly ? 'Submitted' : 'Draft'}
            </span>
          </div>
          <p className="text-xs text-slate-400 dark:text-slate-500">
            {readOnly
              ? 'This is the paper that was — or will be — presented to the Commission.'
              : "Fill this in, then use the Submit button in the Actions panel to hand the whole submission to the Secretary."}
          </p>
        </div>
        {paper?.created_at && (
          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
            Started by {paper.created_by_name || '—'} on {fmtDateTime(paper.created_at)}
          </p>
        )}
      </div>

      <div className="space-y-6 text-sm">
        {/* Header */}
        <div>
          <SectionHeader title="Header" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Meeting Number, Item Number, Submitted By, and Date Submitted
                to PSCB are always read-only — computed from the submission's
                actual agenda placement and workflow, never hand-typed. */}
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
            <ReadField label="Submitted By" value="Secretary" />
            <ReadField
              label="Date Submitted to PSCB"
              value={fmtDateTime(paper?.date_submitted_to_pscb)}
              placeholder="— not yet submitted —"
            />
            {readOnly ? (
              <>
                <ReadField label="Action Officer" value={form.action_officer} />
                <ReadField label="PSC File" value={form.psc_file} />
                <ReadField label="Prepared By" value={form.prepared_by} />
              </>
            ) : (
              <>
                <Field label="Action Officer"><input className="input" value={form.action_officer} onChange={e => set('action_officer', e.target.value)} placeholder="Name, Manager IPDU" /></Field>
                <Field label="PSC File"><input className="input" value={form.psc_file} onChange={e => set('psc_file', e.target.value)} placeholder="Physical/paper file no., if applicable — optional" /></Field>
                <Field label="Prepared By"><input className="input" value={form.prepared_by} onChange={e => set('prepared_by', e.target.value)} placeholder="Name, Manager IPDU" /></Field>
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

      {!readOnly && (
        <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-700">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="btn-outline inline-flex items-center gap-1.5"
          >
            <Save size={14} />
            {saving ? 'Saving…' : 'Save Draft'}
          </button>
        </div>
      )}
    </div>
  )
}
