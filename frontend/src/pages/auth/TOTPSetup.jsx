import { useState, useEffect } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { ShieldCheck, ArrowLeft, ArrowRight, Copy, CheckCircle2 } from 'lucide-react'
import api from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import Logo from '../../components/shared/Logo'

export default function TOTPSetup() {
  const navigate = useNavigate()
  const location = useLocation()
  const { refreshMe, setTokens } = useAuth()

  const [loading, setLoading] = useState(false)
  const [setupData, setSetupData] = useState(null)
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  // Get credentials from sessionStorage if redirected from login
  const username = sessionStorage.getItem('psc_setup_username') || ''
  // For security, we might need the password again, but usually we just allow setup if they just logged in
  // In our backend implementation, we expect username/password if not authenticated.
  // This means the user might have to re-enter their password or we store it temporarily (risky).
  // Actually, let's assume they might need to re-enter password if we want to be super secure, 
  // but for now, we'll ask for it if not already authenticated.
  const [password, setPassword] = useState('')
  const [showPasswordInput, setShowPasswordInput] = useState(!api.defaults.headers.common['Authorization'])

  useEffect(() => {
    // If we have a username, try to initiate setup
    // We'll need the password though if not logged in.
    if (!showPasswordInput) {
      initiateSetup()
    }
  }, [showPasswordInput])

  const initiateSetup = async (e) => {
    if (e) e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const trimmedUsername = username.trim()
      const { data } = await api.post('/auth/totp/setup/', { 
        username: trimmedUsername, 
        password: password || undefined 
      })
      setSetupData(data)
      setShowPasswordInput(false)
    } catch (err) {
      console.error('TOTP Setup Error:', err)
      const detail = err.response?.data?.detail
      setError(typeof detail === 'string' ? detail : 'Failed to initiate 2FA setup. Please check your credentials.')
    } finally {
      setLoading(false)
    }
  }

  const handleVerify = async (e) => {
    e.preventDefault()
    if (code.length < 6) return
    setError('')
    setLoading(true)
    try {
      const trimmedUsername = username.trim()
      const { data } = await api.post('/auth/totp/verify-setup/', {
        username: trimmedUsername,
        password: password || undefined,
        code
      })
      
      if (data.access) {
        setTokens(data.access, data.refresh)
        await refreshMe()
        sessionStorage.removeItem('psc_setup_username')
        const from = location.state?.from?.pathname || '/'
        navigate(from, { replace: true })
      } else {
        // Already authenticated case
        navigate('/me', { replace: true })
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Invalid verification code.')
    } finally {
      setLoading(false)
    }
  }

  const copySecret = () => {
    navigator.clipboard.writeText(setupData.secret)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-900">
      {/* Top bar */}
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
                <ShieldCheck size={32} className="text-primary-600 dark:text-primary-400" />
              </div>
            </div>

            <h1 className="text-2xl font-bold text-center text-slate-900 dark:text-slate-100 mb-2">
              Setup Two-Factor Authentication
            </h1>
            <p className="text-sm text-center text-slate-500 dark:text-slate-400 mb-8">
              Protect your account with Microsoft Authenticator or any TOTP app.
            </p>

            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
                {error}
              </div>
            )}

            {showPasswordInput ? (
              <form onSubmit={initiateSetup} className="space-y-6">
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Please confirm your password for <span className="font-semibold text-slate-900 dark:text-slate-200">{username}</span> to start the setup.
                </p>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">Password</label>
                  <input
                    type="password"
                    className="input w-full"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    placeholder="Enter your password"
                    autoFocus
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading || !password}
                  className="btn-gradient w-full py-3 flex items-center justify-center gap-2"
                >
                  {loading ? 'Confirming…' : <>Continue <ArrowRight size={18} /></>}
                </button>
              </form>
            ) : setupData ? (
              <div className="space-y-8">
                <div className="space-y-4">
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                    1. Scan this QR code in your app:
                  </p>
                  <div className="flex justify-center bg-white p-4 rounded-xl border border-slate-100 mx-auto w-fit">
                    <img src={setupData.qr_code} alt="QR Code" className="w-48 h-48" />
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                    2. Or enter this secret key manually:
                  </p>
                  <div className="flex items-center gap-2 p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-700">
                    <code className="flex-1 text-sm font-mono text-primary-700 dark:text-primary-400 break-all">
                      {setupData.secret}
                    </code>
                    <button
                      onClick={copySecret}
                      className="p-2 text-slate-400 hover:text-primary-600 transition-colors"
                      title="Copy to clipboard"
                    >
                      {copied ? <CheckCircle2 size={18} className="text-emerald-500" /> : <Copy size={18} />}
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                    3. Enter the 6-digit code from your app:
                  </p>
                  <form onSubmit={handleVerify} className="space-y-6">
                    <input
                      type="text"
                      className="input w-full text-center text-3xl font-mono tracking-[0.3em]"
                      maxLength={6}
                      placeholder="000000"
                      value={code}
                      onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
                      required
                    />
                    <button
                      type="submit"
                      disabled={loading || code.length < 6}
                      className="btn-gradient w-full py-3 flex items-center justify-center gap-2"
                    >
                      {loading ? 'Verifying…' : <>Complete Setup <ShieldCheck size={18} /></>}
                    </button>
                  </form>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
                <p className="mt-4 text-sm text-slate-500">Initiating setup…</p>
              </div>
            )}

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
