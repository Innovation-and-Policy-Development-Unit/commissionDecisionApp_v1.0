import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PageHeader from '../../components/shared/PageHeader'
import api from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { isComplianceRole } from '../../constants/compliance'

/**
 * New submission flow for Compliance Senior, Principal, and Manager.
 * Form types are filtered server-side (PSA restricted to Principal & Manager).
 */
export default function ComplianceSubmissionForm({ modal = false, onClose, onSuccess }) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const toast = useToast()

  const [formTypes, setFormTypes] = useState([])
  const [loadingTypes, setLoadingTypes] = useState(true)
  const [form, setForm] = useState({ form_type_code: '', title: '', notes: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!user || !isComplianceRole(user.role)) return
    setLoadingTypes(true)
    api.get('/form-types/', { params: { active_only: '1', audience: 'compliance' } })
      .then(res => {
        const list = Array.isArray(res.data) ? res.data : (res.data?.results ?? [])
        setFormTypes(list.sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0)))
      })
      .catch(() => setFormTypes([]))
      .finally(() => setLoadingTypes(false))
  }, [user])

  if (!user) {
    return modal
      ? <p className="text-sm text-slate-500 py-4">Loading…</p>
      : <div><PageHeader title="New compliance submission" subtitle="Loading…" /></div>
  }

  if (!isComplianceRole(user.role)) {
    const denied = (
      <p className="text-sm text-slate-500">
        Only Compliance Senior, Principal, and Manager roles can create compliance submissions here.
      </p>
    )
    return modal ? denied : (
      <div>
        <PageHeader title="New compliance submission" subtitle="Access restricted" />
        <div className="card p-6">{denied}</div>
      </div>
    )
  }

  const submit = async e => {
    e.preventDefault()
    setError('')
    if (!form.form_type_code) {
      setError('Please select a submission type.')
      return
    }
    if (!form.title.trim()) {
      setError('Please enter a title for this submission.')
      return
    }
    setBusy(true)
    try {
      const selected = formTypes.find(ft => ft.code === form.form_type_code)
      const payload = {
        title: form.title.trim(),
        form_type_code: form.form_type_code,
        notes: form.notes,
        received_at: new Date().toISOString(),
      }
      if (selected?.form_category) {
        payload.form_category = selected.form_category
      }
      const { data } = await api.post('/submissions/', payload)
      toast.success('Compliance submission created. Complete the digitized form on the detail page.')
      if (onSuccess) onSuccess(data)
      else navigate(`/submissions/${data.id}`)
      if (modal && onClose) onClose()
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Could not create submission.')
    } finally {
      setBusy(false)
    }
  }

  const inner = (
    <form onSubmit={submit} className="space-y-5">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-200">
          {error}
        </div>
      )}

      <div>
        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-1.5">
          Submission type <span className="text-red-500">*</span>
        </label>
        {loadingTypes ? (
          <p className="text-sm text-slate-500">Loading types…</p>
        ) : formTypes.length === 0 ? (
          <p className="text-sm text-amber-700 dark:text-amber-300">
            No submission types are available for your role. Contact an administrator if this is unexpected.
          </p>
        ) : (
          <select
            className="input w-full"
            value={form.form_type_code}
            onChange={e => {
              const code = e.target.value
              const ft = formTypes.find(t => t.code === code)
              setForm(f => ({
                ...f,
                form_type_code: code,
                title: f.title || (ft?.name ?? ''),
              }))
            }}
            required
          >
            <option value="">Select type…</option>
            {formTypes.map(ft => (
              <option key={ft.code} value={ft.code}>
                {ft.name}
              </option>
            ))}
          </select>
        )}
        {user.role === 'compliance_senior' && (
          <p className="mt-1.5 text-xs text-slate-500">
            Proposed Amendment to the Public Service Act is available only to Compliance Principal and Manager.
          </p>
        )}
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-1.5">
          Title <span className="text-red-500">*</span>
        </label>
        <input
          className="input w-full"
          value={form.title}
          onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
          placeholder="Short description for tracking and agenda"
          required
        />
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-1.5">
          Notes (optional)
        </label>
        <textarea
          className="input w-full min-h-[80px]"
          value={form.notes}
          onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
          placeholder="Internal notes for PSC / Compliance unit"
        />
      </div>

      <p className="text-xs text-slate-500 dark:text-slate-400">
        After creating, open the submission to complete the digitized form fields and attach supporting documents.
      </p>

      <div className="flex flex-wrap gap-3 pt-2">
        <button type="submit" className="btn-primary" disabled={busy || loadingTypes || !formTypes.length}>
          {busy ? 'Creating…' : 'Create & open form'}
        </button>
        {modal && onClose && (
          <button type="button" className="btn-secondary" onClick={onClose} disabled={busy}>
            Cancel
          </button>
        )}
      </div>
    </form>
  )

  if (modal) return inner

  return (
    <div>
      <PageHeader
        title="New compliance submission"
        subtitle="Compliance unit — digitized disciplinary, PSDB, Ombudsman, and related submissions"
      />
      <div className="card p-6 max-w-2xl">{inner}</div>
    </div>
  )
}
