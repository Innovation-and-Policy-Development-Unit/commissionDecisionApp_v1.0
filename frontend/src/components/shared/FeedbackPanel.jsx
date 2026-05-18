import { useState, useCallback } from 'react'
import { Send, X, AlertCircle, CheckCircle2, MessageSquare, Camera, Trash2 } from 'lucide-react'
import html2canvas from 'html2canvas'
import api from '../../api/client'
import clsx from 'clsx'
import ScreenshotAnnotator from './ScreenshotAnnotator'

export default function FeedbackPanel({ open, onClose }) {
  const [loading,  setLoading]  = useState(false)
  const [success,  setSuccess]  = useState(false)
  const [error,    setError]    = useState(null)
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    feedback_type: 'bug',
    severity: 'medium',
  })

  // Screenshot states
  const [capturing,       setCapturing]       = useState(false)   // sidebar hidden while html2canvas runs
  const [annotating,      setAnnotating]      = useState(false)   // annotation editor is open
  const [capturedDataUrl, setCapturedDataUrl] = useState(null)    // raw capture passed to annotator
  const [screenshot,      setScreenshot]      = useState(null)    // File to submit
  const [screenshotPreview, setScreenshotPreview] = useState(null) // preview dataUrl

  // ── Screenshot capture ────────────────────────────────────────────────────────

  const takeScreenshot = useCallback(async () => {
    setCapturing(true)  // slides panel off-screen
    // Wait for slide-out animation to complete before capturing
    await new Promise(r => setTimeout(r, 380))

    try {
      const canvas = await html2canvas(document.documentElement, {
        useCORS: true,
        allowTaint: true,
        scale: Math.min(window.devicePixelRatio || 1, 2),
        logging: false,
      })
      setCapturedDataUrl(canvas.toDataURL('image/png'))
      setAnnotating(true)
    } catch {
      setError('Could not capture screenshot. Please try again.')
    } finally {
      setCapturing(false)
    }
  }, [])

  const handleAnnotationDone = (annotatedDataUrl) => {
    try {
      const [header, base64] = annotatedDataUrl.split(',')
      const mime   = header.match(/:(.*?);/)[1]
      const binary = atob(base64)
      const bytes  = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
      const blob = new Blob([bytes], { type: mime })
      const file = new File([blob], 'screenshot.png', { type: 'image/png' })
      setScreenshot(file)
      setScreenshotPreview(annotatedDataUrl)
    } catch {
      setError('Failed to process screenshot.')
    } finally {
      setAnnotating(false)
      setCapturedDataUrl(null)
    }
  }

  const handleAnnotationCancel = () => {
    setAnnotating(false)
    setCapturedDataUrl(null)
  }

  const removeScreenshot = () => {
    setScreenshot(null)
    setScreenshotPreview(null)
  }

  // ── Form submit ───────────────────────────────────────────────────────────────

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const data = new FormData()
      data.append('title',         formData.title)
      data.append('description',   formData.description)
      data.append('feedback_type', formData.feedback_type)
      data.append('severity',      formData.severity)
      data.append('page_url',      window.location.href)
      data.append('browser_info',  navigator.userAgent)
      data.append('viewport_size', `${window.innerWidth}x${window.innerHeight}`)
      if (screenshot) data.append('screenshot', screenshot)

      await api.post('/feedback/', data, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })

      setSuccess(true)
      setTimeout(() => {
        setSuccess(false)
        onClose()
        setFormData({ title: '', description: '', feedback_type: 'bug', severity: 'medium' })
        removeScreenshot()
      }, 2000)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to submit feedback. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // ── Visibility logic ──────────────────────────────────────────────────────────
  // Hide panel (but keep open=true) while capturing or while annotating
  const panelVisible   = open && !capturing && !annotating
  const backdropVisible = open && !capturing && !annotating

  return (
    <>
      {/* Annotation editor — shown fullscreen above everything */}
      {annotating && capturedDataUrl && (
        <ScreenshotAnnotator
          imageDataUrl={capturedDataUrl}
          onDone={handleAnnotationDone}
          onCancel={handleAnnotationCancel}
        />
      )}

      {/* Backdrop */}
      {backdropVisible && (
        <div
          className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-[60] animate-fade-in"
          onClick={onClose}
        />
      )}

      {/* Slide-in Panel */}
      <div className={clsx(
        'fixed inset-y-0 right-0 w-full max-w-md bg-white dark:bg-slate-800 shadow-2xl z-[70]',
        'transform transition-transform duration-300 ease-in-out flex flex-col',
        panelVisible ? 'translate-x-0' : 'translate-x-full',
      )}>

        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 flex items-center justify-center">
              <MessageSquare size={20} />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-slate-100">Send Feedback</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Help us improve the platform</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {success ? (
            <div className="h-full flex flex-col items-center justify-center text-center animate-scale-in">
              <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mb-6">
                <CheckCircle2 size={40} />
              </div>
              <h4 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">Thank You!</h4>
              <p className="text-slate-500 dark:text-slate-400">
                Your feedback has been submitted and will be reviewed by our team.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-xl flex gap-3 text-red-700 dark:text-red-400 text-sm">
                  <AlertCircle size={18} className="shrink-0 mt-0.5" />
                  <p>{error}</p>
                </div>
              )}

              {/* Summary */}
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Summary</label>
                <input
                  type="text"
                  required
                  placeholder="What's the issue or suggestion?"
                  className="w-full input"
                  value={formData.title}
                  onChange={e => setFormData({ ...formData, title: e.target.value })}
                />
              </div>

              {/* Type + Severity */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Type</label>
                  <select
                    className="w-full input"
                    value={formData.feedback_type}
                    onChange={e => setFormData({ ...formData, feedback_type: e.target.value })}
                  >
                    <option value="bug">Bug / Error</option>
                    <option value="ui_issue">UI / Layout</option>
                    <option value="workflow_problem">Workflow</option>
                    <option value="suggestion">Suggestion</option>
                    <option value="performance">Performance</option>
                    <option value="security">Security</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Severity</label>
                  <select
                    className="w-full input"
                    value={formData.severity}
                    onChange={e => setFormData({ ...formData, severity: e.target.value })}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Detailed Description</label>
                <textarea
                  required
                  rows={5}
                  placeholder="Provide as much detail as possible..."
                  className="w-full input py-3 min-h-[120px]"
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                />
              </div>

              {/* Screenshot section */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Screenshot <span className="font-normal text-slate-400">(optional)</span>
                </label>

                {screenshotPreview ? (
                  /* ── Annotated preview ── */
                  <div className="relative rounded-xl overflow-hidden border-2 border-emerald-300 dark:border-emerald-700 bg-slate-50 dark:bg-slate-900">
                    <img
                      src={screenshotPreview}
                      alt="Screenshot preview"
                      className="w-full h-auto max-h-52 object-contain"
                    />
                    <div className="absolute top-2 right-2 flex gap-1.5">
                      <button
                        type="button"
                        onClick={takeScreenshot}
                        title="Retake screenshot"
                        className="p-1.5 bg-black/60 hover:bg-black/80 text-white rounded-full transition-colors"
                      >
                        <Camera size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={removeScreenshot}
                        title="Remove screenshot"
                        className="p-1.5 bg-black/60 hover:bg-black/80 text-white rounded-full transition-colors"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 bg-emerald-600/80 text-white text-[11px] text-center py-1 font-medium">
                      Screenshot attached
                    </div>
                  </div>
                ) : (
                  /* ── Take screenshot button ── */
                  <button
                    type="button"
                    onClick={takeScreenshot}
                    disabled={capturing}
                    className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl hover:border-primary-400 dark:hover:border-primary-500 hover:bg-primary-50/50 dark:hover:bg-primary-900/10 transition-all group disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {capturing ? (
                      <>
                        <svg className="animate-spin h-7 w-7 text-primary-500 mb-2" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        <p className="text-sm text-primary-500 font-medium">Capturing…</p>
                      </>
                    ) : (
                      <>
                        <Camera size={28} className="text-slate-400 group-hover:text-primary-500 mb-2 transition-colors" />
                        <p className="text-sm text-slate-500 dark:text-slate-400 group-hover:text-primary-600 dark:group-hover:text-primary-400 font-medium transition-colors">
                          Take a screenshot
                        </p>
                        <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                          Panel hides → capture → annotate → attach
                        </p>
                      </>
                    )}
                  </button>
                )}
              </div>

              {/* Submit */}
              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full btn btn-primary py-3 rounded-xl shadow-lg shadow-primary-500/20"
                  disabled={loading}
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Sending Feedback…
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      <Send size={18} />
                      Submit Report
                    </span>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 dark:bg-slate-900/30 border-t border-slate-100 dark:border-slate-700">
          <p className="text-[10px] text-center text-slate-400 dark:text-slate-500 uppercase tracking-widest font-bold">
            Commission Decision App v1.0
          </p>
        </div>
      </div>
    </>
  )
}
