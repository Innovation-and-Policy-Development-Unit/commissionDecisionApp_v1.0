import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Bell, BellOff, Monitor } from 'lucide-react'
import {
  getDesktopNotificationsEnabled,
  getNotificationPermission,
  isDesktopNotificationSupported,
  requestNotificationPermission,
  setDesktopNotificationsEnabled,
} from '../../utils/browserNotifications'

export default function DesktopNotificationSettings({ compact = false, onChange }) {
  const { t } = useTranslation()
  const [supported] = useState(() => isDesktopNotificationSupported())
  const [permission, setPermission] = useState(() => getNotificationPermission())
  const [enabled, setEnabled] = useState(() => getDesktopNotificationsEnabled())

  const sync = useCallback(() => {
    setPermission(getNotificationPermission())
    setEnabled(getDesktopNotificationsEnabled())
  }, [])

  useEffect(() => {
    sync()
  }, [sync])

  const handleToggle = useCallback(async () => {
    if (!supported) return

    if (!enabled) {
      const result = await requestNotificationPermission()
      setPermission(result)
      if (result !== 'granted') return
      setDesktopNotificationsEnabled(true)
      setEnabled(true)
      onChange?.(true)
      return
    }

    setDesktopNotificationsEnabled(false)
    setEnabled(false)
    onChange?.(false)
  }, [supported, enabled, onChange])

  if (!supported) {
    return (
      <p className="text-xs text-slate-500 dark:text-slate-400">
        {t('notifications.desktop_unsupported')}
      </p>
    )
  }

  if (compact) {
    return (
      <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/50">
        <div className="flex items-start gap-2">
          <Monitor size={16} className="text-primary-500 mt-0.5 shrink-0" aria-hidden />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-slate-700 dark:text-slate-200">
              {t('notifications.desktop_title')}
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              {permission === 'denied'
                ? t('notifications.desktop_denied_hint')
                : t('notifications.desktop_hint')}
            </p>
          </div>
          <button
            type="button"
            onClick={handleToggle}
            disabled={permission === 'denied'}
            className={`shrink-0 text-xs font-medium px-2.5 py-1 rounded-lg border transition-colors ${
              enabled
                ? 'border-primary-500 text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20'
                : 'border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700'
            } disabled:opacity-50`}
          >
            {enabled ? t('notifications.desktop_on') : t('notifications.desktop_enable')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-start gap-4">
      <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
        {enabled ? (
          <Bell size={18} className="text-amber-600 dark:text-amber-400" />
        ) : (
          <BellOff size={18} className="text-slate-400" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
          {t('notifications.desktop_title')}
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          {permission === 'denied'
            ? t('notifications.desktop_denied_hint')
            : t('notifications.desktop_hint')}
        </p>
        <button
          type="button"
          onClick={handleToggle}
          disabled={permission === 'denied'}
          className="mt-3 inline-flex items-center gap-2 text-sm font-medium px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700/50 disabled:opacity-50 transition-colors"
        >
          <Monitor size={14} />
          {enabled ? t('notifications.desktop_disable') : t('notifications.desktop_enable')}
        </button>
      </div>
    </div>
  )
}
