import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Mail, ArrowLeft, Send, CheckCircle } from 'lucide-react'
import Logo from '../../components/shared/Logo'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!email) return
    setLoading(true)
    await new Promise(r => setTimeout(r, 1200))
    setLoading(false)
    setSent(true)
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Logo size={56} className="mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Liner Admin</h1>
        </div>

        <div className="card p-8">
          {!sent ? (
            <>
              <div className="text-center mb-7">
                <div className="w-14 h-14 rounded-full bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center mx-auto mb-4">
                  <Mail size={26} className="text-primary-600 dark:text-primary-400" />
                </div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Forgot Password?</h2>
                <p className="text-slate-500 dark:text-slate-400 text-sm mt-2">
                  No worries! Enter your email address and we'll send you a link to reset your password.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Email Address</label>
                  <div className="relative">
                    <Mail size={15} className="absolute start-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="email"
                      className="input ps-10"
                      placeholder="john@example.com"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || !email}
                  className="btn btn-primary w-full disabled:opacity-60"
                >
                  {loading ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Sending...
                    </div>
                  ) : (
                    <><Send size={16} /> Send Reset Link</>
                  )}
                </button>
              </form>
            </>
          ) : (
            <div className="text-center py-4">
              <div className="w-16 h-16 rounded-full bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center mx-auto mb-5">
                <CheckCircle size={32} className="text-emerald-500" />
              </div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">Check Your Email</h2>
              <p className="text-slate-500 dark:text-slate-400 text-sm mb-2">
                We've sent a password reset link to
              </p>
              <p className="font-semibold text-primary-600 dark:text-primary-400 mb-5">{email}</p>
              <p className="text-xs text-slate-400 mb-6">
                Didn't receive the email? Check your spam folder or{' '}
                <button onClick={() => setSent(false)} className="text-primary-600 dark:text-primary-400 underline">
                  try again
                </button>
              </p>
            </div>
          )}

          <div className="mt-6 text-center">
            <Link to="/auth/auth1/login" className="inline-flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors font-medium">
              <ArrowLeft size={15} /> Back to Login
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
