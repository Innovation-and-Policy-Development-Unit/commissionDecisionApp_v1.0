import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ClipboardList, Square, CheckSquare, Sparkles, Loader2, Check, X, ChevronDown, ChevronUp } from 'lucide-react'
import clsx from 'clsx'
import api from '../../api/client'
import { formatApiError } from '../../utils/apiError'

function SuggestionBadge({ suggestion, t }) {
  if (!suggestion) return null
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold',
        suggestion.is_present
          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
          : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
      )}
    >
      <Sparkles size={9} />
      {suggestion.is_present
        ? t('submission.checklist_suggestion_present')
        : t('submission.checklist_suggestion_missing')}
    </span>
  )
}

export default function ChecklistPanel({
  checklist,
  setChecklist,
  submissionId,
  canEdit,
  hasDocuments,
}) {
  const { t } = useTranslation()
  const [autofilling, setAutofilling] = useState(false)
  const [autofillError, setAutofillError] = useState('')
  const [suggestions, setSuggestions] = useState({})
  const [savingItems, setSavingItems] = useState(new Set())
  const [expandedNotes, setExpandedNotes] = useState(new Set())
  const [pendingNotes, setPendingNotes] = useState({})

  if (!checklist || checklist.length === 0) {
    return (
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-3 pb-3 border-b border-slate-100 dark:border-slate-700">
          <ClipboardList size={14} className="text-slate-400" />
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            {t('submission.checklist_panel_title')}
          </h3>
        </div>
        <p className="text-sm text-slate-400 dark:text-slate-500">
          {t('submission.checklist_no_items')}
        </p>
      </div>
    )
  }

  const hasSuggestions = Object.keys(suggestions).length > 0
  const pendingCount = hasSuggestions
    ? Object.values(suggestions).filter(s => s !== null).length
    : 0

  const handleAutofill = async () => {
    setAutofilling(true)
    setAutofillError('')
    setSuggestions({})
    try {
      const res = await api.post(`/submissions/${submissionId}/checklist/autofill/`)
      setSuggestions(res.data.suggestions || {})
      if (res.data.items) {
        setChecklist(res.data.items)
      }
      if (res.data.error) {
        setAutofillError(res.data.error)
      }
    } catch (err) {
      setAutofillError(formatApiError(err, t('submission.checklist_autofill_failed')))
    } finally {
      setAutofilling(false)
    }
  }

  const applyItem = async (item, isPresent, notes) => {
    setSavingItems(prev => new Set(prev).add(item.id))
    try {
      const body = { is_present: isPresent }
      if (notes !== undefined) body.notes = notes
      const res = await api.patch(
        `/submissions/${submissionId}/checklist/${item.id}/`,
        body,
      )
      setChecklist(prev => prev.map(i => (i.id === item.id ? res.data : i)))
      // Remove the suggestion for this item now it's confirmed
      setSuggestions(prev => {
        const next = { ...prev }
        delete next[String(item.id)]
        return next
      })
      setPendingNotes(prev => {
        const next = { ...prev }
        delete next[item.id]
        return next
      })
    } finally {
      setSavingItems(prev => {
        const next = new Set(prev)
        next.delete(item.id)
        return next
      })
    }
  }

  const handleToggle = (item) => {
    if (!canEdit) return
    applyItem(item, !item.is_present, pendingNotes[item.id])
  }

  const handleAccept = (item) => {
    const sug = suggestions[String(item.id)]
    if (!sug) return
    applyItem(item, sug.is_present, sug.notes)
  }

  const handleReject = (item) => {
    setSuggestions(prev => {
      const next = { ...prev }
      delete next[String(item.id)]
      return next
    })
  }

  const handleAcceptAll = async () => {
    const toAccept = checklist.filter(
      item => suggestions[String(item.id)] !== undefined,
    )
    for (const item of toAccept) {
      const sug = suggestions[String(item.id)]
      await applyItem(item, sug.is_present, sug.notes)
    }
  }

  const toggleNotes = (itemId) => {
    setExpandedNotes(prev => {
      const next = new Set(prev)
      if (next.has(itemId)) next.delete(itemId)
      else next.add(itemId)
      return next
    })
  }

  const confirmedCount = checklist.filter(i => i.is_present).length

  return (
    <div className="card p-5">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100 dark:border-slate-700">
        <ClipboardList size={14} className="text-slate-400" />
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
          {t('submission.checklist_panel_title')}
        </h3>
        <span className="text-xs text-slate-400 ml-1">
          {confirmedCount}/{checklist.length}
        </span>
        {canEdit && (
          <button
            type="button"
            onClick={handleAutofill}
            disabled={autofilling}
            title={!hasDocuments ? t('submission.checklist_no_docs_hint') : undefined}
            className={clsx(
              'ml-auto inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors',
              autofilling || !hasDocuments
                ? 'cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-500'
                : 'border-violet-300 bg-violet-50 text-violet-700 hover:bg-violet-100 dark:border-violet-700 dark:bg-violet-900/30 dark:text-violet-300 dark:hover:bg-violet-900/50',
            )}
          >
            {autofilling ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Sparkles size={12} />
            )}
            {autofilling
              ? t('submission.checklist_autofilling')
              : t('submission.checklist_autofill')}
          </button>
        )}
      </div>

      {autofillError && (
        <p className="mb-3 text-xs text-amber-600 dark:text-amber-400">{autofillError}</p>
      )}

      {/* Accept-all banner */}
      {hasSuggestions && pendingCount > 0 && (
        <div className="mb-3 flex items-center justify-between gap-3 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 dark:border-violet-700 dark:bg-violet-900/20">
          <p className="text-xs text-violet-700 dark:text-violet-300">
            <Sparkles size={11} className="inline mr-1" />
            {pendingCount} AI suggestion{pendingCount !== 1 ? 's' : ''} — review each or accept all.
          </p>
          <button
            type="button"
            onClick={handleAcceptAll}
            className="shrink-0 inline-flex items-center gap-1 rounded-md bg-violet-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-violet-700"
          >
            <Check size={11} />
            {t('submission.checklist_accept_all')}
          </button>
        </div>
      )}

      {/* Checklist items */}
      <ul className="space-y-2">
        {checklist.map(item => {
          const sug = suggestions[String(item.id)]
          const hasSug = sug !== undefined
          const isSaving = savingItems.has(item.id)
          const notesOpen = expandedNotes.has(item.id)
          const displayNotes = pendingNotes[item.id] ?? item.notes ?? ''

          return (
            <li
              key={item.id}
              className={clsx(
                'rounded-lg border px-3 py-2.5 transition-colors',
                hasSug
                  ? 'border-violet-200 bg-violet-50/60 dark:border-violet-700/60 dark:bg-violet-900/10'
                  : item.is_present
                    ? 'border-emerald-200 bg-emerald-50/40 dark:border-emerald-800/40 dark:bg-emerald-900/10'
                    : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800/20',
              )}
            >
              <div className="flex items-start gap-2.5">
                {/* Checkbox toggle */}
                <button
                  type="button"
                  onClick={() => handleToggle(item)}
                  disabled={!canEdit || isSaving}
                  className={clsx(
                    'mt-0.5 shrink-0 transition-colors',
                    !canEdit || isSaving
                      ? 'cursor-default opacity-50'
                      : 'cursor-pointer hover:opacity-80',
                    item.is_present
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-slate-300 dark:text-slate-600',
                  )}
                  aria-label={item.is_present ? 'Mark as missing' : 'Mark as present'}
                >
                  {isSaving ? (
                    <Loader2 size={16} className="animate-spin text-slate-400" />
                  ) : item.is_present ? (
                    <CheckSquare size={16} />
                  ) : (
                    <Square size={16} />
                  )}
                </button>

                {/* Label + meta */}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span
                      className={clsx(
                        'text-sm font-medium',
                        item.is_present
                          ? 'text-slate-800 dark:text-slate-100'
                          : 'text-slate-600 dark:text-slate-300',
                      )}
                    >
                      {item.document_name}
                    </span>
                    {hasSug && <SuggestionBadge suggestion={sug} t={t} />}
                  </div>

                  {item.document_description && (
                    <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 leading-snug">
                      {item.document_description}
                    </p>
                  )}

                  {/* AI suggestion notes (shown as context when a suggestion is pending) */}
                  {hasSug && sug.notes && (
                    <p className="mt-1 text-xs text-violet-600 dark:text-violet-300 italic leading-snug">
                      {sug.notes}
                    </p>
                  )}

                  {/* Persistent notes (only shown when no active suggestion or when notes exist) */}
                  {!hasSug && item.notes && (
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 italic leading-snug">
                      {item.notes}
                    </p>
                  )}

                  {/* Inline notes editor (expandable) */}
                  {canEdit && !hasSug && notesOpen && (
                    <div className="mt-2 flex items-center gap-1.5">
                      <input
                        type="text"
                        className="input text-xs py-1 flex-1"
                        placeholder={t('submission.checklist_notes_placeholder')}
                        value={displayNotes}
                        onChange={e =>
                          setPendingNotes(prev => ({ ...prev, [item.id]: e.target.value }))
                        }
                        onBlur={() => {
                          if (pendingNotes[item.id] !== undefined) {
                            applyItem(item, item.is_present, pendingNotes[item.id])
                          }
                        }}
                        maxLength={500}
                      />
                    </div>
                  )}
                </div>

                {/* Action buttons */}
                <div className="shrink-0 flex items-center gap-1">
                  {hasSug ? (
                    <>
                      <button
                        type="button"
                        onClick={() => handleAccept(item)}
                        disabled={isSaving}
                        className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                      >
                        <Check size={10} />
                        {t('submission.checklist_accept')}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleReject(item)}
                        disabled={isSaving}
                        className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700 disabled:opacity-50"
                      >
                        <X size={10} />
                        {t('submission.checklist_reject')}
                      </button>
                    </>
                  ) : (
                    canEdit && (
                      <button
                        type="button"
                        onClick={() => toggleNotes(item.id)}
                        className="text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 p-0.5"
                        aria-label="Toggle notes"
                      >
                        {notesOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </button>
                    )
                  )}
                </div>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
