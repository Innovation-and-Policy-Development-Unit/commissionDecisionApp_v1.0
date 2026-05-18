import { useState, useEffect, useRef } from 'react'
import PageHeader from '../../components/shared/PageHeader'
import { Copy, CheckCircle } from 'lucide-react'

// Custom SVG Icons as Components
const customIcons = {
  BrandLiner: ({ size = 24, color = 'currentColor' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="2" y="2" width="20" height="20" rx="6" fill={color} fillOpacity="0.2" />
      <path d="M7 12h10M12 7v10" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
  CodeBlock: ({ size = 24, color = 'currentColor' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="2" y="4" width="20" height="16" rx="4" stroke={color} strokeWidth="2" />
      <path d="M9 9l-3 3 3 3M15 9l3 3-3 3" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 8l-2 8" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
  Dashboard: ({ size = 24, color = 'currentColor' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="2" y="2" width="9" height="9" rx="2" stroke={color} strokeWidth="2" />
      <rect x="13" y="2" width="9" height="9" rx="2" stroke={color} strokeWidth="2" />
      <rect x="2" y="13" width="9" height="9" rx="2" stroke={color} strokeWidth="2" />
      <rect x="13" y="13" width="9" height="5" rx="2" stroke={color} strokeWidth="2" />
    </svg>
  ),
  ChatBubble: ({ size = 24, color = 'currentColor' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill={color} fillOpacity="0.1" />
      <circle cx="8" cy="10" r="1" fill={color} />
      <circle cx="12" cy="10" r="1" fill={color} />
      <circle cx="16" cy="10" r="1" fill={color} />
    </svg>
  ),
  CloudUpload: ({ size = 24, color = 'currentColor' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M12 15v-8M9 10l3-3 3 3" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 18a4 4 0 01-1-7.87A7 7 0 1118.3 13H18a3 3 0 010 6H7" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
  Rocket: ({ size = 24, color = 'currentColor' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 00-2.91-.09z" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill={color} fillOpacity="0.2" />
      <path d="M12 15l-3-3a22 22 0 012-3.95A12.88 12.88 0 0122 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 01-4 2z" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill={color} fillOpacity="0.15" />
      <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  Analytics: ({ size = 24, color = 'currentColor' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M18 20V10M12 20V4M6 20v-6" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
      <path d="M2 20h20" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
  LayerStack: ({ size = 24, color = 'currentColor' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M12 2L2 7l10 5 10-5-10-5z" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill={color} fillOpacity="0.15" />
      <path d="M2 12l10 5 10-5M2 17l10 5 10-5" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  Database: ({ size = 24, color = 'currentColor' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <ellipse cx="12" cy="5" rx="9" ry="3" stroke={color} strokeWidth="2" fill={color} fillOpacity="0.15" />
      <path d="M21 12c0 1.66-4.03 3-9 3S3 13.66 3 12M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5" stroke={color} strokeWidth="2" />
      <path d="M21 8.5c0 1.38-4.03 2.5-9 2.5S3 9.88 3 8.5" stroke={color} strokeWidth="2" />
    </svg>
  ),
  Integration: ({ size = 24, color = 'currentColor' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="6" cy="6" r="3" stroke={color} strokeWidth="2" fill={color} fillOpacity="0.2" />
      <circle cx="18" cy="6" r="3" stroke={color} strokeWidth="2" fill={color} fillOpacity="0.2" />
      <circle cx="6" cy="18" r="3" stroke={color} strokeWidth="2" fill={color} fillOpacity="0.2" />
      <circle cx="18" cy="18" r="3" stroke={color} strokeWidth="2" fill={color} fillOpacity="0.2" />
      <path d="M9 6h6M6 9v6M9 18h6M18 9v6" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
  ApiKey: ({ size = 24, color = 'currentColor' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="8" cy="12" r="5" stroke={color} strokeWidth="2" fill={color} fillOpacity="0.15" />
      <path d="M12.5 12H22M19 9l3 3-3 3" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="8" cy="12" r="2" fill={color} />
    </svg>
  ),
  Notification: ({ size = 24, color = 'currentColor' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill={color} fillOpacity="0.1" />
      <circle cx="17" cy="5" r="3" fill="#ef4444" />
    </svg>
  ),
  Workflow: ({ size = 24, color = 'currentColor' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="2" y="9" width="6" height="6" rx="2" stroke={color} strokeWidth="2" fill={color} fillOpacity="0.2" />
      <rect x="9" y="2" width="6" height="6" rx="2" stroke={color} strokeWidth="2" fill={color} fillOpacity="0.2" />
      <rect x="9" y="16" width="6" height="6" rx="2" stroke={color} strokeWidth="2" fill={color} fillOpacity="0.2" />
      <rect x="16" y="9" width="6" height="6" rx="2" stroke={color} strokeWidth="2" fill={color} fillOpacity="0.2" />
      <path d="M8 12h1M15 5v4M15 15v4M16 12h-1" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
  DesignSystem: ({ size = 24, color = 'currentColor' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="3" stroke={color} strokeWidth="2" fill={color} fillOpacity="0.3" />
      <circle cx="12" cy="12" r="7" stroke={color} strokeWidth="2" strokeDasharray="4 2" />
      <circle cx="12" cy="12" r="10" stroke={color} strokeWidth="1.5" strokeOpacity="0.5" />
    </svg>
  ),
  Palette: ({ size = 24, color = 'currentColor' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10c.926 0 1.648-.746 1.648-1.667 0-.46-.175-.868-.467-1.18a1.667 1.667 0 011.18-2.82H16c2.761 0 5-2.24 5-5 0-4.418-4.03-8-9-8z" stroke={color} strokeWidth="2" fill={color} fillOpacity="0.1" />
      <circle cx="6.5" cy="11.5" r="1.5" fill="#ef4444" />
      <circle cx="8.5" cy="7.5" r="1.5" fill="#f59e0b" />
      <circle cx="14.5" cy="7.5" r="1.5" fill="#10b981" />
      <circle cx="17.5" cy="11.5" r="1.5" fill="#6366f1" />
    </svg>
  ),
  Terminal: ({ size = 24, color = 'currentColor' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="2" y="4" width="20" height="16" rx="3" stroke={color} strokeWidth="2" fill={color} fillOpacity="0.1" />
      <path d="M7 9l4 3-4 3M12 15h5" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  Tooltip: ({ size = 24, color = 'currentColor' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="2" y="2" width="20" height="12" rx="3" stroke={color} strokeWidth="2" fill={color} fillOpacity="0.1" />
      <path d="M9 18l3 4 3-4H9z" fill={color} />
      <path d="M7 7h10M7 11h6" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
  Grid: ({ size = 24, color = 'currentColor' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="2" y="2" width="7" height="7" rx="1.5" fill={color} fillOpacity="0.3" />
      <rect x="9.5" y="2" width="5" height="7" rx="1.5" fill={color} fillOpacity="0.2" />
      <rect x="15" y="2" width="7" height="7" rx="1.5" fill={color} fillOpacity="0.15" />
      <rect x="2" y="9.5" width="7" height="5" rx="1.5" fill={color} fillOpacity="0.2" />
      <rect x="9.5" y="9.5" width="5" height="5" rx="1.5" fill={color} fillOpacity="0.3" />
      <rect x="15" y="9.5" width="7" height="5" rx="1.5" fill={color} fillOpacity="0.25" />
      <rect x="2" y="15" width="7" height="7" rx="1.5" fill={color} fillOpacity="0.15" />
      <rect x="9.5" y="15" width="5" height="7" rx="1.5" fill={color} fillOpacity="0.2" />
      <rect x="15" y="15" width="7" height="7" rx="1.5" fill={color} fillOpacity="0.3" />
    </svg>
  ),
  Sparkle: ({ size = 24, color = 'currentColor' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M12 2l2.09 6.26L20 10l-5.91 1.74L12 18l-2.09-6.26L4 10l5.91-1.74L12 2z" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill={color} fillOpacity="0.2" />
      <path d="M19 2l.5 1.5L21 4l-1.5.5L19 6l-.5-1.5L17 4l1.5-.5L19 2zM5 18l.5 1.5L7 20l-1.5.5L5 22l-.5-1.5L3 20l1.5-.5L5 18z" fill={color} />
    </svg>
  ),
  Crown: ({ size = 24, color = 'currentColor' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M2 18l3-10 4 6 3-8 3 8 4-6 3 10H2z" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill={color} fillOpacity="0.15" />
      <path d="M2 22h20" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
  Wave: ({ size = 24, color = 'currentColor' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M2 12c1.5-3 3-4 5-4s3.5 2 5.5 2 3.5-2 5.5-2 3.5 1 4 4" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <path d="M2 17c1.5-3 3-4 5-4s3.5 2 5.5 2 3.5-2 5.5-2 3.5 1 4 4" stroke={color} strokeWidth="2" strokeLinecap="round" strokeOpacity="0.5" />
      <path d="M2 7c1.5-3 3-4 5-4s3.5 2 5.5 2 3.5-2 5.5-2 3.5 1 4 4" stroke={color} strokeWidth="2" strokeLinecap="round" strokeOpacity="0.3" />
    </svg>
  ),
}

const iconColors = ['#6366f1', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#0ea5e9', '#14b8a6', '#f97316']

export default function CustomIcons() {
  const [size, setSize] = useState(32)
  const [color, setColor] = useState('#6366f1')
  const [copied, setCopied] = useState(null)
  const copyTimeoutRef = useRef(null)

  useEffect(() => () => {
    if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current)
  }, [])

  const copyName = (name) => {
    navigator.clipboard?.writeText(`<${name} />`)
    setCopied(name)
    if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current)
    copyTimeoutRef.current = setTimeout(() => setCopied(null), 1500)
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Custom Icons" subtitle="Hand-crafted SVG icon components for the Liner design system" />

      {/* Controls */}
      <div className="card p-5">
        <div className="flex flex-wrap items-center gap-5">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Size: {size}px</label>
            <input type="range" min="16" max="64" value={size} onChange={e => setSize(+e.target.value)} className="w-32 accent-primary-600" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Color</label>
            <div className="flex gap-2">
              {iconColors.map(c => (
                <button key={c} onClick={() => setColor(c)} className={`w-7 h-7 rounded-full border-2 transition-all ${color === c ? 'border-slate-800 dark:border-white scale-110' : 'border-transparent'}`} style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Icons Grid */}
      <div className="card p-6">
        <p className="text-xs text-slate-500 mb-5">{Object.keys(customIcons).length} custom SVG icons · Click to copy component name</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {Object.entries(customIcons).map(([name, Icon]) => (
            <button
              key={name}
              onClick={() => copyName(name)}
              className="group flex flex-col items-center gap-3 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 hover:border-primary-300 dark:hover:border-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/10 transition-all"
            >
              {copied === name ? (
                <div className="flex flex-col items-center gap-1">
                  <CheckCircle size={size} className="text-emerald-500" />
                  <span className="text-xs text-emerald-500 font-semibold">Copied!</span>
                </div>
              ) : (
                <>
                  <Icon size={size} color={color} />
                  <span className="text-xs text-slate-600 dark:text-slate-400 text-center font-medium group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">{name}</span>
                </>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Usage Example */}
      <div className="card p-6">
        <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-4">Usage Example</h3>
        <pre className="bg-slate-900 dark:bg-slate-950 rounded-xl p-5 overflow-x-auto text-sm">
          <code className="text-slate-100 font-mono">{`// Import the icon
import { BrandLiner } from './icons/CustomIcons'

// Use in your component
<BrandLiner size={24} color="#6366f1" />
<BrandLiner size={32} color="currentColor" />
<BrandLiner size={16} />`}</code>
        </pre>
      </div>
    </div>
  )
}
