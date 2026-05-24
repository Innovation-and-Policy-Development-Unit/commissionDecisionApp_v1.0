/**
 * Shared accessibility utilities (WCAG 2.1 AA patterns).
 * Used by BaseButton, BaseInput, and interactive overlays.
 */

/** Visible focus ring — 2px primary, offset for buttons on colored backgrounds */
export const FOCUS_RING =
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-900 dim:focus-visible:ring-offset-slate-800'

export const FOCUS_RING_INSET =
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500'

/** Minimum touch target (44×44 CSS px) when size allows */
export const MIN_TOUCH = 'min-h-[44px] min-w-[44px]'

export const SR_ONLY =
  'sr-only absolute w-px h-px p-0 -m-px overflow-hidden whitespace-nowrap border-0'
