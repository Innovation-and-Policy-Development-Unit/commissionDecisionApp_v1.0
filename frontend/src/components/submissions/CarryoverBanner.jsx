import { CalendarClock } from 'lucide-react'

const fmt = (d) =>
  d ? new Date(d).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }) : ''

/**
 * Tells HR and unit managers, in plain terms, that a submission missed a sitting's
 * due date and where it is queued — and that the Chairman may still admit it.
 * Reads `submission.carryover_status` from the API.
 */
export default function CarryoverBanner({ status }) {
  if (!status || (!status.is_late && !status.carried_over)) return null

  const nearest = status.nearest_meeting || {}
  const target = status.target_meeting || {}
  const sameTarget = !target.ref || target.ref === nearest.ref

  return (
    <div className="mb-4 flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-900/20 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
      <CalendarClock size={15} className="mt-0.5 shrink-0" />
      <div>
        <p className="font-semibold">Submitted after the due date</p>
        <p className="mt-0.5">
          This missed the due date{nearest.due_date ? ` (${fmt(nearest.due_date)})` : ''} for sitting{' '}
          <span className="font-medium">{nearest.ref || 'the next sitting'}</span>.
          {sameTarget
            ? ' It remains queued and may be carried to a later sitting.'
            : <> It has been queued for <span className="font-medium">{target.ref}</span>{target.date ? ` (sits ${fmt(target.date)})` : ''}.</>}
          {' '}The Chairman may still admit it to <span className="font-medium">{nearest.ref || 'the nearer sitting'}</span> before endorsing that agenda.
        </p>
      </div>
    </div>
  )
}
