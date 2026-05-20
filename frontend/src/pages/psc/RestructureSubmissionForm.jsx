/**
 * RestructureSubmissionForm.jsx
 *
 * Digital version of the PSC Section 3.1 standard template:
 * "Organisation Restructure and/or Establishment Variation Submission"
 *
 * Used by Ministry HR officers / Dept Admins when form_type_code === 'ORG-3.1'.
 * PSC staff (secretary/admin) get a read-only view.
 *
 * Props:
 *   submissionId  – numeric ID of the parent Submission
 *   submission    – full submission object (for pre-filling ministry name etc.)
 *   canEdit       – boolean; if false, renders read-only
 */

import { useEffect, useState, useCallback, useRef } from 'react'
import {
  FileText, Save, Plus, Trash2, CheckSquare, Square,
  ChevronDown, ChevronUp, Info, AlertTriangle, Building2,
} from 'lucide-react'
import api from '../../api/client'
import { useToast } from '../../context/ToastContext'

// ── Empty costing row ─────────────────────────────────────────────────────────
const EMPTY_ROW = {
  current_post_no: '',
  current_title: '',
  current_level: '',
  current_salary: '',
  proposed_post_no: '',
  proposed_title: '',
  proposed_level: '',
  proposed_salary: '',
  salary_difference: '',
}

const EMPTY_FORM = {
  subject_title: '',
  background: '',
  proposal: '',
  costing_rows: [],
  costing_notes: '',
  implementation_plan: '',
  recommendation: '',
  director_name: '',
  director_date: '',
  attach_current_org_chart: false,
  attach_proposed_org_chart: false,
  attach_job_descriptions: false,
  attach_other: false,
  attach_other_description: '',
  dg_endorses: null,
  dg_name: '',
  dg_date: '',
}

// ── Section accordion wrapper ─────────────────────────────────────────────────
function Section({ number, title, color = 'slate', children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen)
  const colorMap = {
    slate:  'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200',
    blue:   'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200',
    violet: 'bg-violet-50 dark:bg-violet-900/20 border-violet-200 dark:border-violet-800 text-violet-800 dark:text-violet-200',
    amber:  'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200',
    emerald:'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200',
    indigo: 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800 text-indigo-800 dark:text-indigo-200',
    rose:   'bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200',
  }

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center gap-3 px-5 py-3.5 text-left border-b transition-colors ${colorMap[color]}`}
      >
        {number && (
          <span className="text-xs font-bold w-5 shrink-0">{number}.</span>
        )}
        <span className="flex-1 text-sm font-semibold">{title}</span>
        {open ? <ChevronUp size={14} className="shrink-0 opacity-60" /> : <ChevronDown size={14} className="shrink-0 opacity-60" />}
      </button>
      {open && (
        <div className="p-5 bg-white dark:bg-slate-900">
          {children}
        </div>
      )}
    </div>
  )
}

// ── Costing table ─────────────────────────────────────────────────────────────
function CostingTable({ rows, onChange, readOnly }) {
  const addRow = () => onChange([...rows, { ...EMPTY_ROW }])

  const updateRow = (idx, field, value) => {
    const updated = rows.map((r, i) => i === idx ? { ...r, [field]: value } : r)
    onChange(updated)
  }

  const removeRow = (idx) => onChange(rows.filter((_, i) => i !== idx))

  const cellBase = 'px-2 py-1.5 text-xs border-r border-slate-100 dark:border-slate-700 last:border-r-0'
  const inputCls = 'w-full bg-transparent focus:outline-none text-xs text-slate-800 dark:text-slate-100 placeholder:text-slate-300 dark:placeholder:text-slate-600'

  const headers = [
    { label: 'Post No.', span: 1, sub: 'current' },
    { label: 'Title / Occupant', span: 2, sub: 'current' },
    { label: 'Level / Grade', span: 1, sub: 'current' },
    { label: 'Salary (VT)', span: 1, sub: 'current' },
    { label: 'Post No.', span: 1, sub: 'proposed' },
    { label: 'Title', span: 2, sub: 'proposed' },
    { label: 'Level / Grade', span: 1, sub: 'proposed' },
    { label: 'Salary (VT)*', span: 1, sub: 'proposed' },
    { label: 'Diff (VT)', span: 1, sub: 'proposed' },
  ]

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
        <table className="w-full min-w-[900px] text-xs border-collapse">
          <thead>
            {/* Group headers */}
            <tr className="divide-x divide-slate-200 dark:divide-slate-700">
              <th
                colSpan={5}
                className="px-3 py-2 text-center text-[10px] font-bold uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700 border-r"
              >
                Current Approved Positions to be Deleted or Affected
              </th>
              <th
                colSpan={4}
                className="px-3 py-2 text-center text-[10px] font-bold uppercase tracking-wider bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-b border-slate-200 dark:border-slate-700"
              >
                Proposed Positions to be Created / Upgraded / Downgraded
              </th>
              {!readOnly && <th className="w-8 bg-slate-50 dark:bg-slate-800/50 border-b border-l border-slate-200 dark:border-slate-700" />}
            </tr>
            {/* Column headers */}
            <tr className="divide-x divide-slate-200 dark:divide-slate-700 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
              <th className="px-2 py-1.5 text-left font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap">Post No.</th>
              <th className="px-2 py-1.5 text-left font-semibold text-slate-500 dark:text-slate-400 min-w-[120px]">Title / Occupant</th>
              <th className="px-2 py-1.5 text-left font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap">Level/Grade</th>
              <th className="px-2 py-1.5 text-left font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap">Salary</th>
              <th className="px-2 py-1.5 text-left font-semibold text-blue-500 dark:text-blue-400 whitespace-nowrap border-l-2 border-blue-200 dark:border-blue-700">Post No.</th>
              <th className="px-2 py-1.5 text-left font-semibold text-blue-500 dark:text-blue-400 min-w-[120px]">Title</th>
              <th className="px-2 py-1.5 text-left font-semibold text-blue-500 dark:text-blue-400 whitespace-nowrap">Level/Grade</th>
              <th className="px-2 py-1.5 text-left font-semibold text-blue-500 dark:text-blue-400 whitespace-nowrap">Salary*</th>
              <th className="px-2 py-1.5 text-left font-semibold text-blue-500 dark:text-blue-400 whitespace-nowrap">Diff</th>
              {!readOnly && <th className="w-8" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={readOnly ? 9 : 10}
                  className="px-4 py-4 text-center text-slate-400 dark:text-slate-500 text-xs italic"
                >
                  {readOnly ? 'No costing rows added.' : 'No rows yet — click "Add Row" below to begin.'}
                </td>
              </tr>
            )}
            {rows.map((row, idx) => (
              <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 group">
                {/* Current position columns */}
                {['current_post_no', 'current_title', 'current_level', 'current_salary'].map(field => (
                  <td key={field} className={`${cellBase} border-slate-100 dark:border-slate-700`}>
                    {readOnly ? (
                      <span className="text-slate-700 dark:text-slate-300">{row[field] || '—'}</span>
                    ) : (
                      <input
                        type="text"
                        className={inputCls}
                        value={row[field] || ''}
                        onChange={e => updateRow(idx, field, e.target.value)}
                        placeholder="—"
                      />
                    )}
                  </td>
                ))}
                {/* Proposed position columns */}
                {['proposed_post_no', 'proposed_title', 'proposed_level', 'proposed_salary', 'salary_difference'].map((field, fi) => (
                  <td key={field} className={`${cellBase} ${fi === 0 ? 'border-l-2 border-blue-200 dark:border-blue-700' : ''}`}>
                    {readOnly ? (
                      <span className={`${field === 'salary_difference' && row[field]
                        ? row[field].startsWith('-') ? 'text-red-600 dark:text-red-400 font-semibold' : 'text-emerald-600 dark:text-emerald-400 font-semibold'
                        : 'text-slate-700 dark:text-slate-300'
                      }`}>
                        {row[field] || '—'}
                      </span>
                    ) : (
                      <input
                        type="text"
                        className={`${inputCls} ${field === 'salary_difference' ? 'font-semibold' : ''}`}
                        value={row[field] || ''}
                        onChange={e => updateRow(idx, field, e.target.value)}
                        placeholder={field === 'salary_difference' ? '+/−' : '—'}
                      />
                    )}
                  </td>
                ))}
                {!readOnly && (
                  <td className="px-1.5 py-1.5 text-center">
                    <button
                      type="button"
                      onClick={() => removeRow(idx)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30"
                    >
                      <Trash2 size={12} />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!readOnly && (
        <button
          type="button"
          onClick={addRow}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-dashed border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:border-primary-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
        >
          <Plus size={12} /> Add Row
        </button>
      )}

      <div className="flex items-start gap-1.5 text-[11px] text-slate-400 dark:text-slate-500">
        <Info size={11} className="shrink-0 mt-0.5" />
        <span>
          *Salary figure for the proposed grade. If a position is vacant, indicate whether funds have been allocated for the current financial year.
          Include the pro-rata amount if filling mid-year (e.g. 6/12 of annual salary if filled in July).
        </span>
      </div>
    </div>
  )
}

// ── Checkbox toggle ────────────────────────────────────────────────────────────
function CheckItem({ checked, onChange, label, readOnly }) {
  return (
    <button
      type="button"
      disabled={readOnly}
      onClick={() => !readOnly && onChange(!checked)}
      className={`flex items-center gap-2 text-sm transition-colors ${
        readOnly ? 'cursor-default' : 'cursor-pointer hover:text-primary-600 dark:hover:text-primary-400'
      } ${checked ? 'text-slate-800 dark:text-slate-100' : 'text-slate-500 dark:text-slate-400'}`}
    >
      {checked
        ? <CheckSquare size={15} className="text-primary-600 dark:text-primary-400 shrink-0" />
        : <Square size={15} className="shrink-0 opacity-50" />
      }
      {label}
    </button>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function RestructureSubmissionForm({ submissionId, submission, canEdit }) {
  const toast = useToast()
  const [form, setForm] = useState(EMPTY_FORM)
  const [loaded, setLoaded] = useState(false)
  const [hasData, setHasData] = useState(false)
  const [saving, setSaving] = useState(false)
  const saveTimerRef = useRef(null)

  const set = (field, value) => setForm(prev => ({ ...prev, [field]: value }))

  // Load existing data
  const fetchData = useCallback(async () => {
    if (!submissionId) return
    try {
      const r = await api.get(`/submissions/${submissionId}/restructure-data/`)
      if (r.data && Object.keys(r.data).length > 0) {
        setForm(prev => {
          const merged = { ...EMPTY_FORM }
          Object.keys(EMPTY_FORM).forEach(k => {
            if (r.data[k] !== undefined && r.data[k] !== null) {
              merged[k] = r.data[k]
            }
          })
          return merged
        })
        setHasData(true)
      } else {
        // Pre-fill from submission
        setForm(prev => ({
          ...EMPTY_FORM,
          subject_title: submission?.title || '',
          director_name: submission?.dg_name || '',
        }))
        setHasData(false)
      }
    } catch {
      setHasData(false)
    } finally {
      setLoaded(true)
    }
  }, [submissionId, submission])

  useEffect(() => { fetchData() }, [fetchData])

  const handleSave = async () => {
    setSaving(true)
    try {
      const payload = {
        ...form,
        director_date: form.director_date || null,
        dg_date:       form.dg_date       || null,
      }
      const method = hasData ? 'put' : 'post'
      const r = await api[method](`/submissions/${submissionId}/restructure-data/`, payload)
      if (!hasData) setHasData(true)
      toast.success('Restructure submission saved.')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save.')
    } finally {
      setSaving(false)
    }
  }

  if (!loaded) {
    return (
      <div className="card p-5 flex items-center gap-3 text-slate-400 text-sm">
        <div className="w-4 h-4 rounded-full border-2 border-slate-300 border-t-primary-500 animate-spin" />
        Loading restructure form…
      </div>
    )
  }

  const F = ({ field, placeholder, multiline = false, rows = 4 }) => {
    if (!canEdit) {
      return (
        <div className={`text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap bg-slate-50 dark:bg-slate-800/50 rounded-lg px-3 py-2 ${!form[field] ? 'text-slate-400 dark:text-slate-500 italic' : ''}`}>
          {form[field] || 'Not provided.'}
        </div>
      )
    }
    if (multiline) {
      return (
        <textarea
          className="form-input resize-y"
          rows={rows}
          value={form[field] || ''}
          onChange={e => set(field, e.target.value)}
          placeholder={placeholder}
        />
      )
    }
    return (
      <input
        type="text"
        className="form-input"
        value={form[field] || ''}
        onChange={e => set(field, e.target.value)}
        placeholder={placeholder}
      />
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="card p-5">
        <div className="flex items-start gap-3 mb-3 pb-3 border-b border-slate-100 dark:border-slate-700">
          <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-violet-100 dark:bg-violet-900/30 shrink-0">
            <Building2 size={18} className="text-violet-600 dark:text-violet-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
              Organisation Restructure / Establishment Variation
            </h3>
            <p className="text-xs text-slate-400 dark:text-slate-500">
              PSC Section 3.1 — Standard Submission Template
            </p>
          </div>
          {hasData && (
            <span className="ml-auto text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 rounded-full">
              Saved
            </span>
          )}
        </div>

        {/* Addressee block */}
        <div className="rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-700 px-4 py-3 text-xs text-slate-500 dark:text-slate-400 space-y-0.5 mb-4">
          <p className="font-semibold text-slate-700 dark:text-slate-300">The Secretary</p>
          <p>Public Service Commission</p>
          <p>PM Bag 017, Port Vila</p>
        </div>

        {/* Subject */}
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
            Subject — Title of Proposal <span className="text-red-500">*</span>
          </label>
          <F
            field="subject_title"
            placeholder="e.g. Proposal to Revise the Organisation Structure for the Ministry of Finance"
          />
          <p className="mt-1 text-[11px] text-slate-400">This appears as the letter subject line.</p>
        </div>
      </div>

      {/* Section 1 — Background */}
      <Section number="1" title="Background" color="blue">
        <div className="space-y-2">
          <div className="flex items-start gap-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 px-3 py-2 text-xs text-blue-700 dark:text-blue-300 mb-3">
            <Info size={13} className="shrink-0 mt-0.5" />
            <span>Describe the reasons for seeking the restructure or establishment variation. Include the strategic objectives being addressed and the expected impact on service delivery.</span>
          </div>
          <F
            field="background"
            placeholder="Insert details of the reasons for seeking the restructure / establishment variation…"
            multiline rows={6}
          />
        </div>
      </Section>

      {/* Section 2 — Proposal */}
      <Section number="2" title="Proposal" color="violet">
        <div className="space-y-2">
          <div className="flex items-start gap-2 rounded-lg bg-violet-50 dark:bg-violet-900/20 border border-violet-100 dark:border-violet-800 px-3 py-2 text-xs text-violet-700 dark:text-violet-300 mb-3">
            <Info size={13} className="shrink-0 mt-0.5" />
            <span>
              Include: positions to be deleted or re-graded; new positions sought with their roles, responsibilities, and proposed grading.
            </span>
          </div>
          <F
            field="proposal"
            placeholder="Insert details of any positions to be deleted or re-graded, new positions being sought, their roles and responsibilities, and proposed grading…"
            multiline rows={7}
          />
        </div>
      </Section>

      {/* Section 3 — Costing */}
      <Section number="3" title="Costing" color="amber">
        <CostingTable
          rows={form.costing_rows}
          onChange={rows => set('costing_rows', rows)}
          readOnly={!canEdit}
        />
        <div className="mt-4">
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
            Additional Notes (vacancy funding, part-year calculations, etc.)
          </label>
          <F
            field="costing_notes"
            placeholder="e.g. If the new position is to be filled in July, only 6/12th of the full year funding figure will be required…"
            multiline rows={3}
          />
        </div>
      </Section>

      {/* Section 4 — Implementation Plan */}
      <Section number="4" title="Implementation Plan" color="indigo">
        <div className="space-y-2">
          <div className="flex items-start gap-2 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800 px-3 py-2 text-xs text-indigo-700 dark:text-indigo-300 mb-3">
            <Info size={13} className="shrink-0 mt-0.5" />
            <span>
              Indicate: whether funds are available in the current budget; how positions will be filled (transfer, acting, advertisement, temporary/contract); timeline.
            </span>
          </div>
          <F
            field="implementation_plan"
            placeholder="Insert details of how the proposal, if approved by the PSC, will be implemented…"
            multiline rows={5}
          />
        </div>
      </Section>

      {/* Section 5 — Recommendation */}
      <Section number="5" title="Recommendation" color="emerald">
        <div className="space-y-2">
          <div className="flex items-start gap-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-300 mb-3">
            <Info size={13} className="shrink-0 mt-0.5" />
            <span>State clearly what you are asking the PSC to approve (e.g. "It is therefore recommended that the PSC approve: …").</span>
          </div>
          <F
            field="recommendation"
            placeholder="It is therefore recommended that the PSC approve:&#10;1. …&#10;2. …"
            multiline rows={5}
          />
        </div>
      </Section>

      {/* Director sign-off */}
      <div className="card p-5">
        <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4">
          Director's Sign-off
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Director's Name</label>
            <F field="director_name" placeholder="Full name and title" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Date</label>
            {canEdit ? (
              <input
                type="date"
                className="form-input"
                value={form.director_date || ''}
                onChange={e => set('director_date', e.target.value)}
              />
            ) : (
              <p className="text-sm text-slate-800 dark:text-slate-100">
                {form.director_date
                  ? new Date(form.director_date).toLocaleDateString('en-VU', { day: '2-digit', month: 'short', year: 'numeric' })
                  : '—'}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Attachments */}
      <div className="card p-5">
        <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4">
          Attachments
        </h4>
        <div className="space-y-2.5">
          <CheckItem
            checked={form.attach_current_org_chart}
            onChange={v => set('attach_current_org_chart', v)}
            label="Organisation Structure — Current (OPSC-stamped)"
            readOnly={!canEdit}
          />
          <CheckItem
            checked={form.attach_proposed_org_chart}
            onChange={v => set('attach_proposed_org_chart', v)}
            label="Organisation Structure — Proposed"
            readOnly={!canEdit}
          />
          <CheckItem
            checked={form.attach_job_descriptions}
            onChange={v => set('attach_job_descriptions', v)}
            label="Job Descriptions (new positions only)"
            readOnly={!canEdit}
          />
          <CheckItem
            checked={form.attach_other}
            onChange={v => set('attach_other', v)}
            label="Other supporting documents"
            readOnly={!canEdit}
          />
          {form.attach_other && (
            <div className="ml-6">
              <F
                field="attach_other_description"
                placeholder="Describe the other documents attached…"
              />
            </div>
          )}
        </div>
        {!canEdit && !form.attach_current_org_chart && !form.attach_proposed_org_chart && !form.attach_job_descriptions && !form.attach_other && (
          <p className="text-xs text-slate-400 italic mt-2">No attachments indicated.</p>
        )}
      </div>

      {/* DG Endorsement */}
      <Section title="Director-General Endorsement" color="rose">
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 italic">
          "I support/endorse the above proposal from the Director…"
        </p>

        {/* Support / Does not support toggle */}
        <div className="flex gap-3 mb-4">
          {[
            { value: true,  label: 'I support / endorse' },
            { value: false, label: 'I do not support' },
          ].map(opt => {
            const selected = form.dg_endorses === opt.value
            return (
              <button
                key={String(opt.value)}
                type="button"
                disabled={!canEdit}
                onClick={() => canEdit && set('dg_endorses', selected ? null : opt.value)}
                className={`flex-1 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all ${
                  selected
                    ? opt.value
                      ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300'
                      : 'border-red-400 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
                    : 'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-slate-300'
                } ${!canEdit ? 'cursor-default' : 'cursor-pointer'}`}
              >
                {opt.label}
              </button>
            )
          })}
        </div>

        {form.dg_endorses === false && (
          <div className="mb-4 flex items-start gap-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-3 py-2 text-xs text-red-700 dark:text-red-300">
            <AlertTriangle size={13} className="shrink-0 mt-0.5" />
            DG does not support this proposal. Please review before forwarding.
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              Director-General's Name
            </label>
            <F field="dg_name" placeholder="Full name and title" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Date</label>
            {canEdit ? (
              <input
                type="date"
                className="form-input"
                value={form.dg_date || ''}
                onChange={e => set('dg_date', e.target.value)}
              />
            ) : (
              <p className="text-sm text-slate-800 dark:text-slate-100">
                {form.dg_date
                  ? new Date(form.dg_date).toLocaleDateString('en-VU', { day: '2-digit', month: 'short', year: 'numeric' })
                  : '—'}
              </p>
            )}
          </div>
        </div>
      </Section>

      {/* Save button */}
      {canEdit && (
        <div className="flex items-center gap-3 pt-1">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="btn-primary inline-flex items-center gap-2 px-5 py-2"
          >
            <Save size={14} />
            {saving ? 'Saving…' : hasData ? 'Save Changes' : 'Save Submission'}
          </button>
          <p className="text-xs text-slate-400">
            Saved drafts are only visible within this system.
          </p>
        </div>
      )}
    </div>
  )
}
