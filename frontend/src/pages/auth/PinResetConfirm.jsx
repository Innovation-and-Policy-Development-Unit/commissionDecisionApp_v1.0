/**
 * Session PIN Reset Confirmation page
 *
 * Route: /auth/forgot-pin/confirm?token=<token>
 *
 * Reached by clicking the PIN reset link logged to the Django console in
 * dev (or emailed in production). Validates the token and sets a new
 * session PIN via POST /auth/pin-reset/confirm/. Does not touch the
 * account password.
 */

import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ShieldCheck, ArrowRight, CheckCircle2 } from 'lucide-react'
import api from '../../api/client'

export default function PinResetConfirm() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''

  const [pin,        setPin]        = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState('')
  const [done,       setDone]       = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (pin.length < 4) {
      setError('PIN must be at least 4 digits.')
      return
    }
    if (pin !== confirmPin) {
      setError('PINs do not match.')
      return
    }
    if (!token) {
      setError('Reset token is missing. Please use the link from your email.')
      return
    }
    setError('')
    setLoading(true)
    try {
      await api.post('/auth/pin-reset/confirm/', { token, pin })
      setDone(true)
    } catch (err) {
      const data = err.response?.data
      let msg = 'Failed to reset PIN. The link may have expired.'
      if (typeof data?.detail === 'string') {
        msg = data.detail
      } else if (data?.pin) {
        const p = data.pin
        msg = Array.isArray(p) ? p.join(' ') : String(p)
      } else if (data?.token) {
        const tk = data.token
        msg = Array.isArray(tk) ? tk.join(' ') : String(tk)
      }
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-10"
      style={{ background: 'linear-gradient(145deg, #f0f4f9 0%, #e5eaf3 100%)' }}
    >
      <div style={{ maxWidth: 420 }} className="w-full">
        <div
          className="anim-slide-up"
          style={{
            background: 'white',
            borderRadius: 20,
            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05), 0 20px 60px -10px rgba(0,66,118,0.13)',
            border: '1px solid rgba(0,66,118,0.08)',
            padding: '36px 32px',
          }}
        >
          {!done ? (
            <>
              <div className="flex justify-center mb-5">
                <div
                  className="bg-gradient-dark"
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <ShieldCheck size={28} color="white" />
                </div>
              </div>

              <h1 className="text-xl font-bold text-center text-slate-900 mb-1">Set a New Session PIN</h1>
              <p className="text-sm text-center text-slate-500 mb-7">
                Choose a 4–6 digit PIN. It's used to unlock your session after a period of
                inactivity and for quick sign-in on this device — your password stays private.
              </p>

              {!token && (
                <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  No reset token found. Please use the full link from your reset email.
                </div>
              )}

              {error && (
                <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2 text-center">
                    New PIN (4–6 digits)
                  </label>
                  <input
                    type="password"
                    className="input text-center text-2xl font-mono"
                    style={{ borderRadius: 10, letterSpacing: '0.4em' }}
                    maxLength={6}
                    placeholder="••••••"
                    value={pin}
                    onChange={e => { setPin(e.target.value.replace(/\D/g, '').slice(0, 6)); setError('') }}
                    required
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2 text-center">
                    Confirm PIN
                  </label>
                  <input
                    type="password"
                    className="input text-center text-2xl font-mono"
                    style={{ borderRadius: 10, letterSpacing: '0.4em' }}
                    maxLength={6}
                    placeholder="••••••"
                    value={confirmPin}
                    onChange={e => { setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 6)); setError('') }}
                    required
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-3 text-sm font-semibold text-white flex items-center justify-center gap-2 transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed bg-gradient-dark"
                  style={{
                    borderRadius: 10,
                    boxShadow: '0 4px 14px rgba(12,36,81,0.3)',
                  }}
                  disabled={loading || !token || pin.length < 4 || confirmPin.length < 4}
                >
                  {loading ? 'Saving…' : <>Set New PIN <ArrowRight size={16} /></>}
                </button>
              </form>
            </>
          ) : (
            <>
              <div className="flex justify-center mb-5">
                <div style={{ width: 64, height: 64, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#ecfdf5' }}>
                  <CheckCircle2 size={28} className="text-emerald-500" />
                </div>
              </div>
              <h1 className="text-xl font-bold text-center text-slate-900 mb-1">PIN Updated</h1>
              <p className="text-sm text-center text-slate-500 mb-7">
                Your session PIN has been changed successfully. Sign in with your password to continue.
              </p>
              <Link
                to="/auth/login"
                className="btn-gradient w-full py-3 text-sm justify-center"
              >
                Sign In <ArrowRight size={16} />
              </Link>
            </>
          )}
        </div>

        <div className="mt-6 flex items-center justify-center text-[11px] text-slate-400 anim-fade-in">
          <span>© {new Date().getFullYear()} OPSC Vanuatu. All rights reserved.</span>
        </div>
      </div>

      <style>{`
        @keyframes slide-up {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes fade-in {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        .anim-slide-up { animation: slide-up 0.5s cubic-bezier(.22,1,.36,1) both; }
        .anim-fade-in  { animation: fade-in 0.6s ease both; }
      `}</style>
    </div>
  )
}
