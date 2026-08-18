/**
 * ODURestructureChecklistForm.jsx
 *
 * Digital version of the OPSC ODU Checklist for Restructure Submissions.
 * Sections A + B (submission info + the 20 items) are filled by the
 * submitting ministry/unit while their submission is in Draft. ODU
 * (odu_principal, odu_manager) reviews those answers read-only during Manager Checklist
 * Review and adds their own recommendation + sign-off (Sections C + D).
 * Manager ODU approves once satisfied.
 *
 * Props:
 *   submissionId  – numeric ID of the parent Submission
 *   submission    – the submission object (for pre-filling Section A)
 */

import { useEffect, useState, useCallback } from 'react'
import {
  ClipboardCheck, Save, Send, ThumbsUp, ChevronDown, ChevronUp,
  CheckCircle2, XCircle, Minus, AlertTriangle, Info, User, Calendar,
} from 'lucide-react'
import api from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { userIsOduPrincipalWorker, userIsChecklistMinistryRole, oduChecklistPrincipalReviewComplete } from '../../utils/oduChecklist'

// ── Checklist item definitions ────────────────────────────────────────────────

const SECTION_B = [
  {
    group: 1,
    label: 'Group 1 — Submission Completeness',
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
    items: [
      { field: 'b14_cost_analysis',  label: 'Cost analysis/financial impact of the restructure included' },
      { field: 'b15_grt_mapping',    label: 'Proposed positions mapped against the Government Remuneration Table (GRT)' },
      { field: 'b16_consultation',   label: 'DOFT, DSSPAC and/or GRT consultation evidence provided where required' },
    ],
  },
  {
    group: 6,
    label: 'Group 6 — ODU Review & Feedback (ODU only, not the ministry)',
    items: [
      { field: 'b17_odu_analysis',       label: 'ODU analysis of the submission completed' },
      { field: 'b18_feedback_provided',  label: 'Feedback on findings/issues provided to the submitting ministry' },
    ],
  },
  {
    group: 7,
    label: 'Group 7 — Documentation for Commission (ODU only, not the ministry)',
    items: [
      { field: 'b19_final_docs_ready',    label: 'Final restructure documents and JDs ready for Commission consideration' },
      { field: 'b20_manager_final_check', label: 'Manager ODU final check and clearance completed' },
    ],
  },
]

// Best-effort mapping from a checklist item to the RequiredDocument name(s)
// most likely to answer it, used to jump the Documents pane straight to the
// relevant file when a reviewer clicks a checklist question. b1/b2/b4 are
// exact matches (a dedicated required document exists for each); the rest
// point at the closest supporting document since ODU verifies these by
// reading that document rather than a document dedicated to the question.
// b14 (cost analysis) and b15 (GRT mapping) are intentionally omitted — that
// content lives in the digitised form's costing table, not an uploaded file.
const ITEM_DOCUMENT_MAP = {
  b1_cover_letter: ['Official Letter request to restructure', 'DG Endorsement Letter'],
  b2_org_chart: ['Current Organisation Structure (OPSC-stamped)', 'Proposed Organisation Structure'],
  b3_positions_list: ['Proposed Organisation Structure'],
  b4_jds_attached: ['Job Descriptions - PSC Form 2-2 (New Positions, Upgraded Positions, Downgraded Positions, Supervisor for new positions.) (Affected Positions)'],
  b5_rationale_stated: ['Official Letter request to restructure'],
  b6_mandate_alignment: ['Proposed Organisation Structure'],
  b7_reporting_lines: ['Proposed Organisation Structure'],
  b8_no_duplication: ['Proposed Organisation Structure'],
  b9_span_of_control: ['Proposed Organisation Structure'],
  b10_job_purpose_linked: ['Job Descriptions - PSC Form 2-2 (New Positions, Upgraded Positions, Downgraded Positions, Supervisor for new positions.) (Affected Positions)'],
  b11_kra_kta_kpi: ['Job Descriptions - PSC Form 2-2 (New Positions, Upgraded Positions, Downgraded Positions, Supervisor for new positions.) (Affected Positions)'],
  b12_competencies: ['Job Descriptions - PSC Form 2-2 (New Positions, Upgraded Positions, Downgraded Positions, Supervisor for new positions.) (Affected Positions)'],
  b13_qual_experience: ['Job Descriptions - PSC Form 2-2 (New Positions, Upgraded Positions, Downgraded Positions, Supervisor for new positions.) (Affected Positions)'],
  b16_consultation: ['Other Supporting Documents'],
}

// b20 despite its "Manager ODU" label was editable by any ODU role — force
// it read-only for anyone but the Manager, matching the disabled={!isOduManager}
// gate already used on the Section D Manager sign-off fields below.
const MANAGER_ONLY_ITEM_FIELDS = ['b20_manager_final_check']

// Resolve a checklist item's mapped RequiredDocument name(s) to the id of an
// actually-uploaded SubmissionDocument. `checklistItems` is the submission's
// required-documents checklist (RequiredDocument id + name); `documents` is
// the uploaded files, each carrying which RequiredDocument id it satisfies.
function resolveDocumentId(fieldKey, documents, checklistItems) {
  const names = ITEM_DOCUMENT_MAP[fieldKey]
  if (!names) return null
  for (const name of names) {
    const item = checklistItems.find(ci => ci.document_name === name)
    if (!item) continue
    const doc = documents.find(d => d.required_document === item.document)
    if (doc) return doc.id
  }
  return null
}

const ALL_ITEM_FIELDS = SECTION_B.flatMap(g => g.items.map(i => i.field))
// Groups 1-4 (items 1-16) — the ministry's checklist. Groups 6-7 (17-20)
// describe ODU's own subsequent work and are never required from the ministry.
const MINISTRY_REQUIRED_FIELDS = SECTION_B
  .filter(g => g.group !== 6 && g.group !== 7)
  .flatMap(g => g.items.map(i => i.field))
const MINISTRY_REQUIRED_COUNT = MINISTRY_REQUIRED_FIELDS.length

// ── Sub-components ────────────────────────────────────────────────────────────

// One neutral style for every group — matches the app's slate/primary
// palette instead of a distinct hue per group.
const GROUP_NEUTRAL = {
  header: 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200',
  badge: 'bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300',
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

function SectionGroup({ group, form, onChange, readOnly, collapsed, onToggle, forceReadOnlyFields = [], onNavigateToDocument }) {
  const colors = GROUP_NEUTRAL
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
            const itemReadOnly = readOnly || forceReadOnlyFields.includes(item.field)
            const hasDocument = onNavigateToDocument && ITEM_DOCUMENT_MAP[item.field]
            return (
              <li key={item.field} className="flex items-center gap-4 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                <span className="text-xs text-slate-400 dark:text-slate-500 w-5 shrink-0 text-right font-mono">
                  {idx + 1}.
                </span>
                {hasDocument ? (
                  <button
                    type="button"
                    onClick={() => onNavigateToDocument(item.field)}
                    className="flex-1 text-left text-sm text-slate-700 dark:text-slate-300 leading-snug hover:text-indigo-600 dark:hover:text-indigo-400 hover:underline underline-offset-2 transition-colors"
                    title="Open the supporting document for this item"
                  >
                    {item.label}
                  </button>
                ) : (
                  <span className="flex-1 text-sm text-slate-700 dark:text-slate-300 leading-snug">
                    {item.label}
                  </span>
                )}
                <TriStateToggle
                  value={val}
                  onChange={v => onChange(item.field, v)}
                  readOnly={itemReadOnly}
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

export default function ODURestructureChecklistForm({
  submissionId, submission, documents = [], checklistItems = [], onNavigateToDocument, onCompletionChange,
}) {
  const { user } = useAuth()
  const toast = useToast()

  const [checklist, setChecklist] = useState(undefined)  // undefined = loading
  const [loadMessage, setLoadMessage] = useState('')
  const [form, setForm]           = useState(EMPTY_FORM)
  const [saving, setSaving]       = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [approving, setApproving] = useState(false)
  const [collapsedGroups, setCollapsedGroups] = useState({})

  // Let the parent (SubmissionDetail's "Submit back to Manager" panel) know
  // whether the principal's own Groups 6-7 items are all answered — mirrors
  // the server-side gate in submit_to_manager(). Based on the last-saved
  // `checklist`, not unsaved `form` edits, so it matches what the server
  // will actually see.
  useEffect(() => {
    if (checklist === undefined) return
    onCompletionChange?.(oduChecklistPrincipalReviewComplete(checklist))
  }, [checklist, onCompletionChange])

  const isMinistryRole = userIsChecklistMinistryRole(user?.role)
  const isOduPrincipal = userIsOduPrincipalWorker(user?.role)
  const isOduManager   = user?.role === 'odu_manager'
  const isAdminUser    = user?.is_superuser || user?.role === 'psc_admin'
  // Groups 6-7 + Sections C/D are ODU's own work — the ministry never needs
  // to see empty placeholders for content that isn't theirs to fill in.
  const showOduOnlySections = isOduPrincipal || isOduManager || isAdminUser

  // Optional — only set when a caller renders this form next to a document
  // pane it can jump to. Not wired from the submission page's Checklist tab,
  // since Documents lives in its own separate tab there.
  const handleNavigateToDocument = onNavigateToDocument
    ? (fieldKey) => {
        const docId = resolveDocumentId(fieldKey, documents, checklistItems)
        if (docId != null) onNavigateToDocument(docId)
        else toast.info('No matching document has been uploaded for this item yet.')
      }
    : undefined

  // Section A (submission info) + Section B (the 20 items) — ministry's own
  // self-certification, filled while the checklist is still a Draft.
  const canEditAB = isMinistryRole && checklist?.status === 'draft'
  const canSubmit = isMinistryRole && checklist?.status === 'draft'
  // Section C (recommendation) + Section D (sign-off) — ODU's review, only
  // once the ministry has submitted. ODU never touches the 20 answers.
  const canEditCD = (isOduPrincipal || isOduManager) && checklist?.status === 'submitted'
  const canApprove = isOduManager && checklist?.status === 'submitted'
  const readOnlyAB = !canEditAB
  const readOnlyCD = !canEditCD
  const canEdit = canEditAB || canEditCD

  // Count answered items — only the 16 ministry-required items gate submission.
  const answeredCount = MINISTRY_REQUIRED_FIELDS.filter(f => form[f] !== null && form[f] !== undefined).length

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
            : 'The ministry has not started this checklist yet.',
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
    if (answeredCount < MINISTRY_REQUIRED_COUNT) {
      toast.error(`Please answer all ${MINISTRY_REQUIRED_COUNT} checklist items before submitting. (${answeredCount}/${MINISTRY_REQUIRED_COUNT} answered)`)
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
              {(isOduPrincipal || isOduManager) && submission?.assigned_to_name && (
                <> · Assigned to <span className="font-medium text-slate-600 dark:text-slate-300">{submission.assigned_to_name}</span></>
              )}
            </p>
            {checklist?.status === 'draft' && isMinistryRole && (
              <p className="text-xs text-indigo-700 dark:text-indigo-300 mt-2">
                Section A and suggested Yes/No answers are pre-filled from your submission and uploaded documents.
                Verify each item, then submit alongside your request.
              </p>
            )}
            {checklist?.status === 'submitted' && (isOduPrincipal || isOduManager) && (
              <p className="text-xs text-amber-800 dark:text-amber-200 mt-2">
                The ministry has completed their 16 required items (Groups 1-4). Review their answers below,
                then complete Groups 6-7 and add your recommendation and sign-off — the ministry's own answers
                are locked to you.
              </p>
            )}
            {checklist?.status === 'draft' && !isMinistryRole && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                The ministry is still completing this checklist.
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
        <ProgressBar answered={answeredCount} total={MINISTRY_REQUIRED_COUNT} />
      </div>

      {/* ── Section A — Submission Information ── */}
      <div className="card p-5">
        <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4">
          Section A — Submission Information
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Derived live from the Submission — same source as the page
              header — rather than a separately-stored copy that could
              silently diverge from it. */}
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              Ministry / Department
            </label>
            <p className="text-sm text-slate-800 dark:text-slate-100">{submission?.ministry?.name || '—'}</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              Division / Unit
            </label>
            <p className="text-sm text-slate-800 dark:text-slate-100">{submission?.department?.name || '—'}</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              Type of Submission
            </label>
            {readOnlyAB ? (
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
          {/* OPSC/ODU-internal routing info — the ministry never sees who's
              been assigned to review their submission; matches Groups 6-7
              below and VisualAuditTrail's OPSC-only gating elsewhere. */}
          {showOduOnlySections && (
            <>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  ODU Officer Assigned
                </label>
                <p className="text-sm text-slate-800 dark:text-slate-100">{form.odu_officer_assigned || '—'}</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Manager ODU
                </label>
                <p className="text-sm text-slate-800 dark:text-slate-100">{form.manager_odu || '—'}</p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Section B — Verification Checklist ── */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Section B — Verification Checklist
          </h4>
          {!readOnlyAB && (
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

        {canEditAB && (
          <div className="mb-4 flex items-start gap-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 px-3 py-2 text-xs text-blue-700 dark:text-blue-300">
            <Info size={13} className="shrink-0 mt-0.5" />
            Pre-filled suggestions are based on submission data and attachments. Click <strong>Yes</strong> or <strong>No</strong> to confirm each item (click again to clear).
          </div>
        )}
        {readOnlyAB && checklist?.status === 'submitted' && (isOduPrincipal || isOduManager) && (
          <div className="mb-4 flex items-start gap-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
            <AlertTriangle size={13} className="shrink-0 mt-0.5" />
            The ministry's answers are read-only — add your recommendation and sign-off below, then{' '}
            <strong>Approve Checklist</strong> when satisfied.
          </div>
        )}
        {readOnlyAB && checklist?.status === 'submitted' && isMinistryRole && (
          <div className="mb-4 flex items-start gap-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs text-slate-600 dark:text-slate-300">
            <Info size={13} className="shrink-0 mt-0.5" />
            Submitted — ODU is now reviewing this checklist.
          </div>
        )}

        <div className="space-y-3">
          {SECTION_B.map(group => {
            // Groups 6-7 (items 17-20) describe ODU's own work, not the
            // ministry's — they're ODU's to fill in during review, not
            // part of the ministry's 16 required items, and the ministry
            // never needs to see these empty placeholders at all.
            const isOduGroup = group.group === 6 || group.group === 7
            if (isOduGroup && !showOduOnlySections) return null
            return (
              <SectionGroup
                key={group.group}
                group={group}
                form={form}
                onChange={handleFieldChange}
                readOnly={isOduGroup ? readOnlyCD : readOnlyAB}
                collapsed={!!collapsedGroups[group.group]}
                onToggle={() => toggleGroup(group.group)}
                forceReadOnlyFields={isOduGroup && !isOduManager ? MANAGER_ONLY_ITEM_FIELDS : []}
                onNavigateToDocument={!isOduGroup ? handleNavigateToDocument : undefined}
              />
            )
          })}
        </div>
      </div>

      {showOduOnlySections && (
      <>

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
                disabled={readOnlyCD}
                onClick={() => !readOnlyCD && handleFieldChange('recommendation', selected ? '' : opt.value)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left transition-all ${
                  selected
                    ? `${c.border} ${c.bg} ${c.text}`
                    : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                } ${readOnlyCD ? 'cursor-default' : 'cursor-pointer'}`}
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
          {readOnlyCD ? (
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
              {readOnlyCD ? (
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
              {readOnlyCD ? (
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
              {(readOnlyCD || checklist?.status === 'approved') ? (
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
              {(readOnlyCD || checklist?.status === 'approved') ? (
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
      </>
      )}

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
              {saving ? 'Saving…' : canEditAB ? 'Save Draft' : 'Save Review'}
            </button>
          )}
          {canSubmit && (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || answeredCount < MINISTRY_REQUIRED_COUNT}
              className="btn-primary inline-flex items-center gap-2"
              title={answeredCount < MINISTRY_REQUIRED_COUNT ? `Answer all ${MINISTRY_REQUIRED_COUNT} items first (${answeredCount}/${MINISTRY_REQUIRED_COUNT})` : 'Submit with your request'}
            >
              <Send size={14} />
              {submitting ? 'Submitting…' : 'Submit Checklist'}
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
          {canSubmit && answeredCount < MINISTRY_REQUIRED_COUNT && (
            <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
              <AlertTriangle size={12} />
              {MINISTRY_REQUIRED_COUNT - answeredCount} item{MINISTRY_REQUIRED_COUNT - answeredCount !== 1 ? 's' : ''} still unanswered
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
