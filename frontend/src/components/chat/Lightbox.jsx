import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Download, X } from 'lucide-react'
import { downloadAttachment, useAttachmentUrl } from './chatMedia'

/** Full-screen viewer for a message's images: Esc closes, arrows or a swipe move between them. */
export default function Lightbox({ images, index, onClose, onIndex }) {
  const image = images[index]
  const { url, failed } = useAttachmentUrl(image)
  const touchX = useRef(null)
  const [busy, setBusy] = useState(false)
  const go = (d) => onIndex((index + d + images.length) % images.length)

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowLeft' && images.length > 1) go(-1)
      else if (e.key === 'ArrowRight' && images.length > 1) go(1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const onTouchEnd = (e) => {
    if (touchX.current == null || images.length < 2) return
    const dx = e.changedTouches[0].clientX - touchX.current
    touchX.current = null
    if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1)
  }

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center"
      role="dialog" aria-modal="true" aria-label={image.original_name}
      onClick={onClose}
      onTouchStart={(e) => { touchX.current = e.touches[0].clientX }}
      onTouchEnd={onTouchEnd}
    >
      <div className="absolute top-3 right-3 flex gap-2" onClick={(e) => e.stopPropagation()}>
        <button type="button" aria-label="Download" disabled={busy}
          onClick={async () => { setBusy(true); try { await downloadAttachment(image) } finally { setBusy(false) } }}
          className="p-2 rounded-full bg-white/10 text-white hover:bg-white/20"><Download size={18} /></button>
        <button type="button" aria-label="Close" onClick={onClose}
          className="p-2 rounded-full bg-white/10 text-white hover:bg-white/20"><X size={18} /></button>
      </div>
      {images.length > 1 && (
        <>
          <button type="button" aria-label="Previous" onClick={(e) => { e.stopPropagation(); go(-1) }}
            className="absolute left-2 p-2 rounded-full bg-white/10 text-white hover:bg-white/20"><ChevronLeft size={22} /></button>
          <button type="button" aria-label="Next" onClick={(e) => { e.stopPropagation(); go(1) }}
            className="absolute right-2 p-2 rounded-full bg-white/10 text-white hover:bg-white/20"><ChevronRight size={22} /></button>
        </>
      )}
      {url && <img src={url} alt={image.original_name} onClick={(e) => e.stopPropagation()} className="max-w-[95vw] max-h-[90vh] object-contain" />}
      {!url && !failed && <span className="text-white/70 text-sm">Loading…</span>}
      {failed && <span className="text-white/80 text-sm">This image could not be loaded.</span>}
      <span className="absolute bottom-3 text-xs text-white/70">
        {image.original_name}{images.length > 1 ? ` · ${index + 1} of ${images.length}` : ''}
      </span>
    </div>
  )
}
