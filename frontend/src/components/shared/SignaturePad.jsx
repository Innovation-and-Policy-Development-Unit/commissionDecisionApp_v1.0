import { useRef, useEffect, useState } from 'react'
import { RotateCcw, Check, X } from 'lucide-react'

/**
 * Simple HTML5-canvas signature pad.
 * Props:
 *   onDone(blob) – called with a PNG Blob when the user clicks "Use Signature"
 *   onCancel     – called when dismissed
 */
export default function SignaturePad({ onDone, onCancel }) {
  const canvasRef = useRef(null)
  const drawing   = useRef(false)
  const [hasStrokes, setHasStrokes] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')

    // White background
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    const getPos = e => {
      const rect = canvas.getBoundingClientRect()
      const src  = e.touches ? e.touches[0] : e
      return {
        x: (src.clientX - rect.left) * (canvas.width / rect.width),
        y: (src.clientY - rect.top)  * (canvas.height / rect.height),
      }
    }

    const start = e => {
      e.preventDefault()
      drawing.current = true
      const { x, y } = getPos(e)
      ctx.beginPath()
      ctx.moveTo(x, y)
    }
    const move = e => {
      e.preventDefault()
      if (!drawing.current) return
      const { x, y } = getPos(e)
      ctx.lineWidth   = 2.5
      ctx.lineCap     = 'round'
      ctx.lineJoin    = 'round'
      ctx.strokeStyle = '#0c2451'
      ctx.lineTo(x, y)
      ctx.stroke()
      setHasStrokes(true)
    }
    const end = e => {
      e.preventDefault()
      drawing.current = false
    }

    canvas.addEventListener('mousedown',  start)
    canvas.addEventListener('mousemove',  move)
    canvas.addEventListener('mouseup',    end)
    canvas.addEventListener('mouseleave', end)
    canvas.addEventListener('touchstart', start, { passive: false })
    canvas.addEventListener('touchmove',  move,  { passive: false })
    canvas.addEventListener('touchend',   end,   { passive: false })

    return () => {
      canvas.removeEventListener('mousedown',  start)
      canvas.removeEventListener('mousemove',  move)
      canvas.removeEventListener('mouseup',    end)
      canvas.removeEventListener('mouseleave', end)
      canvas.removeEventListener('touchstart', start)
      canvas.removeEventListener('touchmove',  move)
      canvas.removeEventListener('touchend',   end)
    }
  }, [])

  const clear = () => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    setHasStrokes(false)
  }

  const handleDone = () => {
    canvasRef.current.toBlob(blob => {
      if (blob) onDone(blob)
    }, 'image/png')
  }

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(3px)' }}
    >
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden w-full max-w-md mx-4">
        <div className="h-1 bg-gradient-to-r from-primary-600 to-indigo-500" />
        <div className="p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">Draw Your Signature</h2>
              <p className="text-xs text-slate-400 mt-0.5">Use your mouse or finger to sign in the box below</p>
            </div>
            <button onClick={onCancel} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700">
              <X size={15} />
            </button>
          </div>

          {/* Drawing area */}
          <div className="rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-600 overflow-hidden mb-4">
            <canvas
              ref={canvasRef}
              width={480}
              height={180}
              className="w-full cursor-crosshair touch-none"
              style={{ display: 'block' }}
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={clear}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              <RotateCcw size={13} /> Clear
            </button>
            <div className="flex-1" />
            <button onClick={onCancel} className="px-4 py-2 rounded-lg text-xs font-medium text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
              Cancel
            </button>
            <button
              onClick={handleDone}
              disabled={!hasStrokes}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-primary-600 hover:bg-primary-700 text-white disabled:opacity-40 transition-colors"
            >
              <Check size={13} /> Use Signature
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
