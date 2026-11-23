/**
 * DuplicateFlagBanner — "possible repeat submission" flag for the Secretary and unit Managers.
 *
 * A repeat is often genuine (an allowance for a different period, say), so this only informs:
 * it never blocks anything. Shown only when earlier papers about the same officer were found.
 * The AI's verdict per paper is advice ("AI draft — verify"); the rule-based list of earlier
 * papers is shown even when the AI was unavailable.
 */
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, Info, CheckCircle2 } from 'lucide-react'
import api from '../../api/client'
import { useToast } from '../../context/ToastContext'
import BaseButton from '../shared/BaseButton'
import { STAGE_LABELS } from '../../constants/stages'

export const DUPLICATE_FLAG_ROLES = [
  'psc_secretary', 'deputy_secretary', 'senior_admin_officer', 'psc_admin',
  'odu_manager', 'hr_unit_manager', 'vipam_manager', 'compliance_manager', 'ipdu_manager',
]

const VERDICT_TEXT = {
  same_claim: 'Looks like the same claim',
  different_period: 'Looks like a different period',
  different_matter: 'Looks like a different matter',
  unclear: 'Cannot tell — compare yourself',
}
const POLL_MS = 4000
const POLL_TIMEOUT_MS = 90000

export default function DuplicateFlagBanner({ submissionId, stage }) {
  const toast = useToast()
  const [data, setData] = useState(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await api.get(`/submissions/${submissionId}/ai-duplicate/`)
      setData(res.data)
      return res.data
    } catch {
      return null
    }
  }, [submissionId, stage])

  // The check runs in the background when the paper reaches the Secretary: poll briefly
  // while it is still being worked out, then stop.
  useEffect(() => {
    let cancelled = false
    let timer
    const started = Date.now()
    const tick = async () => {
      const d = await load()
      if (cancelled) return
      if (d && !d.ai_duplicate_processed && Date.now() - started < POLL_TIMEOUT_MS) {
        timer = setTimeout(tick, POLL_MS)
      }
    }
    tick()
    return () => { cancelled = true; clearTimeout(timer) }
  }, [load])

  if (!data || data.flag_level === 'none') return null
  const cases = data.ai_duplicate_similar_cases || []
  if (!cases.length) return null

  const warn = data.flag_level === 'warn'
  const reviewed = !!data.reviewed_at
  const Icon = reviewed ? CheckCircle2 : (warn ? AlertTriangle : Info)
  const tone = reviewed
    ? 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-200'
    : warn
    ? 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700/60 dark:bg-amber-900/20 dark:text-amber-100'
    : 'border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-800/60 dark:bg-sky-900/20 dark:text-sky-100'

  const review = async (reviewedFlag) => {
    setBusy(true)
    try {
      const res = await api.post(`/submissions/${submissionId}/ai-duplicate/review/`, { reviewed: reviewedFlag })
      setData(res.data)
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Could not save that.')
    } finally {
      setBusy(false)
    }
  }

  const headline = reviewed
    ? `Possible repeat — marked genuine by ${data.reviewed_by_name || 'a reviewer'}`
    : warn
    ? 'Possible repeat submission'
    : 'Earlier submissions for this officer (looks like a different period)'

  return (
    <div className={`rounded-xl border px-4 py-3 space-y-2 ${tone}`} role="note">
      <div className="flex items-start gap-2">
        <Icon size={18} className="shrink-0 mt-0.5" />
        <div className="min-w-0">
          <p className="font-semibold text-sm">{headline}</p>
          {data.ai_duplicate_recommendation && (
            <p className="text-sm mt-0.5">{data.ai_duplicate_recommendation}</p>
          )}
        </div>
      </div>

      <ul className="space-y-1.5 text-sm">
        {cases.map(c => (
          <li key={c.reference} className="rounded-lg bg-white/60 dark:bg-slate-900/30 px-3 py-2">
            <div className="flex flex-wrap items-center gap-x-2">
              {c.can_open && c.submission_id
                ? <Link to={`/submissions/${c.submission_id}`} className="font-semibold underline">{c.reference}</Link>
                : <span className="font-semibold">{c.reference}</span>}
              {c.title && <span className="truncate">{c.title}</span>}
              <span className="text-xs opacity-80">
                {STAGE_LABELS[c.stage] || c.stage}{c.submitted_on ? ` · ${c.submitted_on}` : ''}
              </span>
            </div>
            <div className="text-xs mt-0.5">
              <strong>{VERDICT_TEXT[c.verdict] || VERDICT_TEXT.unclear}.</strong>{' '}
              {c.similarity_reason}{c.overlap ? ` ${c.overlap}` : ''}
              {(c.matched_on || []).length > 0 && (
                <span className="opacity-70"> Matched on: {c.matched_on.join(', ')}.</span>
              )}
            </div>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <span className="text-[11px] opacity-70">AI draft — verify. This is a flag only; nothing is blocked.</span>
        <span className="ml-auto" />
        {reviewed ? (
          <BaseButton size="sm" variant="ghost" onClick={() => review(false)} disabled={busy}>Reopen flag</BaseButton>
        ) : (
          <BaseButton size="sm" variant="outline" onClick={() => review(true)} disabled={busy}>
            Reviewed — genuine separate submission
          </BaseButton>
        )}
      </div>
    </div>
  )
}
