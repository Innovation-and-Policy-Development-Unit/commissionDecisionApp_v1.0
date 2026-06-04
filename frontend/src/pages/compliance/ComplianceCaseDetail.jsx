import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, ShieldCheck, Send, Check, RotateCcw, Scale, StickyNote, Plus,
  AlertCircle, Clock, CheckCircle2, CircleDot, RefreshCw,
} from 'lucide-react'
import api from '../../api/client'
import PageHeader from '../../components/shared/PageHeader'
import { useAuth } from '../../context/AuthContext'

const MANAGER_ROLES = ['compliance_manager', 'psc_admin']

const SLA_BADGE = {
  overdue:   { cls: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300', Icon: AlertCircle },
  at_risk:   { cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300', Icon: Clock },
  on_track:  { cls: 'bg-slate-100 text-slate-600 dark:bg-slate-700/40 dark:text-slate-300', Icon: CircleDot },
  completed: { cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300', Icon: CheckCircle2 },
}

function StageRow({ stage, onUpdate, busy }) {
  const badge = SLA_BADGE[stage.sla_status] || SLA_BADGE.on_track
  const Icon = badge.Icon
  const done = stage.status === 'completed'
  return (
    <li className="flex items-start gap-3 py-3">
      <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${done ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'}`}>
        {stage.stage_order}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`font-medium ${done ? 'text-slate-400 line-through' : 'text-slate-800 dark:text-slate-100'}`}>{stage.stage_name}</span>
          {stage.is_optional && <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] uppercase text-slate-500 dark:bg-slate-700">optional</span>}
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${badge.cls}`}>
            <Icon size={11} /> {stage.sla_status_display}
          </span>
        </div>
        <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
          {stage.statutory_ref && <span className="font-mono">{stage.statutory_ref}</span>}
          {stage.responsible_role && <span> · {stage.responsible_role.replace(/_/g, ' ')}</span>}
          {stage.due_date && <span> · due {stage.due_date}</span>}
          {stage.sla_days != null && <span> · {stage.sla_days} {stage.sla_working_days ? 'working' : 'calendar'} days</span>}
        </div>
      </div>
      {!done && (
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
  const isManager = user && MANAGER_ROLES.includes(user.role)

  const [c, setC] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [noteText, setNoteText] = useState('')
  const [showLit, setShowLit] = useState(false)
  const [lit, setLit] = useState({ description: '', legal_counsel: '', court_reference: '', estimated_cost: '', actual_cost: '' })

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
    const body = { ...lit, estimated_cost: lit.estimated_cost || null, actual_cost: lit.actual_cost || null }
    await post(`/compliance/cases/${id}/litigation/`, body)
    setLit({ description: '', legal_counsel: '', court_reference: '', estimated_cost: '', actual_cost: '' })
    setShowLit(false)
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

      {/* Summary chips */}
      <div className="mb-6 flex flex-wrap gap-2 text-xs">
        <span className="rounded-full bg-slate-100 px-3 py-1 dark:bg-slate-800">Stage: <b>{stage.replace(/_/g, ' ')}</b></span>
        <span className="rounded-full bg-slate-100 px-3 py-1 dark:bg-slate-800">Status: <b>{c.status_display}</b></span>
        {c.subject_position && <span className="rounded-full bg-slate-100 px-3 py-1 dark:bg-slate-800">{c.subject_position}</span>}
        {c.subject_ministry && <span className="rounded-full bg-slate-100 px-3 py-1 dark:bg-slate-800">{c.subject_ministry}</span>}
        {c.is_senior_executive && <span className="rounded-full bg-purple-100 px-3 py-1 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 font-semibold">Senior Executive</span>}
        <span className="rounded-full bg-slate-100 px-3 py-1 dark:bg-slate-800">Received: {c.date_received}</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Statutory timeline */}
        <section className="lg:col-span-2 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
          <h3 className="mb-2 flex items-center gap-2 font-semibold text-slate-700 dark:text-slate-200"><ShieldCheck size={17} /> Statutory timeline</h3>
          {c.stages?.length ? (
            <ul className="divide-y divide-slate-100 dark:divide-slate-700/60">
              {c.stages.map((s) => <StageRow key={s.id} stage={s} onUpdate={updateStage} busy={busy} />)}
            </ul>
          ) : <p className="text-sm text-slate-400 py-4">No statutory stages.</p>}
        </section>

        <div className="space-y-6">
          {/* Litigation */}
          <section className="rounded-xl border border-slate-200 dark:border-slate-700 p-5">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="flex items-center gap-2 font-semibold text-slate-700 dark:text-slate-200"><Scale size={17} /> Litigation & costs</h3>
              <button className="text-slate-400 hover:text-slate-600" onClick={() => setShowLit((v) => !v)}><Plus size={16} /></button>
            </div>
            {showLit && (
              <div className="mb-3 space-y-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 p-3">
                <textarea className="form-input w-full text-sm" rows={2} placeholder="Description *" value={lit.description} onChange={(e) => setLit({ ...lit, description: e.target.value })} />
                <input className="form-input w-full text-sm" placeholder="Legal counsel" value={lit.legal_counsel} onChange={(e) => setLit({ ...lit, legal_counsel: e.target.value })} />
                <input className="form-input w-full text-sm" placeholder="Court reference" value={lit.court_reference} onChange={(e) => setLit({ ...lit, court_reference: e.target.value })} />
                <div className="flex gap-2">
                  <input className="form-input w-full text-sm" type="number" placeholder="Est. cost (VT)" value={lit.estimated_cost} onChange={(e) => setLit({ ...lit, estimated_cost: e.target.value })} />
                  <input className="form-input w-full text-sm" type="number" placeholder="Actual cost (VT)" value={lit.actual_cost} onChange={(e) => setLit({ ...lit, actual_cost: e.target.value })} />
                </div>
                <button disabled={busy} className="btn-primary text-sm w-full" onClick={addLit}>Add record</button>
              </div>
            )}
            {c.litigation_records?.length ? (
              <ul className="space-y-2">
                {c.litigation_records.map((l) => (
                  <li key={l.id} className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm">
                    <div className="font-medium text-slate-800 dark:text-slate-100">{l.description}</div>
                    <div className="text-xs text-slate-400">{l.status_display}{l.court_reference ? ` · ${l.court_reference}` : ''}</div>
                    {(l.estimated_cost || l.actual_cost) && (
                      <div className="text-xs text-slate-500 mt-0.5">Est VT {l.estimated_cost || '—'} · Actual VT {l.actual_cost || '—'}</div>
                    )}
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-slate-400">No litigation records.</p>}
          </section>

          {/* Notes */}
          <section className="rounded-xl border border-slate-200 dark:border-slate-700 p-5">
            <h3 className="mb-2 flex items-center gap-2 font-semibold text-slate-700 dark:text-slate-200"><StickyNote size={17} /> Case notes</h3>
            <div className="mb-3 flex gap-2">
              <input className="form-input flex-1 text-sm" placeholder="Add a note…" value={noteText} onChange={(e) => setNoteText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addNote()} />
              <button disabled={busy || !noteText.trim()} className="btn-primary text-sm" onClick={addNote}>Add</button>
            </div>
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
