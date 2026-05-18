import { useState, useRef } from 'react'
import PageHeader from '../../components/shared/PageHeader'
import { User, CreditCard, Mail, Phone, MapPin, Globe, MessageSquare, Upload, Lock } from 'lucide-react'

// ─── 1. User Registration Form ───────────────────────────────────────────────
function UserRegistrationForm() {
  const [avatar, setAvatar] = useState(null)
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', password: '', confirm: '', phone: '', role: '', terms: false })
  const fileRef = useRef()

  const handleAvatar = (e) => {
    const file = e.target.files[0]
    if (file) setAvatar(URL.createObjectURL(file))
  }

  return (
    <div className="card overflow-hidden">
      <div className="bg-primary-500 px-6 py-5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
            <User size={18} className="text-white" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">User Registration</h3>
            <p className="text-xs text-primary-100">Create a new account to get started</p>
          </div>
        </div>
      </div>

      <div className="p-6">
        {/* Avatar upload */}
        <div className="flex items-center gap-4 mb-6 pb-6 border-b border-slate-200 dark:border-slate-700">
          <div className="relative shrink-0">
            <div className="w-20 h-20 rounded-2xl bg-slate-100 dark:bg-slate-700 border-2 border-dashed border-slate-300 dark:border-slate-600 flex items-center justify-center overflow-hidden">
              {avatar ? (
                <img src={avatar} alt="avatar" className="w-full h-full object-cover" />
              ) : (
                <User size={28} className="text-slate-400" />
              )}
            </div>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="absolute -bottom-1.5 -right-1.5 w-7 h-7 rounded-full bg-primary-600 text-white flex items-center justify-center shadow-md hover:bg-primary-700 transition-colors"
            >
              <Upload size={12} />
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatar} />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Profile Photo</p>
            <p className="text-xs text-slate-500 mt-0.5">JPG, PNG or GIF. Max 2MB.</p>
            <button type="button" onClick={() => fileRef.current?.click()} className="mt-2 text-xs font-medium text-primary-600 dark:text-primary-400 hover:underline">
              Upload new photo
            </button>
          </div>
        </div>

        <form className="space-y-5">
          {/* First / Last Name */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                First Name <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  className="input pl-9"
                  placeholder="John"
                  value={form.firstName}
                  onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Last Name <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  className="input pl-9"
                  placeholder="Doe"
                  value={form.lastName}
                  onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))}
                />
              </div>
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Email Address <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="email"
                className="input pl-9"
                placeholder="john@example.com"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              />
            </div>
          </div>

          {/* Password + Confirm */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Password <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="password"
                  className="input pl-9"
                  placeholder="••••••••"
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Confirm Password <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="password"
                  className="input pl-9"
                  placeholder="••••••••"
                  value={form.confirm}
                  onChange={e => setForm(f => ({ ...f, confirm: e.target.value }))}
                />
              </div>
            </div>
          </div>

          {/* Phone + Role */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Phone Number</label>
              <div className="relative">
                <Phone size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="tel"
                  className="input pl-9"
                  placeholder="+1 (555) 000-0000"
                  value={form.phone}
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Role</label>
              <select className="input" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                <option value="">Select a role...</option>
                <option value="admin">Administrator</option>
                <option value="manager">Manager</option>
                <option value="developer">Developer</option>
                <option value="designer">Designer</option>
                <option value="viewer">Viewer</option>
              </select>
            </div>
          </div>

          {/* Terms */}
          <label className="flex items-start gap-3 cursor-pointer pt-1">
            <input
              type="checkbox"
              className="w-4 h-4 text-primary-600 rounded mt-0.5 shrink-0"
              checked={form.terms}
              onChange={e => setForm(f => ({ ...f, terms: e.target.checked }))}
            />
            <span className="text-sm text-slate-600 dark:text-slate-400">
              I agree to the{' '}
              <span className="text-primary-600 dark:text-primary-400 font-medium hover:underline cursor-pointer">Terms of Service</span>
              {' '}and{' '}
              <span className="text-primary-600 dark:text-primary-400 font-medium hover:underline cursor-pointer">Privacy Policy</span>
            </span>
          </label>

          <button
            type="submit"
            className="w-full py-2.5 px-4 rounded-xl bg-primary-500 hover:bg-primary-600 text-white text-sm font-semibold shadow-md shadow-primary-500/30 transition-all duration-200"
          >
            Create Account
          </button>
        </form>
      </div>
    </div>
  )
}

// ─── 2. Billing / Checkout Form ──────────────────────────────────────────────
function BillingForm() {
  return (
    <div className="card overflow-hidden">
      <div className="bg-slate-700 px-6 py-5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
            <MapPin size={18} className="text-white" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">Billing Information</h3>
            <p className="text-xs text-slate-300">Enter your billing address details below</p>
          </div>
        </div>
      </div>

      <div className="p-6">
        <form className="space-y-5">
          {/* Full name + Company */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Full Name <span className="text-red-500">*</span></label>
              <input type="text" className="input" placeholder="John Doe" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Company Name</label>
              <input type="text" className="input" placeholder="ACME Corporation" />
            </div>
          </div>

          {/* Email + Phone */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Email Address <span className="text-red-500">*</span></label>
              <div className="relative">
                <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input type="email" className="input pl-9" placeholder="john@example.com" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Phone Number</label>
              <div className="relative">
                <Phone size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input type="tel" className="input pl-9" placeholder="+1 (555) 000-0000" />
              </div>
            </div>
          </div>

          <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-4">Billing Address</p>

            {/* Address Line 1 */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Address Line 1 <span className="text-red-500">*</span></label>
              <div className="relative">
                <MapPin size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input type="text" className="input pl-9" placeholder="123 Main Street" />
              </div>
            </div>

            {/* Address Line 2 */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Address Line 2</label>
              <input type="text" className="input" placeholder="Apartment, suite, unit, etc." />
            </div>

            {/* City + State */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">City <span className="text-red-500">*</span></label>
                <input type="text" className="input" placeholder="San Francisco" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">State / Province <span className="text-red-500">*</span></label>
                <input type="text" className="input" placeholder="California" />
              </div>
            </div>

            {/* ZIP + Country */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">ZIP / Postal Code <span className="text-red-500">*</span></label>
                <input type="text" className="input" placeholder="94105" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Country <span className="text-red-500">*</span></label>
                <div className="relative">
                  <Globe size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <select className="input pl-9">
                    <option>United States</option>
                    <option>Canada</option>
                    <option>United Kingdom</option>
                    <option>Australia</option>
                    <option>Germany</option>
                    <option>France</option>
                    <option>Japan</option>
                    <option>India</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" className="btn btn-secondary">Cancel</button>
            <button type="submit" className="btn btn-primary">Save Billing Info</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── 3. Contact / Inquiry Form ────────────────────────────────────────────────
function ContactForm() {
  const [message, setMessage] = useState('')
  const [priority, setPriority] = useState('medium')
  const maxChars = 500

  return (
    <div className="card overflow-hidden">
      <div className="bg-emerald-500 px-6 py-5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
            <MessageSquare size={18} className="text-white" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">Contact & Inquiry</h3>
            <p className="text-xs text-emerald-100">We typically respond within 24 hours</p>
          </div>
        </div>
      </div>

      <div className="p-6">
        <form className="space-y-5">
          {/* Name + Email + Phone */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Full Name <span className="text-red-500">*</span></label>
              <div className="relative">
                <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input type="text" className="input pl-9" placeholder="John Doe" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Email <span className="text-red-500">*</span></label>
              <div className="relative">
                <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input type="email" className="input pl-9" placeholder="john@example.com" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Phone</label>
              <div className="relative">
                <Phone size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input type="tel" className="input pl-9" placeholder="+1 (555) 000-0000" />
              </div>
            </div>
          </div>

          {/* Subject */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Subject <span className="text-red-500">*</span></label>
            <select className="input">
              <option value="">Select a subject...</option>
              <option>General Inquiry</option>
              <option>Technical Support</option>
              <option>Billing Issue</option>
              <option>Feature Request</option>
              <option>Partnership Opportunity</option>
              <option>Other</option>
            </select>
          </div>

          {/* Priority */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2.5">Priority</label>
            <div className="flex flex-wrap gap-3">
              {[
                { value: 'low', label: 'Low', color: 'emerald' },
                { value: 'medium', label: 'Medium', color: 'amber' },
                { value: 'high', label: 'High', color: 'orange' },
                { value: 'urgent', label: 'Urgent', color: 'red' },
              ].map(p => (
                <label key={p.value} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="priority"
                    value={p.value}
                    checked={priority === p.value}
                    onChange={() => setPriority(p.value)}
                    className="sr-only"
                  />
                  <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border-2 text-xs font-semibold transition-all ${
                    priority === p.value
                      ? p.color === 'emerald' ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400'
                      : p.color === 'amber' ? 'border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400'
                      : p.color === 'orange' ? 'border-orange-500 bg-orange-50 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400'
                      : 'border-red-500 bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400'
                      : 'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-slate-300'
                  }`}>
                    <div className={`w-2 h-2 rounded-full ${
                      p.color === 'emerald' ? 'bg-emerald-500'
                      : p.color === 'amber' ? 'bg-amber-500'
                      : p.color === 'orange' ? 'bg-orange-500'
                      : 'bg-red-500'
                    }`} />
                    {p.label}
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Message */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Message <span className="text-red-500">*</span>
              </label>
              <span className={`text-xs font-medium ${message.length > maxChars * 0.9 ? 'text-red-500' : 'text-slate-400'}`}>
                {message.length}/{maxChars}
              </span>
            </div>
            <textarea
              className="input resize-none"
              rows={4}
              placeholder="Describe your inquiry in detail..."
              value={message}
              onChange={e => { if (e.target.value.length <= maxChars) setMessage(e.target.value) }}
            />
            {/* char progress bar */}
            <div className="mt-1.5 h-1 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${message.length > maxChars * 0.9 ? 'bg-red-500' : 'bg-primary-500'}`}
                style={{ width: `${(message.length / maxChars) * 100}%` }}
              />
            </div>
          </div>

          {/* File attachment */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Attachments</label>
            <div className="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl p-5 text-center hover:border-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/10 transition-colors cursor-pointer">
              <Upload size={22} className="text-slate-400 mx-auto mb-2" />
              <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">Drop files here or <span className="text-primary-600 dark:text-primary-400">browse</span></p>
              <p className="text-xs text-slate-400 mt-1">PNG, JPG, PDF, DOCX — max 10MB</p>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button type="button" className="btn btn-secondary">Clear Form</button>
            <button type="submit" className="btn btn-primary">Send Message</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── 4. Profile Settings Form ────────────────────────────────────────────────
function ProfileSettingsForm() {
  const [prefs, setPrefs] = useState({
    emailNotifs: true, pushNotifs: false, weeklyDigest: true,
    twoFA: false, publicProfile: true, showActivity: true,
  })

  const toggle = (key) => setPrefs(p => ({ ...p, [key]: !p[key] }))

  return (
    <div className="card overflow-hidden">
      <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
            <User size={18} className="text-violet-600 dark:text-violet-400" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200">Profile Settings</h3>
            <p className="text-xs text-slate-500">Manage your public profile and preferences</p>
          </div>
        </div>
      </div>

      <form className="divide-y divide-slate-200 dark:divide-slate-700">
        {/* Personal Info */}
        <div className="p-6">
          <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-4">Personal Information</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">First Name</label>
              <input type="text" className="input" defaultValue="Alexandra" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Last Name</label>
              <input type="text" className="input" defaultValue="Thompson" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Email Address</label>
              <div className="relative">
                <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input type="email" className="input pl-9" defaultValue="alex@example.com" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Phone</label>
              <div className="relative">
                <Phone size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input type="tel" className="input pl-9" defaultValue="+1 (555) 987-6543" />
              </div>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Bio</label>
              <textarea
                className="input resize-none"
                rows={3}
                defaultValue="Senior product designer with 6+ years of experience crafting intuitive digital experiences. Passionate about user-centered design and accessibility."
              />
            </div>
          </div>
        </div>

        {/* Social Links */}
        <div className="p-6">
          <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-4">Social Links</h4>
          <div className="space-y-3">
            {[
              { label: 'Website', icon: Globe, placeholder: 'https://yoursite.com', defaultValue: 'https://alexthompson.dev' },
              { label: 'Twitter / X', icon: Globe, placeholder: 'https://twitter.com/username', defaultValue: '' },
              { label: 'LinkedIn', icon: Globe, placeholder: 'https://linkedin.com/in/username', defaultValue: 'https://linkedin.com/in/alexthompson' },
              { label: 'GitHub', icon: Globe, placeholder: 'https://github.com/username', defaultValue: 'https://github.com/alexthompson' },
            ].map(link => (
              <div key={link.label} className="flex items-center gap-3">
                <span className="w-28 shrink-0 text-sm font-medium text-slate-500 dark:text-slate-400">{link.label}</span>
                <div className="relative flex-1">
                  <link.icon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input type="url" className="input pl-9" placeholder={link.placeholder} defaultValue={link.defaultValue} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Preferences */}
        <div className="p-6">
          <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-4">Preferences</h4>
          <div className="space-y-3">
            {[
              { key: 'emailNotifs', label: 'Email Notifications', desc: 'Receive important updates via email' },
              { key: 'pushNotifs', label: 'Push Notifications', desc: 'Browser push notifications for real-time alerts' },
              { key: 'weeklyDigest', label: 'Weekly Digest', desc: 'Get a summary of your activity every Monday' },
              { key: 'twoFA', label: 'Two-Factor Auth', desc: 'Add an extra layer of security to your account' },
              { key: 'publicProfile', label: 'Public Profile', desc: 'Allow others to discover your profile' },
              { key: 'showActivity', label: 'Show Activity', desc: 'Display your activity status to others' },
            ].map(item => (
              <div key={item.key} className="flex items-center justify-between py-1">
                <div>
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{item.label}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{item.desc}</p>
                </div>
                <button
                  type="button"
                  onClick={() => toggle(item.key)}
                  className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${prefs[item.key] ? 'bg-primary-600' : 'bg-slate-200 dark:bg-slate-700'}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${prefs[item.key] ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/50 flex justify-end gap-3">
          <button type="button" className="btn btn-secondary">Discard Changes</button>
          <button type="submit" className="btn btn-primary">Save Changes</button>
        </div>
      </form>
    </div>
  )
}

// ─── 5. Payment Card Form ─────────────────────────────────────────────────────
function PaymentCardForm() {
  const [cardNumber, setCardNumber] = useState('')
  const [saveCard, setSaveCard] = useState(true)

  const formatCard = (value) => {
    const digits = value.replace(/\D/g, '').slice(0, 16)
    return digits.replace(/(.{4})/g, '$1 ').trim()
  }

  return (
    <div className="card overflow-hidden">
      <div className="bg-violet-600 px-6 py-5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
            <CreditCard size={18} className="text-white" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">Add Payment Method</h3>
            <p className="text-xs text-violet-200">Your card info is encrypted and secure</p>
          </div>
        </div>
      </div>

      {/* Card Preview */}
      <div className="p-6 pb-0">
        <div className="rounded-2xl bg-slate-800 p-5 text-white mb-6 relative overflow-hidden">
          <div className="absolute -top-4 -right-4 w-24 h-24 rounded-full bg-white/5" />
          <div className="absolute -bottom-6 -left-6 w-32 h-32 rounded-full bg-white/5" />
          <div className="relative">
            <div className="flex justify-between items-start mb-8">
              <CreditCard size={28} className="text-white/80" />
              <span className="text-xs font-semibold tracking-widest text-white/70 uppercase">VISA</span>
            </div>
            <p className="text-lg font-mono tracking-widest text-white/90 mb-4">
              {cardNumber || '•••• •••• •••• ••••'}
            </p>
            <div className="flex items-end justify-between">
              <div>
                <p className="text-[10px] text-white/50 uppercase tracking-widest mb-0.5">Cardholder</p>
                <p className="text-sm font-medium">JOHN DOE</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-white/50 uppercase tracking-widest mb-0.5">Expires</p>
                <p className="text-sm font-medium">MM / YY</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="px-6 pb-6">
        <form className="space-y-4">
          {/* Card Number */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Card Number</label>
            <div className="relative">
              <CreditCard size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                className="input pl-9 font-mono tracking-wider"
                placeholder="1234 5678 9012 3456"
                value={cardNumber}
                onChange={e => setCardNumber(formatCard(e.target.value))}
                maxLength={19}
              />
            </div>
          </div>

          {/* Expiry + CVV */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Expiry Date</label>
              <input type="text" className="input font-mono" placeholder="MM / YY" maxLength={7} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">CVV / CVC</label>
              <div className="relative">
                <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input type="text" className="input pl-9 font-mono" placeholder="•••" maxLength={4} />
              </div>
            </div>
          </div>

          {/* Cardholder Name */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Cardholder Name</label>
            <div className="relative">
              <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="text" className="input pl-9 uppercase tracking-wider" placeholder="JOHN DOE" />
            </div>
          </div>

          {/* Save card toggle */}
          <div className="flex items-center justify-between py-2 px-4 rounded-xl bg-slate-50 dark:bg-slate-800/50">
            <div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Save card for future payments</p>
              <p className="text-xs text-slate-500">Securely stored using tokenization</p>
            </div>
            <button
              type="button"
              onClick={() => setSaveCard(s => !s)}
              className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${saveCard ? 'bg-violet-600' : 'bg-slate-200 dark:bg-slate-700'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${saveCard ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </div>

          <button
            type="submit"
            className="w-full py-2.5 px-4 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold shadow-md shadow-violet-500/30 transition-all duration-200"
          >
            Add Card
          </button>

          <p className="text-center text-xs text-slate-400 flex items-center justify-center gap-1.5">
            <Lock size={11} />
            256-bit SSL encrypted. Your payment info is safe.
          </p>
        </form>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function FormLayouts() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Form Layouts"
        subtitle="Professional form layout patterns for registration, billing, contact, settings, and payment"
      />

      {/* Row 1: Registration + Billing */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <UserRegistrationForm />
        <BillingForm />
      </div>

      {/* Row 2: Contact + Payment */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <ContactForm />
        <PaymentCardForm />
      </div>

      {/* Row 3: Profile Settings — full width */}
      <ProfileSettingsForm />
    </div>
  )
}
