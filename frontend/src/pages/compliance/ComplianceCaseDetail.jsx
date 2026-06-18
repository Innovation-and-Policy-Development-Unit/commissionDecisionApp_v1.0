import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, ShieldCheck, Send, Check, RotateCcw, Scale, StickyNote, Plus,
  AlertCircle, Clock, CheckCircle2, CircleDot, RefreshCw, Gavel, UserCheck, Pencil,
} from 'lucide-react'
import api from '../../api/client'
import PageHeader from '../../components/shared/PageHeader'
import { useAuth } from '../../context/AuthContext'
import { WORKFLOW_ROUTES, canRecordDecision, canManageSeniorCases, isReadOnlyComplianceRole } from '../../constants/compliance'
import InvestigationSection from '../../components/compliance/InvestigationSection'
import SuspensionSection from '../../components/compliance/SuspensionSection'

// Roles that can take any write action on a case (create notes, stages, litigation)
const WRITE_ROLES = ['compliance_manager', 'compliance_senior', 'compliance_principal', 'psc_admin']
// Roles that can approve/return
const MANAGER_ROLES = ['compliance_manager', 'psc_admin']

const OUTCOME_OPTIONS = [
  { value: 'reinstate',         label: 'Reinstated' },
  { value: 'terminate',         label: 'Terminated / Dismissed' },
  { value: 'warn',              label: 'Formal Warning Issued' },
  { value: 'demote',            label: 'Demotion' },
  { value: 'suspend_no_pay',    label: 'Suspension Without Pay' },
  { value: 'compulsory_retire', label: 'Compulsory Retirement' },
  { value: 'no_action',         label: 'No Further Action' },
  { value: 'referred_psdb',     label: 'Referred to PSDB' },
  { value: 'settled',           label: 'Settled (Grievance)' },
  { value: 'not_settled',       label: 'Not Settled (Grievance)' },
]

const BODY_OPTIONS = [
  { value: 'commission', label: 'PSC Commission' },
  { value: 'psdb',       label: 'PSDB' },
  { value: 'hod',        label: 'Head of Department' },
  { value: 'minister',   label: 'Minister' },
  { value: 'secretary',  label: 'Secretary OPSC' },
]

const TERMINAL_OUTCOMES = new Set([
  'reinstate','terminate','warn','demote','suspend_no_pay',
  'compulsory_retire','no_action','settled','not_settled',
])

function WorkflowPipeline({ caseFamily, stages = [] }) {
  const route = WORKFLOW_ROUTES[caseFamily]
  if (!route || !route.milestones.length || !stages.length) return null

  // Map milestone codes → stage status from live data
  const stageByCode = {}
  stages.forEach(s => { stageByCode[s.stage_code] = s })

  return (
    <div className="mb-6 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/40 px-5 py-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500 mb-3">
        {route.milestones.length} stage workflow — {caseFamily.replace(/_/g, ' ')}
      </p>
      <div className="flex flex-wrap items-center gap-0">
        {route.milestones.map((m, i) => {
          const stage = stageByCode[m.code]
          const status = stage?.status ?? 'pending'
          const slaStatus = stage?.sla_status ?? 'on_track'
          const isCompleted = status === 'completed'
          const isActive    = status === 'in_progress'
          const isOverdue   = slaStatus === 'overdue' && !isCompleted
          const isAtRisk    = slaStatus === 'at_risk'  && !isCompleted

          let dotCls = 'bg-slate-200 dark:bg-slate-600 text-slate-500'
          if (isCompleted) dotCls = 'bg-emerald-500 text-white'
          else if (isActive && isOverdue) dotCls = 'bg-red-500 text-white ring-2 ring-red-300 dark:ring-red-700'
          else if (isActive && isAtRisk)  dotCls = 'bg-amber-500 text-white ring-2 ring-amber-300'
          else if (isActive)              dotCls = 'bg-primary-600 text-white ring-2 ring-primary-300 dark:ring-primary-700'
          else if (isOverdue)             dotCls = 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400'

          let labelCls = 'text-slate-400 dark:text-slate-500'
          if (isCompleted) labelCls = 'text-emerald-600 dark:text-emerald-400'
          else if (isActive) labelCls = 'text-primary-700 dark:text-primary-400 font-semibold'
          else if (isOverdue) labelCls = 'text-red-600 dark:text-red-400'

          return (
            <div key={m.code} className="flex items-center">
              <div className="flex flex-col items-center gap-1">
                <div className={`h-7 w-7 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ${dotCls}`}>
                  {isCompleted ? '✓' : i + 1}
                </div>
                <span className={`text-[10px] text-center leading-tight max-w-[70px] ${labelCls}`}>
                  {m.label}{m.optional ? ' *' : ''}
                </span>
              </div>
              {i < route.milestones.length - 1 && (
                <div className={`h-0.5 w-6 shrink-0 mb-4 mx-1 ${isCompleted ? 'bg-emerald-400' : 'bg-slate-200 dark:bg-slate-700'}`} />
              )}
            </div>
          )
        })}
      </div>
      <div className="mt-2 flex items-center gap-4 text-[10px] text-slate-400">
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-full bg-emerald-500" /> Completed</span>
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-full bg-primary-600" /> In progress</span>
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-full bg-red-500" /> Overdue</span>
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-full bg-slate-200 dark:bg-slate-600" /> Pending</span>
        {route.milestones.some(m => m.optional) && <span>* optional stage</span>}
      </div>
    </div>
  )
}

const SLA_BADGE = {
  overdue:   { cls: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300', Icon: AlertCircle },
  at_risk:   { cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300', Icon: Clock },
  on_track:  { cls: 'bg-slate-100 text-slate-600 dark:bg-slate-700/40 dark:text-slate-300', Icon: CircleDot },
  completed: { cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300', Icon: CheckCircle2 },
}

function StageRow({ stage, onUpdate, busy, canWrite }) {
  const badge   = SLA_BADGE[stage.sla_status] || SLA_BADGE.on_track
  const Icon    = badge.Icon
  const done    = stage.status === 'completed'
  const active  = stage.status === 'in_progress'
  const skipped = stage.status === 'skipped'

  let dotCls = 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
  if (done)   dotCls = 'bg-emerald-600 text-white'
  if (active) dotCls = 'bg-primary-600 text-white ring-2 ring-primary-200 dark:ring-primary-800'

  return (
    <li className={`flex items-start gap-3 py-3 -mx-2 px-2 rounded-lg transition-colors ${active ? 'bg-primary-50 dark:bg-primary-950/20' : ''}`}>
      <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${dotCls}`}>
        {done ? <CheckCircle2 size={14} /> : stage.stage_order}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`font-medium ${done || skipped ? 'text-slate-400 line-through' : active ? 'text-primary-700 dark:text-primary-300' : 'text-slate-800 dark:text-slate-100'}`}>
            {stage.stage_name}
          </span>
          {active  && <span className="rounded-full bg-primary-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary-700 dark:bg-primary-900/40 dark:text-primary-400">Active</span>}
          {stage.is_optional && <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] uppercase text-slate-500 dark:bg-slate-700">optional</span>}
          {!done && !skipped && (
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${badge.cls}`}>
              <Icon size={11} /> {stage.sla_status_display}
            </span>
          )}
        </div>
        <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
          {stage.statutory_ref && <span className="font-mono">{stage.statutory_ref}</span>}
          {stage.responsible_role && <span> · {stage.responsible_role.replace(/_/g, ' ')}</span>}
          {stage.due_date && <span> · due {stage.due_date}</span>}
          {stage.sla_days != null && <span> · {stage.sla_days} {stage.sla_working_days ? 'working' : 'calendar'} days</span>}
        </div>
        {stage.notes && active && (
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 italic">{stage.notes}</p>
        )}
      </div>
      {!done && !skipped && canWrite && (
        <div className="flex shrink-0 gap-1">
          {stage.status !== 'in_progress' && (
            <button disabled={busy} onClick={() => onUpdate(stage, 'in_progress')}
              className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700 disabled:opacity-50">Start</button>
          )}
          <button disabled={busy} onClick={() => onUpdate(stage, 'completed')}
            className="rounded-md bg-emerald-600 px-2 py-1 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50">Complete</button>
        </div>
      )}
    </li>
  )
}

export default function ComplianceCaseDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const role = user?.role
  const isManager = user && MANAGER_ROLES.includes(role)
  const canWrite  = user && WRITE_ROLES.includes(role)
  const canDecide = user && (canRecordDecision(role) || user.is_superuser || user.is_staff)
  const canMediate = user && (canManageSeniorCases(role) || user.is_superuser || user.is_staff)
  const isReadOnly = user && isReadOnlyComplianceRole(role)

  const [c, setC] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [noteText, setNoteText] = useState('')
  const [showLit, setShowLit] = useState(false)
  const [lit, setLit] = useState({ description: '', court_name: '', court_reference: '', legal_counsel: '', opposing_counsel: '', next_court_date: '', estimated_cost: '', actual_cost: '', notes: '' })
  const [showDecision, setShowDecision] = useState(false)
  const [dec, setDec] = useState({ outcome: 'reinstate', decision_body: 'commission', decision_date: '', narrative: '', stage_reference: '' })
  const [showMediator, setShowMediator] = useState(false)
  const [med, setMed] = useState({ mediator_name: '', mediator_organisation: '', mediator_contact: '', appointment_date: '', mediation_start_date: '', mediation_end_date: '', outcome: 'pending', mom_reference: '', outcome_notes: '' })

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const res = await api.get(`/compliance/cases/${id}/`)
      setC(res.data)
    } catch (e) {
      setError(e.response?.data?.detail || 'Could not load this case.')
    } finally { setLoading(false) }
  }, [id])

  useEffect(() => { load() }, [load])

  // Pre-fill mediator form when editing an existing appointment
  useEffect(() => {
    if (c?.mediator_appointment && showMediator) {
      const m = c.mediator_appointment
      setMed({
        mediator_name: m.mediator_name || '',
        mediator_organisation: m.mediator_organisation || '',
        mediator_contact: m.mediator_contact || '',
        appointment_date: m.appointment_date || '',
        mediation_start_date: m.mediation_start_date || '',
        mediation_end_date: m.mediation_end_date || '',
        outcome: m.outcome || 'pending',
        mom_reference: m.mom_reference || '',
        outcome_notes: m.outcome_notes || '',
      })
    }
  }, [showMediator, c?.mediator_appointment])

  const post = async (path, body) => {
    setBusy(true)
    try { await api.post(path, body); await load() }
    catch (e) { alert(e.response?.data?.detail || JSON.stringify(e.response?.data || {}) || 'Action failed.') }
    finally { setBusy(false) }
  }

  const act = (verb) => post(`/compliance/cases/${id}/${verb}/`, {})
  const updateStage = (stage, status) => post(`/compliance/cases/${id}/stage/`, { stage_id: stage.id, status })
  const addNote = async () => { if (!noteText.trim()) return; await post(`/compliance/cases/${id}/notes/`, { text: noteText }); setNoteText('') }
  const addLit = async () => {
    if (!lit.description.trim()) { alert('Description is required.'); return }
    const body = { ...lit, estimated_cost: lit.estimated_cost || null, actual_cost: lit.actual_cost || null, next_court_date: lit.next_court_date || null }
    await post(`/compliance/cases/${id}/litigation/`, body)
    setLit({ description: '', court_name: '', court_reference: '', legal_counsel: '', opposing_counsel: '', next_court_date: '', estimated_cost: '', actual_cost: '', notes: '' })
    setShowLit(false)
  }

  const addDecision = async () => {
    if (!dec.decision_date) { alert('Decision date is required.'); return }
    await post(`/compliance/cases/${id}/decisions/`, dec)
    setDec({ outcome: 'reinstate', decision_body: 'commission', decision_date: '', narrative: '', stage_reference: '' })
    setShowDecision(false)
  }

  const saveMediator = async () => {
    if (!med.mediator_name.trim() || !med.appointment_date) { alert('Mediator name and appointment date are required.'); return }
    const method = c?.mediator_appointment ? 'put' : 'post'
    setBusy(true)
    try {
      await api[method](`/compliance/cases/${id}/mediator/`, med)
      await load()
      setShowMediator(false)
    } catch (e) {
      alert(e.response?.data?.detail || JSON.stringify(e.response?.data || {}) || 'Could not save mediator.')
    } finally { setBusy(false) }
  }

  if (loading) return <div className="py-16 text-center text-slate-400">Loading…</div>
  if (error) return <div className="p-4"><button className="btn-outline mb-4" onClick={() => navigate('/compliance/cases')}><ArrowLeft size={15} /> Back</button><div className="rounded-lg bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-300">{error}</div></div>
  if (!c) return null

  const stage = c.current_stage

  return (
    <div>
      <button className="mb-3 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-200" onClick={() => navigate('/compliance/cases')}>
        <ArrowLeft size={15} /> Compliance Cases
      </button>

      <PageHeader
        title={c.subject_name}
        subtitle={`${c.case_family_display} · ${c.reference_number}`}
        action={
          <div className="flex items-center gap-2">
            {stage === 'draft' && (
              <button disabled={busy} onClick={() => act('submit')} className="btn-primary flex items-center gap-2 text-sm"><Send size={15} /> Submit</button>
            )}
            {stage === 'pending_manager_approval' && isManager && (
              <>
                <button disabled={busy} onClick={() => act('approve')} className="btn-primary flex items-center gap-2 text-sm bg-emerald-600 hover:bg-emerald-700"><Check size={15} /> Approve</button>
                <button disabled={busy} onClick={() => { const r = prompt('Reason for returning:'); if (r !== null) post(`/compliance/cases/${id}/return/`, { reason: r }) }} className="btn-outline flex items-center gap-2 text-sm"><RotateCcw size={15} /> Return</button>
              </>
            )}
            <button className="btn-outline flex items-center gap-2 text-sm" onClick={load} disabled={busy}><RefreshCw size={15} className={busy ? 'animate-spin' : ''} /></button>
          </div>
        }
      />

      <WorkflowPipeline caseFamily={c.case_family} stages={c.stages || []} />

      {c.repeat_offence?.is_repeat && (
        <div className="mt-4 flex items-start gap-2 rounded-xl border border-red-300 bg-red-50 dark:border-red-900/40 dark:bg-red-900/20 px-4 py-3 text-sm text-red-800 dark:text-red-200">
          <AlertCircle size={15} className="mt-0.5 shrink-0" />
          <span>
            <strong>Repeat offence:</strong> {c.repeat_offence.prior_count} prior case(s) for this subject and the same
            offence within the last {c.repeat_offence.window_years} years. A repeat of the same nature of offence may
            escalate to serious misconduct.
          </span>
        </div>
      )}

      {/* Summary chips */}
      {isReadOnly && (
        <div className="mb-4 rounded-lg border border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/20 px-4 py-2.5 text-sm text-amber-800 dark:text-amber-300 flex items-center gap-2">
          <AlertCircle size={15} className="shrink-0" />
          <span>You have <strong>read-only</strong> access to this case. Write actions are restricted to Compliance Unit staff.</span>
        </div>
      )}

      <div className="mb-6 flex flex-wrap gap-2 text-xs">
        <span className="rounded-full bg-slate-100 px-3 py-1 dark:bg-slate-800">Stage: <b>{stage.replace(/_/g, ' ')}</b></span>
        <span className="rounded-full bg-slate-100 px-3 py-1 dark:bg-slate-800">Status: <b>{c.status_display}</b></span>
        {c.subject_position && <span className="rounded-full bg-slate-100 px-3 py-1 dark:bg-slate-800">{c.subject_position}</span>}
        {c.subject_ministry && <span className="rounded-full bg-slate-100 px-3 py-1 dark:bg-slate-800">{c.subject_ministry}</span>}
        {c.is_senior_executive && <span className="rounded-full bg-purple-100 px-3 py-1 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 font-semibold">Senior Executive</span>}
        <span className="rounded-full bg-slate-100 px-3 py-1 dark:bg-slate-800">Received: {c.date_received}</span>
      </div>

      {/* FR-11: Grievance mediator panel */}
      {c.case_family === 'grievance' && (
        <section className="mb-6 rounded-xl border border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-950/20 p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="flex items-center gap-2 font-semibold text-violet-800 dark:text-violet-300">
              <UserCheck size={17} /> Mediator Appointment
            </h3>
            {canMediate && (
              <button
                className="inline-flex items-center gap-1.5 text-xs text-violet-700 dark:text-violet-400 hover:underline"
                onClick={() => setShowMediator((v) => !v)}
              >
                <Pencil size={12} /> {c.mediator_appointment ? 'Edit' : 'Appoint mediator'}
              </button>
            )}
          </div>

          {showMediator && (
            <div className="mb-4 space-y-2 rounded-lg bg-white dark:bg-slate-800 border border-violet-200 dark:border-violet-700 p-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium mb-1">Mediator name *</label>
                  <input className="form-input w-full text-sm" value={med.mediator_name} onChange={(e) => setMed({ ...med, mediator_name: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Organisation</label>
                  <input className="form-input w-full text-sm" value={med.mediator_organisation} onChange={(e) => setMed({ ...med, mediator_organisation: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Contact</label>
                  <input className="form-input w-full text-sm" value={med.mediator_contact} onChange={(e) => setMed({ ...med, mediator_contact: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Appointment date *</label>
                  <input type="date" className="form-input w-full text-sm" value={med.appointment_date} onChange={(e) => setMed({ ...med, appointment_date: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Mediation start</label>
                  <input type="date" className="form-input w-full text-sm" value={med.mediation_start_date} onChange={(e) => setMed({ ...med, mediation_start_date: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Mediation end</label>
                  <input type="date" className="form-input w-full text-sm" value={med.mediation_end_date} onChange={(e) => setMed({ ...med, mediation_end_date: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Outcome</label>
                  <select className="form-input w-full text-sm" value={med.outcome} onChange={(e) => setMed({ ...med, outcome: e.target.value })}>
                    <option value="pending">Pending</option>
                    <option value="settled">Settled</option>
                    <option value="not_settled">Not Settled</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Form 6.8 MoM reference</label>
                  <input className="form-input w-full text-sm" placeholder="e.g. MOM-2026-001" value={med.mom_reference} onChange={(e) => setMed({ ...med, mom_reference: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Outcome notes</label>
                <textarea className="form-input w-full text-sm" rows={2} value={med.outcome_notes} onChange={(e) => setMed({ ...med, outcome_notes: e.target.value })} />
              </div>
              <div className="flex gap-2">
                <button disabled={busy} className="btn-primary text-sm" onClick={saveMediator}>Save</button>
                <button className="btn-outline text-sm" onClick={() => setShowMediator(false)}>Cancel</button>
              </div>
            </div>
          )}

          {c.mediator_appointment ? (
            <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2 text-sm">
              <div>
                <dt className="text-xs text-slate-400 uppercase tracking-wide">Mediator</dt>
                <dd className="font-medium text-slate-800 dark:text-slate-100">{c.mediator_appointment.mediator_name}</dd>
              </div>
              {c.mediator_appointment.mediator_organisation && (
                <div>
                  <dt className="text-xs text-slate-400 uppercase tracking-wide">Organisation</dt>
                  <dd className="text-slate-700 dark:text-slate-200">{c.mediator_appointment.mediator_organisation}</dd>
                </div>
              )}
              <div>
                <dt className="text-xs text-slate-400 uppercase tracking-wide">Appointed</dt>
                <dd className="text-slate-700 dark:text-slate-200">{c.mediator_appointment.appointment_date}</dd>
              </div>
              {c.mediator_appointment.mediation_start_date && (
                <div>
                  <dt className="text-xs text-slate-400 uppercase tracking-wide">Mediation window</dt>
                  <dd className="text-slate-700 dark:text-slate-200">
                    {c.mediator_appointment.mediation_start_date} → {c.mediator_appointment.mediation_end_date || 'ongoing'}
                  </dd>
                </div>
              )}
              <div>
                <dt className="text-xs text-slate-400 uppercase tracking-wide">Outcome</dt>
                <dd>
                  <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${
                    c.mediator_appointment.outcome === 'settled'     ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' :
                    c.mediator_appointment.outcome === 'not_settled' ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' :
                    'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                  }`}>{c.mediator_appointment.outcome_display}</span>
                </dd>
              </div>
              {c.mediator_appointment.mom_reference && (
                <div>
                  <dt className="text-xs text-slate-400 uppercase tracking-wide">MoM ref (Form 6.8)</dt>
                  <dd className="font-mono text-xs text-slate-700 dark:text-slate-200">{c.mediator_appointment.mom_reference}</dd>
                </div>
              )}
              {c.mediator_appointment.outcome_notes && (
                <div className="col-span-full">
                  <dt className="text-xs text-slate-400 uppercase tracking-wide">Notes</dt>
                  <dd className="text-slate-600 dark:text-slate-300 text-sm italic">{c.mediator_appointment.outcome_notes}</dd>
                </div>
              )}
            </dl>
          ) : (
            <p className="text-sm text-violet-600 dark:text-violet-400">No mediator appointed yet. A mediator must be appointed within 5 calendar days of the grievance being lodged (PSC Reg. 49(1)).</p>
          )}
        </section>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Statutory timeline */}
        <section className="lg:col-span-2 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
          <h3 className="mb-2 flex items-center gap-2 font-semibold text-slate-700 dark:text-slate-200"><ShieldCheck size={17} /> Statutory timeline</h3>
          {c.stages?.length ? (
            <ul className="divide-y divide-slate-100 dark:divide-slate-700/60">
              {c.stages.map((s) => <StageRow key={s.id} stage={s} onUpdate={updateStage} busy={busy} canWrite={canWrite} />)}
            </ul>
          ) : <p className="text-sm text-slate-400 py-4">No statutory stages.</p>}
        </section>

        <div className="space-y-6">
          {/* Litigation */}
          <section className="rounded-xl border border-slate-200 dark:border-slate-700 p-5">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="flex items-center gap-2 font-semibold text-slate-700 dark:text-slate-200"><Scale size={17} /> Litigation & costs</h3>
              {canWrite && <button className="text-slate-400 hover:text-slate-600" onClick={() => setShowLit((v) => !v)}><Plus size={16} /></button>}
            </div>
            {showLit && (
              <div className="mb-3 space-y-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 p-3">
                <textarea className="form-input w-full text-sm" rows={2} placeholder="Description *" value={lit.description} onChange={(e) => setLit({ ...lit, description: e.target.value })} />
                <input className="form-input w-full text-sm" placeholder="Court / tribunal name" value={lit.court_name} onChange={(e) => setLit({ ...lit, court_name: e.target.value })} />
                <input className="form-input w-full text-sm" placeholder="Court reference / case number" value={lit.court_reference} onChange={(e) => setLit({ ...lit, court_reference: e.target.value })} />
                <input className="form-input w-full text-sm" placeholder="PSC legal counsel" value={lit.legal_counsel} onChange={(e) => setLit({ ...lit, legal_counsel: e.target.value })} />
                <input className="form-input w-full text-sm" placeholder="Opposing counsel" value={lit.opposing_counsel} onChange={(e) => setLit({ ...lit, opposing_counsel: e.target.value })} />
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="block text-[10px] text-slate-500 mb-0.5">Next court date</label>
                    <input className="form-input w-full text-sm" type="date" value={lit.next_court_date} onChange={(e) => setLit({ ...lit, next_court_date: e.target.value })} />
                  </div>
                </div>
                <div className="flex gap-2">
                  <input className="form-input w-full text-sm" type="number" placeholder="Est. cost (VT)" value={lit.estimated_cost} onChange={(e) => setLit({ ...lit, estimated_cost: e.target.value })} />
                  <input className="form-input w-full text-sm" type="number" placeholder="Actual cost (VT)" value={lit.actual_cost} onChange={(e) => setLit({ ...lit, actual_cost: e.target.value })} />
                </div>
                <textarea className="form-input w-full text-sm" rows={2} placeholder="Notes" value={lit.notes} onChange={(e) => setLit({ ...lit, notes: e.target.value })} />
                <button disabled={busy} className="btn-primary text-sm w-full" onClick={addLit}>Add record</button>
              </div>
            )}
            {c.litigation_records?.length ? (
              <ul className="space-y-2">
                {c.litigation_records.map((l) => (
                  <li key={l.id} className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm">
                    <div className="flex items-start justify-between gap-1">
                      <span className="font-medium text-slate-800 dark:text-slate-100">{l.description}</span>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        l.status === 'active' ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' :
                        l.status === 'settled' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' :
                        'bg-slate-100 text-slate-600 dark:bg-slate-700/40 dark:text-slate-300'
                      }`}>{l.status_display}</span>
                    </div>
                    {l.court_name && <div className="text-xs text-slate-500 mt-0.5">{l.court_name}{l.court_reference ? ` · ${l.court_reference}` : ''}</div>}
                    {l.next_court_date && <div className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">Next hearing: {l.next_court_date}</div>}
                    {(l.estimated_cost || l.actual_cost) && (
                      <div className="text-xs text-slate-500 mt-0.5">Est VT {l.estimated_cost || '—'} · Actual VT {l.actual_cost || '—'}</div>
                    )}
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-slate-400">No litigation records.</p>}
          </section>

          {/* Investigation (panel, findings, recommendation) */}
          <InvestigationSection caseId={id} investigation={c.investigation} canWrite={canWrite} busy={busy} post={post} />

          {/* Suspension & salary (financial implication) */}
          <SuspensionSection caseId={id} suspensions={c.suspensions || []} canWrite={canWrite} busy={busy} post={post} />

          {/* Decisions */}
          <section className="rounded-xl border border-slate-200 dark:border-slate-700 p-5">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="flex items-center gap-2 font-semibold text-slate-700 dark:text-slate-200"><Gavel size={17} /> Decisions</h3>
              {canDecide && c.status !== 'closed' && (
                <button className="text-slate-400 hover:text-slate-600" onClick={() => setShowDecision((v) => !v)}><Plus size={16} /></button>
              )}
            </div>
            {showDecision && (
              <div className="mb-3 space-y-2 rounded-lg bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 p-3">
                <div>
                  <label className="block text-xs font-medium mb-1 text-slate-600 dark:text-slate-300">Decision body</label>
                  <select className="form-input w-full text-sm" value={dec.decision_body} onChange={(e) => setDec({ ...dec, decision_body: e.target.value })}>
                    {BODY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1 text-slate-600 dark:text-slate-300">Outcome *</label>
                  <select className="form-input w-full text-sm" value={dec.outcome} onChange={(e) => setDec({ ...dec, outcome: e.target.value })}>
                    {OUTCOME_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1 text-slate-600 dark:text-slate-300">Decision date *</label>
                  <input className="form-input w-full text-sm" type="date" value={dec.decision_date} onChange={(e) => setDec({ ...dec, decision_date: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1 text-slate-600 dark:text-slate-300">Stage reference (optional)</label>
                  <input className="form-input w-full text-sm" placeholder="e.g. psdb_order" value={dec.stage_reference} onChange={(e) => setDec({ ...dec, stage_reference: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1 text-slate-600 dark:text-slate-300">Narrative / reasons</label>
                  <textarea className="form-input w-full text-sm" rows={3} value={dec.narrative} onChange={(e) => setDec({ ...dec, narrative: e.target.value })} />
                </div>
                {TERMINAL_OUTCOMES.has(dec.outcome) && (
                  <p className="text-[11px] text-amber-700 dark:text-amber-400 font-medium">This outcome will automatically close the case.</p>
                )}
                <button disabled={busy} className="btn-primary text-sm w-full" onClick={addDecision}>Record decision</button>
              </div>
            )}
            {c.decisions?.length ? (
              <ul className="space-y-2">
                {c.decisions.map((d) => (
                  <li key={d.id} className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-slate-800 dark:text-slate-100">{d.outcome_display}</span>
                      <span className="text-[11px] text-slate-400">{d.decision_date}</span>
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{d.decision_body_display}{d.stage_reference ? ` · ${d.stage_reference}` : ''}</div>
                    {d.narrative && <p className="mt-1 text-xs text-slate-600 dark:text-slate-300 italic">{d.narrative}</p>}
                    <div className="text-[11px] text-slate-400 mt-0.5">Recorded by {d.decided_by_name || 'Unknown'}</div>
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-slate-400">No decisions recorded.</p>}
          </section>

          {/* Notes */}
          <section className="rounded-xl border border-slate-200 dark:border-slate-700 p-5">
            <h3 className="mb-2 flex items-center gap-2 font-semibold text-slate-700 dark:text-slate-200"><StickyNote size={17} /> Case notes</h3>
            {canWrite && (
              <div className="mb-3 flex gap-2">
                <input className="form-input flex-1 text-sm" placeholder="Add a note…" value={noteText} onChange={(e) => setNoteText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addNote()} />
                <button disabled={busy || !noteText.trim()} className="btn-primary text-sm" onClick={addNote}>Add</button>
              </div>
            )}
            {c.case_notes?.length ? (
              <ul className="space-y-2">
                {c.case_notes.map((n) => (
                  <li key={n.id} className="rounded-lg bg-slate-50 dark:bg-slate-800/50 px-3 py-2 text-sm">
                    <div className="text-slate-700 dark:text-slate-200">{n.text}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">{n.author_name || 'Unknown'} · {new Date(n.created_at).toLocaleString()}</div>
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-slate-400">No notes yet.</p>}
          </section>
        </div>
      </div>
    </div>
  )
}
