import { useEffect, useRef, useState, useCallback } from 'react'
import { Canvas, Circle, IText, FabricImage, PencilBrush } from 'fabric'
import { Check, X, RotateCcw, PenLine, CircleDot, Type } from 'lucide-react'

// FabricImage.fromURL internally calls fetch() which CSP blocks for data: URLs.
function loadFabricImage(src, opts = {}) {
  return new Promise((resolve, reject) => {
    const el = new Image()
    if (opts.crossOrigin) el.crossOrigin = opts.crossOrigin
    el.onload  = () => resolve(new FabricImage(el, opts))
    el.onerror = reject
    el.src = src
  })
}

const COLORS = [
  { value: '#ef4444', label: 'Red' },
  { value: '#f59e0b', label: 'Yellow' },
  { value: '#10b981', label: 'Green' },
  { value: '#3b82f6', label: 'Blue' },
  { value: '#ffffff', label: 'White' },
  { value: '#0f172a', label: 'Black' },
]

const TOOLS = [
  { id: 'pen',    label: 'Draw',   Icon: PenLine },
  { id: 'circle', label: 'Circle', Icon: CircleDot },
  { id: 'text',   label: 'Text',   Icon: Type },
]

export default function ScreenshotAnnotator({ imageDataUrl, onDone, onCancel }) {
  const canvasElRef = useRef(null)
  const fcRef       = useRef(null)
  const [tool,  setTool]  = useState('pen')
  const [color, setColor] = useState('#ef4444')

  // Initialise Fabric canvas once
  useEffect(() => {
    const w = window.innerWidth
    const h = window.innerHeight - 48   // subtract toolbar height

    const fc = new Canvas(canvasElRef.current, {
      width: w,
      height: h,
      isDrawingMode: true,
    })

    fc.freeDrawingBrush = new PencilBrush(fc)
    fc.freeDrawingBrush.color = '#ef4444'
    fc.freeDrawingBrush.width = 3

    loadFabricImage(imageDataUrl, { crossOrigin: 'anonymous' }).then(img => {
      const scaleX = w / img.width
      const scaleY = h / img.height
      const scale  = Math.max(scaleX, scaleY)
      img.set({ scaleX: scale, scaleY: scale, originX: 'left', originY: 'top', left: 0, top: 0, selectable: false, evented: false })
      fc.backgroundImage = img
      fc.requestRenderAll()
    })

    fcRef.current = fc
    return () => fc.dispose()
  }, [imageDataUrl])

  // Sync drawing mode when tool changes
  useEffect(() => {
    const fc = fcRef.current
    if (!fc) return
    fc.isDrawingMode = tool === 'pen'
  }, [tool])

  // Sync brush color
  useEffect(() => {
    const fc = fcRef.current
    if (!fc?.freeDrawingBrush) return
    fc.freeDrawingBrush.color = color
  }, [color])

  // Handle canvas clicks for circle / text placement
  const handleMouseDown = useCallback((opt) => {
    const fc = fcRef.current
    if (!fc) return
    if (opt.target) return   // clicked an existing object — let Fabric handle selection

    const pt = fc.getScenePoint(opt.e)

    if (tool === 'circle') {
      const circle = new Circle({
        radius: 40,
        fill: 'transparent',
        stroke: color,
        strokeWidth: 3,
        left: pt.x - 40,
        top: pt.y - 40,
      })
      fc.add(circle)
      fc.setActiveObject(circle)
      fc.requestRenderAll()
    }

    if (tool === 'text') {
      const text = new IText('Type here', {
        left: pt.x,
        top: pt.y,
        fontSize: 22,
        fill: color,
        fontFamily: 'var(--fontFamilyBase)',
        fontWeight: 'bold',
      })
      fc.add(text)
      fc.setActiveObject(text)
      text.enterEditing()
      text.selectAll()
      fc.requestRenderAll()
    }
  }, [tool, color])

  useEffect(() => {
    const fc = fcRef.current
    if (!fc) return
    fc.on('mouse:down', handleMouseDown)
    return () => fc.off('mouse:down', handleMouseDown)
  }, [handleMouseDown])

  const undo = () => {
    const fc = fcRef.current
    if (!fc) return
    const objs = fc.getObjects()
    if (objs.length > 0) {
      fc.remove(objs[objs.length - 1])
      fc.discardActiveObject()
      fc.requestRenderAll()
    }
  }

  const handleDone = () => {
    const fc = fcRef.current
    if (!fc) return
    fc.discardActiveObject()
    fc.requestRenderAll()
    const dataUrl = fc.toDataURL({ format: 'png', multiplier: 1 })
    onDone(dataUrl)
  }

  const hint = { pen: 'Click and drag to draw', circle: 'Click anywhere to place a circle', text: 'Click anywhere to add text' }

  return (
    <div className="fixed inset-0 z-[90] bg-black flex flex-col select-none">

      {/* ── Toolbar ── */}
      <div className="flex items-center gap-1 bg-primary-900 px-3 h-12 shrink-0 border-b border-white/10">

        {/* Tool buttons */}
        {TOOLS.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setTool(id)}
            title={label}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              tool === id
                ? 'bg-white text-primary-700 shadow-sm'
                : 'text-primary-100 hover:bg-white/10'
            }`}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}

        <div className="w-px h-6 bg-white/15 mx-2" />

        {/* Color swatches */}
        {COLORS.map(c => (
          <button
            key={c.value}
            onClick={() => setColor(c.value)}
            title={c.label}
            style={{ backgroundColor: c.value }}
            className={`w-5 h-5 rounded-full border transition-transform ${
              color === c.value
                ? 'ring-2 ring-white ring-offset-1 ring-offset-primary-900 scale-125 border-transparent'
                : 'border-white/30 hover:scale-110'
            }`}
          />
        ))}

        <div className="w-px h-6 bg-white/15 mx-2" />

        {/* Undo */}
        <button
          onClick={undo}
          title="Undo last annotation"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-primary-100 hover:bg-white/10 transition-colors"
        >
          <RotateCcw size={13} />
          Undo
        </button>

        <div className="flex-1" />

        {/* Cancel */}
        <button
          onClick={onCancel}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-primary-200 hover:bg-white/10 transition-colors mr-1"
        >
          <X size={14} />
          Cancel
        </button>

        {/* Done */}
        <button
          onClick={handleDone}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold bg-brand-emerald hover:brightness-110 text-white transition-all"
        >
          <Check size={14} />
          Use Screenshot
        </button>
      </div>

      {/* ── Canvas area ── */}
      <div className="flex-1 overflow-hidden relative">
        <canvas ref={canvasElRef} className="block" />

        {/* Hint pill */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-primary-900/85 text-primary-100 ring-1 ring-white/10 text-xs px-4 py-1.5 rounded-full pointer-events-none">
          {hint[tool]}
        </div>
      </div>
    </div>
  )
}
