import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PageHeader from '../../components/shared/PageHeader'
import api from '../../api/client'
import { useToast } from '../../context/ToastContext'
import { useAgendaSections } from '../../hooks/useAgendaSections'
import BaseButton from '../../components/shared/BaseButton'
import BaseInput from '../../components/shared/BaseInput'
import BaseSelect from '../../components/shared/BaseSelect'
import BaseTextarea from '../../components/shared/BaseTextarea'
import BaseMessageBar from '../../components/shared/BaseMessageBar'

const today = () => new Date().toISOString().slice(0, 10)

/**
 * Pilot: CSU staff (Receptionist as back-up) scan the complete Acting-Secretary-signed
 * paper package for a ministry that is not on SCDMS and upload it here. The submission
 * is created at "Forwarded to Commission" and placed on the same agenda as online
 * submissions. Backend: POST /submissions/lodge-signed-paper/
 */
export default function LodgeSignedPaper() {
  const navigate = useNavigate()
  const toast = useToast()
  const { sections } = useAgendaSections({ lodgeOnly: true })
  const [ministries, setMinistries] = useState([])
  const [form, setForm] = useState({
    ministry: '', agenda_category: '', title: '', paper_signed_on: today(), notes: '',
  })
  const [files, setFiles] = useState([])
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState(null)

  useEffect(() => {
    api.get('/ministries/').then(r => setMinistries(r.data)).catch(() => {})
  }, [])

  const set = (key) => (e, value) =>
    setForm(f => ({ ...f, [key]: value !== undefined ? value : e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    setErrors({})
    setSaving(true)
    try {
      const body = new FormData()
      Object.entries(form).forEach(([k, v]) => body.append(k, v))
      files.forEach(f => body.append('files', f))
      const { data } = await api.post('/submissions/lodge-signed-paper/', body, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setResult(data)
      toast.success(`Lodged ${data.reference_number}`)
    } catch (err) {
      const data = err.response?.data
      if (data && typeof data === 'object') {
        setErrors(Object.fromEntries(
          Object.entries(data).map(([k, v]) => [k, Array.isArray(v) ? v.join(' ') : String(v)]),
        ))
      }
      toast.error(data?.detail || 'Could not lodge the signed package.')
    } finally {
      setSaving(false)
    }
  }

  const reset = () => {
    setResult(null)
    setFiles([])
    setForm(f => ({ ...f, title: '', notes: '', paper_signed_on: today() }))
  }

  if (result) {
    return (
      <div className="max-w-2xl space-y-4">
        <PageHeader title="Signed paper lodged" />
        <BaseMessageBar intent="success">
          {result.reference_number} is lodged.{' '}
          {result.placed_on_agenda
            ? `It was placed on the agenda for ${result.meeting}.`
            : 'No upcoming sitting was available, so it is waiting in the Sitting Workspace backlog for the Secretary to place.'}
        </BaseMessageBar>
        <div className="flex gap-2">
          <BaseButton onClick={reset}>Lodge another</BaseButton>
          <BaseButton variant="secondary" onClick={() => navigate(`/submissions/${result.id}`)}>View submission</BaseButton>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="max-w-2xl space-y-4">
      <PageHeader title="Lodge signed paper submission" />
      <p className="text-sm text-slate-600 dark:text-slate-400">
        For ministries not on SCDMS. Scan the complete package after the Acting Secretary has signed it
        (submission, attachments, checklist and assessment) and upload it here. It goes straight to the agenda.
      </p>

      <BaseSelect
        label="Ministry"
        required
        placeholder="— Select ministry —"
        value={form.ministry}
        options={ministries.map(m => ({ value: m.id, label: m.name }))}
        onChange={set('ministry')}
        error={errors.ministry}
      />
      <BaseSelect
        label="Agenda section"
        required
        placeholder="— Select agenda section —"
        value={form.agenda_category}
        options={sections.filter(s => !s.isSpecial).map(s => ({ value: s.value, label: s.label.replace(/^\d+\.\s*/, '') }))}
        onChange={set('agenda_category')}
        error={errors.agenda_category}
      />
      <BaseInput label="Title" required value={form.title} onChange={set('title')} error={errors.title} />
      <BaseInput
        label="Date signed by Acting Secretary"
        type="date"
        required
        max={today()}
        value={form.paper_signed_on}
        onChange={set('paper_signed_on')}
        error={errors.paper_signed_on}
      />

      <div>
        <label htmlFor="signed-files" className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
          Scanned signed package (PDF) <span className="text-red-600">*</span>
        </label>
        <input
          id="signed-files"
          type="file"
          multiple
          accept=".pdf,image/*"
          onChange={e => setFiles(Array.from(e.target.files || []))}
          className="block w-full text-sm"
        />
        <p className="mt-1 text-xs text-slate-500">The first file is the main package; others are stored as scanned attachments.</p>
        {errors.files && <p className="mt-1 text-xs text-red-600">{errors.files}</p>}
      </div>

      <BaseTextarea label="Notes (optional)" value={form.notes} onChange={set('notes')} rows={3} />

      <BaseButton type="submit" disabled={saving || files.length === 0}>
        {saving ? 'Lodging…' : 'Lodge and send to agenda'}
      </BaseButton>
    </form>
  )
}
