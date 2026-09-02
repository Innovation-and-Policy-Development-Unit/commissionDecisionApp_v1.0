import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PageHeader from '../../components/shared/PageHeader'
import api from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { isComplianceRole } from '../../constants/compliance'
import { useAgendaSections } from '../../hooks/useAgendaSections'
import { ODU_RESTRUCTURE_CHECKLIST_FORM_CODES } from '../../utils/oduChecklist'
import { X, Search } from 'lucide-react'
import BaseButton from '../../components/shared/BaseButton'
import BaseInput from '../../components/shared/BaseInput'
import BaseSelect from '../../components/shared/BaseSelect'
import BaseTextarea from '../../components/shared/BaseTextarea'
import BaseMessageBar from '../../components/shared/BaseMessageBar'
import EmailChipInput from '../../components/shared/EmailChipInput'

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const FALLBACK_FORM_TYPES = []

/** Roles that submit OPSC-internal submissions (no checklist, straight to Secretary). */
const INTERNAL_ROLES = [
  'odu_principal',
  'vipam_manager',
  'vipam_principal',
  'vipam_senior',
]

/** CSU Manager creates OPSC-internal submissions too (PSC-staff-only visible),
 * but uses the same submission-type catalog as the HR Unit and follows the
 * normal PSC route — checklist, assessment, Secretary gate, Commission —
 * rather than the short internal-only path the roles above use. */
const CSU_ROLE = 'csu_manager'

/** Manager IPDU creates OPSC-internal Task Force / Allowance Payment board
 * papers — same normal-route pattern as CSU above, but with its own
 * dedicated submission-type catalog (routed_unit === 'ipdu'). */
const IPDU_ROLE = 'ipdu_manager'

/** Roles allowed to log a new submission at all — kept in sync with the
 * `allowed` check below. Exported so list-page "New submission" buttons
 * (e.g. SubmissionLog.jsx) can hide themselves for roles that would just
 * land on the "Only PSC staff or Ministry HR/Admin can log submissions"
 * message here instead of showing a button that doesn't work. */
export const SUBMISSION_CREATE_ALLOWED_ROLES = [
  'receptionist', 'psc_officer', 'psc_admin', 'psc_secretary', 'ministry_hr', 'dept_admin', 'head_of_agency',
  CSU_ROLE, IPDU_ROLE, ...INTERNAL_ROLES, 'compliance_senior', 'compliance_principal', 'compliance_manager',
]

const DEFAULT_TITLE_PLACEHOLDER = 'e.g. Appointment of Director Finance & Administration'

/** Title/subject placeholder shown once a specific submission type is picked —
 * makes the example match what's actually being submitted. */
const TITLE_PLACEHOLDER_BY_FORM_TYPE = {
  'RECRUIT-PROBATION':    'e.g. Appointment on Probation for John Smith, Senior Officer',
  'RECRUIT-CONFIRM':      'e.g. Confirmation of Appointment for John Smith, Senior Officer',
  'RECRUIT-DIRECT':       'e.g. Direct Appointment of John Smith to Senior Officer',
  'RECRUIT-TEMPORARY':    'e.g. Temporary Appointment of John Smith as Senior Officer',
  'RECRUIT-CONTRACT':     'e.g. Contract Employment of John Smith as Senior Officer',
  'RECRUIT-ACTING':       'e.g. Acting Appointment of John Smith as Manager HRM',
  'RECRUIT-ELIGIBLE':     'e.g. Eligible Candidate Notification for John Smith',
  'RECRUIT-UNSUCCESSFUL': 'e.g. Unsuccessful Candidate Notification for John Smith',
  'CESSATION-AGE':          'e.g. Age Retirement for John Smith, Senior Officer',
  'CESSATION-NOTICE-AGE':   'e.g. Notice of Age Retirement for John Smith',
  'CESSATION-MEDICAL':      'e.g. Medical Retirement for John Smith',
  'CESSATION-DEATH':        'e.g. Death in Service Benefits for the late John Smith',
  'CESSATION-REDUNDANCY':   'e.g. Redundancy of John Smith, Senior Officer',
  'CESSATION-RESIGNATION':  'e.g. Voluntary Resignation of John Smith',
  'SECONDMENT':    'e.g. Secondment of John Smith to the Commercial Investment Unit',
  'LEAVE-PAYOUT':  'e.g. Outstanding Leave Payout for John Smith',
  'MEDICAL-CLAIM': 'e.g. Medical Expense Claim for John Smith',
}

// ─────────────────────────────────────────────────────────────────────────────
// Deadline Banner
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Shows the next meeting date and submission deadline.
 * If the 3-day cutoff has already passed (or a manual cutoff is set and past),
 * shows an amber warning: "This submission will go to the NEXT meeting."
 * Otherwise shows a calm blue info line: next meeting + closing date.
 *
 * The backend computes `effective_cutoff` per meeting:
 *   = submission_cutoff  (if manually set)
 *   = meeting.date − 3 days at 23:59:59  (default)
 */
function DeadlineBanner() {
  const [info, setInfo] = useState(null)

  useEffect(() => {
    const now = new Date()
    // Fetch the next 3 scheduled meetings (ascending date, starting from today)
    api.get('/meetings/', { params: { status: 'scheduled', page_size: 5, ordering: 'date' } })
      .then(res => {
        const upcoming = (res.data.results || res.data)
          .filter(m => m.status === 'scheduled' && new Date(m.date + 'T23:59:59') >= now)
          .sort((a, b) => new Date(a.date) - new Date(b.date))
          .slice(0, 3)
        if (upcoming.length === 0) return   // no upcoming meetings — hide banner
        setInfo({ meetings: upcoming, now })
      })
      .catch(() => {/* no banner if meetings can't be fetched */})
  }, [])

  if (!info) return null

  const { meetings, now } = info
  if (meetings.length === 0) return null

  // The soonest upcoming meeting by date
  const soonest = meetings[0]

  // The first meeting whose effective_cutoff hasn't passed yet — where this submission goes
  const targetMeeting = meetings.find(m => new Date(m.effective_cutoff) > now)

  const fmtDate = d => new Date(d + 'T00:00').toLocaleDateString('en-VU', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
  const fmtCutoff = d => new Date(d).toLocaleDateString('en-VU', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  })

  // Cutoff for the soonest meeting has passed — show amber "goes to next meeting" warning
  const soonestCutoffPassed = new Date(soonest.effective_cutoff) <= now

  if (soonestCutoffPassed) {
    return (
      <div className="mb-5 rounded-lg border border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-900/25 px-4 py-3.5 flex items-start gap-3">
        <span className="text-lg mt-0.5 shrink-0">⚠️</span>
        <div className="text-sm text-amber-800 dark:text-amber-200 space-y-0.5">
          <p className="font-semibold">
            Submission deadline has passed for the {fmtDate(soonest.date)} meeting.
          </p>
          <p>
            {targetMeeting
              ? <>This submission will be listed for the <strong>next meeting on {fmtDate(targetMeeting.date)}</strong>. You can still submit — it will be added to that agenda.</>
              : <>No further scheduled meeting found. Your submission will be queued — contact the Secretary to confirm which meeting it will be listed for.</>
            }
          </p>
        </div>
      </div>
    )
  }

  // Cutoff is still open — show calm info with the closing date
  const daysUntilCutoff = Math.ceil(
    (new Date(soonest.effective_cutoff) - now) / (1000 * 60 * 60 * 24)
  )
  const urgency = daysUntilCutoff <= 1

  return (
    <div className={`mb-5 rounded-lg border px-4 py-3.5 flex items-start gap-3 ${
      urgency
        ? 'border-orange-300 bg-orange-50 dark:border-orange-700 dark:bg-orange-900/20'
        : 'border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/20'
    }`}>
      <span className="text-lg mt-0.5 shrink-0">{urgency ? '⏰' : '📅'}</span>
      <div className={`text-sm space-y-0.5 ${urgency ? 'text-orange-800 dark:text-orange-200' : 'text-blue-800 dark:text-blue-200'}`}>
        <p className="font-semibold">
          Next meeting: {fmtDate(soonest.date)}
        </p>
        <p>
          {urgency
            ? <>Submissions close <strong>today</strong> ({fmtCutoff(soonest.effective_cutoff)}). Submit now to be included in this agenda.</>
            : <>Submissions close on <strong>{fmtCutoff(soonest.effective_cutoff)}</strong> — {daysUntilCutoff} day{daysUntilCutoff !== 1 ? 's' : ''} from now. Submissions after that date will go to the following meeting.</>
          }
        </p>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Free-form multi-file upload (internal submissions)
// ─────────────────────────────────────────────────────────────────────────────

function InternalDocumentUpload({ files, onChange }) {
  const inputRef = useRef()

  const handleFiles = newFiles => {
    const added = Array.from(newFiles).map(f => ({ file: f, name: '' }))
    onChange([...files, ...added])
  }

  const updateName = (idx, name) => {
    const updated = files.map((f, i) => i === idx ? { ...f, name } : f)
    onChange(updated)
  }

  const remove = idx => onChange(files.filter((_, i) => i !== idx))

  const onDrop = e => {
    e.preventDefault()
    handleFiles(e.dataTransfer.files)
  }

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
        Supporting documents
        <span className="ml-1 text-xs font-normal text-slate-500">(optional — attach as many as needed)</span>
      </label>

      {/* Drop zone */}
      <div
        onDrop={onDrop}
        onDragOver={e => e.preventDefault()}
        onClick={() => inputRef.current?.click()}
        className="flex flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/50 px-6 py-6 cursor-pointer hover:border-blue-400 dark:hover:border-blue-500 transition-colors"
      >
        <span className="text-2xl">📎</span>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          <strong className="text-blue-600 dark:text-blue-400">Click to browse</strong> or drag files here
        </p>
        <p className="text-xs text-slate-400">PDF, Word, Excel — max 20 MB per file</p>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={e => handleFiles(e.target.files)}
        />
      </div>

      {/* File list with name inputs */}
      {files.length > 0 && (
        <ul className="space-y-2">
          {files.map((item, idx) => (
            <li key={idx} className="flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2">
              <span className="text-slate-400 text-sm shrink-0">📄</span>
              <BaseInput
                hideLabel
                label="Document name"
                className="flex-1"
                placeholder={`Document name (e.g. "Director Letter") — leave blank to use file name`}
                value={item.name}
                onChange={e => updateName(idx, e.target.value)}
              />
              <span className="text-xs text-slate-400 shrink-0 max-w-[120px] truncate" title={item.file.name}>
                {item.file.name}
              </span>
              <BaseButton
                variant="ghost" size="icon" iconOnly
                onClick={() => remove(idx)}
                aria-label="Remove file"
                icon={<X size={16} />}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Commission submission (ministry / PSC — full assessment → Commission)
// ─────────────────────────────────────────────────────────────────────────────

function CommissionSubmissionForm({
  modal, onClose, onSuccess, ministries, departments, units, isMinistryUser,
}) {
  const navigate = useNavigate()
  const toast = useToast()
  const { user } = useAuth()
  const { sections: lodgeSections, loading: sectionsLoading } = useAgendaSections({ lodgeOnly: true })
  const [form, setForm] = useState({
    title: '',
    agenda_category: '',
    form_type_code: '',
    ministry: '',
    department: '',
    unit: '',
    notes: '',
    notify_emails: [],
    applicant_email: '',
  })
  const availUnits = units.filter(
    u => !form.department || u.department === parseInt(form.department, 10),
  )
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  // ── Attach to a parent Form 2.1 restructure (PSC 2-2 only) ──────────────
  // Per the confirmed intake workflow: a Job Description can be lodged
  // standalone, or attached to a restructure submission the ministry already
  // filed — in which case it's reviewed alongside the parent (no separate
  // routing/checklist) instead of going through its own full workflow.
  const isJobDescription = form.form_type_code === 'PSC 2-2'
  // A Ministry Business Plan / Annual Report combines and consolidates every
  // department's plan or performance into one ministry-wide submission — it
  // doesn't belong to a single department, so Department isn't required.
  const isMinistryWideForm = ['BUSINESS-PLAN', 'ANNUAL-REPORT'].includes(form.form_type_code)
  const [attachMode, setAttachMode] = useState(false)
  const [parentQuery, setParentQuery] = useState('')
  const [parentResults, setParentResults] = useState([])
  const [parentSearchLoading, setParentSearchLoading] = useState(false)
  const [parentSubmission, setParentSubmission] = useState(null)

  useEffect(() => {
    if (!isJobDescription) {
      setAttachMode(false)
      setParentSubmission(null)
    }
  }, [isJobDescription])

  useEffect(() => {
    if (!attachMode || parentSubmission || !parentQuery.trim()) {
      setParentResults([])
      return
    }
    let cancelled = false
    setParentSearchLoading(true)
    const timer = setTimeout(() => {
      api.get('/submissions/', {
        params: {
          search: parentQuery.trim(),
          form_type_code: ODU_RESTRUCTURE_CHECKLIST_FORM_CODES.join(','),
          page_size: 8,
        },
      })
        .then(res => {
          if (cancelled) return
          const rows = res.data.results ?? res.data
          setParentResults(Array.isArray(rows) ? rows : [])
        })
        .catch(() => { if (!cancelled) setParentResults([]) })
        .finally(() => { if (!cancelled) setParentSearchLoading(false) })
    }, 300)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [attachMode, parentQuery, parentSubmission])

  // Once a broad agenda category is picked, look up the specific digitized
  // form types filed under it (e.g. "Resignation / Retirement / Death" covers
  // Age Retirement, Medical Retirement, Death in Service, and Redundancy —
  // each a different form) so the ministry can pick exactly which one applies.
  const [matchingFormTypes, setMatchingFormTypes] = useState([])
  const [formTypesLoading, setFormTypesLoading] = useState(false)

  useEffect(() => {
    setForm(f => ({ ...f, form_type_code: '' }))
    if (!form.agenda_category) {
      setMatchingFormTypes([])
      return
    }
    let cancelled = false
    setFormTypesLoading(true)
    api.get('/form-types/', { params: { agenda_category: form.agenda_category, active_only: '1' } })
      .then(res => {
        if (cancelled) return
        const rows = res.data.results ?? res.data
        const list = Array.isArray(rows) ? rows : []
        setMatchingFormTypes(list)
        // No real choice to make when there's exactly one match — select it
        // automatically instead of forcing a single-option dropdown click.
        if (list.length === 1) {
          setForm(f => ({ ...f, form_type_code: list[0].code }))
        }
      })
      .catch(() => { if (!cancelled) setMatchingFormTypes([]) })
      .finally(() => { if (!cancelled) setFormTypesLoading(false) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.agenda_category])

  const userMinistryId = user?.ministry?.id ?? user?.ministry_id ?? null
  const userMinistry = isMinistryUser
    ? ministries.find(m => m.id === userMinistryId)
    : null

  useEffect(() => {
    if (!isMinistryUser && ministries.length > 0 && !form.ministry) {
      setForm(f => ({ ...f, ministry: String(ministries[0].id) }))
    }
  }, [ministries, isMinistryUser, form.ministry])

  const submit = async e => {
    e.preventDefault()
    if (!form.agenda_category) {
      setError('Please select a submission type.')
      return
    }
    if (matchingFormTypes.length > 0 && !form.form_type_code) {
      setError('Please select the specific submission type.')
      return
    }
    if (!form.title.trim()) {
      setError('Please enter a title / subject.')
      return
    }
    if (attachMode) {
      if (!parentSubmission) {
        setError('Please search for and select the Form 2.1 restructure this Job Description belongs to.')
        return
      }
    } else {
      if (!isMinistryUser && !form.ministry) {
        setError('Please select a ministry.')
        return
      }
      if (!form.department && !isMinistryWideForm) {
        setError('Please select a department.')
        return
      }
    }
    setBusy(true)
    setError('')
    try {
      const payload = {
        title: form.title.trim(),
        agenda_category: form.agenda_category,
        received_at: new Date().toISOString(),
        notes: form.notes,
        notify_emails: form.notify_emails,
        applicant_email: form.applicant_email.trim(),
      }
      if (form.form_type_code) payload.form_type_code = form.form_type_code
      if (attachMode && parentSubmission) {
        payload.is_attachment = true
        payload.parent_submission = parentSubmission.id
        // Ministry/department/unit are copied server-side from the parent.
      } else {
        if (!isMinistryUser && form.ministry) payload.ministry = Number(form.ministry)
        if (form.department) payload.department = Number(form.department)
        if (form.unit) payload.unit = Number(form.unit)
      }

      const { data: submission } = await api.post('/submissions/', payload)
      toast.success('Submission created. Complete documents and submit when ready.')
      if (onSuccess) onSuccess(submission.id)
      else navigate(`/submissions/${submission.id}`)
    } catch (err) {
      const detail = err.response?.data
      let msg = 'Could not create submission.'
      if (typeof detail === 'object' && detail !== null) {
        if (detail.ministry) {
          msg = Array.isArray(detail.ministry) ? detail.ministry.join(' ') : String(detail.ministry)
        } else if (detail.parent_submission) {
          msg = Array.isArray(detail.parent_submission) ? detail.parent_submission.join(' ') : String(detail.parent_submission)
        } else if (detail.agenda_category) {
          msg = Array.isArray(detail.agenda_category) ? detail.agenda_category.join(' ') : String(detail.agenda_category)
        } else if (detail.detail) {
          msg = String(detail.detail)
        } else {
          msg = JSON.stringify(detail)
        }
      }
      setError(msg)
      toast.error(msg)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <DeadlineBanner />

      {error && (
        <BaseMessageBar intent="error" className="mb-4">{error}</BaseMessageBar>
      )}

      <form onSubmit={submit} className={modal ? 'space-y-4' : 'card p-6 space-y-4 max-w-3xl'}>
        <div>
          <BaseSelect
            label="Submission type"
            required
            placeholder="— Select submission type —"
            value={form.agenda_category}
            options={[...new Map(lodgeSections.map(s => [s.value, {
              value: s.value,
              label: s.label.replace(/^\d+\.\s*/, ''),
            }])).values()]}
            onChange={(_, value) => setForm(f => ({ ...f, agenda_category: value }))}
          />
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Select the type of matter being submitted.
            {lodgeSections.find(s => s.value === form.agenda_category)?.digitizedFormCode && (
              <> A linked digitized form ({lodgeSections.find(s => s.value === form.agenda_category).digitizedFormCode}) will open on the submission page.</>
            )}
            {' '}Scanned papers can still be attached as documents.
          </p>
        </div>

        {form.agenda_category && matchingFormTypes.length > 1 && (
          <div>
            <BaseSelect
              label="Specific submission type"
              required
              disabled={formTypesLoading}
              placeholder={formTypesLoading ? 'Loading…' : '— Select specific type —'}
              value={form.form_type_code}
              options={matchingFormTypes.map(ft => ({ value: ft.code, label: ft.name }))}
              onChange={(_, value) => setForm(f => ({ ...f, form_type_code: value }))}
            />
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              This determines which digitized form and required-document checklist apply.
            </p>
          </div>
        )}

        <BaseInput
          label="Title / subject"
          required
          placeholder={TITLE_PLACEHOLDER_BY_FORM_TYPE[form.form_type_code] || DEFAULT_TITLE_PLACEHOLDER}
          value={form.title}
          onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
        />

        {isJobDescription && (
          <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-4 space-y-3">
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                id="jd-attach-mode"
                className="mt-1"
                checked={attachMode}
                onChange={e => {
                  setAttachMode(e.target.checked)
                  setParentSubmission(null)
                  setParentQuery('')
                }}
              />
              <label htmlFor="jd-attach-mode" className="text-sm text-slate-700 dark:text-slate-300">
                <span className="font-medium">This Job Description is for a position in a Restructure submission we've already lodged.</span>
                <br />
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Attach it to that Form 2.1 submission instead of lodging it standalone — it'll be reviewed
                  alongside the restructure, with no separate checklist or Director-General letter required.
                </span>
              </label>
            </div>

            {attachMode && (
              parentSubmission ? (
                <div className="flex items-center justify-between gap-3 rounded-md bg-slate-50 dark:bg-slate-800 px-3 py-2">
                  <div className="min-w-0 text-sm">
                    <span className="font-mono text-primary-600 dark:text-primary-400">{parentSubmission.reference_number}</span>
                    {' — '}
                    <span className="text-slate-700 dark:text-slate-300 truncate">{parentSubmission.title}</span>
                  </div>
                  <BaseButton type="button" variant="ghost" size="sm" onClick={() => { setParentSubmission(null); setParentQuery('') }}>
                    Change
                  </BaseButton>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="relative">
                    <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      className="input pl-8"
                      placeholder="Search by reference number or title…"
                      value={parentQuery}
                      onChange={e => setParentQuery(e.target.value)}
                    />
                  </div>
                  {parentSearchLoading && (
                    <p className="text-xs text-slate-400">Searching…</p>
                  )}
                  {!parentSearchLoading && parentQuery.trim() && parentResults.length === 0 && (
                    <p className="text-xs text-slate-400">No matching restructure submissions found.</p>
                  )}
                  {parentResults.length > 0 && (
                    <ul className="divide-y divide-slate-100 dark:divide-slate-700 border border-slate-200 dark:border-slate-700 rounded-md overflow-hidden">
                      {parentResults.map(r => (
                        <li key={r.id}>
                          <button
                            type="button"
                            className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
                            onClick={() => { setParentSubmission(r); setParentQuery('') }}
                          >
                            <span className="font-mono text-primary-600 dark:text-primary-400">{r.reference_number}</span>
                            {' — '}
                            <span className="text-slate-700 dark:text-slate-300">{r.title}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )
            )}
          </div>
        )}

        {!attachMode && (
          <>
            {isMinistryUser ? (
              <div className="space-y-4">
                <BaseInput label="Ministry" readOnly value={userMinistry?.name ?? '—'} />
                <div>
                  <BaseSelect
                    label="Department"
                    required={!isMinistryWideForm}
                    placeholder={isMinistryWideForm ? '— Ministry-wide, no single department —' : '— Select department —'}
                    value={form.department}
                    options={departments.map(d => ({ value: String(d.id), label: d.name }))}
                    onChange={(_, value) => setForm(f => ({ ...f, department: value, unit: '' }))}
                  />
                  {isMinistryWideForm && (
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      This combines every department's plan or performance — leave this blank unless you're
                      lodging on behalf of one department specifically.
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <BaseSelect
                  label="Ministry"
                  required
                  disabled={ministries.length === 1}
                  value={form.ministry}
                  options={ministries.map(m => ({ value: String(m.id), label: m.name }))}
                  onChange={(_, value) => setForm(f => ({ ...f, ministry: value, department: '', unit: '' }))}
                />
                <div>
                  <BaseSelect
                    label="Department"
                    required={!isMinistryWideForm}
                    placeholder={isMinistryWideForm ? '— Ministry-wide, no single department —' : '— Select department —'}
                    value={form.department}
                    options={departments
                      .filter(d => !form.ministry || String(d.ministry) === String(form.ministry))
                      .map(d => ({ value: String(d.id), label: d.name }))}
                    onChange={(_, value) => setForm(f => ({ ...f, department: value, unit: '' }))}
                  />
                  {isMinistryWideForm && (
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      This combines every department's plan or performance — leave this blank unless you're
                      lodging on behalf of one department specifically.
                    </p>
                  )}
                </div>
              </div>
            )}
            {availUnits.length > 0 && (
              <BaseSelect
                label="Unit (optional)"
                placeholder="—"
                value={form.unit}
                disabled={!form.department}
                options={availUnits.map(u => ({ value: String(u.id), label: u.name }))}
                onChange={(_, value) => setForm(f => ({ ...f, unit: value }))}
              />
            )}
          </>
        )}

        <BaseTextarea
          label="Notes"
          rows={3}
          value={form.notes}
          onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
        />

        <EmailChipInput
          label="Notify additional people (optional)"
          hint="They'll get an email with the reference number and a link to track progress — no account needed."
          value={form.notify_emails}
          onChange={emails => setForm(f => ({ ...f, notify_emails: emails }))}
          max={8}
        />

        <BaseInput
          label="Applicant email (optional)"
          type="email"
          hint="The employee/public servant this submission concerns. They'll be emailed a private tracking code, so they can check status without needing an account."
          value={form.applicant_email}
          onChange={e => setForm(f => ({ ...f, applicant_email: e.target.value }))}
        />

        <div className="flex items-center gap-3 pt-2">
          <BaseButton type="submit" variant="primary" loading={busy} loadingLabel="Saving" disabled={sectionsLoading || formTypesLoading}>
            Create submission
          </BaseButton>
          {modal && onClose && (
            <BaseButton type="button" variant="secondary" onClick={onClose}>Cancel</BaseButton>
          )}
        </div>
      </form>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal Submission Form (CSU Manager / ODU)
// ─────────────────────────────────────────────────────────────────────────────

function InternalSubmissionForm({ modal, onClose, onSuccess, internalFormTypes, isCsuUser }) {
  const navigate = useNavigate()
  const toast = useToast()

  const [form, setForm] = useState({ form_type_code: '', title: '', notes: '' })
  const [attachments, setAttachments] = useState([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  // Derive category id from the first internal form type (they all share the same category)
  const categoryId = internalFormTypes[0]?.form_category ?? null

  const submit = async e => {
    e.preventDefault()
    if (!form.form_type_code) { setError('Please select a submission type.'); return }
    if (!form.title.trim()) { setError('Please enter a title.'); return }

    setBusy(true)
    setError('')

    try {
      const payload = {
        title: form.title.trim(),
        form_type_code: form.form_type_code,
        ...(categoryId ? { form_category: categoryId } : {}),
        notes: form.notes,
        received_at: new Date().toISOString(),
        // ministry is intentionally omitted — the backend auto-resolves it
        // from the submitter's profile or the OPSC ministry record.
      }

      // For internal submitters the backend auto-binds their unit; we still need to
      // satisfy the serializer's ministry requirement. Send the first available ministry
      // if the form doesn't need one — backend will override with is_internal=True.
      const { data: submission } = await api.post('/submissions/', payload)

      // Upload documents if any were attached
      if (attachments.length > 0) {
        const fd = new FormData()
        attachments.forEach(item => {
          fd.append('files', item.file)
          fd.append('document_names', item.name || item.file.name)
        })
        await api.post(`/submissions/${submission.id}/documents/`, fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
      }

      toast.success('Internal submission created successfully.')
      if (onSuccess) onSuccess(submission.id)
      else navigate(`/submissions/${submission.id}`)
    } catch (err) {
      const detail = err.response?.data
      const msg = typeof detail === 'object' ? JSON.stringify(detail) : 'Could not create submission.'
      setError(msg)
      toast.error(msg)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      {!modal && (
        <PageHeader
          title="New internal submission"
          subtitle={isCsuUser
            ? "Routed to the HR Unit for checklist review and assessment, same as any other submission."
            : "OPSC internal submissions route directly to the Secretary for review."}
        />
      )}

      <DeadlineBanner />

      {error && (
        <BaseMessageBar intent="error" className="mb-4">{error}</BaseMessageBar>
      )}

      <form onSubmit={submit} className={modal ? 'space-y-4' : 'card p-6 space-y-4 max-w-3xl'}>

        <BaseSelect
          label="Submission type"
          required
          placeholder="— Select type —"
          value={form.form_type_code}
          options={internalFormTypes.map(ft => ({ value: ft.code, label: ft.name }))}
          onChange={(_, value) => setForm(f => ({ ...f, form_type_code: value }))}
        />

        <BaseInput
          label="Title / subject"
          required
          placeholder="e.g. Contract renewal for John Smith"
          value={form.title}
          onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
        />

        <BaseTextarea
          label="Notes"
          rows={3}
          placeholder="Any additional context for the Secretary…"
          value={form.notes}
          onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
        />

        {/* Free-form document upload */}
        <InternalDocumentUpload files={attachments} onChange={setAttachments} />

        <div className="flex items-center gap-3 pt-2">
          <BaseButton type="submit" variant="primary" loading={busy} loadingLabel="Saving">
            {modal ? 'Submit' : 'Create Submission'}
          </BaseButton>
          {modal && (
            <BaseButton type="button" variant="secondary" onClick={onClose}>
              Cancel
            </BaseButton>
          )}
        </div>
      </form>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main export — standard external form + internal branch
// ─────────────────────────────────────────────────────────────────────────────

/** @param {'commission'|'secretary'|null} createMode — entry path from Submission log buttons */
export default function SubmissionForm({ modal = false, onClose, onSuccess, createMode = null }) {
  const { user } = useAuth()

  const [ministries, setMinistries] = useState([])
  const [departments, setDepartments] = useState([])
  const [units, setUnits] = useState([])
  const [categories, setCategories] = useState([])
  const [formTypes, setFormTypes] = useState(FALLBACK_FORM_TYPES)

  const isInternalUser = user && INTERNAL_ROLES.includes(user.role)
  const isCsuUser = user && user.role === CSU_ROLE
  const isIpduUser = user && user.role === IPDU_ROLE
  const isComplianceUser = user && isComplianceRole(user.role)
  const isMinistryUser = user && ['ministry_hr', 'dept_admin', 'head_of_agency'].includes(user.role)

  const internalFormTypesResolved = formTypes.filter(ft => {
    const cat = categories.find(c => String(c.id) === String(ft.form_category))
    return cat?.code === 'INTERNAL' || cat?.name === 'Internal Submissions'
  })

  // CSU Manager: same submission types as the HR Unit (routed_unit === 'hr'),
  // not the dedicated internal-only catalog.
  const csuFormTypesResolved = formTypes.filter(ft => ft.routed_unit === 'hr')

  // Manager IPDU: its own dedicated catalog (IPDU-TASKFORCE / IPDU-ALLOWANCE).
  const ipduFormTypesResolved = formTypes.filter(ft => ft.routed_unit === 'ipdu')

  // Compliance unit: COMP-* submission types (routed_unit === 'compliance').
  const complianceFormTypesResolved = formTypes.filter(ft => ft.routed_unit === 'compliance')

  const allowed = user && SUBMISSION_CREATE_ALLOWED_ROLES.includes(user.role)

  useEffect(() => {
    Promise.all([
      api.get('/ministries/'),
      api.get('/form-categories/'),
      api.get('/form-types/', { params: { active_only: '1' } }),
    ]).then(([m, c, ft]) => {
      setMinistries(m.data)
      setCategories(c.data)
      setFormTypes(ft.data)
    })
  }, [])

  useEffect(() => {
    const userMid = user?.ministry?.id ?? user?.ministry_id ?? null
    const mid = (isMinistryUser && userMid) ? userMid : ministries[0]?.id
    if (!mid) {
      setDepartments([])
      return
    }
    api.get('/departments/', { params: { ministry: mid } }).then(res => setDepartments(res.data))
    api.get('/units/', { params: { ministry: mid } }).then(res => setUnits(res.data.results || res.data))
  }, [ministries, isMinistryUser, user?.ministry?.id, user?.ministry_id])

  if (!user) {
    return modal
      ? <p className="text-sm text-slate-500 py-4">Loading…</p>
      : <div><PageHeader title="New submission" subtitle="Loading…" /></div>
  }

  if (!allowed) {
    return modal
      ? <p className="text-sm text-slate-500 py-4">Only PSC staff or Ministry HR/Admin can log submissions.</p>
      : (
        <div>
          <PageHeader
            title="New submission"
            subtitle="Only PSC staff or Ministry HR/Admin can log submissions for tracking."
          />
        </div>
      )
  }

  // ── Receptionist intake route disabled by admin ────────────────────────
  if (user.role === 'receptionist' && user.intake_receptionist_enabled === false) {
    const msg = 'Receptionist intake is currently disabled by your administrator.'
    return modal
      ? <p className="text-sm text-slate-600 py-4">{msg}</p>
      : <div><PageHeader title="New submission" subtitle={msg} /></div>
  }

  // ── Compliance: same internal-submission form as CSU/HR, COMP-* types ──
  if (isComplianceUser) {
    return (
      <InternalSubmissionForm
        modal={modal}
        onClose={onClose}
        onSuccess={onSuccess}
        internalFormTypes={complianceFormTypesResolved}
        isCsuUser={false}
      />
    )
  }

  // ── CSU Manager: simplified internal form, HR Unit's submission types ──
  if (isCsuUser) {
    return (
      <InternalSubmissionForm
        modal={modal}
        onClose={onClose}
        onSuccess={onSuccess}
        internalFormTypes={csuFormTypesResolved}
        isCsuUser
      />
    )
  }

  // ── Manager IPDU: simplified internal form, IPDU's own submission types ──
  // The Task Force / Allowance Payment board paper itself is filled in
  // afterward on the submission detail page (IPDUBoardPaperForm), same as
  // ORG-3.1's checklist/board paper — this form only captures title + type.
  if (isIpduUser) {
    return (
      <InternalSubmissionForm
        modal={modal}
        onClose={onClose}
        onSuccess={onSuccess}
        internalFormTypes={ipduFormTypesResolved}
        isCsuUser={false}
      />
    )
  }

  // ── Route internal users to their own simplified form ───────────────────
  if (isInternalUser) {
    return (
      <InternalSubmissionForm
        modal={modal}
        onClose={onClose}
        onSuccess={onSuccess}
        internalFormTypes={internalFormTypesResolved}
      />
    )
  }

  const effectiveMode = createMode || 'commission'

  // ── Direct ministry (HR) submission route disabled by admin ─────────────
  if (isMinistryUser && effectiveMode === 'commission' && user.intake_hr_enabled === false) {
    const msg = 'Direct ministry submission is currently disabled. Please deliver the signed submission to the PSC registry — the Receptionist will lodge it on your behalf.'
    return modal
      ? <p className="text-sm text-slate-600 py-4">{msg}</p>
      : <div><PageHeader title="New submission" subtitle={msg} /></div>
  }

  return (
    <div>
      {!modal && (
        <PageHeader
          title="Submit for Commission"
          subtitle="Reference PSC-YYYY-##### is assigned automatically on save."
        />
      )}
      <CommissionSubmissionForm
        modal={modal}
        onClose={onClose}
        onSuccess={onSuccess}
        ministries={ministries}
        departments={departments}
        units={units}
        isMinistryUser={isMinistryUser}
      />
    </div>
  )
}
