import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Download, RefreshCw, WifiOff, X } from 'lucide-react'
import clsx from 'clsx'

function isStandaloneDisplay() {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(display-mode: standalone)').matches
    || window.navigator.standalone === true
  )
}

// Persisted per-tab so the install prompt doesn't reappear on every route change
// if PwaManager is remounted (e.g. rendered inside a route element).
const INSTALL_DISMISSED_KEY = 'pwa_install_dismissed'

/**
 * Registers the service worker and surfaces install, update, and offline UI.
 */
export default function PwaManager() {
  const { t } = useTranslation()
  const [offline, setOffline] = useState(
    () => typeof navigator !== 'undefined' && !navigator.onLine,
  )
  const [needRefresh, setNeedRefresh] = useState(false)
  const [installPrompt, setInstallPrompt] = useState(null)
  const [installDismissed, setInstallDismissed] = useState(
    () => typeof sessionStorage !== 'undefined' && sessionStorage.getItem(INSTALL_DISMISSED_KEY) === '1',
  )

  const dismissInstall = useCallback(() => {
    setInstallDismissed(true)
    try { sessionStorage.setItem(INSTALL_DISMISSED_KEY, '1') } catch { /* ignore */ }
  }, [])
  const updateSWRef = useRef(null)

  useEffect(() => {
    // Register the Workbox service worker (offline caching + Web Push). Updates
    // are user-prompted via the needRefresh banner — no surprise reloads.
    let cancelled = false
    import('virtual:pwa-register')
      .then(({ registerSW }) => {
        if (cancelled) return
        updateSWRef.current = registerSW({
          onNeedRefresh() { setNeedRefresh(true) },
          onRegisterError(err) { console.warn('SW registration failed', err) },
        })
      })
      .catch((err) => console.warn('PWA register unavailable', err))
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    const onOnline = () => setOffline(false)
    const onOffline = () => setOffline(true)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

  useEffect(() => {
    if (isStandaloneDisplay()) return undefined

    const onBeforeInstall = (e) => {
      // Keep browser default install behavior; no preventDefault to avoid
      // "Banner not shown" console warning on Chromium.
      setInstallPrompt(e)
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstall)
  }, [])

  const applyUpdate = useCallback(() => {
    updateSWRef.current?.(true)
    setNeedRefresh(false)
  }, [])

  const runInstall = useCallback(async () => {
    if (!installPrompt) return
    await installPrompt.prompt()
    await installPrompt.userChoice
    setInstallPrompt(null)
    dismissInstall()
  }, [installPrompt, dismissInstall])

  const showInstall =
    installPrompt && !installDismissed && !isStandaloneDisplay()

  return (
    <>
      {offline && (
        <div
          role="status"
          className="fixed top-0 inset-x-0 z-[90] flex items-center justify-center gap-2 bg-amber-600 px-4 py-2 text-sm font-medium text-white shadow-md"
        >
          <WifiOff size={16} aria-hidden />
          {t('pwa.offline_banner')}
        </div>
      )}

      {needRefresh && (
        <div
          role="alertdialog"
          aria-labelledby="pwa-update-title"
          className={clsx(
            'fixed bottom-4 left-4 right-4 z-[90] mx-auto max-w-md rounded-xl border border-slate-200 bg-white p-4 shadow-xl dark:border-slate-700 dark:bg-slate-900',
            offline && 'bottom-16',
          )}
        >
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300">
              <RefreshCw size={18} aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <p id="pwa-update-title" className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {t('pwa.update_title')}
              </p>
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                {t('pwa.update_body')}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" className="btn-primary text-xs py-1.5 px-3" onClick={applyUpdate}>
                  {t('pwa.update_action')}
                </button>
                <button
                  type="button"
                  className="btn-outline text-xs py-1.5 px-3"
                  onClick={() => setNeedRefresh(false)}
                >
                  {t('pwa.update_later')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showInstall && !needRefresh && (
        <div
          role="dialog"
          aria-labelledby="pwa-install-title"
          className={clsx(
            'fixed bottom-4 left-4 right-4 z-[85] mx-auto max-w-md rounded-xl border border-slate-200 bg-white p-4 shadow-xl dark:border-slate-700 dark:bg-slate-900',
            offline && 'bottom-16',
          )}
        >
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
              <Download size={18} aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <p id="pwa-install-title" className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {t('pwa.install_title')}
              </p>
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                {t('pwa.install_body')}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" className="btn-primary text-xs py-1.5 px-3" onClick={runInstall}>
                  {t('pwa.install_action')}
                </button>
                <button
                  type="button"
                  className="btn-outline text-xs py-1.5 px-3"
                  onClick={dismissInstall}
                >
                  {t('pwa.install_later')}
                </button>
              </div>
            </div>
            <button
              type="button"
              className="shrink-0 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
              onClick={() => setInstallDismissed(true)}
              aria-label={t('accessibility.close')}
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}
    </>
  )
}
