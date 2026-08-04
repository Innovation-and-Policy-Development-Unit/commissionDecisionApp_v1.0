import { useState } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { KeyRound, Clock, ArrowRight, ArrowLeft } from 'lucide-react'
import api from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import Logo from '../../components/shared/Logo'
import BaseButton from '../../components/shared/BaseButton'
import { setInactivityLockMinutes, DEFAULT_INACTIVITY_LOCK_MINUTES } from '../../utils/inactivityLock'

/** First-login step, shown once (after password change + 2FA setup) when the
 * user has no session PIN yet — sets their PIN and idle-lock preference
 * before entering the app. Both are editable later from Account settings. */
export default function SetupSecurity() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, refreshMe } = useAuth()

  const [pin, setPinValue] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [minutes, setMinutes] = useState(DEFAULT_INACTIVITY_LOCK_MINUTES)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const goToApp = () => {
    const from = location.state?.from?.pathname || '/'
    navigate(from, { replace: true })
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
      if (user?.username) {
        setInactivityLockMinutes(user.username, minutes)
      }
      await refreshMe()
      goToApp()
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to set PIN.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-900">
      <div className="flex items-center gap-3 px-10 py-5 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <Logo size={28} />
        <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">
          Submission &amp; Commission Decision Management System
        </span>
      </div>

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="p-8">
            <div className="flex justify-center mb-6">
              <div className="w-16 h-16 rounded-full bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center">
                <KeyRound size={32} className="text-primary-600 dark:text-primary-400" />
              </div>
            </div>

            <h1 className="text-2xl font-bold text-center text-slate-900 dark:text-slate-100 mb-2">
              Set your session PIN
            </h1>
            <p className="text-sm text-center text-slate-500 dark:text-slate-400 mb-8">
              Your PIN unlocks the screen after inactivity or a manual lock, without a full sign-in.
              You can change this later in Account settings.
            </p>

            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-2">
                    PIN (4–6 digits)
                  </label>
                  <input
                    type="password"
                    className="input text-center text-2xl font-mono w-full"
                    style={{ letterSpacing: '0.3em' }}
                    maxLength={6}
                    placeholder="••••••"
                    value={pin}
                    onChange={e => setPinValue(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    required
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-2">
                    Confirm PIN
                  </label>
                  <input
                    type="password"
                    className="input text-center text-2xl font-mono w-full"
                    style={{ letterSpacing: '0.3em' }}
                    maxLength={6}
                    placeholder="••••••"
                    value={confirmPin}
                    onChange={e => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    required
                  />
                </div>
              </div>

              <div>
                <label htmlFor="setup-inactivity-minutes" className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-2">
                  <Clock size={13} /> Lock screen after
                </label>
                <select
                  id="setup-inactivity-minutes"
                  className="input text-sm w-full"
                  value={minutes}
                  onChange={e => setMinutes(parseInt(e.target.value, 10))}
                >
                  <option value={5}>5 minutes</option>
                  <option value={10}>10 minutes</option>
                  <option value={15}>15 minutes (default)</option>
                  <option value={30}>30 minutes</option>
                  <option value={45}>45 minutes</option>
                  <option value={60}>60 minutes</option>
                  <option value={0}>Never (manual lock only)</option>
                </select>
              </div>

              <BaseButton
                type="submit"
                variant="primary"
                className="w-full !py-3"
                loading={loading}
                loadingLabel="Saving"
                disabled={pin.length < 4 || confirmPin.length < 4}
                icon={!loading ? <ArrowRight size={18} /> : undefined}
              >
                Save &amp; continue
              </BaseButton>
            </form>

            <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-700 text-center">
              <Link
                to="/auth/login"
                className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-primary-600 transition-colors"
              >
                <ArrowLeft size={16} /> Back to Sign In
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
