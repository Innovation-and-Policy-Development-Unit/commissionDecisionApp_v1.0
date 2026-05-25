/**
 * AiAnalysisPanels.jsx
 * Reusable AI result + trigger panels for SubmissionDetail.
 * Exports: AiDuplicatePanel, AiRiskPanel, AiOutcomePanel, AiNoaPanel, AiLetterPanel
 */
import React, { useState, useEffect, useCallback } from 'react'
import {
  Card,
  CardHeader,
  Text,
  Button,
  Badge,
  Spinner,
  Divider,
  Textarea,
  Field,
} from '@fluentui/react-components'
import {
  BrainCircuitRegular,
  CopyRegular,
  ArrowSyncRegular,
  CheckmarkCircleRegular,
  ErrorCircleRegular,
  WarningRegular,
  DocumentRegular,
} from '@fluentui/react-icons'
import api from '../../api/client'
import { useToast } from '../../context/ToastContext'

// ── Shared helpers ────────────────────────────────────────────────────────────

function AiPanelShell({ title, icon, children, onTrigger, loading, lastRun }) {
  return (
    <Card>
      <CardHeader
        header={
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
            {icon}
            <Text weight="bold" size={400}>{title}</Text>
            {lastRun && (
              <Text size={100} style={{ color: 'var(--colorNeutralForeground3)', marginLeft: 'auto' }}>
                {new Date(lastRun).toLocaleString()}
              </Text>
            )}
          </div>
        }
        action={
          <Button
            size="small"
            appearance="subtle"
            icon={loading ? <Spinner size="tiny" /> : <ArrowSyncRegular />}
            onClick={onTrigger}
            disabled={loading}
          >
            {loading ? 'Running…' : 'Run'}
          </Button>
        }
      />
      {children}
    </Card>
  )
}

function ConfidenceBadge({ value }) {
  if (value == null) return null
  const color = value >= 80 ? 'success' : value >= 60 ? 'warning' : 'danger'
  return (
    <Badge appearance="tint" color={color} size="small">
      {value}% confidence
    </Badge>
  )
}

function RiskLevelBadge({ level }) {
  const map = {
    critical: 'danger', high: 'danger', medium: 'warning',
    low: 'success', minimal: 'success',
  }
  if (!level) return null
  return (
    <Badge appearance="tint" color={map[level?.toLowerCase()] || 'informative'} size="small">
      {level}
    </Badge>
  )
}

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
    } catch (e) {
      // silently skip
    }
  }, [submissionId])

  useEffect(() => { fetchResult() }, [fetchResult])

  useEffect(() => {
    if (!polling) return
    const id = setInterval(fetchResult, 3000)
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
    <AiPanelShell
      title="Duplicate Detection"
      icon={<BrainCircuitRegular fontSize={20} />}
      onTrigger={trigger}
      loading={loading || polling}
      lastRun={data?.ai_duplicate_generated_at}
    >
      {!data?.ai_duplicate_processed ? (
        <Text size={200} style={{ color: 'var(--colorNeutralForeground3)', padding: '8px 0' }}>
          Not yet analysed. Click Run to detect duplicates.
        </Text>
      ) : (
        <div style={{ padding: '8px 0', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {isDuplicate
              ? <ErrorCircleRegular style={{ color: 'var(--colorStatusDangerForeground1)' }} />
              : <CheckmarkCircleRegular style={{ color: 'var(--colorStatusSuccessForeground1)' }} />
            }
            <Text weight="semibold">
              {isDuplicate ? 'Possible Duplicate Found' : 'No Duplicates Detected'}
            </Text>
            <ConfidenceBadge value={data.ai_duplicate_confidence} />
          </div>
          {data.ai_duplicate_recommendation && (
            <Text size={200}>{data.ai_duplicate_recommendation}</Text>
          )}
          {similar.length > 0 && (
            <div>
              <Text weight="semibold" size={200}>Similar Cases:</Text>
              {similar.map((c, i) => (
                <div key={i} style={{ paddingTop: '4px' }}>
                  <Text size={200}><strong>{c.reference}</strong> — {c.similarity_reason}</Text>
                </div>
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
    } catch {}
  }, [submissionId])

  useEffect(() => { fetchResult() }, [fetchResult])
  useEffect(() => {
    if (!polling) return
    const id = setInterval(fetchResult, 3000)
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
    <AiPanelShell
      title="Risk Assessment"
      icon={<WarningRegular fontSize={20} />}
      onTrigger={trigger}
      loading={loading || polling}
      lastRun={data?.ai_risk_generated_at}
    >
      {!data?.ai_risk_processed ? (
        <Text size={200} style={{ color: 'var(--colorNeutralForeground3)', padding: '8px 0' }}>
          Not yet analysed. Click Run to assess risk.
        </Text>
      ) : (
        <div style={{ padding: '8px 0', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Text weight="semibold" size={400}>Score: {data.ai_risk_score ?? '—'}/100</Text>
            <RiskLevelBadge level={data.ai_risk_level} />
          </div>
          {data.ai_risk_recommendation && (
            <Text size={200}>{data.ai_risk_recommendation}</Text>
          )}
          {factors.length > 0 && (
            <div>
              <Text weight="semibold" size={200}>Risk Factors:</Text>
              <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                {factors.map((f, i) => <li key={i}><Text size={200}>{f}</Text></li>)}
              </ul>
            </div>
          )}
          {mitigations.length > 0 && (
            <div>
              <Text weight="semibold" size={200}>Mitigation Steps:</Text>
              <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                {mitigations.map((m, i) => <li key={i}><Text size={200}>{m}</Text></li>)}
              </ul>
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
    } catch {}
  }, [submissionId])

  useEffect(() => { fetchResult() }, [fetchResult])
  useEffect(() => {
    if (!polling) return
    const id = setInterval(fetchResult, 3000)
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
  const precedents = data?.ai_outcome_precedents || []

  return (
    <AiPanelShell
      title="Recommended Outcome"
      icon={<CheckmarkCircleRegular fontSize={20} />}
      onTrigger={trigger}
      loading={loading || polling}
      lastRun={data?.ai_outcome_generated_at}
    >
      {!data?.ai_outcome_processed ? (
        <Text size={200} style={{ color: 'var(--colorNeutralForeground3)', padding: '8px 0' }}>
          Not yet analysed. Click Run for outcome recommendation.
        </Text>
      ) : (
        <div style={{ padding: '8px 0', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Text weight="bold" size={500}>{data.ai_outcome_recommendation || '—'}</Text>
            <ConfidenceBadge value={data.ai_outcome_confidence} />
          </div>
          {data.ai_outcome_rationale && <Text size={200}>{data.ai_outcome_rationale}</Text>}
          {data.ai_outcome_legal_basis && (
            <div>
              <Text weight="semibold" size={200}>Legal Basis:</Text>
              <Text size={200}> {data.ai_outcome_legal_basis}</Text>
            </div>
          )}
          {conditions.length > 0 && (
            <div>
              <Text weight="semibold" size={200}>Conditions:</Text>
              <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                {conditions.map((c, i) => <li key={i}><Text size={200}>{c}</Text></li>)}
              </ul>
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
    } catch {}
  }, [submissionId])

  useEffect(() => { fetchResult() }, [fetchResult])
  useEffect(() => {
    if (!polling) return
    const id = setInterval(fetchResult, 3000)
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
    <AiPanelShell
      title="Notice of Allegation (Draft)"
      icon={<DocumentRegular fontSize={20} />}
      onTrigger={trigger}
      loading={loading || polling}
      lastRun={data?.ai_noa_generated_at}
    >
      {!data?.ai_noa_processed ? (
        <Text size={200} style={{ color: 'var(--colorNeutralForeground3)', padding: '8px 0' }}>
          Not yet drafted. Click Run to generate a Notice of Allegation.
        </Text>
      ) : (
        <div style={{ padding: '8px 0', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {data.ai_noa_subject && (
            <Text weight="semibold" size={300}>Subject: {data.ai_noa_subject}</Text>
          )}
          <div style={{ position: 'relative' }}>
            <Textarea
              value={data.ai_noa_content || ''}
              readOnly
              rows={12}
              style={{ width: '100%', fontFamily: 'monospace', fontSize: '13px' }}
            />
            <Button
              size="small"
              appearance="subtle"
              icon={<CopyRegular />}
              onClick={copyToClipboard}
              style={{ position: 'absolute', top: '8px', right: '8px' }}
            >
              Copy
            </Button>
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
    } catch {}
  }, [submissionId])

  useEffect(() => { fetchResult() }, [fetchResult])
  useEffect(() => {
    if (!polling) return
    const id = setInterval(fetchResult, 3000)
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
    <AiPanelShell
      title="Outcome Letter (Draft)"
      icon={<DocumentRegular fontSize={20} />}
      onTrigger={trigger}
      loading={loading || polling}
      lastRun={data?.ai_letter_generated_at}
    >
      <div style={{ padding: '8px 0', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <Field label="Outcome decision (optional)" size="small">
          <input
            type="text"
            value={outcome}
            onChange={e => setOutcome(e.target.value)}
            placeholder="e.g. Approved with conditions"
            style={{
              width: '100%', padding: '6px 8px', borderRadius: '4px',
              border: '1px solid var(--colorNeutralStroke1)',
              background: 'var(--colorNeutralBackground1)',
              color: 'var(--colorNeutralForeground1)',
            }}
          />
        </Field>

        {!data?.ai_letter_processed ? (
          <Text size={200} style={{ color: 'var(--colorNeutralForeground3)' }}>
            Not yet drafted. Click Run to generate an outcome letter.
          </Text>
        ) : (
          <>
            {data.ai_letter_subject && (
              <Text weight="semibold" size={300}>Subject: {data.ai_letter_subject}</Text>
            )}
            <div style={{ position: 'relative' }}>
              <Textarea
                value={data.ai_letter_content || ''}
                readOnly
                rows={14}
                style={{ width: '100%', fontFamily: 'monospace', fontSize: '13px' }}
              />
              <Button
                size="small"
                appearance="subtle"
                icon={<CopyRegular />}
                onClick={copyToClipboard}
                style={{ position: 'absolute', top: '8px', right: '8px' }}
              >
                Copy
              </Button>
            </div>
            {actionItems.length > 0 && (
              <div>
                <Text weight="semibold" size={200}>Action Items:</Text>
                <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                  {actionItems.map((item, i) => (
                    <li key={i}><Text size={200}>{item}</Text></li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </div>
    </AiPanelShell>
  )
}
