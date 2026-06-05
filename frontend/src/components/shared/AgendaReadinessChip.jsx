/**
 * AgendaReadinessChip — the Chairman's "is there enough agenda to convene?" signal.
 *
 * Mirrors the backend Meeting.agenda_readiness() logic so it can be driven either
 * by a live item count (e.g. the agenda builder, where items change as you edit)
 * or by a serialized `readiness` object from the API.
 *
 * Props:
 *   - readiness:  { count, min_items, max_items, is_ready, shortfall, level } (optional)
 *   - count, minItems, maxItems: computed client-side when `readiness` is absent
 *   - size: 'sm' | 'md'  (default 'md')
 */
import { CheckCircle2, CircleDashed, AlertTriangle, Layers } from 'lucide-react'

export function computeReadiness(count = 0, minItems = 0, maxItems = 0) {
  const isReady = count >= minItems && count > 0
  const shortfall = Math.max(0, minItems - count)
  let level
  if (count === 0) level = 'empty'
  else if (maxItems && count > maxItems) level = 'over'
  else if (maxItems && count >= maxItems) level = 'full'
  else if (isReady) level = 'ready'
  else level = 'building'
  return { count, min_items: minItems, max_items: maxItems, is_ready: isReady, shortfall, level }
}

const STYLES = {
  empty: {
    cls: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700',
    Icon: CircleDashed,
  },
  building: {
    cls: 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300 border-amber-200 dark:border-amber-800',
    Icon: CircleDashed,
  },
  ready: {
    cls: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
    Icon: CheckCircle2,
  },
  full: {
    cls: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
    Icon: Layers,
  },
  over: {
    cls: 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300 border-red-200 dark:border-red-800',
    Icon: AlertTriangle,
  },
}

function label(r) {
  switch (r.level) {
    case 'empty':
      return r.min_items > 0 ? `No items — needs ${r.min_items} to convene` : 'No items yet'
    case 'building':
      return `Needs ${r.shortfall} more item${r.shortfall !== 1 ? 's' : ''} to convene`
    case 'ready':
      return 'Ready to convene'
    case 'full':
      return 'Ready — at capacity'
    case 'over':
      return 'Ready — over capacity'
    default:
      return 'Agenda status'
  }
}

export default function AgendaReadinessChip({
  readiness,
  count,
  minItems = 0,
  maxItems = 0,
  size = 'md',
  className = '',
}) {
  const r = readiness || computeReadiness(count, minItems, maxItems)
  const { cls, Icon } = STYLES[r.level] || STYLES.empty
  const pad = size === 'sm' ? 'px-2 py-0.5 text-[11px] gap-1' : 'px-2.5 py-1 text-xs gap-1.5'
  const iconSize = size === 'sm' ? 12 : 14
  const min = r.min_items || minItems
  return (
    <span
      className={`inline-flex items-center rounded-full border font-medium ${pad} ${cls} ${className}`}
      title={min ? `${r.count} of minimum ${min} item${min !== 1 ? 's' : ''}${r.max_items ? ` (max ${r.max_items})` : ''}` : undefined}
    >
      <Icon size={iconSize} className={r.level === 'building' ? '' : ''} />
      {label(r)}
    </span>
  )
}
