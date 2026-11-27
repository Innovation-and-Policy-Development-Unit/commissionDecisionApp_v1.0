import clsx from 'clsx'

import { holidayTheme } from '../../constants/holidayTheme'

/**
 * A public holiday as a coloured chip with its own icon.
 *
 * The tone class sets --hol-surface and --hol-ink, so the chip themes itself in
 * light and dark without any logic here. `holidayKey` is the slug from the API;
 * anything unrecognised falls back to the neutral tone.
 *
 * `name` already carries the " (observed)" suffix for in-lieu days, so it is
 * rendered as-is; `observed` only dims the chip slightly to mark it as the
 * moved day rather than the holiday itself.
 */
export default function HolidayBadge({
  name,
  holidayKey,
  observed = false,
  size = 'sm',
  className = '',
}) {
  const { tone, Icon } = holidayTheme(holidayKey)
  return (
    <span
      className={clsx(
        'hol inline-flex items-center gap-1.5 rounded-full font-semibold whitespace-nowrap',
        tone,
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm',
        observed && 'opacity-80',
        className,
      )}
      title={observed ? `${name} — the weekday given in lieu` : name}
    >
      <Icon size={size === 'sm' ? 12 : 14} aria-hidden="true" className="shrink-0" />
      <span className="truncate">{name}</span>
    </span>
  )
}
