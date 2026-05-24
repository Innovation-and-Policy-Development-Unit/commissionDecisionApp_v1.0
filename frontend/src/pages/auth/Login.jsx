import { useEffect, useState } from 'react'
import { useNavigate, Link, Navigate, useLocation } from 'react-router-dom'
import { ArrowRight, ShieldCheck, Lock, KeyRound, CheckCircle2 } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import api from '../../api/client'
import BaseButton from '../../components/shared/BaseButton'
import BaseInput from '../../components/shared/BaseInput'
import BasePasswordInput from '../../components/shared/BasePasswordInput'
import BaseMessageBar from '../../components/shared/BaseMessageBar'

const ANIM_STYLES = `
  @keyframes slide-up {
    from { opacity: 0; transform: translateY(20px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes fade-in {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  @keyframes pulse-ring {
    0%   { transform: scale(0.92); opacity: 0.6; }
    100% { transform: scale(1.18); opacity: 0; }
  }
  @keyframes phone-vibrate {
    0%, 100% { transform: rotate(0deg); }
    25% { transform: rotate(-4deg); }
    75% { transform: rotate(4deg); }
  }
  .anim-slide-up { animation: slide-up 0.5s cubic-bezier(.22,1,.36,1) both; }
  .anim-fade-in  { animation: fade-in 0.6s ease both; }
  .anim-vibrate  { animation: phone-vibrate 0.3s ease-in-out 3; }
`

export default function Login() {
  const navigate  = useNavigate()
  const location  = useLocation()
  const { login, accessToken, user, authReady, refreshMe, setTokens } = useAuth()

  const [username,         setUsername]         = useState('')
  const [password,         setPassword]         = useState('')
  const [error,            setError]            = useState('')
  const [loading,          setLoading]          = useState(false)
  const [show2FA,          setShow2FA]          = useState(false)
  const [showPIN,          setShowPIN]          = useState(false)
  const [otp,              setOtp]              = useState('')
  const [pin,              setPin]              = useState('')
  const [simPush,          setSimPush]          = useState(false)
  const [pushState,        setPushState]        = useState('idle') // idle, pending, approved

  if (accessToken && !authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#f0f4f8' }}>
        <p className="text-sm text-slate-500">Loading session…</p>
      </div>
    )
  }

  if (accessToken && user && authReady) {
    const from = location.state?.from
    const to   = from?.pathname != null
      ? `${from.pathname}${from.search || ''}${from.hash || ''}`
      : '/'
    return <Navigate to={to} replace />
  }

  const handleSubmit = async e => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const data = await login(username.trim(), password)
      if (data?.pin_required) {
        setShowPIN(true)
      } else if (data?.two_factor_required) {
        if (data.setup_required) {
          sessionStorage.setItem('psc_setup_username', username)
          navigate('/auth/totp-setup', { state: { from: location.state?.from } })
        } else {
          setShow2FA(true)
        }
      } else {
        const from = location.state?.from
        const to   = from?.pathname != null
          ? `${from.pathname}${from.search || ''}${from.hash || ''}`
          : '/'
        navigate(to, { replace: true })
      }
    } catch (err) {
      const detail = err.response?.data?.detail
      setError(typeof detail === 'string' ? detail : 'Sign-in failed. Please check your credentials.')
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyOTP = async (e) => {
    if (e) e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const payload = simPush ? { username, push_approved: true } : { username, code: otp }
      const { data } = await api.post('/auth/totp/verify/', payload)
      setTokens(data.access, data.refresh)
      await refreshMe()
      const from = location.state?.from
      const to = from?.pathname != null ? `${from.pathname}${from.search || ''}${from.hash || ''}` : '/'
      navigate(to, { replace: true })
    } catch (err) {
      setError(err.response?.data?.detail || 'Invalid verification code.')
      setPushState('idle')
    } finally {
      setLoading(false)
    }
  }

  const triggerPush = () => {
    setSimPush(true)
    setPushState('pending')
    // Auto-approve after 2 seconds for smooth demo
    setTimeout(() => {
      setPushState('approved')
      setTimeout(() => handleVerifyOTP(), 800)
    }, 2000)
  }

  const handleVerifyPIN = async e => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { data } = await api.post('/auth/session-pin/verify/', { username, pin })
      setTokens(data.access, data.refresh)
      await refreshMe()
      const from = location.state?.from
      const to = from?.pathname != null ? `${from.pathname}${from.search || ''}${from.hash || ''}` : '/'
      navigate(to, { replace: true })
    } catch (err) {
      setError(err.response?.data?.detail || 'Invalid PIN or session expired.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <style>{ANIM_STYLES}</style>

      <div
        className="min-h-screen flex flex-col items-center justify-center px-4 py-10"
        style={{ background: 'linear-gradient(145deg, #f0f4f9 0%, #e5eaf3 100%)' }}
      >
        <div className="pointer-events-none fixed inset-0 overflow-hidden">
          <div style={{ position: 'absolute', top: '-100px', right: '-100px', width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(0,66,118,0.07) 0%, transparent 70%)' }} />
          <div style={{ position: 'absolute', bottom: '-80px', left: '-80px',   width: 320, height: 320, borderRadius: '50%', background: 'radial-gradient(circle, rgba(245,158,11,0.07) 0%, transparent 70%)' }} />
        </div>

        <div className="relative z-10 w-full" style={{ maxWidth: 420 }}>

          <div className="flex items-center gap-3 mb-6 anim-fade-in" style={{ animationDelay: '0s' }}>
            <img
              src="/opsc-logo-white-transparent.png"
              alt="OPSC"
              style={{ width: 48, height: 'auto', filter: 'invert(1) brightness(0) saturate(100%) invert(18%) sepia(49%) saturate(700%) hue-rotate(190deg) brightness(80%)' }}
            />
            <div>
              <p className="text-sm font-semibold text-slate-800 leading-tight">Office of the Public Service Commission</p>
              <p className="text-xs text-slate-500 mt-0.5">Government of the Republic of Vanuatu</p>
            </div>
          </div>

          <div
            className="anim-slide-up"
            style={{
              background: 'white',
              borderRadius: 20,
              boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05), 0 20px 60px -10px rgba(0,66,118,0.13)',
              border: '1px solid rgba(0,66,118,0.08)',
              padding: '36px 32px',
              animationDelay: '0.08s',
            }}
          >
            {!show2FA && !showPIN ? (
              <>
                <div className="mb-7">
                  <h1 className="text-2xl font-bold text-slate-900 mb-1 tracking-tight">PSC Submission Portal</h1>
                  <p className="text-sm text-slate-500">Sign in to your SCDMS account to continue.</p>
                </div>

                {error && (
                  <BaseMessageBar intent="error" className="mb-2">
                    {error}
                  </BaseMessageBar>
                )}

                <form onSubmit={handleSubmit} className="space-y-5">
                  <BaseInput
                    label="Username"
                    type="text"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    placeholder="Enter your username"
                    required
                    autoFocus
                  />

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
                        Password
                      </span>
                      <Link
                        to="/auth/reset-password"
                        className="text-xs text-primary-600 hover:text-primary-700 hover:underline font-medium"
                      >
                        Forgot password?
                      </Link>
                    </div>
                    <BasePasswordInput
                      hideLabel
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      required
                    />
                  </div>

                  <BaseButton
                    type="submit"
                    variant="primary"
                    className="w-full !py-3"
                    loading={loading}
                    loadingLabel="Signing in"
                    icon={!loading ? <ArrowRight size={16} /> : undefined}
                  >
                    Sign In
                  </BaseButton>
                </form>

                <div className="mt-6 pt-5 border-t border-slate-100 flex items-center justify-center gap-1.5">
                  <Lock size={12} className="text-slate-400" />
                  <span className="text-[11px] text-slate-400">Secured with 256-bit TLS encryption</span>
                </div>
              </>
            ) : show2FA ? (
              /* ── 2FA (TOTP) step ── */
              <>
                <div className="flex justify-center mb-5">
                  <div className="relative">
                    <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'linear-gradient(135deg, #0c2451, #1a4080)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <ShieldCheck size={26} color="white" />
                    </div>
                  </div>
                </div>
                <h1 className="text-xl font-bold text-center text-slate-900 mb-1">Two-Factor Authentication</h1>

                {error && (
                  <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
                )}

                {pushState === 'idle' ? (
                  <>
                    <p className="text-sm text-center text-slate-500 mb-7">
                      Enter the 6-digit code from your authenticator app.
                    </p>
                    <form onSubmit={handleVerifyOTP} className="space-y-5">
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2 text-center">
                          Verification Code
                        </label>
                        <input
                          type="text"
                          className="input text-center text-3xl font-mono"
                          style={{ borderRadius: 10, letterSpacing: '0.55em' }}
                          maxLength={6}
                          placeholder="——————"
                          value={otp}
                          onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                          required
                          autoFocus
                        />
                      </div>
                      <button
                        type="submit"
                        className="w-full py-3 text-sm font-semibold text-white flex items-center justify-center gap-2 transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
                        style={{ background: 'linear-gradient(135deg, #0c2451 0%, #1a4080 100%)', borderRadius: 10, boxShadow: '0 4px 14px rgba(12,36,81,0.3)' }}
                        disabled={loading || otp.length < 6}
                      >
                        {loading ? 'Verifying…' : 'Verify & Continue'}
                      </button>

                      <div className="relative flex items-center gap-4 my-6">
                        <div className="flex-1 h-px bg-slate-100" />
                        <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">or</span>
                        <div className="flex-1 h-px bg-slate-100" />
                      </div>

                      <button
                        type="button"
                        onClick={triggerPush}
                        className="w-full py-3 text-sm font-bold text-slate-700 bg-slate-50 border border-slate-200 hover:bg-slate-100 rounded-xl transition-all flex items-center justify-center gap-2"
                      >
                        <img src="/favicon.svg" alt="" className="w-4 h-4 opacity-50" />
                        Send Push Notification
                      </button>

                      <div className="text-center mt-4">
                        <button type="button" onClick={() => { setShow2FA(false); setOtp(''); setError('') }}
                          className="text-xs text-slate-400 hover:text-primary-600 underline">
                          Back to sign in
                        </button>
                      </div>
                    </form>
                  </>
                ) : (
                  <div className="py-8 text-center flex flex-col items-center">
                    <div className="relative mb-8">
                      {/* Pulse rings */}
                      <div className="absolute inset-0 rounded-3xl bg-primary-100 opacity-20" style={{ animation: 'pulse-ring 2s infinite' }} />
                      <div className="absolute inset-0 rounded-3xl bg-primary-100 opacity-20" style={{ animation: 'pulse-ring 2s infinite 0.5s' }} />

                      {/* Phone container */}
                      <div className={`relative bg-white border-4 border-slate-900 rounded-3xl p-3 w-40 h-64 shadow-2xl transition-transform ${pushState === 'pending' ? 'anim-vibrate' : ''}`}>
                        <div className="w-12 h-1 bg-slate-900 rounded-full mx-auto mb-4" />
                        <div className="flex flex-col items-center justify-center h-full gap-4">
                          <img src="/favicon.svg" alt="Auth" className="w-10 h-10" />
                          <div className="text-center">
                            <p className="text-[10px] font-black text-slate-900 uppercase">Microsoft Authenticator</p>
                            <p className="text-[8px] text-slate-400">Request from SCDMS</p>
                          </div>

                          {pushState === 'pending' ? (
                            <div className="mt-4 w-full flex flex-col gap-2">
                              <div className="w-full h-8 bg-emerald-500 rounded-lg flex items-center justify-center text-[10px] font-bold text-white shadow-lg">Approve</div>
                              <div className="w-full h-8 bg-slate-100 rounded-lg flex items-center justify-center text-[10px] font-bold text-slate-400">Deny</div>
                            </div>
                          ) : (
                            <div className="mt-4 flex flex-col items-center gap-2">
                              <CheckCircle2 size={32} className="text-emerald-500 anim-fade-in" />
                              <p className="text-[10px] font-bold text-emerald-600">Approved</p>
                            </div>
                          )}
                        </div>
                        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-8 h-1 bg-slate-900 rounded-full" />
                      </div>
                    </div>
                    <p className="text-sm font-medium text-slate-700">
                      {pushState === 'pending' ? 'Sending push notification to your phone…' : 'Push notification approved!'}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">Open Authenticator app to approve the request.</p>
                  </div>
                )}
              </>
            ) : (
              /* ── Session PIN step ── */
              <>
                <div className="flex justify-center mb-5">
                  <div className="relative">
                    <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'linear-gradient(135deg, #0c2451, #1a4080)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <KeyRound size={26} color="white" />
                    </div>
                  </div>
                </div>
                <h1 className="text-xl font-bold text-center text-slate-900 mb-1">Session PIN</h1>
                <p className="text-sm text-center text-slate-500 mb-7">
                  Enter your session PIN to re-authenticate. Your trusted session is valid until 5pm or 8 hours from your last full login.
                </p>

                {error && (
                  <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
                )}

                <form onSubmit={handleVerifyPIN} className="space-y-5">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2 text-center">
                      PIN (4–6 digits)
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
                    style={{ background: 'linear-gradient(135deg, #0c2451 0%, #1a4080 100%)', borderRadius: 10, boxShadow: '0 4px 14px rgba(12,36,81,0.3)' }}
                    disabled={loading || pin.length < 4}
                  >
                    {loading ? 'Verifying…' : 'Verify PIN & Continue'}
                  </button>
                  <div className="text-center">
                    <button type="button" onClick={() => { setShowPIN(false); setPin(''); setError('') }}
                      className="text-xs text-slate-400 hover:text-primary-600 underline">
                      Back to sign in
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>

          <div className="mt-6 flex items-center justify-between text-[11px] text-slate-400 anim-fade-in" style={{ animationDelay: '0.2s' }}>
            <span>© {new Date().getFullYear()} OPSC Vanuatu. All rights reserved.</span>
            <span>Powered by Django</span>
          </div>
        </div>
      </div>
    </>
  )
}