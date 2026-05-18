import { useState, useEffect, useRef } from 'react'
import { Lock, ArrowRight, Loader2, X, ShieldAlert } from 'lucide-react'
import api from '../../api/client'

/**
 * Inline PIN confirmation overlay.
 * Props:
 *   title      – heading text (default "Confirm Identity")
 *   message    – subtext shown above the input
 *   onVerified – called when PIN is correct
 *   onCancel   – called when user dismisses
 */
export default function LockPopover({ title = 'Confirm Identity', message, onVerified, onCancel }) {
  const [pin,     setPin]     = useState('')
  const [error,   setError]   = useState('')
  const [loading, setLoading] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => {
    // Small delay so the modal has rendered before we focus
    const t = setTimeout(() => inputRef.current?.focus(), 80)
    return () => clearTimeout(t)
  }, [])

  const handleSubmit = async e => {
    e.preventDefault()
    if (pin.length < 4) return
    setError('')
    setLoading(true)
    try {
      await api.post('/auth/verify-pin/', { pin })
      onVerified()
    } catch (err) {
      const detail = err.response?.data?.detail || 'Verification failed.'
      setError(detail)
      setPin('')
      inputRef.current?.focus()
    } finally {
      setLoading(false)
    }
  }

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(3px)' }}
      onClick={e => { if (e.target === e.currentTarget) onCancel() }}
    >
      <div className="relative w-full max-w-sm mx-4 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">

        {/* Top accent bar */}
        <div className="h-1 bg-gradient-to-r from-primary-600 to-indigo-500" />

        <div className="p-6">
          {/* Close */}
          <button
            onClick={onCancel}
            className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          >
            <X size={15} />
          </button>

          {/* Icon + heading */}
          <div className="flex flex-col items-center mb-5">
            <div className="w-12 h-12 rounded-2xl bg-primary-50 dark:bg-primary-900/30 flex items-center justify-center mb-3">
              <Lock size={22} className="text-primary-600 dark:text-primary-400" />
            </div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">{title}</h2>
            {message && (
              <p className="mt-1 text-xs text-center text-slate-500 dark:text-slate-400 max-w-[260px]">{message}</p>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 dark:border-red-900/40 dark:bg-red-900/20 px-3 py-2.5 text-xs text-red-700 dark:text-red-300">
              <ShieldAlert size={13} className="mt-0.5 shrink-0" />
              {error.includes('No Session PIN') ? (
                <span>{error} Go to <strong>Account Settings → Session PIN</strong>.</span>
              ) : error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 text-center">
                Session PIN (4–6 digits)
              </label>
              <input
                ref={inputRef}
                type="password"
                inputMode="numeric"
                className="input text-center text-xl font-mono tracking-[0.4em]"
                maxLength={6}
                placeholder="••••••"
                value={pin}
                onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                autoComplete="off"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading || pin.length < 4}
              className="w-full btn-gradient py-2.5 flex items-center justify-center gap-2 text-sm font-semibold disabled:opacity-50"
            >
              {loading ? (
                <><Loader2 size={15} className="animate-spin" /> Verifying…</>
              ) : (
                <>Confirm <ArrowRight size={15} /></>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
