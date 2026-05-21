import { useState, useCallback, useEffect, useRef } from 'react'
import { useAuth } from '../../context/AuthContext'
import { X, Lock } from 'lucide-react'

export default function LockOverlay() {
  const { isLocked, unlock, setPin, user, logout } = useAuth()
  const [pin, setPinLocal] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const inputRef = useRef(null)

  const handleSubmit = useCallback(async e => {
    e.preventDefault()
    if (pin.length < 4) return
    setLoading(true)
    setError('')
    const result = await unlock(pin)
    if (!result.ok) {
      setError(result.detail || 'Invalid PIN.')
      setPinLocal('')
      if (inputRef.current) inputRef.current.focus()
    }
    setLoading(false)
  }, [pin, unlock])

  useEffect(() => {
    if (!isLocked) return
    setPinLocal('')
    setError('')
    const timer = setTimeout(() => {
      if (inputRef.current) inputRef.current.focus()
    }, 100)
    return () => clearTimeout(timer)
  }, [isLocked])

  if (!isLocked) return null

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-md mx-4">
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Lock size={18} className="text-primary-600" />
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Session Locked
              </h2>
            </div>
            <button
              type="button"
              onClick={() => {
                logout()
              }}
              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400"
              title="Sign in as different user"
            >
              <X size={18} />
            </button>
          </div>

          <div className="p-6">
            <p className="text-sm text-slate-500 mb-1">
              {user?.session_pin_set
                ? 'Your session was locked. Enter your session PIN to continue working.'
                : 'Your session was locked. Set a session PIN in Account Settings, or sign out and sign in again.'}
            </p>
            {user && (
              <p className="text-xs text-slate-400 mb-4">
                Signed in as <strong className="text-slate-600 dark:text-slate-300">{user.username}</strong>
              </p>
            )}

            {error && (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-200">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2 text-center">
                  Session PIN (4–6 digits)
                </label>
                <input
                  ref={inputRef}
                  type="password"
                  className="input text-center text-2xl font-mono w-full"
                  style={{ borderRadius: 10, letterSpacing: '0.4em' }}
                  maxLength={6}
                  placeholder="••••••"
                  value={pin}
                  onChange={e => {
                    const v = e.target.value.replace(/\D/g, '').slice(0, 6)
                    setPinLocal(v)
                    setPin(v)
                  }}
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
                disabled={loading || pin.length < 4 || !user?.session_pin_set}
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
                  <>Unlock</>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}