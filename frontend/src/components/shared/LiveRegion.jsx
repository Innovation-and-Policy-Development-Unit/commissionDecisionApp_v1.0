/**
 * Visually hidden live region for screen reader announcements.
 * Use for toasts, notification panel status, and inline success/error messages.
 */
export default function LiveRegion({
  message = '',
  politeness = 'polite',
  atomic = true,
  className = 'sr-only',
}) {
  return (
    <div role="status" aria-live={politeness} aria-atomic={atomic} className={className}>
      {message}
    </div>
  )
}
