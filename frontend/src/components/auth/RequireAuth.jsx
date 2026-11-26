import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import AppLoadingSkeleton from '../shared/AppLoadingSkeleton'

/** Dashboard and PSC routes: require a JWT that passes GET /api/me/. Otherwise send user to login. */
export default function RequireAuth() {
  const location = useLocation()
  const { accessToken, user, authReady, isLocked } = useAuth()

  if (!accessToken) {
    return <Navigate to="/auth/login" replace state={{ from: location }} />
  }

  if (!authReady) {
    return <AppLoadingSkeleton />
  }

  if (!user) {
    return <Navigate to="/auth/login" replace state={{ from: location }} />
  }

  if (isLocked) {
    return <Navigate to="/auth/lock" replace state={{ from: location }} />
  }

  if (user.must_change_password) {
    return <Navigate to="/auth/login" replace state={{ from: location, forcePasswordChange: true }} />
  }

  if (!user.session_pin_set) {
    return <Navigate to="/auth/set-pin" replace state={{ from: location }} />
  }

  return <Outlet />
}
