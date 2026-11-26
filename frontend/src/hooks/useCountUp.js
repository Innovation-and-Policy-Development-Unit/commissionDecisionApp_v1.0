import { useEffect, useRef, useState } from 'react'
import { prefersReducedMotion } from './useReducedMotion'

/**
 * Counts from 0 up to `target` once (400 ms, ease-out). Later changes to `target`
 * jump straight to the new value, so live updates never replay the animation.
 * Reduced motion: no animation.
 */
export default function useCountUp(target, duration = 400) {
  const isNumber = typeof target === 'number' && Number.isFinite(target)
  const played = useRef(false)
  const [value, setValue] = useState(() => (isNumber && !prefersReducedMotion() ? 0 : target))

  useEffect(() => {
    if (!isNumber) { setValue(target); return undefined }
    if (played.current || prefersReducedMotion() || target === 0) {
      played.current = true
      setValue(target)
      return undefined
    }
    played.current = true
    let raf
    const start = performance.now()
    const tick = (now) => {
      const p = Math.min(1, (now - start) / duration)
      setValue(Math.round(target * (1 - Math.pow(1 - p, 3))))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, isNumber, duration])

  return value
}
