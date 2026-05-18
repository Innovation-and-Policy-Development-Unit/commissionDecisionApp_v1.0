import { useEffect, useRef, useState, useCallback } from 'react'
import { Canvas, FabricImage } from 'fabric'
import * as pdfjsLib from 'pdfjs-dist'
import pdfjsWorkerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import {
  X, ChevronLeft, ChevronRight, Save, Loader2, FileText,
  CalendarDays, CheckCircle2, AlertTriangle, UserX, ExternalLink,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import api from '../../api/client'
import LockPopover from './LockPopover'
import { useAuth } from '../../context/AuthContext'

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

const today = () => new Date().toISOString().split('T')[0]
const fmtDate = iso => {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

export default function DocumentSignatureModal({ document: doc, submissionId, onClose }) {
  const { user } = useAuth()
  // containerRef points to the plain div — React only ever manages that div,
  // never the canvas itself. The canvas is created/destroyed programmatically
  // so Fabric's DOM wrapper never conflicts with React's reconciler.
  const containerRef = useRef(null)
  const fcRef        = useRef(null)
  const pdfRef       = useRef(null)
  const sigObjRef    = useRef(null)

  const [step,        setStep]        = useState('lock')
  const [numPages,    setNumPages]    = useState(0)
  const [pageNum,     setPageNum]     = useState(1)
  const [signedDate,  setSignedDate]  = useState(today())
  const [saving,      setSaving]      = useState(false)
  const [loadError,   setLoadError]   = useState('')
  const [existing,    setExisting]    = useState(null)
  const [storedSig,   setStoredSig]   = useState(null)
  const [pageDataUrl, setPageDataUrl] = useState(null)

  const signerName = user
    ? [user.first_name, user.last_name].filter(Boolean).join(' ') || user.username
    : ''

  // ── 1. Check stored signature on mount ────────────────────────────────────
  useEffect(() => {
    api.get('/my-signature/')
      .then(r => setStoredSig(r.data))
      .catch(() => { setStoredSig(null); setStep('no-sig') })
  }, [])

  // ── 2. Check existing signature for this doc ──────────────────────────────
  useEffect(() => {
    api.get(`/doc-signatures/?document=${doc.id}`)
      .then(res => {
        const mine = res.data.find(s => s.signed_by_username === user?.username)
        if (mine) { setExisting(mine); setSignedDate(mine.signed_date); setPageNum(mine.page_number) }
      })
      .catch(() => {})
  }, [doc.id, user?.username])

  // ── 3. After PIN verified → load PDF ─────────────────────────────────────
  const handleVerified = useCallback(async () => {
    setStep('loading')
    try {
      const token = localStorage.getItem('psc_access')
      const resp  = await fetch(`/api/submissions/${submissionId}/documents/${doc.id}/`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      const buf = await resp.arrayBuffer()
      const pdf  = await pdfjsLib.getDocument({ data: buf }).promise
      pdfRef.current = pdf
      setNumPages(pdf.numPages)
      const startPage = existing?.page_number || pdf.numPages
      setPageNum(startPage)
      await renderPage(startPage, pdf)
      setStep('ready')
    } catch (err) {
      setLoadError(err.message || 'Could not load document.')
      setStep('error')
    }
  }, [doc.id, submissionId, existing])

  // ── Render PDF page to data URL ───────────────────────────────────────────
  const renderPage = useCallback(async (num, pdfDoc) => {
    const pdf = pdfDoc || pdfRef.current
    if (!pdf) return
    const page      = await pdf.getPage(num)
    const viewport  = page.getViewport({ scale: 1.5 })
    const offscreen = document.createElement('canvas')
    offscreen.width  = viewport.width
    offscreen.height = viewport.height
    await page.render({ canvasContext: offscreen.getContext('2d'), viewport }).promise
    setPageDataUrl(offscreen.toDataURL('image/png'))
  }, [])

  // ── Init Fabric when page image is ready ─────────────────────────────────
  // The canvas element is created here and appended to containerRef — React
  // never touches it, so Fabric's canvas-container wrapper never conflicts.
  useEffect(() => {
    if (!pageDataUrl || !containerRef.current || step !== 'ready') return

    // Tear down any previous Fabric instance cleanly
    if (fcRef.current) {
      fcRef.current.dispose()
      fcRef.current = null
    }

    const container = containerRef.current
    const w = container.clientWidth  || window.innerWidth
    const h = container.clientHeight || window.innerHeight - 96

    // Create canvas element imperatively — never rendered by React
    const canvasEl = document.createElement('canvas')
    container.appendChild(canvasEl)

    const fc = new Canvas(canvasEl, { width: w, height: h, selection: false })
    fcRef.current = fc

    loadFabricImage(pageDataUrl, { crossOrigin: 'anonymous' }).then(bg => {
      const scale = Math.min(w / bg.width, h / bg.height)
      bg.set({ scaleX: scale, scaleY: scale, originX: 'left', originY: 'top',
                left: 0, top: 0, selectable: false, evented: false })
      fc.backgroundImage = bg
      fc.requestRenderAll()
      placeSigImage(fc, w, h)
    })

    return () => {
      if (fcRef.current) {
        fcRef.current.dispose()
        fcRef.current = null
      }
      // Remove Fabric's wrapper from container if still there
      if (container.contains(canvasEl)) container.removeChild(canvasEl)
    }
  }, [pageDataUrl, step])

  // ── Place signature image on canvas ──────────────────────────────────────
  const placeSigImage = (fc, cw, ch) => {
    if (!storedSig?.image_url) return
    loadFabricImage(storedSig.image_url).then(img => {
      const maxW = 200, maxH = 80
      // When restoring an existing signature use the stored scale directly.
      // Computing Math.min(maxW/imgW, ...) * sig_scale would double-scale it.
      const scale = existing
        ? existing.sig_scale
        : Math.min(maxW / img.width, maxH / img.height, 1)
      const left  = existing ? existing.position_x * cw : cw - maxW - 24
      const top   = existing ? existing.position_y * ch : ch - maxH - 40
      img.set({
        left, top,
        scaleX: scale, scaleY: scale,
        cornerColor: '#6366f1',
        cornerStyle: 'circle',
        transparentCorners: false,
        borderColor: '#6366f1',
        hasRotatingPoint: false,
      })
      fc.add(img)
      fc.setActiveObject(img)
      fc.requestRenderAll()
      sigObjRef.current = img
    }).catch(err => console.error('Failed to load stored signature image:', err))
  }

  // ── Switch page ───────────────────────────────────────────────────────────
  const switchPage = async n => {
    if (n < 1 || n > numPages || n === pageNum) return
    setPageNum(n)
    await renderPage(n)
  }

  // ── Save ──────────────────────────────────────────────────────────────────
  const save = async () => {
    const fc  = fcRef.current
    const sig = sigObjRef.current
    if (!fc || !sig) return
    setSaving(true)
    try {
      fc.discardActiveObject()
      fc.requestRenderAll()

      const cw         = fc.width, ch = fc.height
      const position_x = sig.left / cw
      const position_y = sig.top  / ch
      const sig_scale  = sig.scaleX

      const snapshotBlob = dataURLtoBlob(fc.toDataURL({ format: 'png', multiplier: 1 }))
      const fd = new FormData()
      fd.append('document',    doc.id)
      fd.append('page_number', pageNum)
      fd.append('position_x',  position_x)
      fd.append('position_y',  position_y)
      fd.append('sig_scale',   sig_scale)
      fd.append('signed_date', signedDate)
      fd.append('snapshot',    new File([snapshotBlob], 'signature.png', { type: 'image/png' }))

      const resp = await api.post('/doc-signatures/', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setExisting(resp.data)
      setStep('done')
    } catch (err) {
      console.error('Failed to save signature', err)
    } finally {
      setSaving(false)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  const renderStep = () => {

    if (step === 'no-sig') return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8 text-center">
        <div className="w-16 h-16 rounded-2xl bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center">
          <UserX size={28} className="text-amber-500" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100 mb-1">No Signature Saved</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm">
            You need to upload or draw your signature in your Profile before you can sign documents.
          </p>
        </div>
        <Link
          to="/account"
          onClick={onClose}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold transition-colors"
        >
          <ExternalLink size={14} /> Go to Profile
        </Link>
      </div>
    )

    if (step === 'error') return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 p-8 text-center">
        <AlertTriangle size={32} className="text-red-400" />
        <p className="text-sm text-red-300">{loadError}</p>
      </div>
    )

    if (step === 'loading') return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 size={36} className="animate-spin text-primary-400" />
      </div>
    )

    if (step === 'done') return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8 text-center">
        <div className="w-16 h-16 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center">
          <CheckCircle2 size={28} className="text-emerald-500" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100 mb-1">Document Signed</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Signed by <strong>{signerName}</strong> on {fmtDate(signedDate)} — Page {pageNum}
          </p>
        </div>
        <button
          onClick={onClose}
          className="px-6 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold transition-colors"
        >
          Close
        </button>
      </div>
    )

    // step === 'ready'
    return (
      <div className="flex flex-1 overflow-hidden">

        {/* Page strip */}
        {numPages > 1 && (
          <div className="w-16 bg-slate-900 border-r border-slate-700 flex flex-col items-center py-3 gap-2 overflow-y-auto shrink-0">
            {Array.from({ length: numPages }, (_, i) => i + 1).map(n => (
              <button
                key={n}
                onClick={() => switchPage(n)}
                className={`w-10 h-12 rounded-md border text-xs font-semibold flex items-center justify-center transition-colors ${
                  n === pageNum
                    ? 'bg-primary-600 border-primary-500 text-white'
                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        )}

        {/* Canvas container — React only manages this div, never the canvas inside */}
        <div ref={containerRef} className="flex-1 relative overflow-hidden bg-slate-700 cursor-move">
          {numPages > 1 && (
            <>
              <button onClick={() => switchPage(pageNum - 1)} disabled={pageNum <= 1}
                className="absolute left-2 top-1/2 -translate-y-1/2 z-10 bg-black/60 hover:bg-black/80 disabled:opacity-20 text-white rounded-full p-2">
                <ChevronLeft size={20} />
              </button>
              <button onClick={() => switchPage(pageNum + 1)} disabled={pageNum >= numPages}
                className="absolute right-2 top-1/2 -translate-y-1/2 z-10 bg-black/60 hover:bg-black/80 disabled:opacity-20 text-white rounded-full p-2">
                <ChevronRight size={20} />
              </button>
            </>
          )}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 bg-black/70 text-slate-300 text-xs px-4 py-1.5 rounded-full pointer-events-none">
            Page {pageNum} / {numPages} — drag your signature to position it
          </div>
        </div>

        {/* Right panel */}
        <div className="w-56 bg-slate-900 border-l border-slate-700 flex flex-col p-4 gap-4 shrink-0">
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Signing Date</p>
            <input
              type="date"
              value={signedDate}
              onChange={e => setSignedDate(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-200 px-2.5 py-2 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>
          <div className="border-t border-slate-700 pt-3">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Signing as</p>
            <p className="text-xs text-slate-200 font-medium">{signerName}</p>
            <p className="text-xs text-slate-500 mt-0.5 capitalize">{user?.role?.replace(/_/g, ' ')}</p>
          </div>
          <div className="border-t border-slate-700 pt-3">
            <p className="text-xs text-slate-400 leading-relaxed">
              Drag the signature to the correct position on the page. Use the corner handles to resize it.
            </p>
          </div>
          {existing && (
            <div className="border-t border-slate-700 pt-3">
              <p className="text-xs font-semibold text-emerald-400 flex items-center gap-1 mb-1">
                <CheckCircle2 size={11} /> Previously Signed
              </p>
              <p className="text-xs text-slate-400">{fmtDate(existing.signed_date)} · p.{existing.page_number}</p>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col select-none">

      {/* Toolbar */}
      <div className="flex items-center gap-2 bg-slate-900 px-3 h-12 shrink-0 border-b border-slate-700">
        <div className="flex items-center gap-2 max-w-[220px]">
          <FileText size={14} className="text-slate-400 shrink-0" />
          <span className="text-xs text-slate-300 truncate">{doc.original_name}</span>
        </div>

        <div className="w-px h-6 bg-slate-700 mx-1" />

        {step === 'ready' && (
          <>
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <CalendarDays size={13} />
              <input
                type="date"
                value={signedDate}
                onChange={e => setSignedDate(e.target.value)}
                className="bg-slate-800 border border-slate-700 rounded text-xs text-slate-200 px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </div>
            <div className="flex-1" />
            <button
              onClick={save}
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white transition-colors mr-1"
            >
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
              {existing ? 'Update Signature' : 'Sign Document'}
            </button>
          </>
        )}

        {step !== 'ready' && <div className="flex-1" />}

        <button
          onClick={onClose}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:bg-slate-700 transition-colors"
        >
          <X size={14} /> Close
        </button>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {renderStep()}
      </div>

      {/* Lock Popover — shown first */}
      {step === 'lock' && storedSig && (
        <LockPopover
          title="Confirm Identity"
          message="Enter your Session PIN to place your signature on this document."
          onVerified={handleVerified}
          onCancel={onClose}
        />
      )}
    </div>
  )
}
