import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Volume2, VolumeX } from 'lucide-react'
import {
  getNotificationSoundEnabled,
  getNotificationSoundVolume,
  isNotificationSoundSupported,
  playNotificationChime,
  setNotificationSoundEnabled,
  setNotificationSoundVolume,
} from '../../utils/notificationSound'

export default function NotificationSoundSettings({ compact = false }) {
  const { t } = useTranslation()
  const [supported] = useState(() => isNotificationSoundSupported())
  const [enabled, setEnabled] = useState(() => getNotificationSoundEnabled())
  const [volume, setVolume] = useState(() => getNotificationSoundVolume())
  const [blocked, setBlocked] = useState(false)

  if (!supported) return null

  const toggle = () => {
    const next = !enabled
    setNotificationSoundEnabled(next)
    setEnabled(next)
    // Turning it on doubles as a preview, and the click unlocks browser audio.
    if (next) playNotificationChime().then(ok => setBlocked(!ok))
  }

  const changeVolume = e => {
    const v = Number(e.target.value)
    setVolume(v)
    setNotificationSoundVolume(v)
  }

  const test = async () => setBlocked(!(await playNotificationChime({ force: true })))

  const title = t('notifications.sound_title', 'Notification sound')
  const hint = t('notifications.sound_hint', 'Play a short chime when a new notification arrives (the site must be open in a tab).')

  if (compact) {
    return (
      <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/50 flex items-center gap-2">
        {enabled ? <Volume2 size={14} className="text-primary-500" aria-hidden /> : <VolumeX size={14} className="text-slate-400" aria-hidden />}
        <span className="flex-1 text-xs font-medium text-slate-700 dark:text-slate-200">{title}</span>
        <button
          type="button"
          onClick={toggle}
          aria-pressed={enabled}
          className={`shrink-0 text-xs font-medium px-2.5 py-1 rounded-lg border transition-colors ${
            enabled
              ? 'border-primary-500 text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20'
              : 'border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700'
          }`}
        >
          {enabled ? t('notifications.sound_on', 'On') : t('notifications.sound_off', 'Off')}
        </button>
      </div>
    )
  }

  return (
    <div className="flex items-start gap-4">
      <div className="w-10 h-10 rounded-xl bg-sky-100 dark:bg-sky-900/30 flex items-center justify-center shrink-0">
        {enabled ? <Volume2 size={18} className="text-sky-600 dark:text-sky-400" /> : <VolumeX size={18} className="text-slate-400" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{title}</p>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{hint}</p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={toggle}
            aria-pressed={enabled}
            className="inline-flex items-center gap-2 text-sm font-medium px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
          >
            {enabled ? <VolumeX size={14} /> : <Volume2 size={14} />}
            {enabled ? t('notifications.sound_disable', 'Turn sound off') : t('notifications.sound_enable', 'Turn sound on')}
          </button>
          <label className="flex items-center gap-2 text-xs text-slate-500">
            {t('notifications.sound_volume', 'Volume')}
            <input type="range" min="0" max="1" step="0.1" value={volume} onChange={changeVolume} disabled={!enabled} className="w-28" aria-label={t('notifications.sound_volume', 'Volume')} />
          </label>
          <button type="button" onClick={test} className="text-sm font-medium text-primary-600 dark:text-primary-400 hover:underline">
            {t('notifications.sound_test', 'Play test sound')}
          </button>
        </div>
        {blocked && (
          <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
            {t('notifications.sound_blocked', 'Your browser did not play the sound. Click anywhere on the page and try again, and check the tab is not muted.')}
          </p>
        )}
      </div>
    </div>
  )
}
