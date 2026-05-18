import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PageHeader from '../../components/shared/PageHeader'
import api from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import PSCForm37Fields from './PSCForm37Fields'

// Fallback used only while form types are loading from the API
const FALLBACK_FORM_TYPES = []

const EMPTY_FORM37 = {
  proposed_employee_name: '',
  is_established_post: false,
  post_title: '',
  post_number: '',
  post_level: '',
  reasons_for_employment: '',
  how_selected: '',
  employment_type: '',
  period_from: '',
  period_to: '',
  salary_vt: '',
  salary_scale: '',
  director_name: '',
  director_department: '',
  director_date: '',
  dg_name: '',
  dg_ministry: '',
  dg_date: '',
}

export default function SubmissionForm({ modal = false, onClose, onSuccess }) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const toast = useToast()
  const [ministries, setMinistries] = useState([])
  const [departments, setDepartments] = useState([])
  const [categories, setCategories] = useState([])
  const [formTypes, setFormTypes] = useState(FALLBACK_FORM_TYPES)
  const [form, setForm] = useState({
    title: '',
    form_category: '',
    form_type_code: '',
    form_type_other: '',
    ministry: '',
    department: '',
    notes: '',
  })
  const [form37, setForm37] = useState(EMPTY_FORM37)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const isPSC37 = form.form_type_code === 'PSC 3-7'
  const isMinistryUser = user && ['ministry_hr', 'dept_admin'].includes(user.role)

  // Filter PSC forms to only those belonging to the selected category
  const filteredFormTypes = form.form_category
    ? formTypes.filter(ft => String(ft.form_category) === String(form.form_category))
    : formTypes

  const selectedFormType = formTypes.find(ft => ft.code === form.form_type_code) || null
  const hasNoDigitizedForm = form.form_type_code && form.form_type_code !== 'other' && selectedFormType && !selectedFormType.is_digitized

  const allowed =
    user && ['psc_officer', 'psc_admin', 'psc_secretary', 'ministry_hr', 'dept_admin'].includes(user.role)

  useEffect(() => {
    Promise.all([
      api.get('/ministries/'),
      api.get('/form-categories/'),
      api.get('/form-types/', { params: { active_only: '1' } }),
    ]).then(([m, c, ft]) => {
      setMinistries(m.data)
      setCategories(c.data)
      setFormTypes(ft.data)
      setForm(f => ({
        ...f,
        ministry: m.data[0]?.id?.toString() || '',
        form_category: c.data[0]?.id?.toString() || '',
      }))
    })
  }, [])

  useEffect(() => {
    const mid = form.ministry
    if (!mid) {
      setDepartments([])
      return
    }
    api.get('/departments/', { params: { ministry: mid } }).then(res => {
      setDepartments(res.data)
    })
  }, [form.ministry])

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

  const submit = async e => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const effectiveCode = form.form_type_code === 'other'
        ? form.form_type_other
        : form.form_type_code

      const payload = {
        title: isPSC37
          ? (form.title || `PSC 3-7 — ${form37.proposed_employee_name || 'New Request'}`)
          : form.title,
        form_category: Number(form.form_category),
        form_type_code: effectiveCode || '',
        ministry: Number(form.ministry),
        received_at: new Date().toISOString(),
        notes: form.notes,
      }
      if (form.department) payload.department = Number(form.department)

      const { data: submission } = await api.post('/submissions/', payload)

      // If PSC 3-7, save the structured form data
      if (isPSC37) {
        const form37Payload = { ...form37 }
        // Convert empty date strings to null for the API
        ;['period_from', 'period_to', 'director_date', 'dg_date'].forEach(k => {
          if (!form37Payload[k]) form37Payload[k] = null
        })
        await api.post(`/submissions/${submission.id}/form37/`, form37Payload)
      }

      toast.success('Submission created successfully.')
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
          title="Log new submission"
          subtitle="Tracking begins when PSC logs receipt — reference PSC-YYYY-##### is assigned automatically."
        />
      )}

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-200">
          {error}
        </div>
      )}

      <form onSubmit={submit} className={modal ? 'space-y-4' : 'card p-6 space-y-4 max-w-3xl'}>

        {/* ── Form type (drives conditional rendering) ──────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Form category</label>
            <select
              className="input"
              required
              value={form.form_category}
              onChange={e => setForm({ ...form, form_category: e.target.value, form_type_code: '', form_type_other: '' })}
            >
              <option value="">— Select category —</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">PSC Form</label>
            <select
              className="input"
              value={form.form_type_code}
              onChange={e => setForm({ ...form, form_type_code: e.target.value, form_type_other: '' })}
            >
              <option value="">— Select PSC form —</option>
              {filteredFormTypes.length === 0 && form.form_category && (
                <option disabled value="">No forms for this category yet</option>
              )}
              {filteredFormTypes.map(ft => (
                <option key={ft.id} value={ft.code}>
                  {ft.code}{ft.name ? ` — ${ft.name}` : ''}
                </option>
              ))}
              <option value="other">Other (specify below)</option>
            </select>
            {form.form_type_code === 'other' && (
              <input
                className="input mt-2"
                placeholder="Enter form code"
                value={form.form_type_other}
                onChange={e => setForm({ ...form, form_type_other: e.target.value })}
              />
            )}
            {hasNoDigitizedForm && (
              <p className="mt-2 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
                No digitized form is available for <strong>{form.form_type_code}</strong> yet. You can still log the submission and attach the scanned document.
              </p>
            )}
            {form.form_type_code && selectedFormType?.is_digitized && (
              <p className="mt-2 text-xs text-emerald-600 dark:text-emerald-400">
                A digitized form is available — you will be able to fill it in after logging the submission.
              </p>
            )}
          </div>
        </div>

        {/* ── Title — hidden for PSC 3-7 on full page (auto-generated from employee name); always shown in modal */}
        {(!isPSC37 || modal) && (
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Title / subject</label>
            <input
              className="input"
              required
              value={form.title}
              onChange={e => setForm({ ...form, title: e.target.value })}
            />
          </div>
        )}

        {/* ── Ministry / Department ─────────────────────────────────── */}
        {isMinistryUser ? (
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Department</label>
            <select
              className="input"
              value={form.department}
              onChange={e => setForm({ ...form, department: e.target.value })}
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
                className="input disabled:bg-slate-50 disabled:text-slate-500"
                required
                disabled={ministries.length === 1}
                value={form.ministry}
                onChange={e => setForm({ ...form, ministry: e.target.value, department: '' })}
              >
                {ministries.map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
              {ministries.length === 1 && (
                <p className="mt-1 text-xs text-slate-500">Your account is restricted to {ministries[0].name}.</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Department (optional)</label>
              <select
                className="input"
                value={form.department}
                onChange={e => setForm({ ...form, department: e.target.value })}
              >
                <option value="">—</option>
                {departments.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {(!isPSC37 || modal) && (
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Notes</label>
            <textarea className="input min-h-[100px]" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
          </div>
        )}

        {/* ── PSC Form 3-7 digitized fields — full page only, not the popover ── */}
        {isPSC37 && !modal && (
          <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-700">
            <div className="mb-4">
              <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">
                PSC Form 3-7 — Request Details
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Complete all sections below. Required supporting documents should be uploaded after submission.
              </p>
            </div>
            <PSCForm37Fields form37={form37} setForm37={setForm37} />

            <div className="mt-4">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Additional notes (optional)</label>
              <textarea className="input min-h-[80px]" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
            </div>

            <div className="mt-4 rounded-md border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 px-4 py-2.5 text-xs text-blue-700 dark:text-blue-300">
              After submitting, you will be taken to the submission page where you can upload required attachments:
              PSC Form 3-2 (Job Application), approved job description, financial visa (if applicable), and Agreement of Service (for contract employees).
            </div>
          </div>
        )}

        <div className="flex items-center gap-3 pt-2">
          <button type="submit" className="btn-primary px-6 py-2.5" disabled={busy}>
            {busy ? 'Saving…' : modal ? 'Log Submission' : isPSC37 ? 'Submit Form 3-7' : 'Create Submission'}
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
