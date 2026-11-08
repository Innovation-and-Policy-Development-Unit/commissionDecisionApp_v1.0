import { useCallback, useEffect, useState } from 'react'
import { CheckSquare, Square, ChevronDown, ChevronUp, RefreshCw, ThumbsUp, RotateCcw, AlertCircle, Sparkles, Check, X } from 'lucide-react'
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

function SuggestionHint({ suggestion, onAccept, onDismiss }) {
  if (!suggestion) return null
  const shown = typeof suggestion.value === 'boolean' ? (suggestion.value ? 'Yes' : 'No') : String(suggestion.value)
  return (
    <div className="mt-1 flex items-start gap-2 rounded-md bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-800/40 px-2 py-1.5 text-xs">
      <Sparkles size={12} className="text-violet-500 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-violet-800 dark:text-violet-200">
          <span className="font-medium">AI suggests:</span> {shown}
        </p>
        {suggestion.notes && <p className="text-violet-500 dark:text-violet-400 mt-0.5">{suggestion.notes}</p>}
      </div>
      <button type="button" onClick={onAccept} className="shrink-0 p-1 rounded hover:bg-violet-100 dark:hover:bg-violet-900/40 text-violet-600 dark:text-violet-300" aria-label="Accept suggestion">
        <Check size={13} />
      </button>
      <button type="button" onClick={onDismiss} className="shrink-0 p-1 rounded hover:bg-violet-100 dark:hover:bg-violet-900/40 text-violet-400" aria-label="Dismiss suggestion">
        <X size={13} />
      </button>
    </div>
  )
}

function FieldRenderer({ field, value, onChange, readOnly, suggestion, onAcceptSuggestion, onDismissSuggestion }) {
  const base = 'transition-colors'
  const hint = suggestion
    ? <SuggestionHint suggestion={suggestion} onAccept={() => onAcceptSuggestion(field.field_key)} onDismiss={() => onDismissSuggestion(field.field_key)} />
    : null

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
      <div className="py-1">
        <div className="flex items-start justify-between gap-3">
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
        {hint}
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
        {hint}
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
        {hint}
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
        {hint}
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
      {hint}
    </div>
  )
}

const REC_LABEL = {
  accept: ['Looks complete — can proceed', 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-900/20 dark:border-emerald-700/40 dark:text-emerald-300'],
  accept_with_follow_up: ['Minor gaps — ask the ministry to follow up', 'bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-900/20 dark:border-amber-700/40 dark:text-amber-300'],
  return_for_clarification: ['Material gaps — consider returning for clarification', 'bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-900/20 dark:border-rose-700/40 dark:text-rose-300'],
}

function AIReviewCard({ review, canEdit, rerunning, onRerun }) {
  if (!review) return null
  const r = review.result || {}
  const c = r.counts || {}
  const rec = REC_LABEL[r.recommendation]
  const late = review.lateness || r.lateness || {}
  return (
    <div className="mb-4 p-3 rounded-lg border border-violet-200 dark:border-violet-700/40 bg-violet-50/60 dark:bg-violet-900/10 text-xs">
      <div className="flex items-center justify-between gap-2 mb-1">
        <p className="font-semibold text-violet-700 dark:text-violet-300 flex items-center gap-1.5">
          <Sparkles size={13} /> AI first-pass review against the {review.guideline_name || 'Annual Report Guideline'}
        </p>
        {canEdit && review.state !== 'running' && (
          <button type="button" onClick={onRerun} disabled={rerunning}
            className="inline-flex items-center gap-1 text-violet-600 dark:text-violet-300 hover:underline disabled:opacity-50">
            <RefreshCw size={11} className={rerunning ? 'animate-spin' : ''} /> Run again
          </button>
        )}
      </div>
      {late.late && (
        <p className="mb-2 px-2 py-1 rounded bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 font-medium">
          Lodged {late.days_late} day{late.days_late === 1 ? '' : 's'} after the {late.deadline_text || '31 March'} deadline.
        </p>
      )}
      {review.state === 'running' && (
        <p className="text-violet-600 dark:text-violet-300 flex items-center gap-1.5">
          <RefreshCw size={12} className="animate-spin" /> Reading the {(review.label || 'report').toLowerCase()}… this takes a few minutes for a long document.
        </p>
      )}
      {review.state === 'failed' && (
        <p className="text-amber-700 dark:text-amber-400">The AI review could not be completed: {review.error || 'unknown error'}. You can still complete the checklist yourself.</p>
      )}
      {review.state === 'done' && (
        <>
          {rec && (
            <p className={`mb-2 px-2 py-1 rounded border font-medium ${rec[1]}`}>Suggested: {rec[0]}</p>
          )}
          {r.summary && <p className="mb-2 text-slate-700 dark:text-slate-300">{r.summary}</p>}
          {r.plan_period && (
            <p className={`mb-2 px-2 py-1 rounded border font-medium ${r.plan_period.five_years ? REC_LABEL.accept[1] : REC_LABEL.accept_with_follow_up[1]}`}>
              {!r.plan_period.found
                ? 'Plan period not found in the document — check that it covers five years.'
                : r.plan_period.five_years
                  ? `Plan period ${r.plan_period.start_year} to ${r.plan_period.end_year}: five years.`
                  : `Plan period ${r.plan_period.start_year} to ${r.plan_period.end_year} is ${r.plan_period.years} year${r.plan_period.years === 1 ? '' : 's'} — a Corporate Plan must cover five years.`}
            </p>
          )}
          <p className="text-slate-600 dark:text-slate-400">
            {c.met || 0} of {r.total || 0} items found · {c.partial || 0} partly · {c.not_found || 0} not found.
            {' '}Each suggestion below is advice only — tick an item once you have checked it in the report.
          </p>
          {r.unreadable_documents > 0 && (
            <p className="mt-1 text-amber-700 dark:text-amber-400">{r.unreadable_documents} uploaded document(s) had no readable text, so the AI could not check them.</p>
          )}
          {r.truncated && (
            <p className="mt-1 text-amber-700 dark:text-amber-400">The document is very long; only the first part was read. Check the later sections yourself.</p>
          )}
          <p className="mt-1 text-slate-500 dark:text-slate-500">Whether the cover letter is signed by the Director General must be checked by you on the document itself.</p>
        </>
      )}
    </div>
  )
}

function suggestionsFromReview(review, data) {
  const items = review?.state === 'done' ? review.result?.items : null
  if (!items) return {}
  const out = {}
  for (const [key, it] of Object.entries(items)) {
    if (data?.[key] === true) continue
    const where = it.evidence ? ` “${it.evidence}”` : ''
    if (it.status === 'met') out[key] = { value: true, notes: `Found.${where} ${it.note || ''}`.trim() }
    else if (it.status === 'partial') out[key] = { value: false, notes: `Only partly there. ${it.note || ''}${where}`.trim() }
    else out[key] = { value: false, notes: 'Not found in the report.' }
  }
  return out
}

export default function SubmissionChecklistPanel({ submissionId, autofillEnabled = true }) {
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
  const [suggestions, setSuggestions] = useState({})  // { field_key: { value, notes } }
  const [autofilling, setAutofilling] = useState(false)
  const [autofillError, setAutofillError] = useState('')
  const [aiReview, setAiReview] = useState(null)
  const [rerunning, setRerunning] = useState(false)

  const fetch = useCallback(async () => {
    setLoading(true)
    setError('')
    setSuggestions({})
    try {
      const r = await api.get(`/submission-checklists/ensure/?submission=${submissionId}`)
      setChecklist(r.data)
      setData(r.data.data || {})
      setCanEdit(r.data.can_edit)
      setCanApprove(r.data.can_approve)
      setManagerNote(r.data.manager_comments || '')
      setAiReview(r.data.ai_review || null)
      if (r.data.can_edit) setSuggestions(suggestionsFromReview(r.data.ai_review, r.data.data))
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

  // While the AI review is still reading the report, check back until it is done.
  useEffect(() => {
    if (aiReview?.state !== 'running') return undefined
    const t = setInterval(async () => {
      try {
        const r = await api.get(`/submission-checklists/ensure/?submission=${submissionId}`)
        const rv = r.data.ai_review
        if (rv && rv.state !== 'running') {
          setAiReview(rv)
          if (r.data.can_edit) setSuggestions(suggestionsFromReview(rv, data))
        }
      } catch { /* try again on the next tick */ }
    }, 6000)
    return () => clearInterval(t)
  }, [aiReview?.state, submissionId, data])

  const rerunReview = async () => {
    setRerunning(true)
    try {
      await api.post('/submission-checklists/ai-review/', { submission: submissionId })
      setAiReview(prev => ({ ...(prev || {}), state: 'running', error: '' }))
      setSuggestions({})
    } catch (err) {
      toast.error(formatApiError(err, 'Could not start the AI review.'))
    } finally {
      setRerunning(false)
    }
  }

  const handleChange = (key, val) => setData(prev => ({ ...prev, [key]: val }))

  const handleAutofill = async () => {
    setAutofilling(true)
    setAutofillError('')
    setSuggestions({})
    try {
      const r = await api.post(`/submission-checklists/${checklist.id}/autofill/`)
      setSuggestions(r.data.suggestions || {})
      if (r.data.error) setAutofillError(r.data.error)
      else if (Object.keys(r.data.suggestions || {}).length === 0) {
        toast.info?.('No suggestions found in the uploaded documents.')
      }
    } catch (err) {
      setAutofillError(formatApiError(err, 'AI autofill failed.'))
    } finally {
      setAutofilling(false)
    }
  }

  const acceptSuggestion = (key) => {
    const sug = suggestions[key]
    if (!sug) return
    handleChange(key, sug.value)
    setSuggestions(prev => {
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  const dismissSuggestion = (key) => setSuggestions(prev => {
    const next = { ...prev }
    delete next[key]
    return next
  })

  const acceptAllSuggestions = () => {
    setData(prev => {
      const next = { ...prev }
      for (const [key, sug] of Object.entries(suggestions)) next[key] = sug.value
      return next
    })
    setSuggestions({})
  }

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
          <AIReviewCard review={aiReview} canEdit={canEdit} rerunning={rerunning} onRerun={rerunReview} />

          {/* Manager note (returned) */}
          {status === 'returned' && checklist.manager_comments && (
            <div className="mb-3 p-3 rounded-lg bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-700/40 text-xs text-rose-800 dark:text-rose-300">
              <p className="font-semibold mb-0.5">Returned — manager note:</p>
              <p>{checklist.manager_comments}</p>
            </div>
          )}

          {/* AI autofill */}
          {canEdit && autofillEnabled && status === 'draft' && (
            <div className="flex items-center gap-2 mb-3">
              <button
                type="button"
                onClick={handleAutofill}
                disabled={autofilling}
                className="btn-outline text-xs px-3 py-1.5 flex items-center gap-1.5"
              >
                {autofilling ? <RefreshCw size={12} className="animate-spin" /> : <Sparkles size={12} />}
                {autofilling ? 'Reading documents…' : 'AI autofill from documents'}
              </button>
              {Object.keys(suggestions).length > 1 && (
                <button
                  type="button"
                  onClick={acceptAllSuggestions}
                  className="text-xs text-primary-600 hover:underline"
                >
                  Accept all {Object.keys(suggestions).length}
                </button>
              )}
            </div>
          )}
          {autofillError && (
            <p className="mb-3 text-xs text-amber-600 dark:text-amber-400">{autofillError}</p>
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
                suggestion={suggestions[field.field_key]}
                onAcceptSuggestion={acceptSuggestion}
                onDismissSuggestion={dismissSuggestion}
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
              <button
                type="button"
                onClick={save}
                disabled={saving}
                className="btn-secondary text-xs px-3 py-1.5"
              >
                {saving ? 'Saving…' : 'Save draft'}
              </button>
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
