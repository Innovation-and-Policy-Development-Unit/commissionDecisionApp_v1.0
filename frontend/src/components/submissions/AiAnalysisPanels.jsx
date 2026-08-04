/**
 * AiAnalysisPanels.jsx
 * Reusable AI result + trigger panels for SubmissionDetail.
 * Exports: AiDuplicatePanel, AiRiskPanel, AiOutcomePanel, AiNoaPanel, AiLetterPanel, StructuredLetterPanel
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import { BrainCircuit, Copy, RefreshCw, CheckCircle2, XCircle, AlertTriangle, FileText, Clock } from 'lucide-react'
import api from '../../api/client'
import { isTabVisible } from '../../hooks/useVisibilityAwareInterval'
import { useToast } from '../../context/ToastContext'
import BaseButton from '../shared/BaseButton'
import BaseBadge from '../shared/BaseBadge'
import BaseSpinner from '../shared/BaseSpinner'
import BaseTextarea from '../shared/BaseTextarea'

// ── Shared helpers ────────────────────────────────────────────────────────────

const AI_POLL_INTERVAL_MS = 3000
// Backend tasks always record *_processed on failure (missing API key, LLM
// error, unexpected exception) — this timeout only guards the remaining edge
// case where the task never runs at all (e.g. Celery worker unreachable).
const AI_POLL_TIMEOUT_MS = 90000

function AiPanelShell({ title, icon, children, onTrigger, loading, lastRun }) {
  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <span className="font-bold text-base text-slate-800 dark:text-slate-100">{title}</span>
        <div className="ml-auto flex items-center gap-2">
          {lastRun && <span className="text-xs text-slate-500">{new Date(lastRun).toLocaleString()}</span>}
          <BaseButton
            variant="ghost"
            size="sm"
            icon={loading ? <BaseSpinner size="sm" label="" /> : <RefreshCw size={15} />}
            onClick={onTrigger}
            disabled={loading}
          >
            {loading ? 'Running…' : 'Run'}
          </BaseButton>
        </div>
      </div>
      {children}
    </div>
  )
}

function ConfidenceBadge({ value }) {
  if (value == null) return null
  const color = value >= 80 ? 'success' : value >= 60 ? 'warning' : 'danger'
  return <BaseBadge color={color} size="small">{value}% confidence</BaseBadge>
}

function RiskLevelBadge({ level }) {
  const map = { critical: 'danger', high: 'danger', medium: 'warning', low: 'success', minimal: 'success' }
  if (!level) return null
  return <BaseBadge color={map[level?.toLowerCase()] || 'info'} size="small">{level}</BaseBadge>
}

const muted = 'text-sm text-slate-500 py-2 block'

function TimeoutNotice() {
  return (
    <div className="flex items-start gap-2 text-sm text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-lg px-3 py-2">
      <Clock size={14} className="shrink-0 mt-0.5" />
      <span>This is taking longer than expected. Click Run to try again.</span>
    </div>
  )
}

/** Shared GET-result + POST-trigger + poll-until-processed mechanics, with a
 * hard timeout so a stuck backend task can't spin the UI forever. */
function useAiPanel(resultUrl, { isProcessed } = {}) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [polling, setPolling] = useState(false)
  const [timedOut, setTimedOut] = useState(false)
  const pollStartRef = useRef(null)
  const processedCheck = isProcessed || (d => Boolean(d?.processed))

  const fetchResult = useCallback(async () => {
    try {
      const res = await api.get(resultUrl)
      setData(res.data)
      if (processedCheck(res.data)) {
        setPolling(false)
        setTimedOut(false)
      }
      return res.data
    } catch {
      return null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resultUrl])

  useEffect(() => { fetchResult() }, [fetchResult])

  useEffect(() => {
    if (!polling) return undefined
    if (!pollStartRef.current) pollStartRef.current = Date.now()
    const id = setInterval(() => {
      if (Date.now() - pollStartRef.current > AI_POLL_TIMEOUT_MS) {
        setPolling(false)
        setTimedOut(true)
        pollStartRef.current = null
        return
      }
      if (isTabVisible()) fetchResult()
    }, AI_POLL_INTERVAL_MS)
    return () => clearInterval(id)
  }, [polling, fetchResult])

  const startPolling = useCallback(() => {
    pollStartRef.current = Date.now()
    setTimedOut(false)
    setPolling(true)
  }, [])

  return { data, setData, loading, setLoading, polling, timedOut, startPolling }
}

// ── A4 Duplicate Detection ────────────────────────────────────────────────────

export function AiDuplicatePanel({ submissionId }) {
  const toast = useToast()
  const { data, setData, loading, setLoading, polling, timedOut, startPolling } = useAiPanel(
    `/submissions/${submissionId}/ai-duplicate/`,
    { isProcessed: d => d?.ai_duplicate_processed },
  )

  const trigger = async () => {
    setLoading(true)
    try {
      await api.post(`/submissions/${submissionId}/trigger-ai-duplicate/`)
      startPolling()
      setData(d => d ? { ...d, ai_duplicate_processed: false } : null)
      toast.info('Duplicate scan running…')
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed to trigger duplicate scan.')
    } finally {
      setLoading(false)
    }
  }

  const isDuplicate = data?.ai_duplicate_is_duplicate
  const similar = data?.ai_duplicate_similar_cases || []

  return (
    <AiPanelShell title="Duplicate Detection" icon={<BrainCircuit size={20} className="text-primary-500" />}
      onTrigger={trigger} loading={loading || polling} lastRun={data?.ai_duplicate_generated_at}>
      {polling ? (
        <span className={muted}>Scanning for duplicates…</span>
      ) : timedOut ? (
        <TimeoutNotice />
      ) : !data?.ai_duplicate_processed ? (
        <span className={muted}>Not yet analysed. Click Run to detect duplicates.</span>
      ) : (
        <div className="py-2 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            {isDuplicate ? <XCircle size={18} className="text-red-600" /> : <CheckCircle2 size={18} className="text-emerald-600" />}
            <span className="font-semibold text-slate-800 dark:text-slate-100">{isDuplicate ? 'Possible Duplicate Found' : 'No Duplicates Detected'}</span>
            <ConfidenceBadge value={data.ai_duplicate_confidence} />
          </div>
          {data.ai_duplicate_recommendation && <span className="text-sm text-slate-600 dark:text-slate-300">{data.ai_duplicate_recommendation}</span>}
          {similar.length > 0 && (
            <div>
              <span className="font-semibold text-sm text-slate-700 dark:text-slate-200">Similar Cases:</span>
              {similar.map((c, i) => (
                <div key={i} className="pt-1 text-sm text-slate-600 dark:text-slate-300"><strong>{c.reference}</strong> — {c.similarity_reason}</div>
              ))}
            </div>
          )}
        </div>
      )}
    </AiPanelShell>
  )
}

// ── B2 Risk Assessment ────────────────────────────────────────────────────────

export function AiRiskPanel({ submissionId }) {
  const toast = useToast()
  const { data, loading, setLoading, polling, timedOut, startPolling } = useAiPanel(
    `/submissions/${submissionId}/ai-risk/`,
    { isProcessed: d => d?.ai_risk_processed },
  )

  const trigger = async () => {
    setLoading(true)
    try {
      await api.post(`/submissions/${submissionId}/trigger-ai-risk/`)
      startPolling()
      toast.info('Risk assessment running…')
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed to trigger risk assessment.')
    } finally {
      setLoading(false)
    }
  }

  const factors = data?.ai_risk_factors || []
  const mitigations = data?.ai_risk_mitigation || []

  return (
    <AiPanelShell title="Risk Assessment" icon={<AlertTriangle size={20} className="text-amber-500" />}
      onTrigger={trigger} loading={loading || polling} lastRun={data?.ai_risk_generated_at}>
      {polling ? (
        <span className={muted}>Assessing risk…</span>
      ) : timedOut ? (
        <TimeoutNotice />
      ) : !data?.ai_risk_processed ? (
        <span className={muted}>Not yet analysed. Click Run to assess risk.</span>
      ) : (
        <div className="py-2 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-base text-slate-800 dark:text-slate-100">Score: {data.ai_risk_score ?? '—'}/100</span>
            <RiskLevelBadge level={data.ai_risk_level} />
          </div>
          {data.ai_risk_recommendation && <span className="text-sm text-slate-600 dark:text-slate-300">{data.ai_risk_recommendation}</span>}
          {factors.length > 0 && (
            <div>
              <span className="font-semibold text-sm text-slate-700 dark:text-slate-200">Risk Factors:</span>
              <ul className="mt-1 ml-4 list-disc text-sm text-slate-600 dark:text-slate-300">{factors.map((f, i) => <li key={i}>{f}</li>)}</ul>
            </div>
          )}
          {mitigations.length > 0 && (
            <div>
              <span className="font-semibold text-sm text-slate-700 dark:text-slate-200">Mitigation Steps:</span>
              <ul className="mt-1 ml-4 list-disc text-sm text-slate-600 dark:text-slate-300">{mitigations.map((m, i) => <li key={i}>{m}</li>)}</ul>
            </div>
          )}
        </div>
      )}
    </AiPanelShell>
  )
}

// ── B3 Recommended Outcome ────────────────────────────────────────────────────

export function AiOutcomePanel({ submissionId }) {
  const toast = useToast()
  const { data, loading, setLoading, polling, timedOut, startPolling } = useAiPanel(
    `/submissions/${submissionId}/ai-outcome/`,
    { isProcessed: d => d?.ai_outcome_processed },
  )

  const trigger = async () => {
    setLoading(true)
    try {
      await api.post(`/submissions/${submissionId}/trigger-ai-outcome/`)
      startPolling()
      toast.info('Outcome recommendation running…')
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed to trigger outcome recommendation.')
    } finally {
      setLoading(false)
    }
  }

  const conditions = data?.ai_outcome_conditions || []

  return (
    <AiPanelShell title="Recommended Outcome" icon={<CheckCircle2 size={20} className="text-emerald-500" />}
      onTrigger={trigger} loading={loading || polling} lastRun={data?.ai_outcome_generated_at}>
      {polling ? (
        <span className={muted}>Generating recommendation…</span>
      ) : timedOut ? (
        <TimeoutNotice />
      ) : !data?.ai_outcome_processed ? (
        <span className={muted}>Not yet analysed. Click Run for outcome recommendation.</span>
      ) : (
        <div className="py-2 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <span className="font-bold text-lg text-slate-800 dark:text-slate-100">{data.ai_outcome_recommendation || '—'}</span>
            <ConfidenceBadge value={data.ai_outcome_confidence} />
          </div>
          {data.ai_outcome_rationale && <span className="text-sm text-slate-600 dark:text-slate-300">{data.ai_outcome_rationale}</span>}
          {data.ai_outcome_legal_basis && (
            <div className="text-sm text-slate-600 dark:text-slate-300">
              <span className="font-semibold text-slate-700 dark:text-slate-200">Legal Basis:</span> {data.ai_outcome_legal_basis}
            </div>
          )}
          {conditions.length > 0 && (
            <div>
              <span className="font-semibold text-sm text-slate-700 dark:text-slate-200">Conditions:</span>
              <ul className="mt-1 ml-4 list-disc text-sm text-slate-600 dark:text-slate-300">{conditions.map((c, i) => <li key={i}>{c}</li>)}</ul>
            </div>
          )}
        </div>
      )}
    </AiPanelShell>
  )
}

// ── B5 Notice of Allegation ───────────────────────────────────────────────────

export function AiNoaPanel({ submissionId }) {
  const toast = useToast()
  const { data, loading, setLoading, polling, timedOut, startPolling } = useAiPanel(
    `/submissions/${submissionId}/ai-noa/`,
    { isProcessed: d => d?.ai_noa_processed },
  )

  const trigger = async () => {
    setLoading(true)
    try {
      await api.post(`/submissions/${submissionId}/trigger-ai-noa/`, { response_deadline_days: 14 })
      startPolling()
      toast.info('Notice of Allegation draft running…')
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed to trigger NOA draft.')
    } finally {
      setLoading(false)
    }
  }

  const copyToClipboard = () => {
    if (data?.ai_noa_content) {
      navigator.clipboard.writeText(data.ai_noa_content)
      toast.success('Copied to clipboard.')
    }
  }

  return (
    <AiPanelShell title="Notice of Allegation (Draft)" icon={<FileText size={20} className="text-primary-500" />}
      onTrigger={trigger} loading={loading || polling} lastRun={data?.ai_noa_generated_at}>
      {polling ? (
        <span className={muted}>Drafting Notice of Allegation…</span>
      ) : timedOut ? (
        <TimeoutNotice />
      ) : !data?.ai_noa_processed ? (
        <span className={muted}>Not yet drafted. Click Run to generate a Notice of Allegation.</span>
      ) : (
        <div className="py-2 flex flex-col gap-3">
          {data.ai_noa_subject && <span className="font-semibold text-sm text-slate-800 dark:text-slate-100">Subject: {data.ai_noa_subject}</span>}
          <div className="relative">
            <BaseTextarea hideLabel label="Notice of Allegation" value={data.ai_noa_content || ''} readOnly rows={12} inputClassName="font-mono text-[13px]" />
            <BaseButton variant="ghost" size="sm" icon={<Copy size={14} />} onClick={copyToClipboard} className="absolute top-2 right-2">Copy</BaseButton>
          </div>
        </div>
      )}
    </AiPanelShell>
  )
}

// ── F3 Outcome Letter ─────────────────────────────────────────────────────────

export function AiLetterPanel({ submissionId, suggestedOutcome = '' }) {
  const toast = useToast()
  const { data, loading, setLoading, polling, timedOut, startPolling } = useAiPanel(
    `/submissions/${submissionId}/ai-letter/`,
    { isProcessed: d => d?.ai_letter_processed },
  )
  const [outcome, setOutcome] = useState(suggestedOutcome)

  const trigger = async () => {
    setLoading(true)
    try {
      await api.post(`/submissions/${submissionId}/trigger-ai-letter/`, { outcome })
      startPolling()
      toast.info('Outcome letter drafting…')
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed to trigger letter draft.')
    } finally {
      setLoading(false)
    }
  }

  const copyToClipboard = () => {
    if (data?.ai_letter_content) {
      navigator.clipboard.writeText(data.ai_letter_content)
      toast.success('Copied to clipboard.')
    }
  }

  const actionItems = data?.ai_letter_action_items || []

  return (
    <AiPanelShell title="Outcome Letter (Draft)" icon={<FileText size={20} className="text-primary-500" />}
      onTrigger={trigger} loading={loading || polling} lastRun={data?.ai_letter_generated_at}>
      <div className="py-2 flex flex-col gap-3">
        <label className="block">
          <span className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Outcome decision (optional)</span>
          <input
            type="text"
            value={outcome}
            onChange={e => setOutcome(e.target.value)}
            placeholder="e.g. Approved with conditions"
            className="input w-full"
          />
        </label>

        {polling ? (
          <span className="text-sm text-slate-500">Drafting outcome letter…</span>
        ) : timedOut ? (
          <TimeoutNotice />
        ) : !data?.ai_letter_processed ? (
          <span className="text-sm text-slate-500">Not yet drafted. Click Run to generate an outcome letter.</span>
        ) : (
          <>
            {data.ai_letter_subject && <span className="font-semibold text-sm text-slate-800 dark:text-slate-100">Subject: {data.ai_letter_subject}</span>}
            <div className="relative">
              <BaseTextarea hideLabel label="Outcome letter" value={data.ai_letter_content || ''} readOnly rows={14} inputClassName="font-mono text-[13px]" />
              <BaseButton variant="ghost" size="sm" icon={<Copy size={14} />} onClick={copyToClipboard} className="absolute top-2 right-2">Copy</BaseButton>
            </div>
            {actionItems.length > 0 && (
              <div>
                <span className="font-semibold text-sm text-slate-700 dark:text-slate-200">Action Items:</span>
                <ul className="mt-1 ml-4 list-disc text-sm text-slate-600 dark:text-slate-300">{actionItems.map((item, i) => <li key={i}>{item}</li>)}</ul>
              </div>
            )}
          </>
        )}
      </div>
    </AiPanelShell>
  )
}

// ── Structured Outcome Letter (Cessation / Recruitment / Secondment / Leave Payout) ──

const STRUCTURED_LETTER_CODES = new Set([
  'CESSATION-AGE', 'CESSATION-NOTICE-AGE', 'CESSATION-MEDICAL',
  'CESSATION-DEATH', 'CESSATION-REDUNDANCY', 'CESSATION-RESIGNATION',
  'RECRUIT-PROBATION', 'RECRUIT-CONFIRM', 'RECRUIT-DIRECT',
  'RECRUIT-TEMPORARY', 'RECRUIT-CONTRACT',
  'SECONDMENT', 'LEAVE-PAYOUT',
])

export function StructuredLetterPanel({ submissionId, formTypeCode }) {
  const toast = useToast()
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)

  if (!STRUCTURED_LETTER_CODES.has(formTypeCode)) return null

  const generate = async () => {
    setLoading(true)
    try {
      const res = await api.post(`/submissions/${submissionId}/generate-letter/`)
      setResult(res.data)
      toast.success('Letter generated.')
    } catch (err) {
      const msg = err?.response?.data?.error || 'Failed to generate letter.'
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  const copyToClipboard = () => {
    const text = result?.body_text || ''
    if (text) { navigator.clipboard.writeText(text); toast.success('Copied to clipboard.') }
  }

  return (
    <AiPanelShell
      title="Generate Outcome Letter"
      icon={<FileText size={20} className="text-primary-500" />}
      onTrigger={generate}
      loading={loading}
      lastRun={null}
    >
      <div className="py-2 flex flex-col gap-3">
        {!result ? (
          <span className="text-sm text-slate-500">
            Click Run to generate a structured outcome letter from the form data.
          </span>
        ) : (
          <>
            {result.subject && (
              <span className="font-semibold text-sm text-slate-800 dark:text-slate-100">
                Subject: {result.subject}
              </span>
            )}
            <div className="relative">
              {result.body_html ? (
                <div
                  className="border rounded bg-white dark:bg-slate-900 p-3 text-sm overflow-auto max-h-96"
                  dangerouslySetInnerHTML={{ __html: result.body_html }}
                />
              ) : (
                <BaseTextarea
                  hideLabel label="Letter" value={result.body_text || ''}
                  readOnly rows={14} inputClassName="font-mono text-[13px]"
                />
              )}
              <BaseButton variant="ghost" size="sm" icon={<Copy size={14} />}
                onClick={copyToClipboard} className="absolute top-2 right-2">
                Copy
              </BaseButton>
            </div>
          </>
        )}
      </div>
    </AiPanelShell>
  )
}
