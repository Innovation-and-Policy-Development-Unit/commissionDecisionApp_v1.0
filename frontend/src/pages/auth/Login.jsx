import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, Link, Navigate, useLocation } from 'react-router-dom'
import { ArrowRight, ShieldCheck, Lock, Mail, LockKeyhole } from 'lucide-react'
import AppLoadingSkeleton from '../../components/shared/AppLoadingSkeleton'
import { useAuth } from '../../context/AuthContext'
import api from '../../api/client'
import BaseButton from '../../components/shared/BaseButton'
import BaseInput from '../../components/shared/BaseInput'
import BasePasswordInput from '../../components/shared/BasePasswordInput'
import BaseMessageBar from '../../components/shared/BaseMessageBar'
import { setLockState } from '../../utils/inactivityLock'

const ANIM_STYLES = `
  @keyframes slide-up {
    from { opacity: 0; transform: translateY(20px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes fade-in {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  @keyframes blob-drift {
    0%   { transform: translate(0, 0) scale(1); }
    33%  { transform: translate(20px, -15px) scale(1.05); }
    66%  { transform: translate(-15px, 10px) scale(0.95); }
    100% { transform: translate(0, 0) scale(1); }
  }
  .anim-slide-up   { animation: slide-up 0.5s cubic-bezier(.22,1,.36,1) both; }
  .anim-fade-in    { animation: fade-in 0.6s ease both; }
  .anim-blob-drift { animation: blob-drift 18s ease-in-out infinite; }
  @media (prefers-reduced-motion: reduce) {
    .anim-slide-up, .anim-fade-in, .anim-blob-drift { animation: none; }
  }
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
  const [capsLock,         setCapsLock]         = useState(false)
  const [shaking,          setShaking]          = useState(false)
  // Set the moment a sign-in is fully verified: shows the success state, then lets the card leave.
  const [celebrating,      setCelebrating]      = useState(false)
  const [leaving,          setLeaving]          = useState(false)
  const [welcomeName,      setWelcomeName]      = useState('')
  const [show2FA,          setShow2FA]          = useState(false)
  const [otp,              setOtp]              = useState('')
  const [showEmailOtp,     setShowEmailOtp]     = useState(false)
  const [emailOtp,         setEmailOtp]         = useState('')
  const [emailHint,        setEmailHint]        = useState('')
  const [notice,           setNotice]           = useState('')
  const [resendIn,         setResendIn]         = useState(0) // seconds until another code may be requested
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

  // Count down until another code may be requested (the server enforces the same wait).
  useEffect(() => {
    if (resendIn <= 0) return undefined
    const timer = setTimeout(() => setResendIn(n => n - 1), 1000)
    return () => clearTimeout(timer)
  }, [resendIn])

  const policyLines = useMemo(() => policyHintLines(passwordPolicy), [passwordPolicy])
  const minPasswordLength = passwordPolicy?.min_length ?? 8

  const goToApp = () => {
    navigate(redirectTarget(location), { replace: true })
  }

  const shake = () => {
    setCelebrating(false) // a failed attempt always leaves the success state
    setShaking(true)
    setTimeout(() => setShaking(false), 420)
  }

  // Green check + "Welcome back", then the card lifts away and we go to the app.
  // With reduced motion the pause is shorter and nothing moves.
  const finishSignIn = me => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const first = me?.first_name || me?.full_name?.split(' ')[0] || me?.username || ''
    setWelcomeName(first)
    setCelebrating(true)
    setTimeout(() => setLeaving(true), reduce ? 500 : 850)
    setTimeout(goToApp, reduce ? 600 : 1150)
  }

  if (accessToken && !authReady) {
    return <AppLoadingSkeleton />
  }

  if (accessToken && user && authReady && !user.must_change_password && !showPasswordChange && !celebrating) {
    return <Navigate to={redirectTarget(location)} replace />
  }

  const applyLoginResponse = data => {
    // They may have typed their email address: from here on use the account's real username.
    if (data?.username) setUsername(data.username)
    if (data?.email_otp_required) {
      setResendIn(data.resend_after_seconds ?? 60)
      setEmailHint(data.email_hint || '')
      setEmailOtp('')
      setShowEmailOtp(true)
    } else if (data?.two_factor_required) {
      if (data.setup_required) {
        sessionStorage.setItem('psc_setup_username', username)
        navigate('/auth/totp-setup', { state: { from: location.state?.from } })
      } else {
        setShow2FA(true)
      }
    } else if (data?.pin_required) {
      // Trusted device/session on this account — the backend skips issuing
      // tokens and asks for just the PIN instead of the full password again.
      setLockState(data.username || username)
      navigate('/auth/lock', { state: { from: location.state?.from } })
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
      shake()
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
      setCelebrating(true)
      setTokens()
      const me = await refreshMe()
      if (me?.must_change_password) {
        setCelebrating(false)
        setShowPasswordChange(true)
        return
      }
      finishSignIn(me)
    } catch (err) {
      setError(err.response?.data?.detail || 'Invalid verification code.')
      shake()
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyEmailOtp = async e => {
    if (e) e.preventDefault()
    setError('')
    setNotice('')
    setLoading(true)
    try {
      const { data } = await api.post('/auth/email-otp/verify/', { username: username.trim(), code: emailOtp })
      setCelebrating(true)
      setTokens()
      const me = await refreshMe()
      if (me?.must_change_password) {
        setCelebrating(false)
        setShowPasswordChange(true)
        return
      }
      // A user with no session PIN yet is routed to /auth/set-pin by RequireAuth.
      finishSignIn(me)
    } catch (err) {
      setError(err.response?.data?.detail || 'Invalid verification code.')
      shake()
    } finally {
      setLoading(false)
    }
  }

  const handleResendEmailOtp = async () => {
    setError('')
    setNotice('')
    setLoading(true)
    try {
      // Re-running the password step is what issues a fresh code; the server
      // ignores it if one was sent within the last few seconds.
      const data = await login(username.trim(), loginPasswordRef.current)
      setEmailOtp('')
      setResendIn(data?.resend_after_seconds ?? 60)
      setNotice('A new code is on its way. Codes already sent to you still work for 10 minutes — use whichever arrives first.')
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not resend the code.')
    } finally {
      setLoading(false)
    }
  }

  const backToSignIn = () => {
    setShowEmailOtp(false)
    setEmailOtp('')
    setError('')
    setNotice('')
    loginPasswordRef.current = ''
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

      <div className="fx-login-bg min-h-screen flex flex-col items-center justify-center px-4 py-10">
        <div className="fx-login-grid pointer-events-none fixed inset-0" aria-hidden="true" />

        <div className="relative z-10 w-full" style={{ maxWidth: 420 }}>

          <div className="flex items-center gap-3 mb-6 anim-fade-in" style={{ animationDelay: '0s' }}>
            <img
              src="/opsc-logo-white-transparent.png"
              alt="OPSC"
              style={{ width: 48, height: 'auto' }}
            />
            <div>
              <p className="text-sm font-semibold text-white leading-tight">Office of the Public Service Commission</p>
              <p className="text-xs text-sky-100/80 mt-0.5">Government of the Republic of Vanuatu</p>
            </div>
          </div>

          <div className={`${shaking ? 'fx-shake' : ''} ${leaving ? 'fx-card-exit' : ''}`}>
          <div
            className="anim-slide-up fx-card-sweep"
            style={{
              background: 'white',
              borderRadius: 20,
              boxShadow: '0 4px 6px -1px rgba(0,0,0,0.15), 0 24px 70px -10px rgba(0,0,0,0.45)',
              border: '1px solid rgba(255,255,255,0.35)',
              padding: '36px 32px',
              animationDelay: '0.08s',
            }}
          >
            {celebrating ? (
              <div className="py-6 text-center" role="status">
                <svg width="64" height="64" viewBox="0 0 64 64" className="mx-auto mb-4" aria-hidden="true">
                  <circle cx="32" cy="32" r="30" fill="#059669" />
                  <path className="fx-check-path" d="M19 33l9 9 17-19" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <p className="text-xl font-bold text-slate-900">Welcome back{welcomeName ? `, ${welcomeName}` : ''}</p>
                <p className="mt-1 text-sm text-slate-600">Secure session started</p>
              </div>
            ) : showPasswordChange ? (
              <>
                <div className="flex justify-center mb-5">
                  <div className="bg-gradient-dark" style={{ width: 56, height: 56, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
            ) : showEmailOtp ? (
              /* ── Emailed one-time code step ── */
              <>
                <div className="flex justify-center mb-5">
                  <div className="bg-gradient-dark" style={{ width: 56, height: 56, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Mail size={26} color="white" />
                  </div>
                </div>
                <h1 className="text-xl font-bold text-center text-slate-900 mb-1">Check your email</h1>
                <p className="text-sm text-center text-slate-500 mb-7">
                  Enter the 6-digit code we sent{emailHint ? <> to <span className="font-medium text-slate-700">{emailHint}</span></> : null}.
                </p>

                {error && (
                  <BaseMessageBar intent="error" className="mb-4">
                    {error}
                  </BaseMessageBar>
                )}
                {notice && !error && (
                  <BaseMessageBar intent="info" className="mb-4">
                    {notice}
                  </BaseMessageBar>
                )}
                <p className="text-xs text-center text-slate-500 -mt-4 mb-6">
                  The code can take up to 2 minutes to arrive. Please wait, and check your spam folder —
                  asking for another one will not make it faster.
                </p>

                <form onSubmit={handleVerifyEmailOtp} className="space-y-5">
                  <BaseInput
                    label="Verification Code"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    placeholder="——————"
                    value={emailOtp}
                    onChange={e => setEmailOtp(e.target.value.replace(/\D/g, ''))}
                    required
                    autoFocus
                    inputClassName="text-center text-3xl font-mono tracking-[0.4em]"
                  />
                  <BaseButton
                    type="submit"
                    variant="primary"
                    className="w-full !py-3"
                    loading={loading}
                    loadingLabel="Verifying"
                    disabled={emailOtp.length < 6}
                  >
                    Verify &amp; Continue
                  </BaseButton>

                  <div className="flex items-center justify-between mt-4">
                    <BaseButton type="button" variant="ghost" size="sm" onClick={backToSignIn}>
                      Back to sign in
                    </BaseButton>
                    <BaseButton type="button" variant="ghost" size="sm" onClick={handleResendEmailOtp} disabled={loading || resendIn > 0}>
                      {resendIn > 0 ? `Resend code (${resendIn}s)` : 'Resend code'}
                    </BaseButton>
                  </div>
                </form>
              </>
            ) : !show2FA ? (
              <>
                <div className="mb-7 text-center">
                  <h1 className="text-xl font-bold leading-snug text-slate-900 tracking-tight">Submission &amp; Commission Decision Management System</h1>
                </div>

                {error && (
                  <BaseMessageBar intent="error" className="mb-2">
                    {error}
                  </BaseMessageBar>
                )}

                <form onSubmit={handleSubmit} className="space-y-5">
                  <BaseInput
                    label="Username or email"
                    type="text"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    placeholder="Username or email address"
                    required
                    autoFocus
                  />

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label htmlFor="login-password" className="block text-sm font-medium text-slate-700">
                        Password
                        <span className="text-red-600 ms-0.5" aria-hidden="true">*</span>
                      </label>
                      <Link
                        to="/auth/reset-password"
                        className="text-xs text-primary-600 hover:text-primary-700 hover:underline font-medium"
                      >
                        Forgot password?
                      </Link>
                    </div>
                    <BasePasswordInput
                      id="login-password"
                      hideLabel
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      onKeyUp={e => setCapsLock(e.getModifierState?.('CapsLock') === true)}
                      onKeyDown={e => setCapsLock(e.getModifierState?.('CapsLock') === true)}
                      onBlur={() => setCapsLock(false)}
                      placeholder="Enter your password"
                      autoComplete="current-password"
                      required
                    />
                    {capsLock && (
                      <p role="status" className="mt-1.5 text-xs font-medium text-amber-700">
                        Caps Lock is on
                      </p>
                    )}
                  </div>

                  <BaseButton
                    type="submit"
                    variant="primary"
                    className="w-full !py-3"
                    disabled={loading}
                    icon={loading
                      ? <LockKeyhole size={16} className="fx-lock-shackle" aria-hidden="true" />
                      : <ArrowRight size={16} />}
                  >
                    {loading ? 'Securing…' : 'Sign In'}
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
                    <div className="bg-gradient-dark" style={{ width: 56, height: 56, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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

          </div>

          <div className="mt-4 flex items-center justify-center text-xs anim-fade-in" style={{ animationDelay: '0.15s' }}>
            <Link to="/track" className="inline-flex items-center gap-2 text-sm text-sky-100 hover:text-white underline underline-offset-2 transition-colors font-medium">
              Track your submission
            </Link>
          </div>

          <div className="mt-3 flex items-center justify-center text-[11px] text-sky-100/70 anim-fade-in" style={{ animationDelay: '0.2s' }}>
            <span>© {new Date().getFullYear()} OPSC Vanuatu. All rights reserved.</span>
          </div>
        </div>
      </div>
    </>
  )
}