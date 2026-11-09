/** Appearance options. `swatch` colours are only for the mini previews in the panel; the real
 * palettes are the [data-theme] blocks in index.css. */
export const PRESETS = [
  { id: 'psc-blue', label: 'PSC Blue', note: 'Official default', swatch: ['#004276', '#003866', '#dcecfc'] },
  { id: 'ocean', label: 'Ocean', note: 'Calm, clear blue', swatch: ['#006699', '#004d80', '#b3c7e6'] },
  { id: 'violet', label: 'Violet', note: 'Deep purple', swatch: ['#7c3aed', '#6d28d9', '#ede9fe'] },
  { id: 'emerald', label: 'Emerald', note: 'Fresh, steady green', swatch: ['#10b981', '#059669', '#d1fae5'] },
  { id: 'teal', label: 'Teal', note: 'Cool blue-green', swatch: ['#0f766e', '#115e59', '#ccfbf1'] },
  { id: 'amber', label: 'Amber', note: 'Warm earth tones', swatch: ['#f97316', '#ea580c', '#ffedd5'] },
  { id: 'rose', label: 'Rose', note: 'Soft crimson', swatch: ['#f43f5e', '#e11d48', '#ffe4e6'] },
  { id: 'graphite', label: 'Graphite', note: 'Neutral and understated', swatch: ['#334155', '#1e293b', '#e2e8f0'] },
]

// Saved choices from before this panel existed.
export const LEGACY_PRESET = {
  navy: 'psc-blue', blue: 'ocean', 'corporate-blue': 'ocean', green: 'emerald', orange: 'amber', red: 'rose',
}

export const FONTS = [
  { id: 'system', label: 'Standard', sample: "'Segoe UI', sans-serif" },
  { id: 'humanist', label: 'Friendly', sample: "Candara, Calibri, sans-serif" },
  { id: 'readable', label: 'Easy to read', sample: 'Verdana, Tahoma, sans-serif' },
  { id: 'serif', label: 'Serif', sample: 'Georgia, serif' },
  { id: 'mono', label: 'Monospace', sample: "Consolas, monospace" },
]

export const FONT_SIZES = [
  { id: 'small', label: 'Small' },
  { id: 'default', label: 'Default' },
  { id: 'large', label: 'Large' },
  { id: 'xlarge', label: 'Extra large' },
]

export const FACTORY = {
  preset: 'psc-blue', mode: 'light', density: 'comfortable', corners: 'default', font: 'system', fontSize: 'default',
}
