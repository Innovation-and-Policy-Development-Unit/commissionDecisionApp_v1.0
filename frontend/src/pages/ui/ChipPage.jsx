import { useState } from 'react'
import PageHeader from '../../components/shared/PageHeader'
import { X, Check, Star, Heart, User, Tag } from 'lucide-react'

function Chip({ label, color = 'primary', variant = 'soft', size = 'md', icon: Icon, onDelete, selected = false }) {
  const sizes = { sm: 'px-2 py-0.5 text-xs gap-1', md: 'px-3 py-1 text-sm gap-1.5', lg: 'px-4 py-1.5 text-sm gap-2' }
  const colors = {
    primary: { soft: 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300', filled: 'bg-primary-600 text-white', outlined: 'border border-primary-500 text-primary-600 dark:text-primary-400' },
    secondary: { soft: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300', filled: 'bg-slate-600 text-white', outlined: 'border border-slate-400 text-slate-600 dark:text-slate-400' },
    success: { soft: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300', filled: 'bg-emerald-600 text-white', outlined: 'border border-emerald-500 text-emerald-600 dark:text-emerald-400' },
    warning: { soft: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300', filled: 'bg-amber-500 text-white', outlined: 'border border-amber-500 text-amber-600 dark:text-amber-400' },
    error: { soft: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300', filled: 'bg-red-600 text-white', outlined: 'border border-red-500 text-red-600 dark:text-red-400' },
    info: { soft: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300', filled: 'bg-cyan-600 text-white', outlined: 'border border-cyan-500 text-cyan-600 dark:text-cyan-400' },
  }

  return (
    <span className={`inline-flex items-center rounded-full font-medium ${sizes[size]} ${colors[color][variant]} ${selected ? 'ring-2 ring-offset-1 ring-current' : ''}`}>
      {Icon && <Icon size={size === 'sm' ? 11 : size === 'lg' ? 16 : 13} />}
      {label}
      {onDelete && (
        <button onClick={onDelete} className="ms-0.5 hover:opacity-70 transition-opacity">
          <X size={size === 'sm' ? 11 : size === 'lg' ? 15 : 13} />
        </button>
      )}
    </span>
  )
}

export default function ChipPage() {
  const [tags, setTags] = useState(['React', 'TypeScript', 'Node.js', 'Tailwind', 'GraphQL', 'Docker'])
  const [selected, setSelected] = useState(new Set(['React', 'Tailwind']))

  const removeTag = (tag) => setTags(t => t.filter(x => x !== tag))
  const toggleSelect = (tag) => setSelected(s => { const n = new Set(s); n.has(tag) ? n.delete(tag) : n.add(tag); return n })

  return (
    <div className="space-y-6">
      <PageHeader title="Chip" subtitle="Compact elements for tags, categories, and selections" />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Soft Variants */}
        <div className="card p-6">
          <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-4">Soft Chips</h3>
          <div className="flex flex-wrap gap-2">
            {['primary', 'secondary', 'success', 'warning', 'error', 'info'].map(color => (
              <Chip key={color} label={color.charAt(0).toUpperCase() + color.slice(1)} color={color} variant="soft" />
            ))}
          </div>
        </div>

        {/* Filled Variants */}
        <div className="card p-6">
          <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-4">Filled Chips</h3>
          <div className="flex flex-wrap gap-2">
            {['primary', 'secondary', 'success', 'warning', 'error', 'info'].map(color => (
              <Chip key={color} label={color.charAt(0).toUpperCase() + color.slice(1)} color={color} variant="filled" />
            ))}
          </div>
        </div>

        {/* Outlined Variants */}
        <div className="card p-6">
          <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-4">Outlined Chips</h3>
          <div className="flex flex-wrap gap-2">
            {['primary', 'secondary', 'success', 'warning', 'error', 'info'].map(color => (
              <Chip key={color} label={color.charAt(0).toUpperCase() + color.slice(1)} color={color} variant="outlined" />
            ))}
          </div>
        </div>

        {/* With Icons */}
        <div className="card p-6">
          <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-4">Chips with Icons</h3>
          <div className="flex flex-wrap gap-2">
            <Chip label="Favorite" color="error" icon={Heart} />
            <Chip label="Featured" color="warning" icon={Star} variant="filled" />
            <Chip label="Member" color="primary" icon={User} />
            <Chip label="Tagged" color="info" icon={Tag} variant="outlined" />
            <Chip label="Verified" color="success" icon={Check} />
          </div>
        </div>

        {/* Sizes */}
        <div className="card p-6">
          <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-4">Sizes</h3>
          <div className="flex flex-wrap items-center gap-3">
            <Chip label="Small" size="sm" color="primary" />
            <Chip label="Medium" size="md" color="success" />
            <Chip label="Large" size="lg" color="info" />
            <Chip label="Small Icon" size="sm" color="warning" icon={Star} />
            <Chip label="Large Icon" size="lg" color="error" icon={Heart} />
          </div>
        </div>

        {/* Deletable */}
        <div className="card p-6">
          <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-4">Deletable Chips</h3>
          <div className="flex flex-wrap gap-2">
            {tags.map(tag => (
              <Chip key={tag} label={tag} color="primary" onDelete={() => removeTag(tag)} />
            ))}
          </div>
          {tags.length === 0 && (
            <button onClick={() => setTags(['React', 'TypeScript', 'Node.js', 'Tailwind', 'GraphQL', 'Docker'])} className="btn btn-sm btn-outline mt-2">
              Reset Tags
            </button>
          )}
        </div>

        {/* Selectable */}
        <div className="card p-6 lg:col-span-2">
          <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-4">Selectable Chips</h3>
          <p className="text-sm text-slate-500 mb-3">Click chips to select/deselect them</p>
          <div className="flex flex-wrap gap-2">
            {['React', 'Vue', 'Angular', 'Svelte', 'TypeScript', 'JavaScript', 'Python', 'Go', 'Rust', 'Node.js'].map(tech => (
              <button key={tech} onClick={() => toggleSelect(tech)}>
                <Chip
                  label={tech}
                  color={selected.has(tech) ? 'primary' : 'secondary'}
                  variant={selected.has(tech) ? 'filled' : 'soft'}
                  icon={selected.has(tech) ? Check : undefined}
                />
              </button>
            ))}
          </div>
          <p className="text-xs text-slate-400 mt-3">Selected: {[...selected].join(', ') || 'None'}</p>
        </div>

        {/* Gradient Chips */}
        <div className="card p-6">
          <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-4">Gradient Chips</h3>
          <p className="text-sm text-slate-500 mb-3">Eye-catching chips with gradient backgrounds</p>
          <div className="flex flex-wrap gap-2">
            {[
              { label: 'Premium', gradient: 'bg-primary-500' },
              { label: 'Featured', gradient: 'bg-amber-500' },
              { label: 'New Release', gradient: 'bg-sky-500' },
              { label: 'Best Seller', gradient: 'bg-emerald-500' },
              { label: 'Trending', gradient: 'bg-rose-500' },
              { label: 'Top Rated', gradient: 'bg-fuchsia-500' },
              { label: 'Limited', gradient: 'bg-red-500' },
              { label: 'Exclusive', gradient: 'bg-primary-500' },
            ].map((chip, i) => (
              <span key={i} className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium text-white ${chip.gradient} shadow-sm`}>
                {i < 4 && <Star size={12} className="fill-white/80" />}
                {chip.label}
              </span>
            ))}
          </div>
        </div>

        {/* Chip Groups */}
        <div className="card p-6">
          <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-4">Chip Groups</h3>
          <p className="text-sm text-slate-500 mb-3">Organized chip categories for filtering and tagging</p>
          <div className="space-y-4">
            <div>
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">Status</p>
              <div className="flex flex-wrap gap-2">
                <Chip label="Active" color="success" variant="soft" icon={Check} />
                <Chip label="Pending" color="warning" variant="soft" icon={Star} />
                <Chip label="Closed" color="error" variant="soft" icon={X} />
                <Chip label="Draft" color="secondary" variant="soft" />
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">Priority</p>
              <div className="flex flex-wrap gap-2">
                <Chip label="Critical" color="error" variant="filled" />
                <Chip label="High" color="warning" variant="filled" />
                <Chip label="Medium" color="info" variant="filled" />
                <Chip label="Low" color="success" variant="filled" />
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">Categories</p>
              <div className="flex flex-wrap gap-2">
                <Chip label="Design" color="primary" variant="outlined" icon={Tag} />
                <Chip label="Development" color="info" variant="outlined" icon={Tag} />
                <Chip label="Marketing" color="success" variant="outlined" icon={Tag} />
                <Chip label="Analytics" color="warning" variant="outlined" icon={Tag} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
