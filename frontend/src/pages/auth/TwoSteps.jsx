/**
 * Two-Step Verification (OTP) page
 *
 * Route: /auth/2fa
 *
 * Navigate here with: navigate('/auth/2fa', { state: { username } })
 * On success, stores JWT tokens and navigates to the dashboard.
 *
 * This page is INACTIVE in the normal login flow until TWO_FACTOR_REQUIRED
 * is set in Django settings and the login view is updated to redirect here
 * instead of issuing tokens directly.
 */

import { useState, useRef, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft, ShieldCheck, RotateCcw, AlertCircle, Zap } from 'lucide-react'
import Logo from '../../components/shared/Logo'
import api from '../../api/client'
import { useAuth } from '../../context/AuthContext'

export default function TwoSteps() {
  const location    = useLocation()
  const navigate    = useNavigate()
  const { refreshMe, setTokens } = useAuth()

  // Username is passed via router state from a future 2FA-aware login flow.
  // Falls back to sessionStorage so a page-refresh doesn't lose context.
  const username = location.state?.username || sessionStorage.getItem('psc_2fa_user') || ''

  const [otp,     setOtp]     = useState(['', '', '', '', '', ''])
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')
  const [resent,  setResent]  = useState(false)
  const [resending, setResending] = useState(false)

  const refs         = useRef([])
  const resentTimerRef = useRef(null)

  // Persist username across refreshes
  useEffect(() => {
    if (username) sessionStorage.setItem('psc_2fa_user', username)
    return () => {
      if (resentTimerRef.current) clearTimeout(resentTimerRef.current)
    }
  }, [username])

  /* ─── OTP input handlers ─────────────────────────────────────── */

  const handleChange = (i, val) => {
    if (!/^[0-9]?$/.test(val)) return
    const next = [...otp]
    next[i] = val
    setOtp(next)
    setError('')
    if (val && i < 5) refs.current[i + 1]?.focus()
  }

  const handleKeyDown = (i, e) => {
    if (e.key === 'Backspace' && !otp[i] && i > 0) {
      const next = [...otp]
      next[i - 1] = ''
      setOtp(next)
      refs.current[i - 1]?.focus()
    }
  }

  const handlePaste = (e) => {
    e.preventDefault()
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    const next = [...otp]
    text.split('').forEach((c, i) => { next[i] = c })
    setOtp(next)
    const focusIdx = Math.min(text.length, 5)
    refs.current[focusIdx]?.focus()
  }

  /* ─── Submit ─────────────────────────────────────────────────── */

  const handleSubmit = async (e) => {
    e.preventDefault()
    const code = otp.join('')
    if (code.length < 6) {
      setError('Please enter the complete 6-digit verification code.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const { data } = await api.post('/auth/totp/verify/', { username, code })
      setTokens(data.access, data.refresh)
      sessionStorage.removeItem('psc_2fa_user')
      await refreshMe()
      navigate('/', { replace: true })
    } catch (err) {
      const detail = err.response?.data
      const msg =
        typeof detail === 'string'                    ? detail :
        Array.isArray(detail?.non_field_errors)       ? detail.non_field_errors.join(' ') :
        typeof detail?.detail === 'string'            ? detail.detail :
        'Invalid or expired code. Please try again.'
      setError(msg)
      // Clear the OTP boxes on failure so user can re-enter
      setOtp(['', '', '', '', '', ''])
      setTimeout(() => refs.current[0]?.focus(), 50)
    } finally {
      setLoading(false)
    }
  }

  /* ─── Resend ─────────────────────────────────────────────────── */

  const handleResend = async () => {
    if (!username || resending) return
    setResending(true)
    setError('')
    try {
      await api.post('/auth/otp/request/', { username })
      setOtp(['', '', '', '', '', ''])
      setResent(true)
      setTimeout(() => refs.current[0]?.focus(), 50)
      if (resentTimerRef.current) clearTimeout(resentTimerRef.current)
      resentTimerRef.current = setTimeout(() => setResent(false), 4000)
    } catch {
      setError('Failed to resend code. Please try again.')
    } finally {
      setResending(false)
    }
  }

  /* ─── Render ─────────────────────────────────────────────────── */

  return (
    <div className="min-h-screen flex">

      {/* ════════════════════════════════
          LEFT — OTP form
      ════════════════════════════════ */}
      <div className="flex-1 flex flex-col bg-white dark:bg-slate-900">

        {/* Top bar */}
        <div className="flex items-center gap-3 px-10 py-5 border-b border-slate-100 dark:border-slate-800">
          <Logo size={28} />
          <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">
            Submission &amp; Commission Decision Management System
          </span>
        </div>

        {/* Form area */}
        <div className="flex-1 flex flex-col justify-center px-10 py-12">
          <div className="max-w-sm w-full mx-auto">

            {/* Icon */}
            <div className="w-12 h-12 rounded-xl bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center mb-6">
              <ShieldCheck size={22} className="text-primary-600 dark:text-primary-400" />
            </div>

            <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-1">
              Two-Step Verification
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-8">
              Enter the 6-digit code from your authenticator app (e.g. Microsoft Authenticator)
              {username && (
                <> for account{' '}
                  <span className="font-medium text-slate-700 dark:text-slate-300">
                    {username}
                  </span>
                </>
              )}.
            </p>

            {error && (
              <div className="mb-5 flex items-start gap-3 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300">
                <AlertCircle size={15} className="mt-0.5 flex-shrink-0" />
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* OTP digit boxes */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 text-center mb-4">
                  Enter your 6-digit code
                </label>
                <div className="flex gap-2 sm:gap-3 justify-center">
                  {otp.map((digit, i) => (
                    <input
                      key={i}
                      ref={el => refs.current[i] = el}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={e => handleChange(i, e.target.value)}
                      onKeyDown={e => handleKeyDown(i, e)}
                      onPaste={handlePaste}
                      autoFocus={i === 0}
                      className={[
                        'w-11 h-13 sm:w-12 sm:h-14 text-center text-xl font-bold rounded-xl border-2',
                        'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100',
                        'focus:outline-none transition-all',
                        error
                          ? 'border-red-400 dark:border-red-500'
                          : digit
                          ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                          : 'border-slate-200 dark:border-slate-700 focus:border-primary-500',
                      ].join(' ')}
                    />
                  ))}
                </div>
              </div>

              {/* Verify button */}
              <button
                type="submit"
                disabled={loading || otp.join('').length < 6}
                className="btn-gradient w-full py-2.5 text-sm disabled:opacity-60"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Verifying…
                  </span>
                ) : (
                  <><ShieldCheck size={16} /> Verify Code</>
                )}
              </button>
            </form>

            {/* Back link */}
            <div className="mt-6 text-center space-y-3">
              <Link
                to="/auth/login"
                className="inline-flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
              >
                <ArrowLeft size={14} /> Back to Sign In
              </Link>
            </div>

          </div>
        </div>

        {/* Bottom bar */}
        <div className="px-10 py-4 border-t border-slate-100 dark:border-slate-800">
          <p className="text-xs text-slate-400 dark:text-slate-600">
            For access issues, contact your system administrator.
          </p>
        </div>
      </div>

      {/* ════════════════════════════════
          RIGHT — Institutional panel
      ════════════════════════════════ */}
      <div
        className="hidden xl:flex flex-col flex-1 min-h-screen"
        style={{ backgroundColor: '#0c2451' }}
      >
        {/* Identity */}
        <div className="px-12 pt-12 pb-9 flex items-center gap-5">
          <img
            src="/opsc-logo-white-transparent.png"
            alt="Office of the Public Service Commission"
            className="w-14 h-auto flex-shrink-0"
          />
          <div>
            <h2 className="text-white text-base font-semibold leading-snug mb-1">
              Office of the Public Service Commission
            </h2>
            <p className="text-white/40 text-sm">
              Government of the Republic of Vanuatu
            </p>
          </div>
        </div>

        <div className="mx-12 border-t border-white/[0.10]" />

        {/* Security info */}
        <div className="px-12 pt-10 flex-1">
          <p className="text-white/30 text-xs font-semibold uppercase tracking-[0.15em] mb-6">
            Why Two-Step Verification?
          </p>

          <ul className="space-y-5">
            {[
              {
                title: 'Enhanced account protection',
                desc: 'A second verification step ensures only you can access your account, even if your password is compromised.',
              },
              {
                title: 'Time-sensitive codes',
                desc: 'Each code is valid for 10 minutes only and can be used once, preventing replay attacks.',
              },
              {
                title: 'Institutional data security',
                desc: 'Two-factor authentication protects sensitive public service commission records from unauthorised access.',
              },
              {
                title: 'Code not arriving?',
                desc: 'Check your spam folder, or use the Resend option. Contact your administrator if issues persist.',
              },
            ].map(({ title, desc }) => (
              <li key={title} className="flex items-start gap-4">
                <span className="mt-1.5 w-3 h-px bg-white/20 flex-shrink-0" />
                <div>
                  <p className="text-white/60 text-sm font-medium mb-0.5">{title}</p>
                  <p className="text-white/30 text-sm leading-relaxed">{desc}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Footer */}
        <div className="px-12 pb-8">
          <div className="border-t border-white/[0.10] pt-5 flex items-center justify-between">
            <p className="text-white/20 text-[11px]">
              © {new Date().getFullYear()} Office of the Public Service Commission, Vanuatu
            </p>
            <div className="flex items-center gap-1.5">
              <Zap size={10} className="text-white/20" />
              <span className="text-[11px] text-white/20">Powered by Django</span>
            </div>
          </div>
        </div>
      </div>

    </div>
  )
}
