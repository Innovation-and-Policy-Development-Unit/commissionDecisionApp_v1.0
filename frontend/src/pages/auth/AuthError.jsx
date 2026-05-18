import { Link } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, RefreshCw } from 'lucide-react'

export default function AuthError() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        {/* Error illustration */}
        <div className="relative mb-8">
          <div className="w-32 h-32 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center mx-auto">
            <AlertTriangle size={60} className="text-red-400 dark:text-red-500" />
          </div>
          <div className="absolute top-0 end-12 w-8 h-8 rounded-full bg-amber-400 opacity-60 blur-sm" />
          <div className="absolute bottom-0 start-12 w-6 h-6 rounded-full bg-red-400 opacity-40 blur-sm" />
        </div>

        <div className="card p-8">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-3">Authentication Error</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mb-6 leading-relaxed">
            There was a problem authenticating your account. This could be due to an expired session, invalid credentials, or a temporary service issue.
          </p>

          <div className="bg-red-50 dark:bg-red-900/10 rounded-xl p-4 mb-6 text-start">
            <p className="text-xs font-semibold text-red-700 dark:text-red-300 mb-1">Error Details</p>
            <p className="text-xs text-red-600 dark:text-red-400 font-mono">AUTH_TOKEN_EXPIRED: Session has expired. Please log in again.</p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <Link to="/auth/auth1/login" className="btn btn-primary flex-1">
              <ArrowLeft size={16} /> Return to Login
            </Link>
            <button onClick={() => window.location.reload()} className="btn btn-outline flex-1">
              <RefreshCw size={16} /> Try Again
            </button>
          </div>
        </div>

        <p className="text-xs text-slate-400 mt-5">
          If the problem persists, please contact{' '}
          <a href="mailto:support@liner.com" className="text-primary-600 dark:text-primary-400 underline">support@liner.com</a>
        </p>
      </div>
    </div>
  )
}
