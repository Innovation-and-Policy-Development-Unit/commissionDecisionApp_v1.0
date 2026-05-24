import { getFluentThemes } from './themes'
import { syncTypographyToDocument } from './syncTypographyToDocument'

function readColorPreset() {
  try {
    const saved = localStorage.getItem('liner-color-preset')
    if (saved) return saved
  } catch {
    /* ignore */
  }
  return 'navy'
}

/** Apply Fluent typography tokens before first paint (avoids FOUT / wrong fallback stack). */
export function initFluentTypography() {
  const preset = readColorPreset()
  const { light } = getFluentThemes(preset)
  syncTypographyToDocument(light)
}
