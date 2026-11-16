// A short two-note chime for new notifications, synthesised with the Web Audio
// API so no audio file ships or loads. Preferences live in localStorage, like
// the desktop-alert setting, so they are per browser.

const STORAGE_ENABLED = 'scdms.notificationSound.enabled'
const STORAGE_VOLUME = 'scdms.notificationSound.volume'
const DEFAULT_VOLUME = 0.6

let ctx = null
let unlockInstalled = false

export function isNotificationSoundSupported() {
  return typeof window !== 'undefined' && !!(window.AudioContext || window.webkitAudioContext)
}

/** On unless the user switched it off. */
export function getNotificationSoundEnabled() {
  try {
    return localStorage.getItem(STORAGE_ENABLED) !== 'false'
  } catch {
    return true
  }
}

export function setNotificationSoundEnabled(enabled) {
  try {
    localStorage.setItem(STORAGE_ENABLED, enabled ? 'true' : 'false')
  } catch {
    /* private mode — the choice just won't persist */
  }
}

export function getNotificationSoundVolume() {
  try {
    const v = parseFloat(localStorage.getItem(STORAGE_VOLUME))
    return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : DEFAULT_VOLUME
  } catch {
    return DEFAULT_VOLUME
  }
}

export function setNotificationSoundVolume(volume) {
  try {
    localStorage.setItem(STORAGE_VOLUME, String(Math.min(1, Math.max(0, volume))))
  } catch {
    /* ignore */
  }
}

function getContext() {
  if (!isNotificationSoundSupported()) return null
  if (!ctx) {
    const Ctor = window.AudioContext || window.webkitAudioContext
    ctx = new Ctor()
  }
  return ctx
}

/** Browsers keep audio locked until the user has interacted with the page, so
 *  unlock it on the first click or key press. Safe to call more than once. */
export function installNotificationSoundUnlock() {
  if (unlockInstalled || typeof window === 'undefined') return
  unlockInstalled = true
  const unlock = () => {
    const c = getContext()
    if (c && c.state === 'suspended') c.resume().catch(() => {})
    window.removeEventListener('pointerdown', unlock)
    window.removeEventListener('keydown', unlock)
  }
  window.addEventListener('pointerdown', unlock)
  window.addEventListener('keydown', unlock)
}

/**
 * Play the chime. Resolves true if it was started, false if audio is
 * unsupported, still locked by the browser, or muted (volume 0). Never throws.
 * `force` plays even when the setting is off (for the "Test sound" button).
 */
export async function playNotificationChime({ force = false } = {}) {
  try {
    if (!force && !getNotificationSoundEnabled()) return false
    const volume = getNotificationSoundVolume()
    if (volume <= 0) return false
    const c = getContext()
    if (!c) return false
    if (c.state === 'suspended') await c.resume()
    if (c.state !== 'running') return false

    const t0 = c.currentTime + 0.02
    const gain = c.createGain()
    gain.connect(c.destination)
    // Two quick notes, a rising fifth: E5 then B5.
    ;[[659.25, 0], [987.77, 0.14]].forEach(([freq, offset]) => {
      const osc = c.createOscillator()
      const g = c.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      osc.connect(g)
      g.connect(gain)
      const start = t0 + offset
      g.gain.setValueAtTime(0.0001, start)
      g.gain.exponentialRampToValueAtTime(0.4 * volume, start + 0.02)
      g.gain.exponentialRampToValueAtTime(0.0001, start + 0.32)
      osc.start(start)
      osc.stop(start + 0.34)
    })
    return true
  } catch {
    return false
  }
}
