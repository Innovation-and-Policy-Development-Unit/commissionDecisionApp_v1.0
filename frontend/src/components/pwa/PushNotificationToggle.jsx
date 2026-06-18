import { Bell, BellOff, Smartphone } from 'lucide-react'
import usePushNotifications from '../../hooks/usePushNotifications'

function isiOS() {
  if (typeof navigator === 'undefined') return false
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream
}
function isStandalone() {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true
}

/**
 * Account-settings control to enable/disable mobile + desktop push notifications.
 */
export default function PushNotificationToggle() {
  const { supported, permission, subscribed, busy, error, enable, disable } = usePushNotifications()

  const iosNeedsInstall = isiOS() && !isStandalone()

  return (
    <div className="card p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300">
          <Smartphone size={20} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Mobile & desktop notifications</h3>
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
            Get a push notification for important events (deadlines, decisions, returns, and letters ready for pickup) —
            even when the app is closed.
          </p>

          {!supported && (
            <p className="mt-3 text-xs text-amber-600 dark:text-amber-400">
              This browser doesn’t support push notifications.
            </p>
          )}

          {supported && iosNeedsInstall && (
            <p className="mt-3 text-xs text-amber-600 dark:text-amber-400">
              On iPhone/iPad, first install this app to your Home Screen (Share → Add to Home Screen), then open it and
              enable notifications from there.
            </p>
          )}

          {permission === 'denied' && (
            <p className="mt-3 text-xs text-red-600 dark:text-red-400">
              Notifications are blocked in your browser settings — allow them for this site, then try again.
            </p>
          )}

          {error && <p className="mt-3 text-xs text-red-600 dark:text-red-400">{error}</p>}

          {supported && (
            <div className="mt-4">
              {subscribed ? (
                <button onClick={disable} disabled={busy} className="btn-outline text-sm inline-flex items-center gap-2">
                  <BellOff size={15} /> {busy ? 'Working…' : 'Turn off notifications'}
                </button>
              ) : (
                <button onClick={enable} disabled={busy || permission === 'denied'} className="btn-primary text-sm inline-flex items-center gap-2">
                  <Bell size={15} /> {busy ? 'Enabling…' : 'Enable notifications'}
                </button>
              )}
              {subscribed && (
                <span className="ml-3 text-xs font-medium text-emerald-600 dark:text-emerald-400">Notifications are on for this device.</span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
