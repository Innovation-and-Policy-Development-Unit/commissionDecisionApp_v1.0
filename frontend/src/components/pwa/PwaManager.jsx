import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { registerSW } from 'virtual:pwa-register'
import { Download, RefreshCw, WifiOff, X } from 'lucide-react'
import clsx from 'clsx'

function isStandaloneDisplay() {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(display-mode: standalone)').matches
    || window.navigator.standalone === true
  )
}

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
  const [installDismissed, setInstallDismissed] = useState(false)
  const updateSWRef = useRef(null)

  useEffect(() => {
    const updateSW = registerSW({
      immediate: true,
      onNeedRefresh() {
        setNeedRefresh(true)
      },
      onOfflineReady() {
        /* shell cached — no toast to avoid noise on every deploy */
      },
    })
    updateSWRef.current = updateSW
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
      // Defer the browser mini-infobar; we call prompt() from the install button.
      e.preventDefault()
      setInstallPrompt(e)
      /* Chrome may log "Banner not shown…" in DevTools — expected when using a custom install UI. */
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
    setInstallDismissed(true)
  }, [installPrompt])

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
                  onClick={() => setInstallDismissed(true)}
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
