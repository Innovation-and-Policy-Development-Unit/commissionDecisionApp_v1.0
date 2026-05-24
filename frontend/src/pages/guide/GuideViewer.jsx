import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { BookOpen, AlertTriangle, Lock } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { userIsAdmin } from '../../utils/adminAccess'

/**
 * Reusable full-height guide viewer.
 * Renders an iframe pointing to a pre-rendered HTML guide in /public/guides/.
 * Redirects to /404 if the user's role is not in allowedRoles.
 * Shows a helpful "not rendered" message if the HTML file doesn't exist yet.
 *
 * To render the guides:
 *   quarto render docs/user-guide-hr-manager.qmd --output-file hr-manager-guide.html
 *   quarto render docs/user-guide-unit-manager.qmd --output-file unit-manager-guide.html
 *   quarto render docs/user-guide-secretary.qmd --output-file secretary-guide.html
 * Then move the output files to: frontend/public/guides/
 */
export default function GuideViewer({ title, htmlFile, allowedRoles }) {
  const { user, authReady } = useAuth()
  const [available, setAvailable] = useState(null) // null=checking, true=ok, false=missing

  useEffect(() => {
    if (!authReady || !user) return
    fetch(`/guides/${htmlFile}`, { method: 'HEAD' })
      .then(r => setAvailable(r.ok))
      .catch(() => setAvailable(false))
  }, [htmlFile, authReady, user])

  // Wait for auth to settle before making any access decision
  if (!authReady) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!user) return <Navigate to="/auth/login" replace />

  // Admin bypass: server-computed flag is more reliable than checking role string
  // (handles superusers, staff, and psc_admin users who all have can_access_admin_panel=true)
  const isAdmin = userIsAdmin(user) || user.can_access_admin_panel === true
  const canAccess = isAdmin || allowedRoles.includes(user.role)

  if (!canAccess) {
    return (
      <div className="flex flex-col" style={{ height: 'calc(100vh - 4rem)' }}>
        <div className="shrink-0 flex items-center gap-2 px-5 py-2.5 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
          <BookOpen size={14} className="text-indigo-500" />
          <h1 className="text-sm font-semibold text-slate-700 dark:text-slate-200">{title}</h1>
        </div>
        <div className="flex-1 flex items-center justify-center bg-slate-50 dark:bg-slate-900">
          <div className="text-center max-w-sm">
            <Lock size={36} className="mx-auto mb-3 text-slate-400" />
            <p className="font-semibold text-slate-700 dark:text-slate-200 mb-1">Access restricted</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">This guide is not available for your role.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 4rem)' }}>
      {/* Thin top bar */}
      <div className="shrink-0 flex items-center gap-2 px-5 py-2.5 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
        <BookOpen size={14} className="text-indigo-500" />
        <h1 className="text-sm font-semibold text-slate-700 dark:text-slate-200">{title}</h1>
        <span className="ml-auto text-[11px] text-slate-400">
          PSC — Office of the Public Service Commission
        </span>
      </div>

      {/* Content area */}
      {available === false ? (
        <div className="flex-1 flex items-center justify-center text-center px-8 bg-slate-50 dark:bg-slate-900">
          <div className="max-w-md">
            <AlertTriangle size={40} className="mx-auto mb-4 text-amber-400" />
            <p className="font-semibold text-slate-700 dark:text-slate-200 mb-2 text-base">
              Guide not yet available
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4 leading-relaxed">
              The guide HTML has not been generated yet. Render it with Quarto, then place the
              output in <code className="bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded text-xs">
                frontend/public/guides/
              </code>:
            </p>
            <pre className="text-xs bg-slate-100 dark:bg-slate-800 rounded-lg p-4 text-left text-slate-600 dark:text-slate-300 overflow-auto whitespace-pre-wrap">
              {`quarto render docs/${htmlFile.replace('.html', '.qmd')} \\\n  --output-file ${htmlFile} \\\n  --output-dir frontend/public/guides`}
            </pre>
          </div>
        </div>
      ) : available === true ? (
        <iframe
          src={`/guides/${htmlFile}`}
          className="flex-1 w-full border-0"
          title={title}
        />
      ) : (
        <div className="flex-1 flex items-center justify-center bg-slate-50 dark:bg-slate-900">
          <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  )
}
