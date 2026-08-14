import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, Link, Navigate, useLocation } from 'react-router-dom'
import { ArrowRight, ShieldCheck, Lock } from 'lucide-react'
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
  .anim-slide-up { animation: slide-up 0.5s cubic-bezier(.22,1,.36,1) both; }
  .anim-fade-in  { animation: fade-in 0.6s ease both; }
`

function redirectTarget(location) {
  const from = location.state?.from
  return from?.pathname != null
    ? `${from.pathname}${from.search || ''}${from.hash || ''}`
    : '/'
}

function policyHintLines(policy) {
  if (!policy) return []
  const lines = [`At least ${policy.min_length} characters`]
  if (policy.require_uppercase) lines.push('One uppercase letter (A–Z)')
  if (policy.require_lowercase) lines.push('One lowercase letter (a–z)')
  if (policy.require_digits) lines.push('One digit (0–9)')
  if (policy.require_special) lines.push('One special character (!@#$% …)')
  return lines
}

export default function Login() {
  const navigate  = useNavigate()
  const location  = useLocation()
  const { login, accessToken, user, authReady, refreshMe, setTokens } = useAuth()

  const [username,         setUsername]         = useState('')
  const [password,         setPassword]         = useState('')
  const [error,            setError]            = useState('')
  const [loading,          setLoading]          = useState(false)
  const [show2FA,          setShow2FA]          = useState(false)
  const [otp,              setOtp]              = useState('')
  const [showPasswordChange, setShowPasswordChange] = useState(false)
  const [newPassword,      setNewPassword]      = useState('')
  const [confirmPassword,  setConfirmPassword]  = useState('')
  const [passwordPolicy,   setPasswordPolicy]   = useState(null)
  const [currentPassword,  setCurrentPassword]  = useState('')
  const loginPasswordRef = useRef('')
  const needsCurrentPassword = showPasswordChange && !loginPasswordRef.current

  useEffect(() => {
    if (showPasswordChange) {
      api.get('/auth/password-policy/').then(r => setPasswordPolicy(r.data)).catch(() => {})
    }
  }, [showPasswordChange])

  useEffect(() => {
    if (accessToken && user && authReady && user.must_change_password) {
      setShowPasswordChange(true)
    }
  }, [accessToken, user, authReady])

  const policyLines = useMemo(() => policyHintLines(passwordPolicy), [passwordPolicy])
  const minPasswordLength = passwordPolicy?.min_length ?? 8

  const goToApp = () => {
    navigate(redirectTarget(location), { replace: true })
  }

  if (accessToken && !authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#f0f4f8' }}>
        <p className="text-sm text-slate-500">Loading session…</p>
      </div>
    )
  }

  if (accessToken && user && authReady && !user.must_change_password && !showPasswordChange) {
    return <Navigate to={redirectTarget(location)} replace />
  }

  const applyLoginResponse = data => {
    if (data?.two_factor_required) {
      if (data.setup_required) {
        sessionStorage.setItem('psc_setup_username', username)
        navigate('/auth/totp-setup', { state: { from: location.state?.from } })
      } else {
        setShow2FA(true)
      }
    } else if (data?.must_change_password) {
      setShowPasswordChange(true)
    }
    // Otherwise redirect via <Navigate> when accessToken, user, and authReady are set.
  }

  const handleSubmit = async e => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      loginPasswordRef.current = password
      const data = await login(username.trim(), password)
      applyLoginResponse(data)
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
      const { data } = await api.post('/auth/totp/verify/', { username, code: otp })
      setTokens(data.access, data.refresh)
      const me = await refreshMe()
      if (me?.must_change_password) {
        setShowPasswordChange(true)
        return
      }
      goToApp()
    } catch (err) {
      setError(err.response?.data?.detail || 'Invalid verification code.')
    } finally {
      setLoading(false)
    }
  }

  const handleChangePassword = async e => {
    e.preventDefault()
    setError('')
    if (newPassword.length < minPasswordLength) {
      setError(`New password must be at least ${minPasswordLength} characters.`)
      return
    }
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.')
      return
    }
    const oldPassword = loginPasswordRef.current || currentPassword
    if (!oldPassword) {
      setError('Enter your current (temporary) password.')
      return
    }
    setLoading(true)
    try {
      const wasPreAuth = !accessToken
      await api.post('/me/change-password/', {
        username,
        old_password: oldPassword,
        new_password: newPassword,
        confirm_password: confirmPassword,
      })
      loginPasswordRef.current = ''
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setShowPasswordChange(false)

      if (wasPreAuth) {
        // No JWT existed yet (forced change during initial login) — re-run
        // login with the new password so the normal flow (2FA setup, etc.)
        // continues from where it left off.
        const data = await login(username.trim(), newPassword)
        applyLoginResponse(data)
        return
      }

      const me = await refreshMe()
      if (me?.must_change_password) {
        setError('Password was not accepted. Please try a different password.')
        setShowPasswordChange(true)
        return
      }
      goToApp()
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to change password.')
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
            {showPasswordChange ? (
              <>
                <div className="flex justify-center mb-5">
                  <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'linear-gradient(135deg, #0c2451, #1a4080)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Lock size={26} color="white" />
                  </div>
                </div>
                <h1 className="text-xl font-bold text-center text-slate-900 mb-1">Set your password</h1>
                <p className="text-sm text-center text-slate-500 mb-6">
                  Password change is required on first login. Choose a new password to continue.
                </p>

                {error && (
                  <BaseMessageBar intent="error" className="mb-4">
                    {error}
                  </BaseMessageBar>
                )}

                <form onSubmit={handleChangePassword} className="space-y-4">
                  {needsCurrentPassword && (
                    <BasePasswordInput
                      label="Current password"
                      value={currentPassword}
                      onChange={e => setCurrentPassword(e.target.value)}
                      placeholder="Temporary password from your administrator"
                      required
                      autoFocus
                    />
                  )}
                  <BasePasswordInput
                    label="New password"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                    required
                    autoFocus={!needsCurrentPassword}
                  />
                  <BasePasswordInput
                    label="Confirm new password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                    required
                  />
                  {policyLines.length > 0 && (
                    <ul className="text-xs text-slate-500 space-y-1 list-disc pl-4">
                      {policyLines.map(line => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                  )}
                  <BaseButton
                    type="submit"
                    variant="primary"
                    className="w-full !py-3"
                    loading={loading}
                    loadingLabel="Updating password"
                    icon={!loading ? <ArrowRight size={16} /> : undefined}
                  >
                    Update password &amp; continue
                  </BaseButton>
                </form>
              </>
            ) : !show2FA ? (
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
            ) : (
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
                  <BaseMessageBar intent="error" className="mb-4">
                    {error}
                  </BaseMessageBar>
                )}

                <p className="text-sm text-center text-slate-500 mb-7">
                  Enter the 6-digit code from your authenticator app.
                </p>
                <form onSubmit={handleVerifyOTP} className="space-y-5">
                  <BaseInput
                    label="Verification Code"
                    type="text"
                    maxLength={6}
                    placeholder="——————"
                    value={otp}
                    onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                    required
                    autoFocus
                    input={{ className: 'text-center text-3xl font-mono', style: { letterSpacing: '0.4em' } }}
                  />
                  <BaseButton
                    type="submit"
                    variant="primary"
                    className="w-full !py-3"
                    loading={loading}
                    loadingLabel="Verifying"
                    disabled={otp.length < 6}
                  >
                    Verify &amp; Continue
                  </BaseButton>

                  <div className="text-center mt-4">
                    <BaseButton type="button" variant="ghost" size="sm"
                      onClick={() => { setShow2FA(false); setOtp(''); setError('') }}>
                      Back to sign in
                    </BaseButton>
                  </div>
                </form>
              </>
            )}
          </div>

          <div className="mt-4 flex items-center justify-center text-xs anim-fade-in" style={{ animationDelay: '0.15s' }}>
            <Link to="/track" className="text-primary-600 hover:text-primary-700 hover:underline font-medium">
              Track your submission
            </Link>
          </div>

          <div className="mt-3 flex items-center justify-center text-[11px] text-slate-400 anim-fade-in" style={{ animationDelay: '0.2s' }}>
            <span>© {new Date().getFullYear()} OPSC Vanuatu. All rights reserved.</span>
          </div>
        </div>
      </div>
    </>
  )
}