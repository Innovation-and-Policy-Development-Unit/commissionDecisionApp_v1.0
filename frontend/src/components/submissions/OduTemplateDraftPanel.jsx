/**
 * OduTemplateDraftPanel.jsx
 * "Draft with AI" for ODU's own papers on the general template (the three consolidated papers
 * and the Performance Assessment Feedback Report). The AI suggests Subject, Issue, Discussion
 * and Recommendation; the officer uses what is right, which fills the Digitized Form tab to
 * check and save. Suggestions only, nothing is written into the paper.
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import { Sparkles, RefreshCw, ArrowDownToLine } from 'lucide-react'
import api from '../../api/client'
import { isTabVisible } from '../../hooks/useVisibilityAwareInterval'
import { useToast } from '../../context/ToastContext'
import BaseButton from '../shared/BaseButton'
import BaseSpinner from '../shared/BaseSpinner'

export const TEMPLATE_DRAFT_CODES = [
  'ODU-BUSINESS-PLANS', 'ODU-CORPORATE-PLANS', 'ODU-ANNUAL-REPORTS', 'ODU-OPA-FEEDBACK-REPORT',
]

const FIELDS = [
  ['subject', 'Subject'], ['issue', 'Issue'], ['discussion', 'Discussion'], ['recommendation', 'Recommendation'],
]
const POLL_MS = 3000
const POLL_TIMEOUT_MS = 120000

export default function OduTemplateDraftPanel({ submissionId, canDraft, onUse }) {
  const toast = useToast()
  const [data, setData] = useState(null)
  const [busy, setBusy] = useState(false)
  const [timedOut, setTimedOut] = useState(false)
  const startedRef = useRef(null)
  const url = `/submissions/${submissionId}/ai-template-draft/`

  const load = useCallback(async () => {
    try {
      const res = await api.get(url)
      setData(res.data)
      return res.data
    } catch {
      return null
    }
  }, [url])

  useEffect(() => { load() }, [load])

  const running = data?.state === 'running'
  useEffect(() => {
    if (!running) return undefined
    if (!startedRef.current) startedRef.current = Date.now()
    const id = setInterval(async () => {
      if (Date.now() - startedRef.current > POLL_TIMEOUT_MS) { setTimedOut(true); clearInterval(id); return }
      if (isTabVisible()) await load()
    }, POLL_MS)
    return () => clearInterval(id)
  }, [running, load])

  const run = async () => {
    setBusy(true)
    setTimedOut(false)
    try {
      await api.post(`${url}run/`)
      startedRef.current = Date.now()
      setData(prev => ({ ...(prev || {}), state: 'running', error: '' }))
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Could not start the draft.')
    } finally {
      setBusy(false)
    }
  }

  const use = (key, text) => {
    onUse?.(key, text)
    toast.success('Added to the form. Open the Digitized Form tab, check it and save.')
  }
  const useAll = () => {
    FIELDS.forEach(([k]) => { if (data?.draft?.[k]) onUse?.(k, data.draft[k]) })
    toast.success('All four added to the form. Open the Digitized Form tab, check them and save.')
  }

  if (!data) return null
  if (!canDraft && !data.draft) return null
  const draft = data.draft
  const based = data.based_on || {}

  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 mb-1">
        <Sparkles size={20} className="text-violet-600" />
        <span className="font-bold text-base text-slate-800 dark:text-slate-100">Draft the text with AI</span>
        {canDraft && (
          <BaseButton
            variant="ghost" size="sm" className="ml-auto"
            icon={running || busy ? <BaseSpinner size="sm" label="" /> : <RefreshCw size={15} />}
            onClick={run} disabled={running || busy}
          >
            {running ? 'Drafting…' : draft ? 'Draft again' : 'Draft with AI'}
          </BaseButton>
        )}
      </div>
      <p className="text-xs text-amber-700 dark:text-amber-300 mb-3">{data.disclaimer}</p>

      {timedOut && <p className="text-sm text-amber-700 dark:text-amber-300 mb-2">This is taking longer than expected. Try again in a moment.</p>}
      {data.state === 'failed' && <p className="text-sm text-amber-700 dark:text-amber-300 mb-2">{data.error || 'The AI could not write a draft just now. Please try again.'}</p>}
      {!draft && !running && data.state !== 'failed' && (
        <p className="text-sm text-slate-500">
          The AI writes a first draft of the Subject, Issue, Discussion and Recommendation from the ministry plans this paper covers, their first-pass reviews and the attached report. You choose what to use.
        </p>
      )}

      {draft && (
        <div className="flex flex-col gap-3">
          <p className="text-xs text-slate-500">
            Based on {based.ministries ? `${based.ministries} ministr${based.ministries === 1 ? 'y' : 'ies'}` : 'the attachment'}
            {based.ministries && based.attachment_read ? ' and the attached report' : ''}
            {!based.attachment_read && based.attachment_files ? ' (the attached file had no readable text, so it was not used)' : ''}.
          </p>
          <div>
            <BaseButton variant="outline" size="sm" icon={<ArrowDownToLine size={14} />} onClick={useAll}>Use all four in the form</BaseButton>
          </div>
          {FIELDS.map(([key, label]) => draft[key] && (
            <div key={key} className="border border-slate-200 dark:border-slate-700 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{label}</span>
                <button type="button" onClick={() => use(key, draft[key])}
                  className="ml-auto text-xs text-primary-700 dark:text-primary-300 underline">Use this</button>
              </div>
              <p className="text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap">{draft[key]}</p>
            </div>
          ))}
          {draft.ministries_of_concern?.length > 0 && (
            <div className="text-sm text-slate-700 dark:text-slate-200">
              <span className="font-semibold">Ministries the AI suggests flagging</span>
              <ul className="ml-4 list-disc mt-1 flex flex-col gap-1">
                {draft.ministries_of_concern.map((m, i) => <li key={i}><span className="font-medium">{m.ministry}</span>{m.reason ? `: ${m.reason}` : ''}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
