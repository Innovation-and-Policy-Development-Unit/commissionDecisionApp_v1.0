import { useState } from 'react'
import { Check, Monitor, Moon, RotateCcw, Search, Sun, X } from 'lucide-react'
import clsx from 'clsx'
import { useTheme } from '../../context/ThemeContext'
import { FONTS, FONT_SIZES, PRESETS } from '../../context/appearancePresets'

/** Appearance: theme, colour mode, density, corners, font and font size. "Just me" is saved to the
 * user's account; "Everyone" (administrators only) sets the organisation default. */

function Toggle({ checked, onChange, label }) {
  return (
    <label className="flex items-center justify-between cursor-pointer group">
      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{label}</span>
      <button
        type="button" role="switch" aria-checked={checked} onClick={onChange}
        className={clsx('relative w-11 h-6 rounded-full transition-colors duration-200', checked ? 'bg-primary-500' : 'bg-slate-200 dark:bg-slate-600')}
      >
        <span className={clsx(
          'absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200 start-0.5',
          checked && 'translate-x-5 rtl:-translate-x-5',
        )} />
      </button>
    </label>
  )
}

function Segmented({ value, options, onChange, label }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex rounded-xl bg-slate-100 dark:bg-slate-700/60 p-1 gap-1">
      {options.map((o) => (
        <button
          key={o.id} type="button" role="radio" aria-checked={value === o.id} onClick={() => onChange(o.id)}
          className={clsx(
            'flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-sm transition-colors',
            value === o.id
              ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-semibold shadow-sm'
              : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white',
          )}
        >
          {o.icon}{o.label}
        </button>
      ))}
    </div>
  )
}

function SectionTitle({ children }) {
  return <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">{children}</h4>
}

function PresetCard({ preset, active, onClick }) {
  const [main, dark, light] = preset.swatch
  return (
    <button
      type="button" onClick={onClick} aria-pressed={active}
      className={clsx(
        'relative text-start rounded-xl border-2 p-2.5 transition-all',
        active ? 'border-primary-500 shadow-glow' : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-500',
      )}
    >
      {active && (
        <span className="absolute top-2 end-2 w-5 h-5 rounded-full bg-primary-500 text-white flex items-center justify-center"><Check size={12} /></span>
      )}
      <span className="block h-14 rounded-lg bg-slate-50 dark:bg-slate-900/60 p-2 mb-2">
        <span className="flex gap-1.5 h-full">
          <span className="flex flex-col gap-1 w-3">
            <span className="h-1.5 rounded-sm" style={{ background: main }} />
            <span className="h-1 rounded-sm bg-slate-200 dark:bg-slate-700" />
            <span className="h-1 rounded-sm bg-slate-200 dark:bg-slate-700" />
          </span>
          <span className="flex-1 flex flex-col gap-1">
            <span className="h-2 rounded-sm" style={{ background: main }} />
            <span className="h-1.5 rounded-sm bg-slate-200 dark:bg-slate-700 w-3/4" />
            <span className="flex gap-1 mt-auto">
              <span className="h-2.5 flex-1 rounded-sm" style={{ background: dark }} />
              <span className="h-2.5 flex-1 rounded-sm" style={{ background: main }} />
              <span className="h-2.5 flex-1 rounded-sm" style={{ background: light }} />
            </span>
          </span>
        </span>
      </span>
      <span className="block text-sm font-semibold text-slate-800 dark:text-slate-100">{preset.label}</span>
      <span className="block text-xs text-slate-500 dark:text-slate-400">{preset.note}</span>
    </button>
  )
}

export default function SettingsPanel() {
  const {
    appearance, userChoices, orgDefault, canSetOrg, setAppearance, resetAppearance,
    isRTL, toggleRTL, sidebarCollapsed, toggleSidebar, isHorizontal, toggleHorizontal,
    settingsPanelOpen, closeSettingsPanel,
  } = useTheme()
  const [scope, setScope] = useState('me') // 'me' or 'org'
  const [query, setQuery] = useState('')

  if (!settingsPanelOpen) return null

  const editingOrg = scope === 'org' && canSetOrg
  const shown = editingOrg ? orgDefault : appearance // what the cards show as selected
  const set = (patch) => setAppearance(patch, editingOrg ? 'org' : 'me')
  const presets = PRESETS.filter((p) => `${p.label} ${p.note}`.toLowerCase().includes(query.trim().toLowerCase()))
  const personalised = Object.keys(userChoices || {}).length > 0

  return (
    <>
      <div className="settings-overlay" onClick={closeSettingsPanel} />
      <div
        role="dialog" aria-label="Appearance"
        className="fixed top-0 end-0 h-full w-full sm:w-96 bg-white dark:bg-slate-800 border-s border-slate-200 dark:border-slate-700 z-50 flex flex-col animate-slide-in-right rtl:animate-slide-in-left shadow-card-lg"
      >
        <div className="flex items-start justify-between px-5 pt-4 pb-3">
          <div>
            <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100">Appearance</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Choose how the interface looks</p>
          </div>
          <button onClick={closeSettingsPanel} aria-label="Close" className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar px-5 pb-5 space-y-5">
          {canSetOrg && (
            <Segmented
              label="Who this applies to" value={scope} onChange={setScope}
              options={[{ id: 'me', label: 'Just me' }, { id: 'org', label: 'Everyone' }]}
            />
          )}
          {editingOrg && (
            <p className="text-xs text-amber-700 dark:text-amber-300">
              You are setting the organisation default. It applies to everyone who has not chosen their own look.
            </p>
          )}

          <label className="relative block">
            <Search size={15} className="absolute start-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search themes…"
              className="input ps-9 w-full text-sm"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            {presets.map((p) => (
              <PresetCard key={p.id} preset={p} active={shown.preset === p.id} onClick={() => set({ preset: p.id })} />
            ))}
            {presets.length === 0 && <p className="col-span-2 text-sm text-slate-500">No theme matches “{query}”.</p>}
          </div>

          <div>
            <SectionTitle>Colour mode</SectionTitle>
            <Segmented
              label="Colour mode" value={shown.mode} onChange={(mode) => set({ mode })}
              options={[
                { id: 'light', label: 'Light', icon: <Sun size={14} /> },
                { id: 'dark', label: 'Dark', icon: <Moon size={14} /> },
                { id: 'system', label: 'System', icon: <Monitor size={14} /> },
              ]}
            />
          </div>

          <div>
            <SectionTitle>Density</SectionTitle>
            <Segmented
              label="Density" value={shown.density} onChange={(density) => set({ density })}
              options={[{ id: 'comfortable', label: 'Comfortable' }, { id: 'compact', label: 'Compact' }]}
            />
          </div>

          <div>
            <SectionTitle>Corners</SectionTitle>
            <Segmented
              label="Corners" value={shown.corners} onChange={(corners) => set({ corners })}
              options={[{ id: 'sharp', label: 'Sharp' }, { id: 'default', label: 'Default' }, { id: 'round', label: 'Round' }]}
            />
          </div>

          <div>
            <SectionTitle>Font</SectionTitle>
            <div className="grid grid-cols-2 gap-2">
              {FONTS.map((f) => (
                <button
                  key={f.id} type="button" aria-pressed={shown.font === f.id} onClick={() => set({ font: f.id })}
                  className={clsx(
                    'rounded-xl border-2 px-3 py-2 text-start transition-all',
                    shown.font === f.id ? 'border-primary-500' : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-500',
                  )}
                >
                  <span className="block text-base text-slate-800 dark:text-slate-100" style={{ fontFamily: f.sample }}>Aa Bb 123</span>
                  <span className="block text-xs text-slate-500 dark:text-slate-400">{f.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <SectionTitle>Font size</SectionTitle>
            <Segmented label="Font size" value={shown.fontSize} onChange={(fontSize) => set({ fontSize })} options={FONT_SIZES} />
          </div>

          <div className="space-y-3 pt-1">
            <SectionTitle>Layout on this device</SectionTitle>
            <Toggle checked={sidebarCollapsed} onChange={toggleSidebar} label="Collapsed sidebar" />
            <Toggle checked={isHorizontal} onChange={toggleHorizontal} label="Horizontal menu" />
            <Toggle checked={isRTL} onChange={toggleRTL} label="Right-to-left direction" />
          </div>
        </div>

        <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-700">
          {!editingOrg && (
            <button
              type="button" onClick={resetAppearance} disabled={!personalised}
              className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white disabled:opacity-40"
            >
              <RotateCcw size={15} /> Reset to organisation default
            </button>
          )}
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">
            {editingOrg ? 'Saved for the whole organisation.' : 'Your choice is saved to your account and follows you to other devices.'}
          </p>
        </div>
      </div>
    </>
  )
}
