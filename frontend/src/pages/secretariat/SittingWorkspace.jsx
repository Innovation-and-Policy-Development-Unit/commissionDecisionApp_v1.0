/**
 * SittingWorkspace — "Meeting-as-Project" board for one Commission sitting.
 *
 * A Perfex-style Projects & Tasks board where the **sitting is the project** and
 * the **queued submissions are the tasks**:
 *   - Header (the project): date/countdown · capacity bar · readiness · agenda status.
 *   - Left  — BACKLOG: commission-ready submissions not yet on this agenda.
 *   - Right — AGENDA BOARD: AgendaItem cards grouped into agenda-section lanes.
 *
 * Drag a backlog card onto a section to schedule it; drag an agenda card onto a
 * different section to move it; use the arrows to reorder within a section.
 * All edit actions are secretariat-only; everyone else sees a read-only board.
 *
 * Backend: GET /meetings/:id/workspace/  ·  POST/DELETE /agenda-items/  ·
 *          POST /agenda-items/reorder/  (sequence + optional category)
 */
import { useEffect, useState, useMemo, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import PageHeader from '../../components/shared/PageHeader'
import AgendaReadinessChip from '../../components/shared/AgendaReadinessChip'
import api from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { useConfirm } from '../../context/ConfirmContext'
import {
  RefreshCw, X, ChevronUp, ChevronDown, Inbox, CalendarDays,
  Clock, AlertCircle, GripVertical, ListChecks, ArrowLeft, Building2,
} from 'lucide-react'

// The agenda builder owns this board (Stage-B: SAO builds → Secretary reviews → Chairman endorses).
// Other roles — including the Secretary, who reviews via the Agenda page — see it read-only.
const AGENDA_BUILDER_ROLES = ['senior_admin_officer', 'psc_admin']

function daysUntil(dateStr) {
  if (!dateStr) return null
  const target = new Date(dateStr + 'T00:00')
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.round((target - today) / 86400000)
}

function countdownLabel(days) {
  if (days === null) return ''
  if (days < 0) return `${Math.abs(days)} day${Math.abs(days) !== 1 ? 's' : ''} ago`
  if (days === 0) return 'Today'
  if (days === 1) return 'Tomorrow'
  return `in ${days} days`
}

function fmtDate(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr + 'T00:00').toLocaleDateString('en-GB', {
    weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
  })
}

function fmtDateTime(value) {
  if (!value) return ''
  return new Date(value).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

const STAGE_BADGE = {
  forwarded_to_commission: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
  commission_sitting: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  matters_arising: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
}

function StageBadge({ stage }) {
  if (!stage) return null
  const cls = STAGE_BADGE[stage] || 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
  return (
    <span className={`inline-block text-[10px] font-medium px-1.5 py-0.5 rounded ${cls}`}>
      {stage.replace(/_/g, ' ')}
    </span>
  )
}

export default function SittingWorkspace() {
  const { meetingId } = useParams()
  const { user } = useAuth()
  const toast = useToast()
  const confirm = useConfirm()

  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [drag, setDrag] = useState(null)        // { kind: 'backlog'|'agenda', ... }
  const [dropTarget, setDropTarget] = useState(null) // section code being hovered

  const role = user?.role || ''
  const canEdit = AGENDA_BUILDER_ROLES.includes(role)

  const fetchWorkspace = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true)
    try {
      const r = await api.get(`/meetings/${meetingId}/workspace/`)
      setData(r.data)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to load the sitting workspace.')
    } finally {
      setLoading(false)
    }
  }, [meetingId, toast])

  useEffect(() => { fetchWorkspace() }, [fetchWorkspace])

  const meeting = data?.meeting
  const sections = data?.sections || []
  const agenda = data?.agenda || []
  const backlog = data?.backlog || []
  const carryover = data?.carryover || []
  const readiness = data?.readiness || {}

  // The Chairman or Secretary may admit carry-over (late) items into the
  // agenda — only while it is with the Chairman for endorsement.
  const canAdmit = ['chairperson', 'psc_secretary', 'psc_admin'].includes(role) && meeting?.agenda_status === 'with_chairman'
  const canDrop = (d) => d && (canEdit || (canAdmit && d.kind === 'carryover'))

  // Group agenda items into section lanes, preserving admin section order.
  const lanes = useMemo(() => {
    const byCat = {}
    for (const it of agenda) {
      const code = it.category || ''
      ;(byCat[code] ||= []).push(it)
    }
    for (const code of Object.keys(byCat)) {
      byCat[code].sort((a, b) => a.sequence - b.sequence || a.id - b.id)
    }
    const ordered = sections.map(s => ({ code: s.code, label: s.label, items: byCat[s.code] || [] }))
    // Any items whose section is unknown/inactive still get a lane at the end.
    const known = new Set(sections.map(s => s.code))
    for (const code of Object.keys(byCat)) {
      if (!known.has(code)) {
        ordered.push({ code, label: code || 'Unsectioned', items: byCat[code] })
      }
    }
    return ordered
  }, [agenda, sections])

  const placed = readiness.placed ?? agenda.length
  const capacity = readiness.capacity ?? meeting?.max_items ?? 0
  const capacityPct = capacity > 0 ? Math.min(placed / capacity, 1) : 0
  const isOver = capacity > 0 && placed > capacity
  const isNear = !isOver && capacityPct >= 0.8
  const days = daysUntil(meeting?.date)

  // ── Edit operations ─────────────────────────────────────────────────────
  const scheduleSubmission = async (submissionId, category) => {
    setBusy(true)
    try {
      await api.post('/agenda-items/', { meeting: meetingId, submission: submissionId, category })
      await fetchWorkspace({ silent: true })
      toast.success('Added to agenda.')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Could not add to the agenda.')
    } finally { setBusy(false) }
  }

  const admitReserve = async (submissionId, category) => {
    setBusy(true)
    try {
      await api.post(`/meetings/${meetingId}/admit-reserve/`, { submission: submissionId, category })
      await fetchWorkspace({ silent: true })
      toast.success('Admitted from the carry-over list.')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Could not admit the item.')
    } finally { setBusy(false) }
  }

  const moveItemToSection = async (item, category) => {
    if (item.category === category) return
    setBusy(true)
    try {
      // Append to the end of the destination lane.
      const destCount = (lanes.find(l => l.code === category)?.items.length) || 0
      await api.post('/agenda-items/reorder/', {
        items: [{ id: item.id, category, sequence: destCount + 1 }],
      })
      await fetchWorkspace({ silent: true })
      toast.success('Item moved.')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Could not move the item.')
    } finally { setBusy(false) }
  }

  const reorderWithin = async (laneItems, idx, direction) => {
    const swapWith = direction === 'up' ? laneItems[idx - 1] : laneItems[idx + 1]
    const item = laneItems[idx]
    if (!swapWith) return
    setBusy(true)
    try {
      await api.post('/agenda-items/reorder/', {
        items: [
          { id: item.id, sequence: swapWith.sequence },
          { id: swapWith.id, sequence: item.sequence },
        ],
      })
      await fetchWorkspace({ silent: true })
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Could not reorder.')
    } finally { setBusy(false) }
  }

  const removeItem = async (item) => {
    const ok = await confirm({
      title: 'Remove from agenda?',
      message: `Remove "${item.title}" from this sitting? It returns to the backlog.`,
      confirmLabel: 'Remove',
    })
    if (!ok) return
    setBusy(true)
    try {
      await api.delete(`/agenda-items/${item.id}/`)
      await fetchWorkspace({ silent: true })
      toast.success('Removed from agenda.')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Could not remove the item.')
    } finally { setBusy(false) }
  }

  // ── Drag & drop ─────────────────────────────────────────────────────────
  const onDropToSection = (code) => {
    setDropTarget(null)
    if (!drag) { return }
    if (drag.kind === 'backlog' && canEdit) scheduleSubmission(drag.submissionId, code)
    else if (drag.kind === 'agenda' && canEdit) moveItemToSection(drag.item, code)
    else if (drag.kind === 'carryover' && canAdmit) admitReserve(drag.submissionId, code)
    setDrag(null)
  }

  // ── Render ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-400">
        <RefreshCw size={20} className="animate-spin mr-2" /> Loading sitting workspace…
      </div>
    )
  }

  if (!meeting) {
    return (
      <div className="card flex flex-col items-center justify-center py-16 text-slate-400">
        <AlertCircle size={32} className="mb-3 opacity-40" />
        <p className="text-sm">Meeting not found.</p>
        <Link to="/secretariat/meetings" className="btn-outline mt-4 px-4 py-2 text-sm">
          Back to sittings
        </Link>
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title={`Sitting Workspace — ${meeting.reference_number}`}
        subtitle={meeting.title}
        action={
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <Link to="/secretariat/agenda" className="btn-outline flex items-center gap-2 px-3 py-2 text-sm">
              <ListChecks size={15} /> Agenda Document
            </Link>
            <Link to="/secretariat/meetings" className="btn-outline flex items-center gap-2 px-3 py-2 text-sm">
              <ArrowLeft size={15} /> Sittings
            </Link>
            <button
              onClick={() => fetchWorkspace()}
              className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-primary-500 transition-colors"
              title="Refresh"
            >
              <RefreshCw size={15} className={busy ? 'animate-spin' : ''} />
            </button>
          </div>
        }
      />

      {/* ── Project header ──────────────────────────────────────────────── */}
      <div className="card p-4 mb-4">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
            <CalendarDays size={16} className="text-slate-400" />
            <span className="font-medium">{fmtDate(meeting.date)}</span>
            {days !== null && (
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                days < 0 ? 'bg-slate-100 text-slate-500 dark:bg-slate-800'
                  : days <= 3 ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                  : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
              }`}>
                {countdownLabel(days)}
              </span>
            )}
          </div>

          {meeting.effective_cutoff && (
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <Clock size={14} className="text-slate-400" />
              Intake closes {fmtDateTime(meeting.effective_cutoff)}
            </div>
          )}

          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            Agenda: {(meeting.agenda_status || 'draft').replace(/_/g, ' ')}
          </span>

          {/* Capacity bar */}
          <div className="flex items-center gap-2">
            <span className={`text-xs font-medium ${
              isOver ? 'text-red-600 dark:text-red-400'
                : isNear ? 'text-orange-600 dark:text-orange-400'
                : 'text-slate-500 dark:text-slate-400'
            }`}>
              {placed} / {capacity} items
            </span>
            <div className="w-24 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  isOver ? 'bg-red-500' : isNear ? 'bg-orange-400' : 'bg-emerald-500'
                }`}
                style={{ width: `${capacityPct * 100}%` }}
              />
            </div>
          </div>

          <AgendaReadinessChip
            readiness={{
              count: placed,
              min_items: readiness.min_items ?? meeting.min_items ?? 0,
              max_items: capacity,
              is_ready: readiness.is_ready,
              shortfall: readiness.shortfall ?? 0,
              level: readiness.level || 'empty',
            }}
            size="sm"
          />
        </div>

        {isOver && (
          <div className="mt-3 text-xs text-red-700 dark:text-red-300 flex items-center gap-2">
            <AlertCircle size={13} /> Over the {capacity}-item capacity — consider deferring lower-priority items.
          </div>
        )}
        {!canEdit && (
          <div className="mt-3 text-xs text-slate-400">Read-only — only the Secretariat can change the agenda.</div>
        )}
      </div>

      {/* ── Board ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4">
        {/* Left column: backlog + carry-over */}
        <div className="space-y-4 self-start">
        <div className="card p-3">
          <div className="flex items-center gap-2 mb-3 px-1">
            <Inbox size={15} className="text-slate-400" />
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Backlog</h2>
            <span className="ml-auto text-xs text-slate-400">{backlog.length}</span>
          </div>
          <p className="px-1 mb-2 text-[11px] text-slate-400">
            Forwarded to Commission, not yet on this agenda.
            {canEdit && ' Drag a card onto a section to schedule it.'}
          </p>
          <div className="space-y-2 max-h-[70vh] overflow-y-auto pr-1">
            {backlog.length === 0 && (
              <p className="text-xs text-slate-400 italic px-1 py-6 text-center">Backlog is empty.</p>
            )}
            {backlog.map(s => (
              <div
                key={s.submission_id}
                draggable={canEdit}
                onDragStart={() => setDrag({ kind: 'backlog', submissionId: s.submission_id })}
                onDragEnd={() => { setDrag(null); setDropTarget(null) }}
                className={`rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/60 p-2.5 ${
                  canEdit ? 'cursor-grab active:cursor-grabbing hover:border-primary-300' : ''
                } ${drag?.kind === 'backlog' && drag.submissionId === s.submission_id ? 'opacity-50' : ''}`}
              >
                <div className="flex items-start gap-1.5">
                  {canEdit && <GripVertical size={13} className="text-slate-300 mt-0.5 shrink-0" />}
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-slate-800 dark:text-slate-100 leading-snug line-clamp-2">{s.title}</p>
                    <p className="text-[10px] font-mono text-slate-400 mt-0.5">{s.ref}</p>
                    {s.ministry && (
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1">
                        <Building2 size={10} /> {s.ministry}
                      </p>
                    )}
                    {s.scheduled_here && (
                      <span className="inline-block mt-1 text-[9px] font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
                        ★ Scheduled here
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Carry-over list (late submissions) */}
        {(carryover.length > 0 || canAdmit) && (
          <div className="card p-3">
            <div className="flex items-center gap-2 mb-2 px-1">
              <Clock size={15} className="text-amber-500" />
              <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Carry-over list</h2>
              <span className="ml-auto text-xs text-slate-400">{carryover.length}</span>
            </div>
            <p className="px-1 mb-2 text-[11px] text-slate-400">
              Late (received after the cutoff) — these carry over to the next sitting.
              {canAdmit && ' Drag one onto a section to admit it before endorsing.'}
            </p>
            <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
              {carryover.length === 0 && (
                <p className="text-xs text-slate-400 italic px-1 py-4 text-center">No carry-over items.</p>
              )}
              {carryover.map(s => (
                <div
                  key={s.submission_id}
                  draggable={canAdmit}
                  onDragStart={() => setDrag({ kind: 'carryover', submissionId: s.submission_id })}
                  onDragEnd={() => { setDrag(null); setDropTarget(null) }}
                  className={`rounded-lg border border-amber-200 dark:border-amber-800/60 bg-amber-50/50 dark:bg-amber-900/10 p-2.5 ${
                    canAdmit ? 'cursor-grab active:cursor-grabbing hover:border-amber-400' : ''
                  } ${drag?.kind === 'carryover' && drag.submissionId === s.submission_id ? 'opacity-50' : ''}`}
                >
                  <div className="flex items-start gap-1.5">
                    {canAdmit && <GripVertical size={13} className="text-amber-300 mt-0.5 shrink-0" />}
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-slate-800 dark:text-slate-100 leading-snug line-clamp-2">{s.title}</p>
                      <p className="text-[10px] font-mono text-slate-400 mt-0.5">{s.ref}</p>
                      {s.ministry && (
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1"><Building2 size={10} /> {s.ministry}</p>
                      )}
                      <span className="inline-block mt-1 text-[9px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">late · carry-over</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {!canAdmit && carryover.length > 0 && (
              <p className="px-1 mt-2 text-[10px] text-slate-400 italic">Only the Chairman or Secretary can admit these, during endorsement.</p>
            )}
          </div>
        )}
        </div>

        {/* Agenda board */}
        <div className="space-y-3">
          {lanes.map(lane => {
            const active = dropTarget === lane.code
            return (
              <div
                key={lane.code || '_blank'}
                onDragOver={(e) => { if (canDrop(drag)) { e.preventDefault(); setDropTarget(lane.code) } }}
                onDragLeave={() => setDropTarget(t => (t === lane.code ? null : t))}
                onDrop={(e) => { e.preventDefault(); onDropToSection(lane.code) }}
                className={`rounded-xl border transition-colors ${
                  active
                    ? 'border-primary-400 bg-primary-50/60 dark:bg-primary-900/10'
                    : 'border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/30'
                }`}
              >
                <div className="flex items-center gap-2 px-4 py-2 border-b border-slate-200 dark:border-slate-700">
                  <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">{lane.label}</h3>
                  <span className="text-xs text-slate-400">{lane.items.length}</span>
                </div>
                <div className="p-2 space-y-2 min-h-[52px]">
                  {lane.items.length === 0 && (
                    <p className="text-[11px] text-slate-400 italic px-2 py-2">
                      {canEdit ? 'Drop submissions here.' : 'No items.'}
                    </p>
                  )}
                  {lane.items.map((item, idx) => (
                    <div
                      key={item.id}
                      draggable={canEdit}
                      onDragStart={() => setDrag({ kind: 'agenda', item })}
                      onDragEnd={() => { setDrag(null); setDropTarget(null) }}
                      className={`group rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/70 p-2.5 flex items-start gap-2 ${
                        canEdit ? 'hover:border-primary-300' : ''
                      } ${drag?.kind === 'agenda' && drag.item.id === item.id ? 'opacity-50' : ''}`}
                    >
                      <span className="text-xs font-semibold text-slate-400 w-5 text-right shrink-0 mt-0.5">{idx + 1}.</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-slate-800 dark:text-slate-100 leading-snug">{item.title}</p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className="text-[10px] font-mono text-slate-400">{item.ref}</span>
                          <StageBadge stage={item.stage} />
                        </div>
                        {item.ministry && (
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">{item.ministry}</p>
                        )}
                        {item.agenda_blurb && (
                          <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1 leading-relaxed line-clamp-2">{item.agenda_blurb}</p>
                        )}
                      </div>
                      {canEdit && (
                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                          <button onClick={() => reorderWithin(lane.items, idx, 'up')} disabled={idx === 0 || busy} className="p-1 rounded text-slate-400 hover:text-slate-600 disabled:opacity-20"><ChevronUp size={13} /></button>
                          <button onClick={() => reorderWithin(lane.items, idx, 'down')} disabled={idx === lane.items.length - 1 || busy} className="p-1 rounded text-slate-400 hover:text-slate-600 disabled:opacity-20"><ChevronDown size={13} /></button>
                          <button onClick={() => removeItem(item)} disabled={busy} className="p-1 rounded text-slate-400 hover:text-red-500"><X size={13} /></button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
