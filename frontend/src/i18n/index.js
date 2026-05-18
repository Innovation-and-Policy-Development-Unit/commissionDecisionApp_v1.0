import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './locales/en.json'
import bi from './locales/bi.json'
import fr from './locales/fr.json'

const STORAGE_KEY = 'scdms-lang'
const DEFAULT_LANG = 'en'

/**
 * Supported UI languages for the Vanuatu Public Service.
 * `code`        - i18next resource key
 * `htmlLang`    - value applied to <html lang="…"> (BCP-47)
 * `nativeLabel` - what the language calls itself (used in the switcher)
 * `englishLabel` - English name (used in i18nKey fallback)
 */
export const SUPPORTED_LANGUAGES = [
  { code: 'en', htmlLang: 'en',    nativeLabel: 'English',  englishLabel: 'English',  short: 'EN', i18nKey: 'language.english' },
  { code: 'fr', htmlLang: 'fr',    nativeLabel: 'Français', englishLabel: 'French',   short: 'FR', i18nKey: 'language.french'  },
  { code: 'bi', htmlLang: 'bi',    nativeLabel: 'Bislama',  englishLabel: 'Bislama',  short: 'BI', i18nKey: 'language.bislama' },
]

export const LANGUAGE_CODES = SUPPORTED_LANGUAGES.map(l => l.code)

export function getLanguageMeta(code) {
  return SUPPORTED_LANGUAGES.find(l => l.code === code) || SUPPORTED_LANGUAGES[0]
}

function readInitialLanguage() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved && LANGUAGE_CODES.includes(saved)) return saved
  } catch {
    /* localStorage may be blocked (private mode, sandboxed iframe) */
  }
  if (typeof navigator !== 'undefined' && navigator.language) {
    const short = navigator.language.toLowerCase().split('-')[0]
    if (LANGUAGE_CODES.includes(short)) return short
  }
  return DEFAULT_LANG
}

const initialLang = readInitialLanguage()

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    bi: { translation: bi },
    fr: { translation: fr },
  },
  lng: initialLang,
  fallbackLng: DEFAULT_LANG,
  supportedLngs: LANGUAGE_CODES,
  load: 'languageOnly',
  interpolation: { escapeValue: false },
  returnEmptyString: false,
})

/** Mirror current language to <html lang=…> and persist user choice. */
function applyHtmlLang(code) {
  const meta = getLanguageMeta(code)
  if (typeof document !== 'undefined' && document.documentElement) {
    document.documentElement.setAttribute('lang', meta.htmlLang)
  }
}

applyHtmlLang(initialLang)

i18n.on('languageChanged', (lng) => {
  applyHtmlLang(lng)
  try {
    localStorage.setItem(STORAGE_KEY, lng)
  } catch {
    /* ignore */
  }
})

/**
 * Programmatically change the active language. Falls back to `en` on unknown code.
 * Safe to call from event handlers.
 */
export function changeLanguage(code) {
  const target = LANGUAGE_CODES.includes(code) ? code : DEFAULT_LANG
  return i18n.changeLanguage(target)
}

export default i18n
