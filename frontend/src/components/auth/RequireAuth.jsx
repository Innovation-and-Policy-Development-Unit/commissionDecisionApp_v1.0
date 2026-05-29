import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

/** Dashboard and PSC routes: require a JWT that passes GET /api/me/. Otherwise send user to login. */
export default function RequireAuth() {
  const location = useLocation()
  const { accessToken, user, authReady } = useAuth()

  if (!accessToken) {
    return <Navigate to="/auth/login" replace state={{ from: location }} />
  }

  if (!authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <p className="text-sm text-slate-500 dark:text-slate-400">Loading session…</p>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/auth/login" replace state={{ from: location }} />
  }

  if (user.must_change_password) {
    return <Navigate to="/auth/login" replace state={{ from: location, forcePasswordChange: true }} />
  }

  return <Outlet />
}
