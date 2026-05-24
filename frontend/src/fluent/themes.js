import { createDarkTheme, createLightTheme } from '@fluentui/react-components'
import { BRAND_BY_PRESET, navyBrand } from './brandPresets'

const cache = new Map()

/**
 * @param {string} colorPreset — liner-color-preset (navy, blue, …)
 */
export function getFluentThemes(colorPreset = 'navy') {
  const key = colorPreset in BRAND_BY_PRESET ? colorPreset : 'navy'
  if (cache.has(key)) return cache.get(key)

  const brand = BRAND_BY_PRESET[key] || navyBrand
  const themes = {
    light: createLightTheme(brand),
    dark: createDarkTheme(brand),
  }
  cache.set(key, themes)
  return themes
}
