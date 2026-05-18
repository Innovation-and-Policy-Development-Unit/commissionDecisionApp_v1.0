import { useState, useRef, useEffect, useCallback, useId } from 'react'
import { useTranslation } from 'react-i18next'
import { Globe, Check } from 'lucide-react'
import clsx from 'clsx'
import { SUPPORTED_LANGUAGES, changeLanguage, getLanguageMeta } from '../../i18n'

/**
 * Top-bar language switcher for English / French / Bislama.
 *
 * Accessibility:
 *   - Trigger button exposes aria-haspopup="listbox" + aria-expanded + aria-label.
 *   - Listbox uses role="listbox" with role="option" children and aria-selected.
 *   - Closes on outside-click and on Escape.
 *   - Keyboard: Enter/Space toggles, Esc closes, focus is restored to trigger on close.
 */
export default function LanguageSwitcher({ compact = false }) {
  const { t, i18n } = useTranslation()
  const [open, setOpen] = useState(false)
  const containerRef = useRef(null)
  const triggerRef = useRef(null)
  const listboxId = useId()

  const currentCode = i18n.resolvedLanguage || i18n.language || 'en'
  const currentMeta = getLanguageMeta(currentCode)

  const close = useCallback(() => {
    setOpen(false)
    // Restore focus to the trigger for keyboard users.
    if (triggerRef.current) triggerRef.current.focus()
  }, [])

  const toggle = useCallback(() => setOpen(o => !o), [])

  // Outside-click + Escape
  useEffect(() => {
    if (!open) return
    function handleMouseDown(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    function handleKey(e) {
      if (e.key === 'Escape') {
        e.stopPropagation()
        close()
      }
    }
    document.addEventListener('mousedown', handleMouseDown)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleMouseDown)
      document.removeEventListener('keydown', handleKey)
    }
  }, [open, close])

  const handleSelect = useCallback((code) => {
    changeLanguage(code)
    setOpen(false)
    if (triggerRef.current) triggerRef.current.focus()
  }, [])

  return (
    <div className="relative" ref={containerRef}>
      <button
        ref={triggerRef}
        type="button"
        onClick={toggle}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-label={t('language.current', { name: currentMeta.nativeLabel })}
        title={t('language.switch')}
        className="flex items-center gap-1.5 p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
      >
        <Globe size={20} aria-hidden="true" />
        {!compact && (
          <span className="text-xs font-semibold tracking-wide uppercase" aria-hidden="true">
            {currentMeta.short}
          </span>
        )}
        <span className="sr-only">
          {t('language.label')}: {currentMeta.nativeLabel}
        </span>
      </button>

      {open && (
        <ul
          id={listboxId}
          role="listbox"
          aria-label={t('language.label')}
          className="absolute end-0 top-full mt-2 w-44 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 z-50 py-1 animate-fade-in"
        >
          {SUPPORTED_LANGUAGES.map(lang => {
            const isActive = lang.code === currentCode
            return (
              <li key={lang.code} role="none">
                <button
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  lang={lang.htmlLang}
                  onClick={() => handleSelect(lang.code)}
                  className={clsx(
                    'w-full flex items-center justify-between gap-2 px-3 py-2 text-sm transition-colors focus:outline-none focus-visible:bg-slate-100 dark:focus-visible:bg-slate-700/60',
                    isActive
                      ? 'text-primary-600 dark:text-primary-400 font-medium bg-primary-50/40 dark:bg-primary-900/10'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/40'
                  )}
                >
                  <span className="flex items-center gap-2">
                    <span className="text-[10px] font-bold tracking-wide uppercase text-slate-400 dark:text-slate-500 w-6">
                      {lang.short}
                    </span>
                    <span>{lang.nativeLabel}</span>
                  </span>
                  {isActive && <Check size={14} aria-hidden="true" />}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
