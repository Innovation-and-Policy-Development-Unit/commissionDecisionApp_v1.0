/**
 * Session PIN Reset Confirmation page
 *
 * Route: /auth/forgot-pin/confirm?token=<token>
 *
 * Reached by clicking the PIN reset link logged to the Django console in
 * dev (or emailed in production). Validates the token and sets a new
 * session PIN via POST /auth/pin-reset/confirm/. Does not touch the
 * account password.
 */

import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ShieldCheck, ArrowRight, CheckCircle2, AlertCircle } from 'lucide-react'
import Logo from '../../components/shared/Logo'
import api from '../../api/client'
import BaseButton from '../../components/shared/BaseButton'

export default function PinResetConfirm() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''

  const [pin,        setPin]        = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState('')
  const [done,       setDone]       = useState(false)

  const mismatch = confirmPin && pin !== confirmPin

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (pin.length < 4) {
      setError('PIN must be at least 4 digits.')
      return
    }
    if (pin !== confirmPin) {
      setError('PINs do not match.')
      return
    }
    if (!token) {
      setError('Reset token is missing. Please use the link from your email.')
      return
    }
    setError('')
    setLoading(true)
    try {
      await api.post('/auth/pin-reset/confirm/', { token, pin })
      setDone(true)
    } catch (err) {
      const data = err.response?.data
      let msg = 'Failed to reset PIN. The link may have expired.'
      if (typeof data?.detail === 'string') {
        msg = data.detail
      } else if (data?.pin) {
        const p = data.pin
        msg = Array.isArray(p) ? p.join(' ') : String(p)
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
                  <ShieldCheck size={22} className="text-primary-600 dark:text-primary-400" />
                </div>

                <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-1">
                  Set a new session PIN
                </h1>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
                  Choose a 4–6 digit PIN. It's used to unlock your session after a period of
                  inactivity and for quick sign-in on this device — your password stays private.
                </p>

                {error && (
                  <div className="mb-5 flex items-start gap-3 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300">
                    <AlertCircle size={15} className="mt-0.5 flex-shrink-0" />
                    {error}
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-5">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2 text-center">
                      New PIN (4–6 digits)
                    </label>
                    <input
                      type="password"
                      className="input text-center text-2xl font-mono w-full"
                      style={{ borderRadius: 10, letterSpacing: '0.4em' }}
                      maxLength={6}
                      placeholder="••••••"
                      value={pin}
                      onChange={e => { setPin(e.target.value.replace(/\D/g, '').slice(0, 6)); setError('') }}
                      required
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2 text-center">
                      Confirm PIN
                    </label>
                    <input
                      type="password"
                      className="input text-center text-2xl font-mono w-full"
                      style={{ borderRadius: 10, letterSpacing: '0.4em' }}
                      maxLength={6}
                      placeholder="••••••"
                      value={confirmPin}
                      onChange={e => { setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 6)); setError('') }}
                      required
                    />
                    {mismatch && (
                      <p className="mt-1.5 text-xs text-red-600 text-center">PINs do not match.</p>
                    )}
                  </div>

                  <BaseButton
                    type="submit"
                    variant="primary"
                    className="w-full !py-2.5"
                    loading={loading}
                    loadingLabel="Saving"
                    disabled={!token || pin.length < 4 || confirmPin.length < 4 || mismatch}
                    icon={!loading ? <ArrowRight size={16} /> : undefined}
                  >
                    Set New PIN
                  </BaseButton>
                </form>
              </>
            ) : (
              /* Success state */
              <>
                <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center mb-6">
                  <CheckCircle2 size={22} className="text-emerald-500" />
                </div>

                <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-1">
                  PIN updated
                </h1>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-8">
                  Your session PIN has been changed successfully. Sign in with your password to
                  continue.
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
            About Your Session PIN
          </p>

          <ul className="space-y-5">
            {[
              {
                title: 'Not your password',
                desc: 'Your PIN is a separate, shorter code just for unlocking this device quickly — it never replaces your account password.',
              },
              {
                title: 'Device-scoped',
                desc: 'A PIN only works on a device this account has already signed into with your password — it can\'t be used to sign in somewhere new.',
              },
              {
                title: 'Resetting it is safe',
                desc: 'Setting a new PIN doesn\'t affect your password or any other account settings.',
              },
              {
                title: 'Keep it private',
                desc: 'Never share your PIN with colleagues, even if they say it\'s just to unlock a screen for you.',
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
          <div className="border-t border-white/[0.10] pt-5 flex items-center justify-center">
            <p className="text-white/20 text-[11px]">
              © {new Date().getFullYear()} Office of the Public Service Commission, Vanuatu
            </p>
          </div>
        </div>
      </div>

    </div>
  )
}
