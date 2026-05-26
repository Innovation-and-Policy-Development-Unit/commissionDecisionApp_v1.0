import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import PageHeader from '../../components/shared/PageHeader'
import Modal from '../../components/shared/Modal'
import { Plus, Send, CheckCircle2, Clock, FileText, Bell, Mail, Printer, Eye } from 'lucide-react'

function useChannelOptions(t) {
  return useMemo(() => ([
    { value: 'letter', label: t('secretariat.channel_letter'), icon: FileText },
    { value: 'email', label: t('secretariat.channel_email'), icon: Mail },
    { value: 'portal', label: t('secretariat.channel_portal'), icon: Bell },
  ]), [t])
}

function useStatusMeta(t) {
  return useMemo(() => ({
    draft: { label: t('secretariat.notif_status_draft'), cls: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300', icon: FileText },
    issued: { label: t('secretariat.notif_status_issued'), cls: 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300', icon: Send },
    acknowledged: { label: t('secretariat.notif_status_acknowledged'), cls: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300', icon: CheckCircle2 },
    pending: { label: t('secretariat.notif_status_pending'), cls: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300', icon: Clock },
  }), [t])
}

function useDecisionOutcomes(t) {
  return useMemo(() => ({
    approved: { label: t('secretariat.outcome_approved'), cls: 'text-emerald-600 dark:text-emerald-400' },
    rejected: { label: t('secretariat.outcome_rejected'), cls: 'text-red-600 dark:text-red-400' },
    deferred: { label: t('secretariat.outcome_deferred'), cls: 'text-amber-600 dark:text-amber-400' },
    returned: { label: t('secretariat.outcome_returned'), cls: 'text-orange-600 dark:text-orange-400' },
    noted: { label: t('secretariat.decision_outcome_noted'), cls: 'text-slate-500 dark:text-slate-400' },
  }), [t])
}

const MOCK_NOTIFICATIONS = [
  { id:  1, reference: 'NTF-2025-001', decision_ref: 'DEC-2025-001', submission_ref: 'PSC-2025-00012', title: 'Appointment — Director of Treasury, Ministry of Finance',              ministry: 'Ministry of Finance',        outcome: 'approved',  channel: 'letter',  status: 'acknowledged', issued_date: '2025-01-24', ack_date: '2025-01-28', recipient: 'Secretary-General, Ministry of Finance' },
  { id:  2, reference: 'NTF-2025-002', decision_ref: 'DEC-2025-002', submission_ref: 'PSC-2025-00013', title: 'Promotion — Senior Education Officer to Principal Education Officer',  ministry: 'Ministry of Education',      outcome: 'approved',  channel: 'letter',  status: 'acknowledged', issued_date: '2025-01-24', ack_date: '2025-02-03', recipient: 'Secretary-General, Ministry of Education' },
  { id:  3, reference: 'NTF-2025-003', decision_ref: 'DEC-2025-003', submission_ref: 'PSC-2025-00014', title: 'Transfer — Nurse Grade 5, Ministry of Health',                         ministry: 'Ministry of Health',         outcome: 'approved',  channel: 'letter',  status: 'acknowledged', issued_date: '2025-01-27', ack_date: '2025-02-05', recipient: 'Director of Health Services, MoH' },
  { id:  4, reference: 'NTF-2025-004', decision_ref: 'DEC-2025-004', submission_ref: 'PSC-2025-00018', title: 'Termination — Ministry of Infrastructure (deferred)',                  ministry: 'Ministry of Infrastructure', outcome: 'deferred',  channel: 'letter',  status: 'issued',       issued_date: '2025-02-14', ack_date: null, recipient: 'Secretary-General, Ministry of Infrastructure' },
  { id:  5, reference: 'NTF-2025-005', decision_ref: 'DEC-2025-005', submission_ref: 'PSC-2025-00020', title: 'Secondment — Agricultural Officer to FAO',                             ministry: 'Ministry of Agriculture',    outcome: 'approved',  channel: 'letter',  status: 'acknowledged', issued_date: '2025-02-17', ack_date: '2025-02-21', recipient: 'Secretary-General, Ministry of Agriculture' },
  { id:  6, reference: 'NTF-2025-006', decision_ref: 'DEC-2025-006', submission_ref: 'PSC-2025-00023', title: 'Reclassification — IT Officer Grades (returned)',                      ministry: 'Prime Minister\'s Office',   outcome: 'returned',  channel: 'letter',  status: 'acknowledged', issued_date: '2025-03-03', ack_date: '2025-03-10', recipient: 'Director General, Prime Minister\'s Office' },
  { id:  7, reference: 'NTF-2025-007', decision_ref: 'DEC-2025-007', submission_ref: 'PSC-2025-00025', title: 'Acting Appointment — Director, Dept of Forestry',                     ministry: 'Ministry of Agriculture',    outcome: 'approved',  channel: 'letter',  status: 'acknowledged', issued_date: '2025-03-03', ack_date: '2025-03-07', recipient: 'Secretary-General, Ministry of Agriculture' },
  { id:  8, reference: 'NTF-2025-008', decision_ref: 'DEC-2025-008', submission_ref: 'PSC-2025-00027', title: 'Appointment — Deputy Commissioner of Police',                          ministry: 'Ministry of Internal Affairs',outcome: 'approved', channel: 'letter',  status: 'acknowledged', issued_date: '2025-03-07', ack_date: '2025-03-11', recipient: 'Secretary-General, Ministry of Internal Affairs' },
  { id:  9, reference: 'NTF-2025-009', decision_ref: 'DEC-2025-009', submission_ref: 'PSC-2025-00029', title: 'Promotion — Principal Statistician, NSO',                              ministry: 'Ministry of Finance',        outcome: 'approved',  channel: 'letter',  status: 'acknowledged', issued_date: '2025-03-21', ack_date: '2025-03-26', recipient: 'Secretary-General, Ministry of Finance' },
  { id: 10, reference: 'NTF-2025-010', decision_ref: 'DEC-2025-010', submission_ref: 'PSC-2025-00031', title: 'Secondment — Legal Officer to Foreign Affairs (rejected)',              ministry: 'Ministry of Justice',        outcome: 'rejected',  channel: 'letter',  status: 'issued',       issued_date: '2025-03-21', ack_date: null, recipient: 'Secretary-General, Ministry of Justice' },
  { id: 11, reference: 'NTF-2025-011', decision_ref: 'DEC-2025-011', submission_ref: 'PSC-2025-00034', title: 'Appointment — Chief Nursing Officer, MoH',                             ministry: 'Ministry of Health',         outcome: 'approved',  channel: 'letter',  status: 'issued',       issued_date: '2025-04-11', ack_date: null, recipient: 'Director of Health Services, MoH' },
  { id: 12, reference: 'NTF-2025-012', decision_ref: 'DEC-2025-012', submission_ref: 'PSC-2025-00037', title: 'Termination — Finance Officer, Ministry of Education',                  ministry: 'Ministry of Education',      outcome: 'approved',  channel: 'letter',  status: 'issued',       issued_date: '2025-05-02', ack_date: null, recipient: 'Secretary-General, Ministry of Education' },
  { id: 13, reference: 'NTF-2025-013', decision_ref: 'DEC-2025-013', submission_ref: 'PSC-2025-00041', title: 'Appointment — Director of Finance, Ministry of Finance',                ministry: 'Ministry of Finance',        outcome: 'approved',  channel: 'letter',  status: 'draft',        issued_date: null, ack_date: null, recipient: 'Secretary-General, Ministry of Finance' },
  { id: 14, reference: 'NTF-2025-014', decision_ref: 'DEC-2025-014', submission_ref: 'PSC-2025-00038', title: 'Promotion — Senior Accountant to Principal Accountant',                 ministry: 'Ministry of Finance',        outcome: 'approved',  channel: 'letter',  status: 'draft',        issued_date: null, ack_date: null, recipient: 'Secretary-General, Ministry of Finance' },
  { id: 15, reference: 'NTF-2025-015', decision_ref: 'DEC-2025-015', submission_ref: 'PSC-2025-00039', title: 'Transfer — Education Officer (noted)',                                  ministry: 'Ministry of Education',      outcome: 'noted',     channel: 'portal',  status: 'pending',      issued_date: null, ack_date: null, recipient: 'HR Manager, Ministry of Education' },
  { id: 16, reference: 'NTF-2025-016', decision_ref: 'DEC-2025-016', submission_ref: 'PSC-2025-00044', title: 'Secondment — Health Information Officer to WHO',                        ministry: 'Ministry of Health',         outcome: 'approved',  channel: 'letter',  status: 'draft',        issued_date: null, ack_date: null, recipient: 'Director of Health Services, MoH' },
]

// ── Components ────────────────────────────────────────────────────────────────

function StatusBadge({ status, statusMeta }) {
  const m = statusMeta[status] || { label: status, cls: 'bg-slate-100 text-slate-600', icon: FileText }
  const Icon = m.icon
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${m.cls}`}>
      <Icon size={11} />
      {m.label}
    </span>
  )
}

function OutcomeText({ outcome, decisionOutcomes }) {
  const m = decisionOutcomes[outcome] || { label: outcome, cls: 'text-slate-500' }
  return <span className={`text-xs font-medium ${m.cls}`}>{m.label}</span>
}

function SummaryBar({ notifications, statusMeta }) {
  const counts = {
    draft:        notifications.filter(n => n.status === 'draft').length,
    pending:      notifications.filter(n => n.status === 'pending').length,
    issued:       notifications.filter(n => n.status === 'issued').length,
    acknowledged: notifications.filter(n => n.status === 'acknowledged').length,
  }
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
      {Object.entries(statusMeta).map(([k, meta]) => {
        const Icon = meta.icon
        return (
          <div key={k} className="card px-3 py-2.5 flex items-center gap-3">
            <Icon size={18} className={`shrink-0 ${meta.cls.split(' ')[1]}`} />
            <div>
              <p className="text-xl font-bold text-slate-800 dark:text-slate-100 leading-none">{counts[k]}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{meta.label}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function Notifications() {
  const { t } = useTranslation()
  const STATUS_META = useStatusMeta(t)
  const CHANNEL_OPTIONS = useChannelOptions(t)
  const DECISION_OUTCOMES = useDecisionOutcomes(t)

  const [notifications, setNotifications] = useState(MOCK_NOTIFICATIONS)
  const [q, setQ] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [outcomeFilter, setOutcomeFilter] = useState('')
  const [issueModalOpen, setIssueModalOpen] = useState(false)
  const [viewTarget, setViewTarget] = useState(null)
  const [form, setForm] = useState({ decision_ref: '', submission_ref: '', title: '', ministry: '', outcome: 'approved', recipient: '', channel: 'letter', notes: '' })
  const [nextId, setNextId] = useState(17)

  const set = key => e => setForm(f => ({ ...f, [key]: e.target.value }))

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    return notifications.filter(n => {
      if (statusFilter && n.status !== statusFilter) return false
      if (outcomeFilter && n.outcome !== outcomeFilter) return false
      if (s &&
        !n.reference.toLowerCase().includes(s) &&
        !n.decision_ref.toLowerCase().includes(s) &&
        !n.submission_ref.toLowerCase().includes(s) &&
        !n.ministry.toLowerCase().includes(s) &&
        !n.title.toLowerCase().includes(s)
      ) return false
      return true
    })
  }, [notifications, q, statusFilter, outcomeFilter])

  const handleIssue = e => {
    e.preventDefault()
    const year = new Date().getFullYear()
    const padded = String(nextId).padStart(3, '0')
    const newNotif = {
      id: nextId,
      reference: `NTF-${year}-${padded}`,
      decision_ref: form.decision_ref,
      submission_ref: form.submission_ref,
      title: form.title,
      ministry: form.ministry,
      outcome: form.outcome,
      channel: form.channel,
      status: 'draft',
      issued_date: null,
      ack_date: null,
      recipient: form.recipient,
    }
    setNotifications(prev => [newNotif, ...prev])
    setNextId(n => n + 1)
    setIssueModalOpen(false)
    setForm({ decision_ref: '', submission_ref: '', title: '', ministry: '', outcome: 'approved', recipient: '', channel: 'letter', notes: '' })
  }

  const handleMarkIssued = id => {
    setNotifications(prev => prev.map(n =>
      n.id === id ? { ...n, status: 'issued', issued_date: new Date().toISOString().slice(0, 10) } : n
    ))
  }

  const handleMarkAcknowledged = id => {
    setNotifications(prev => prev.map(n =>
      n.id === id ? { ...n, status: 'acknowledged', ack_date: new Date().toISOString().slice(0, 10) } : n
    ))
  }

  return (
    <div>
      <PageHeader
        title="Decision Notifications"
        subtitle="Track official notification letters issued to ministries following commission decisions."
        action={
          <button onClick={() => setIssueModalOpen(true)} className="btn-primary flex items-center gap-2">
            <Plus size={16} /> New Notification
          </button>
        }
      />

      <SummaryBar notifications={notifications} statusMeta={STATUS_META} />

      {/* Filters */}
      <div className="card p-4 mb-4 flex flex-col sm:flex-row gap-3 sm:items-center">
        <input
          type="search"
          placeholder="Search by reference, submission, ministry…"
          className="input flex-1"
          value={q}
          onChange={e => setQ(e.target.value)}
        />
        <select className="input sm:w-44" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          {Object.entries(STATUS_META).map(([v, m]) => (
            <option key={v} value={v}>{m.label}</option>
          ))}
        </select>
        <select className="input sm:w-36" value={outcomeFilter} onChange={e => setOutcomeFilter(e.target.value)}>
          <option value="">All outcomes</option>
          {Object.entries(DECISION_OUTCOMES).map(([v, m]) => (
            <option key={v} value={v}>{m.label}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Notification Ref.</th>
                <th>Decision</th>
                <th>Subject</th>
                <th>Ministry</th>
                <th>Outcome</th>
                <th>Channel</th>
                <th>Status</th>
                <th>Issued</th>
                <th className="sr-only">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(n => (
                <tr key={n.id}>
                  <td className="font-mono text-xs font-semibold text-primary-600 dark:text-primary-400">{n.reference}</td>
                  <td className="font-mono text-xs text-slate-500 dark:text-slate-400">{n.decision_ref}</td>
                  <td className="max-w-[220px]">
                    <p className="text-xs text-slate-700 dark:text-slate-300 leading-snug truncate">{n.title}</p>
                  </td>
                  <td className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">{n.ministry}</td>
                  <td><OutcomeText outcome={n.outcome} decisionOutcomes={DECISION_OUTCOMES} /></td>
                  <td>
                    {(() => {
                      const ch = CHANNEL_OPTIONS.find(c => c.value === n.channel)
                      if (!ch) return null
                      const Icon = ch.icon
                      return (
                        <span className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                          <Icon size={13} />
                          {ch.label}
                        </span>
                      )
                    })()}
                  </td>
                  <td><StatusBadge status={n.status} statusMeta={STATUS_META} /></td>
                  <td className="text-xs text-slate-400 whitespace-nowrap">
                    {n.issued_date
                      ? new Date(n.issued_date + 'T00:00').toLocaleDateString('en-VU', { day: '2-digit', month: 'short', year: 'numeric' })
                      : '—'
                    }
                  </td>
                  <td>
                    <div className="flex items-center justify-end gap-0.5">
                      <button
                        onClick={() => setViewTarget(n)}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"
                        title="View"
                      >
                        <Eye size={13} />
                      </button>
                      {(n.status === 'draft' || n.status === 'pending') && (
                        <button
                          onClick={() => handleMarkIssued(n.id)}
                          title="Mark as Issued"
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-sky-600 hover:bg-sky-50 dark:hover:bg-sky-900/20 transition-colors"
                        >
                          <Send size={13} />
                        </button>
                      )}
                      {n.status === 'issued' && (
                        <button
                          onClick={() => handleMarkAcknowledged(n.id)}
                          title="Mark as Acknowledged"
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors"
                        >
                          <CheckCircle2 size={13} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {!filtered.length && (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-slate-400">
                    No notifications match your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Notification modal */}
      <Modal
        open={issueModalOpen}
        title="Prepare Notification"
        subtitle="Create a notification record for a commission decision."
        onClose={() => setIssueModalOpen(false)}
        size="md"
      >
          <form onSubmit={handleIssue} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Decision reference</label>
                <input className="input font-mono" required placeholder="DEC-YYYY-###" value={form.decision_ref} onChange={set('decision_ref')} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Submission reference</label>
                <input className="input font-mono" required placeholder="PSC-YYYY-#####" value={form.submission_ref} onChange={set('submission_ref')} />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Subject / title</label>
              <input className="input" required value={form.title} onChange={set('title')} placeholder="Brief description of the matter" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Ministry</label>
                <input className="input" required value={form.ministry} onChange={set('ministry')} placeholder="Ministry name" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Decision outcome</label>
                <select className="input" value={form.outcome} onChange={set('outcome')}>
                  {Object.entries(DECISION_OUTCOMES).map(([v, m]) => <option key={v} value={v}>{m.label}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Recipient name / title</label>
              <input className="input" required value={form.recipient} onChange={set('recipient')} placeholder='e.g. "Secretary-General, Ministry of Finance"' />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Notification channel</label>
              <div className="flex gap-3 flex-wrap">
                {CHANNEL_OPTIONS.map(({ value, label, icon: Icon }) => (
                  <label key={value} className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border cursor-pointer transition-colors text-sm ${form.channel === value ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 font-medium' : 'border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-500'}`}>
                    <input type="radio" name="channel" value={value} checked={form.channel === value} onChange={set('channel')} className="sr-only" />
                    <Icon size={15} />
                    {label}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Notes (optional)</label>
              <textarea className="input min-h-[70px]" value={form.notes} onChange={set('notes')} placeholder="Internal notes for this notification…" />
            </div>
            <div className="flex items-center gap-3 pt-2">
              <button type="submit" className="btn-primary px-6 py-2.5">Save as Draft</button>
              <button type="button" className="btn-secondary px-6 py-2.5" onClick={() => setIssueModalOpen(false)}>Cancel</button>
            </div>
          </form>
      </Modal>

      <Modal
        open={!!viewTarget}
        title={viewTarget?.reference}
        subtitle={viewTarget ? `Decision: ${viewTarget.decision_ref}` : undefined}
        onClose={() => setViewTarget(null)}
        size="md"
      >
        {viewTarget && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Submission</p>
                <p className="font-mono text-sm text-primary-600 dark:text-primary-400">{viewTarget.submission_ref}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Status</p>
                <StatusBadge status={viewTarget.status} statusMeta={STATUS_META} />
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Subject</p>
              <p className="text-sm text-slate-800 dark:text-slate-200 leading-snug">{viewTarget.title}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Ministry</p>
                <p className="text-sm text-slate-700 dark:text-slate-300">{viewTarget.ministry}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Outcome</p>
                <OutcomeText outcome={viewTarget.outcome} decisionOutcomes={DECISION_OUTCOMES} />
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Recipient</p>
              <p className="text-sm text-slate-700 dark:text-slate-300">{viewTarget.recipient}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Date Issued</p>
                <p className="text-sm text-slate-700 dark:text-slate-300">
                  {viewTarget.issued_date
                    ? new Date(viewTarget.issued_date + 'T00:00').toLocaleDateString('en-VU', { day: '2-digit', month: 'long', year: 'numeric' })
                    : '— Not yet issued'}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Acknowledged</p>
                <p className="text-sm text-slate-700 dark:text-slate-300">
                  {viewTarget.ack_date
                    ? new Date(viewTarget.ack_date + 'T00:00').toLocaleDateString('en-VU', { day: '2-digit', month: 'long', year: 'numeric' })
                    : '— Pending'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 pt-2">
              {(viewTarget.status === 'draft' || viewTarget.status === 'pending') && (
                <button
                  onClick={() => { handleMarkIssued(viewTarget.id); setViewTarget(null) }}
                  className="btn-primary flex items-center gap-2 px-5 py-2.5 text-sm"
                >
                  <Send size={15} /> Mark as Issued
                </button>
              )}
              {viewTarget.status === 'issued' && (
                <button
                  onClick={() => { handleMarkAcknowledged(viewTarget.id); setViewTarget(null) }}
                  className="btn-primary flex items-center gap-2 px-5 py-2.5 text-sm"
                >
                  <CheckCircle2 size={15} /> Mark as Acknowledged
                </button>
              )}
              <button className="btn-secondary flex items-center gap-2 px-5 py-2.5 text-sm" onClick={() => setViewTarget(null)}>
                <Printer size={15} /> Print Letter
              </button>
              <button className="btn-secondary px-5 py-2.5 text-sm" onClick={() => setViewTarget(null)}>Close</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
