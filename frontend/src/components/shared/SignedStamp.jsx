import { useEffect } from 'react'
import { CheckCircle2 } from 'lucide-react'

/**
 * A short "Signed and recorded" confirmation: a stamp that lands with a check mark,
 * then removes itself. Reduced motion: shown without movement.
 */
export default function SignedStamp({ show, onDone, label = 'Signed and recorded' }) {
  useEffect(() => {
    if (!show) return undefined
    const t = setTimeout(() => onDone?.(), 2200)
    return () => clearTimeout(t)
  }, [show, onDone])

  if (!show) return null
  return (
    <div
      role="status"
      className="pointer-events-none fixed inset-0 z-[95] flex items-center justify-center"
    >
      <div className="fx-stamp flex items-center gap-3 rounded-2xl border-2 border-emerald-600 bg-white/95 px-6 py-4 text-emerald-700 shadow-xl dark:bg-slate-900/95 dark:text-emerald-300">
        <CheckCircle2 size={30} aria-hidden />
        <span className="text-lg font-bold tracking-tight">{label}</span>
      </div>
    </div>
  )
}
