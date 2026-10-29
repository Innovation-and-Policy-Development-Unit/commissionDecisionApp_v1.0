import { useEffect, useState } from 'react'
import { Clock, Send } from 'lucide-react'
import BaseButton from '../shared/BaseButton'

function remaining(deadlineIso, now) {
  const ms = new Date(deadlineIso).getTime() - now
  if (ms <= 0) return null
  const totalMin = Math.floor(ms / 60000)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  return `${h}h ${String(m).padStart(2, '0')}m`
}

/**
 * Shown to the submitting ministry while a paper waits out its recall window: it has
 * been received but not yet passed to OPSC. They can recall it from the Actions
 * panel, or send it on straight away.
 */
export default function RecallWindowCard({ deadline, busy, onSendNow }) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000)
    return () => clearInterval(id)
  }, [])

  const left = deadline ? remaining(deadline, now) : null
  if (!left) return null

  return (
    <div className="card card-compact space-y-2 border-l-4 border-l-amber-400">
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
        <Clock size={14} className="text-amber-600" />
        Received by PSC — you can still recall it for {left}
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        OPSC will not see this paper until the window closes
        ({new Date(deadline).toLocaleString()}). Use <strong>Recall submission</strong> to correct it, or send it on now.
      </p>
      <BaseButton variant="outline" size="sm" onClick={onSendNow} disabled={busy}>
        <Send size={13} className="mr-1.5" /> Send to OPSC now
      </BaseButton>
    </div>
  )
}
