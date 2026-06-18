import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ShieldPlus, ArrowRight } from 'lucide-react'
import api from '../../api/client'
import PageHeader from '../../components/shared/PageHeader'
import { CASE_FAMILIES, COMPLIANCE_FORM_CODES, WORKFLOW_ROUTES } from '../../constants/compliance'

function WorkflowPreview({ family }) {
  const route = WORKFLOW_ROUTES[family]
  if (!route || !route.milestones.length) return null
  return (
    <div className="rounded-lg border border-primary-200 bg-primary-50 dark:border-primary-900/40 dark:bg-primary-950/20 px-4 py-3">
      <p className="text-xs font-semibold text-primary-700 dark:text-primary-400 uppercase tracking-wide mb-2">Workflow stages that will be created</p>
      <div className="flex flex-wrap items-center gap-1">
        {route.milestones.map((m, i) => (
          <span key={m.code} className="flex items-center gap-1">
            <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${m.optional ? 'border border-slate-300 text-slate-500 dark:border-slate-600 dark:text-slate-400' : 'bg-primary-600 text-white'}`}>
              {m.label}{m.optional ? ' *' : ''}
            </span>
            {i < route.milestones.length - 1 && <ArrowRight size={10} className="text-slate-400 shrink-0" />}
          </span>
        ))}
      </div>
      <p className="mt-1.5 text-[10px] text-slate-400">* optional stage</p>
    </div>
  )
}

export default function NewComplianceCaseForm({ modal = false, onSuccess, onClose }) {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    case_family: 'employee_disciplinary',
    subject_name: '',
    subject_position: '',
    subject_ministry: '',
    is_senior_executive: false,
    form_type_code: 'COMP-SMDR',
    title: '',
    description: '',
    nature_of_offence_id: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [offences, setOffences] = useState([])

  useEffect(() => {
    api.get('/compliance/offence-types/?active=true')
      .then((r) => setOffences(Array.isArray(r.data) ? r.data : (r.data?.results || [])))
      .catch(() => setOffences([]))
  }, [])

  const set = (k) => (e) => {
    const v = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    setForm((f) => ({ ...f, [k]: v }))
  }

  const submit = async (e) => {
    e.preventDefault()
    if (!form.subject_name.trim()) { setError('Subject name is required.'); return }
    setSaving(true); setError('')
    try {
      const payload = {
        ...form,
        nature_of_offence_id: form.nature_of_offence_id ? Number(form.nature_of_offence_id) : null,
      }
      const res = await api.post('/compliance/cases/', payload)
      if (onSuccess) onSuccess(res.data)
      else navigate('/compliance/cases')
    } catch (e) {
      setError(e.response?.data?.detail || JSON.stringify(e.response?.data || {}) || 'Could not create case.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      {!modal && (
        <PageHeader title="New Compliance Case" subtitle="Open a statutory disciplinary, suspension, or grievance matter" />
      )}
      <form onSubmit={submit} className="max-w-2xl space-y-4">
        {error && (
          <div className="rounded-lg bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-300">{error}</div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Case family</label>
            <select className="form-input w-full" value={form.case_family} onChange={set('case_family')}>
              {CASE_FAMILIES.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Nature of offence</label>
            <select className="form-input w-full" value={form.nature_of_offence_id} onChange={set('nature_of_offence_id')}>
              <option value="">— Select offence —</option>
              <optgroup label="Minor / Disciplinary">
                {offences.filter((o) => o.category === 'minor').map((o) => (
                  <option key={o.id} value={o.id}>{o.label}</option>
                ))}
              </optgroup>
              <optgroup label="Serious Misconduct (Appendix C)">
                {offences.filter((o) => o.category === 'serious_misconduct').map((o) => (
                  <option key={o.id} value={o.id}>{o.label}</option>
                ))}
              </optgroup>
            </select>
          </div>
        </div>

        <WorkflowPreview family={form.case_family} />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Subject (public servant) name *</label>
            <input className="form-input w-full" value={form.subject_name} onChange={set('subject_name')} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Subject position</label>
            <input className="form-input w-full" value={form.subject_position} onChange={set('subject_position')} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Subject ministry / agency</label>
            <input className="form-input w-full" value={form.subject_ministry} onChange={set('subject_ministry')} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Primary form type</label>
            <select className="form-input w-full" value={form.form_type_code} onChange={set('form_type_code')}>
              {COMPLIANCE_FORM_CODES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.is_senior_executive} onChange={set('is_senior_executive')} />
          Subject is a senior executive (DG / Director / Secretary General / Auditor General)
        </label>

        <div>
          <label className="block text-sm font-medium mb-1">Title</label>
          <input className="form-input w-full" value={form.title} onChange={set('title')} placeholder="Short matter title" />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Description</label>
          <textarea className="form-input w-full" rows={4} value={form.description} onChange={set('description')} />
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button type="submit" disabled={saving} className="btn-primary flex items-center gap-2">
            <ShieldPlus size={16} /> {saving ? 'Creating…' : 'Create case'}
          </button>
          {onClose && (
            <button type="button" className="btn-outline" onClick={onClose}>Cancel</button>
          )}
        </div>
      </form>
    </div>
  )
}
