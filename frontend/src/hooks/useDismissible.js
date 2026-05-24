import { useEffect, useCallback } from 'react'

/**
 * Close on outside mousedown and Escape (LanguageSwitcher pattern).
 */
export function useDismissible({ open, onClose, containerRef }) {
  const close = useCallback(() => {
    onClose?.()
  }, [onClose])

  useEffect(() => {
    if (!open) return undefined

    function handleMouseDown(e) {
      if (containerRef?.current && !containerRef.current.contains(e.target)) {
        close()
      }
    }
    function handleKey(e) {
      if (e.key === 'Escape') {
        e.stopPropagation()
        close()
      }
    }
    document.addEventListener('mousedown', handleMouseDown)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleMouseDown)
      document.removeEventListener('keydown', handleKey)
    }
  }, [open, close, containerRef])

  return close
}
