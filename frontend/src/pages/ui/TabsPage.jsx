import { useState, createElement } from 'react'
import PageHeader from '../../components/shared/PageHeader'
import clsx from 'clsx'
import {
  User, Settings, Bell, Lock, CreditCard, BarChart3, HelpCircle,
  Star, Package, FileText, BarChart2, Inbox, Archive, Edit, Trash2,
  CheckCircle, MapPin, Mail, Phone, Globe, Zap, Shield, Award,
  TrendingUp, MessageSquare, ThumbsUp, ChevronDown, ArrowRight,
} from 'lucide-react'

// ─── Core Tabs component ─────────────────────────────────────────────────────
function Tabs({ tabs, variant = 'line', vertical = false, scrollable = false }) {
  const [active, setActive] = useState(0)

  const tabStyles = {
    line: {
      wrapper: vertical ? 'flex gap-0' : '',
      list: clsx(
        vertical
          ? 'flex flex-col border-e border-slate-200 dark:border-slate-700 pe-0 min-w-40'
          : 'flex border-b border-slate-200 dark:border-slate-700',
        scrollable && !vertical && 'overflow-x-auto',
      ),
      tab: (isActive) => clsx(
        'flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-all duration-150 whitespace-nowrap',
        vertical ? 'text-start border-e-2 -me-px' : 'border-b-2 -mb-px',
        isActive
          ? 'border-primary-500 text-primary-600 dark:text-primary-400'
          : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:border-slate-300',
      ),
    },
    pill: {
      wrapper: '',
      list: clsx('flex gap-1 bg-slate-100 dark:bg-slate-800 rounded-xl p-1', scrollable && 'overflow-x-auto'),
      tab: (isActive) => clsx(
        'flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all duration-150 whitespace-nowrap',
        isActive
          ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm'
          : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300',
      ),
    },
    button: {
      wrapper: '',
      list: clsx('flex gap-2', scrollable && 'overflow-x-auto'),
      tab: (isActive) => clsx(
        'flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border transition-all duration-150 whitespace-nowrap',
        isActive
          ? 'bg-primary-500 text-white border-primary-500 shadow-sm shadow-primary-500/30'
          : 'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-primary-300 hover:text-primary-600',
      ),
    },
    folder: {
      wrapper: '',
      list: clsx('flex gap-0', scrollable && 'overflow-x-auto'),
      tab: (isActive, idx) => clsx(
        'flex items-center gap-2 px-5 py-2.5 text-sm font-medium transition-all duration-150 whitespace-nowrap border-t border-x first:rounded-tl-xl last:rounded-tr-xl',
        isActive
          ? 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 -mb-px pb-3 z-10 relative'
          : 'bg-slate-100 dark:bg-slate-800/50 border-transparent text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300',
      ),
    },
  }

  const style = tabStyles[variant] || tabStyles.line

  return (
    <div className={clsx(style.wrapper)}>
      <div className={style.list}>
        {tabs.map((tab, i) => (
          <button
            key={i}
            onClick={() => setActive(i)}
            className={clsx(
              variant === 'folder' ? style.tab(i === active, i) : style.tab(i === active),
            )}
          >
            {tab.icon && <tab.icon size={15} />}
            <span>{tab.label}</span>
            {tab.badge !== undefined && tab.badge !== null && (
              <span className={clsx(
                'min-w-[1.1rem] h-[1.1rem] px-0.5 rounded-full text-[9px] font-bold flex items-center justify-center',
                i === active
                  ? variant === 'button'
                    ? 'bg-white/30 text-white'
                    : 'bg-primary-100 dark:bg-primary-800 text-primary-700 dark:text-primary-300'
                  : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300',
              )}>
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>
      <div className={clsx(
        'text-sm text-slate-600 dark:text-slate-400',
        vertical ? 'flex-1 ps-5' : 'mt-4',
        variant === 'folder' && 'border border-slate-200 dark:border-slate-700 rounded-b-xl rounded-tr-xl p-4 bg-white dark:bg-slate-800',
      )}>
        {tabs[active]?.content}
      </div>
    </div>
  )
}

// ─── Shared Content Blocks ────────────────────────────────────────────────────
const StatCards = () => (
  <div className="space-y-3">
    <p className="font-semibold text-slate-700 dark:text-slate-300 mb-3">Overview Dashboard</p>
    <div className="grid grid-cols-3 gap-3">
      {[
        { label: 'Total Users', value: '12,480', change: '+8.2%', color: 'text-primary-600' },
        { label: 'Revenue', value: '$48,295', change: '+12.5%', color: 'text-emerald-600' },
        { label: 'Conversion', value: '3.24%', change: '-0.8%', color: 'text-amber-600' },
      ].map(s => (
        <div key={s.label} className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3">
          <p className="text-xs text-slate-500 mb-1">{s.label}</p>
          <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
          <p className="text-xs text-slate-400 mt-0.5">{s.change} this month</p>
        </div>
      ))}
    </div>
    <p className="text-xs text-slate-500 leading-relaxed mt-2">
      Overall performance is trending upward. Revenue growth is outpacing user growth, indicating improved monetization. Monitor conversion rate closely.
    </p>
  </div>
)

const AnalyticsContent = () => (
  <div className="space-y-3">
    <p className="font-semibold text-slate-700 dark:text-slate-300">Analytics Report — March 2026</p>
    <div className="space-y-2">
      {[
        { label: 'Page Views', val: 284921, max: 300000 },
        { label: 'Unique Visitors', val: 48200, max: 60000 },
        { label: 'Bounce Rate', val: 34, max: 100 },
        { label: 'Avg Session (s)', val: 245, max: 400 },
      ].map(m => (
        <div key={m.label}>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-slate-500">{m.label}</span>
            <span className="font-semibold text-slate-700 dark:text-slate-300">{m.val.toLocaleString()}</span>
          </div>
          <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
            <div className="h-full bg-primary-500 rounded-full" style={{ width: `${(m.val / m.max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  </div>
)

const SettingsContent = () => (
  <div className="space-y-3">
    <p className="font-semibold text-slate-700 dark:text-slate-300">Account Settings</p>
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-slate-500 mb-1">Display Name</label>
        <input type="text" className="input text-sm py-2" defaultValue="Alexandra Thompson" />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-500 mb-1">Language</label>
        <select className="input text-sm py-2">
          <option>English (US)</option>
          <option>French</option>
          <option>German</option>
        </select>
      </div>
      <button className="btn btn-primary text-xs py-2 px-4">Save Settings</button>
    </div>
  </div>
)

const SecurityContent = () => (
  <div className="space-y-2">
    <p className="font-semibold text-slate-700 dark:text-slate-300 mb-3">Security Settings</p>
    {[
      { label: 'Two-Factor Authentication', desc: 'Require a code in addition to your password', on: true },
      { label: 'Login Notifications', desc: 'Email alerts for new sign-ins', on: true },
      { label: 'API Access', desc: 'Allow external apps to connect via API', on: false },
      { label: 'Biometric Login', desc: 'Use fingerprint or face ID to sign in', on: false },
    ].map((item, i) => (
      <div key={i} className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-700 last:border-0">
        <div>
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{item.label}</p>
          <p className="text-xs text-slate-400">{item.desc}</p>
        </div>
        <div className={`w-10 h-5 rounded-full transition-colors ${item.on ? 'bg-primary-600' : 'bg-slate-200 dark:bg-slate-600'}`}>
          <div className={`w-4 h-4 bg-white rounded-full mt-0.5 mx-0.5 shadow transition-transform ${item.on ? 'translate-x-5' : 'translate-x-0'}`} />
        </div>
      </div>
    ))}
  </div>
)

const BillingContent = () => (
  <div className="space-y-3">
    <p className="font-semibold text-slate-700 dark:text-slate-300">Billing & Plans</p>
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {[
        { name: 'Starter', price: '$9', current: false, features: ['5 projects', '10 GB storage', 'Email support'] },
        { name: 'Pro', price: '$29', current: true, features: ['Unlimited projects', '100 GB storage', 'Priority support'] },
        { name: 'Enterprise', price: 'Custom', current: false, features: ['Unlimited everything', 'Dedicated server', '24/7 SLA'] },
      ].map(plan => (
        <div key={plan.name} className={clsx('rounded-xl p-3 border', plan.current ? 'border-primary-400 bg-primary-50 dark:bg-primary-900/10' : 'border-slate-200 dark:border-slate-700')}>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{plan.name}</p>
            {plan.current && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-primary-600 text-white">CURRENT</span>}
          </div>
          <p className="text-xl font-bold text-primary-600 dark:text-primary-400 mb-2">{plan.price}<span className="text-xs font-normal text-slate-400">{plan.price !== 'Custom' && '/mo'}</span></p>
          {plan.features.map(f => <p key={f} className="text-xs text-slate-500 mb-0.5">• {f}</p>)}
        </div>
      ))}
    </div>
  </div>
)

// ─── 1. Line Tabs ──────────────────────────────────────────────────────────────
function LineTabsSection() {
  const tabs = [
    { label: 'Overview', icon: BarChart3, content: <StatCards /> },
    { label: 'Analytics', icon: BarChart3, content: <AnalyticsContent /> },
    { label: 'Settings', icon: Settings, content: <SettingsContent /> },
    { label: 'Security', icon: Lock, content: <SecurityContent /> },
    { label: 'Billing', icon: CreditCard, content: <BillingContent /> },
  ]
  return (
    <div className="card p-6">
      <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-1">Line Tabs</h3>
      <p className="text-xs text-slate-500 mb-5">Classic underline indicator with icons</p>
      <Tabs tabs={tabs} variant="line" />
    </div>
  )
}

// ─── 2. Pill Tabs ──────────────────────────────────────────────────────────────
function PillTabsSection() {
  const tabs = [
    { label: 'Overview', icon: BarChart3, content: <StatCards /> },
    { label: 'Analytics', icon: BarChart3, content: <AnalyticsContent /> },
    { label: 'Settings', icon: Settings, content: <SettingsContent /> },
    { label: 'Security', icon: Lock, content: <SecurityContent /> },
    { label: 'Billing', icon: CreditCard, content: <BillingContent /> },
  ]
  return (
    <div className="card p-6">
      <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-1">Pill Tabs</h3>
      <p className="text-xs text-slate-500 mb-5">Pill/segment control style with ghost selected state</p>
      <Tabs tabs={tabs} variant="pill" />
    </div>
  )
}

// ─── 3. Button Tabs ────────────────────────────────────────────────────────────
function ButtonTabsSection() {
  const tabs = [
    { label: 'Overview', icon: BarChart3, content: <StatCards /> },
    { label: 'Analytics', icon: BarChart3, content: <AnalyticsContent /> },
    { label: 'Settings', icon: Settings, content: <SettingsContent /> },
    { label: 'Security', icon: Lock, content: <SecurityContent /> },
  ]
  return (
    <div className="card p-6">
      <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-1">Button Tabs</h3>
      <p className="text-xs text-slate-500 mb-5">Outlined button style — active tab becomes filled primary</p>
      <Tabs tabs={tabs} variant="button" />
    </div>
  )
}

// ─── 4. Vertical Tabs ────────────────────────────────────────────────────────
function VerticalTabsSection() {
  const tabs = [
    { label: 'Profile', icon: User, content: (
      <div className="space-y-2">
        <p className="font-semibold text-slate-700 dark:text-slate-300">Personal Information</p>
        <p className="text-sm">Manage your profile details, bio, and public information visible to other users.</p>
        <div className="grid grid-cols-2 gap-3 mt-3">
          <input type="text" className="input text-sm py-2" defaultValue="Alexandra" />
          <input type="text" className="input text-sm py-2" defaultValue="Thompson" />
        </div>
      </div>
    )},
    { label: 'Settings', icon: Settings, content: <SettingsContent /> },
    { label: 'Notifications', icon: Bell, badge: 5, content: (
      <div className="space-y-2">
        <p className="font-semibold text-slate-700 dark:text-slate-300">Notification Preferences</p>
        <p className="text-sm">You have 5 unread notifications. Configure how and when you receive alerts.</p>
        {['Email digests', 'Push alerts', 'SMS for critical issues'].map(n => (
          <label key={n} className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" defaultChecked className="w-4 h-4 text-primary-600 rounded" />
            <span className="text-sm text-slate-600 dark:text-slate-400">{n}</span>
          </label>
        ))}
      </div>
    )},
    { label: 'Security', icon: Lock, content: <SecurityContent /> },
    { label: 'Billing', icon: CreditCard, content: <BillingContent /> },
    { label: 'Help', icon: HelpCircle, content: (
      <div className="space-y-2">
        <p className="font-semibold text-slate-700 dark:text-slate-300">Help & Support</p>
        <p className="text-sm">Browse our documentation or contact the support team.</p>
        <div className="space-y-2 mt-2">
          {['Documentation', 'Video Tutorials', 'Community Forum', 'Contact Support'].map(link => (
            <div key={link} className="flex items-center gap-2 text-sm text-primary-600 dark:text-primary-400 hover:underline cursor-pointer">• {link}</div>
          ))}
        </div>
      </div>
    )},
  ]
  return (
    <div className="card p-6">
      <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-1">Vertical Tabs</h3>
      <p className="text-xs text-slate-500 mb-5">Left sidebar navigation with content panel on the right</p>
      <Tabs tabs={tabs} variant="line" vertical />
    </div>
  )
}

// ─── 5. Scrollable Tabs ───────────────────────────────────────────────────────
function ScrollableTabsSection() {
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October']
  const [active, setActive] = useState(2)
  return (
    <div className="card p-6">
      <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-1">Scrollable Tabs</h3>
      <p className="text-xs text-slate-500 mb-5">Horizontally scrollable when tabs overflow the container</p>
      <div className="flex border-b border-slate-200 dark:border-slate-700 overflow-x-auto scrollbar-hide">
        {months.map((month, i) => (
          <button
            key={month}
            onClick={() => setActive(i)}
            className={clsx(
              'flex-none px-4 py-2.5 text-sm font-medium transition-all duration-150 border-b-2 -mb-px whitespace-nowrap',
              active === i
                ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:border-slate-300',
            )}
          >
            {month}
          </button>
        ))}
      </div>
      <div className="mt-4 text-sm text-slate-600 dark:text-slate-400">
        <p className="font-semibold text-slate-700 dark:text-slate-300 mb-2">{months[active]} 2026</p>
        <p>Showing analytics data for {months[active]}. Revenue totaled ${(Math.random() * 50000 + 20000).toFixed(0).toLocaleString()}, with {Math.floor(Math.random() * 5000 + 8000)} active users.</p>
      </div>
    </div>
  )
}

// ─── 6. Tabs with Badges ─────────────────────────────────────────────────────
function BadgeTabsSection() {
  const tabs = [
    { label: 'All Items', icon: HelpCircle, badge: 47, content: (
      <div className="space-y-2">
        <p className="font-semibold text-slate-700 dark:text-slate-300">All Items (47)</p>
        <p className="text-sm">Showing all 47 items across all categories and statuses.</p>
      </div>
    )},
    { label: 'Active', icon: User, badge: 24, content: (
      <div className="space-y-2">
        <p className="font-semibold text-slate-700 dark:text-slate-300">Active Items (24)</p>
        <p className="text-sm">24 items are currently active and visible to users.</p>
      </div>
    )},
    { label: 'Pending', icon: Bell, badge: 8, content: (
      <div className="space-y-2">
        <p className="font-semibold text-slate-700 dark:text-slate-300">Pending Review (8)</p>
        <p className="text-sm">8 items are awaiting approval before going live.</p>
      </div>
    )},
    { label: 'Drafts', icon: Settings, badge: 15, content: (
      <div className="space-y-2">
        <p className="font-semibold text-slate-700 dark:text-slate-300">Drafts (15)</p>
        <p className="text-sm">15 draft items saved but not yet submitted for review.</p>
      </div>
    )},
    { label: 'Archived', icon: Lock, content: (
      <div className="space-y-2">
        <p className="font-semibold text-slate-700 dark:text-slate-300">Archived</p>
        <p className="text-sm">Archived items are hidden from users but preserved for reference.</p>
      </div>
    )},
  ]
  return (
    <div className="card p-6">
      <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-1">Tabs with Notification Badges</h3>
      <p className="text-xs text-slate-500 mb-5">Count badges on tabs to indicate unread or pending items</p>
      <Tabs tabs={tabs} variant="pill" />
    </div>
  )
}

// ─── 7. Card / Folder Tabs ────────────────────────────────────────────────────
function CardTabsSection() {
  const tabs = [
    { label: 'Overview', icon: BarChart3, content: <StatCards /> },
    { label: 'Analytics', icon: BarChart3, content: <AnalyticsContent /> },
    { label: 'Settings', icon: Settings, content: <SettingsContent /> },
    { label: 'Billing', icon: CreditCard, content: <BillingContent /> },
  ]
  return (
    <div className="card p-6">
      <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-1">Card / Folder Tabs</h3>
      <p className="text-xs text-slate-500 mb-5">Tabs that look like file folder tabs — active tab is part of the content panel</p>
      <Tabs tabs={tabs} variant="folder" />
    </div>
  )
}

// ─── NEW SECTIONS ─────────────────────────────────────────────────────────────

// 8. Rich Dashboard Profile Tab
function RichDashboardTabSection() {
  const [active, setActive] = useState(0)

  const ProfileTab = () => (
    <div className="space-y-5">
      {/* Profile header */}
      <div className="flex items-start gap-4">
        <div className="w-16 h-16 rounded-2xl bg-primary-500 flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-primary-500/30 shrink-0">
          AT
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="font-bold text-slate-800 dark:text-slate-200 text-base">Alexandra Thompson</h4>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300">Pro</span>
          </div>
          <p className="text-sm text-slate-500 mt-0.5">Senior Product Designer · San Francisco, CA</p>
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            <div className="flex items-center gap-1 text-xs text-slate-400">
              <Mail size={11} />
              <span>alex@example.com</span>
            </div>
            <div className="flex items-center gap-1 text-xs text-slate-400">
              <Globe size={11} />
              <span>alexthompson.dev</span>
            </div>
            <div className="flex items-center gap-1 text-xs text-slate-400">
              <MapPin size={11} />
              <span>UTC-8</span>
            </div>
          </div>
        </div>
        <button className="btn text-xs py-1.5 px-3 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors shrink-0">
          Edit Profile
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Projects', value: '24', icon: Package, color: 'text-primary-600 bg-primary-50 dark:bg-primary-900/20' },
          { label: 'Deployments', value: '847', icon: Zap, color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20' },
          { label: 'Team Members', value: '12', icon: User, color: 'text-violet-600 bg-violet-50 dark:bg-violet-900/20' },
          { label: 'Uptime', value: '99.9%', icon: Shield, color: 'text-amber-600 bg-amber-50 dark:bg-amber-900/20' },
        ].map(stat => (
          <div key={stat.label} className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 text-center">
            <div className={clsx('w-8 h-8 rounded-lg flex items-center justify-center mx-auto mb-1.5', stat.color.split(' ').slice(1).join(' '))}>
              <stat.icon size={14} className={stat.color.split(' ')[0]} />
            </div>
            <p className="text-base font-bold text-slate-800 dark:text-slate-200">{stat.value}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Recent Activity */}
      <div>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Recent Activity</p>
        <div className="space-y-2">
          {[
            { icon: Zap, color: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600', text: 'Deployed v2.4.1 to production', time: '2 min ago' },
            { icon: Edit, color: 'bg-primary-100 dark:bg-primary-900/30 text-primary-600', text: 'Updated environment variables for staging', time: '1 hour ago' },
            { icon: User, color: 'bg-violet-100 dark:bg-violet-900/30 text-violet-600', text: 'Invited Jordan Lee to the team', time: '3 hours ago' },
            { icon: Shield, color: 'bg-amber-100 dark:bg-amber-900/30 text-amber-600', text: 'Rotated API keys for production', time: 'Yesterday' },
            { icon: Archive, color: 'bg-slate-100 dark:bg-slate-700 text-slate-500', text: 'Archived project legacy-v1', time: '2 days ago' },
          ].map((event, i) => (
            <div key={i} className="flex items-center gap-3 py-2 border-b border-slate-100 dark:border-slate-700/50 last:border-0">
              <div className={clsx('w-7 h-7 rounded-lg flex items-center justify-center shrink-0', event.color)}>
                <event.icon size={12} />
              </div>
              <p className="flex-1 text-sm text-slate-600 dark:text-slate-400">{event.text}</p>
              <span className="text-xs text-slate-400 whitespace-nowrap">{event.time}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )

  const ProjectsTab = () => (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-1">
        <p className="font-semibold text-slate-700 dark:text-slate-300">Active Projects</p>
        <button className="text-xs text-primary-600 dark:text-primary-400 hover:underline">View all</button>
      </div>
      {[
        { name: 'liner-design-system', lang: 'TypeScript', deploys: 124, status: 'Live', statusColor: 'bg-emerald-500', updated: '2 min ago' },
        { name: 'marketing-site', lang: 'Next.js', deploys: 58, status: 'Building', statusColor: 'bg-amber-500', updated: '5 min ago' },
        { name: 'api-gateway', lang: 'Go', deploys: 203, status: 'Live', statusColor: 'bg-emerald-500', updated: '1 hour ago' },
        { name: 'admin-dashboard', lang: 'React', deploys: 91, status: 'Live', statusColor: 'bg-emerald-500', updated: '3 hours ago' },
      ].map((proj, i) => (
        <div key={i} className="flex items-center gap-3 p-3 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors cursor-pointer">
          <div className="w-9 h-9 rounded-lg bg-slate-900 dark:bg-slate-700 flex items-center justify-center shrink-0">
            <span className="text-slate-300 font-mono text-[10px] font-bold">{proj.name.slice(0, 2).toUpperCase()}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">{proj.name}</p>
            <p className="text-xs text-slate-400">{proj.lang} · {proj.deploys} deploys</p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <div className={`w-1.5 h-1.5 rounded-full ${proj.statusColor}`} />
            <span className="text-xs text-slate-500">{proj.status}</span>
          </div>
          <span className="text-xs text-slate-400 hidden sm:block">{proj.updated}</span>
        </div>
      ))}
    </div>
  )

  const TeamsTab = () => (
    <div className="space-y-3">
      <p className="font-semibold text-slate-700 dark:text-slate-300 mb-1">Team Members</p>
      {[
        { name: 'Jordan Lee', role: 'Engineering Lead', initials: 'JL', color: 'bg-emerald-500', status: 'online' },
        { name: 'Morgan Davis', role: 'Frontend Engineer', initials: 'MD', color: 'bg-primary-500', status: 'online' },
        { name: 'Casey Kim', role: 'Backend Engineer', initials: 'CK', color: 'bg-amber-500', status: 'away' },
        { name: 'Riley Chen', role: 'DevOps Engineer', initials: 'RC', color: 'bg-rose-500', status: 'offline' },
        { name: 'Sam Patel', role: 'Product Manager', initials: 'SP', color: 'bg-primary-500', status: 'online' },
      ].map((member, i) => (
        <div key={i} className="flex items-center gap-3 p-3 border border-slate-200 dark:border-slate-700 rounded-xl">
          <div className="relative shrink-0">
            <div className={`w-9 h-9 rounded-xl ${member.color} flex items-center justify-center text-white text-xs font-bold shadow`}>
              {member.initials}
            </div>
            <div className={clsx(
              'absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white dark:border-slate-800',
              member.status === 'online' ? 'bg-emerald-500' : member.status === 'away' ? 'bg-amber-500' : 'bg-slate-400',
            )} />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{member.name}</p>
            <p className="text-xs text-slate-400">{member.role}</p>
          </div>
          <span className={clsx(
            'text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize',
            member.status === 'online' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' :
            member.status === 'away' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400' :
            'bg-slate-100 dark:bg-slate-700 text-slate-500',
          )}>
            {member.status}
          </span>
        </div>
      ))}
    </div>
  )

  const tabDefs = [
    { label: 'Profile', icon: User },
    { label: 'Projects', icon: Package, badge: 24 },
    { label: 'Team', icon: User, badge: 5 },
  ]

  const contents = [<ProfileTab />, <ProjectsTab />, <TeamsTab />]

  return (
    <div className="card p-6">
      <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-1">Rich Dashboard Tab</h3>
      <p className="text-xs text-slate-500 mb-5">Profile card with stats, activity feed, projects list, and team roster inside tabs.</p>
      <div className="flex border-b border-slate-200 dark:border-slate-700 mb-5 gap-1">
        {tabDefs.map((tab, i) => (
          <button
            key={i}
            onClick={() => setActive(i)}
            className={clsx(
              'flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-all duration-150 border-b-2 -mb-px',
              active === i
                ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300',
            )}
          >
            <tab.icon size={14} />
            {tab.label}
            {tab.badge && (
              <span className={clsx(
                'min-w-[1.1rem] h-[1.1rem] px-0.5 rounded-full text-[9px] font-bold flex items-center justify-center',
                active === i
                  ? 'bg-primary-100 dark:bg-primary-800 text-primary-700 dark:text-primary-300'
                  : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300',
              )}>
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>
      {contents[active]}
    </div>
  )
}

// 9. Wide Scrollable Tabs (8 tabs)
function WideScrollableTabsSection() {
  const [active, setActive] = useState(0)

  const categories = [
    { label: 'Dashboard', icon: BarChart2, count: null },
    { label: 'Inbox', icon: Inbox, count: 12 },
    { label: 'Projects', icon: Package, count: 8 },
    { label: 'Documents', icon: FileText, count: 34 },
    { label: 'Analytics', icon: TrendingUp, count: null },
    { label: 'Messages', icon: MessageSquare, count: 3 },
    { label: 'Archive', icon: Archive, count: null },
    { label: 'Settings', icon: Settings, count: null },
  ]

  const descriptions = [
    'Your personal command center. View key metrics, recent activity, and upcoming tasks at a glance.',
    '12 unread messages from your team and customers. Filter by project, priority, or sender.',
    '8 active projects across 3 teams. 2 projects are due this week.',
    '34 documents shared with you. Recently edited: Q1 Report, API Spec v3, Onboarding Guide.',
    'March 2026 analytics summary. Page views up 22%, conversions up 8% month-over-month.',
    '3 unread direct messages. Jordan Lee sent you a design review request.',
    'Archived items: 24 projects, 156 documents, 8 team channels from previous quarters.',
    'Manage your account, notifications, integrations, billing, and team settings.',
  ]

  return (
    <div className="card p-6">
      <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-1">Wide Scrollable Tabs</h3>
      <p className="text-xs text-slate-500 mb-5">8 tabs with icons and count badges — scrolls horizontally on narrow viewports.</p>

      <div className="flex border-b border-slate-200 dark:border-slate-700 overflow-x-auto scrollbar-hide -mx-1">
        {categories.map((cat, i) => (
          <button
            key={i}
            onClick={() => setActive(i)}
            className={clsx(
              'flex-none flex items-center gap-2 px-4 py-3 text-sm font-medium transition-all duration-150 border-b-2 -mb-px whitespace-nowrap mx-1',
              active === i
                ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:border-slate-300',
            )}
          >
            <cat.icon size={14} />
            {cat.label}
            {cat.count && (
              <span className={clsx(
                'min-w-[1.25rem] h-5 px-1 rounded-full text-[10px] font-bold flex items-center justify-center',
                active === i
                  ? 'bg-primary-100 dark:bg-primary-800/60 text-primary-700 dark:text-primary-300'
                  : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400',
              )}>
                {cat.count}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="mt-5">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-xl bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center">
            {createElement(categories[active].icon, { size: 16, className: 'text-primary-600 dark:text-primary-400' })}
          </div>
          <div>
            <p className="font-semibold text-slate-800 dark:text-slate-200 text-sm">{categories[active].label}</p>
            {categories[active].count && (
              <p className="text-xs text-slate-400">{categories[active].count} items</p>
            )}
          </div>
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{descriptions[active]}</p>
      </div>
    </div>
  )
}

// 10. Icon-Only Tabs
function IconOnlyTabsSection() {
  const [active, setActive] = useState(0)

  const tabs = [
    { icon: BarChart2, label: 'Analytics', color: 'text-primary-600', bg: 'bg-primary-50 dark:bg-primary-900/20' },
    { icon: Inbox, label: 'Inbox', color: 'text-violet-600', bg: 'bg-violet-50 dark:bg-violet-900/20' },
    { icon: User, label: 'Profile', color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
    { icon: Settings, label: 'Settings', color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-900/20' },
    { icon: Bell, label: 'Alerts', color: 'text-rose-600', bg: 'bg-rose-50 dark:bg-rose-900/20' },
    { icon: FileText, label: 'Docs', color: 'text-slate-600', bg: 'bg-slate-100 dark:bg-slate-700' },
  ]

  const contents = [
    { title: 'Analytics', desc: 'Track your key metrics, conversion rates, and performance trends across all projects in one place.' },
    { title: 'Inbox', desc: 'All messages, mentions, and notifications consolidated in a single inbox with smart filtering.' },
    { title: 'Profile', desc: 'Manage your public profile, bio, contact information, and social links.' },
    { title: 'Settings', desc: 'Configure your workspace, integrations, API tokens, and team permissions.' },
    { title: 'Alerts', desc: 'Set up smart alerts for deployments, errors, and performance thresholds.' },
    { title: 'Docs', desc: 'Browse and search your team\'s documentation, runbooks, and architecture diagrams.' },
  ]

  return (
    <div className="card p-6">
      <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-1">Icon-Only Tabs</h3>
      <p className="text-xs text-slate-500 mb-5">Compact icon-only tab bar — ideal for sidebars or space-constrained layouts.</p>

      <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-xl p-1.5 w-fit">
        {tabs.map((tab, i) => (
          <button
            key={i}
            onClick={() => setActive(i)}
            title={tab.label}
            className={clsx(
              'relative w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-200',
              active === i
                ? 'bg-white dark:bg-slate-700 shadow-sm ' + tab.color
                : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-white/50 dark:hover:bg-slate-700/50',
            )}
          >
            <tab.icon size={16} />
            {active === i && (
              <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-current" />
            )}
          </button>
        ))}
      </div>

      <div className="mt-5 flex items-start gap-4">
        <div className={clsx('w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition-all duration-300', tabs[active].bg)}>
          {createElement(tabs[active].icon, { size: 20, className: tabs[active].color })}
        </div>
        <div>
          <p className="font-semibold text-slate-800 dark:text-slate-200 mb-1">{contents[active].title}</p>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{contents[active].desc}</p>
        </div>
      </div>
    </div>
  )
}

// 11. Tabs with Counts and Status Dots
function StatusTabsSection() {
  const [active, setActive] = useState(0)

  const tabs = [
    {
      label: 'All',
      icon: Package,
      count: 94,
      countBg: 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300',
      countBgActive: 'bg-slate-700 dark:bg-slate-200 text-white dark:text-slate-800',
      dot: null,
      content: 'Showing all 94 items across every status category. Use filters to narrow your view.',
    },
    {
      label: 'Active',
      icon: Zap,
      count: 42,
      countBg: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300',
      countBgActive: 'bg-emerald-500 text-white',
      dot: 'bg-emerald-500',
      content: '42 items are currently live and receiving traffic. Average response time: 84ms.',
    },
    {
      label: 'Building',
      icon: TrendingUp,
      count: 7,
      countBg: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300',
      countBgActive: 'bg-amber-500 text-white',
      dot: 'bg-amber-500',
      content: '7 builds are currently in progress. Estimated completion within the next 2–4 minutes.',
    },
    {
      label: 'Failed',
      icon: Shield,
      count: 3,
      countBg: 'bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300',
      countBgActive: 'bg-rose-500 text-white',
      dot: 'bg-rose-500',
      content: '3 deployments failed in the last 24 hours. Click a deployment to view error logs and retry.',
    },
    {
      label: 'Paused',
      icon: Archive,
      count: 12,
      countBg: 'bg-slate-100 dark:bg-slate-700 text-slate-500',
      countBgActive: 'bg-slate-400 text-white',
      dot: 'bg-slate-400',
      content: '12 deployments are paused pending manual approval or scheduled maintenance window.',
    },
    {
      label: 'Archived',
      icon: Trash2,
      count: 30,
      countBg: 'bg-slate-100 dark:bg-slate-700 text-slate-400',
      countBgActive: 'bg-slate-300 dark:bg-slate-600 text-slate-700 dark:text-slate-200',
      dot: null,
      content: '30 archived deployments preserved for reference. Archived items do not consume compute resources.',
    },
  ]

  return (
    <div className="card p-6">
      <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-1">Tabs with Counts & Status Dots</h3>
      <p className="text-xs text-slate-500 mb-5">Each tab carries a colored count badge and an animated status dot for live-state feedback.</p>

      <div className="flex gap-1.5 flex-wrap">
        {tabs.map((tab, i) => (
          <button
            key={i}
            onClick={() => setActive(i)}
            className={clsx(
              'flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium transition-all duration-150 border',
              active === i
                ? 'bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 border-slate-800 dark:border-slate-200 shadow-md'
                : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600',
            )}
          >
            {tab.dot && (
              <span className={clsx(
                'w-2 h-2 rounded-full shrink-0',
                tab.dot,
                active === i && tab.dot === 'bg-amber-500' ? 'animate-pulse' : '',
              )} />
            )}
            <tab.icon size={13} />
            {tab.label}
            <span className={clsx(
              'min-w-[1.3rem] h-5 px-1 rounded-full text-[10px] font-bold flex items-center justify-center',
              active === i ? tab.countBgActive : tab.countBg,
            )}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      <div className="mt-5 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-2 mb-2">
          {tabs[active].dot && <span className={`w-2 h-2 rounded-full ${tabs[active].dot}`} />}
          {createElement(tabs[active].icon, { size: 14, className: 'text-slate-500' })}
          <p className="font-semibold text-sm text-slate-700 dark:text-slate-300">
            {tabs[active].label} · {tabs[active].count} items
          </p>
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{tabs[active].content}</p>
      </div>
    </div>
  )
}

// 12. Bordered Fill-Box Tabs
function BorderedBoxTabsSection() {
  const [active, setActive] = useState(0)

  const tabs = [
    { label: 'Monthly', icon: BarChart2 },
    { label: 'Quarterly', icon: TrendingUp },
    { label: 'Annually', icon: Award },
  ]

  const data = [
    { period: 'Monthly', rows: [
      ['January 2026', '$24,820', '+12.4%', '1,284'],
      ['February 2026', '$27,510', '+10.8%', '1,402'],
      ['March 2026', '$31,090', '+13.0%', '1,621'],
    ]},
    { period: 'Quarterly', rows: [
      ['Q1 2026', '$83,420', '+12.1%', '4,307'],
      ['Q2 2025', '$74,430', '+8.4%', '3,912'],
      ['Q3 2025', '$68,650', '+5.2%', '3,601'],
    ]},
    { period: 'Annual', rows: [
      ['2026 (YTD)', '$83,420', '+12.1%', '4,307'],
      ['2025', '$289,800', '+28.4%', '15,204'],
      ['2024', '$225,700', '+18.2%', '11,890'],
    ]},
  ]

  return (
    <div className="card p-6">
      <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-1">Bordered Box Tabs</h3>
      <p className="text-xs text-slate-500 mb-5">Filled active tab inside a bordered container — clean financial report style.</p>

      <div className="border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden">
        {/* Tab bar */}
        <div className="flex border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60">
          {tabs.map((tab, i) => (
            <button
              key={i}
              onClick={() => setActive(i)}
              className={clsx(
                'flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold transition-all duration-150',
                active === i
                  ? 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-b-2 border-primary-500'
                  : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 border-b-2 border-transparent',
              )}
            >
              <tab.icon size={14} />
              {tab.label}
            </button>
          ))}
        </div>
        {/* Content */}
        <div className="p-4 bg-white dark:bg-slate-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-700">
                {['Period', 'Revenue', 'Growth', 'Users'].map(col => (
                  <th key={col} className="pb-2 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide">{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data[active].rows.map((row, j) => (
                <tr key={j} className="border-b border-slate-50 dark:border-slate-700/50 last:border-0">
                  <td className="py-2.5 font-medium text-slate-700 dark:text-slate-300">{row[0]}</td>
                  <td className="py-2.5 font-bold text-slate-800 dark:text-slate-200">{row[1]}</td>
                  <td className="py-2.5">
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{row[2]}</span>
                  </td>
                  <td className="py-2.5 text-slate-600 dark:text-slate-400">{row[3]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// 13. Full Product Page Example
function ProductPageTabsSection() {
  const [active, setActive] = useState(0)

  // Sub-accordion for FAQ tab
  const [faqOpen, setFaqOpen] = useState(null)
  const faqs = [
    { q: 'What materials is the product made of?', a: 'The chassis is aerospace-grade anodized aluminum (6061-T6). Internal components use industrial-grade stainless steel fasteners with titanium heat spreaders for optimal thermal management.' },
    { q: 'Is the warranty transferable?', a: 'Yes, the 2-year limited warranty is fully transferable to subsequent owners within the warranty period. Transfer requires registration at our support portal.' },
    { q: 'Does it support third-party firmware?', a: 'The product ships with open firmware under the Apache 2.0 license. Community firmware is supported via the official SDK. Custom firmware voids the hardware warranty but not software support.' },
  ]

  const tabs = [
    { label: 'Overview', icon: Package },
    { label: 'Reviews', icon: Star },
    { label: 'Specifications', icon: FileText },
    { label: 'FAQs', icon: HelpCircle },
  ]

  const OverviewContent = () => (
    <div className="space-y-5">
      {/* Hero description */}
      <div className="flex gap-4">
        <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-2xl bg-slate-200 dark:bg-slate-700 flex items-center justify-center shrink-0 shadow-inner">
          <Package size={36} className="text-slate-400 dark:text-slate-500" />
        </div>
        <div>
          <div className="flex items-start gap-2 flex-wrap mb-2">
            <h4 className="font-bold text-slate-800 dark:text-slate-200 text-lg leading-tight">Liner Pro Hub X1</h4>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 mt-0.5">In Stock</span>
          </div>
          <div className="flex items-center gap-1 mb-2">
            {[1,2,3,4,5].map(s => (
              <Star key={s} size={13} className={s <= 4 ? 'text-amber-400 fill-amber-400' : 'text-slate-300 fill-slate-300'} />
            ))}
            <span className="text-xs text-slate-500 ml-1">4.6 · 218 reviews</span>
          </div>
          <p className="text-2xl font-black text-slate-800 dark:text-slate-200">$299<span className="text-sm font-normal text-slate-400 ml-1">.00</span></p>
        </div>
      </div>

      <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
        The Liner Pro Hub X1 is a professional-grade connectivity hub engineered for developers, designers, and power users who demand performance without compromise. With 14 ports, 10Gbps USB-C throughput, and 100W pass-through charging, it keeps your entire workspace connected from a single cable.
      </p>

      {/* Feature highlights */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {[
          { icon: Zap, label: '10Gbps USB-C', sub: 'Thunderbolt 4' },
          { icon: Shield, label: '100W Charging', sub: 'Pass-through' },
          { icon: Globe, label: '2.5G Ethernet', sub: 'Multi-gigabit' },
          { icon: BarChart2, label: '4K@144Hz', sub: 'DisplayPort 2.0' },
          { icon: Bell, label: '14 Ports', sub: 'USB-A, C, HDMI' },
          { icon: Award, label: '5-Year Warranty', sub: 'US & EU' },
        ].map(f => (
          <div key={f.label} className="flex items-center gap-2.5 p-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
            <div className="w-7 h-7 rounded-lg bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center shrink-0">
              <f.icon size={13} className="text-primary-600 dark:text-primary-400" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 leading-none">{f.label}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">{f.sub}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-2 pt-1">
        <button className="flex-1 py-2.5 bg-primary-500 hover:bg-primary-600 text-white text-sm font-semibold rounded-xl transition-colors shadow-md shadow-primary-500/25">
          Add to Cart
        </button>
        <button className="px-4 py-2.5 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-sm font-medium rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
          Save
        </button>
      </div>
    </div>
  )

  const ReviewsContent = () => (
    <div className="space-y-4">
      {/* Summary */}
      <div className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700">
        <div className="text-center shrink-0">
          <p className="text-4xl font-black text-slate-800 dark:text-slate-200">4.6</p>
          <div className="flex items-center gap-0.5 justify-center mt-1">
            {[1,2,3,4,5].map(s => (
              <Star key={s} size={11} className={s <= 4 ? 'text-amber-400 fill-amber-400' : 'text-slate-300 fill-slate-300'} />
            ))}
          </div>
          <p className="text-xs text-slate-400 mt-1">218 reviews</p>
        </div>
        <div className="flex-1 space-y-1.5">
          {[
            { stars: 5, pct: 62 },
            { stars: 4, pct: 24 },
            { stars: 3, pct: 9 },
            { stars: 2, pct: 3 },
            { stars: 1, pct: 2 },
          ].map(r => (
            <div key={r.stars} className="flex items-center gap-2">
              <span className="text-[10px] text-slate-400 w-3 shrink-0">{r.stars}</span>
              <Star size={9} className="text-amber-400 fill-amber-400 shrink-0" />
              <div className="flex-1 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                <div className="h-full bg-amber-400 rounded-full" style={{ width: `${r.pct}%` }} />
              </div>
              <span className="text-[10px] text-slate-400 w-6 shrink-0 text-right">{r.pct}%</span>
            </div>
          ))}
        </div>
      </div>

      {/* Review cards */}
      {[
        {
          name: 'Marcus R.',
          initials: 'MR',
          color: 'bg-primary-500',
          rating: 5,
          title: 'Best hub I\'ve ever used',
          date: 'March 8, 2026',
          verified: true,
          helpful: 42,
          text: 'I\'ve tried at least 6 USB-C hubs over the past 3 years and this one is in a completely different league. Zero dropouts, charges my MacBook Pro and my iPad simultaneously without any throttling. The build quality is exceptional — it\'s heavy in a good way.',
        },
        {
          name: 'Priya S.',
          initials: 'PS',
          color: 'bg-primary-500',
          rating: 4,
          title: 'Excellent performance, minor software nit',
          date: 'February 28, 2026',
          verified: true,
          helpful: 18,
          text: 'Performance is flawless. Running dual 4K monitors at 60Hz each with USB-C connected laptop — absolutely no issues. Docking one star only because the companion app for firmware updates is macOS-only for now. Confirmed Windows support is coming Q2 2026.',
        },
        {
          name: 'Alex W.',
          initials: 'AW',
          color: 'bg-emerald-500',
          rating: 5,
          title: 'Game changer for my home office',
          date: 'February 14, 2026',
          verified: false,
          helpful: 9,
          text: 'Replaced three separate adapters with this one hub. Ethernet, dual HDMI, SD card, and multiple USB-A all working simultaneously without any performance degradation. The 100W charging is legitimately fast.',
        },
      ].map((review, i) => (
        <div key={i} className="border border-slate-200 dark:border-slate-700 rounded-2xl p-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-xl ${review.color} flex items-center justify-center text-white text-xs font-bold shadow shrink-0`}>
                {review.initials}
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">{review.name}</p>
                  {review.verified && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400">
                      Verified Purchase
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400">{review.date}</p>
              </div>
            </div>
            <div className="flex items-center gap-0.5 shrink-0">
              {[1,2,3,4,5].map(s => (
                <Star key={s} size={11} className={s <= review.rating ? 'text-amber-400 fill-amber-400' : 'text-slate-300 fill-slate-300'} />
              ))}
            </div>
          </div>
          <div>
            <p className="font-semibold text-sm text-slate-700 dark:text-slate-300 mb-1">{review.title}</p>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{review.text}</p>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <button className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
              <ThumbsUp size={12} />
              Helpful ({review.helpful})
            </button>
          </div>
        </div>
      ))}
    </div>
  )

  const SpecsContent = () => (
    <div className="space-y-4">
      {[
        {
          category: 'Connectivity',
          rows: [
            ['USB-C (Thunderbolt 4)', '2 × 40Gbps, up to 100W PD'],
            ['USB-C (USB 3.2 Gen 2)', '2 × 10Gbps'],
            ['USB-A (USB 3.2 Gen 2)', '4 × 10Gbps'],
            ['USB-A (USB 2.0)', '2 × 480Mbps'],
            ['HDMI', '2 × HDMI 2.1 (4K@144Hz)'],
            ['DisplayPort', '1 × DP 2.0 (8K@60Hz)'],
            ['Ethernet', '1 × 2.5G RJ45'],
            ['SD / microSD', 'SD 4.0 / microSD 4.0 (312MB/s)'],
            ['3.5mm Audio', '1 × Combo jack'],
          ],
        },
        {
          category: 'Power',
          rows: [
            ['Host charging (PD)', 'Up to 100W pass-through'],
            ['Downstream USB-C PD', '2 × 20W'],
            ['Downstream USB-A', '4 × 12W (Quick Charge 3.0)'],
            ['Power input', 'AC 100–240V, 180W adapter included'],
          ],
        },
        {
          category: 'Physical',
          rows: [
            ['Dimensions', '198 × 86 × 28 mm'],
            ['Weight', '420 g'],
            ['Material', 'Anodized aluminum (6061-T6)'],
            ['Operating temp.', '0°C to 40°C'],
            ['Warranty', '2 years limited'],
          ],
        },
      ].map(section => (
        <div key={section.category}>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">{section.category}</p>
          <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
            {section.rows.map(([label, value], j) => (
              <div
                key={j}
                className={clsx(
                  'flex gap-4 px-4 py-2.5 text-sm',
                  j % 2 === 0 ? 'bg-white dark:bg-slate-800' : 'bg-slate-50 dark:bg-slate-800/40',
                )}
              >
                <span className="text-slate-500 dark:text-slate-400 w-40 shrink-0">{label}</span>
                <span className="font-medium text-slate-700 dark:text-slate-300">{value}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )

  const FAQContent = () => (
    <div className="space-y-2">
      {faqs.map((item, i) => (
        <div key={i} className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
          <button
            onClick={() => setFaqOpen(o => o === i ? null : i)}
            className={clsx(
              'w-full flex items-center gap-3 p-4 text-left transition-colors',
              faqOpen === i ? 'bg-primary-50 dark:bg-primary-900/10' : 'hover:bg-slate-50 dark:hover:bg-slate-800/30',
            )}
          >
            <div className={clsx(
              'w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-xs font-bold transition-colors',
              faqOpen === i ? 'bg-primary-500 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-500',
            )}>
              {i + 1}
            </div>
            <span className={clsx('flex-1 font-medium text-sm', faqOpen === i ? 'text-primary-700 dark:text-primary-300' : 'text-slate-700 dark:text-slate-300')}>
              {item.q}
            </span>
            <ChevronDown size={14} className={clsx('shrink-0 transition-transform duration-300 text-slate-400', faqOpen === i && 'rotate-180 text-primary-500')} />
          </button>
          <div className={clsx('overflow-hidden transition-all duration-300', faqOpen === i ? 'max-h-40 opacity-100' : 'max-h-0 opacity-0')}>
            <p className="px-4 pb-4 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{item.a}</p>
          </div>
        </div>
      ))}
    </div>
  )

  const contents = [<OverviewContent />, <ReviewsContent />, <SpecsContent />, <FAQContent />]

  return (
    <div className="card p-6">
      <div className="mb-5">
        <h3 className="font-semibold text-slate-800 dark:text-slate-200">Full Product Page Example</h3>
        <p className="text-xs text-slate-500 mt-0.5">Complete e-commerce product tabs: Overview, Reviews, Specs, and FAQs — all with rich content.</p>
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-slate-200 dark:border-slate-700 mb-5 overflow-x-auto scrollbar-hide">
        {tabs.map((tab, i) => (
          <button
            key={i}
            onClick={() => setActive(i)}
            className={clsx(
              'flex items-center gap-2 px-5 py-3 text-sm font-medium transition-all duration-150 border-b-2 -mb-px whitespace-nowrap',
              active === i
                ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:border-slate-300',
            )}
          >
            <tab.icon size={14} />
            {tab.label}
          </button>
        ))}
      </div>

      {contents[active]}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function TabsPage() {
  return (
    <div className="space-y-8">
      <PageHeader title="Tabs" subtitle="Line, pill, button, vertical, scrollable, badge, folder, icon-only, status, and product-page tab variants with rich content" />

      <div className="grid grid-cols-1 gap-6">
        <LineTabsSection />
        <PillTabsSection />
        <ButtonTabsSection />
        <VerticalTabsSection />
        <ScrollableTabsSection />
        <BadgeTabsSection />
        <CardTabsSection />
      </div>

      {/* New premium sections */}
      <div className="grid grid-cols-1 gap-6">
        <RichDashboardTabSection />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <WideScrollableTabsSection />
        <IconOnlyTabsSection />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <StatusTabsSection />
        <BorderedBoxTabsSection />
      </div>

      <ProductPageTabsSection />
    </div>
  )
}
