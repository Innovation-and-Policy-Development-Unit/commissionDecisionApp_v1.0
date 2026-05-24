import { useEffect, useRef, useState, useCallback } from 'react'
import { Canvas, Circle, IText, FabricImage, PencilBrush } from 'fabric'
import * as pdfjsLib from 'pdfjs-dist'
import pdfjsWorkerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import {
  X, ChevronLeft, ChevronRight, PenLine, CircleDot, Type,
  RotateCcw, Save, Loader2, FileText, AlertTriangle, Sparkles,
} from 'lucide-react'
import api from '../../api/client'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerSrc

// CSP blocks fetch() on data: URLs — convert in memory instead
function dataURLtoBlob(dataURL) {
  const [header, b64] = dataURL.split(',')
  const mime = header.match(/:(.*?);/)[1]
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new Blob([bytes], { type: mime })
}

// FabricImage.fromURL internally calls fetch() which CSP blocks for data: URLs.
// Load via HTMLImageElement instead (governed by img-src, not connect-src).
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
  { value: '#f59e0b', label: 'Amber' },
  { value: '#10b981', label: 'Green' },
  { value: '#3b82f6', label: 'Blue' },
  { value: '#a855f7', label: 'Purple' },
  { value: '#0f172a', label: 'Black' },
]

const TOOLS = [
  { id: 'pen',    label: 'Draw',   Icon: PenLine },
  { id: 'circle', label: 'Circle', Icon: CircleDot },
  { id: 'text',   label: 'Text',   Icon: Type },
]

export default function DocumentAnnotatorModal({ document: doc, submissionId, onClose }) {
  const fcRef        = useRef(null)
  const containerRef = useRef(null)
  const pdfRef       = useRef(null)

  const [numPages,    setNumPages]    = useState(0)
  const [pageNum,     setPageNum]     = useState(1)
  const [tool,        setTool]        = useState('pen')
  const [color,       setColor]       = useState('#ef4444')
  const [note,        setNote]        = useState('')
  const [saving,      setSaving]      = useState(false)
  const [loading,     setLoading]     = useState(true)
  const [loadError,   setLoadError]   = useState('')
  const [savedPages,  setSavedPages]  = useState({})
  const [dirty,       setDirty]       = useState(false)
  const [pageDataUrl, setPageDataUrl] = useState(null)
  const [aiSuggestions, setAiSuggestions] = useState(null)
  const [aiRedactions, setAiRedactions] = useState(null)
  const [aiBusy, setAiBusy] = useState(null)

  const pageStateRef = useRef({})

  const pollDocAi = useCallback(async () => {
    try {
      const r = await api.get(`/submissions/${submissionId}/documents/`)
      const fresh = (r.data || []).find(d => d.id === doc.id)
      if (!fresh) return
      if (fresh.ai_annotation_suggestions?.processed) {
        setAiSuggestions(fresh.ai_annotation_suggestions)
      }
      if (fresh.ai_redaction_spans?.processed) {
        setAiRedactions(fresh.ai_redaction_spans)
      }
    } catch { /* ignore */ }
  }, [submissionId, doc.id])

  // ── Load saved annotations ──────────────────────────────────────────────────
  useEffect(() => {
    // Note: api client baseURL is '/api', so paths here must NOT include '/api/'
    api.get(`/doc-annotations/?document=${doc.id}`)
      .then(res => {
        const map = {}
        const state = {}
        res.data.forEach(ann => {
          map[ann.page_number] = ann.id
          state[ann.page_number] = { fabricJson: ann.fabric_json, note: ann.note }
        })
        setSavedPages(map)
        pageStateRef.current = state
      })
      .catch(() => {})
  }, [doc.id])

  useEffect(() => {
    pollDocAi()
  }, [pollDocAi])

  const requestAnnotationAssist = async () => {
    setAiBusy('annotate')
    setAiSuggestions(null)
    try {
      await api.post(`/submissions/${submissionId}/documents/${doc.id}/annotation-assist/`)
      const iv = setInterval(async () => {
        await pollDocAi()
      }, 3000)
      setTimeout(() => clearInterval(iv), 120000)
    } finally {
      setAiBusy(null)
    }
  }

  const requestRedactionPreview = async () => {
    setAiBusy('redact')
    setAiRedactions(null)
    try {
      await api.post(`/submissions/${submissionId}/documents/${doc.id}/redaction-preview/`)
      const iv = setInterval(async () => {
        await pollDocAi()
      }, 3000)
      setTimeout(() => clearInterval(iv), 120000)
    } finally {
      setAiBusy(null)
    }
  }

  // ── Fetch PDF and render first page ────────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setLoadError('')

    const loadPdf = async () => {
      try {
        const token = localStorage.getItem('psc_access')
        // Use native fetch (not api client) so we can get a raw ArrayBuffer
        const resp = await fetch(`/api/submissions/${submissionId}/documents/${doc.id}/`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${resp.statusText}`)
        const arrayBuffer = await resp.arrayBuffer()
        if (cancelled) return
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
        if (cancelled) return
        pdfRef.current = pdf
        setNumPages(pdf.numPages)
        await renderPage(1, pdf)
      } catch (err) {
        if (!cancelled) {
          setLoadError(err.message || 'Could not load document.')
          setLoading(false)
        }
      }
    }
    loadPdf()
    return () => { cancelled = true }
  }, [doc.id, submissionId])

  // ── Render a single PDF page → data URL ────────────────────────────────────
  const renderPage = useCallback(async (num, pdfDoc) => {
    const pdf = pdfDoc || pdfRef.current
    if (!pdf) return
    setLoading(true)
    const page = await pdf.getPage(num)
    const viewport = page.getViewport({ scale: 1.5 })
    const offscreen = document.createElement('canvas')
    offscreen.width  = viewport.width
    offscreen.height = viewport.height
    await page.render({ canvasContext: offscreen.getContext('2d'), viewport }).promise
    const dataUrl = offscreen.toDataURL('image/png')
    setPageDataUrl(dataUrl)
    setLoading(false)
  }, [])

  // ── Init / reset Fabric canvas when page image changes ─────────────────────
  // The canvas element is created imperatively so Fabric's DOM wrapper never
  // conflicts with React's reconciler (avoids removeChild NotFoundError).
  useEffect(() => {
    if (!pageDataUrl || !containerRef.current) return

    const container = containerRef.current
    const w = container.clientWidth  || window.innerWidth
    const h = container.clientHeight || window.innerHeight - 96

    if (fcRef.current) { fcRef.current.dispose(); fcRef.current = null }

    const canvasEl = document.createElement('canvas')
    container.appendChild(canvasEl)

    const fc = new Canvas(canvasEl, {
      width: w, height: h, isDrawingMode: true,
    })
    fc.freeDrawingBrush = new PencilBrush(fc)
    fc.freeDrawingBrush.color = color
    fc.freeDrawingBrush.width = 3

    loadFabricImage(pageDataUrl, { crossOrigin: 'anonymous' }).then(img => {
      const scale = Math.min(w / img.width, h / img.height)
      img.set({ scaleX: scale, scaleY: scale, originX: 'left', originY: 'top',
                 left: 0, top: 0, selectable: false, evented: false })
      fc.backgroundImage = img
      fc.requestRenderAll()

      const saved = pageStateRef.current[pageNum]
      if (saved?.fabricJson?.length) {
        fc.loadFromJSON({ objects: saved.fabricJson }).then(() => fc.requestRenderAll())
      }
    })

    fc.on('object:added',    () => setDirty(true))
    fc.on('object:modified', () => setDirty(true))
    fcRef.current = fc

    return () => {
      if (fcRef.current) { fcRef.current.dispose(); fcRef.current = null }
      if (container.contains(canvasEl)) container.removeChild(canvasEl)
    }
  }, [pageDataUrl])

  // ── Sync tool / color ───────────────────────────────────────────────────────
  useEffect(() => {
    const fc = fcRef.current
    if (!fc) return
    fc.isDrawingMode = tool === 'pen'
  }, [tool])

  useEffect(() => {
    const fc = fcRef.current
    if (fc?.freeDrawingBrush) fc.freeDrawingBrush.color = color
  }, [color])

  // ── Canvas click handler (circle / text placement) ──────────────────────────
  const handleMouseDown = useCallback(opt => {
    const fc = fcRef.current
    if (!fc || opt.target) return
    const pt = fc.getScenePoint(opt.e)
    if (tool === 'circle') {
      fc.add(new Circle({
        radius: 40, fill: 'transparent', stroke: color, strokeWidth: 3,
        left: pt.x - 40, top: pt.y - 40,
      }))
      fc.requestRenderAll()
    }
    if (tool === 'text') {
      const txt = new IText('Type here', {
        left: pt.x, top: pt.y, fontSize: 20, fill: color,
        fontFamily: 'var(--fontFamilyBase)', fontWeight: 'bold',
      })
      fc.add(txt)
      fc.setActiveObject(txt)
      txt.enterEditing()
      txt.selectAll()
      fc.requestRenderAll()
    }
  }, [tool, color])

  useEffect(() => {
    const fc = fcRef.current
    if (!fc) return
    fc.on('mouse:down', handleMouseDown)
    return () => fc.off('mouse:down', handleMouseDown)
  }, [handleMouseDown])

  // ── Switch page ─────────────────────────────────────────────────────────────
  const switchPage = useCallback(async newPage => {
    if (newPage < 1 || newPage > numPages || newPage === pageNum) return
    const fc = fcRef.current
    if (fc) {
      pageStateRef.current[pageNum] = {
        fabricJson: fc.toObject().objects || [],
        note,
      }
    }
    setNote(pageStateRef.current[newPage]?.note || '')
    setDirty(false)
    setPageNum(newPage)
    await renderPage(newPage)
  }, [pageNum, numPages, note, renderPage])

  // ── Undo ────────────────────────────────────────────────────────────────────
  const undo = () => {
    const fc = fcRef.current
    if (!fc) return
    const objs = fc.getObjects()
    if (objs.length) {
      fc.remove(objs[objs.length - 1])
      fc.discardActiveObject()
      fc.requestRenderAll()
    }
  }

  // ── Save page annotation ────────────────────────────────────────────────────
  const savePage = async () => {
    const fc = fcRef.current
    if (!fc) return
    setSaving(true)
    try {
      fc.discardActiveObject()
      fc.requestRenderAll()
      const objects = fc.toObject().objects || []
      const snapshotBlob = dataURLtoBlob(fc.toDataURL({ format: 'png', multiplier: 1 }))

      const fd = new FormData()
      fd.append('document',    doc.id)
      fd.append('page_number', pageNum)
      fd.append('fabric_json', JSON.stringify(objects))
      fd.append('note',        note)
      fd.append('snapshot',    new File([snapshotBlob], `page${pageNum}.png`, { type: 'image/png' }))

      const resp = await api.post('/doc-annotations/', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      pageStateRef.current[pageNum] = { fabricJson: objects, note }
      setSavedPages(prev => ({ ...prev, [pageNum]: resp.data.id }))
      setDirty(false)
    } catch (err) {
      console.error('Failed to save annotation', err)
    } finally {
      setSaving(false)
    }
  }

  const handleClose = () => {
    if (dirty && !window.confirm('You have unsaved annotations on this page. Close anyway?')) return
    onClose()
  }

  const hint = { pen: 'Drag to draw', circle: 'Click to place a circle', text: 'Click to add text' }

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col select-none">

      {/* ── Toolbar ── */}
      <div className="flex items-center gap-1 bg-slate-900 px-3 h-12 shrink-0 border-b border-slate-700">

        <div className="flex items-center gap-2 mr-3 max-w-[220px]">
          <FileText size={14} className="text-slate-400 shrink-0" />
          <span className="text-xs text-slate-300 truncate">{doc.original_name}</span>
        </div>

        <div className="w-px h-6 bg-slate-700 mr-1" />

        {TOOLS.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setTool(id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              tool === id ? 'bg-primary-600 text-white' : 'text-slate-300 hover:bg-slate-700'
            }`}
          >
            <Icon size={14} /> {label}
          </button>
        ))}

        <div className="w-px h-6 bg-slate-700 mx-1" />

        {COLORS.map(c => (
          <button
            key={c.value}
            onClick={() => setColor(c.value)}
            title={c.label}
            style={{ backgroundColor: c.value }}
            className={`w-5 h-5 rounded-full border transition-transform ${
              color === c.value
                ? 'ring-2 ring-white ring-offset-1 ring-offset-slate-900 scale-125 border-transparent'
                : 'border-slate-600 hover:scale-110'
            }`}
          />
        ))}

        <div className="w-px h-6 bg-slate-700 mx-1" />

        <button
          onClick={undo}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:bg-slate-700 transition-colors"
        >
          <RotateCcw size={13} /> Undo
        </button>

        <div className="flex-1" />

        <span className="hidden lg:block text-xs text-slate-500 mr-3">{hint[tool]}</span>

        <button
          onClick={savePage}
          disabled={saving}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white transition-colors mr-1"
        >
          {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
          Save Page
        </button>

        <button
          onClick={handleClose}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:bg-slate-700 transition-colors"
        >
          <X size={14} /> Close
        </button>
      </div>

      {/* ── Body ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Page strip */}
        <div className="w-16 bg-slate-900 border-r border-slate-700 flex flex-col items-center py-3 gap-2 overflow-y-auto shrink-0">
          {Array.from({ length: numPages }, (_, i) => i + 1).map(n => (
            <button
              key={n}
              onClick={() => switchPage(n)}
              title={`Page ${n}${savedPages[n] ? ' (annotated)' : ''}`}
              className={`relative w-10 h-12 rounded-md border text-xs font-semibold flex items-center justify-center transition-colors ${
                n === pageNum
                  ? 'bg-primary-600 border-primary-500 text-white'
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'
              }`}
            >
              {n}
              {savedPages[n] && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-500 border border-slate-900" />
              )}
            </button>
          ))}
        </div>

        {/* Canvas area */}
        <div ref={containerRef} className="flex-1 relative overflow-hidden bg-slate-800">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-900/70 z-10">
              <Loader2 size={32} className="animate-spin text-primary-400" />
            </div>
          )}
          {loadError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-10">
              <AlertTriangle size={32} className="text-red-400" />
              <p className="text-sm text-red-300">{loadError}</p>
              <p className="text-xs text-slate-400">Check the browser console for details.</p>
            </div>
          )}
          {/* canvas is appended imperatively by useEffect — not rendered by React */}

          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-black/70 px-4 py-2 rounded-full pointer-events-none">
            <span className="text-slate-300 text-xs">Page {pageNum} of {numPages}</span>
          </div>

          <button
            onClick={() => switchPage(pageNum - 1)}
            disabled={pageNum <= 1}
            className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/80 disabled:opacity-20 text-white rounded-full p-2 transition-colors"
          >
            <ChevronLeft size={20} />
          </button>
          <button
            onClick={() => switchPage(pageNum + 1)}
            disabled={pageNum >= numPages}
            className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/80 disabled:opacity-20 text-white rounded-full p-2 transition-colors"
          >
            <ChevronRight size={20} />
          </button>
        </div>

        {/* Notes panel */}
        <div className="w-64 bg-slate-900 border-l border-slate-700 flex flex-col p-3 gap-3 shrink-0">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Page {pageNum} Notes</p>
          <textarea
            value={note}
            onChange={e => { setNote(e.target.value); setDirty(true) }}
            placeholder="Add a comment or observation for this page…"
            className="flex-1 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-200 p-2.5 resize-none focus:outline-none focus:ring-1 focus:ring-primary-500 placeholder-slate-500"
          />
          {dirty && (
            <p className="text-xs text-amber-400">Unsaved changes — click Save Page.</p>
          )}
          <div className="border-t border-slate-700 pt-3 space-y-2">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">AI assist</p>
            <p className="text-[10px] text-amber-400">AI draft — verify</p>
            <button
              type="button"
              onClick={requestAnnotationAssist}
              disabled={!!aiBusy}
              className="w-full text-xs py-1.5 rounded bg-slate-800 border border-slate-600 text-slate-200 hover:bg-slate-700 inline-flex items-center justify-center gap-1 disabled:opacity-50"
            >
              {aiBusy === 'annotate' ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
              Suggest highlights
            </button>
            <button
              type="button"
              onClick={requestRedactionPreview}
              disabled={!!aiBusy}
              className="w-full text-xs py-1.5 rounded bg-slate-800 border border-slate-600 text-slate-200 hover:bg-slate-700 inline-flex items-center justify-center gap-1 disabled:opacity-50"
            >
              {aiBusy === 'redact' ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
              Redaction preview
            </button>
            {aiSuggestions?.suggestions?.length > 0 && (
              <ul className="text-[11px] text-slate-300 space-y-1 max-h-32 overflow-y-auto">
                {aiSuggestions.suggestions.map((s, i) => (
                  <li key={i} className="border-l-2 border-violet-500 pl-2">
                    p.{s.page_number}: {s.comment || s.text_excerpt}
                  </li>
                ))}
              </ul>
            )}
            {aiRedactions?.spans?.length > 0 && (
              <ul className="text-[11px] text-amber-200 space-y-1 max-h-32 overflow-y-auto">
                {aiRedactions.spans.map((s, i) => (
                  <li key={i} className="border-l-2 border-amber-500 pl-2">
                    p.{s.page_number}: {s.reason || s.label} — {s.text_excerpt}
                  </li>
                ))}
              </ul>
            )}
          </div>
          {Object.keys(savedPages).length > 0 && (
            <div className="border-t border-slate-700 pt-3">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Annotated Pages</p>
              <div className="flex flex-wrap gap-1">
                {Object.keys(savedPages).map(p => (
                  <button
                    key={p}
                    onClick={() => switchPage(Number(p))}
                    className={`px-2 py-0.5 rounded text-xs font-medium ${
                      Number(p) === pageNum
                        ? 'bg-primary-600 text-white'
                        : 'bg-emerald-900/50 text-emerald-400 hover:bg-emerald-800/60'
                    }`}
                  >
                    p.{p}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
