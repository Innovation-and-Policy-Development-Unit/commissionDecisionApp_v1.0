import { useState, useEffect, useCallback } from 'react'
import { Send, CheckCircle2, Clock, Download, ShieldCheck, X } from 'lucide-react'
import api from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import BaseButton from '../shared/BaseButton'
import BaseInput from '../shared/BaseInput'
import BaseTextarea from '../shared/BaseTextarea'

const POST_DECISION_STAGES = [
  'approved', 'rejected', 'minutes_drafted_signed',
  'decision_entered_assigned', 'under_implementation', 'implementation_report',
]
const SERVE_ROLES = ['psc_secretary', 'psc_admin', 'senior_admin_officer']
const ACK_ROLES = ['ministry_hr', 'dept_admin', 'head_of_agency']
const VIEW_ROLES = [
  ...SERVE_ROLES, ...ACK_ROLES,
  'psc_officer', 'psc_manager', 'psc_commissioner', 'chairperson',
]

const fmtDateTime = (iso) =>
  new Date(iso).toLocaleString('en-VU', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })

/**
 * Formal decision service + acknowledgement.
 * Secretariat serves the outcome letter (immutable snapshot); the ministry
 * acknowledges receipt in-system — timestamped and audited.
 */
export default function DecisionServicePanel({ submission }) {
  const { user } = useAuth()
  const toast = useToast()
  const [services, setServices] = useState(null)   // null = not loaded
  const [serveOpen, setServeOpen] = useState(false)
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [ackNote, setAckNote] = useState('')
  const [busy, setBusy] = useState(false)

  const role = user?.role
  const applicable = POST_DECISION_STAGES.includes(submission?.current_stage)
  const canView = applicable && VIEW_ROLES.includes(role)
  const canServe = SERVE_ROLES.includes(role)
  const canAck = ACK_ROLES.includes(role)

  const load = useCallback(async () => {
    try {
      const r = await api.get(`/submissions/${submission.id}/decision-service/`)
      setServices(r.data.services || [])
    } catch {
      setServices([])
    }
  }, [submission?.id])

  useEffect(() => {
    if (canView && submission?.id) load()
  }, [canView, submission?.id, load])

  if (!canView || services === null) return null

  const active = services.find(s => !s.superseded) || null
  const history = services.filter(s => s !== active)
  const awaitingAck = active && !active.acknowledged_at

  const openServeModal = async () => {
    const last = services[0]
    if (last) {
      setSubject(last.letter_subject || '')
      setBody(last.letter_body || '')
    } else {
      // Prefill from the F3 outcome letter draft if one was generated.
      try {
        const r = await api.get(`/submissions/${submission.id}/ai-letter/`)
        setSubject(r.data?.ai_letter_subject || '')
        setBody(r.data?.ai_letter_content || '')
      } catch {
        setSubject('')
        setBody('')
      }
    }
    setServeOpen(true)
  }

  const serve = async () => {
    if (!body.trim()) { toast.error('The letter text is required.'); return }
    setBusy(true)
    try {
      await api.post(`/submissions/${submission.id}/serve-decision/`, {
        letter_subject: subject,
        letter_body: body,
      })
      setServeOpen(false)
      await load()
      toast.success('Decision served — the ministry has been notified and must acknowledge receipt.')
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Could not serve the decision.')
    } finally {
      setBusy(false)
    }
  }

  const acknowledge = async () => {
    setBusy(true)
    try {
      await api.post(`/submissions/${submission.id}/acknowledge-decision/`, { note: ackNote })
      setAckNote('')
      await load()
      toast.success('Receipt acknowledged — recorded with your name and a timestamp.')
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Could not acknowledge.')
    } finally {
      setBusy(false)
    }
  }

  const downloadLetter = (service) => {
    api.get(`/submissions/${submission.id}/decision-service/${service.id}/letter/`, { responseType: 'blob' })
      .then(r => {
        const url = URL.createObjectURL(new Blob([r.data], { type: 'application/pdf' }))
        const a = document.createElement('a')
        a.href = url
        a.target = '_blank'
        a.rel = 'noopener'
        a.click()
        setTimeout(() => URL.revokeObjectURL(url), 5000)
      })
      .catch(() => toast.error('Could not open the served letter.'))
  }

  const ServiceRow = ({ s, compact = false }) => (
    <div className={`rounded-lg border px-3 py-2.5 ${
      compact
        ? 'border-slate-200 dark:border-slate-700 opacity-75'
        : s.acknowledged_at
          ? 'border-emerald-200 dark:border-emerald-900 bg-emerald-50/50 dark:bg-emerald-900/10'
          : 'border-amber-200 dark:border-amber-900 bg-amber-50/50 dark:bg-amber-900/10'
    }`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
            {s.outcome_label}
            {s.superseded && (
              <span className="ml-2 text-[10px] font-semibold uppercase text-slate-400">superseded</span>
            )}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Served by {s.served_by_name} · {fmtDateTime(s.served_at)}
          </p>
          {s.acknowledged_at ? (
            <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-1 flex items-center gap-1">
              <CheckCircle2 size={12} />
              Acknowledged by {s.acknowledged_by_name} · {fmtDateTime(s.acknowledged_at)}
            </p>
          ) : !s.superseded && (
            <p className="text-xs text-amber-700 dark:text-amber-300 mt-1 flex items-center gap-1">
              <Clock size={12} />
              Awaiting ministry acknowledgement
              {s.reminder_count > 0 && ` · ${s.reminder_count} reminder(s) sent`}
            </p>
          )}
          {s.acknowledgement_note && (
            <p className="text-xs italic text-slate-500 dark:text-slate-400 mt-1">
              “{s.acknowledgement_note}”
            </p>
          )}
        </div>
        {s.has_pdf && (
          <button
            type="button"
            onClick={() => downloadLetter(s)}
            className="shrink-0 inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-primary-600 dark:hover:text-primary-400"
            title="Open the letter exactly as served (hash-protected PDF)"
          >
            <Download size={12} /> Letter
          </button>
        )}
      </div>
    </div>
  )

  return (
    <div className="card card-compact">
      <div className="flex items-center justify-between gap-2 mb-4 pb-3 border-b border-slate-100 dark:border-slate-700">
        <div className="flex items-center gap-2">
          <ShieldCheck size={14} className="text-slate-400" />
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Decision Service</h3>
        </div>
        {canServe && (
          <BaseButton
            variant={active ? 'ghost' : 'primary'}
            size="sm"
            icon={<Send size={13} />}
            onClick={openServeModal}
            disabled={busy}
          >
            {active ? 'Re-serve corrected letter' : 'Serve decision'}
          </BaseButton>
        )}
      </div>

      {!active && history.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          The decision has not yet been formally served on the ministry.
          {canServe && ' Serving creates an immutable letter the ministry must acknowledge.'}
        </p>
      ) : (
        <div className="space-y-2">
          {active && <ServiceRow s={active} />}
          {history.map(s => <ServiceRow key={s.id} s={s} compact />)}
        </div>
      )}

      {canAck && awaitingAck && (
        <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-700 space-y-2">
          <BaseInput
            hideLabel
            label="Acknowledgement note"
            placeholder="Optional note (e.g. received and forwarded to the DG)"
            value={ackNote}
            onChange={e => setAckNote(e.target.value)}
            disabled={busy}
          />
          <BaseButton
            variant="primary"
            size="sm"
            icon={<CheckCircle2 size={13} />}
            onClick={acknowledge}
            disabled={busy}
          >
            Acknowledge receipt
          </BaseButton>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Your name and the time of acknowledgement are permanently recorded.
          </p>
        </div>
      )}

      {/* Serve modal */}
      {serveOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white dark:bg-slate-800 p-5 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">
                Serve Commission decision on {submission.ministry_name || 'the ministry'}
              </h3>
              <button
                type="button"
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400"
                onClick={() => setServeOpen(false)}
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>
            <div className="space-y-3">
              <BaseInput
                label="Letter subject"
                value={subject}
                onChange={e => setSubject(e.target.value)}
                disabled={busy}
              />
              <BaseTextarea
                label="Letter text (served verbatim — cannot be edited after service)"
                rows={12}
                value={body}
                onChange={e => setBody(e.target.value)}
                disabled={busy}
              />
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Serving snapshots this text into a hash-protected PDF, notifies the ministry's
                HR and Head of Agency, and starts the acknowledgement clock. A re-serve
                supersedes any unacknowledged earlier letter.
              </p>
              <div className="flex justify-end gap-2">
                <BaseButton variant="ghost" size="sm" onClick={() => setServeOpen(false)} disabled={busy}>
                  Cancel
                </BaseButton>
                <BaseButton variant="primary" size="sm" icon={<Send size={13} />} onClick={serve} disabled={busy}>
                  {busy ? 'Serving…' : 'Serve decision'}
                </BaseButton>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
