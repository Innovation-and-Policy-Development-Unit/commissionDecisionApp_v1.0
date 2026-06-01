import { useCallback, useEffect, useState } from 'react'
import { CheckSquare, Square, ChevronDown, ChevronUp, RefreshCw, Send, ThumbsUp, RotateCcw, AlertCircle } from 'lucide-react'
import api from '../../api/client'
import { useToast } from '../../context/ToastContext'
import { formatApiError } from '../../utils/apiError'

const STATUS_BADGE = {
  draft:     'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
  submitted: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  approved:  'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  returned:  'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
}
const STATUS_LABEL = {
  draft: 'Draft', submitted: 'Pending review', approved: 'Approved', returned: 'Returned for revision',
}

function FieldRenderer({ field, value, onChange, readOnly }) {
  const base = 'transition-colors'

  if (field.field_type === 'section_header') {
    return (
      <div className={`${field.start_new_page ? 'pt-4 mt-2' : ''} pb-1 border-b border-slate-200 dark:border-slate-700`}>
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{field.label}</p>
        {field.help_text && <p className="text-xs text-slate-400 mt-0.5">{field.help_text}</p>}
      </div>
    )
  }

  if (field.field_type === 'checkbox') {
    const checked = value === true || value === 'true'
    return (
      <div className="flex items-start justify-between gap-3 py-1">
        <div className="flex-1 min-w-0">
          <p className="text-sm text-slate-700 dark:text-slate-200">
            {field.label}
            {field.is_required && <span className="text-rose-500 ml-0.5">*</span>}
          </p>
          {field.help_text && <p className="text-xs text-slate-400">{field.help_text}</p>}
        </div>
        <button
          type="button"
          disabled={readOnly}
          onClick={() => !readOnly && onChange(!checked)}
          className={`shrink-0 mt-0.5 ${readOnly ? 'opacity-60 cursor-default' : 'hover:opacity-80'} ${base}`}
          aria-label={checked ? 'Yes' : 'No'}
        >
          {checked
            ? <CheckSquare size={20} className="text-primary-500" />
            : <Square size={20} className="text-slate-300 dark:text-slate-600" />}
        </button>
      </div>
    )
  }

  if (field.field_type === 'select' || field.field_type === 'radio') {
    const options = (field.choices || '').split('\n').map(s => s.trim()).filter(Boolean)
    return (
      <div className="space-y-1">
        <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
          {field.label}{field.is_required && <span className="text-rose-500 ml-0.5">*</span>}
        </label>
        {field.help_text && <p className="text-xs text-slate-400">{field.help_text}</p>}
        <select
          disabled={readOnly}
          className="input text-sm"
          value={value ?? ''}
          onChange={e => onChange(e.target.value)}
        >
          <option value="">— Select —</option>
          {options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>
    )
  }

  if (field.field_type === 'textarea') {
    return (
      <div className="space-y-1">
        <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
          {field.label}{field.is_required && <span className="text-rose-500 ml-0.5">*</span>}
        </label>
        {field.help_text && <p className="text-xs text-slate-400">{field.help_text}</p>}
        <textarea
          disabled={readOnly}
          className="input text-sm min-h-[80px]"
          placeholder={field.placeholder}
          value={value ?? ''}
          onChange={e => onChange(e.target.value)}
        />
      </div>
    )
  }

  if (field.field_type === 'date') {
    return (
      <div className="space-y-1">
        <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
          {field.label}{field.is_required && <span className="text-rose-500 ml-0.5">*</span>}
        </label>
        {field.help_text && <p className="text-xs text-slate-400">{field.help_text}</p>}
        <input
          type="date"
          disabled={readOnly}
          className="input text-sm"
          value={value ?? ''}
          onChange={e => onChange(e.target.value)}
        />
      </div>
    )
  }

  // text / number / default
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
        {field.label}{field.is_required && <span className="text-rose-500 ml-0.5">*</span>}
      </label>
      {field.help_text && <p className="text-xs text-slate-400">{field.help_text}</p>}
      <input
        type={field.field_type === 'number' ? 'number' : 'text'}
        disabled={readOnly}
        className="input text-sm"
        placeholder={field.placeholder}
        value={value ?? ''}
        onChange={e => onChange(e.target.value)}
      />
    </div>
  )
}

export default function SubmissionChecklistPanel({ submissionId }) {
  const toast = useToast()
  const [checklist, setChecklist] = useState(null)   // API response
  const [data, setData]           = useState({})     // local answer state
  const [canEdit, setCanEdit]     = useState(false)
  const [canApprove, setCanApprove] = useState(false)
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState('')
  const [managerNote, setManagerNote] = useState('')
  const [collapsed, setCollapsed] = useState(false)

  const fetch = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const r = await api.get(`/submission-checklists/ensure/?submission=${submissionId}`)
      setChecklist(r.data)
      setData(r.data.data || {})
      setCanEdit(r.data.can_edit)
      setCanApprove(r.data.can_approve)
      setManagerNote(r.data.manager_comments || '')
    } catch (err) {
      const status = err.response?.status
      const detail = err.response?.data?.detail
      if (status === 404) {
        setChecklist(null)
        setError(typeof detail === 'string' ? detail : 'No checklist configured for this submission type.')
      } else {
        setError(formatApiError(err, 'Unable to load checklist.'))
      }
    } finally {
      setLoading(false)
    }
  }, [submissionId])

  useEffect(() => { fetch() }, [fetch])

  const handleChange = (key, val) => setData(prev => ({ ...prev, [key]: val }))

  const save = async () => {
    setSaving(true)
    try {
      const r = await api.patch(`/submission-checklists/${checklist.id}/`, { data })
      setChecklist(r.data)
      toast.success('Checklist saved.')
    } catch (err) {
      toast.error(formatApiError(err, 'Save failed.'))
    } finally {
      setSaving(false)
    }
  }

  const submit = async () => {
    setSaving(true)
    try {
      // save first, then submit
      await api.patch(`/submission-checklists/${checklist.id}/`, { data })
      const r = await api.post(`/submission-checklists/${checklist.id}/submit/`)
      setChecklist(r.data)
      setCanEdit(false)
      toast.success('Checklist submitted for manager review.')
    } catch (err) {
      toast.error(formatApiError(err, 'Submit failed.'))
    } finally {
      setSaving(false)
    }
  }

  const approve = async () => {
    setSaving(true)
    try {
      const r = await api.post(`/submission-checklists/${checklist.id}/approve/`, {
        manager_comments: managerNote,
      })
      setChecklist(r.data)
      toast.success('Checklist approved.')
    } catch (err) {
      toast.error(formatApiError(err, 'Approve failed.'))
    } finally {
      setSaving(false)
    }
  }

  const returnForRevision = async () => {
    if (!managerNote.trim()) {
      toast.error('Add a note before returning.')
      return
    }
    setSaving(true)
    try {
      const r = await api.post(`/submission-checklists/${checklist.id}/return_for_revision/`, {
        manager_comments: managerNote,
      })
      setChecklist(r.data)
      toast.success('Checklist returned for revision.')
    } catch (err) {
      toast.error(formatApiError(err, 'Return failed.'))
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="card card-compact mb-4 flex items-center gap-2 text-sm text-slate-400">
        <RefreshCw size={14} className="animate-spin" /> Loading checklist…
      </div>
    )
  }

  if (error || !checklist) {
    return (
      <div className="card card-compact mb-4 flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
        <AlertCircle size={14} className="shrink-0 text-amber-400" />
        {error || 'No checklist available for this submission.'}
      </div>
    )
  }

  const fields = checklist.checklist_form_type_detail?.fields ?? []
  const status = checklist.status
  const readOnly = !canEdit || status === 'approved'

  return (
    <div className="card card-compact mb-4 space-y-0">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <CheckSquare size={16} className="text-primary-500 shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">
              {checklist.checklist_form_type_detail?.name ?? 'Checklist'}
            </p>
            <p className="text-xs text-slate-400">
              {checklist.checklist_form_type_detail?.code}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_BADGE[status]}`}>
            {STATUS_LABEL[status]}
          </span>
          <button
            type="button"
            onClick={() => setCollapsed(c => !c)}
            className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400"
          >
            {collapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
          </button>
        </div>
      </div>

      {!collapsed && (
        <>
          {/* Manager note (returned) */}
          {status === 'returned' && checklist.manager_comments && (
            <div className="mb-3 p-3 rounded-lg bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-700/40 text-xs text-rose-800 dark:text-rose-300">
              <p className="font-semibold mb-0.5">Returned — manager note:</p>
              <p>{checklist.manager_comments}</p>
            </div>
          )}

          {/* Fields */}
          <div className="space-y-3">
            {fields.map(field => (
              <FieldRenderer
                key={field.field_key}
                field={field}
                value={data[field.field_key]}
                onChange={val => handleChange(field.field_key, val)}
                readOnly={readOnly}
              />
            ))}
          </div>

          {/* Manager comment input (submit/approve flow) */}
          {canApprove && status === 'submitted' && (
            <div className="mt-4 space-y-1">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                Manager note (optional for approve, required for return)
              </label>
              <textarea
                className="input text-sm min-h-[64px]"
                placeholder="Add a note…"
                value={managerNote}
                onChange={e => setManagerNote(e.target.value)}
              />
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-2 mt-4 pt-3 border-t border-slate-100 dark:border-slate-700">
            {canEdit && status !== 'approved' && status !== 'submitted' && (
              <>
                <button
                  type="button"
                  onClick={save}
                  disabled={saving}
                  className="btn-secondary text-xs px-3 py-1.5"
                >
                  {saving ? 'Saving…' : 'Save draft'}
                </button>
                <button
                  type="button"
                  onClick={submit}
                  disabled={saving}
                  className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1.5"
                >
                  <Send size={12} /> Submit for review
                </button>
              </>
            )}
            {canApprove && status === 'submitted' && (
              <>
                <button
                  type="button"
                  onClick={approve}
                  disabled={saving}
                  className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1.5"
                >
                  <ThumbsUp size={12} /> Approve
                </button>
                <button
                  type="button"
                  onClick={returnForRevision}
                  disabled={saving}
                  className="text-xs px-3 py-1.5 rounded-lg border border-rose-300 text-rose-600 hover:bg-rose-50 dark:border-rose-700 dark:text-rose-400 dark:hover:bg-rose-900/20 flex items-center gap-1.5"
                >
                  <RotateCcw size={12} /> Return for revision
                </button>
              </>
            )}
            <button
              type="button"
              onClick={fetch}
              className="ml-auto p-1.5 rounded text-slate-400 hover:text-slate-600"
              title="Refresh"
            >
              <RefreshCw size={13} />
            </button>
          </div>
        </>
      )}
    </div>
  )
}
