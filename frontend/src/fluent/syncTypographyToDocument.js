/** Typography token prefixes from @fluentui/react-theme */
const TYPOGRAPHY_PREFIXES = ['fontFamily', 'fontSize', 'lineHeight', 'fontWeight', 'letterSpacing']

/** Fluent default stack (matches createLightTheme) when theme is not mounted yet */
export const FLUENT_FONT_FALLBACK = [
  'Segoe UI',
  'Segoe UI Web (West European)',
  '-apple-system',
  'BlinkMacSystemFont',
  'Roboto',
  'Helvetica Neue',
  'sans-serif',
].join(', ')

export const FLUENT_MONO_FALLBACK = 'Consolas, "Courier New", monospace'

/**
 * Mirror Fluent theme typography tokens onto :root so Tailwind + legacy CSS can use them.
 */
export function syncTypographyToDocument(theme) {
  const root = document.documentElement
  if (!theme) return

  for (const [key, value] of Object.entries(theme)) {
    if (value == null || value === '') continue
    if (!TYPOGRAPHY_PREFIXES.some(prefix => key.startsWith(prefix))) continue
    root.style.setProperty(`--${key}`, String(value))
  }

  if (theme.fontFamilyBase) {
    root.style.setProperty('--font-family-base', theme.fontFamilyBase)
    root.style.fontFamily = theme.fontFamilyBase
  }
  if (theme.fontFamilyMonospace) {
    root.style.setProperty('--font-family-monospace', theme.fontFamilyMonospace)
  }
  if (theme.fontSizeBase300) {
    root.style.fontSize = theme.fontSizeBase300
  }
  if (theme.lineHeightBase300) {
    root.style.lineHeight = theme.lineHeightBase300
  }
  if (theme.fontWeightRegular) {
    root.style.fontWeight = theme.fontWeightRegular
  }
}
