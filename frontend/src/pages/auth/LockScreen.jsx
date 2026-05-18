import { useState, useEffect } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { Lock, KeyRound, ArrowRight } from 'lucide-react'
import api from '../../api/client'
import { useAuth } from '../../context/AuthContext'

export default function LockScreen() {
  const navigate = useNavigate()
  const { setTokens, refreshMe, accessToken, user, authReady } = useAuth()
  const [username, setUsername] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const stored = sessionStorage.getItem('psc-lock-username')
    if (!stored) {
      navigate('/auth/login', { replace: true })
      return
    }
    setUsername(stored)
  }, [navigate])

  if (accessToken && user && authReady) {
    sessionStorage.removeItem('psc-lock-username')
    const from = sessionStorage.getItem('psc-lock-from') || '/'
    sessionStorage.removeItem('psc-lock-from')
    return <Navigate to={from} replace />
  }

  const handleSubmit = async e => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { data } = await api.post('/auth/session-pin/verify/', { username, pin })
      setTokens(data.access, data.refresh)
      await refreshMe()
      sessionStorage.removeItem('psc-lock-username')
      const from = sessionStorage.getItem('psc-lock-from') || '/'
      sessionStorage.removeItem('psc-lock-from')
      navigate(from, { replace: true })
    } catch (err) {
      setError(err.response?.data?.detail || 'Invalid PIN or session expired.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-10"
      style={{ background: 'linear-gradient(145deg, #f0f4f9 0%, #e5eaf3 100%)' }}
    >
      <div style={{ maxWidth: 400 }} className="w-full">
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
              style={{
                width: 64,
                height: 64,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #0c2451, #1a4080)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Lock size={28} color="white" />
            </div>
          </div>

          <h1 className="text-xl font-bold text-center text-slate-900 mb-1">Session Locked</h1>
          <p className="text-sm text-center text-slate-500 mb-2">
            Your session has been locked. Enter your PIN to resume.
          </p>
          <p className="text-xs text-center text-slate-400 mb-7">
            Signed in as <strong className="text-slate-700">{username}</strong>
          </p>

          {error && (
            <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2 text-center">
                Session PIN (4–6 digits)
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
            <button
              type="submit"
              className="w-full py-3 text-sm font-semibold text-white flex items-center justify-center gap-2 transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
              style={{
                background: 'linear-gradient(135deg, #0c2451 0%, #1a4080 100%)',
                borderRadius: 10,
                boxShadow: '0 4px 14px rgba(12,36,81,0.3)',
              }}
              disabled={loading || pin.length < 4}
            >
              {loading ? (
                <>
                  <svg className="animate-spin" width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                    <circle cx="12" cy="12" r="10" strokeOpacity={0.25} />
                    <path d="M12 2a10 10 0 0 1 10 10" />
                  </svg>
                  Unlocking…
                </>
              ) : (
                <>Unlock <ArrowRight size={16} /></>
              )}
            </button>
            <div className="text-center">
              <button
                type="button"
                onClick={() => {
                  sessionStorage.removeItem('psc-lock-username')
                  navigate('/auth/login', { replace: true })
                }}
                className="text-xs text-slate-400 hover:text-primary-600 underline"
              >
                Sign in as a different user
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
