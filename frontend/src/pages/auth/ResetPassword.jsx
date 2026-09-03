import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Mail, ArrowLeft, ArrowRight, CheckCircle2 } from 'lucide-react'
import api from '../../api/client'
import BaseButton from '../../components/shared/BaseButton'
import BaseInput from '../../components/shared/BaseInput'
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
            {!sent ? (
              <>
                <div className="flex justify-center mb-5">
                  <div className="bg-gradient-dark" style={{ width: 56, height: 56, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Mail size={26} color="white" />
                  </div>
                </div>
                <h1 className="text-xl font-bold text-center text-slate-900 mb-1">Forgot your password?</h1>
                <p className="text-sm text-center text-slate-500 mb-6">
                  Enter the email address linked to your account and we'll send you a reset link.
                </p>

                {error && (
                  <BaseMessageBar intent="error" className="mb-4">
                    {error}
                  </BaseMessageBar>
                )}

                <form onSubmit={handleSubmit} className="space-y-5">
                  <BaseInput
                    label="Email Address"
                    type="email"
                    placeholder="john@example.com"
                    value={email}
                    autoComplete="email"
                    onChange={e => setEmail(e.target.value)}
                    required
                    autoFocus
                    contentBefore={<Mail size={15} className="text-slate-400" />}
                  />
                  <BaseButton
                    type="submit"
                    variant="primary"
                    className="w-full !py-3"
                    loading={loading}
                    loadingLabel="Sending"
                    disabled={!email}
                    icon={!loading ? <ArrowRight size={16} /> : undefined}
                  >
                    Send Reset Link
                  </BaseButton>
                </form>
              </>
            ) : (
              <>
                <div className="flex justify-center mb-5">
                  <div style={{ width: 56, height: 56, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#ecfdf5' }}>
                    <CheckCircle2 size={26} className="text-emerald-500" />
                  </div>
                </div>
                <h1 className="text-xl font-bold text-center text-slate-900 mb-1">Check your email</h1>
                <p className="text-sm text-center text-slate-500 mb-6">
                  If <span className="font-medium text-slate-700">{email}</span> is
                  registered, we've sent a password reset link. The link expires in 1 hour.
                </p>

                <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-800 mb-6">
                  <strong>Tip:</strong> Check your spam or junk folder if the email doesn't arrive within a few minutes.
                </div>

                <BaseButton
                  variant="outline"
                  className="w-full !py-3 mb-3"
                  onClick={() => { setSent(false); setEmail(''); setError('') }}
                >
                  Try a different email
                </BaseButton>

                <Link
                  to="/auth/login"
                  className="btn-gradient w-full !py-3 text-sm justify-center"
                >
                  Back to Sign In <ArrowRight size={16} />
                </Link>
              </>
            )}
          </div>

          {!sent && (
            <div className="mt-4 flex items-center justify-center text-xs anim-fade-in" style={{ animationDelay: '0.15s' }}>
              <Link
                to="/auth/login"
                className="inline-flex items-center gap-1.5 text-primary-600 hover:text-primary-700 hover:underline font-medium"
              >
                <ArrowLeft size={13} /> Back to Sign In
              </Link>
            </div>
          )}

          <div className="mt-3 flex items-center justify-center text-[11px] text-slate-400 anim-fade-in" style={{ animationDelay: '0.2s' }}>
            <span>For access issues, contact your system administrator.</span>
          </div>
          <div className="mt-1 flex items-center justify-center text-[11px] text-slate-400 anim-fade-in" style={{ animationDelay: '0.25s' }}>
            <span>© {new Date().getFullYear()} OPSC Vanuatu. All rights reserved.</span>
          </div>
        </div>
      </div>
    </>
  )
}
