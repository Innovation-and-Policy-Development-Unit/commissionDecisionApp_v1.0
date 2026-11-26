import { useEffect, useRef, useState } from 'react'

/**
 * Returns true for ~700 ms after `value` changes (never on first render), so a
 * badge can pulse once when its status moves. Pass `only` to limit it to certain values.
 */
export default function usePulseOnChange(value, only) {
  const first = useRef(true)
  const [pulse, setPulse] = useState(false)
  useEffect(() => {
    if (first.current) { first.current = false; return undefined }
    if (only && !only.includes(value)) return undefined
    setPulse(true)
    const t = setTimeout(() => setPulse(false), 700)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])
  return pulse
}
