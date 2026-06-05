import { useMemo } from 'react'

/** Repeating diagonal watermark shown only during an active Sitting Pack session. */
export default function DigitalSealOverlay({ session }) {
  const lines = useMemo(() => {
    if (!session?.active) return []
    const ref = session.meeting_reference || ''
    const seal = session.seal_code || ''
    const viewer = session.viewer_name || ''
    const started = session.started_at
      ? new Date(session.started_at).toLocaleString('en-VU', {
          day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
        })
      : ''
    return Array.from({ length: 48 }, (_, i) => (
      <span key={i} className="sitting-pack-seal-line">
        {`PSC CONFIDENTIAL · ${ref} · SEAL ${seal} · ${viewer} · ${started}`}
      </span>
    ))
  }, [session])

  if (!session?.active || lines.length === 0) return null

  return (
    <div className="sitting-pack-seal-overlay text-slate-400" aria-hidden>
      <div className="sitting-pack-seal-grid">{lines}</div>
      <span className="sitting-pack-seal-badge text-[10px]">SEAL {session.seal_code}</span>
    </div>
  )
}
