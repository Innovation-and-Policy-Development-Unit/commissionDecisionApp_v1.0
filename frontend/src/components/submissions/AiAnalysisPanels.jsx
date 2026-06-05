/**
 * AiAnalysisPanels.jsx
 * Reusable AI result + trigger panels for SubmissionDetail.
 * Exports: AiDuplicatePanel, AiRiskPanel, AiOutcomePanel, AiNoaPanel, AiLetterPanel
 */
import { useState, useEffect, useCallback } from 'react'
import { BrainCircuit, Copy, RefreshCw, CheckCircle2, XCircle, AlertTriangle, FileText } from 'lucide-react'
import api from '../../api/client'
import { isTabVisible } from '../../hooks/useVisibilityAwareInterval'
import { useToast } from '../../context/ToastContext'
import BaseButton from '../shared/BaseButton'
import BaseBadge from '../shared/BaseBadge'
import BaseSpinner from '../shared/BaseSpinner'
import BaseTextarea from '../shared/BaseTextarea'

// ── Shared helpers ────────────────────────────────────────────────────────────

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

// ── A4 Duplicate Detection ────────────────────────────────────────────────────

export function AiDuplicatePanel({ submissionId }) {
  const toast = useToast()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [polling, setPolling] = useState(false)

  const fetchResult = useCallback(async () => {
    try {
      const res = await api.get(`/submissions/${submissionId}/ai-duplicate/`)
      setData(res.data)
      if (res.data.ai_duplicate_processed) setPolling(false)
    } catch { /* silently skip */ }
  }, [submissionId])

  useEffect(() => { fetchResult() }, [fetchResult])
  useEffect(() => {
    if (!polling) return undefined
    const id = setInterval(() => { if (isTabVisible()) fetchResult() }, 3000)
    return () => clearInterval(id)
  }, [polling, fetchResult])

  const trigger = async () => {
    setLoading(true)
    try {
      await api.post(`/submissions/${submissionId}/trigger-ai-duplicate/`)
      setPolling(true)
      setData(d => d ? { ...d, ai_duplicate_processed: false } : null)
      toast.info('Duplicate scan running…')
    } catch {
      toast.error('Failed to trigger duplicate scan.')
    } finally {
      setLoading(false)
    }
  }

  const isDuplicate = data?.ai_duplicate_is_duplicate
  const similar = data?.ai_duplicate_similar_cases || []

  return (
    <AiPanelShell title="Duplicate Detection" icon={<BrainCircuit size={20} className="text-primary-500" />}
      onTrigger={trigger} loading={loading || polling} lastRun={data?.ai_duplicate_generated_at}>
      {!data?.ai_duplicate_processed ? (
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
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [polling, setPolling] = useState(false)

  const fetchResult = useCallback(async () => {
    try {
      const res = await api.get(`/submissions/${submissionId}/ai-risk/`)
      setData(res.data)
      if (res.data.ai_risk_processed) setPolling(false)
    } catch { /* ignore */ }
  }, [submissionId])

  useEffect(() => { fetchResult() }, [fetchResult])
  useEffect(() => {
    if (!polling) return undefined
    const id = setInterval(() => { if (isTabVisible()) fetchResult() }, 3000)
    return () => clearInterval(id)
  }, [polling, fetchResult])

  const trigger = async () => {
    setLoading(true)
    try {
      await api.post(`/submissions/${submissionId}/trigger-ai-risk/`)
      setPolling(true)
      toast.info('Risk assessment running…')
    } catch {
      toast.error('Failed to trigger risk assessment.')
    } finally {
      setLoading(false)
    }
  }

  const factors = data?.ai_risk_factors || []
  const mitigations = data?.ai_risk_mitigation || []

  return (
    <AiPanelShell title="Risk Assessment" icon={<AlertTriangle size={20} className="text-amber-500" />}
      onTrigger={trigger} loading={loading || polling} lastRun={data?.ai_risk_generated_at}>
      {!data?.ai_risk_processed ? (
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
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [polling, setPolling] = useState(false)

  const fetchResult = useCallback(async () => {
    try {
      const res = await api.get(`/submissions/${submissionId}/ai-outcome/`)
      setData(res.data)
      if (res.data.ai_outcome_processed) setPolling(false)
    } catch { /* ignore */ }
  }, [submissionId])

  useEffect(() => { fetchResult() }, [fetchResult])
  useEffect(() => {
    if (!polling) return undefined
    const id = setInterval(() => { if (isTabVisible()) fetchResult() }, 3000)
    return () => clearInterval(id)
  }, [polling, fetchResult])

  const trigger = async () => {
    setLoading(true)
    try {
      await api.post(`/submissions/${submissionId}/trigger-ai-outcome/`)
      setPolling(true)
      toast.info('Outcome recommendation running…')
    } catch {
      toast.error('Failed to trigger outcome recommendation.')
    } finally {
      setLoading(false)
    }
  }

  const conditions = data?.ai_outcome_conditions || []

  return (
    <AiPanelShell title="Recommended Outcome" icon={<CheckCircle2 size={20} className="text-emerald-500" />}
      onTrigger={trigger} loading={loading || polling} lastRun={data?.ai_outcome_generated_at}>
      {!data?.ai_outcome_processed ? (
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
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [polling, setPolling] = useState(false)

  const fetchResult = useCallback(async () => {
    try {
      const res = await api.get(`/submissions/${submissionId}/ai-noa/`)
      setData(res.data)
      if (res.data.ai_noa_processed) setPolling(false)
    } catch { /* ignore */ }
  }, [submissionId])

  useEffect(() => { fetchResult() }, [fetchResult])
  useEffect(() => {
    if (!polling) return undefined
    const id = setInterval(() => { if (isTabVisible()) fetchResult() }, 3000)
    return () => clearInterval(id)
  }, [polling, fetchResult])

  const trigger = async () => {
    setLoading(true)
    try {
      await api.post(`/submissions/${submissionId}/trigger-ai-noa/`, { response_deadline_days: 14 })
      setPolling(true)
      toast.info('Notice of Allegation draft running…')
    } catch {
      toast.error('Failed to trigger NOA draft.')
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
      {!data?.ai_noa_processed ? (
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
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [polling, setPolling] = useState(false)
  const [outcome, setOutcome] = useState(suggestedOutcome)

  const fetchResult = useCallback(async () => {
    try {
      const res = await api.get(`/submissions/${submissionId}/ai-letter/`)
      setData(res.data)
      if (res.data.ai_letter_processed) setPolling(false)
    } catch { /* ignore */ }
  }, [submissionId])

  useEffect(() => { fetchResult() }, [fetchResult])
  useEffect(() => {
    if (!polling) return undefined
    const id = setInterval(() => { if (isTabVisible()) fetchResult() }, 3000)
    return () => clearInterval(id)
  }, [polling, fetchResult])

  const trigger = async () => {
    setLoading(true)
    try {
      await api.post(`/submissions/${submissionId}/trigger-ai-letter/`, { outcome })
      setPolling(true)
      toast.info('Outcome letter drafting…')
    } catch {
      toast.error('Failed to trigger letter draft.')
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

        {!data?.ai_letter_processed ? (
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
