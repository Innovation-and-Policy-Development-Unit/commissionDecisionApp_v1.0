import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PageHeader from '../../components/shared/PageHeader'
import api from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import ComplianceCmsGuidance from './ComplianceCmsGuidance'
import { isComplianceRole } from '../../constants/compliance'
import {
  isForm44Code,
  travelApprovalRoute,
  travelWorkflowHint,
  isTravelFormCode,
  TRAVEL_CATEGORY_CODE,
} from '../../constants/travel'
import { filterSecretaryFormTypes } from '../../constants/submissionCreate'
import { useAgendaSections } from '../../hooks/useAgendaSections'

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const FALLBACK_FORM_TYPES = []

/** Roles that submit OPSC-internal submissions (no checklist, straight to Secretary). */
const INTERNAL_ROLES = ['csu_manager', 'odu_manager', 'odu_principal']

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
              <input
                className="input flex-1 text-sm py-1"
                placeholder={`Document name (e.g. "Director Letter") — leave blank to use file name`}
                value={item.name}
                onChange={e => updateName(idx, e.target.value)}
              />
              <span className="text-xs text-slate-400 shrink-0 max-w-[120px] truncate" title={item.file.name}>
                {item.file.name}
              </span>
              <button
                type="button"
                onClick={() => remove(idx)}
                className="text-red-400 hover:text-red-600 text-lg leading-none shrink-0"
                aria-label="Remove file"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Travel submission form (Traveller — PSC 4.4 / 4.5 / 4.6)
// ─────────────────────────────────────────────────────────────────────────────

function TravelSubmissionForm({ modal, onClose, onSuccess, formTypes, categories, ministries, departments, user }) {
  const navigate = useNavigate()
  const toast = useToast()
  const [form, setForm] = useState({
    title: '',
    form_type_code: '',
    department: '',
    notes: '',
  })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const categoryId = categories[0]?.id

  useEffect(() => {
    if (user?.department_id && !form.department) {
      setForm(f => ({ ...f, department: String(user.department_id) }))
    }
  }, [user?.department_id, form.department])

  const submit = async e => {
    e.preventDefault()
    if (!form.form_type_code) { setError('Select a travel form type.'); return }
    setBusy(true)
    setError('')
    try {
      const payload = {
        title: form.title.trim(),
        form_type_code: form.form_type_code,
        ...(categoryId ? { form_category: categoryId } : {}),
        notes: form.notes,
        received_at: new Date().toISOString(),
        travel_endorsers: {},
      }
      if (form.department) payload.department = Number(form.department)
      const { data: submission } = await api.post('/submissions/', payload)
      toast.success('Travel request created. Complete the form and submit when ready.')
      if (onSuccess) onSuccess(submission.id)
      else navigate(`/submissions/${submission.id}`)
    } catch (err) {
      const msg = err.response?.data?.detail || 'Could not create travel request.'
      setError(typeof msg === 'object' ? JSON.stringify(msg) : msg)
      toast.error(String(msg))
    } finally {
      setBusy(false)
    }
  }

  const selectedDepartment = departments.find(d => String(d.id) === String(form.department)) || null
  const approvalRoute = travelApprovalRoute(form.form_type_code, user, {
    department: selectedDepartment,
    ministries,
    departmentId: form.department,
  })
  const workflowHint = travelWorkflowHint(form.form_type_code, user, form.department)
  const ministryCsuPath = !user?.department_id && user?.role === 'ministry_hr'

  return (
    <div>
      {!modal && (
        <PageHeader
          title="Secretary approval"
          subtitle="Lodged to the PSC Secretary — not the Commission."
        />
      )}
      <div className="mb-4 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900 dark:border-sky-800 dark:bg-sky-950/30 dark:text-sky-100">
        <strong>Secretary approval only.</strong> {workflowHint}
      </div>
      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}
      <form onSubmit={submit} className={modal ? 'space-y-4' : 'card p-6 space-y-4 max-w-3xl'}>
        <div>
          <label className="block text-sm font-medium mb-1">Travel form <span className="text-red-500">*</span></label>
          <select className="input" required value={form.form_type_code} onChange={e => setForm(f => ({ ...f, form_type_code: e.target.value }))}>
            <option value="">— Select —</option>
            {formTypes.map(ft => <option key={ft.code} value={ft.code}>{ft.code} — {ft.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Title / subject <span className="text-red-500">*</span></label>
          <input className="input" required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Overseas training — Port Vila workshop" />
        </div>
        {!ministryCsuPath && (
          <div>
            <label className="block text-sm font-medium mb-1">Department</label>
            <select className="input" value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))}>
              <option value="">— Select department —</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
        )}
        {approvalRoute.length > 0 && (
          <div className="rounded-lg border border-sky-200 bg-sky-50 dark:bg-sky-950/20 p-4 space-y-2">
            <p className="text-sm font-medium text-sky-900 dark:text-sky-100">Approval route</p>
            <p className="text-xs text-sky-800/80 dark:text-sky-200/80">
              The system notifies the correct officials automatically. They sign on the submission
              page with their profile signature before it goes to ODU Manager, then the Secretary.
            </p>
            <ol className="list-decimal list-inside text-sm text-sky-900 dark:text-sky-100 space-y-0.5">
              {approvalRoute.map((step, i) => (
                <li key={i}>{step}</li>
              ))}
              <li>ODU Manager review</li>
              <li>PSC Secretary decision</li>
            </ol>
          </div>
        )}
        <div>
          <label className="block text-sm font-medium mb-1">Notes</label>
          <textarea className="input" rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
        </div>
        <div className="flex items-center gap-3 pt-2">
          <button type="submit" className="btn-primary px-6 py-2.5" disabled={busy}>
            {busy ? 'Saving…' : modal ? 'Create request' : 'Create travel request'}
          </button>
          {modal && onClose && (
            <button type="button" className="btn-secondary px-6 py-2.5" onClick={onClose}>Cancel</button>
          )}
        </div>
      </form>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Commission submission (ministry / PSC — full assessment → Commission)
// ─────────────────────────────────────────────────────────────────────────────

function CommissionSubmissionForm({
  modal, onClose, onSuccess, ministries, departments, isMinistryUser,
}) {
  const navigate = useNavigate()
  const toast = useToast()
  const { sections: lodgeSections, loading: sectionsLoading } = useAgendaSections({ lodgeOnly: true })
  const [form, setForm] = useState({
    title: '',
    agenda_category: 'other',
    ministry: '',
    department: '',
    notes: '',
  })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (ministries.length === 1 && !form.ministry) {
      setForm(f => ({ ...f, ministry: String(ministries[0].id) }))
    }
  }, [ministries, form.ministry])

  const submit = async e => {
    e.preventDefault()
    if (!form.agenda_category) {
      setError('Please select an agenda section.')
      return
    }
    if (!form.title.trim()) {
      setError('Please enter a title / subject.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const payload = {
        title: form.title.trim(),
        agenda_category: form.agenda_category,
        received_at: new Date().toISOString(),
        notes: form.notes,
      }
      if (!isMinistryUser && form.ministry) payload.ministry = Number(form.ministry)
      if (form.department) payload.department = Number(form.department)

      const { data: submission } = await api.post('/submissions/', payload)
      toast.success('Submission created. Complete documents and submit when ready.')
      if (onSuccess) onSuccess(submission.id)
      else navigate(`/submissions/${submission.id}`)
    } catch (err) {
      const detail = err.response?.data
      const msg = typeof detail === 'object'
        ? (detail.detail || JSON.stringify(detail))
        : 'Could not create submission.'
      setError(String(msg))
      toast.error(String(msg))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <div className="mb-4 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-900 dark:border-indigo-800 dark:bg-indigo-950/30 dark:text-indigo-100">
        This matter goes through <strong>PSC unit assessment</strong> and may be listed for a <strong>Commission sitting</strong>.
        Scanned <strong>PSC forms and supporting papers</strong> are attached after you create the submission.
        For overseas travel (Forms 4.5–4.6) or director domestic travel (Form 4.4), use <strong>Secretary approval</strong>.
      </div>

      <DeadlineBanner />

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-200">
          {error}
        </div>
      )}

      <form onSubmit={submit} className={modal ? 'space-y-4' : 'card p-6 space-y-4 max-w-3xl'}>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Agenda section <span className="text-red-500">*</span>
          </label>
          <select
            className="input"
            required
            value={form.agenda_category}
            onChange={e => setForm(f => ({ ...f, agenda_category: e.target.value }))}
          >
            {lodgeSections.map(section => (
              <option key={section.value} value={section.value}>{section.label}</option>
            ))}
          </select>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Which Commission agenda section this matter belongs to.
            {lodgeSections.find(s => s.value === form.agenda_category)?.digitizedFormCode && (
              <> A linked digitized form ({lodgeSections.find(s => s.value === form.agenda_category).digitizedFormCode}) will open on the submission page.</>
            )}
            {' '}Scanned papers can still be attached as documents.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Title / subject <span className="text-red-500">*</span>
          </label>
          <input
            className="input"
            required
            placeholder="e.g. Appointment of Director Finance & Administration"
            value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
          />
        </div>

        {isMinistryUser ? (
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Department</label>
            <select
              className="input"
              value={form.department}
              onChange={e => setForm(f => ({ ...f, department: e.target.value }))}
            >
              <option value="">— Select department —</option>
              {departments.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Ministry</label>
              <select
                className="input"
                required
                disabled={ministries.length === 1}
                value={form.ministry}
                onChange={e => setForm(f => ({ ...f, ministry: e.target.value, department: '' }))}
              >
                {ministries.map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Department (optional)</label>
              <select
                className="input"
                value={form.department}
                onChange={e => setForm(f => ({ ...f, department: e.target.value }))}
              >
                <option value="">—</option>
                {departments.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Notes</label>
          <textarea
            className="input min-h-[80px]"
            value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
          />
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button type="submit" className="btn-primary px-6 py-2.5" disabled={busy || sectionsLoading}>
            {busy ? 'Saving…' : 'Create submission'}
          </button>
          {modal && onClose && (
            <button type="button" className="btn-secondary px-6 py-2.5" onClick={onClose}>Cancel</button>
          )}
        </div>
      </form>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal Submission Form (CSU Manager / ODU)
// ─────────────────────────────────────────────────────────────────────────────

function InternalSubmissionForm({ modal, onClose, onSuccess, internalFormTypes }) {
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
          subtitle="OPSC internal submissions route directly to the Secretary for review."
        />
      )}

      <DeadlineBanner />

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 dark:border-red-900/40 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-200">
          {error}
        </div>
      )}

      <form onSubmit={submit} className={modal ? 'space-y-4' : 'card p-6 space-y-4 max-w-3xl'}>

        {/* Submission type */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Submission type <span className="text-red-500">*</span>
          </label>
          <select
            className="input"
            required
            value={form.form_type_code}
            onChange={e => setForm(f => ({ ...f, form_type_code: e.target.value }))}
          >
            <option value="">— Select type —</option>
            {internalFormTypes.map(ft => (
              <option key={ft.id} value={ft.code}>
                {ft.name}
              </option>
            ))}
          </select>
        </div>

        {/* Title */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Title / subject <span className="text-red-500">*</span>
          </label>
          <input
            className="input"
            required
            placeholder="e.g. Contract renewal for John Smith"
            value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
          />
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Notes</label>
          <textarea
            className="input min-h-[80px]"
            placeholder="Any additional context for the Secretary…"
            value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
          />
        </div>

        {/* Free-form document upload */}
        <InternalDocumentUpload files={attachments} onChange={setAttachments} />

        <div className="flex items-center gap-3 pt-2">
          <button type="submit" className="btn-primary px-6 py-2.5" disabled={busy}>
            {busy ? 'Saving…' : modal ? 'Submit' : 'Create Submission'}
          </button>
          {modal && (
            <button type="button" className="btn-secondary px-6 py-2.5" onClick={onClose}>
              Cancel
            </button>
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
  const [categories, setCategories] = useState([])
  const [formTypes, setFormTypes] = useState(FALLBACK_FORM_TYPES)

  const isInternalUser = user && INTERNAL_ROLES.includes(user.role)
  const isComplianceUser = user && isComplianceRole(user.role)
  const isMinistryUser = user && ['ministry_hr', 'dept_admin', 'head_of_agency'].includes(user.role)

  const internalFormTypesResolved = formTypes.filter(ft => {
    const cat = categories.find(c => String(c.id) === String(ft.form_category))
    return cat?.code === 'INTERNAL' || cat?.name === 'Internal Submissions'
  })

  const allowed =
    user && ['psc_officer', 'psc_admin', 'psc_secretary', 'ministry_hr', 'dept_admin', 'head_of_agency',
              ...INTERNAL_ROLES, 'compliance_senior', 'compliance_principal', 'compliance_manager'].includes(user.role)

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
    const mid = (isMinistryUser && user?.ministry_id)
      ? user.ministry_id
      : ministries[0]?.id
    if (!mid) {
      setDepartments([])
      return
    }
    api.get('/departments/', { params: { ministry: mid } }).then(res => setDepartments(res.data))
  }, [ministries, isMinistryUser, user?.ministry_id])

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

  // ── Compliance: cases are created in CMS, not in this portal ───────────
  if (isComplianceUser) {
    return (
      <ComplianceCmsGuidance modal={modal} />
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
  const secretaryFormTypes = filterSecretaryFormTypes(formTypes, categories, user)
  const travelFormTypes = secretaryFormTypes.length
    ? secretaryFormTypes
    : formTypes.filter(ft => isTravelFormCode(ft.code) && !isForm44Code(ft.code))

  if (effectiveMode === 'secretary') {
    if (travelFormTypes.length === 0) {
      const msg = modal
        ? 'No secretary travel forms (4.4–4.6) are available for your role.'
        : null
      return modal ? <p className="text-sm text-slate-600 py-4">{msg}</p> : (
        <div><PageHeader title="Secretary approval" subtitle={msg} /></div>
      )
    }
    return (
      <TravelSubmissionForm
        modal={modal}
        onClose={onClose}
        onSuccess={onSuccess}
        formTypes={travelFormTypes}
        categories={categories.filter(c => c.code === TRAVEL_CATEGORY_CODE)}
        ministries={ministries}
        departments={departments}
        user={user}
      />
    )
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
        isMinistryUser={isMinistryUser}
      />
    </div>
  )
}
