import { useState, useRef, useCallback, useId } from 'react'
import { useTranslation } from 'react-i18next'
import { Globe, Check } from 'lucide-react'
import clsx from 'clsx'
import { SUPPORTED_LANGUAGES, changeLanguage, getLanguageMeta } from '../../i18n'
import BaseButton from './BaseButton'
import { useDismissible } from '../../hooks/useDismissible'

/**
 * Top-bar language switcher for English / French / Bislama.
 * Uses BaseButton for focus, keyboard, and aria patterns.
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
    triggerRef.current?.focus()
  }, [])

  useDismissible({ open, onClose: close, containerRef })

  const toggle = useCallback(() => setOpen(o => !o), [])

  const handleSelect = useCallback((code) => {
    changeLanguage(code)
    setOpen(false)
    triggerRef.current?.focus()
  }, [])

  return (
    <div className="relative" ref={containerRef}>
      <BaseButton
        ref={triggerRef}
        variant="ghost"
        size="icon"
        touchTarget
        onClick={toggle}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-label={t('language.current', { name: currentMeta.nativeLabel })}
        title={t('language.switch')}
        className="text-slate-700 dark:text-slate-200"
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
      </BaseButton>

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
                <BaseButton
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  lang={lang.htmlLang}
                  variant="unstyled"
                  size="md"
                  onClick={() => handleSelect(lang.code)}
                  className={clsx(
                    'w-full justify-between rounded-none px-3 py-2 font-normal',
                    isActive
                      ? 'text-primary-800 dark:text-primary-200 font-medium bg-primary-50/60 dark:bg-primary-900/20'
                      : 'text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-700/40',
                  )}
                >
                  <span className="flex items-center gap-2">
                    <span className="text-[10px] font-bold tracking-wide uppercase text-slate-500 dark:text-slate-400 w-6">
                      {lang.short}
                    </span>
                    <span>{lang.nativeLabel}</span>
                  </span>
                  {isActive && <Check size={14} aria-hidden="true" />}
                </BaseButton>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
