import api from '../api/client'
import i18n from 'i18next'

const LANGS = ['en', 'fr', 'bi']

/**
 * Merge API translation bundles (file baseline + DB overrides) into i18next.
 * Safe to call before login — bundles endpoint is public.
 */
export async function loadRemoteTranslationBundles() {
  const { data } = await api.get('/ui-translations/bundles/')
  if (!data || typeof data !== 'object') return false

  for (const lang of LANGS) {
    const bundle = data[lang]
    if (bundle && typeof bundle === 'object') {
      i18n.addResourceBundle(lang, 'translation', bundle, true, true)
    }
  }
  return true
}
