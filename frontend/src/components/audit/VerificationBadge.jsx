import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ShieldCheck, Copy, CheckCircle2, XCircle } from 'lucide-react'
import api from '../../api/client'
import BaseButton from '../shared/BaseButton'
import BaseBadge from '../shared/BaseBadge'
import BaseSpinner from '../shared/BaseSpinner'

/** Tamper-evident verification badge — popover with SHA-256 proof. */
export default function VerificationBadge({ submissionId, workflowEventId, contentHash, compact = false }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [proof, setProof] = useState(null)
  const [copied, setCopied] = useState(false)
  const ref = useRef(null)

  const loadProof = async () => {
    if (!submissionId || !workflowEventId) return
    setLoading(true)
    try {
      const res = await api.get(`/submissions/${submissionId}/decision-proof/?event_id=${workflowEventId}`)
      setProof(res.data)
    } catch {
      setProof(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!open) return undefined
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const toggle = () => {
    const next = !open
    setOpen(next)
    if (next && !proof) loadProof()
  }

  const hashToShow = proof?.content_hash || contentHash || ''
  const verified = proof?.verification?.verified

  const copyHash = async () => {
    if (!hashToShow) return
    try {
      await navigator.clipboard.writeText(hashToShow)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* ignore */ }
  }

  return (
    <div className="relative inline-block" ref={ref}>
      <BaseButton
        variant={compact ? 'ghost' : 'outline'}
        size="sm"
        icon={<ShieldCheck size={15} className="text-emerald-600" />}
        onClick={toggle}
        className="shrink-0"
        aria-expanded={open}
      >
        {!compact && t('decision_proof.badge_label')}
      </BaseButton>

      {open && (
        <div className="absolute z-50 mt-1 left-0 w-80 card p-4 shadow-card-lg space-y-3">
          <div className="flex items-start gap-2">
            <ShieldCheck size={22} className="text-primary-600 shrink-0" />
            <div>
              <span className="block font-semibold text-slate-800 dark:text-slate-100">{t('decision_proof.popover_title')}</span>
              <span className="text-xs text-slate-500">{t('decision_proof.popover_subtitle')}</span>
            </div>
          </div>

          {loading && (
            <div className="flex items-center gap-2 py-2">
              <BaseSpinner size="sm" label="" />
              <span className="text-xs text-slate-500">{t('decision_proof.verifying')}</span>
            </div>
          )}

          {!loading && proof && (
            <>
              <div className="flex flex-wrap gap-2">
                {verified ? (
                  <BaseBadge color="success" icon={<CheckCircle2 size={13} />}>{t('decision_proof.status_valid')}</BaseBadge>
                ) : (
                  <BaseBadge color="danger" icon={<XCircle size={13} />}>{t('decision_proof.status_invalid')}</BaseBadge>
                )}
                <BaseBadge color="outline" size="small">{proof.previous_stage} → {proof.new_stage}</BaseBadge>
              </div>

              <p className="text-xs text-slate-600 dark:text-slate-300">
                {proof.actor_username} ·{' '}
                {new Date(proof.recorded_at).toLocaleString('en-VU', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </p>

              <div className="rounded-md p-3 font-mono text-[11px] break-all leading-relaxed bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-200">
                {hashToShow}
              </div>

              <p className="text-[10px] text-slate-500">{proof.verification?.message || t('decision_proof.hash_hint')}</p>

              <BaseButton variant="ghost" size="sm" icon={<Copy size={14} />} onClick={copyHash}>
                {copied ? t('decision_proof.copied') : t('decision_proof.copy_hash')}
              </BaseButton>
            </>
          )}

          {!loading && !proof && open && (
            <span className="text-xs text-slate-500">{t('decision_proof.load_failed')}</span>
          )}
        </div>
      )}
    </div>
  )
}
