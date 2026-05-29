/**
 * ODURestructureChecklistForm.jsx
 *
 * Digital version of the OPSC ODU Checklist for Restructure Submissions.
 * Used by ODU Principal Job Analysts (odu_principal) and their managers (odu_manager).
 *
 * Props:
 *   submissionId  – numeric ID of the parent Submission
 *   submission    – the submission object (for pre-filling Section A)
 * Shown only during Manager Checklist Review (ODU-routed restructure submissions).
 * Principal edits and submits; Manager reviews read-only then approves.
 */

import { useEffect, useState, useCallback } from 'react'
import {
  ClipboardCheck, Save, Send, ThumbsUp, ChevronDown, ChevronUp,
  CheckCircle2, XCircle, Minus, AlertTriangle, Info, User, Calendar,
} from 'lucide-react'
import api from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { userIsOduPrincipalWorker } from '../../utils/oduChecklist'

// ── Checklist item definitions ────────────────────────────────────────────────

const SECTION_B = [
  {
    group: 1,
    label: 'Group 1 — Submission Completeness',
    color: 'blue',
    items: [
      { field: 'b1_cover_letter',     label: 'Cover letter from Head of Agency/Director General included' },
      { field: 'b2_org_chart',        label: 'Current and proposed organisational chart attached' },
      { field: 'b3_positions_list',   label: 'List of all positions (current and proposed) provided' },
      { field: 'b4_jds_attached',     label: 'Job Descriptions for all new/revised positions attached' },
      { field: 'b5_rationale_stated', label: 'Rationale/justification for the restructure clearly stated' },
    ],
  },
  {
    group: 2,
    label: 'Group 2 — Structure Compliance',
    color: 'violet',
    items: [
      { field: 'b6_mandate_alignment', label: 'Proposed structure aligned with the ministry/agency mandate' },
      { field: 'b7_reporting_lines',   label: 'Reporting lines are clear and appropriate' },
      { field: 'b8_no_duplication',    label: 'No unnecessary duplication of roles or functions' },
      { field: 'b9_span_of_control',   label: 'Span of control is reasonable (not more than 8 direct reports)' },
    ],
  },
  {
    group: 3,
    label: 'Group 3 — Job Description Verification',
    color: 'emerald',
    items: [
      { field: 'b10_job_purpose_linked', label: 'Job purpose clearly linked to the unit/team objectives' },
      { field: 'b11_kra_kta_kpi',        label: 'KRAs, KTAs and KPIs are clearly defined and measurable' },
      { field: 'b12_competencies',       label: 'Required competencies are defined and appropriate to the role' },
      { field: 'b13_qual_experience',    label: 'Qualifications and experience requirements are appropriate' },
    ],
  },
  {
    group: 4,
    label: 'Group 4 — Financial Implications',
    color: 'amber',
    items: [
      { field: 'b14_cost_analysis',  label: 'Cost analysis/financial impact of the restructure included' },
      { field: 'b15_grt_mapping',    label: 'Proposed positions mapped against the Government Remuneration Table (GRT)' },
      { field: 'b16_consultation',   label: 'DOFT, DSSPAC and/or GRT consultation evidence provided where required' },
    ],
  },
  {
    group: 6,
    label: 'Group 6 — ODU Review & Feedback',
    color: 'indigo',
    items: [
      { field: 'b17_odu_analysis',       label: 'ODU analysis of the submission completed' },
      { field: 'b18_feedback_provided',  label: 'Feedback on findings/issues provided to the submitting ministry' },
    ],
  },
  {
    group: 7,
    label: 'Group 7 — Documentation for Commission',
    color: 'rose',
    items: [
      { field: 'b19_final_docs_ready',    label: 'Final restructure documents and JDs ready for Commission consideration' },
      { field: 'b20_manager_final_check', label: 'Manager ODU final check and clearance completed' },
    ],
  },
]

const ALL_ITEM_FIELDS = SECTION_B.flatMap(g => g.items.map(i => i.field))

// ── Sub-components ────────────────────────────────────────────────────────────

const GROUP_COLORS = {
  blue:   { header: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200', badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
  violet: { header: 'bg-violet-50 dark:bg-violet-900/20 border-violet-200 dark:border-violet-800 text-violet-800 dark:text-violet-200', badge: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300' },
  emerald:{ header: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200', badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' },
  amber:  { header: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200', badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' },
  indigo: { header: 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800 text-indigo-800 dark:text-indigo-200', badge: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300' },
  rose:   { header: 'bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200', badge: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300' },
}

function TriStateToggle({ value, onChange, readOnly }) {
  // value: true = Yes, false = No, null = Not answered
  if (readOnly) {
    if (value === true)  return <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300"><CheckCircle2 size={14} /> Yes</span>
    if (value === false) return <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 dark:text-red-400"><XCircle size={14} /> No</span>
    return <span className="inline-flex items-center gap-1 text-xs text-slate-400"><Minus size={14} /> —</span>
  }

  return (
    <div className="flex gap-1.5 shrink-0">
      <button
        type="button"
        onClick={() => onChange(value === true ? null : true)}
        className={`px-3 py-1 rounded-lg text-xs font-semibold border transition-all ${
          value === true
            ? 'bg-emerald-500 text-white border-emerald-500 shadow-sm'
            : 'bg-white dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-600 hover:border-emerald-400 hover:text-emerald-600'
        }`}
      >
        Yes
      </button>
      <button
        type="button"
        onClick={() => onChange(value === false ? null : false)}
        className={`px-3 py-1 rounded-lg text-xs font-semibold border transition-all ${
          value === false
            ? 'bg-red-500 text-white border-red-500 shadow-sm'
            : 'bg-white dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-600 hover:border-red-400 hover:text-red-600'
        }`}
      >
        No
      </button>
    </div>
  )
}

function SectionGroup({ group, form, onChange, readOnly, collapsed, onToggle }) {
  const colors = GROUP_COLORS[group.color] || GROUP_COLORS.blue
  const answered = group.items.filter(i => form[i.field] !== null && form[i.field] !== undefined).length
  const allYes   = group.items.every(i => form[i.field] === true)
  const anyNo    = group.items.some(i => form[i.field] === false)

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
      {/* Group header — click to collapse */}
      <button
        type="button"
        onClick={onToggle}
        className={`w-full flex items-center gap-3 px-4 py-3 text-left border-b ${colors.header} transition-colors`}
      >
        <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-[11px] font-bold ${colors.badge}`}>
          {group.group}
        </span>
        <span className="flex-1 text-sm font-semibold">{group.label}</span>
        <span className="text-xs opacity-70">{answered}/{group.items.length}</span>
        {!readOnly && (
          allYes ? <CheckCircle2 size={14} className="text-emerald-500 shrink-0" /> :
          anyNo  ? <AlertTriangle size={14} className="text-amber-500 shrink-0" /> :
          null
        )}
        {collapsed ? <ChevronDown size={14} className="shrink-0 opacity-60" /> : <ChevronUp size={14} className="shrink-0 opacity-60" />}
      </button>

      {!collapsed && (
        <ul className="divide-y divide-slate-100 dark:divide-slate-700/60">
          {group.items.map((item, idx) => {
            const val = form[item.field] ?? null
            return (
              <li key={item.field} className="flex items-center gap-4 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                <span className="text-xs text-slate-400 dark:text-slate-500 w-5 shrink-0 text-right font-mono">
                  {idx + 1}.
                </span>
                <span className="flex-1 text-sm text-slate-700 dark:text-slate-300 leading-snug">
                  {item.label}
                </span>
                <TriStateToggle
                  value={val}
                  onChange={v => onChange(item.field, v)}
                  readOnly={readOnly}
                />
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function StatusBadge({ status }) {
  const map = {
    draft:     'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
    submitted: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    approved:  'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  }
  const labels = { draft: 'Draft', submitted: 'Submitted', approved: 'Approved' }
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${map[status] || map.draft}`}>
      {labels[status] || status}
    </span>
  )
}

// ── Progress bar ──────────────────────────────────────────────────────────────

function ProgressBar({ answered, total = 20 }) {
  const pct = total > 0 ? Math.round((answered / total) * 100) : 0
  const color = pct === 100 ? 'bg-emerald-500' : pct >= 60 ? 'bg-blue-500' : 'bg-amber-400'
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 w-16 text-right">
        {answered}/{total} answered
      </span>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

const EMPTY_FORM = {
  // Section A
  ministry_department: '',
  division_unit: '',
  submission_type: '',
  odu_officer_assigned: '',
  manager_odu: '',
  // Section B — all null (unanswered)
  ...Object.fromEntries(ALL_ITEM_FIELDS.map(f => [f, null])),
  // Section C
  recommendation: '',
  officer_comments: '',
  // Section D
  verifying_officer_name: '',
  verifying_officer_date: '',
  manager_verifier_name: '',
  manager_verifier_date: '',
}

export default function ODURestructureChecklistForm({ submissionId, submission }) {
  const { user } = useAuth()
  const toast = useToast()

  const [checklist, setChecklist] = useState(undefined)  // undefined = loading
  const [loadMessage, setLoadMessage] = useState('')
  const [form, setForm]           = useState(EMPTY_FORM)
  const [saving, setSaving]       = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [approving, setApproving] = useState(false)
  const [collapsedGroups, setCollapsedGroups] = useState({})

  const isOduPrincipal = userIsOduPrincipalWorker(user?.role)
  const isOduManager   = user?.role === 'odu_manager'
  const canEdit = isOduPrincipal && checklist?.status === 'draft'
  const canSubmit = isOduPrincipal && checklist?.status === 'draft'
  const canApprove = isOduManager && checklist?.status === 'submitted'
  const readOnly = !canEdit

  // Count answered items
  const answeredCount = ALL_ITEM_FIELDS.filter(f => form[f] !== null && form[f] !== undefined).length

  // Fetch existing checklist for this submission
  const populateFormFromChecklist = useCallback((data) => {
    const filled = { ...EMPTY_FORM }
    Object.keys(EMPTY_FORM).forEach(k => {
      if (data[k] !== undefined) filled[k] = data[k] ?? (k.startsWith('b') ? null : '')
    })
    setForm(filled)
  }, [])

  const fetchChecklist = useCallback(async () => {
    if (!submissionId) return
    setChecklist(undefined)
    setLoadMessage('')
    try {
      const r = await api.get(`/odu-checklists/ensure/?submission=${submissionId}`)
      setChecklist(r.data)
      populateFormFromChecklist(r.data)
    } catch (err) {
      const status = err.response?.status
      const detail = err.response?.data?.detail
      if (status === 404) {
        setChecklist(null)
        setLoadMessage(
          typeof detail === 'string'
            ? detail
            : 'The ODU Principal must start the checklist during this review stage.',
        )
        return
      }
      if (status === 400) {
        setChecklist(null)
        setLoadMessage(typeof detail === 'string' ? detail : 'This checklist is not available for this submission.')
        return
      }
      setChecklist(null)
      setLoadMessage('Unable to load the ODU checklist.')
    }
  }, [submissionId, populateFormFromChecklist])

  useEffect(() => { fetchChecklist() }, [fetchChecklist])

  const handleFieldChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  const toggleGroup = (groupNum) => {
    setCollapsedGroups(prev => ({ ...prev, [groupNum]: !prev[groupNum] }))
  }

  // Save draft (create or update)
  const handleSave = async () => {
    setSaving(true)
    try {
      const payload = {
        submission: submissionId,
        ...form,
        // Normalise empty string dates → null
        verifying_officer_date: form.verifying_officer_date || null,
        manager_verifier_date:  form.manager_verifier_date  || null,
      }
      let r
      if (checklist?.id) {
        r = await api.patch(`/odu-checklists/${checklist.id}/`, payload)
      } else {
        r = await api.post('/odu-checklists/', payload)
      }
      setChecklist(r.data)
      toast.success('Checklist saved as draft.')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save checklist.')
    } finally {
      setSaving(false)
    }
  }

  // Submit draft → submitted
  const handleSubmit = async () => {
    if (answeredCount < 20) {
      toast.error(`Please answer all 20 checklist items before submitting. (${answeredCount}/20 answered)`)
      return
    }
    // Save first, then submit
    setSubmitting(true)
    try {
      const payload = {
        submission: submissionId,
        ...form,
        verifying_officer_date: form.verifying_officer_date || null,
        manager_verifier_date:  form.manager_verifier_date  || null,
      }
      let current = checklist
      if (current?.id) {
        const saved = await api.patch(`/odu-checklists/${current.id}/`, payload)
        current = saved.data
      } else {
        const saved = await api.post('/odu-checklists/', payload)
        current = saved.data
      }
      const r = await api.post(`/odu-checklists/${current.id}/submit/`)
      setChecklist(r.data)
      toast.success('Checklist submitted for manager approval.')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to submit checklist.')
    } finally {
      setSubmitting(false)
    }
  }

  // Approve (manager only)
  const handleApprove = async () => {
    if (!checklist?.id) return
    setApproving(true)
    try {
      const r = await api.post(`/odu-checklists/${checklist.id}/approve/`)
      setChecklist(r.data)
      setForm(prev => ({
        ...prev,
        manager_verifier_name: r.data.manager_verifier_name || prev.manager_verifier_name,
        manager_verifier_date: r.data.manager_verifier_date || prev.manager_verifier_date,
      }))
      toast.success('Checklist approved.')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to approve checklist.')
    } finally {
      setApproving(false)
    }
  }

  if (checklist === undefined) {
    return (
      <div className="card p-5 flex items-center gap-3 text-slate-400 text-sm">
        <div className="w-4 h-4 rounded-full border-2 border-slate-300 border-t-primary-500 animate-spin" />
        Loading ODU checklist…
      </div>
    )
  }

  if (!checklist) {
    return (
      <div className="card p-5 flex items-start gap-3 text-sm text-slate-600 dark:text-slate-300">
        <Info size={16} className="shrink-0 text-slate-400 mt-0.5" />
        <p>{loadMessage || 'ODU checklist is not available.'}</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* ── Header card ── */}
      <div className="card p-5">
        <div className="flex items-start gap-3 mb-4 pb-4 border-b border-slate-100 dark:border-slate-700">
          <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 shrink-0">
            <ClipboardCheck size={18} className="text-indigo-600 dark:text-indigo-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                ODU Restructure Submission Checklist
              </h3>
              <StatusBadge status={checklist.status} />
            </div>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
              Office of the Public Service Commission — Organisational Development Unit
            </p>
            {checklist?.status === 'draft' && isOduPrincipal && (
              <p className="text-xs text-indigo-700 dark:text-indigo-300 mt-2">
                Section A and suggested Yes/No answers are pre-filled from the submission and uploaded documents.
                Verify each item, complete Groups 6–7, then submit for manager approval.
              </p>
            )}
            {checklist?.status === 'submitted' && isOduManager && (
              <p className="text-xs text-amber-800 dark:text-amber-200 mt-2">
                Review all checklist items below. Approve only when you are satisfied the package is ready.
              </p>
            )}
            {checklist?.status === 'submitted' && isOduPrincipal && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                Submitted for manager review — editing is locked until the manager returns it or approves.
              </p>
            )}
          </div>
          {checklist?.submitted_at && (
            <div className="text-right shrink-0">
              <p className="text-[11px] text-slate-400">Submitted</p>
              <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
                {new Date(checklist.submitted_at).toLocaleDateString('en-VU', { day: '2-digit', month: 'short', year: 'numeric' })}
              </p>
            </div>
          )}
        </div>

        {/* Progress */}
        <ProgressBar answered={answeredCount} total={20} />
      </div>

      {/* ── Section A — Submission Information ── */}
      <div className="card p-5">
        <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4">
          Section A — Submission Information
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              Ministry / Department
            </label>
            {readOnly ? (
              <p className="text-sm text-slate-800 dark:text-slate-100">{form.ministry_department || '—'}</p>
            ) : (
              <input
                type="text"
                className="form-input"
                value={form.ministry_department}
                onChange={e => handleFieldChange('ministry_department', e.target.value)}
                placeholder="e.g. Ministry of Finance"
              />
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              Division / Unit
            </label>
            {readOnly ? (
              <p className="text-sm text-slate-800 dark:text-slate-100">{form.division_unit || '—'}</p>
            ) : (
              <input
                type="text"
                className="form-input"
                value={form.division_unit}
                onChange={e => handleFieldChange('division_unit', e.target.value)}
                placeholder="e.g. Human Resources Division"
              />
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              Type of Submission
            </label>
            {readOnly ? (
              <p className="text-sm text-slate-800 dark:text-slate-100">
                {{ full_restructure: 'Full Restructure', partial_review: 'Partial Review', new_jd: 'New Job Description', amendment: 'Amendment' }[form.submission_type] || '—'}
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {[
                  { value: 'full_restructure', label: 'Full Restructure' },
                  { value: 'partial_review',   label: 'Partial Review' },
                  { value: 'new_jd',           label: 'New JD' },
                  { value: 'amendment',        label: 'Amendment' },
                ].map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleFieldChange('submission_type', form.submission_type === opt.value ? '' : opt.value)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                      form.submission_type === opt.value
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:border-indigo-400'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              ODU Officer Assigned
            </label>
            {readOnly ? (
              <p className="text-sm text-slate-800 dark:text-slate-100">{form.odu_officer_assigned || '—'}</p>
            ) : (
              <input
                type="text"
                className="form-input"
                value={form.odu_officer_assigned}
                onChange={e => handleFieldChange('odu_officer_assigned', e.target.value)}
                placeholder="Officer name"
              />
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              Manager ODU
            </label>
            {readOnly ? (
              <p className="text-sm text-slate-800 dark:text-slate-100">{form.manager_odu || '—'}</p>
            ) : (
              <input
                type="text"
                className="form-input"
                value={form.manager_odu}
                onChange={e => handleFieldChange('manager_odu', e.target.value)}
                placeholder="Manager name"
              />
            )}
          </div>
        </div>
      </div>

      {/* ── Section B — Verification Checklist ── */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Section B — Verification Checklist
          </h4>
          {!readOnly && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  const allCollapsed = SECTION_B.every(g => collapsedGroups[g.group])
                  const next = {}
                  SECTION_B.forEach(g => { next[g.group] = !allCollapsed })
                  setCollapsedGroups(next)
                }}
                className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
              >
                {SECTION_B.every(g => collapsedGroups[g.group]) ? 'Expand all' : 'Collapse all'}
              </button>
            </div>
          )}
        </div>

        {canEdit && (
          <div className="mb-4 flex items-start gap-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 px-3 py-2 text-xs text-blue-700 dark:text-blue-300">
            <Info size={13} className="shrink-0 mt-0.5" />
            Pre-filled suggestions are based on submission data and attachments. Click <strong>Yes</strong> or <strong>No</strong> to confirm each item (click again to clear).
          </div>
        )}
        {readOnly && checklist?.status === 'submitted' && (
          <div className="mb-4 flex items-start gap-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
            <AlertTriangle size={13} className="shrink-0 mt-0.5" />
            Read-only review — use <strong>Approve Checklist</strong> below when the verification is complete.
          </div>
        )}

        <div className="space-y-3">
          {SECTION_B.map(group => (
            <SectionGroup
              key={group.group}
              group={group}
              form={form}
              onChange={handleFieldChange}
              readOnly={readOnly}
              collapsed={!!collapsedGroups[group.group]}
              onToggle={() => toggleGroup(group.group)}
            />
          ))}
        </div>
      </div>

      {/* ── Section C — Recommendation ── */}
      <div className="card p-5">
        <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4">
          Section C — ODU Officer Recommendation
        </h4>

        <div className="space-y-3 mb-4">
          {[
            { value: 'verified',       label: 'Submission verified and ready for Commission submission',          color: 'emerald' },
            { value: 'needs_revision', label: 'Submission requires revision before further processing',           color: 'amber'   },
            { value: 'incomplete',     label: 'Submission incomplete — return to Ministry for clarification',     color: 'red'     },
          ].map(opt => {
            const selected = form.recommendation === opt.value
            const colorMap = {
              emerald: { border: 'border-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/20', text: 'text-emerald-800 dark:text-emerald-200', dot: 'bg-emerald-500' },
              amber:   { border: 'border-amber-400',   bg: 'bg-amber-50 dark:bg-amber-900/20',     text: 'text-amber-800 dark:text-amber-200',     dot: 'bg-amber-500'   },
              red:     { border: 'border-red-400',     bg: 'bg-red-50 dark:bg-red-900/20',         text: 'text-red-800 dark:text-red-200',         dot: 'bg-red-500'     },
            }
            const c = colorMap[opt.color]
            return (
              <button
                key={opt.value}
                type="button"
                disabled={readOnly}
                onClick={() => !readOnly && handleFieldChange('recommendation', selected ? '' : opt.value)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left transition-all ${
                  selected
                    ? `${c.border} ${c.bg} ${c.text}`
                    : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                } ${readOnly ? 'cursor-default' : 'cursor-pointer'}`}
              >
                <div className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${
                  selected ? `${c.border} ${c.bg}` : 'border-slate-300 dark:border-slate-600'
                }`}>
                  {selected && <div className={`w-2 h-2 rounded-full ${c.dot}`} />}
                </div>
                <span className="text-sm font-medium">{opt.label}</span>
              </button>
            )
          })}
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
            Officer Comments / Remarks
          </label>
          {readOnly ? (
            <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap bg-slate-50 dark:bg-slate-800/50 rounded-lg px-3 py-2">
              {form.officer_comments || '—'}
            </p>
          ) : (
            <textarea
              className="form-input min-h-[80px] resize-y"
              value={form.officer_comments}
              onChange={e => handleFieldChange('officer_comments', e.target.value)}
              placeholder="Any observations, issues found, or additional notes…"
              rows={3}
            />
          )}
        </div>
      </div>

      {/* ── Section D — Verification and Authorization ── */}
      <div className="card p-5">
        <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4">
          Section D — Verification and Authorization
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {/* Verifying Officer */}
          <div className="space-y-3 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
            <div className="flex items-center gap-2">
              <User size={14} className="text-slate-400" />
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">ODU Verifying Officer</span>
            </div>
            <div>
              <label className="block text-xs text-slate-500 dark:text-slate-500 mb-1">Name</label>
              {readOnly ? (
                <p className="text-sm text-slate-800 dark:text-slate-100">{form.verifying_officer_name || '—'}</p>
              ) : (
                <input
                  type="text"
                  className="form-input"
                  value={form.verifying_officer_name}
                  onChange={e => handleFieldChange('verifying_officer_name', e.target.value)}
                  placeholder="Full name"
                />
              )}
            </div>
            <div>
              <label className="block text-xs text-slate-500 dark:text-slate-500 mb-1 flex items-center gap-1">
                <Calendar size={11} /> Date
              </label>
              {readOnly ? (
                <p className="text-sm text-slate-800 dark:text-slate-100">
                  {form.verifying_officer_date
                    ? new Date(form.verifying_officer_date).toLocaleDateString('en-VU', { day: '2-digit', month: 'short', year: 'numeric' })
                    : '—'}
                </p>
              ) : (
                <input
                  type="date"
                  className="form-input"
                  value={form.verifying_officer_date || ''}
                  onChange={e => handleFieldChange('verifying_officer_date', e.target.value)}
                />
              )}
            </div>
          </div>

          {/* Manager ODU */}
          <div className="space-y-3 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
            <div className="flex items-center gap-2">
              <User size={14} className="text-slate-400" />
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Manager ODU (Final Verification)</span>
              {checklist?.status === 'approved' && (
                <CheckCircle2 size={13} className="text-emerald-500 ml-auto" />
              )}
            </div>
            <div>
              <label className="block text-xs text-slate-500 dark:text-slate-500 mb-1">Name</label>
              {(readOnly || checklist?.status === 'approved') ? (
                <p className="text-sm text-slate-800 dark:text-slate-100">{form.manager_verifier_name || '—'}</p>
              ) : (
                <input
                  type="text"
                  className="form-input"
                  value={form.manager_verifier_name}
                  onChange={e => handleFieldChange('manager_verifier_name', e.target.value)}
                  placeholder="Full name"
                  disabled={!isOduManager}
                />
              )}
            </div>
            <div>
              <label className="block text-xs text-slate-500 dark:text-slate-500 mb-1 flex items-center gap-1">
                <Calendar size={11} /> Date
              </label>
              {(readOnly || checklist?.status === 'approved') ? (
                <p className="text-sm text-slate-800 dark:text-slate-100">
                  {form.manager_verifier_date
                    ? new Date(form.manager_verifier_date).toLocaleDateString('en-VU', { day: '2-digit', month: 'short', year: 'numeric' })
                    : '—'}
                </p>
              ) : (
                <input
                  type="date"
                  className="form-input"
                  value={form.manager_verifier_date || ''}
                  onChange={e => handleFieldChange('manager_verifier_date', e.target.value)}
                  disabled={!isOduManager}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Action buttons ── */}
      {(canEdit || canSubmit || canApprove) && (
        <div className="flex flex-wrap items-center gap-3 pt-1">
          {canEdit && (
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="btn-outline inline-flex items-center gap-2"
            >
              <Save size={14} />
              {saving ? 'Saving…' : 'Save Draft'}
            </button>
          )}
          {canSubmit && (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || answeredCount < 20}
              className="btn-primary inline-flex items-center gap-2"
              title={answeredCount < 20 ? `Answer all 20 items first (${answeredCount}/20)` : 'Submit for manager approval'}
            >
              <Send size={14} />
              {submitting ? 'Submitting…' : 'Submit for Approval'}
            </button>
          )}
          {canApprove && (
            <button
              type="button"
              onClick={handleApprove}
              disabled={approving}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-colors"
            >
              <ThumbsUp size={14} />
              {approving ? 'Approving…' : 'Approve Checklist'}
            </button>
          )}
          {canSubmit && answeredCount < 20 && (
            <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
              <AlertTriangle size={12} />
              {20 - answeredCount} item{20 - answeredCount !== 1 ? 's' : ''} still unanswered
            </p>
          )}
        </div>
      )}

      {/* Approved notice */}
      {checklist?.status === 'approved' && (
        <div className="flex items-center gap-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-200">
          <CheckCircle2 size={16} className="shrink-0 text-emerald-500" />
          <span>
            This checklist has been <strong>approved</strong> by the Manager ODU
            {checklist.manager_verifier_name ? ` (${checklist.manager_verifier_name})` : ''}.
            It is now locked for editing.
          </span>
        </div>
      )}
    </div>
  )
}
