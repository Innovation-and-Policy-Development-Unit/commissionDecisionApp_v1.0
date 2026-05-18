import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Mail, ArrowLeft, ArrowRight, CheckCircle2, AlertCircle, Zap } from 'lucide-react'
import Logo from '../../components/shared/Logo'
import api from '../../api/client'

export default function ResetPassword() {
  const [email,   setEmail]   = useState('')
  const [sent,    setSent]    = useState(false)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await api.post('/auth/password-reset/request/', { email: email.trim() })
      setSent(true)
    } catch (err) {
      const detail = err.response?.data?.detail
      setError(
        typeof detail === 'string' ? detail :
        'Something went wrong. Please try again.'
      )
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

            {!sent ? (
              <>
                {/* Icon */}
                <div className="w-12 h-12 rounded-xl bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center mb-6">
                  <Mail size={22} className="text-primary-600 dark:text-primary-400" />
                </div>

                <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-1">
                  Forgot your password?
                </h1>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-8">
                  Enter the email address linked to your account and we'll send you a reset link.
                </p>

                {error && (
                  <div className="mb-5 flex items-start gap-3 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300">
                    <AlertCircle size={15} className="mt-0.5 flex-shrink-0" />
                    {error}
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                      Email Address
                    </label>
                    <div className="relative">
                      <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="email"
                        className="input pl-9"
                        placeholder="john@example.com"
                        value={email}
                        autoComplete="email"
                        onChange={e => setEmail(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="btn-gradient w-full py-2.5 text-sm"
                    disabled={loading || !email}
                  >
                    {loading ? (
                      <span className="flex items-center gap-2">
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Sending…
                      </span>
                    ) : (
                      <>Send Reset Link <ArrowRight size={16} /></>
                    )}
                  </button>
                </form>
              </>
            ) : (
              <>
                {/* Success state */}
                <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center mb-6">
                  <CheckCircle2 size={22} className="text-emerald-500" />
                </div>

                <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-1">
                  Check your email
                </h1>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
                  If <span className="font-medium text-slate-700 dark:text-slate-300">{email}</span> is
                  registered, we've sent a password reset link. The link expires in 1 hour.
                </p>

                <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-sm text-amber-800 dark:text-amber-200 mb-6">
                  <strong>Tip:</strong> Check your spam or junk folder if the email doesn't arrive within a few minutes.
                </div>

                <button
                  onClick={() => { setSent(false); setEmail(''); setError('') }}
                  className="w-full py-2.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors font-medium mb-3"
                >
                  Try a different email
                </button>

                <Link
                  to="/auth/login"
                  className="btn-gradient w-full py-2.5 text-sm justify-center"
                >
                  Back to Sign In <ArrowRight size={16} />
                </Link>
              </>
            )}

            <div className="mt-8 text-center">
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

        {/* Body copy */}
        <div className="px-12 pt-10 flex-1">
          <p className="text-white/30 text-xs font-semibold uppercase tracking-[0.15em] mb-6">
            Account Security
          </p>

          <ul className="space-y-5">
            {[
              {
                title: 'Secure reset links',
                desc: 'Each password reset link is unique, time-limited to 1 hour, and can only be used once.',
              },
              {
                title: 'Email verification',
                desc: 'We only send reset emails to verified addresses already registered in the system.',
              },
              {
                title: 'No account enumeration',
                desc: 'For security reasons, we always show a success message regardless of whether the email exists.',
              },
              {
                title: 'Need immediate help?',
                desc: 'Contact your system administrator to have your password reset directly.',
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
