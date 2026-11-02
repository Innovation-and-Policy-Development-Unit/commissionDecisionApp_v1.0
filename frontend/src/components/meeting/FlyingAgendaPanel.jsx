/**
 * FlyingAgendaPanel — the extra matters commissioners raise during a sitting.
 *
 * Lives on the Minute Intake page because that is where the people involved
 * already are: the Secretary (who opens and closes the window) and Manager CSU
 * (who takes the minutes and adds the matters). The responsible unit's Manager
 * never sees this panel — they get a notification and file their brief on the
 * submission itself.
 *
 * Backend: POST /meetings/:id/flying-agenda/        (Secretary opens/closes)
 *          POST /meetings/:id/flying-agenda/items/  (Manager CSU adds)
 *          GET  /meetings/:id/flying-agenda/progress/
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Plus, Radio, RefreshCw, CheckCircle2, AlertTriangle, Clock, Loader2,
} from 'lucide-react'
import clsx from 'clsx'
import BaseButton from '../shared/BaseButton'
import BaseInput from '../shared/BaseInput'
import BaseSelect from '../shared/BaseSelect'
import BaseSwitch from '../shared/BaseSwitch'
import BaseTextarea from '../shared/BaseTextarea'
import api from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { formatApiError } from '../../utils/apiError'
import { ROUTED_UNIT_OPTIONS, routedUnitLabel } from '../../constants/units'

const TOGGLE_ROLES = ['psc_secretary', 'psc_admin']
const ADD_ROLES = ['csu_manager', 'psc_admin']

function BriefState({ row }) {
  if (row.brief_complete) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
        <CheckCircle2 size={12} /> Brief filed
      </span>
    )
  }
  if (row.taken) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-700 dark:text-red-300">
        <AlertTriangle size={12} /> Taken with no brief
      </span>
    )
  }
  const ahead = row.items_ahead_outstanding
  return (
    <span className={clsx(
      'inline-flex items-center gap-1 text-[11px] font-bold',
      ahead <= 2 ? 'text-orange-700 dark:text-orange-300' : 'text-slate-500 dark:text-slate-400',
    )}>
      <Clock size={12} />
      {ahead === 0 ? 'Up next — brief outstanding' : `${ahead} item${ahead === 1 ? '' : 's'} ahead`}
    </span>
  )
}

export default function FlyingAgendaPanel({ meetingId, onItemAdded }) {
  const { user } = useAuth()
  const toast = useToast()
  const [progress, setProgress] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ title: '', responsible_unit: '', raised_by: '', notes: '' })

  const canToggle = TOGGLE_ROLES.includes(user?.role)
  const canAdd = ADD_ROLES.includes(user?.role)
  const enabled = Boolean(progress?.flying_agenda_enabled)

  const load = useCallback(async () => {
    try {
      const { data } = await api.get(`/meetings/${meetingId}/flying-agenda/progress/`)
      setProgress(data)
    } catch (err) {
      toast.error(formatApiError(err) || 'Could not load the flying agenda.')
    } finally {
      setLoading(false)
    }
  }, [meetingId, toast])

  useEffect(() => { load() }, [load])

  const flyingRows = useMemo(
    () => (progress?.items || []).filter(row => row.is_flying),
    [progress],
  )

  const toggle = async (next) => {
    setBusy(true)
    try {
      await api.post(`/meetings/${meetingId}/flying-agenda/`, { enabled: next })
      toast.success(next
        ? 'Flying agenda open — Manager CSU can add extra matters.'
        : 'Flying agenda closed.')
      await load()
    } catch (err) {
      toast.error(formatApiError(err) || 'Could not change the flying agenda.')
    } finally {
      setBusy(false)
    }
  }

  const submit = async (event) => {
    event.preventDefault()
    setBusy(true)
    try {
      await api.post(`/meetings/${meetingId}/flying-agenda/items/`, form)
      toast.success(`Added to the end of the agenda. ${routedUnitLabel(form.responsible_unit)} has been notified.`)
      setForm({ title: '', responsible_unit: '', raised_by: '', notes: '' })
      setAdding(false)
      await load()
      onItemAdded?.()
    } catch (err) {
      toast.error(formatApiError(err) || 'Could not add the matter.')
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <div className="card card-compact flex items-center gap-2 text-sm text-slate-500">
        <Loader2 size={14} className="animate-spin" /> Loading the flying agenda…
      </div>
    )
  }

  return (
    <div className="card card-compact space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Radio size={15} className={enabled ? 'text-orange-500' : 'text-slate-400'} />
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">Flying agenda</h3>
          <span className={clsx(
            'text-[10px] font-black uppercase tracking-wide px-2 py-0.5 rounded-full',
            enabled
              ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300'
              : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
          )}>
            {enabled ? 'Open' : 'Closed'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <BaseButton variant="ghost" size="sm" onClick={load} disabled={busy}>
            <RefreshCw size={13} /> Refresh
          </BaseButton>
          {canToggle && (
            <BaseSwitch
              label={enabled ? 'Close' : 'Open'}
              checked={enabled}
              disabled={busy}
              onChange={e => toggle(e.target.checked)}
            />
          )}
        </div>
      </div>

      <p className="text-xs text-slate-500 dark:text-slate-400">
        Matters the Commission raises after endorsing the agenda. They go at the end,
        in the order raised; the responsible unit&apos;s Manager files the brief before
        the Commission works down to them.
      </p>

      {!enabled && canAdd && (
        <p className="text-xs text-slate-500 dark:text-slate-400 italic">
          The Secretary has not opened the flying agenda for this sitting.
        </p>
      )}

      {flyingRows.length > 0 && (
        <ul className="divide-y divide-slate-200 dark:divide-slate-700 border-t border-slate-200 dark:border-slate-700">
          {flyingRows.map(row => (
            <li key={row.agenda_item_id} className="py-2 flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">
                  <span className="text-slate-400 font-mono text-xs me-1.5">#{row.sequence}</span>
                  {row.submission_id ? (
                    <Link to={`/submissions/${row.submission_id}`} className="hover:underline">
                      {row.title}
                    </Link>
                  ) : row.title}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {routedUnitLabel(row.responsible_unit)}
                  {row.raised_by ? ` · raised by ${row.raised_by}` : ''}
                </p>
              </div>
              <BriefState row={row} />
            </li>
          ))}
        </ul>
      )}

      {enabled && canAdd && !adding && (
        <BaseButton variant="primary" size="sm" onClick={() => setAdding(true)}>
          <Plus size={13} /> Add a matter the Commission raised
        </BaseButton>
      )}

      {enabled && canAdd && adding && (
        <form onSubmit={submit} className="space-y-2.5 border-t border-slate-200 dark:border-slate-700 pt-3">
          <BaseInput
            label="What the Commission raised"
            required
            value={form.title}
            placeholder="As it should read on the agenda…"
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
          />
          <BaseSelect
            label="Responsible unit"
            required
            placeholder="Which unit briefs the Commission?"
            value={form.responsible_unit}
            options={ROUTED_UNIT_OPTIONS}
            onChange={(_, value) => setForm(f => ({ ...f, responsible_unit: value }))}
          />
          <BaseInput
            label="Raised by"
            value={form.raised_by}
            placeholder="Which commissioner raised it"
            onChange={e => setForm(f => ({ ...f, raised_by: e.target.value }))}
          />
          <BaseTextarea
            label="Note for the unit (optional)"
            rows={2}
            value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
          />
          <div className="flex items-center gap-2">
            <BaseButton
              type="submit"
              variant="primary"
              size="sm"
              loading={busy}
              disabled={busy || !form.title.trim() || !form.responsible_unit}
            >
              Add and notify the unit
            </BaseButton>
            <BaseButton variant="ghost" size="sm" onClick={() => setAdding(false)} disabled={busy}>
              Cancel
            </BaseButton>
          </div>
        </form>
      )}
    </div>
  )
}
