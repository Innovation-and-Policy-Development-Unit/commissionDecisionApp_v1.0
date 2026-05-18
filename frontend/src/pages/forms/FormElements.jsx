import { useState, useRef } from 'react'
import PageHeader from '../../components/shared/PageHeader'
import {
  Eye, EyeOff, Search, Calendar, Upload, Check,
  Mail, Lock, User, Phone, Link, DollarSign, AtSign,
  AlertCircle, CheckCircle2, AlertTriangle, X, Image,
} from 'lucide-react'

// ─── Utility sub-components ──────────────────────────────────────────────────

function Section({ title, desc, children, span }) {
  return (
    <div className={`card p-6 ${span === 2 ? 'col-span-1 xl:col-span-2' : ''}`}>
      <div className="mb-5">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{title}</h3>
        {desc && <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{desc}</p>}
      </div>
      {children}
    </div>
  )
}

function Label({ children, required, htmlFor }) {
  return (
    <label
      htmlFor={htmlFor}
      className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5"
    >
      {children}
      {required && <span className="text-red-500 ml-1">*</span>}
    </label>
  )
}

function Helper({ children, error, success, warning }) {
  const color = error ? 'text-red-500' : success ? 'text-emerald-600 dark:text-emerald-400' : warning ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500 dark:text-slate-400'
  return <p className={`text-xs mt-1.5 ${color}`}>{children}</p>
}

function InputIcon({ children, left, right }) {
  return (
    <div className={`absolute top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none ${left ? 'left-3' : 'right-3'}`}>
      {children}
    </div>
  )
}

// ─── Toggle switch ────────────────────────────────────────────────────────────

function Toggle({ checked, onChange, color = 'bg-primary-500' }) {
  return (
    <div
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className={`relative w-11 h-6 rounded-full cursor-pointer transition-colors duration-200 ${checked ? color : 'bg-slate-200 dark:bg-slate-600'}`}
    >
      <div
        className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${checked ? 'translate-x-5' : 'translate-x-0'}`}
      />
    </div>
  )
}

// ─── Custom checkbox ──────────────────────────────────────────────────────────

function Checkbox({ checked, onChange, indeterminate }) {
  return (
    <div
      role="checkbox"
      aria-checked={checked}
      onClick={onChange}
      className={`w-5 h-5 rounded-md border-2 flex items-center justify-center cursor-pointer transition-all shrink-0 ${
        checked || indeterminate
          ? 'bg-primary-500 border-primary-500'
          : 'border-slate-300 dark:border-slate-600 hover:border-primary-400'
      }`}
    >
      {checked && !indeterminate && <Check size={11} className="text-white" />}
      {indeterminate && <div className="w-2.5 h-0.5 bg-white rounded" />}
    </div>
  )
}

// ─── Radio dot ────────────────────────────────────────────────────────────────

function RadioDot({ checked }) {
  return (
    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all shrink-0 ${checked ? 'border-primary-500' : 'border-slate-300 dark:border-slate-600'}`}>
      {checked && <div className="w-2.5 h-2.5 bg-primary-500 rounded-full" />}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function FormElements() {
  // Text inputs
  const [showPass, setShowPass]   = useState(false)
  const [charInput, setCharInput] = useState('')
  const MAX_CHARS = 80

  // Textarea
  const [textareaVal, setTextareaVal] = useState('This is some example text content in the textarea.')
  const TEXTAREA_MAX = 300

  // Select
  const [selectVal, setSelectVal] = useState('')

  // Checkboxes
  const [checks, setChecks] = useState({ notifications: true, marketing: false, twofa: false, updates: true })
  const toggleCheck = (k) => setChecks(p => ({ ...p, [k]: !p[k] }))

  // Card checkboxes
  const [cardChecks, setCardChecks] = useState({ design: true, code: false, testing: false })
  const toggleCard = (k) => setCardChecks(p => ({ ...p, [k]: !p[k] }))

  // Radio
  const [radio, setRadio]       = useState('monthly')
  const [radioCard, setRadioCard] = useState('team')

  // Toggles
  const [toggles, setToggles] = useState({ darkMode: true, notifications: false, autoSave: true, analytics: false })
  const toggleSwitch = (k) => setToggles(p => ({ ...p, [k]: !p[k] }))

  // Range sliders
  const [volume, setVolume]     = useState(65)
  const [opacity, setOpacity]   = useState(40)

  // File drag
  const [dragging, setDragging] = useState(false)
  const [droppedFile, setDroppedFile] = useState(null)
  const fileRef = useRef(null)

  const handleDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) setDroppedFile(file.name)
  }

  // Color picker
  const [color, setColor] = useState('#6366f1')

  // Tags
  const [tags, setTags]         = useState(['React', 'Tailwind'])
  const [tagInput, setTagInput] = useState('')
  const addTag = (e) => {
    if (e.key === 'Enter' && tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags(p => [...p, tagInput.trim()])
      setTagInput('')
    }
  }
  const removeTag = (t) => setTags(p => p.filter(x => x !== t))

  // Floating label state
  const [floatName, setFloatName]   = useState('')
  const [floatEmail, setFloatEmail] = useState('')
  const [floatPhone, setFloatPhone] = useState('')

  return (
    <div>
      <PageHeader
        title="Form Elements"
        subtitle="Complete showcase of all input types and interaction patterns"
      />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">

        {/* ── 1. Text Inputs ─────────────────────────────────────── */}
        <Section title="Text Inputs" desc="Default, icon variants, character counter, disabled">
          <div className="space-y-4">
            {/* Default */}
            <div>
              <Label>Default Input</Label>
              <input type="text" className="input" placeholder="Enter text here…" />
            </div>

            {/* Disabled */}
            <div>
              <Label>Disabled Input</Label>
              <input type="text" className="input opacity-60 cursor-not-allowed" placeholder="This field is disabled" disabled />
              <Helper>This field is read-only and cannot be modified.</Helper>
            </div>

            {/* Icon left */}
            <div>
              <Label>With Left Icon</Label>
              <div className="relative">
                <InputIcon left><Search size={15} /></InputIcon>
                <input type="text" className="input pl-9" placeholder="Search anything…" />
              </div>
            </div>

            {/* Icon right */}
            <div>
              <Label>With Right Icon</Label>
              <div className="relative">
                <InputIcon right><Mail size={15} /></InputIcon>
                <input type="email" className="input pr-9" placeholder="your@email.com" />
              </div>
            </div>

            {/* Both icons — password */}
            <div>
              <Label>Password with Toggle</Label>
              <div className="relative">
                <InputIcon left><Lock size={15} /></InputIcon>
                <input
                  type={showPass ? 'text' : 'password'}
                  className="input pl-9 pr-10"
                  placeholder="Enter your password…"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <Helper>Minimum 8 characters with at least one number.</Helper>
            </div>

            {/* Character count */}
            <div>
              <div className="flex justify-between mb-1.5">
                <Label>With Character Counter</Label>
                <span className={`text-xs font-medium ${charInput.length > MAX_CHARS ? 'text-red-500' : 'text-slate-400 dark:text-slate-500'}`}>
                  {charInput.length}/{MAX_CHARS}
                </span>
              </div>
              <input
                type="text"
                className={`input ${charInput.length > MAX_CHARS ? 'border-red-400 focus:ring-red-400/30 focus:border-red-400' : ''}`}
                placeholder="Type something to see the counter…"
                value={charInput}
                onChange={e => setCharInput(e.target.value)}
              />
              {charInput.length > MAX_CHARS && (
                <Helper error>You have exceeded the {MAX_CHARS} character limit.</Helper>
              )}
            </div>
          </div>
        </Section>

        {/* ── 2. Textarea ─────────────────────────────────────────── */}
        <Section title="Textarea" desc="Resizable with live character counter">
          <div className="space-y-4">
            {/* Default */}
            <div>
              <Label>Default Textarea</Label>
              <textarea rows={3} className="input resize-y" placeholder="Enter a description…" />
            </div>

            {/* Non-resizable */}
            <div>
              <Label>Fixed Height (no resize)</Label>
              <textarea rows={3} className="input resize-none" placeholder="This textarea cannot be resized…" />
            </div>

            {/* With counter */}
            <div>
              <div className="flex justify-between mb-1.5">
                <Label>With Live Counter</Label>
                <span className={`text-xs font-medium ${textareaVal.length > TEXTAREA_MAX ? 'text-red-500' : 'text-slate-400 dark:text-slate-500'}`}>
                  {textareaVal.length}/{TEXTAREA_MAX}
                </span>
              </div>
              <textarea
                rows={4}
                className={`input resize-y ${textareaVal.length > TEXTAREA_MAX ? 'border-red-400 focus:border-red-400 focus:ring-red-400/30' : ''}`}
                value={textareaVal}
                onChange={e => setTextareaVal(e.target.value)}
              />
              <Helper>Use this field to write a detailed description. Keep it under {TEXTAREA_MAX} characters.</Helper>
            </div>
          </div>
        </Section>

        {/* ── 3. Select / Dropdown ─────────────────────────────────── */}
        <Section title="Select &amp; Dropdown" desc="Native select, multi-select">
          <div className="space-y-4">
            {/* Default select */}
            <div>
              <Label>Default Select</Label>
              <select className="input" value={selectVal} onChange={e => setSelectVal(e.target.value)}>
                <option value="">— Choose an option —</option>
                <option value="react">React</option>
                <option value="vue">Vue.js</option>
                <option value="angular">Angular</option>
                <option value="svelte">Svelte</option>
                <option value="next">Next.js</option>
              </select>
              {selectVal && <Helper success>You selected: <strong>{selectVal}</strong></Helper>}
            </div>

            {/* Grouped select */}
            <div>
              <Label>Grouped Select</Label>
              <select className="input">
                <option value="">— Pick a framework —</option>
                <optgroup label="Frontend">
                  <option>React</option>
                  <option>Vue.js</option>
                  <option>Svelte</option>
                </optgroup>
                <optgroup label="Backend">
                  <option>Node.js</option>
                  <option>Django</option>
                  <option>Laravel</option>
                </optgroup>
              </select>
            </div>

            {/* Multiple */}
            <div>
              <Label>Multi-select</Label>
              <select className="input" multiple size={5}>
                <option>React</option>
                <option>Vue.js</option>
                <option>Angular</option>
                <option>Svelte</option>
                <option>Next.js</option>
              </select>
              <Helper>Hold Ctrl / Cmd to select multiple items.</Helper>
            </div>
          </div>
        </Section>

        {/* ── 4. Checkboxes ────────────────────────────────────────── */}
        <Section title="Checkboxes" desc="Default, card-style, indeterminate state">
          <div className="space-y-5">
            {/* Default list */}
            <div className="space-y-3">
              {[
                { key: 'notifications', label: 'Email notifications', desc: 'Get notified about important account events' },
                { key: 'marketing',     label: 'Marketing emails',    desc: 'Receive promotional content and offers' },
                { key: 'twofa',         label: '2-Factor auth',       desc: 'Add an extra layer of security to your account' },
                { key: 'updates',       label: 'Product updates',     desc: 'Stay informed about new features and releases' },
              ].map(({ key, label, desc }) => (
                <label key={key} className="flex items-start gap-3 cursor-pointer group">
                  <Checkbox checked={checks[key]} onChange={() => toggleCheck(key)} />
                  <div>
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{label}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{desc}</p>
                  </div>
                </label>
              ))}
              {/* Indeterminate demo */}
              <label className="flex items-center gap-3 cursor-pointer pt-1 border-t border-slate-100 dark:border-slate-700">
                <Checkbox checked={false} indeterminate />
                <span className="text-sm text-slate-700 dark:text-slate-300">Select all items <span className="text-slate-400">(2 of 4 selected)</span></span>
              </label>
            </div>

            {/* Card-style checkboxes */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">Card-style Checkboxes</p>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { key: 'design',  label: 'Design',  icon: '🎨' },
                  { key: 'code',    label: 'Code',    icon: '💻' },
                  { key: 'testing', label: 'Testing', icon: '🧪' },
                ].map(({ key, label, icon }) => (
                  <label
                    key={key}
                    onClick={() => toggleCard(key)}
                    className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                      cardChecks[key]
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                        : 'border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500'
                    }`}
                  >
                    <span className="text-2xl">{icon}</span>
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{label}</span>
                    <Checkbox checked={cardChecks[key]} onChange={() => {}} />
                  </label>
                ))}
              </div>
            </div>
          </div>
        </Section>

        {/* ── 5. Radio Buttons ─────────────────────────────────────── */}
        <Section title="Radio Buttons" desc="Default and card-style">
          <div className="space-y-5">
            {/* Default */}
            <div className="space-y-3">
              {[
                { value: 'monthly',  label: 'Monthly Billing',  desc: '$29/month, billed monthly' },
                { value: 'annually', label: 'Annual Billing',   desc: '$23/month, billed annually — Save 20%' },
                { value: 'enterprise', label: 'Enterprise',     desc: 'Custom pricing for large teams' },
              ].map(({ value, label, desc }) => (
                <label
                  key={value}
                  onClick={() => setRadio(value)}
                  className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                    radio === value
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                      : 'border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500'
                  }`}
                >
                  <RadioDot checked={radio === value} />
                  <div>
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{label}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{desc}</p>
                  </div>
                </label>
              ))}
            </div>

            {/* Card-style radio */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">Team Size Radio Cards</p>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { value: 'solo',  label: 'Solo',  sub: '1 user' },
                  { value: 'team',  label: 'Team',  sub: '2–10 users' },
                  { value: 'org',   label: 'Org',   sub: '11+ users' },
                ].map(({ value, label, sub }) => (
                  <label
                    key={value}
                    onClick={() => setRadioCard(value)}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 cursor-pointer text-center transition-all ${
                      radioCard === value
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                        : 'border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500'
                    }`}
                  >
                    <RadioDot checked={radioCard === value} />
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">{label}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{sub}</p>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </Section>

        {/* ── 6. Toggle Switches ───────────────────────────────────── */}
        <Section title="Toggle Switches" desc="Colored toggle switches with descriptions">
          <div className="space-y-5">
            {[
              { key: 'darkMode',      label: 'Dark Mode',       desc: 'Switch to a darker color scheme',           color: 'bg-violet-500' },
              { key: 'notifications', label: 'Notifications',   desc: 'Receive push and email notifications',       color: 'bg-primary-500' },
              { key: 'autoSave',      label: 'Auto-Save',       desc: 'Automatically save changes as you type',     color: 'bg-emerald-500' },
              { key: 'analytics',     label: 'Usage Analytics', desc: 'Help us improve by sharing anonymous data',  color: 'bg-amber-500' },
            ].map(({ key, label, desc, color }) => (
              <div key={key} className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{label}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{desc}</p>
                </div>
                <Toggle
                  checked={toggles[key]}
                  onChange={() => toggleSwitch(key)}
                  color={color}
                />
              </div>
            ))}

            {/* Toggle sizes demo */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-700">
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">Toggle size variants (small / default / large)</p>
              <div className="flex items-center gap-4">
                {/* Small */}
                <div
                  className="relative w-8 h-4 rounded-full bg-primary-500 cursor-pointer"
                  onClick={() => {}}
                >
                  <div className="absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full shadow translate-x-4" />
                </div>
                {/* Default */}
                <Toggle checked color="bg-primary-500" onChange={() => {}} />
                {/* Large */}
                <div
                  className="relative w-14 h-7 rounded-full bg-primary-500 cursor-pointer"
                  onClick={() => {}}
                >
                  <div className="absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow translate-x-7" />
                </div>
              </div>
            </div>
          </div>
        </Section>

        {/* ── 7. Range Sliders ─────────────────────────────────────── */}
        <Section title="Range Sliders" desc="Interactive sliders with live value display">
          <div className="space-y-6">
            {/* Volume */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <Label>Volume Control</Label>
                <span className="text-sm font-bold text-primary-600 dark:text-primary-400">{volume}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={volume}
                onChange={e => setVolume(Number(e.target.value))}
                className="w-full h-2 bg-slate-200 dark:bg-slate-600 rounded-full appearance-none cursor-pointer accent-primary-500"
              />
              <div className="flex justify-between mt-1.5">
                <span className="text-xs text-slate-400">0%</span>
                <span className="text-xs text-slate-400">50%</span>
                <span className="text-xs text-slate-400">100%</span>
              </div>
            </div>

            {/* Opacity */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <Label>Opacity Level</Label>
                <span className="text-sm font-bold text-violet-600 dark:text-violet-400">{opacity}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={opacity}
                onChange={e => setOpacity(Number(e.target.value))}
                className="w-full h-2 bg-slate-200 dark:bg-slate-600 rounded-full appearance-none cursor-pointer accent-violet-500"
              />
              <div className="flex justify-between mt-1.5">
                <span className="text-xs text-slate-400">Transparent</span>
                <span className="text-xs text-slate-400">Opaque</span>
              </div>
              {/* Visual preview */}
              <div className="mt-3 h-8 rounded-lg bg-violet-500 transition-opacity" style={{ opacity: opacity / 100 }} />
            </div>
          </div>
        </Section>

        {/* ── 8. File Upload ───────────────────────────────────────── */}
        <Section title="File Upload" desc="Styled file input and drag-and-drop area">
          <div className="space-y-4">
            {/* Styled file input */}
            <div>
              <Label>Styled File Input</Label>
              <div className="flex items-center gap-3">
                <label className="btn-outline cursor-pointer gap-2 text-sm">
                  <Upload size={14} />
                  Choose File
                  <input type="file" className="sr-only" />
                </label>
                <span className="text-sm text-slate-400 dark:text-slate-500 truncate">No file chosen</span>
              </div>
              <Helper>Supported formats: JPG, PNG, PDF. Max 10 MB.</Helper>
            </div>

            {/* Drag & drop */}
            <div>
              <Label>Drag &amp; Drop</Label>
              <div
                onDragOver={e => { e.preventDefault(); setDragging(true) }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                  dragging
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                    : 'border-slate-200 dark:border-slate-600 hover:border-primary-400 dark:hover:border-primary-600'
                }`}
              >
                <input
                  ref={fileRef}
                  type="file"
                  className="sr-only"
                  onChange={e => {
                    const f = e.target.files[0]
                    if (f) setDroppedFile(f.name)
                  }}
                />
                {droppedFile ? (
                  <>
                    <CheckCircle2 size={28} className="text-emerald-500 mx-auto mb-2" />
                    <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">{droppedFile}</p>
                    <button
                      type="button"
                      onClick={e => { e.stopPropagation(); setDroppedFile(null) }}
                      className="mt-2 text-xs text-slate-400 hover:text-red-500 transition-colors"
                    >
                      Remove
                    </button>
                  </>
                ) : (
                  <>
                    <Image size={28} className="text-slate-400 mx-auto mb-2" />
                    <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                      {dragging ? 'Drop your file here' : 'Drop files here or click to browse'}
                    </p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">PNG, JPG, GIF, PDF up to 10 MB</p>
                  </>
                )}
              </div>
            </div>
          </div>
        </Section>

        {/* ── 9. Date &amp; Time ────────────────────────────────────── */}
        <Section title="Date &amp; Time" desc="Date, time, and datetime-local inputs">
          <div className="space-y-4">
            <div>
              <Label>Date Picker</Label>
              <div className="relative">
                <InputIcon left><Calendar size={15} /></InputIcon>
                <input type="date" className="input pl-9" defaultValue="2026-03-11" />
              </div>
            </div>

            <div>
              <Label>Time Picker</Label>
              <input type="time" className="input" defaultValue="14:30" />
            </div>

            <div>
              <Label>Date &amp; Time Combined</Label>
              <input type="datetime-local" className="input" defaultValue="2026-03-11T14:30" />
            </div>

            <div>
              <Label>Date Range</Label>
              <div className="flex items-center gap-2">
                <input type="date" className="input flex-1" defaultValue="2026-03-01" />
                <span className="text-slate-400 text-sm font-medium shrink-0">to</span>
                <input type="date" className="input flex-1" defaultValue="2026-03-31" />
              </div>
              <Helper>Select a start and end date for the range.</Helper>
            </div>
          </div>
        </Section>

        {/* ── 10. Color Picker ─────────────────────────────────────── */}
        <Section title="Color Picker" desc="Native color input with hex display">
          <div className="space-y-4">
            <div>
              <Label>Pick a Color</Label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={color}
                  onChange={e => setColor(e.target.value)}
                  className="w-12 h-12 rounded-xl cursor-pointer border-2 border-slate-200 dark:border-slate-600 bg-transparent p-0.5"
                />
                <div className="flex-1">
                  <input
                    type="text"
                    className="input font-mono text-sm"
                    value={color}
                    onChange={e => setColor(e.target.value)}
                    placeholder="#000000"
                  />
                </div>
              </div>
            </div>

            {/* Preset swatches */}
            <div>
              <Label>Preset Swatches</Label>
              <div className="flex flex-wrap gap-2">
                {['#6366f1','#8b5cf6','#ec4899','#ef4444','#f97316','#f59e0b','#10b981','#06b6d4','#3b82f6','#64748b'].map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={`w-8 h-8 rounded-lg border-2 transition-transform hover:scale-110 ${color === c ? 'border-slate-800 dark:border-white scale-110' : 'border-transparent'}`}
                    style={{ backgroundColor: c }}
                    title={c}
                  />
                ))}
              </div>
            </div>

            {/* Preview */}
            <div>
              <Label>Preview</Label>
              <div className="h-14 rounded-xl transition-colors" style={{ backgroundColor: color }} />
              <Helper>Selected: <span className="font-mono font-semibold">{color}</span></Helper>
            </div>
          </div>
        </Section>

        {/* ── 11. Input Groups ─────────────────────────────────────── */}
        <Section title="Input Groups" desc="Prefix and suffix addon combos">
          <div className="space-y-4">
            {/* URL prefix */}
            <div>
              <Label>Website URL</Label>
              <div className="flex rounded-xl overflow-hidden border border-slate-200 dark:border-slate-600 focus-within:border-primary-400 focus-within:ring-2 focus-within:ring-primary-400/20 transition-all">
                <span className="flex items-center px-3 bg-slate-50 dark:bg-slate-700 border-r border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 text-sm font-medium whitespace-nowrap">
                  https://
                </span>
                <input type="text" placeholder="yoursite.com" className="flex-1 px-3 py-2 bg-transparent text-sm text-slate-800 dark:text-slate-200 outline-none" />
              </div>
            </div>

            {/* Price input */}
            <div>
              <Label>Price</Label>
              <div className="flex rounded-xl overflow-hidden border border-slate-200 dark:border-slate-600 focus-within:border-primary-400 focus-within:ring-2 focus-within:ring-primary-400/20 transition-all">
                <span className="flex items-center px-3 bg-slate-50 dark:bg-slate-700 border-r border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 text-sm font-medium">
                  $
                </span>
                <input type="number" placeholder="0.00" className="flex-1 px-3 py-2 bg-transparent text-sm text-slate-800 dark:text-slate-200 outline-none" />
                <span className="flex items-center px-3 bg-slate-50 dark:bg-slate-700 border-l border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 text-sm font-medium">
                  USD
                </span>
              </div>
            </div>

            {/* Email domain */}
            <div>
              <Label>Company Email</Label>
              <div className="flex rounded-xl overflow-hidden border border-slate-200 dark:border-slate-600 focus-within:border-primary-400 focus-within:ring-2 focus-within:ring-primary-400/20 transition-all">
                <span className="flex items-center px-3 bg-slate-50 dark:bg-slate-700 border-r border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400">
                  <AtSign size={15} />
                </span>
                <input type="text" placeholder="username" className="flex-1 px-3 py-2 bg-transparent text-sm text-slate-800 dark:text-slate-200 outline-none" />
                <span className="flex items-center px-3 bg-slate-50 dark:bg-slate-700 border-l border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 text-sm font-medium">
                  @company.com
                </span>
              </div>
            </div>

            {/* Search with button */}
            <div>
              <Label>Search with Action Button</Label>
              <div className="flex gap-0">
                <input
                  type="text"
                  placeholder="Search for products…"
                  className="input rounded-r-none border-r-0 flex-1"
                />
                <button className="btn-gradient rounded-l-none px-4 text-sm font-semibold">
                  Search
                </button>
              </div>
            </div>
          </div>
        </Section>

        {/* ── 12. Floating Labels ──────────────────────────────────── */}
        <Section title="Floating Labels" desc="CSS peer-based animated floating labels">
          <div className="space-y-5">
            {[
              { id: 'fl-name',  label: 'Full Name',    type: 'text',  value: floatName,  onChange: setFloatName,  placeholder: ' ' },
              { id: 'fl-email', label: 'Email Address',type: 'email', value: floatEmail, onChange: setFloatEmail, placeholder: ' ' },
              { id: 'fl-phone', label: 'Phone Number', type: 'tel',   value: floatPhone, onChange: setFloatPhone, placeholder: ' ' },
            ].map(({ id, label, type, value, onChange }) => (
              <div key={id} className="relative">
                <input
                  id={id}
                  type={type}
                  value={value}
                  onChange={e => onChange(e.target.value)}
                  placeholder=" "
                  className="peer input pt-5 pb-1.5"
                />
                <label
                  htmlFor={id}
                  className="absolute left-3 top-3.5 text-sm text-slate-400 dark:text-slate-500 transition-all duration-200 pointer-events-none
                    peer-placeholder-shown:top-3.5 peer-placeholder-shown:text-sm
                    peer-focus:top-1.5 peer-focus:text-[10px] peer-focus:text-primary-500 peer-focus:font-semibold
                    peer-not-placeholder-shown:top-1.5 peer-not-placeholder-shown:text-[10px] peer-not-placeholder-shown:text-primary-500 peer-not-placeholder-shown:font-semibold"
                >
                  {label}
                </label>
              </div>
            ))}
            <Helper>Labels animate upward when the input is focused or filled.</Helper>
          </div>
        </Section>

        {/* ── 13. Validation States ────────────────────────────────── */}
        <Section title="Validation States" desc="Success, error, and warning input feedback" span={2}>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {/* Success */}
            <div>
              <Label>Success State</Label>
              <div className="relative">
                <input
                  type="email"
                  className="input border-emerald-500 focus:ring-emerald-400/30 focus:border-emerald-500 pr-9"
                  defaultValue="user@example.com"
                />
                <InputIcon right>
                  <CheckCircle2 size={15} className="text-emerald-500" />
                </InputIcon>
              </div>
              <div className="flex items-center gap-1.5 mt-1.5">
                <CheckCircle2 size={12} className="text-emerald-500 shrink-0" />
                <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Email address is valid.</p>
              </div>
            </div>

            {/* Error */}
            <div>
              <Label>Error State</Label>
              <div className="relative">
                <input
                  type="text"
                  className="input border-red-400 focus:ring-red-400/30 focus:border-red-400 pr-9"
                  defaultValue="not-an-email"
                />
                <InputIcon right>
                  <X size={15} className="text-red-500" />
                </InputIcon>
              </div>
              <div className="flex items-center gap-1.5 mt-1.5">
                <AlertCircle size={12} className="text-red-500 shrink-0" />
                <p className="text-xs text-red-500 font-medium">Please enter a valid email address.</p>
              </div>
            </div>

            {/* Warning */}
            <div>
              <Label>Warning State</Label>
              <div className="relative">
                <input
                  type="password"
                  className="input border-amber-400 focus:ring-amber-400/30 focus:border-amber-400 pr-9"
                  defaultValue="pass123"
                />
                <InputIcon right>
                  <AlertTriangle size={15} className="text-amber-500" />
                </InputIcon>
              </div>
              <div className="flex items-center gap-1.5 mt-1.5">
                <AlertTriangle size={12} className="text-amber-500 shrink-0" />
                <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">Password is weak. Consider adding symbols.</p>
              </div>
            </div>

            {/* Validation summary */}
            <div className="sm:col-span-3 mt-2">
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle size={16} className="text-red-500 shrink-0" />
                  <p className="text-sm font-semibold text-red-700 dark:text-red-300">Form has 3 validation errors</p>
                </div>
                <ul className="space-y-1">
                  {['Email address format is invalid.', 'Password must be at least 8 characters.', 'Phone number is required.'].map((msg, i) => (
                    <li key={i} className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1.5">
                      <span className="w-1 h-1 rounded-full bg-red-400 shrink-0" />
                      {msg}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </Section>

        {/* ── Tag Input ────────────────────────────────────────────── */}
        <Section title="Tag Input" desc="Press Enter to add a tag, click × to remove">
          <div className="space-y-4">
            <div>
              <Label>Tags</Label>
              <div className="input min-h-10 flex flex-wrap gap-1.5 items-center">
                {tags.map(tag => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 text-xs font-semibold px-2.5 py-1 rounded-full"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => removeTag(tag)}
                      className="text-primary-500 hover:text-primary-700 dark:hover:text-primary-200 transition-colors ml-0.5"
                    >
                      <X size={10} />
                    </button>
                  </span>
                ))}
                <input
                  type="text"
                  value={tagInput}
                  onChange={e => setTagInput(e.target.value)}
                  onKeyDown={addTag}
                  placeholder={tags.length === 0 ? 'Add tags…' : ''}
                  className="flex-1 min-w-24 bg-transparent outline-none text-sm text-slate-800 dark:text-slate-200 placeholder-slate-400"
                />
              </div>
              <Helper>Press <kbd className="px-1 py-0.5 text-xs bg-slate-100 dark:bg-slate-700 rounded border border-slate-200 dark:border-slate-600 font-mono">Enter</kbd> to add a tag.</Helper>
            </div>
          </div>
        </Section>

      </div>{/* end grid */}
    </div>
  )
}
