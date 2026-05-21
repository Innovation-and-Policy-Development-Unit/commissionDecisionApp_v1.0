/** Per-user automatic screen lock after inactivity (minutes). Stored in localStorage. */

export const INACTIVITY_LOCK_SETTINGS_EVENT = 'psc-auth:inactivity-settings-changed'

export const DEFAULT_INACTIVITY_LOCK_MINUTES = 15
export const MIN_INACTIVITY_LOCK_MINUTES = 5
export const MAX_INACTIVITY_LOCK_MINUTES = 120

export const INACTIVITY_LOCK_OPTIONS = [
  { value: 5, labelKey: 'account.inactivity_lock_minutes', labelCount: 5 },
  { value: 10, labelKey: 'account.inactivity_lock_minutes', labelCount: 10 },
  { value: 15, labelKey: 'account.inactivity_lock_minutes', labelCount: 15 },
  { value: 30, labelKey: 'account.inactivity_lock_minutes', labelCount: 30 },
  { value: 45, labelKey: 'account.inactivity_lock_minutes', labelCount: 45 },
  { value: 60, labelKey: 'account.inactivity_lock_minutes', labelCount: 60 },
  { value: 0, labelKey: 'account.inactivity_lock_never', labelCount: null },
]

function storageKey(username) {
  return `psc-inactivity-lock-minutes:${username || '_'}`
}

export function getInactivityLockMinutes(username) {
  if (!username) return DEFAULT_INACTIVITY_LOCK_MINUTES
  try {
    const raw = localStorage.getItem(storageKey(username))
    if (raw === null || raw === '') return DEFAULT_INACTIVITY_LOCK_MINUTES
    const n = parseInt(raw, 10)
    if (Number.isNaN(n)) return DEFAULT_INACTIVITY_LOCK_MINUTES
    if (n === 0) return 0
    return Math.min(MAX_INACTIVITY_LOCK_MINUTES, Math.max(MIN_INACTIVITY_LOCK_MINUTES, n))
  } catch {
    return DEFAULT_INACTIVITY_LOCK_MINUTES
  }
}

export function setInactivityLockMinutes(username, minutes) {
  if (!username) return
  const n = parseInt(minutes, 10)
  const value = n === 0 ? 0 : Math.min(MAX_INACTIVITY_LOCK_MINUTES, Math.max(MIN_INACTIVITY_LOCK_MINUTES, n))
  try {
    localStorage.setItem(storageKey(username), String(value))
    window.dispatchEvent(new CustomEvent(INACTIVITY_LOCK_SETTINGS_EVENT))
  } catch { /* private mode */ }
}

/** Milliseconds until auto-lock; 0 means disabled. */
export function getInactivityLockMs(username) {
  const minutes = getInactivityLockMinutes(username)
  if (!minutes) return 0
  return minutes * 60 * 1000
}
