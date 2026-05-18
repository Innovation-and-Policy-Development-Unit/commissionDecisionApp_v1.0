import { useState, useEffect, useRef, Fragment } from 'react'
import PageHeader from '../../components/shared/PageHeader'
import {
  CheckCircle, XCircle, AlertCircle, Eye, EyeOff,
  ChevronRight, ChevronLeft, User, Mail, Lock,
  CreditCard, Building, Phone, Shield, Zap, RefreshCw,
} from 'lucide-react'

// ─── Helpers ──────────────────────────────────────────────────────────────────
function inputCls(error, success) {
  if (error) return 'input border-red-400 dark:border-red-500 focus:ring-red-500/30 focus:border-red-500'
  if (success) return 'input border-emerald-400 dark:border-emerald-500 focus:ring-emerald-500/30 focus:border-emerald-500'
  return 'input'
}

function FieldMessage({ error, success, hint }) {
  if (error) return (
    <p className="flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400 mt-1.5">
      <XCircle size={12} className="shrink-0" />{error}
    </p>
  )
  if (success) return (
    <p className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 mt-1.5">
      <CheckCircle size={12} className="shrink-0" />{success}
    </p>
  )
  if (hint) return <p className="text-xs text-slate-400 mt-1.5">{hint}</p>
  return null
}

function PasswordStrength({ password }) {
  if (!password) return null
  let score = 0
  if (password.length >= 8) score++
  if (password.length >= 12) score++
  if (/[A-Z]/.test(password)) score++
  if (/[0-9]/.test(password)) score++
  if (/[^A-Za-z0-9]/.test(password)) score++
  const strength = Math.min(score, 4)
  const labels = ['', 'Weak', 'Fair', 'Good', 'Strong']
  const colors = ['', 'bg-red-500', 'bg-amber-400', 'bg-blue-500', 'bg-emerald-500']
  const textColors = ['', 'text-red-500', 'text-amber-500', 'text-blue-500', 'text-emerald-500']
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

// ─── NEW: Stat Cards Strip ─────────────────────────────────────────────────────
function StatCardsStrip() {
  const stats = [
    {
      icon: Zap,
      iconCls: 'text-primary-600 dark:text-primary-400',
      bgCls: 'bg-primary-100 dark:bg-primary-900/30',
      title: 'Real-time Validation',
      desc: 'Fields are validated as you type and on blur, giving instant, precise feedback without waiting for submit.',
    },
    {
      icon: Shield,
      iconCls: 'text-violet-600 dark:text-violet-400',
      bgCls: 'bg-violet-100 dark:bg-violet-900/30',
      title: 'Password Strength Meter',
      desc: 'Visual feedback on password quality using length, uppercase, numbers, and special character checks.',
    },
    {
      icon: RefreshCw,
      iconCls: 'text-emerald-600 dark:text-emerald-400',
      bgCls: 'bg-emerald-100 dark:bg-emerald-900/30',
      title: 'Smart Error Recovery',
      desc: 'Errors clear automatically as corrections are typed. Success states confirm valid input immediately.',
    },
  ]

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {stats.map(({ icon: Icon, iconCls, bgCls, title, desc }) => (
        <div key={title} className="card p-5 flex gap-4 items-start">
          <div className={`w-10 h-10 rounded-xl ${bgCls} flex items-center justify-center shrink-0`}>
            <Icon size={20} className={iconCls} />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1">{title}</p>
            <p className="text-xs text-slate-500 leading-relaxed">{desc}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── 1. Live Validation Form ──────────────────────────────────────────────────
function LiveValidationForm() {
  const [form, setForm] = useState({ email: '', password: '', confirm: '', phone: '', url: '' })
  const [touched, setTouched] = useState({})
  const [showPw, setShowPw] = useState(false)

  const validate = (name, value, allValues) => {
    switch (name) {
      case 'email':
        if (!value) return 'Email is required'
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Enter a valid email address'
        return null
      case 'password':
        if (!value) return 'Password is required'
        if (value.length < 8) return 'Password must be at least 8 characters'
        return null
      case 'confirm':
        if (!value) return 'Please confirm your password'
        if (value !== (allValues || form).password) return 'Passwords do not match'
        return null
      case 'phone':
        if (!value) return 'Phone number is required'
        if (!/^\+?[\d\s\-()]{7,}$/.test(value)) return 'Enter numbers only (e.g. +1 555 000 0000)'
        return null
      case 'url':
        if (value && !value.startsWith('https://')) return 'URL must start with https://'
        return null
      default:
        return null
    }
  }

  const [errors, setErrors] = useState({})

  const handleChange = (e) => {
    const { name, value } = e.target
    const updated = { ...form, [name]: value }
    setForm(updated)
    if (touched[name]) {
      setErrors(prev => ({ ...prev, [name]: validate(name, value, updated) }))
    }
  }

  const handleBlur = (e) => {
    const { name, value } = e.target
    setTouched(t => ({ ...t, [name]: true }))
    setErrors(prev => ({ ...prev, [name]: validate(name, value) }))
  }

  const isSuccess = (name) => touched[name] && !errors[name] && form[name]

  return (
    <div className="card p-6">
      <div className="flex items-center gap-2 mb-1">
        <div className="w-2 h-2 rounded-full bg-primary-500" />
        <h3 className="font-semibold text-slate-800 dark:text-slate-200">Live Validation Form</h3>
      </div>
      <p className="text-xs text-slate-500 mb-5">Fields are validated on blur. Errors clear as you type corrections.</p>

      <form className="space-y-5 max-w-lg">
        {/* Email */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
            Email Address <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="email" name="email" value={form.email}
              className={`${inputCls(errors.email, isSuccess('email'))} pl-9 pr-9`}
              placeholder="john@example.com"
              onChange={handleChange} onBlur={handleBlur}
            />
            {isSuccess('email') && <CheckCircle size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-500" />}
            {errors.email && <XCircle size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-red-500" />}
          </div>
          <FieldMessage error={errors.email} success={isSuccess('email') ? 'Valid email format' : null} />
        </div>

        {/* Password */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
            Password <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type={showPw ? 'text' : 'password'} name="password" value={form.password}
              className={`${inputCls(errors.password, isSuccess('password'))} pl-9 pr-10`}
              placeholder="••••••••"
              onChange={handleChange} onBlur={handleBlur}
            />
            <button type="button" onClick={() => setShowPw(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
          <PasswordStrength password={form.password} />
          <FieldMessage error={errors.password} hint="Min 8 characters. Mix uppercase, numbers and symbols for a stronger password." />
        </div>

        {/* Confirm Password */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
            Confirm Password <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="password" name="confirm" value={form.confirm}
              className={`${inputCls(errors.confirm, isSuccess('confirm'))} pl-9 pr-9`}
              placeholder="••••••••"
              onChange={handleChange} onBlur={handleBlur}
            />
            {isSuccess('confirm') && <CheckCircle size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-500" />}
            {errors.confirm && <XCircle size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-red-500" />}
          </div>
          <FieldMessage error={errors.confirm} success={isSuccess('confirm') ? 'Passwords match!' : null} />
        </div>

        {/* Phone */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
            Phone Number <span className="text-red-500">*</span>
          </label>
          <input
            type="tel" name="phone" value={form.phone}
            className={inputCls(errors.phone, isSuccess('phone'))}
            placeholder="+1 555 000 0000"
            onChange={handleChange} onBlur={handleBlur}
          />
          <FieldMessage error={errors.phone} success={isSuccess('phone') ? 'Valid phone number' : null} hint="Numbers only. Include country code." />
        </div>

        {/* URL */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Website URL</label>
          <input
            type="url" name="url" value={form.url}
            className={inputCls(errors.url, isSuccess('url'))}
            placeholder="https://yourwebsite.com"
            onChange={handleChange} onBlur={handleBlur}
          />
          <FieldMessage error={errors.url} success={isSuccess('url') ? 'Valid URL' : null} hint="Optional — must start with https://" />
        </div>

        <button type="submit" className="btn btn-primary w-full">Validate & Continue</button>
      </form>
    </div>
  )
}

// ─── 2. Required Fields Demo ──────────────────────────────────────────────────
function RequiredFieldsDemo() {
  const [submitted, setSubmitted] = useState(false)
  const [vals, setVals] = useState({ username: '', email: '', department: '', startDate: '' })

  const handleSubmit = (e) => {
    e.preventDefault()
    setSubmitted(true)
  }

  const isEmpty = (key) => submitted && !vals[key]

  return (
    <div className="card p-6">
      <div className="flex items-center gap-2 mb-1">
        <div className="w-2 h-2 rounded-full bg-red-500" />
        <h3 className="font-semibold text-slate-800 dark:text-slate-200">Required Fields Demo</h3>
      </div>
      <p className="text-xs text-slate-500 mb-5">Submit the form without filling fields to see required field errors.</p>

      <form onSubmit={handleSubmit} className="space-y-4 max-w-lg" noValidate>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Username <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              className={isEmpty('username') ? 'input border-red-400 dark:border-red-500 bg-red-50 dark:bg-red-900/10' : 'input'}
              placeholder="johndoe"
              value={vals.username}
              onChange={e => setVals(v => ({ ...v, username: e.target.value }))}
            />
            {isEmpty('username') && (
              <p className="flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400 mt-1.5">
                <AlertCircle size={11} />Username is required
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Email <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              className={isEmpty('email') ? 'input border-red-400 dark:border-red-500 bg-red-50 dark:bg-red-900/10' : 'input'}
              placeholder="john@example.com"
              value={vals.email}
              onChange={e => setVals(v => ({ ...v, email: e.target.value }))}
            />
            {isEmpty('email') && (
              <p className="flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400 mt-1.5">
                <AlertCircle size={11} />Email is required
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Department <span className="text-red-500">*</span>
            </label>
            <select
              className={isEmpty('department') ? 'input border-red-400 dark:border-red-500 bg-red-50 dark:bg-red-900/10' : 'input'}
              value={vals.department}
              onChange={e => setVals(v => ({ ...v, department: e.target.value }))}
            >
              <option value="">Select department...</option>
              <option>Engineering</option>
              <option>Design</option>
              <option>Marketing</option>
              <option>Sales</option>
              <option>Operations</option>
            </select>
            {isEmpty('department') && (
              <p className="flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400 mt-1.5">
                <AlertCircle size={11} />Please select a department
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Start Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              className={isEmpty('startDate') ? 'input border-red-400 dark:border-red-500 bg-red-50 dark:bg-red-900/10' : 'input'}
              value={vals.startDate}
              onChange={e => setVals(v => ({ ...v, startDate: e.target.value }))}
            />
            {isEmpty('startDate') && (
              <p className="flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400 mt-1.5">
                <AlertCircle size={11} />Start date is required
              </p>
            )}
          </div>
        </div>

        {submitted && Object.values(vals).some(v => !v) && (
          <div className="p-4 rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10">
            <p className="text-sm font-semibold text-red-600 dark:text-red-400 flex items-center gap-2">
              <AlertCircle size={15} />Please fill in all required fields marked with an asterisk (*)
            </p>
          </div>
        )}

        <div className="flex gap-3">
          <button type="submit" className="btn btn-primary">Submit Form</button>
          <button type="button" className="btn btn-secondary" onClick={() => { setSubmitted(false); setVals({ username: '', email: '', department: '', startDate: '' }) }}>Reset</button>
        </div>
      </form>
    </div>
  )
}

// ─── 3. Pattern Validation ────────────────────────────────────────────────────
function PatternValidation() {
  const [card, setCard] = useState('')
  const [phone, setPhone] = useState('')
  const [ssn, setSsn] = useState('')

  const formatCard = (val) => {
    const d = val.replace(/\D/g, '').slice(0, 16)
    return d.replace(/(.{4})/g, '$1-').replace(/-$/, '')
  }

  const formatPhone = (val) => {
    const d = val.replace(/\D/g, '').slice(0, 10)
    if (d.length <= 3) return d
    if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`
    return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`
  }

  const formatSSN = (val) => {
    const d = val.replace(/\D/g, '').slice(0, 9)
    if (d.length <= 3) return d
    if (d.length <= 5) return `${d.slice(0, 3)}-${d.slice(3)}`
    return `${d.slice(0, 3)}-${d.slice(3, 5)}-${d.slice(5)}`
  }

  const cardComplete = card.replace(/\D/g, '').length === 16
  const phoneComplete = phone.replace(/\D/g, '').length === 10

  return (
    <div className="card p-6">
      <div className="flex items-center gap-2 mb-1">
        <div className="w-2 h-2 rounded-full bg-violet-500" />
        <h3 className="font-semibold text-slate-800 dark:text-slate-200">Pattern / Mask Validation</h3>
      </div>
      <p className="text-xs text-slate-500 mb-5">Input masks format your data automatically as you type.</p>

      <div className="space-y-5 max-w-lg">
        {/* Credit Card */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
            Credit Card Number
            <span className="ml-2 text-xs font-normal text-slate-400">XXXX-XXXX-XXXX-XXXX</span>
          </label>
          <div className="relative">
            <input
              type="text"
              className={`${inputCls(card && !cardComplete, cardComplete)} font-mono tracking-wider pr-16`}
              placeholder="0000-0000-0000-0000"
              value={card}
              onChange={e => setCard(formatCard(e.target.value))}
              maxLength={19}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-400">
              {card.replace(/\D/g, '').length}/16
            </span>
          </div>
          {cardComplete && <p className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 mt-1.5"><CheckCircle size={12} />Card number complete</p>}
        </div>

        {/* Phone */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
            US Phone Number
            <span className="ml-2 text-xs font-normal text-slate-400">(XXX) XXX-XXXX</span>
          </label>
          <div className="relative">
            <input
              type="text"
              className={`${inputCls(phone && !phoneComplete, phoneComplete)} font-mono pr-14`}
              placeholder="(555) 000-0000"
              value={phone}
              onChange={e => setPhone(formatPhone(e.target.value))}
              maxLength={14}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-400">
              {phone.replace(/\D/g, '').length}/10
            </span>
          </div>
          {phoneComplete && <p className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 mt-1.5"><CheckCircle size={12} />Valid US phone number</p>}
        </div>

        {/* SSN */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
            Social Security Number
            <span className="ml-2 text-xs font-normal text-slate-400">XXX-XX-XXXX</span>
          </label>
          <input
            type="text"
            className="input font-mono tracking-wider"
            placeholder="000-00-0000"
            value={ssn}
            onChange={e => setSsn(formatSSN(e.target.value))}
            maxLength={11}
          />
          <p className="text-xs text-slate-400 mt-1.5">Demo only — do not enter real SSN data</p>
        </div>

        {/* Zip code */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
            US Zip Code
            <span className="ml-2 text-xs font-normal text-slate-400">5 digits</span>
          </label>
          <input
            type="text"
            className="input font-mono w-36"
            placeholder="94105"
            maxLength={5}
            inputMode="numeric"
            pattern="[0-9]{5}"
            onBeforeInput={e => { if (e.data && !/^\d+$/.test(e.data)) e.preventDefault() }}
          />
        </div>
      </div>
    </div>
  )
}

// ─── 4. Multi-step Form Wizard ─────────────────────────────────────────────────
function MultiStepWizard() {
  const [step, setStep] = useState(0)
  const [data, setData] = useState({
    firstName: '', lastName: '', email: '',
    username: '', password: '', role: '',
    terms: false,
  })
  const [complete, setComplete] = useState(false)

  const steps = [
    { label: 'Personal Info', icon: User },
    { label: 'Account Setup', icon: Lock },
    { label: 'Confirmation', icon: CheckCircle },
  ]

  const update = (key, value) => setData(d => ({ ...d, [key]: value }))

  const canNext = () => {
    if (step === 0) return data.firstName && data.lastName && data.email
    if (step === 1) return data.username && data.password && data.role
    return data.terms
  }

  if (complete) {
    return (
      <div className="card p-8 text-center">
        <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto mb-4">
          <CheckCircle size={32} className="text-emerald-500" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-1">Account Created!</h3>
        <p className="text-sm text-slate-500 mb-2">Welcome, {data.firstName}. Your account <strong>@{data.username}</strong> is ready.</p>
        <p className="text-xs text-slate-400 mb-5">A confirmation email was sent to {data.email}</p>
        <button className="btn btn-primary" onClick={() => { setComplete(false); setStep(0); setData({ firstName: '', lastName: '', email: '', username: '', password: '', role: '', terms: false }) }}>
          Reset Demo
        </button>
      </div>
    )
  }

  return (
    <div className="card overflow-hidden">
      {/* Step Indicator */}
      <div className="px-6 pt-6 pb-4 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-between max-w-sm mx-auto">
          {steps.map((s, i) => (
            <Fragment key={i}>
              <div className="flex flex-col items-center gap-1.5">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center font-semibold text-sm transition-all duration-300 ${
                  i < step ? 'bg-emerald-500 text-white'
                  : i === step ? 'bg-primary-600 text-white shadow-lg shadow-primary-500/40'
                  : 'bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500'
                }`}>
                  {i < step ? <CheckCircle size={16} /> : <s.icon size={16} />}
                </div>
                <span className={`text-xs font-medium hidden sm:block ${i === step ? 'text-primary-600 dark:text-primary-400' : i < step ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
                  {s.label}
                </span>
              </div>
              {i < steps.length - 1 && (
                <div className={`flex-1 h-0.5 mx-2 mb-5 rounded-full transition-all duration-500 ${i < step ? 'bg-emerald-400' : 'bg-slate-200 dark:bg-slate-700'}`} />
              )}
            </Fragment>
          ))}
        </div>
      </div>

      <div className="p-6">
        <p className="text-xs text-slate-400 mb-4">Step {step + 1} of {steps.length} — {steps[step].label}</p>

        {/* Step 1 — Personal Info */}
        {step === 0 && (
          <div className="space-y-4 max-w-lg">
            <div>
              <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-0.5">Personal Information</h4>
              <p className="text-xs text-slate-500 mb-4">Tell us your basic details to get started.</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">First Name <span className="text-red-500">*</span></label>
                <input type="text" className="input" placeholder="John" value={data.firstName} onChange={e => update('firstName', e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Last Name <span className="text-red-500">*</span></label>
                <input type="text" className="input" placeholder="Doe" value={data.lastName} onChange={e => update('lastName', e.target.value)} />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Email Address <span className="text-red-500">*</span></label>
              <div className="relative">
                <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input type="email" className="input pl-9" placeholder="john@example.com" value={data.email} onChange={e => update('email', e.target.value)} />
              </div>
            </div>
          </div>
        )}

        {/* Step 2 — Account Setup */}
        {step === 1 && (
          <div className="space-y-4 max-w-lg">
            <div>
              <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-0.5">Account Setup</h4>
              <p className="text-xs text-slate-500 mb-4">Choose your credentials and role.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Username <span className="text-red-500">*</span></label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium">@</span>
                <input type="text" className="input pl-7" placeholder="johndoe" value={data.username} onChange={e => update('username', e.target.value)} />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Password <span className="text-red-500">*</span></label>
              <div className="relative">
                <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input type="password" className="input pl-9" placeholder="••••••••" value={data.password} onChange={e => update('password', e.target.value)} />
              </div>
              <PasswordStrength password={data.password} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Role <span className="text-red-500">*</span></label>
              <select className="input" value={data.role} onChange={e => update('role', e.target.value)}>
                <option value="">Select a role...</option>
                <option value="admin">Administrator</option>
                <option value="manager">Manager</option>
                <option value="developer">Developer</option>
                <option value="designer">Designer</option>
                <option value="viewer">Viewer (Read-only)</option>
              </select>
            </div>
          </div>
        )}

        {/* Step 3 — Confirmation */}
        {step === 2 && (
          <div className="max-w-lg">
            <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-0.5">Review Your Information</h4>
            <p className="text-xs text-slate-500 mb-4">Please review the details below before submitting.</p>

            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 space-y-2.5 mb-5">
              {[
                ['Full Name', `${data.firstName} ${data.lastName}`],
                ['Email', data.email],
                ['Username', `@${data.username}`],
                ['Role', data.role],
                ['Password', '••••••••'],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center gap-3 text-sm">
                  <span className="text-slate-500 w-28 shrink-0">{label}</span>
                  <span className="font-medium text-slate-800 dark:text-slate-200">{value}</span>
                </div>
              ))}
            </div>

            <label className="flex items-start gap-3 cursor-pointer mb-4">
              <input
                type="checkbox"
                className="w-4 h-4 text-primary-600 rounded mt-0.5 shrink-0"
                checked={data.terms}
                onChange={e => update('terms', e.target.checked)}
              />
              <span className="text-sm text-slate-600 dark:text-slate-400">
                I agree to the{' '}
                <span className="text-primary-600 dark:text-primary-400 font-medium hover:underline cursor-pointer">Terms of Service</span>
                {' '}and{' '}
                <span className="text-primary-600 dark:text-primary-400 font-medium hover:underline cursor-pointer">Privacy Policy</span>.
                I understand that my data will be processed as described in the Privacy Policy.
              </span>
            </label>
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between mt-6 pt-4 border-t border-slate-200 dark:border-slate-700">
          <button
            type="button"
            onClick={() => setStep(s => s - 1)}
            disabled={step === 0}
            className={`flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-lg transition-colors ${step === 0 ? 'text-slate-300 dark:text-slate-600 cursor-not-allowed' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
          >
            <ChevronLeft size={16} />Back
          </button>

          <div className="flex items-center gap-1.5">
            {steps.map((_, i) => (
              <div key={i} className={`h-1.5 rounded-full transition-all duration-300 ${i === step ? 'w-6 bg-primary-500' : i < step ? 'w-3 bg-emerald-400' : 'w-3 bg-slate-200 dark:bg-slate-700'}`} />
            ))}
          </div>

          {step < steps.length - 1 ? (
            <button
              type="button"
              onClick={() => setStep(s => s + 1)}
              disabled={!canNext()}
              className={`flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-lg transition-all ${canNext() ? 'bg-primary-600 text-white hover:bg-primary-700 shadow-sm' : 'bg-slate-200 dark:bg-slate-700 text-slate-400 cursor-not-allowed'}`}
            >
              Next<ChevronRight size={16} />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => { if (canNext()) setComplete(true) }}
              disabled={!canNext()}
              className={`flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-lg transition-all ${canNext() ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm' : 'bg-slate-200 dark:bg-slate-700 text-slate-400 cursor-not-allowed'}`}
            >
              <CheckCircle size={15} />Create Account
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── NEW 5. Login Form Validation ─────────────────────────────────────────────
function LoginFormValidation() {
  const [form, setForm] = useState({ email: '', password: '', remember: false })
  const [errors, setErrors] = useState({})
  const [touched, setTouched] = useState({})
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const submitTimeoutRef = useRef(null)

  useEffect(() => () => {
    if (submitTimeoutRef.current) clearTimeout(submitTimeoutRef.current)
  }, [])

  const validate = (name, value) => {
    if (name === 'email') {
      if (!value) return 'Email is required'
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Enter a valid email address'
    }
    if (name === 'password') {
      if (!value) return 'Password is required'
      if (value.length < 6) return 'Password must be at least 6 characters'
    }
    return null
  }

  const handleBlur = (e) => {
    const { name, value } = e.target
    setTouched(t => ({ ...t, [name]: true }))
    setErrors(prev => ({ ...prev, [name]: validate(name, value) }))
  }

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    const val = type === 'checkbox' ? checked : value
    setForm(f => ({ ...f, [name]: val }))
    if (touched[name]) setErrors(prev => ({ ...prev, [name]: validate(name, val) }))
  }

  const isSuccess = (name) => touched[name] && !errors[name] && form[name]

  const handleSubmit = (e) => {
    e.preventDefault()
    const emailErr = validate('email', form.email)
    const pwErr = validate('password', form.password)
    setErrors({ email: emailErr, password: pwErr })
    setTouched({ email: true, password: true })
    if (emailErr || pwErr) return
    setLoading(true)
    if (submitTimeoutRef.current) clearTimeout(submitTimeoutRef.current)
    submitTimeoutRef.current = setTimeout(() => {
      setLoading(false)
      setSuccess(true)
    }, 1500)
  }

  if (success) {
    return (
      <div className="card p-8 flex flex-col items-center text-center">
        <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mb-4">
          <CheckCircle size={28} className="text-emerald-500" />
        </div>
        <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-1">Signed in successfully!</h3>
        <p className="text-sm text-slate-500 mb-4">Welcome back, {form.email}</p>
        <button className="btn btn-secondary text-sm" onClick={() => { setSuccess(false); setForm({ email: '', password: '', remember: false }); setTouched({}); setErrors({}) }}>
          Reset Demo
        </button>
      </div>
    )
  }

  return (
    <div className="card p-6">
      <div className="flex items-center gap-2 mb-1">
        <div className="w-2 h-2 rounded-full bg-cyan-500" />
        <h3 className="font-semibold text-slate-800 dark:text-slate-200">Login Form Validation</h3>
      </div>
      <p className="text-xs text-slate-500 mb-6">Blur validation, show/hide password, remember me, loading state and success toast.</p>

      {/* Social login buttons */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <button type="button" className="flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-sm font-medium text-slate-700 dark:text-slate-300">
          <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0" aria-hidden="true">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          Continue with Google
        </button>
        <button type="button" className="flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-sm font-medium text-slate-700 dark:text-slate-300">
          <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0 fill-current" aria-hidden="true">
            <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
          </svg>
          Continue with GitHub
        </button>
      </div>

      <div className="flex items-center gap-3 mb-5">
        <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
        <span className="text-xs text-slate-400 font-medium">or sign in with email</span>
        <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 max-w-sm" noValidate>
        {/* Email */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
            Email <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="email" name="email" value={form.email}
              className={`${inputCls(errors.email, isSuccess('email'))} pl-9 pr-9`}
              placeholder="you@example.com"
              onChange={handleChange} onBlur={handleBlur}
            />
            {isSuccess('email') && <CheckCircle size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-500" />}
            {errors.email && <XCircle size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-red-500" />}
          </div>
          <FieldMessage error={errors.email} />
        </div>

        {/* Password */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Password <span className="text-red-500">*</span>
            </label>
            <a href="#" onClick={(e) => e.preventDefault()} className="text-xs text-primary-600 dark:text-primary-400 hover:underline">Forgot password?</a>
          </div>
          <div className="relative">
            <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type={showPw ? 'text' : 'password'} name="password" value={form.password}
              className={`${inputCls(errors.password, isSuccess('password'))} pl-9 pr-10`}
              placeholder="••••••••"
              onChange={handleChange} onBlur={handleBlur}
            />
            <button type="button" onClick={() => setShowPw(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
          <FieldMessage error={errors.password} hint="Minimum 6 characters." />
        </div>

        {/* Remember me */}
        <label className="flex items-center gap-2.5 cursor-pointer">
          <input
            type="checkbox" name="remember" checked={form.remember}
            className="w-4 h-4 text-primary-600 rounded"
            onChange={handleChange}
          />
          <span className="text-sm text-slate-600 dark:text-slate-400">Remember me for 30 days</span>
        </label>

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          className={`btn btn-primary w-full flex items-center justify-center gap-2 ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
        >
          {loading ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Signing in...
            </>
          ) : 'Sign In'}
        </button>
      </form>
    </div>
  )
}

// ─── NEW 6. Credit Card Form ───────────────────────────────────────────────────
function CreditCardForm() {
  const [form, setForm] = useState({ number: '', name: '', expiry: '', cvv: '' })
  const [errors, setErrors] = useState({})
  const [submitted, setSubmitted] = useState(false)
  const [success, setSuccess] = useState(false)
  const [showCvv, setShowCvv] = useState(false)

  const formatCardNumber = (val) => {
    const d = val.replace(/\D/g, '').slice(0, 16)
    return d.replace(/(.{4})/g, '$1 ').trim()
  }

  const formatExpiry = (val) => {
    const d = val.replace(/\D/g, '').slice(0, 4)
    if (d.length <= 2) return d
    return `${d.slice(0, 2)}/${d.slice(2)}`
  }

  const detectCardType = (num) => {
    const n = num.replace(/\s/g, '')
    if (/^4/.test(n)) return 'visa'
    if (/^5[1-5]/.test(n)) return 'mastercard'
    if (/^3[47]/.test(n)) return 'amex'
    return null
  }

  const cardType = detectCardType(form.number)

  const validate = () => {
    const errs = {}
    const numDigits = form.number.replace(/\s/g, '').length
    if (!form.number) errs.number = 'Card number is required'
    else if (numDigits < 16) errs.number = 'Enter a complete 16-digit card number'

    if (!form.name.trim()) errs.name = 'Cardholder name is required'
    else if (form.name.trim().length < 3) errs.name = 'Enter your full name as it appears on the card'

    const [mm, yy] = (form.expiry || '').split('/')
    if (!form.expiry) errs.expiry = 'Expiry date is required'
    else if (!mm || !yy || parseInt(mm) > 12 || parseInt(mm) < 1) errs.expiry = 'Enter a valid MM/YY date'

    if (!form.cvv) errs.cvv = 'CVV is required'
    else if (form.cvv.length < 3) errs.cvv = 'CVV must be 3-4 digits'

    return errs
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    let formatted = value
    if (name === 'number') formatted = formatCardNumber(value)
    if (name === 'expiry') formatted = formatExpiry(value)
    if (name === 'cvv') formatted = value.replace(/\D/g, '').slice(0, 4)
    setForm(f => ({ ...f, [name]: formatted }))
    if (submitted) setErrors(prev => ({ ...prev, [name]: null }))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    setSubmitted(true)
    const errs = validate()
    if (Object.keys(errs).length > 0) { setErrors(errs); return }
    setSuccess(true)
  }

  // Display values for the card preview
  const displayNumber = form.number || '•••• •••• •••• ••••'
  const displayName = form.name || 'YOUR NAME'
  const displayExpiry = form.expiry || 'MM/YY'

  if (success) {
    return (
      <div className="card p-8 flex flex-col items-center text-center">
        <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mb-4">
          <CheckCircle size={28} className="text-emerald-500" />
        </div>
        <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-1">Payment method saved!</h3>
        <p className="text-sm text-slate-500 mb-1">Card ending in {form.number.slice(-4)} has been added.</p>
        <p className="text-xs text-slate-400 mb-5">You can manage your payment methods in settings.</p>
        <button className="btn btn-secondary text-sm" onClick={() => { setSuccess(false); setSubmitted(false); setForm({ number: '', name: '', expiry: '', cvv: '' }); setErrors({}) }}>
          Reset Demo
        </button>
      </div>
    )
  }

  return (
    <div className="card p-6">
      <div className="flex items-center gap-2 mb-1">
        <div className="w-2 h-2 rounded-full bg-violet-500" />
        <h3 className="font-semibold text-slate-800 dark:text-slate-200">Credit Card Form</h3>
      </div>
      <p className="text-xs text-slate-500 mb-5">Auto-formatted card number, card type detection, and premium card preview.</p>

      {/* Card Preview */}
      <div className="relative h-44 rounded-2xl bg-slate-800 p-6 mb-6 overflow-hidden shadow-lg shadow-slate-900/30">
        {/* Decorative circles */}
        <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full bg-white/5" />
        <div className="absolute -bottom-12 -left-6 w-48 h-48 rounded-full bg-white/5" />

        {/* Card type */}
        <div className="flex justify-between items-start mb-6 relative">
          <div className="flex flex-col gap-1">
            <div className="w-10 h-7 rounded bg-amber-400 opacity-90" />
          </div>
          <div className="text-right">
            {cardType === 'visa' && (
              <span className="text-white font-black text-2xl italic tracking-tight" style={{ fontFamily: 'serif' }}>VISA</span>
            )}
            {cardType === 'mastercard' && (
              <div className="flex -space-x-2">
                <div className="w-7 h-7 rounded-full bg-red-500 opacity-90" />
                <div className="w-7 h-7 rounded-full bg-amber-400 opacity-90" />
              </div>
            )}
            {cardType === 'amex' && (
              <span className="text-white font-bold text-xs tracking-widest uppercase">American Express</span>
            )}
            {!cardType && (
              <CreditCard size={22} className="text-white/40" />
            )}
          </div>
        </div>

        {/* Card number */}
        <p className="text-white font-mono text-lg tracking-widest font-medium relative mb-4 leading-none">
          {displayNumber.padEnd(19, ' ')}
        </p>

        {/* Bottom row */}
        <div className="flex justify-between items-end relative">
          <div>
            <p className="text-white/40 text-[9px] uppercase tracking-widest mb-0.5">Card Holder</p>
            <p className="text-white text-sm font-semibold tracking-wide uppercase truncate max-w-[160px]">{displayName}</p>
          </div>
          <div className="text-right">
            <p className="text-white/40 text-[9px] uppercase tracking-widest mb-0.5">Expires</p>
            <p className="text-white text-sm font-semibold font-mono">{displayExpiry}</p>
          </div>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4 max-w-sm" noValidate>
        {/* Card number */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
            Card Number <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <CreditCard size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text" name="number" value={form.number}
              className={`${inputCls(errors.number, !errors.number && submitted && form.number.replace(/\s/g,'').length === 16)} pl-9 font-mono tracking-wider`}
              placeholder="1234 5678 9012 3456"
              onChange={handleChange}
              maxLength={19}
            />
          </div>
          <FieldMessage error={errors.number} />
        </div>

        {/* Cardholder name */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
            Cardholder Name <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text" name="name" value={form.name}
              className={`${inputCls(errors.name, !errors.name && submitted && form.name.trim().length >= 3)} pl-9 uppercase`}
              placeholder="JOHN DOE"
              onChange={handleChange}
            />
          </div>
          <FieldMessage error={errors.name} />
        </div>

        {/* Expiry + CVV */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Expiry <span className="text-red-500">*</span>
            </label>
            <input
              type="text" name="expiry" value={form.expiry}
              className={`${inputCls(errors.expiry, !errors.expiry && submitted && form.expiry.length === 5)} font-mono`}
              placeholder="MM/YY"
              onChange={handleChange}
              maxLength={5}
            />
            <FieldMessage error={errors.expiry} />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              CVV <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type={showCvv ? 'text' : 'password'} name="cvv" value={form.cvv}
                className={`${inputCls(errors.cvv, !errors.cvv && submitted && form.cvv.length >= 3)} font-mono pr-9`}
                placeholder="•••"
                onChange={handleChange}
                maxLength={4}
              />
              <button type="button" onClick={() => setShowCvv(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                {showCvv ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            <FieldMessage error={errors.cvv} />
          </div>
        </div>

        {/* Card type badge */}
        {cardType && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
            <CheckCircle size={14} className="text-emerald-500 shrink-0" />
            <span className="text-xs text-slate-600 dark:text-slate-400">
              Detected: <span className="font-semibold text-slate-800 dark:text-slate-200 capitalize">{cardType}</span> card
            </span>
          </div>
        )}

        <button type="submit" className="btn btn-primary w-full flex items-center justify-center gap-2">
          <CreditCard size={15} />
          Save Payment Method
        </button>
      </form>
    </div>
  )
}

// ─── NEW 7. Multi-Step Onboarding Wizard ──────────────────────────────────────
function OnboardingWizard() {
  const [step, setStep] = useState(0)
  const [data, setData] = useState({
    // Step 1: Personal
    firstName: '', email: '', phone: '',
    // Step 2: Company
    company: '', role: '', companySize: '', industry: '',
  })
  const [complete, setComplete] = useState(false)

  const steps = [
    { label: 'Personal Info', icon: User, color: 'bg-primary-600' },
    { label: 'Company Info', icon: Building, color: 'bg-violet-600' },
    { label: 'Review', icon: CheckCircle, color: 'bg-emerald-600' },
  ]

  const update = (key, value) => setData(d => ({ ...d, [key]: value }))

  const canNext = () => {
    if (step === 0) return data.firstName.trim() && data.email.trim() && data.phone.trim()
    if (step === 1) return data.company.trim() && data.role.trim() && data.companySize && data.industry
    return true
  }

  const progress = ((step) / (steps.length - 1)) * 100

  if (complete) {
    return (
      <div className="card p-10 flex flex-col items-center text-center">
        <div className="w-20 h-20 rounded-full bg-emerald-500 flex items-center justify-center mb-5 shadow-lg shadow-emerald-500/30">
          <CheckCircle size={36} className="text-white" />
        </div>
        <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">You're all set, {data.firstName}!</h3>
        <p className="text-sm text-slate-500 mb-1">Your workspace at <strong className="text-slate-700 dark:text-slate-300">{data.company}</strong> is ready.</p>
        <p className="text-xs text-slate-400 mb-6">We've sent a welcome email to {data.email}</p>
        <button
          className="btn btn-primary"
          onClick={() => {
            setComplete(false)
            setStep(0)
            setData({ firstName: '', email: '', phone: '', company: '', role: '', companySize: '', industry: '' })
          }}
        >
          Reset Demo
        </button>
      </div>
    )
  }

  return (
    <div className="card overflow-hidden">
      {/* Header with step indicators */}
      <div className="px-6 pt-6 pb-5 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
        {/* Progress bar */}
        <div className="h-1 bg-slate-200 dark:bg-slate-700 rounded-full mb-5 overflow-hidden">
          <div
            className="h-full bg-primary-500 rounded-full transition-all duration-500"
            style={{ width: `${step === 0 ? 5 : step === 1 ? 50 : 100}%` }}
          />
        </div>

        {/* Step indicators */}
        <div className="flex items-start gap-2">
          {steps.map((s, i) => (
            <Fragment key={i}>
              <div className="flex flex-col items-center gap-1.5 shrink-0">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 shadow-sm ${
                  i < step ? 'bg-emerald-500 text-white shadow-emerald-500/30'
                  : i === step ? `${s.color} text-white shadow-primary-500/30`
                  : 'bg-white dark:bg-slate-700 text-slate-400 border border-slate-200 dark:border-slate-600'
                }`}>
                  {i < step ? <CheckCircle size={14} /> : <s.icon size={14} />}
                </div>
                <span className={`text-[10px] font-semibold whitespace-nowrap hidden sm:block ${
                  i === step ? 'text-primary-600 dark:text-primary-400'
                  : i < step ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-slate-400'
                }`}>{s.label}</span>
              </div>
              {i < steps.length - 1 && (
                <div className={`flex-1 h-0.5 mt-4 rounded-full transition-all duration-500 ${i < step ? 'bg-emerald-400' : 'bg-slate-200 dark:bg-slate-700'}`} />
              )}
            </Fragment>
          ))}
        </div>
      </div>

      <div className="p-6">

        {/* Step 1 — Personal Info */}
        {step === 0 && (
          <div className="space-y-4 max-w-lg">
            <div className="mb-2">
              <h4 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-0.5">Personal Information</h4>
              <p className="text-xs text-slate-500">Start with your basic contact details.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Full Name <span className="text-red-500">*</span></label>
              <div className="relative">
                <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input type="text" className="input pl-9" placeholder="John Doe" value={data.firstName} onChange={e => update('firstName', e.target.value)} />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Work Email <span className="text-red-500">*</span></label>
              <div className="relative">
                <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input type="email" className="input pl-9" placeholder="john@company.com" value={data.email} onChange={e => update('email', e.target.value)} />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Phone Number <span className="text-red-500">*</span></label>
              <div className="relative">
                <Phone size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input type="tel" className="input pl-9" placeholder="+1 555 000 0000" value={data.phone} onChange={e => update('phone', e.target.value)} />
              </div>
            </div>
          </div>
        )}

        {/* Step 2 — Company Info */}
        {step === 1 && (
          <div className="space-y-4 max-w-lg">
            <div className="mb-2">
              <h4 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-0.5">Company Information</h4>
              <p className="text-xs text-slate-500">Help us tailor the experience for your team.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Company Name <span className="text-red-500">*</span></label>
              <div className="relative">
                <Building size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input type="text" className="input pl-9" placeholder="Acme Inc." value={data.company} onChange={e => update('company', e.target.value)} />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Your Role <span className="text-red-500">*</span></label>
              <input type="text" className="input" placeholder="e.g. Product Designer" value={data.role} onChange={e => update('role', e.target.value)} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Company Size <span className="text-red-500">*</span></label>
                <select className="input" value={data.companySize} onChange={e => update('companySize', e.target.value)}>
                  <option value="">Select size...</option>
                  <option value="1-10">1–10 employees</option>
                  <option value="11-50">11–50 employees</option>
                  <option value="51-200">51–200 employees</option>
                  <option value="201-1000">201–1,000 employees</option>
                  <option value="1000+">1,000+ employees</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Industry <span className="text-red-500">*</span></label>
                <select className="input" value={data.industry} onChange={e => update('industry', e.target.value)}>
                  <option value="">Select...</option>
                  <option value="tech">Technology</option>
                  <option value="finance">Finance</option>
                  <option value="healthcare">Healthcare</option>
                  <option value="education">Education</option>
                  <option value="retail">Retail / E-commerce</option>
                  <option value="media">Media & Entertainment</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Step 3 — Review */}
        {step === 2 && (
          <div className="max-w-lg">
            <div className="mb-4">
              <h4 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-0.5">Review & Confirm</h4>
              <p className="text-xs text-slate-500">Everything look right? You can go back to make changes.</p>
            </div>

            <div className="space-y-4">
              {/* Personal card */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3 bg-primary-50 dark:bg-primary-900/10 border-b border-primary-100 dark:border-primary-900/30">
                  <User size={13} className="text-primary-600 dark:text-primary-400" />
                  <span className="text-xs font-semibold text-primary-700 dark:text-primary-400 uppercase tracking-wide">Personal Info</span>
                </div>
                <div className="px-4 py-3 space-y-2">
                  {[
                    ['Full Name', data.firstName],
                    ['Email', data.email],
                    ['Phone', data.phone],
                  ].map(([label, value]) => (
                    <div key={label} className="flex items-center gap-3 text-sm">
                      <span className="text-slate-400 w-24 shrink-0 text-xs">{label}</span>
                      <span className="font-medium text-slate-800 dark:text-slate-200">{value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Company card */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3 bg-violet-50 dark:bg-violet-900/10 border-b border-violet-100 dark:border-violet-900/30">
                  <Building size={13} className="text-violet-600 dark:text-violet-400" />
                  <span className="text-xs font-semibold text-violet-700 dark:text-violet-400 uppercase tracking-wide">Company Info</span>
                </div>
                <div className="px-4 py-3 space-y-2">
                  {[
                    ['Company', data.company],
                    ['Role', data.role],
                    ['Size', data.companySize],
                    ['Industry', data.industry],
                  ].map(([label, value]) => (
                    <div key={label} className="flex items-center gap-3 text-sm">
                      <span className="text-slate-400 w-24 shrink-0 text-xs">{label}</span>
                      <span className="font-medium text-slate-800 dark:text-slate-200">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between mt-6 pt-4 border-t border-slate-200 dark:border-slate-700">
          <button
            type="button"
            onClick={() => setStep(s => s - 1)}
            disabled={step === 0}
            className={`flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-lg transition-colors ${
              step === 0 ? 'text-slate-300 dark:text-slate-600 cursor-not-allowed' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
            }`}
          >
            <ChevronLeft size={16} />Back
          </button>

          <span className="text-xs text-slate-400 font-medium">{step + 1} / {steps.length}</span>

          {step < steps.length - 1 ? (
            <button
              type="button"
              onClick={() => setStep(s => s + 1)}
              disabled={!canNext()}
              className={`flex items-center gap-1.5 text-sm font-semibold px-5 py-2 rounded-lg transition-all ${
                canNext() ? 'bg-primary-600 text-white hover:bg-primary-700 shadow-sm shadow-primary-500/30' : 'bg-slate-200 dark:bg-slate-700 text-slate-400 cursor-not-allowed'
              }`}
            >
              Continue <ChevronRight size={16} />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setComplete(true)}
              className="flex items-center gap-1.5 text-sm font-semibold px-5 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm shadow-emerald-500/30 transition-all"
            >
              <CheckCircle size={15} />Finish Setup
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function FormValidation() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Form Validation"
        subtitle="Live validation, required fields, input masks, login flow, credit card form, and a multi-step onboarding wizard"
      />

      {/* Stat Cards Strip */}
      <StatCardsStrip />

      {/* Original forms */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <LiveValidationForm />
        <RequiredFieldsDemo />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <PatternValidation />
        <MultiStepWizard />
      </div>

      {/* New forms */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <LoginFormValidation />
        <CreditCardForm />
      </div>

      <OnboardingWizard />
    </div>
  )
}
