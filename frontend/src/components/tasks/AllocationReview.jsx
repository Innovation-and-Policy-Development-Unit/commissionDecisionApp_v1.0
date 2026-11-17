import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, FileText, Loader, PauseCircle, Sparkles, Wand2 } from 'lucide-react'
import clsx from 'clsx'
import api from '../../api/client'
import { useToast } from '../../context/ToastContext'
import { formatApiError } from '../../utils/apiError'
import BaseButton from '../shared/BaseButton'
import BaseInput from '../shared/BaseInput'
import BaseSelect from '../shared/BaseSelect'

const UNIT_OPTIONS = ['CIU', 'CSU', 'FHU', 'HRMU', 'ODU', 'OPSC_Secretary', 'VIPAM_HRDU']
  .map(v => ({ value: v, label: v.replace('_', ' ') }))

const AUTO_ACCEPT_AT = 80

function addDays(days) {
  const d = new Date()
  d.setDate(d.getDate() + (Number(days) || 30))
  return d.toISOString().slice(0, 10)
}

function initialRow(item) {
  const s = item.suggestion
  return {
    include: !!s && s.confidence >= AUTO_ACCEPT_AT,
    manager: s ? String(s.manager_id) : '',
    unit: (s && s.action_unit) || item.action_unit || '',
    due: addDays(s?.due_days),
  }
}

function SourceBadge({ s }) {
  if (!s) return <span className="text-[11px] text-amber-700 dark:text-amber-400">No suggestion — pick a manager</span>
  const ai = s.source === 'ai'
  const named = s.source === 'minutes'
  const low = s.confidence < AUTO_ACCEPT_AT
  return (
    <span
      title={s.reason}
      className={clsx(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold',
        ai ? 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300'
           : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
      )}
    >
      {ai ? <Sparkles size={10} /> : <CheckCircle2 size={10} />}
      {ai ? 'AI suggestion' : named ? 'Named in the minutes' : 'Routed by unit'} · {s.confidence}%{low ? ' · check' : ''}
    </span>
  )
}

/**
 * Allocation review: every decision from signed minutes that has no task yet,
 * each with a suggested manager (unit rule first, AI for the rest). The
 * Secretariat reviews, adjusts and allocates in bulk — one click per decision
 * instead of the full Allocate-task form.
 */
export default function AllocationReview({ onAllocated, onCount, canHold = false }) {
  const toast = useToast()
  const [data, setData] = useState(null)
  const [rows, setRows] = useState({})
  const [loading, setLoading] = useState(true)
  const [aiBusy, setAiBusy] = useState(false)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const [holdingId, setHoldingId] = useState(null)
  const [holdReason, setHoldReason] = useState('')
  const [holdBusy, setHoldBusy] = useState(false)

  const apply = useCallback((res, keepEdits) => {
    setData(res)
    onCount?.(res.items.filter(i => !i.held).length)
    setRows(prev => {
      const next = {}
      for (const it of res.items) {
        const old = prev[it.agenda_item]
        // Keep what the user already edited; only fill rows the AI just resolved.
        next[it.agenda_item] = keepEdits && old && (old.manager || !it.suggestion) ? old : initialRow(it)
      }
      return next
    })
  }, [onCount])

  useEffect(() => {
    api.get('/commission-tasks/allocation-suggestions/')
      .then(r => apply(r.data, false))
      .catch(e => setErr(formatApiError(e, 'Could not load decisions awaiting allocation.')))
      .finally(() => setLoading(false))
  }, [apply])

  const allItems = data?.items ?? []
  const items = allItems.filter(it => !it.held)
  const heldItems = allItems.filter(it => it.held)
  const managerOptions = useMemo(
    () => (data?.managers ?? []).map(m => ({ value: String(m.id), label: `${m.name} (${m.open_tasks} open)` })),
    [data],
  )
  const unresolved = items.filter(it => !it.suggestion).length
  const selected = items.filter(it => rows[it.agenda_item]?.include && rows[it.agenda_item]?.manager)

  const patch = (id, p) => setRows(r => ({ ...r, [id]: { ...r[id], ...p } }))

  const reload = async () => {
    const fresh = await api.get('/commission-tasks/allocation-suggestions/')
    apply(fresh.data, true)
  }

  const placeHold = async it => {
    if (!holdReason.trim()) return
    setHoldBusy(true); setErr('')
    try {
      await api.post(`/minutes/${it.minutes}/hold-decision/`, { agenda_item_id: it.agenda_item, reason: holdReason.trim() })
      setHoldingId(null); setHoldReason('')
      await reload()
    } catch (e) {
      setErr(formatApiError(e, 'Could not hold this decision.'))
    } finally { setHoldBusy(false) }
  }

  const releaseHold = async it => {
    setHoldBusy(true); setErr('')
    try {
      await api.post(`/minutes/${it.minutes}/release-decision/`, { agenda_item_id: it.agenda_item })
      await reload()
    } catch (e) {
      setErr(formatApiError(e, 'Could not release this decision.'))
    } finally { setHoldBusy(false) }
  }

  const runAi = async () => {
    setAiBusy(true); setErr('')
    try {
      const res = await api.post('/commission-tasks/allocation-suggestions/')
      apply(res.data, true)
      if (res.data.ai_error) setErr(`AI suggestions unavailable: ${res.data.ai_error}. Pick managers manually.`)
    } catch (e) {
      setErr(formatApiError(e, 'AI suggestion failed.'))
    } finally { setAiBusy(false) }
  }

  const allocate = async () => {
    setSaving(true); setErr('')
    try {
      const res = await api.post('/commission-tasks/allocate-bulk/', {
        allocations: selected.map(it => ({
          agenda_item: it.agenda_item,
          assigned_manager: Number(rows[it.agenda_item].manager),
          action_unit: rows[it.agenda_item].unit,
          due_date: rows[it.agenda_item].due || null,
        })),
      })
      const { created, skipped } = res.data
      toast.success(`${created.length} task${created.length === 1 ? '' : 's'} allocated and managers notified.`)
      if (skipped.length) setErr(`${skipped.length} skipped: ${skipped.map(s => s.reason).join('; ')}`)
      const fresh = await api.get('/commission-tasks/allocation-suggestions/')
      apply(fresh.data, false)
      onAllocated?.()
    } catch (e) {
      setErr(formatApiError(e, 'Could not allocate.'))
    } finally { setSaving(false) }
  }

  if (loading) {
    return <div className="card flex items-center justify-center gap-2 py-16 text-slate-500 text-sm"><Loader size={18} className="animate-spin" /> Loading…</div>
  }

  if (allItems.length === 0) {
    return (
      <div className="card text-center py-16 text-slate-500 text-sm">
        <CheckCircle2 size={28} className="mx-auto mb-2 text-emerald-500" />
        Every decision in the signed minutes has been allocated.
        {err && <p className="mt-2 text-red-600 text-xs">{err}</p>}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="card p-4 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1 text-sm text-slate-600 dark:text-slate-300">
          <p className="font-semibold text-slate-800 dark:text-slate-100">
            {items.length} decision{items.length === 1 ? '' : 's'} waiting for a manager
            {heldItems.length > 0 && <span className="font-normal text-slate-500"> · {heldItems.length} on hold</span>}
          </p>
          <p className="text-xs text-slate-500">
            Suggestions are pre-ticked when confident. Check them, change anything that looks wrong, then allocate.
          </p>
        </div>
        {unresolved > 0 && (
          <BaseButton variant="outline" icon={<Wand2 size={14} />} onClick={runAi} loading={aiBusy} loadingLabel="Thinking">
            Suggest with AI ({unresolved})
          </BaseButton>
        )}
        <BaseButton variant="primary" onClick={allocate} disabled={selected.length === 0} loading={saving} loadingLabel="Allocating">
          Allocate selected ({selected.length})
        </BaseButton>
      </div>
      {err && <p className="text-sm text-red-600 dark:text-red-400">{err}</p>}

      {items.map(it => {
        const r = rows[it.agenda_item] || {}
        return (
          <div key={it.agenda_item} className="card p-4 space-y-3">
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4"
                aria-label={`Include ${it.item_title}`}
                checked={!!r.include}
                disabled={!r.manager}
                onChange={e => patch(it.agenda_item, { include: e.target.checked })}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{it.item_title}</p>
                <p className="text-[11px] text-slate-500">
                  {it.meeting_reference} · {it.minute_reference}
                  {it.submission_reference ? ` · ${it.submission_reference}` : ''}
                </p>
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-400 line-clamp-3">{it.decision_detail}</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-3">
                  {it.submission ? (
                    <Link to={`/submissions/${it.submission}`} className="inline-flex items-center gap-1 text-xs font-medium text-primary-700 dark:text-primary-300 hover:underline">
                      <FileText size={12} />View submission
                    </Link>
                  ) : (
                    <Link to="/secretariat/minutes" className="inline-flex items-center gap-1 text-xs font-medium text-primary-700 dark:text-primary-300 hover:underline">
                      <FileText size={12} />View minutes
                    </Link>
                  )}
                  <SourceBadge s={it.suggestion} />
                  {!it.minutes_signed && (
                    <span title="The Secretary allowed these decisions to be actioned before the minutes are signed." className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                      Minutes not yet signed
                    </span>
                  )}
                  {canHold && (
                    <button type="button" onClick={() => { setHoldingId(holdingId === it.agenda_item ? null : it.agenda_item); setHoldReason('') }}
                      className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 dark:text-slate-300 hover:underline">
                      <PauseCircle size={12} />Hold
                    </button>
                  )}
                </div>
                {holdingId === it.agenda_item && (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <input className="input text-sm flex-1 min-w-[12rem]" placeholder="Why hold this decision? (required)" value={holdReason} onChange={e => setHoldReason(e.target.value)} />
                    <BaseButton variant="outline" size="sm" onClick={() => placeHold(it)} disabled={!holdReason.trim()} loading={holdBusy} loadingLabel="Holding">Hold decision</BaseButton>
                  </div>
                )}
                {it.suggestion?.reason && <p className="mt-1 text-[11px] text-slate-500">{it.suggestion.reason}</p>}
              </div>
            </div>
            <div className="grid sm:grid-cols-3 gap-3 pl-7">
              <BaseSelect
                label="Manager"
                placeholder="Select manager…"
                value={r.manager || ''}
                options={managerOptions}
                onChange={(_, v) => patch(it.agenda_item, { manager: v, include: !!v })}
              />
              <BaseSelect
                label="Action unit"
                placeholder="— Unit —"
                value={r.unit || ''}
                options={UNIT_OPTIONS}
                onChange={(_, v) => patch(it.agenda_item, { unit: v })}
              />
              <BaseInput label="Due date" type="date" value={r.due || ''} onChange={e => patch(it.agenda_item, { due: e.target.value })} />
            </div>
          </div>
        )
      })}

      {heldItems.length > 0 && (
        <div className="space-y-3 pt-2">
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2">
            <PauseCircle size={14} /> On hold — not actioned until released
          </p>
          {heldItems.map(it => (
            <div key={it.agenda_item} className="card p-4 border-amber-200 dark:border-amber-800 bg-amber-50/40 dark:bg-amber-900/10">
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{it.item_title}</p>
              <p className="text-[11px] text-slate-500">
                {it.meeting_reference} · {it.minute_reference}{it.submission_reference ? ` · ${it.submission_reference}` : ''}
              </p>
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-400 line-clamp-2">{it.decision_detail}</p>
              <p className="mt-1 text-xs text-amber-800 dark:text-amber-300">Reason: {it.hold_reason || '—'}</p>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                {it.submission && (
                  <Link to={`/submissions/${it.submission}`} className="inline-flex items-center gap-1 text-xs font-medium text-primary-700 dark:text-primary-300 hover:underline">
                    <FileText size={12} />View submission
                  </Link>
                )}
                {it.hold_source === 'submission' ? (
                  <span className="text-xs text-slate-500">Held on the submission — release it from the submission page.</span>
                ) : canHold ? (
                  <BaseButton variant="outline" size="sm" onClick={() => releaseHold(it)} loading={holdBusy} loadingLabel="Releasing">Release hold</BaseButton>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
