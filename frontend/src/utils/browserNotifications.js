const STORAGE_ENABLED = 'scdms_desktop_notifications'
const STORAGE_ENABLED_AT = 'scdms_desktop_notifications_at'

export function isDesktopNotificationSupported() {
  return typeof window !== 'undefined' && 'Notification' in window
}

export function getDesktopNotificationsEnabled() {
  try {
    return localStorage.getItem(STORAGE_ENABLED) === 'true'
  } catch {
    return false
  }
}

export function setDesktopNotificationsEnabled(enabled) {
  try {
    localStorage.setItem(STORAGE_ENABLED, enabled ? 'true' : 'false')
    if (enabled) {
      localStorage.setItem(STORAGE_ENABLED_AT, new Date().toISOString())
    }
  } catch {
    /* ignore */
  }
}

export function getDesktopNotificationsEnabledAt() {
  try {
    return localStorage.getItem(STORAGE_ENABLED_AT)
  } catch {
    return null
  }
}

export function getNotificationPermission() {
  if (!isDesktopNotificationSupported()) return 'unsupported'
  return Notification.permission
}

export async function requestNotificationPermission() {
  if (!isDesktopNotificationSupported()) return 'unsupported'
  if (Notification.permission === 'granted') return 'granted'
  if (Notification.permission === 'denied') return 'denied'
  return Notification.requestPermission()
}

/**
 * Show a native Windows / macOS / browser toast (works on localhost and HTTPS).
 */
export function showDesktopNotification({ title, body, tag, onClick }) {
  if (!isDesktopNotificationSupported()) return null
  if (Notification.permission !== 'granted') return null
  if (!getDesktopNotificationsEnabled()) return null

  try {
    const n = new Notification(title, {
      body: body || '',
      tag: tag || undefined,
      icon: '/favicon.ico',
      silent: false,
    })
    if (onClick) {
      n.onclick = () => {
        window.focus()
        onClick()
        n.close()
      }
    }
    return n
  } catch {
    return null
  }
}

export function formatNotificationTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const diffMs = Date.now() - d.getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins} min ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs} hr ago`
  const days = Math.floor(hrs / 24)
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days} days ago`
  return d.toLocaleDateString()
}

export function inferNotificationType(title = '') {
  const t = title.toLowerCase()
  if (/due|overdue|deadline|reminder/.test(t)) return 'warning'
  if (/fail|error|reject|denied/.test(t)) return 'error'
  if (/assign|approv|complete|success|signed/.test(t)) return 'success'
  return 'info'
}
