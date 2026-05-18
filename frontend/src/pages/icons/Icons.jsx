import { useState, useEffect, useRef } from 'react'
import PageHeader from '../../components/shared/PageHeader'
import { Search } from 'lucide-react'
import * as LucideIcons from 'lucide-react'

// Pick a curated set of icons
const iconList = [
  'Activity', 'Airplay', 'AlarmClock', 'AlertCircle', 'AlertTriangle', 'Archive',
  'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'BarChart3', 'Battery',
  'Bell', 'Bike', 'Bluetooth', 'Bold', 'Bookmark', 'Box',
  'Calendar', 'Camera', 'Check', 'CheckCircle2', 'CheckSquare', 'ChevronDown',
  'ChevronLeft', 'ChevronRight', 'ChevronUp', 'Clock', 'Cloud', 'Code',
  'Coffee', 'Command', 'Copy', 'CreditCard', 'Database', 'Delete',
  'Download', 'Edit', 'Edit2', 'Eye', 'EyeOff', 'File',
  'FileText', 'Filter', 'Flag', 'Folder', 'Gift', 'Globe',
  'Grid', 'HardDrive', 'Hash', 'Heart', 'HelpCircle', 'Home',
  'Image', 'Inbox', 'Info', 'Key', 'Layers', 'Layout',
  'Link', 'List', 'Lock', 'LogIn', 'LogOut', 'Mail',
  'Map', 'MapPin', 'Maximize', 'Menu', 'MessageSquare', 'Mic',
  'Minimize', 'Monitor', 'Moon', 'MoreHorizontal', 'MoreVertical', 'Music',
  'Navigation', 'Package', 'Paperclip', 'Phone', 'PieChart', 'Plus',
  'Power', 'Printer', 'RefreshCw', 'Search', 'Send', 'Server',
  'Settings', 'Share2', 'Shield', 'ShoppingBag', 'ShoppingCart', 'Sidebar',
  'Slack', 'Sliders', 'Smartphone', 'Star', 'Sun', 'Table',
  'Tag', 'Target', 'Terminal', 'Ticket', 'Toggle', 'Trash2',
  'TrendingDown', 'TrendingUp', 'Twitter', 'Type', 'Umbrella', 'Unlock',
  'Upload', 'User', 'UserPlus', 'Users', 'Video', 'Wifi',
  'X', 'Zap', 'ZoomIn', 'ZoomOut',
]

const sizes = [14, 18, 22, 28]

export default function Icons() {
  const [search, setSearch] = useState('')
  const [copied, setCopied] = useState('')
  const [selectedSize, setSelectedSize] = useState(22)
  const [selectedColor, setSelectedColor] = useState('text-slate-700 dark:text-slate-300')
  const copyTimeoutRef = useRef(null)

  useEffect(() => () => {
    if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current)
  }, [])

  const colorOptions = [
    { label: 'Default', value: 'text-slate-700 dark:text-slate-300' },
    { label: 'Primary', value: 'text-primary-500' },
    { label: 'Success', value: 'text-emerald-500' },
    { label: 'Warning', value: 'text-amber-500' },
    { label: 'Danger', value: 'text-red-500' },
    { label: 'Info', value: 'text-cyan-500' },
  ]

  const filtered = iconList.filter(name =>
    !search || name.toLowerCase().includes(search.toLowerCase())
  )

  const handleCopy = (name) => {
    navigator.clipboard.writeText(`<${name} size={${selectedSize}} />`)
    setCopied(name)
    if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current)
    copyTimeoutRef.current = setTimeout(() => setCopied(''), 2000)
  }

  return (
    <div>
      <PageHeader
        title="Icon Library"
        subtitle={`${iconList.length} icons from Lucide React — click any icon to copy its code`}
      />

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="relative flex-1 min-w-48 max-w-xs">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search icons..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input pl-9 text-sm"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-500 dark:text-slate-400">Size:</span>
          <div className="flex gap-1">
            {sizes.map(s => (
              <button
                key={s}
                onClick={() => setSelectedSize(s)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${selectedSize === s ? 'bg-primary-500 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400'}`}
              >
                {s}px
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-500 dark:text-slate-400">Color:</span>
          <select
            value={selectedColor}
            onChange={e => setSelectedColor(e.target.value)}
            className="input text-sm w-auto"
          >
            {colorOptions.map(c => (
              <option key={c.label} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>

        <span className="text-sm text-slate-400 dark:text-slate-500 ml-auto">
          {filtered.length} icons
        </span>
      </div>

      {/* Icon grid */}
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-2">
        {filtered.map(name => {
          const Icon = LucideIcons[name]
          if (!Icon) return null
          const isCopied = copied === name

          return (
            <button
              key={name}
              onClick={() => handleCopy(name)}
              title={`Click to copy <${name} />`}
              className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all duration-150 group ${
                isCopied
                  ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20'
                  : 'border-slate-200 dark:border-slate-700 hover:border-primary-300 dark:hover:border-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20'
              }`}
            >
              {isCopied ? (
                <LucideIcons.Check size={selectedSize} className="text-emerald-500" />
              ) : (
                <Icon size={selectedSize} className={selectedColor} />
              )}
              <span className={`text-[10px] font-medium truncate w-full text-center transition-colors ${
                isCopied ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400 group-hover:text-primary-600 dark:group-hover:text-primary-400'
              }`}>
                {isCopied ? 'Copied!' : name}
              </span>
            </button>
          )
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12">
          <LucideIcons.Search size={40} className="text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <p className="text-slate-600 dark:text-slate-400">No icons found for "{search}"</p>
          <button onClick={() => setSearch('')} className="btn-outline btn-sm mt-3">Clear search</button>
        </div>
      )}

      {/* Usage Guide */}
      <div className="card p-5 mt-6">
        <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-3">Usage Guide</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-2 font-medium">Installation:</p>
            <div className="bg-slate-900 rounded-xl p-3">
              <code className="text-emerald-400 text-sm">npm install lucide-react</code>
            </div>
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-2 font-medium">Usage:</p>
            <div className="bg-slate-900 rounded-xl p-3">
              <code className="text-blue-400 text-sm">
                import {'{ Star, Heart, User }'} from 'lucide-react'<br />
                {'<Star size={24} className="text-amber-400" />'}
              </code>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
