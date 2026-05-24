import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Popover,
  PopoverTrigger,
  PopoverSurface,
  Button,
  Text,
  Badge,
  Spinner,
  tokens,
} from '@fluentui/react-components'
import {
  ShieldCheckmarkRegular,
  CopyRegular,
  CheckmarkCircleRegular,
  DismissCircleRegular,
} from '@fluentui/react-icons'
import api from '../../api/client'

/**
 * Tamper-evident verification badge — opens Fluent popover with SHA-256 proof.
 */
export default function VerificationBadge({
  submissionId,
  workflowEventId,
  contentHash,
  compact = false,
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [proof, setProof] = useState(null)
  const [copied, setCopied] = useState(false)

  const loadProof = async () => {
    if (!submissionId || !workflowEventId) return
    setLoading(true)
    try {
      const res = await api.get(
        `/submissions/${submissionId}/decision-proof/?event_id=${workflowEventId}`,
      )
      setProof(res.data)
    } catch {
      setProof(null)
    } finally {
      setLoading(false)
    }
  }

  const onOpenChange = (_e, data) => {
    setOpen(data.open)
    if (data.open && !proof) loadProof()
  }

  const hashToShow = proof?.content_hash || contentHash || ''

  const copyHash = async () => {
    if (!hashToShow) return
    try {
      await navigator.clipboard.writeText(hashToShow)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* ignore */
    }
  }

  const verified = proof?.verification?.verified

  return (
    <Popover open={open} onOpenChange={onOpenChange} positioning="below-start">
      <PopoverTrigger disableButtonEnhancement>
        <Button
          appearance={compact ? 'subtle' : 'outline'}
          size="small"
          icon={<ShieldCheckmarkRegular />}
          className="shrink-0"
          style={{ color: tokens.colorPaletteGreenForeground1 }}
        >
          {!compact && t('decision_proof.badge_label')}
        </Button>
      </PopoverTrigger>
      <PopoverSurface className="max-w-md p-4">
        <div className="space-y-3">
          <div className="flex items-start gap-2">
            <ShieldCheckmarkRegular
              fontSize={22}
              style={{ color: tokens.colorBrandForeground1 }}
            />
            <div>
              <Text weight="semibold" block>
                {t('decision_proof.popover_title')}
              </Text>
              <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
                {t('decision_proof.popover_subtitle')}
              </Text>
            </div>
          </div>

          {loading && (
            <div className="flex items-center gap-2 py-2">
              <Spinner size="tiny" />
              <Text size={200}>{t('decision_proof.verifying')}</Text>
            </div>
          )}

          {!loading && proof && (
            <>
              <div className="flex flex-wrap gap-2">
                {verified ? (
                  <Badge appearance="filled" color="success" icon={<CheckmarkCircleRegular />}>
                    {t('decision_proof.status_valid')}
                  </Badge>
                ) : (
                  <Badge appearance="filled" color="danger" icon={<DismissCircleRegular />}>
                    {t('decision_proof.status_invalid')}
                  </Badge>
                )}
                <Badge appearance="outline" size="small">
                  {proof.previous_stage} → {proof.new_stage}
                </Badge>
              </div>

              <Text size={200} block>
                {proof.actor_username} ·{' '}
                {new Date(proof.recorded_at).toLocaleString('en-VU', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Text>

              <div
                className="rounded-md p-3 font-mono text-[11px] break-all leading-relaxed"
                style={{
                  backgroundColor: tokens.colorNeutralBackground3,
                  color: tokens.colorNeutralForeground1,
                }}
              >
                {hashToShow}
              </div>

              <Text size={100} style={{ color: tokens.colorNeutralForeground3 }}>
                {proof.verification?.message || t('decision_proof.hash_hint')}
              </Text>

              <Button
                appearance="subtle"
                size="small"
                icon={<CopyRegular />}
                onClick={copyHash}
              >
                {copied ? t('decision_proof.copied') : t('decision_proof.copy_hash')}
              </Button>
            </>
          )}

          {!loading && !proof && open && (
            <Text size={200}>{t('decision_proof.load_failed')}</Text>
          )}
        </div>
      </PopoverSurface>
    </Popover>
  )
}
