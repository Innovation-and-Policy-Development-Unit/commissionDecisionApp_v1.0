import { useEffect, useRef, useCallback } from 'react'

const IGNORE_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT'])

function isTyping() {
  const el = document.activeElement
  if (!el) return false
  if (IGNORE_TAGS.has(el.tagName)) return true
  if (el.isContentEditable) return true
  return false
}

/**
 * Registers global keyboard shortcuts.
 *
 * Shortcuts:
 *   /          → open search (always fires, even in inputs, via psc:search:open event)
 *   ?          → toggle shortcuts help modal
 *   n          → new submission
 *   g d        → go to dashboard
 *   g s        → go to submissions
 *   g a        → go to assistant
 *   g r        → go to reports
 *   g m        → go to meeting room
 *   g t        → go to tasks
 *   g n        → go to notifications
 *
 * The g-prefix sequences must be completed within 1 000 ms.
 */
export function useGlobalShortcuts({ onToggleShortcuts, navigate }) {
  const gSeq = useRef(null) // timestamp when 'g' was pressed

  const handleKeyDown = useCallback(
    (e) => {
      // '?' — always opens shortcut modal regardless of focus
      if (e.key === '?' && !e.ctrlKey && !e.altKey && !e.metaKey) {
        e.preventDefault()
        onToggleShortcuts?.()
        return
      }

      // '/' — always open search (dispatched as DOM event so Header can respond)
      if (e.key === '/' && !e.ctrlKey && !e.altKey && !e.metaKey) {
        e.preventDefault()
        document.dispatchEvent(new CustomEvent('psc:search:open'))
        return
      }

      // All other shortcuts: skip when the user is actively typing
      if (isTyping()) { gSeq.current = null; return }
      if (e.ctrlKey || e.altKey || e.metaKey) return

      // 'n' → new submission
      if (e.key === 'n') {
        e.preventDefault()
        navigate?.('/submissions/new')
        return
      }

      // g-prefix navigation
      if (e.key === 'g') {
        gSeq.current = Date.now()
        return
      }

      if (gSeq.current !== null && Date.now() - gSeq.current < 1000) {
        gSeq.current = null
        const destinations = {
          d: '/',
          s: '/submissions',
          a: '/assistant',
          r: '/reports',
          m: '/secretariat/meeting-room',
          t: '/secretariat/tasks',
          n: '/secretariat/notifications',
        }
        if (destinations[e.key]) {
          e.preventDefault()
          navigate?.(destinations[e.key])
        }
      } else {
        gSeq.current = null
      }
    },
    [navigate, onToggleShortcuts],
  )

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])
}

/** Shortcut definitions used by the help modal. */
export const SHORTCUT_DEFS = [
  { keys: ['/'],       description: 'Open search' },
  { keys: ['n'],       description: 'New submission' },
  { keys: ['g', 'd'],  description: 'Go to Dashboard' },
  { keys: ['g', 's'],  description: 'Go to Submissions' },
  { keys: ['g', 'a'],  description: 'Go to Staff Assistant' },
  { keys: ['g', 'r'],  description: 'Go to Reports' },
  { keys: ['g', 'm'],  description: 'Go to Meeting Room' },
  { keys: ['g', 't'],  description: 'Go to Tasks' },
  { keys: ['g', 'n'],  description: 'Go to Notifications' },
  { keys: ['?'],       description: 'Show keyboard shortcuts' },
  { keys: ['Esc'],     description: 'Close dialogs / cancel' },
]
