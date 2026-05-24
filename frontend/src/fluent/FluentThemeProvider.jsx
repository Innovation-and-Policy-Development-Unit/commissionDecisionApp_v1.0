import { useMemo, useEffect } from 'react'
import { FluentProvider } from '@fluentui/react-components'
import { useTheme } from '../context/ThemeContext'
import { getFluentThemes } from './themes'
import { syncTypographyToDocument } from './syncTypographyToDocument'

/**
 * Bridges liner ThemeContext (light / dim / dark + color preset) to Fluent UI v9.
 * Tailwind layout and legacy .btn-* classes continue to work alongside Fluent controls.
 */
export default function FluentThemeProvider({ children }) {
  const { theme, isRTL, colorPreset } = useTheme()

  const fluentTheme = useMemo(() => {
    const { light, dark } = getFluentThemes(colorPreset)
    return theme === 'light' ? light : dark
  }, [theme, colorPreset])

  useEffect(() => {
    syncTypographyToDocument(fluentTheme)
  }, [fluentTheme])

  return (
    <FluentProvider theme={fluentTheme} dir={isRTL ? 'rtl' : 'ltr'}>
      {children}
    </FluentProvider>
  )
}
