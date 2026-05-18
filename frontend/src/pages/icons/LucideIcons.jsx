import { useState, useEffect, useRef } from 'react'
import PageHeader from '../../components/shared/PageHeader'
import * as LucideIconSet from 'lucide-react'
import { Search, Copy, CheckCircle } from 'lucide-react'

const iconCategories = {
  'Navigation': ['Home', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'ChevronLeft', 'ChevronRight', 'ChevronUp', 'ChevronDown', 'Menu', 'X', 'MoreHorizontal', 'MoreVertical', 'ExternalLink', 'Link2'],
  'Interface': ['Search', 'Filter', 'SlidersHorizontal', 'Settings', 'Sliders', 'LayoutDashboard', 'LayoutGrid', 'List', 'Grid3X3', 'Columns', 'Rows', 'Maximize', 'Minimize', 'Eye', 'EyeOff'],
  'Communication': ['Mail', 'MessageSquare', 'MessageCircle', 'Bell', 'BellOff', 'Send', 'Phone', 'PhoneCall', 'Video', 'Share2', 'Reply', 'Forward'],
  'Media': ['Play', 'Pause', 'Stop', 'SkipBack', 'SkipForward', 'Volume2', 'VolumeX', 'Music', 'Image', 'Film', 'Camera', 'Mic', 'Headphones'],
  'Files': ['File', 'FileText', 'FilePlus', 'FileEdit', 'Folder', 'FolderOpen', 'Download', 'Upload', 'Save', 'Archive', 'Trash2', 'Copy', 'Clipboard'],
  'Data': ['BarChart2', 'BarChart3', 'LineChart', 'PieChart', 'TrendingUp', 'TrendingDown', 'Activity', 'Database', 'Server', 'HardDrive', 'Cpu', 'Wifi'],
  'People': ['User', 'Users', 'UserPlus', 'UserMinus', 'UserCheck', 'UserX', 'UserCircle', 'Contact', 'Heart', 'Star', 'ThumbsUp', 'Award'],
  'Commerce': ['ShoppingCart', 'ShoppingBag', 'CreditCard', 'DollarSign', 'Package', 'Tag', 'Store', 'Truck', 'Receipt', 'Wallet', 'Banknote', 'Coins'],
  'Security': ['Lock', 'Unlock', 'Shield', 'ShieldCheck', 'ShieldX', 'Key', 'KeyRound', 'Eye', 'EyeOff', 'AlertCircle', 'AlertTriangle', 'CheckCircle'],
  'Time': ['Clock', 'Calendar', 'CalendarCheck', 'Timer', 'Hourglass', 'Sunrise', 'Sunset', 'Moon', 'Sun', 'CloudSun', 'Cloud', 'CloudRain'],
  'Actions': ['Plus', 'Minus', 'Edit', 'Edit2', 'Edit3', 'Trash', 'Trash2', 'Copy', 'Check', 'X', 'RefreshCw', 'RotateCcw', 'Undo', 'Redo', 'ZoomIn', 'ZoomOut'],
  'Misc': ['Globe', 'Globe2', 'Map', 'MapPin', 'Compass', 'Navigation', 'Zap', 'Layers', 'Box', 'Package', 'Gift', 'Flag', 'Hash', 'AtSign'],
}

export default function LucideIcons() {
  const [search, setSearch] = useState('')
  const [copied, setCopied] = useState(null)
  const [activeCategory, setActiveCategory] = useState('All')
  const copyTimeoutRef = useRef(null)

  useEffect(() => () => {
    if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current)
  }, [])

  const copyIconName = (name) => {
    navigator.clipboard?.writeText(name)
    setCopied(name)
    if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current)
    copyTimeoutRef.current = setTimeout(() => setCopied(null), 1500)
  }

  const allIcons = activeCategory === 'All'
    ? Object.values(iconCategories).flat()
    : iconCategories[activeCategory] || []

  const filtered = allIcons.filter(name =>
    name.toLowerCase().includes(search.toLowerCase()) &&
    name in LucideIconSet
  )

  const unique = [...new Set(filtered)]

  return (
    <div className="space-y-6">
      <PageHeader title="Lucide Icons" subtitle="Browse and copy icon names from the Lucide React library" />

      {/* Search */}
      <div className="card p-4">
        <div className="relative max-w-md">
          <Search size={15} className="absolute start-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" placeholder="Search icons..." className="input ps-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        <button onClick={() => setActiveCategory('All')} className={`btn btn-sm shrink-0 ${activeCategory === 'All' ? 'btn-primary' : 'btn-outline'}`}>All</button>
        {Object.keys(iconCategories).map(cat => (
          <button key={cat} onClick={() => setActiveCategory(cat)} className={`btn btn-sm shrink-0 ${activeCategory === cat ? 'btn-primary' : 'btn-outline'}`}>{cat}</button>
        ))}
      </div>

      {/* Icons Grid */}
      <div className="card p-6">
        <p className="text-xs text-slate-500 mb-4">{unique.length} icons shown · Click to copy name</p>
        <div className="grid grid-cols-3 sm:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-3">
          {unique.map(name => {
            const Icon = LucideIconSet[name]
            if (!Icon) return null
            return (
              <button
                key={name}
                onClick={() => copyIconName(name)}
                className="icon-item relative group"
                title={name}
              >
                {copied === name ? (
                  <CheckCircle size={22} className="text-emerald-500" />
                ) : (
                  <Icon size={22} className="text-slate-600 dark:text-slate-400 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors" />
                )}
                <span className="text-[10px] text-slate-500 dark:text-slate-400 text-center leading-tight truncate w-full">{name}</span>
                <div className="absolute inset-0 flex items-center justify-center bg-primary-50/80 dark:bg-primary-900/40 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity">
                  <Copy size={13} className="text-primary-600 dark:text-primary-400" />
                </div>
              </button>
            )
          })}
        </div>
        {unique.length === 0 && (
          <div className="text-center py-12 text-slate-400">
            <Search size={40} className="mx-auto mb-3 opacity-30" />
            <p>No icons found for "{search}"</p>
          </div>
        )}
      </div>
    </div>
  )
}
