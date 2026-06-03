import { useEffect, useRef } from 'react'

/** True when the browser tab/window is in the foreground. */
export function isTabVisible() {
  return typeof document === 'undefined' || document.visibilityState === 'visible'
}

/**
 * Run a callback on a fixed interval only while the tab is visible.
 * When the user returns to the tab, runs once immediately (optional).
 */
export function useVisibilityAwareInterval(
  callback,
  delayMs,
  { enabled = true, fireOnVisible = true } = {},
) {
  const saved = useRef(callback)
  saved.current = callback

  useEffect(() => {
    if (!enabled || !delayMs || delayMs <= 0) return undefined

    const tick = () => {
      if (!isTabVisible()) return
      saved.current()
    }

    const onVisibility = () => {
      if (fireOnVisible && isTabVisible()) tick()
    }

    document.addEventListener('visibilitychange', onVisibility)
    const id = setInterval(tick, delayMs)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [enabled, delayMs, fireOnVisible])
}

/**
 * Run a callback when the user switches back to this tab (not on mount).
 */
export function useOnTabVisible(callback, enabled = true) {
  const saved = useRef(callback)
  saved.current = callback

  useEffect(() => {
    if (!enabled) return undefined

    const onVisibility = () => {
      if (isTabVisible()) saved.current()
    }

    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [enabled])
}
