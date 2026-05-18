import { useState } from 'react'
import PageHeader from '../../components/shared/PageHeader'
import { Settings, Globe, Bell, Key, Eye, EyeOff } from 'lucide-react'

// Reusable horizontal row wrapper
function HRow({ label, hint, required, children, align = 'center' }) {
  return (
    <div className={`grid grid-cols-12 gap-x-4 gap-y-1 items-${align}`}>
      <div className="col-span-12 sm:col-span-4 sm:text-right">
        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
          {label}
          {required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
        {hint && <p className="text-xs text-slate-400 mt-0.5 hidden sm:block">{hint}</p>}
      </div>
      <div className="col-span-12 sm:col-span-8">{children}</div>
    </div>
  )
}

// Toggle switch
function Toggle({ checked, onChange, id }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      id={id}
      onClick={() => onChange(!checked)}
      className={`relative w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900 ${checked ? 'bg-primary-600' : 'bg-slate-200 dark:bg-slate-700'}`}
    >
      <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200 ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
    </button>
  )
}

// Password strength bar
function PasswordStrengthBar({ password }) {
  const getStrength = (pw) => {
    if (!pw) return 0
    let score = 0
    if (pw.length >= 8) score++
    if (pw.length >= 12) score++
    if (/[A-Z]/.test(pw)) score++
    if (/[0-9]/.test(pw)) score++
    if (/[^A-Za-z0-9]/.test(pw)) score++
    return Math.min(score, 4)
  }
  const strength = getStrength(password)
  const labels = ['', 'Weak', 'Fair', 'Good', 'Strong']
  const colors = ['', 'bg-red-500', 'bg-amber-400', 'bg-blue-500', 'bg-emerald-500']
  const textColors = ['', 'text-red-500', 'text-amber-500', 'text-blue-500', 'text-emerald-500']

  if (!password) return null
  return (
    <div className="mt-2">
      <div className="flex gap-1 mb-1">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${i <= strength ? colors[strength] : 'bg-slate-200 dark:bg-slate-700'}`} />
        ))}
      </div>
      <p className={`text-xs font-medium ${textColors[strength]}`}>{labels[strength]} password</p>
    </div>
  )
}

// Section card wrapper
function Section({ icon: Icon, title, subtitle, children, color = 'primary' }) {
  const colorMap = {
    primary: 'text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20',
    emerald: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20',
    violet: 'text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-900/20',
    amber: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20',
    slate: 'text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800',
  }
  return (
    <div className="card overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center gap-3">
        {Icon && (
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${colorMap[color]}`}>
            <Icon size={16} />
          </div>
        )}
        <div>
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">{title}</h3>
          {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      <div className="p-6">{children}</div>
    </div>
  )
}

// ─── 1. Basic Horizontal Form ─────────────────────────────────────────────────
function BasicHorizontalForm() {
  return (
    <Section
      icon={Settings}
      title="Basic Horizontal Form"
      subtitle="Label on the left (1/3), input on the right (2/3)"
      color="primary"
    >
      <form className="space-y-5 w-full">
        <HRow label="First Name" required>
          <input type="text" className="input" placeholder="John" />
        </HRow>

        <HRow label="Last Name" required>
          <input type="text" className="input" placeholder="Doe" />
        </HRow>

        <HRow label="Email Address" required hint="Used for login and notifications">
          <input type="email" className="input" placeholder="john@example.com" />
        </HRow>

        <HRow label="Phone Number" hint="Include country code">
          <input type="tel" className="input" placeholder="+1 (555) 000-0000" />
        </HRow>

        <HRow label="Role" required>
          <select className="input">
            <option value="">Select a role...</option>
            <option>Administrator</option>
            <option>Manager</option>
            <option>Developer</option>
            <option>Designer</option>
            <option>Analyst</option>
          </select>
        </HRow>

        <HRow label="Bio" hint="Max 300 characters" align="start">
          <textarea className="input resize-none" rows={4} placeholder="Tell us about yourself..." />
        </HRow>

        <div className="grid grid-cols-12 gap-x-4">
          <div className="col-span-12 sm:col-start-5 sm:col-span-8 flex gap-3">
            <button type="submit" className="btn btn-primary">Save Profile</button>
            <button type="button" className="btn btn-secondary">Reset</button>
          </div>
        </div>
      </form>
    </Section>
  )
}

// ─── 2. Settings Form ──────────────────────────────────────────────────────────
function SettingsHorizontalForm() {
  return (
    <Section
      icon={Globe}
      title="Localization Settings"
      subtitle="Configure language, timezone, formats and currency"
      color="emerald"
    >
      <form className="space-y-5 w-full">
        <HRow label="Language" hint="Interface display language">
          <select className="input">
            <option>English (US)</option>
            <option>English (UK)</option>
            <option>French</option>
            <option>German</option>
            <option>Spanish</option>
            <option>Japanese</option>
            <option>Chinese (Simplified)</option>
            <option>Arabic</option>
          </select>
        </HRow>

        <HRow label="Timezone" hint="All times shown in this zone">
          <select className="input">
            <option>UTC-8:00 — Pacific Time (US & Canada)</option>
            <option>UTC-5:00 — Eastern Time (US & Canada)</option>
            <option>UTC+0:00 — London, Edinburgh</option>
            <option>UTC+1:00 — Paris, Berlin, Amsterdam</option>
            <option>UTC+5:30 — Mumbai, Kolkata</option>
            <option>UTC+8:00 — Beijing, Singapore</option>
            <option>UTC+9:00 — Tokyo, Seoul</option>
          </select>
        </HRow>

        <HRow label="Date Format" hint="Choose how dates are displayed">
          <div className="flex flex-wrap gap-3">
            {['MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD', 'DD MMM YYYY'].map((fmt, i) => (
              <label key={fmt} className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="dateFormat" className="w-4 h-4 text-primary-600" defaultChecked={i === 0} />
                <span className="text-sm font-mono text-slate-600 dark:text-slate-400">{fmt}</span>
              </label>
            ))}
          </div>
        </HRow>

        <HRow label="Time Format">
          <div className="flex gap-4">
            {['12-hour (AM/PM)', '24-hour'].map((fmt, i) => (
              <label key={fmt} className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="timeFormat" className="w-4 h-4 text-primary-600" defaultChecked={i === 0} />
                <span className="text-sm text-slate-600 dark:text-slate-400">{fmt}</span>
              </label>
            ))}
          </div>
        </HRow>

        <HRow label="Currency" hint="Affects pricing display">
          <select className="input">
            <option>USD — US Dollar ($)</option>
            <option>EUR — Euro (€)</option>
            <option>GBP — British Pound (£)</option>
            <option>JPY — Japanese Yen (¥)</option>
            <option>CAD — Canadian Dollar (C$)</option>
            <option>AUD — Australian Dollar (A$)</option>
            <option>INR — Indian Rupee (₹)</option>
          </select>
        </HRow>

        <HRow label="Number Format">
          <select className="input">
            <option>1,234,567.89 (US)</option>
            <option>1.234.567,89 (European)</option>
            <option>1 234 567.89 (Swiss)</option>
          </select>
        </HRow>

        <div className="grid grid-cols-12 gap-x-4">
          <div className="col-span-12 sm:col-start-5 sm:col-span-8 flex gap-3">
            <button type="submit" className="btn btn-primary">Apply Settings</button>
            <button type="button" className="btn btn-secondary">Reset to Default</button>
          </div>
        </div>
      </form>
    </Section>
  )
}

// ─── 3. Notification Preferences ──────────────────────────────────────────────
function NotificationPreferences() {
  const [prefs, setPrefs] = useState({
    emailMarketing: true,
    emailSystem: true,
    emailUpdates: false,
    pushMentions: true,
    pushMessages: true,
    pushAlerts: false,
    smsOTP: true,
    smsAlerts: false,
    inAppAll: true,
    inAppDMs: true,
    weeklyReport: true,
    monthlyReport: false,
  })

  const toggle = key => setPrefs(p => ({ ...p, [key]: !p[key] }))

  const notifGroups = [
    {
      group: 'Email Notifications',
      items: [
        { key: 'emailMarketing', label: 'Marketing emails', desc: 'News, product updates, and promotional offers' },
        { key: 'emailSystem', label: 'System emails', desc: 'Account activity, security alerts, login notices' },
        { key: 'emailUpdates', label: 'Product updates', desc: 'New features, changelog, and release notes' },
      ],
    },
    {
      group: 'Push Notifications',
      items: [
        { key: 'pushMentions', label: 'Mentions', desc: 'When someone mentions you in a comment' },
        { key: 'pushMessages', label: 'Direct messages', desc: 'New messages in your inbox' },
        { key: 'pushAlerts', label: 'System alerts', desc: 'Downtime notices and critical system events' },
      ],
    },
    {
      group: 'SMS Notifications',
      items: [
        { key: 'smsOTP', label: 'One-time passwords', desc: 'Two-factor authentication codes' },
        { key: 'smsAlerts', label: 'Security alerts', desc: 'Suspicious login and account compromise alerts' },
      ],
    },
    {
      group: 'Digest & Reports',
      items: [
        { key: 'weeklyReport', label: 'Weekly activity digest', desc: 'Summary of your activity every Monday morning' },
        { key: 'monthlyReport', label: 'Monthly analytics report', desc: 'Detailed performance metrics for the past month' },
      ],
    },
  ]

  return (
    <Section
      icon={Bell}
      title="Notification Preferences"
      subtitle="Control exactly how and when you receive notifications"
      color="amber"
    >
      <form className="w-full space-y-6">
        {notifGroups.map(group => (
          <div key={group.group}>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">{group.group}</p>
            <div className="space-y-1 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden divide-y divide-slate-200 dark:divide-slate-700">
              {group.items.map(item => (
                <div key={item.key} className="grid grid-cols-12 items-center gap-x-4 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                  <div className="col-span-10">
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{item.label}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{item.desc}</p>
                  </div>
                  <div className="col-span-2 flex justify-end">
                    <Toggle checked={prefs[item.key]} onChange={() => toggle(item.key)} id={item.key} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        <div className="grid grid-cols-12 gap-x-4">
          <div className="col-span-12 flex gap-3">
            <button type="submit" className="btn btn-primary">Save Preferences</button>
            <button type="button" className="btn btn-secondary">Reset All</button>
          </div>
        </div>
      </form>
    </Section>
  )
}

// ─── 4. Advanced Config Form ──────────────────────────────────────────────────
function AdvancedConfigForm() {
  const [enabled, setEnabled] = useState(true)

  return (
    <Section
      icon={Settings}
      title="Advanced Configuration"
      subtitle="API and system-level settings for power users"
      color="violet"
    >
      <form className="space-y-5 w-full">
        <HRow label="API Endpoint" required hint="Base URL for all API requests">
          <div className="flex gap-2">
            <input type="url" className="input flex-1" defaultValue="https://api.example.com/v2" />
            <button type="button" className="btn btn-secondary shrink-0 text-xs">Test</button>
          </div>
        </HRow>

        <HRow label="API Key" hint="Keep this secret">
          <div className="relative">
            <input type="password" className="input pr-20 font-mono text-xs" defaultValue="sk-live-xxxxxxxxxxxxxxxxxxxx" />
            <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-medium text-primary-600 dark:text-primary-400 hover:underline">
              Regenerate
            </button>
          </div>
        </HRow>

        <HRow label="Timeout (ms)" hint="Max wait time per request">
          <div className="flex items-center gap-3">
            <input type="number" className="input w-32" defaultValue="5000" min="100" max="60000" step="100" />
            <span className="text-sm text-slate-500">milliseconds</span>
          </div>
        </HRow>

        <HRow label="Max Retries" hint="Attempts before failing">
          <div className="flex items-center gap-3">
            <input type="number" className="input w-24" defaultValue="3" min="0" max="10" />
            <span className="text-sm text-slate-500">retries</span>
          </div>
        </HRow>

        <HRow label="Retry Delay" hint="Delay between retries">
          <div className="flex items-center gap-3">
            <input type="number" className="input w-32" defaultValue="1000" min="0" max="30000" step="100" />
            <span className="text-sm text-slate-500">milliseconds</span>
          </div>
        </HRow>

        <HRow label="Environment" required hint="Changes which API URL is used">
          <select className="input">
            <option value="production">Production</option>
            <option value="staging">Staging</option>
            <option value="development">Development</option>
            <option value="sandbox">Sandbox</option>
          </select>
        </HRow>

        <HRow label="Log Level">
          <div className="flex flex-wrap gap-3">
            {['ERROR', 'WARN', 'INFO', 'DEBUG', 'VERBOSE'].map((lvl, i) => (
              <label key={lvl} className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="logLevel" defaultChecked={i === 2} className="w-4 h-4 text-primary-600" />
                <span className={`text-xs font-mono font-semibold ${
                  lvl === 'ERROR' ? 'text-red-500' :
                  lvl === 'WARN' ? 'text-amber-500' :
                  lvl === 'INFO' ? 'text-blue-500' :
                  lvl === 'DEBUG' ? 'text-violet-500' :
                  'text-slate-500'
                }`}>{lvl}</span>
              </label>
            ))}
          </div>
        </HRow>

        <HRow label="Service Enabled" hint="Disable to pause all API calls">
          <div className="flex items-center gap-3">
            <Toggle checked={enabled} onChange={setEnabled} id="service-enabled" />
            <span className={`text-sm font-medium ${enabled ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500'}`}>
              {enabled ? 'Service is active' : 'Service is paused'}
            </span>
          </div>
        </HRow>

        <div className="grid grid-cols-12 gap-x-4">
          <div className="col-span-12 sm:col-start-5 sm:col-span-8">
            <div className="flex gap-3">
              <button type="submit" className="btn btn-primary">Save Configuration</button>
              <button type="button" className="btn btn-secondary">Reset to Default</button>
            </div>
            <p className="text-xs text-slate-400 mt-2">Changes take effect on next request cycle.</p>
          </div>
        </div>
      </form>
    </Section>
  )
}

// ─── 5. Password Change Form ───────────────────────────────────────────────────
function PasswordChangeForm() {
  const [current, setCurrent] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const pwMatch = newPw && confirm && newPw === confirm
  const pwMismatch = newPw && confirm && newPw !== confirm

  return (
    <Section
      icon={Key}
      title="Change Password"
      subtitle="Use a strong password with at least 8 characters, a mix of letters, numbers and symbols"
      color="slate"
    >
      <form className="space-y-5 w-full">
        <HRow label="Current Password" required>
          <div className="relative">
            <input
              type={showCurrent ? 'text' : 'password'}
              className="input pr-10"
              placeholder="Enter current password"
              value={current}
              onChange={e => setCurrent(e.target.value)}
            />
            <button type="button" onClick={() => setShowCurrent(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
              {showCurrent ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
          <a href="#" onClick={(e) => e.preventDefault()} className="text-xs text-primary-600 dark:text-primary-400 hover:underline mt-1.5 inline-block">Forgot your password?</a>
        </HRow>

        <HRow label="New Password" required hint="Min 8 chars, include uppercase, number and symbol">
          <div>
            <div className="relative">
              <input
                type={showNew ? 'text' : 'password'}
                className="input pr-10"
                placeholder="Enter new password"
                value={newPw}
                onChange={e => setNewPw(e.target.value)}
              />
              <button type="button" onClick={() => setShowNew(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                {showNew ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            <PasswordStrengthBar password={newPw} />
          </div>
        </HRow>

        <HRow label="Confirm Password" required>
          <div>
            <div className="relative">
              <input
                type={showConfirm ? 'text' : 'password'}
                className={`input pr-10 ${pwMismatch ? 'border-red-400 dark:border-red-500 focus:ring-red-500/30' : pwMatch ? 'border-emerald-400 dark:border-emerald-500 focus:ring-emerald-500/30' : ''}`}
                placeholder="Re-enter new password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
              />
              <button type="button" onClick={() => setShowConfirm(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            {pwMatch && <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1.5 flex items-center gap-1">Passwords match</p>}
            {pwMismatch && <p className="text-xs text-red-500 mt-1.5">Passwords do not match</p>}
          </div>
        </HRow>

        {/* Requirements checklist */}
        <div className="grid grid-cols-12 gap-x-4">
          <div className="col-span-12 sm:col-start-5 sm:col-span-8">
            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Password Requirements</p>
              <div className="space-y-1.5">
                {[
                  { label: 'At least 8 characters', test: newPw.length >= 8 },
                  { label: 'At least one uppercase letter', test: /[A-Z]/.test(newPw) },
                  { label: 'At least one number', test: /[0-9]/.test(newPw) },
                  { label: 'At least one special character', test: /[^A-Za-z0-9]/.test(newPw) },
                ].map(req => (
                  <div key={req.label} className={`flex items-center gap-2 text-xs transition-colors ${req.test ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
                    <div className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 transition-colors ${req.test ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-slate-200 dark:bg-slate-700'}`}>
                      <div className={`w-1.5 h-1.5 rounded-full ${req.test ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                    </div>
                    {req.label}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-x-4">
          <div className="col-span-12 sm:col-start-5 sm:col-span-8 flex gap-3">
            <button type="submit" className="btn btn-primary">Update Password</button>
            <button type="button" className="btn btn-secondary">Cancel</button>
          </div>
        </div>
      </form>
    </Section>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function FormHorizontal() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Form Horizontal"
        subtitle="Horizontal label-left / input-right layouts for settings, configuration, and preferences"
      />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <BasicHorizontalForm />
        <SettingsHorizontalForm />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <NotificationPreferences />
        <div className="space-y-8">
          <AdvancedConfigForm />
          <PasswordChangeForm />
        </div>
      </div>
    </div>
  )
}
