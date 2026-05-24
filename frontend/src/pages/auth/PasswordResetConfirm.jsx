/**
 * Password Reset Confirmation page
 *
 * Route: /auth/reset-password/confirm?token=<token>
 *
 * This page is reached by clicking the reset link logged to the Django
 * console in dev (or emailed in production). It validates the token and
 * sets a new password via POST /auth/password-reset/confirm/.
 */

import { useState, useEffect, useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Eye, EyeOff, KeyRound, ArrowRight, CheckCircle2, AlertCircle, Zap } from 'lucide-react'
import Logo from '../../components/shared/Logo'
import api from '../../api/client'

/* Simple strength meter: returns { score 0-4, label, color } */
function passwordStrength(pw) {
  if (!pw) return { score: 0, label: '', color: 'bg-slate-200 dark:bg-slate-700' }
  let score = 0
  if (pw.length >= 8)            score++
  if (pw.length >= 12)           score++
  if (/[A-Z]/.test(pw))         score++
  if (/[0-9!@#$%^&*]/.test(pw)) score++
  const map = [
    { label: 'Very weak', color: 'bg-red-500' },
    { label: 'Weak',      color: 'bg-orange-500' },
    { label: 'Fair',      color: 'bg-yellow-500' },
    { label: 'Good',      color: 'bg-emerald-500' },
    { label: 'Strong',    color: 'bg-emerald-600' },
  ]
  return { score, ...map[score] }
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

export default function PasswordResetConfirm() {
  const [searchParams]    = useSearchParams()
  const token             = searchParams.get('token') || ''

  const [policy, setPolicy] = useState(null)
  const [password,   setPassword]   = useState('')
  const [confirm,    setConfirm]    = useState('')
  const [showPw,     setShowPw]     = useState(false)
  const [showCfm,    setShowCfm]    = useState(false)
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState('')
  const [done,       setDone]       = useState(false)

  useEffect(() => {
    api.get('/auth/password-policy/')
      .then(res => setPolicy(res.data))
      .catch(() => setPolicy(null))
  }, [])

  const minLength = policy?.min_length ?? 8
  const policyLines = useMemo(() => policyHintLines(policy), [policy])
  const strength = passwordStrength(password)
  const mismatch = confirm && password !== confirm

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    if (!token) {
      setError('Reset token is missing. Please use the link from your email.')
      return
    }
    setError('')
    setLoading(true)
    try {
      await api.post('/auth/password-reset/confirm/', { token, password })
      setDone(true)
    } catch (err) {
      const data = err.response?.data
      let msg = 'Failed to reset password. The link may have expired.'
      if (typeof data?.detail === 'string') {
        msg = data.detail
      } else if (data?.password) {
        const pw = data.password
        msg = Array.isArray(pw) ? pw.join(' ') : String(pw)
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
    <div className="min-h-screen flex">

      {/* ════════════════════════════════
          LEFT — Form
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

            {!done ? (
              <>
                {/* Missing token warning */}
                {!token && (
                  <div className="mb-6 flex items-start gap-3 rounded border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-200">
                    <AlertCircle size={15} className="mt-0.5 flex-shrink-0" />
                    No reset token found. Please use the full link from your reset email.
                  </div>
                )}

                {/* Icon */}
                <div className="w-12 h-12 rounded-xl bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center mb-6">
                  <KeyRound size={22} className="text-primary-600 dark:text-primary-400" />
                </div>

                <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-1">
                  Set a new password
                </h1>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                  Choose a strong password for your SCDMS account.
                </p>
                {policyLines.length > 0 && (
                  <ul className="mb-6 text-xs text-slate-500 dark:text-slate-400 space-y-1 list-disc ps-4">
                    {policyLines.map(line => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                )}

                {error && (
                  <div className="mb-5 flex items-start gap-3 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300">
                    <AlertCircle size={15} className="mt-0.5 flex-shrink-0" />
                    {error}
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-5">

                  {/* New password */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                      New Password
                    </label>
                    <div className="relative">
                      <input
                        type={showPw ? 'text' : 'password'}
                        className="input pe-10"
                        placeholder={`Minimum ${minLength} characters`}
                        value={password}
                        autoComplete="new-password"
                        onChange={e => { setPassword(e.target.value); setError('') }}
                        required
                        minLength={minLength}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPw(p => !p)}
                        className="absolute end-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                      >
                        {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>

                    {/* Strength meter */}
                    {password && (
                      <div className="mt-2">
                        <div className="flex gap-1 mb-1">
                          {[0, 1, 2, 3].map(i => (
                            <div
                              key={i}
                              className={`h-1 flex-1 rounded-full transition-colors ${
                                i < strength.score ? strength.color : 'bg-slate-200 dark:bg-slate-700'
                              }`}
                            />
                          ))}
                        </div>
                        <p className="text-xs text-slate-400 dark:text-slate-500">
                          {strength.label}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Confirm password */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                      Confirm Password
                    </label>
                    <div className="relative">
                      <input
                        type={showCfm ? 'text' : 'password'}
                        className={`input pe-10 ${mismatch ? 'border-red-400 dark:border-red-500 focus:border-red-400' : ''}`}
                        placeholder="Repeat your new password"
                        value={confirm}
                        autoComplete="new-password"
                        onChange={e => { setConfirm(e.target.value); setError('') }}
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowCfm(p => !p)}
                        className="absolute end-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                      >
                        {showCfm ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    {mismatch && (
                      <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                        Passwords do not match.
                      </p>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={loading || !token || !password || !confirm || mismatch}
                    className="btn-gradient w-full py-2.5 text-sm disabled:opacity-60"
                  >
                    {loading ? (
                      <span className="flex items-center gap-2">
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Saving…
                      </span>
                    ) : (
                      <>Set New Password <ArrowRight size={16} /></>
                    )}
                  </button>
                </form>
              </>
            ) : (
              /* Success state */
              <>
                <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center mb-6">
                  <CheckCircle2 size={22} className="text-emerald-500" />
                </div>

                <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-1">
                  Password updated
                </h1>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-8">
                  Your password has been changed successfully. You can now sign in with your new credentials.
                </p>

                <Link
                  to="/auth/login"
                  className="btn-gradient w-full py-2.5 text-sm justify-center"
                >
                  Sign In <ArrowRight size={16} />
                </Link>
              </>
            )}

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

        {/* Tips */}
        <div className="px-12 pt-10 flex-1">
          <p className="text-white/30 text-xs font-semibold uppercase tracking-[0.15em] mb-6">
            Password Tips
          </p>

          <ul className="space-y-5">
            {[
              {
                title: 'Length matters most',
                desc: 'Use at least 12 characters. A longer passphrase is stronger than a short complex one.',
              },
              {
                title: 'Mix characters',
                desc: 'Include uppercase letters, numbers, and special characters (! @ # $ %) for extra strength.',
              },
              {
                title: 'Avoid personal info',
                desc: 'Do not use your name, username, date of birth, or common words as part of your password.',
              },
              {
                title: 'Keep it private',
                desc: 'Never share your password with colleagues. Administrators will never ask for your password.',
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
