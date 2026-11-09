import { useMemo } from 'react'
import { useTheme } from '../context/ThemeContext'

const presetColors = {
  'psc-blue': { hex: '#004276', light: '#468cc8' },
  ocean:      { hex: '#006699', light: '#3ca9d5' },
  violet:     { hex: '#7c3aed', light: '#c4b5fd' },
  emerald:    { hex: '#10b981', light: '#6ee7b7' },
  teal:       { hex: '#0f766e', light: '#5eead4' },
  amber:      { hex: '#f97316', light: '#fdba74' },
  rose:       { hex: '#f43f5e', light: '#fda4af' },
  graphite:   { hex: '#334155', light: '#cbd5e1' },
}

export default function useChartColors() {
  const { colorPreset, isDark } = useTheme()

  return useMemo(() => {
    const preset = presetColors[colorPreset] || presetColors['psc-blue']
    const primary = isDark ? preset.light : preset.hex

    return {
      primary,
      cyan:    isDark ? '#67e8f9' : '#06b6d4',
      emerald: isDark ? '#6ee7b7' : '#10b981',
      amber:   isDark ? '#fcd34d' : '#f59e0b',
      rose:    isDark ? '#fda4af' : '#f43f5e',
      violet:  isDark ? '#c4b5fd' : '#8b5cf6',
      grid:    isDark ? '#334155' : '#e2e8f0',
      axis:    isDark ? '#64748b' : '#94a3b8',
      bg:      isDark ? '#1e293b' : '#f1f5f9',
    }
  }, [colorPreset, isDark])
}
