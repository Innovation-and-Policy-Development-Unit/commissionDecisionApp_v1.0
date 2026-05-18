import { useState } from 'react'
import PageHeader from '../../components/shared/PageHeader'
import { Info, Settings, Heart, Star, Copy, Edit, Trash2, Zap, Shield, Bell, Download, Crown, Lock, Sparkles, User, MapPin, Mail, Calendar, Clock, TrendingUp, CheckCircle, AlertTriangle, Globe, Eye, Users, CreditCard, Gift, ArrowRight, ExternalLink, Image, FileText } from 'lucide-react'
import { img } from '../../utils/imgPath'

function Tooltip({ children, text, position = 'top', rich = false, color = '', size = 'default' }) {
  const [visible, setVisible] = useState(false)

  const positions = {
    top: 'bottom-full mb-2 left-1/2 -translate-x-1/2',
    bottom: 'top-full mt-2 left-1/2 -translate-x-1/2',
    left: 'right-full me-2 top-1/2 -translate-y-1/2',
    right: 'left-full ms-2 top-1/2 -translate-y-1/2',
  }

  const colorClasses = {
    '': 'bg-slate-800 dark:bg-slate-900 text-white',
    primary: 'bg-primary-600 text-white',
    success: 'bg-emerald-600 text-white',
    warning: 'bg-amber-500 text-white',
    danger: 'bg-rose-600 text-white',
    info: 'bg-cyan-600 text-white',
  }

  const sizeClasses = {
    sm: 'px-2 py-1 text-[10px]',
    default: 'px-3 py-1.5 text-xs',
    lg: 'px-4 py-2.5 text-sm',
  }

  const bgClass = colorClasses[color] || colorClasses['']
  const sizeClass = sizeClasses[size] || sizeClasses['default']

  return (
    <div
      className="relative inline-flex"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      {children}
      {visible && (
        <div className={`absolute z-50 ${positions[position]} pointer-events-none`}>
          {rich ? (
            <div className={`${bgClass} rounded-xl shadow-lg p-3 min-w-48 text-xs`}>
              {text}
            </div>
          ) : (
            <div className={`${bgClass} rounded-lg shadow-lg ${sizeClass} whitespace-nowrap`}>
              {text}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function RichTooltip({ children, content, position = 'bottom' }) {
  const [visible, setVisible] = useState(false)

  const positions = {
    top: 'bottom-full mb-2 left-1/2 -translate-x-1/2',
    bottom: 'top-full mt-2 left-1/2 -translate-x-1/2',
    left: 'right-full me-2 top-1/2 -translate-y-1/2',
    right: 'left-full ms-2 top-1/2 -translate-y-1/2',
  }

  return (
    <div
      className="relative inline-flex"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      {children}
      {visible && (
        <div className={`absolute z-50 ${positions[position]}`}>
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-card-md p-4 min-w-56">
            {content}
          </div>
        </div>
      )}
    </div>
  )
}

export default function TooltipPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Tooltip" subtitle="Contextual information displayed on hover" />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Positions */}
        <div className="card p-6">
          <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-2">Tooltip Positions</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-8">Tooltips can be placed on any side of the trigger element.</p>
          <div className="flex flex-wrap items-center justify-center gap-8 py-8">
            {['top', 'bottom', 'left', 'right'].map(pos => (
              <Tooltip key={pos} text={`Tooltip on ${pos}`} position={pos}>
                <button className="btn btn-outline btn-sm capitalize">{pos}</button>
              </Tooltip>
            ))}
          </div>
        </div>

        {/* On icons */}
        <div className="card p-6">
          <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-2">Tooltip on Icons</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-5">Icon buttons with descriptive tooltips for accessibility.</p>
          <div className="flex items-center gap-4">
            {[
              { icon: Info, tip: 'More information', color: 'text-cyan-500' },
              { icon: Settings, tip: 'Open settings', color: 'text-slate-500' },
              { icon: Heart, tip: 'Add to favorites', color: 'text-rose-500' },
              { icon: Star, tip: 'Rate this item', color: 'text-amber-500' },
              { icon: Copy, tip: 'Copy to clipboard', color: 'text-primary-500' },
            ].map(({ icon: Icon, tip, color }, i) => (
              <Tooltip key={i} text={tip}>
                <button className={`w-10 h-10 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center ${color} transition-colors`}>
                  <Icon size={18} />
                </button>
              </Tooltip>
            ))}
          </div>
        </div>

        {/* Color Tooltips */}
        <div className="card p-6">
          <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-2">Color Tooltips</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-5">Tooltips with different colored backgrounds to convey semantic meaning.</p>
          <div className="flex flex-wrap items-center gap-4">
            {[
              { color: '', label: 'Default', btnClass: 'btn-outline' },
              { color: 'primary', label: 'Primary', btnClass: 'btn-primary' },
              { color: 'success', label: 'Success', btnClass: 'btn-success' },
              { color: 'warning', label: 'Warning', btnClass: 'btn-warning' },
              { color: 'danger', label: 'Danger', btnClass: 'btn-danger' },
              { color: 'info', label: 'Info', btnClass: 'btn-info' },
            ].map((item) => (
              <Tooltip key={item.label} text={`${item.label} tooltip`} color={item.color}>
                <button className={`btn ${item.btnClass} btn-sm`}>{item.label}</button>
              </Tooltip>
            ))}
          </div>
        </div>

        {/* Tooltip Sizes */}
        <div className="card p-6">
          <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-2">Tooltip Sizes</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-5">Different sized tooltips for varying levels of detail and emphasis.</p>
          <div className="flex flex-wrap items-center gap-4">
            <Tooltip text="Small tooltip" size="sm">
              <button className="btn btn-outline btn-sm">Small</button>
            </Tooltip>
            <Tooltip text="Default size tooltip" size="default">
              <button className="btn btn-outline btn-sm">Medium</button>
            </Tooltip>
            <Tooltip text="Large tooltip with more detail" size="lg">
              <button className="btn btn-outline btn-sm">Large</button>
            </Tooltip>
          </div>
          <div className="mt-5 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700">
            <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">Size Reference</h4>
            <div className="space-y-1.5">
              {[
                { size: 'Small', desc: '10px font, minimal padding', use: 'Dense UIs, icon labels' },
                { size: 'Medium', desc: '12px font, standard padding', use: 'General purpose (default)' },
                { size: 'Large', desc: '14px font, generous padding', use: 'Important hints, onboarding' },
              ].map((item) => (
                <div key={item.size} className="flex items-start gap-2 text-[11px]">
                  <span className="font-medium text-slate-600 dark:text-slate-400 w-14 shrink-0">{item.size}</span>
                  <span className="text-slate-400">-</span>
                  <span className="text-slate-500 dark:text-slate-400">{item.desc}. Best for {item.use}.</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Profile Tooltip Cards */}
        <div className="card p-6">
          <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-2">Profile Tooltip Cards</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-5">Hover over avatars to reveal detailed user profile previews.</p>
          <div className="flex items-center gap-4">
            {[
              { name: 'Sarah Chen', role: 'Product Designer', location: 'San Francisco', img: img('/images/avatars/avatar-woman-alice.jpg'), projects: 24, status: 'online' },
              { name: 'Marcus Rivera', role: 'Lead Developer', location: 'New York', img: img('/images/avatars/avatar-man-bob.jpg'), projects: 38, status: 'away' },
              { name: 'Emily Watson', role: 'Marketing Lead', location: 'London', img: img('/images/avatars/avatar-woman-carol.jpg'), projects: 12, status: 'online' },
              { name: 'Alex Kim', role: 'Data Scientist', location: 'Toronto', img: img('/images/avatars/avatar-man-david.jpg'), projects: 19, status: 'busy' },
            ].map((user, i) => (
              <RichTooltip key={i} position="bottom" content={
                <div className="w-60">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="relative">
                      <img src={user.img} alt={user.name} className="w-12 h-12 rounded-full object-cover" />
                      <div className={`absolute bottom-0 end-0 w-3.5 h-3.5 rounded-full border-2 border-white dark:border-slate-800 ${user.status === 'online' ? 'bg-emerald-500' : user.status === 'away' ? 'bg-amber-500' : 'bg-red-500'}`} />
                    </div>
                    <div>
                      <p className="font-semibold text-sm text-slate-800 dark:text-slate-200">{user.name}</p>
                      <p className="text-xs text-slate-500">{user.role}</p>
                    </div>
                  </div>
                  <div className="space-y-1.5 mb-3">
                    <div className="flex items-center gap-2 text-xs text-slate-500"><MapPin size={11} /> {user.location}</div>
                    <div className="flex items-center gap-2 text-xs text-slate-500"><FileText size={11} /> {user.projects} projects</div>
                  </div>
                  <div className="flex gap-2">
                    <button className="flex-1 py-1.5 rounded-lg bg-primary-500 text-white text-xs font-medium text-center pointer-events-auto hover:bg-primary-600 transition-colors">Follow</button>
                    <button className="flex-1 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-600 dark:text-slate-400 text-center pointer-events-auto hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">Message</button>
                  </div>
                </div>
              }>
                <div className="relative cursor-pointer">
                  <img src={user.img} alt={user.name} className="w-11 h-11 rounded-full object-cover ring-2 ring-white dark:ring-slate-800 hover:ring-primary-400 transition-all" />
                  <div className={`absolute bottom-0 end-0 w-3 h-3 rounded-full border-2 border-white dark:border-slate-800 ${user.status === 'online' ? 'bg-emerald-500' : user.status === 'away' ? 'bg-amber-500' : 'bg-red-500'}`} />
                </div>
              </RichTooltip>
            ))}
          </div>
        </div>

        {/* Product Preview Tooltips */}
        <div className="card p-6">
          <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-2">Product Preview Tooltips</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-5">Hover over product links to see a quick preview with image and details.</p>
          <div className="flex flex-wrap gap-3">
            {[
              { name: 'Wireless Headphones', price: '$249.99', rating: 4.8, img: img('/images/unsplash/wireless-headphones.jpg'), badge: 'Best Seller' },
              { name: 'Mechanical Keyboard', price: '$149.99', rating: 4.5, img: img('/images/unsplash/mechanical-keyboard.jpg'), badge: 'New' },
              { name: 'Minimalist Watch', price: '$319.00', rating: 4.9, img: img('/images/unsplash/minimalist-watch.jpg'), badge: 'Popular' },
            ].map((product, i) => (
              <RichTooltip key={i} position="bottom" content={
                <div className="w-64">
                  <div className="-mx-4 -mt-4 h-32 rounded-t-xl overflow-hidden relative">
                    <img src={product.img} alt={product.name} className="w-full h-full object-cover" />
                    <span className="absolute top-2 start-2 px-2 py-0.5 rounded-full bg-primary-500 text-white text-[10px] font-bold">{product.badge}</span>
                  </div>
                  <div className="mt-3">
                    <p className="font-semibold text-sm text-slate-800 dark:text-slate-200">{product.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex items-center gap-0.5">
                        {Array.from({ length: 5 }).map((_, j) => (
                          <Star key={j} size={10} className={j < Math.floor(product.rating) ? 'text-amber-400 fill-amber-400' : 'text-slate-300'} />
                        ))}
                      </div>
                      <span className="text-[10px] text-slate-400">{product.rating}</span>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-lg font-bold text-primary-600 dark:text-primary-400">{product.price}</span>
                      <span className="text-[10px] text-emerald-500 font-medium flex items-center gap-0.5"><CheckCircle size={9} /> In Stock</span>
                    </div>
                  </div>
                </div>
              }>
                <button className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-primary-300 transition-colors">
                  <img src={product.img} alt={product.name} className="w-7 h-7 rounded-lg object-cover" />
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{product.name}</span>
                </button>
              </RichTooltip>
            ))}
          </div>
        </div>

        {/* Table with tooltips */}
        <div className="card p-6 lg:col-span-2">
          <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-2">Tooltip on Table Actions</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-5">Action buttons in tables with descriptive tooltips for better usability.</p>
          <div className="table-wrapper">
            <table className="table">
              <thead><tr><th>User</th><th>Role</th><th>Status</th><th>Activity</th><th>Actions</th></tr></thead>
              <tbody>
                {[
                  { name: 'Alice Johnson', role: 'Frontend Dev', img: img('/images/avatars/avatar-woman-alice.jpg'), activity: '2 min ago' },
                  { name: 'Bob Smith', role: 'Backend Dev', img: img('/images/avatars/avatar-man-bob.jpg'), activity: '1 hour ago' },
                  { name: 'Carol White', role: 'Designer', img: img('/images/avatars/avatar-woman-carol.jpg'), activity: '3 hours ago' },
                ].map((user, i) => (
                  <tr key={i}>
                    <td>
                      <div className="flex items-center gap-3">
                        <img src={user.img} alt={user.name} className="w-8 h-8 rounded-full object-cover" />
                        <span className="font-medium text-slate-800 dark:text-slate-200">{user.name}</span>
                      </div>
                    </td>
                    <td className="text-slate-500">{user.role}</td>
                    <td><span className="badge badge-success">Active</span></td>
                    <td className="text-xs text-slate-400">{user.activity}</td>
                    <td>
                      <div className="flex items-center gap-1">
                        <Tooltip text="View profile" position="top">
                          <button className="w-7 h-7 rounded-lg hover:bg-primary-50 dark:hover:bg-primary-900/20 flex items-center justify-center text-slate-400 hover:text-primary-600 transition-colors">
                            <Eye size={14} />
                          </button>
                        </Tooltip>
                        <Tooltip text="Edit user" position="top">
                          <button className="w-7 h-7 rounded-lg hover:bg-cyan-50 dark:hover:bg-cyan-900/20 flex items-center justify-center text-slate-400 hover:text-cyan-600 transition-colors">
                            <Edit size={14} />
                          </button>
                        </Tooltip>
                        <Tooltip text="Delete user" position="top">
                          <button className="w-7 h-7 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center justify-center text-slate-400 hover:text-red-600 transition-colors">
                            <Trash2 size={14} />
                          </button>
                        </Tooltip>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Rich Tooltips */}
        <div className="card p-6">
          <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-2">Rich Content Tooltips</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-5">Tooltips with structured content, including formatted text and interactive elements.</p>
          <div className="flex flex-wrap gap-4">
            <Tooltip
              position="right"
              rich
              text={
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <img src={img('/images/avatars/avatar-man-john.jpg')} alt="" className="w-8 h-8 rounded-full object-cover" />
                    <div>
                      <p className="font-semibold">John Doe</p>
                      <p className="text-slate-400 text-[10px]">Senior Frontend Developer</p>
                    </div>
                  </div>
                  <p className="text-slate-400 text-[10px]">john@example.com</p>
                </div>
              }
            >
              <button className="btn btn-outline btn-sm">User Info</button>
            </Tooltip>

            <Tooltip
              position="bottom"
              rich
              text={
                <div>
                  <p className="font-semibold mb-1">Keyboard Shortcuts</p>
                  <div className="space-y-1.5 mt-2">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Search</span>
                      <div className="flex items-center gap-1">
                        <kbd className="px-1.5 py-0.5 bg-slate-700 rounded text-[10px]">Ctrl</kbd>
                        <kbd className="px-1.5 py-0.5 bg-slate-700 rounded text-[10px]">K</kbd>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Save</span>
                      <div className="flex items-center gap-1">
                        <kbd className="px-1.5 py-0.5 bg-slate-700 rounded text-[10px]">Ctrl</kbd>
                        <kbd className="px-1.5 py-0.5 bg-slate-700 rounded text-[10px]">S</kbd>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">New file</span>
                      <div className="flex items-center gap-1">
                        <kbd className="px-1.5 py-0.5 bg-slate-700 rounded text-[10px]">Ctrl</kbd>
                        <kbd className="px-1.5 py-0.5 bg-slate-700 rounded text-[10px]">N</kbd>
                      </div>
                    </div>
                  </div>
                </div>
              }
            >
              <button className="btn btn-primary btn-sm">Shortcuts</button>
            </Tooltip>

            <Tooltip
              position="top"
              rich
              text={
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Crown size={14} className="text-amber-400" />
                    <p className="font-semibold">Pro Feature</p>
                  </div>
                  <p className="text-slate-400 leading-relaxed">This feature is only available on Pro and Enterprise plans. Upgrade to unlock advanced capabilities.</p>
                  <button className="mt-2 w-full py-1 rounded bg-primary-600 text-white text-xs">Upgrade Now</button>
                </div>
              }
            >
              <button className="btn btn-secondary btn-sm"><Lock size={13} /> Pro Feature</button>
            </Tooltip>
          </div>
        </div>

        {/* Tooltip Styles */}
        <div className="card p-6">
          <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-2">Tooltip Styles</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-5">Different visual styles to match various UI contexts.</p>
          <div className="flex flex-wrap items-center gap-4">
            <Tooltip text="Default dark tooltip">
              <button className="btn btn-outline btn-sm">Dark</button>
            </Tooltip>
            <Tooltip text="Primary style" color="primary">
              <button className="btn btn-outline btn-sm">Primary</button>
            </Tooltip>
            <Tooltip text="Success indicator" color="success">
              <button className="btn btn-outline btn-sm">Success</button>
            </Tooltip>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3">
            {[
              { icon: Zap, label: 'Performance', tip: 'View performance metrics', color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-900/20' },
              { icon: Shield, label: 'Security', tip: 'Security settings', color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
              { icon: Bell, label: 'Alerts', tip: 'Configure alert preferences', color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/20' },
              { icon: Download, label: 'Export', tip: 'Download as CSV or PDF', color: 'text-violet-500', bg: 'bg-violet-50 dark:bg-violet-900/20' },
            ].map((item) => (
              <Tooltip key={item.label} text={item.tip}>
                <button className={`w-full flex items-center gap-3 p-3 rounded-xl ${item.bg} hover:opacity-80 transition-opacity`}>
                  <item.icon size={18} className={item.color} />
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{item.label}</span>
                </button>
              </Tooltip>
            ))}
          </div>
        </div>

        {/* Premium Feature Tooltips */}
        <div className="card p-6">
          <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-2">Premium Feature Tooltips</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-5">Upgrade prompts and locked feature hints displayed on hover.</p>
          <div className="flex flex-wrap gap-3">
            <RichTooltip position="bottom" content={
              <div className="w-64">
                <div className="-mx-4 -mt-4 mb-3 px-4 py-3 rounded-t-xl bg-gradient-to-r from-violet-600 to-primary-600 text-center">
                  <Crown size={24} className="text-white mx-auto mb-1" />
                  <p className="font-bold text-white text-sm">Upgrade to Pro</p>
                  <p className="text-white/70 text-xs">Starting at $12/mo</p>
                </div>
                <div className="space-y-2 mb-3">
                  {[
                    { icon: Zap, text: 'Unlimited projects' },
                    { icon: Users, text: 'Team collaboration' },
                    { icon: Sparkles, text: 'AI-powered features' },
                  ].map((f, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                      <f.icon size={12} className="text-primary-500" /> {f.text}
                    </div>
                  ))}
                </div>
                <button className="w-full py-1.5 rounded-lg bg-gradient-to-r from-violet-600 to-primary-600 text-white text-xs font-semibold pointer-events-auto hover:opacity-90 transition-all">Start Free Trial</button>
              </div>
            }>
              <button className="btn btn-sm bg-gradient-to-r from-violet-600 to-primary-600 text-white hover:opacity-90 transition-all gap-2">
                <Crown size={14} /> Pro Plan
              </button>
            </RichTooltip>

            <RichTooltip position="bottom" content={
              <div className="w-56">
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shrink-0">
                    <Sparkles size={18} className="text-white" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-slate-800 dark:text-slate-200">AI Smart Assist</p>
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 dark:bg-amber-900/30 text-amber-600">PRO</span>
                  </div>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed mb-3">AI-powered suggestions and auto-completions to boost your productivity.</p>
                <div className="flex items-center justify-between p-2 rounded-lg bg-amber-50 dark:bg-amber-900/10">
                  <span className="text-[10px] text-amber-700 dark:text-amber-400 font-medium">Requires Pro plan</span>
                  <button className="px-2 py-0.5 rounded bg-amber-500 text-white text-[10px] font-bold pointer-events-auto hover:bg-amber-600 transition-colors">Upgrade</button>
                </div>
              </div>
            }>
              <button className="btn btn-outline btn-sm gap-2"><Lock size={13} /> AI Assist</button>
            </RichTooltip>

            <RichTooltip position="bottom" content={
              <div className="w-60">
                <div className="-mx-4 -mt-4 rounded-t-xl overflow-hidden relative h-24">
                  <img src={img('/images/unsplash/starry-night-mountain.jpg')} alt="" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                  <div className="absolute bottom-2 start-3">
                    <span className="px-2 py-0.5 rounded-full bg-rose-500 text-white text-[9px] font-bold">LIMITED</span>
                    <p className="font-bold text-white text-sm mt-1">50% Off Annual</p>
                  </div>
                </div>
                <div className="mt-3">
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">Get our annual Pro plan at half price. Offer expires soon!</p>
                  <button className="w-full py-1.5 rounded-lg bg-rose-500 text-white text-xs font-semibold pointer-events-auto hover:bg-rose-600 transition-colors">Claim Offer</button>
                </div>
              </div>
            }>
              <button className="btn btn-outline btn-sm gap-2"><Gift size={13} /> Special Offer</button>
            </RichTooltip>
          </div>
        </div>

        {/* Analytics Tooltips */}
        <div className="card p-6">
          <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-2">Analytics Tooltips</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-5">Stats and metrics that expand with details on hover.</p>
          <div className="grid grid-cols-2 gap-3">
            {[
              {
                label: 'Revenue', value: '$48.2k', change: '+12.5%', up: true,
                detail: { chart: [35, 52, 48, 65, 42, 70, 58, 82, 68, 75, 90, 85], target: '$50k', prev: '$42.8k' }
              },
              {
                label: 'Users', value: '2,847', change: '+8.3%', up: true,
                detail: { chart: [40, 45, 55, 50, 62, 58, 72, 68, 80, 75, 88, 92], target: '3,000', prev: '2,628' }
              },
              {
                label: 'Bounce Rate', value: '24.5%', change: '-3.2%', up: false,
                detail: { chart: [65, 58, 62, 55, 50, 48, 52, 45, 42, 38, 35, 30], target: '<25%', prev: '27.7%' }
              },
              {
                label: 'Conversion', value: '3.8%', change: '+0.4%', up: true,
                detail: { chart: [20, 25, 22, 30, 28, 35, 32, 40, 38, 42, 45, 48], target: '4.0%', prev: '3.4%' }
              },
            ].map((stat, i) => (
              <RichTooltip key={i} position="bottom" content={
                <div className="w-56">
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-semibold text-sm text-slate-800 dark:text-slate-200">{stat.label}</p>
                    <span className={`text-xs font-semibold ${stat.up ? 'text-emerald-500' : 'text-rose-500'}`}>{stat.change}</span>
                  </div>
                  <div className="flex gap-1 h-10 items-end mb-2">
                    {stat.detail.chart.map((h, j) => (
                      <div key={j} className={`flex-1 rounded-t transition-all ${stat.up ? 'bg-primary-400 dark:bg-primary-500' : 'bg-rose-400 dark:bg-rose-500'}`} style={{ height: `${h}%` }} />
                    ))}
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-400 mb-2">
                    <span>Jan</span><span>Dec</span>
                  </div>
                  <div className="flex gap-3 pt-2 border-t border-slate-100 dark:border-slate-700">
                    <div>
                      <p className="text-[10px] text-slate-400">Previous</p>
                      <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">{stat.detail.prev}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400">Target</p>
                      <p className="text-xs font-semibold text-primary-600 dark:text-primary-400">{stat.detail.target}</p>
                    </div>
                  </div>
                </div>
              }>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-700/30 hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors cursor-pointer">
                  <p className="text-xs text-slate-500 mb-0.5">{stat.label}</p>
                  <div className="flex items-baseline gap-2">
                    <p className="text-lg font-bold text-slate-800 dark:text-slate-200">{stat.value}</p>
                    <span className={`text-[10px] font-semibold flex items-center gap-0.5 ${stat.up ? 'text-emerald-500' : 'text-rose-500'}`}>
                      <TrendingUp size={9} className={stat.up ? '' : 'rotate-180'} /> {stat.change}
                    </span>
                  </div>
                </div>
              </RichTooltip>
            ))}
          </div>
        </div>

        {/* Event & Schedule Tooltips */}
        <div className="card p-6">
          <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-2">Event Tooltips</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-5">Calendar events and schedule details revealed on hover.</p>
          <div className="flex flex-wrap gap-3">
            {[
              { label: 'Team Standup', time: '9:00 AM', color: 'bg-primary-500', attendees: [img('/images/avatars/avatar-woman-alice.jpg'), img('/images/avatars/avatar-man-bob.jpg'), img('/images/avatars/avatar-woman-carol.jpg')], location: 'Zoom Meeting', duration: '30 min' },
              { label: 'Design Review', time: '2:00 PM', color: 'bg-violet-500', attendees: [img('/images/avatars/avatar-woman-jessica.jpg'), img('/images/avatars/avatar-man-mike.jpg')], location: 'Design Studio', duration: '1 hour' },
              { label: 'Sprint Planning', time: '4:30 PM', color: 'bg-emerald-500', attendees: [img('/images/avatars/avatar-man-david.jpg'), img('/images/avatars/avatar-woman-grace.jpg'), img('/images/avatars/avatar-man-henry.jpg'), img('/images/avatars/avatar-woman-sarah-kim.jpg')], location: 'Conference Room A', duration: '45 min' },
            ].map((event, i) => (
              <RichTooltip key={i} position="bottom" content={
                <div className="w-60">
                  <div className={`-mx-4 -mt-4 mb-3 px-4 py-3 rounded-t-xl ${event.color}`}>
                    <p className="font-semibold text-sm text-white">{event.label}</p>
                    <p className="text-white/70 text-xs mt-0.5">Today</p>
                  </div>
                  <div className="space-y-2 mb-3">
                    <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                      <Clock size={12} className="text-slate-400" /> {event.time} ({event.duration})
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                      <MapPin size={12} className="text-slate-400" /> {event.location}
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 mb-1.5">Attendees ({event.attendees.length})</p>
                    <div className="flex items-center">
                      {event.attendees.map((img, j) => (
                        <img key={j} src={img} alt="" className="-ms-1.5 first:ms-0 w-6 h-6 rounded-full object-cover border-2 border-white dark:border-slate-800" />
                      ))}
                    </div>
                  </div>
                </div>
              }>
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-primary-300 transition-colors cursor-pointer">
                  <div className={`w-2 h-8 rounded-full ${event.color}`} />
                  <div>
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{event.label}</p>
                    <p className="text-[10px] text-slate-400">{event.time}</p>
                  </div>
                </div>
              </RichTooltip>
            ))}
          </div>
        </div>

        {/* Status & Badge Tooltips */}
        <div className="card p-6">
          <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-2">Status & Badge Tooltips</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-5">Hover over status badges and indicators for more context.</p>
          <div className="flex flex-wrap gap-4">
            <RichTooltip position="bottom" content={
              <div className="w-52">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <p className="font-semibold text-sm text-slate-800 dark:text-slate-200">All Systems Operational</p>
                </div>
                <div className="space-y-1.5">
                  {[
                    { name: 'API Server', status: 'Operational', color: 'bg-emerald-500' },
                    { name: 'Database', status: 'Operational', color: 'bg-emerald-500' },
                    { name: 'CDN', status: 'Operational', color: 'bg-emerald-500' },
                    { name: 'Email Service', status: 'Degraded', color: 'bg-amber-500' },
                  ].map((s, i) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <span className="text-slate-500">{s.name}</span>
                      <div className="flex items-center gap-1.5">
                        <div className={`w-1.5 h-1.5 rounded-full ${s.color}`} />
                        <span className="text-slate-600 dark:text-slate-400">{s.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-slate-400 mt-2 pt-2 border-t border-slate-100 dark:border-slate-700">Last checked: 2 minutes ago</p>
              </div>
            }>
              <span className="badge badge-success cursor-pointer"><CheckCircle size={11} /> Operational</span>
            </RichTooltip>

            <RichTooltip position="bottom" content={
              <div className="w-52">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle size={14} className="text-amber-500" />
                  <p className="font-semibold text-sm text-slate-800 dark:text-slate-200">Performance Warning</p>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed mb-2">Response times are higher than usual. Our team is investigating the issue.</p>
                <div className="flex items-center justify-between p-2 rounded-lg bg-amber-50 dark:bg-amber-900/10">
                  <span className="text-[10px] text-amber-700 dark:text-amber-400">Avg: 420ms (target: 200ms)</span>
                </div>
              </div>
            }>
              <span className="badge badge-warning cursor-pointer"><AlertTriangle size={11} /> Degraded</span>
            </RichTooltip>

            <RichTooltip position="bottom" content={
              <div className="w-52">
                <div className="flex items-center gap-2 mb-2">
                  <Shield size={14} className="text-primary-500" />
                  <p className="font-semibold text-sm text-slate-800 dark:text-slate-200">Verified Account</p>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">This account has been verified through email confirmation and identity verification.</p>
                <p className="text-[10px] text-slate-400 mt-2">Verified since Jan 15, 2024</p>
              </div>
            }>
              <span className="badge badge-primary cursor-pointer"><Shield size={11} /> Verified</span>
            </RichTooltip>

            <RichTooltip position="bottom" content={
              <div className="w-52">
                <div className="flex items-center gap-2 mb-2">
                  <Crown size={14} className="text-amber-500" />
                  <p className="font-semibold text-sm text-slate-800 dark:text-slate-200">Pro Member</p>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed mb-2">This user has an active Pro subscription with full access to premium features.</p>
                <div className="flex items-center gap-2 text-[10px] text-slate-400">
                  <Calendar size={10} /> Renews Mar 15, 2027
                </div>
              </div>
            }>
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-gradient-to-r from-amber-400 to-orange-500 text-white cursor-pointer"><Crown size={11} className="inline -mt-0.5" /> PRO</span>
            </RichTooltip>
          </div>
        </div>

        {/* Image Preview Tooltips */}
        <div className="card p-6">
          <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-2">Image Preview Tooltips</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-5">Hover over links or thumbnails to see full image previews.</p>
          <div className="flex flex-wrap gap-3">
            {[
              { name: 'Mountain Vista', img: img('/images/unsplash/mountain-landscape.jpg'), size: '2.4 MB', dims: '1920x1080' },
              { name: 'Ocean Beach', img: img('/images/unsplash/beach-ocean.jpg'), size: '3.1 MB', dims: '2560x1440' },
              { name: 'Forest Path', img: img('/images/unsplash/forest-path.jpg'), size: '1.8 MB', dims: '1920x1080' },
            ].map((photo, i) => (
              <RichTooltip key={i} position="bottom" content={
                <div className="w-64">
                  <div className="-mx-4 -mt-4 rounded-t-xl overflow-hidden">
                    <img src={photo.img} alt={photo.name} className="w-full h-36 object-cover" />
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{photo.name}</p>
                      <p className="text-[10px] text-slate-400">{photo.dims} - {photo.size}</p>
                    </div>
                    <button className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 pointer-events-auto hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">
                      <Download size={12} className="text-slate-500" />
                    </button>
                  </div>
                </div>
              }>
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-primary-300 transition-colors cursor-pointer">
                  <img src={photo.img} alt={photo.name} className="w-8 h-8 rounded-lg object-cover" />
                  <div>
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{photo.name}</p>
                    <p className="text-[10px] text-slate-400">{photo.size}</p>
                  </div>
                </div>
              </RichTooltip>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
