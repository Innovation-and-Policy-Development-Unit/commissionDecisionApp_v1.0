import { useEffect, useState } from 'react'

const QUERY = '(prefers-reduced-motion: reduce)'

export function prefersReducedMotion() {
  return typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia(QUERY).matches
}

/** True when the user asked the OS/browser to reduce motion. Updates live. */
export default function useReducedMotion() {
  const [reduced, setReduced] = useState(prefersReducedMotion)
  useEffect(() => {
    if (!window.matchMedia) return undefined
    const mq = window.matchMedia(QUERY)
    const onChange = () => setReduced(mq.matches)
    mq.addEventListener?.('change', onChange)
    return () => mq.removeEventListener?.('change', onChange)
  }, [])
  return reduced
}
