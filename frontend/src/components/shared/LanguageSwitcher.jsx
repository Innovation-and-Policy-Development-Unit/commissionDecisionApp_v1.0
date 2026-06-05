import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Globe, Check } from 'lucide-react'
import { SUPPORTED_LANGUAGES, changeLanguage, getLanguageMeta } from '../../i18n'
import BaseButton from './BaseButton'

/** Top-bar language switcher (Tailwind dropdown). */
export default function LanguageSwitcher({ compact = false }) {
  const { t, i18n } = useTranslation()
  const currentCode = i18n.resolvedLanguage || i18n.language || 'en'
  const currentMeta = getLanguageMeta(currentCode)
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    const onEsc = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onEsc)
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onEsc) }
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <BaseButton
        variant="ghost"
        size="icon"
        touchTarget
        aria-label={t('language.current', { name: currentMeta.nativeLabel })}
        aria-haspopup="menu"
        aria-expanded={open}
        title={t('language.switch')}
        className="text-slate-700 dark:text-slate-200"
        icon={<Globe size={20} />}
        onClick={() => setOpen(o => !o)}
      >
        {!compact && (
          <span className="text-xs font-semibold tracking-wide uppercase" aria-hidden="true">{currentMeta.short}</span>
        )}
        <span className="sr-only">{t('language.label')}: {currentMeta.nativeLabel}</span>
      </BaseButton>
      {open && (
        <ul role="menu" aria-label={t('language.label')}
          className="absolute right-0 mt-1 z-50 w-44 card p-1 shadow-card-lg">
          {SUPPORTED_LANGUAGES.map(lang => {
            const isActive = lang.code === currentCode
            return (
              <li key={lang.code} role="none">
                <button
                  type="button"
                  role="menuitem"
                  lang={lang.htmlLang}
                  aria-current={isActive ? 'true' : undefined}
                  onClick={() => { changeLanguage(lang.code); setOpen(false) }}
                  className="w-full flex items-center gap-2 px-2.5 py-2 rounded-md text-sm text-left text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50"
                >
                  <span className="text-[10px] font-bold tracking-wide uppercase w-6 opacity-70">{lang.short}</span>
                  <span className="flex-1">{lang.nativeLabel}</span>
                  {isActive && <Check size={15} className="text-primary-500" />}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
