import { useState } from 'react'
import { useLocation, useNavigate, Navigate } from 'react-router-dom'
import { ShieldCheck, ArrowRight } from 'lucide-react'
import api from '../../api/client'
import { useAuth } from '../../context/AuthContext'

/** Mandatory session-PIN setup — every user is routed here (by RequireAuth)
 * on first login and on any login where they haven't set one yet. The PIN
 * is what lets the inactivity-lock screen and trusted-device re-login work
 * without falling back to a full password re-entry. */
export default function SetPinPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { accessToken, user, authReady, refreshMe, logout } = useAuth()
  const [pin, setPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  if (!accessToken) {
    return <Navigate to="/auth/login" replace />
  }
  if (authReady && user?.session_pin_set) {
    const from = location.state?.from?.pathname || '/'
    return <Navigate to={from} replace />
  }

  const handleSubmit = async e => {
    e.preventDefault()
    setError('')
    if (pin.length < 4) {
      setError('PIN must be at least 4 digits.')
      return
    }
    if (pin !== confirmPin) {
      setError('PINs do not match.')
      return
    }
    setLoading(true)
    try {
      await api.post('/auth/session-pin/setup/', { pin })
      await refreshMe()
      const from = location.state?.from?.pathname || '/'
      navigate(from, { replace: true })
    } catch (err) {
      setError(err.response?.data?.detail || err.response?.data?.pin?.[0] || 'Failed to set PIN.')
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

          <h1 className="text-xl font-bold text-center text-slate-900 mb-1">Set Your Session PIN</h1>
          <p className="text-sm text-center text-slate-500 mb-7">
            A 4–6 digit PIN is required on this account. It's used to unlock your session after a
            period of inactivity and for quick sign-in on this device — your password stays private.
          </p>

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
                onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
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
                onChange={e => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
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
              disabled={loading || pin.length < 4 || confirmPin.length < 4}
            >
              {loading ? 'Saving…' : <>Save PIN <ArrowRight size={16} /></>}
            </button>
            <div className="text-center">
              <button
                type="button"
                onClick={() => logout('manual')}
                className="text-xs text-slate-400 hover:text-primary-600 underline"
              >
                Log out instead
              </button>
            </div>
          </form>
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
