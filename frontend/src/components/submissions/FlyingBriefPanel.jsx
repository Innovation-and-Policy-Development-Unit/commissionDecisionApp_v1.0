/**
 * FlyingBriefPanel — the short brief a responsible unit files for a matter the
 * Commission raised during a sitting.
 *
 * A full submission cannot be assembled between a commissioner raising the
 * matter and the Commission working down the agenda to it, so the unit Manager
 * files subject, background and recommendation instead. The deadline is
 * positional, not a date: the item is taken when the Commission reaches it.
 *
 * Backend: GET/PATCH /agenda-items/:id/flying-brief/
 */
import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, Loader2, Send } from 'lucide-react'
import BaseButton from '../shared/BaseButton'
import BaseInput from '../shared/BaseInput'
import BaseTextarea from '../shared/BaseTextarea'
import api from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { formatApiError } from '../../utils/apiError'
import { UNIT_MANAGER_ROLE, routedUnitLabel } from '../../constants/units'

// Mirrors flying_agenda.assert_may_fill_brief — the backend is the authority.
const ALWAYS_ALLOWED = ['psc_admin', 'psc_secretary', 'csu_manager']

export default function FlyingBriefPanel({ placement, routedUnit }) {
  const { user } = useAuth()
  const toast = useToast()
  const agendaItemId = placement?.agenda_item_id
  const [brief, setBrief] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const canEdit = Boolean(user) && (
    ALWAYS_ALLOWED.includes(user.role) || user.role === UNIT_MANAGER_ROLE[routedUnit]
  )

  const load = useCallback(async () => {
    try {
      const { data } = await api.get(`/agenda-items/${agendaItemId}/flying-brief/`)
      setBrief(data)
    } catch (err) {
      toast.error(formatApiError(err) || 'Could not load the brief.')
    } finally {
      setLoading(false)
    }
  }, [agendaItemId, toast])

  useEffect(() => { if (agendaItemId) load() }, [agendaItemId, load])

  const save = async (event) => {
    event.preventDefault()
    setSaving(true)
    try {
      const { data } = await api.patch(`/agenda-items/${agendaItemId}/flying-brief/`, {
        subject: brief.subject || '',
        background: brief.background || '',
        recommendation: brief.recommendation || '',
      })
      setBrief(data)
      toast.success(data.is_complete
        ? 'Brief filed — the Commission has what it needs.'
        : 'Saved. The brief is not complete until all three parts are filled.')
    } catch (err) {
      toast.error(formatApiError(err) || 'Could not save the brief.')
    } finally {
      setSaving(false)
    }
  }

  if (!agendaItemId) return null
  if (loading) {
    return (
      <div className="card card-compact flex items-center gap-2 text-sm text-slate-500">
        <Loader2 size={14} className="animate-spin" /> Loading the brief…
      </div>
    )
  }
  if (!brief) return null

  const set = (field) => (event) => setBrief(b => ({ ...b, [field]: event.target.value }))

  return (
    <div className="card card-compact space-y-3 border-l-4 border-l-orange-400">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
          Brief for the Commission
        </h3>
        {brief.is_complete ? (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 size={12} />
            Filed by {brief.completed_by_name || 'the unit'}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-orange-700 dark:text-orange-300">
            <AlertTriangle size={12} /> Outstanding
          </span>
        )}
      </div>

      <p className="text-xs text-slate-500 dark:text-slate-400">
        {placement.raised_by ? `${placement.raised_by} raised this ` : 'This matter was raised '}
        during {placement.meeting_reference}, and it sits at {placement.label}.
        {' '}
        {routedUnit ? `${routedUnitLabel(routedUnit)} briefs the Commission on it` : 'The responsible unit briefs the Commission on it'}
        {' '}— file all three parts before the Commission reaches the item.
      </p>

      {canEdit ? (
        <form onSubmit={save} className="space-y-2.5">
          <BaseInput
            label="Subject"
            value={brief.subject || ''}
            onChange={set('subject')}
            placeholder="The matter as it should read on the agenda"
          />
          <BaseTextarea
            label="Background"
            rows={4}
            value={brief.background || ''}
            onChange={set('background')}
            placeholder="What the Commission needs to know to decide"
          />
          <BaseTextarea
            label="Recommendation"
            rows={3}
            value={brief.recommendation || ''}
            onChange={set('recommendation')}
            placeholder="What the unit recommends the Commission do"
          />
          <BaseButton type="submit" variant="primary" size="sm" loading={saving} disabled={saving}>
            <Send size={13} /> Save the brief
          </BaseButton>
        </form>
      ) : (
        <dl className="space-y-2 text-xs">
          {[['Subject', brief.subject], ['Background', brief.background], ['Recommendation', brief.recommendation]].map(
            ([label, value]) => (
              <div key={label}>
                <dt className="font-black text-slate-400 uppercase tracking-widest text-[10px]">{label}</dt>
                <dd className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                  {(value || '').trim() || <span className="italic text-slate-400">Not filed yet</span>}
                </dd>
              </div>
            ),
          )}
        </dl>
      )}
    </div>
  )
}
