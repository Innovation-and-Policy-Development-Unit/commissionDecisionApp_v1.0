import { useTranslation } from 'react-i18next'
import { Globe24Regular, Checkmark24Regular } from '@fluentui/react-icons'
import {
  Menu,
  MenuTrigger,
  MenuPopover,
  MenuList,
  MenuItem,
} from '@fluentui/react-components'
import { SUPPORTED_LANGUAGES, changeLanguage, getLanguageMeta } from '../../i18n'
import BaseButton from './BaseButton'

/**
 * Top-bar language switcher — Fluent Menu + BaseButton trigger.
 */
export default function LanguageSwitcher({ compact = false }) {
  const { t, i18n } = useTranslation()
  const currentCode = i18n.resolvedLanguage || i18n.language || 'en'
  const currentMeta = getLanguageMeta(currentCode)

  return (
    <Menu>
      <MenuTrigger disableButtonEnhancement>
        <BaseButton
          variant="ghost"
          size="icon"
          touchTarget
          aria-label={t('language.current', { name: currentMeta.nativeLabel })}
          title={t('language.switch')}
          className="text-slate-700 dark:text-slate-200"
          icon={<Globe24Regular />}
        >
          {!compact && (
            <span className="text-xs font-semibold tracking-wide uppercase" aria-hidden="true">
              {currentMeta.short}
            </span>
          )}
          <span className="sr-only">
            {t('language.label')}: {currentMeta.nativeLabel}
          </span>
        </BaseButton>
      </MenuTrigger>
      <MenuPopover>
        <MenuList aria-label={t('language.label')}>
          {SUPPORTED_LANGUAGES.map(lang => {
            const isActive = lang.code === currentCode
            return (
              <MenuItem
                key={lang.code}
                lang={lang.htmlLang}
                icon={isActive ? <Checkmark24Regular /> : undefined}
                onClick={() => changeLanguage(lang.code)}
                aria-current={isActive ? 'true' : undefined}
              >
                <span className="flex items-center gap-2">
                  <span className="text-[10px] font-bold tracking-wide uppercase w-6 opacity-70">
                    {lang.short}
                  </span>
                  {lang.nativeLabel}
                </span>
              </MenuItem>
            )
          })}
        </MenuList>
      </MenuPopover>
    </Menu>
  )
}
