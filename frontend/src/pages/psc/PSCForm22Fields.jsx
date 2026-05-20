/**
 * PSC FORM 2-2 — Job Description
 *
 * Multi-step wizard. 7 steps matching the sections of the official form.
 * Props:
 *   form       – values object (keys match XML field_key values)
 *   setForm    – state updater
 *   submission – submission object (for auto-populating ministry/department)
 *   readOnly   – render as read-only display when true
 *   onSave     – called when Save is clicked on the last step
 *   isSaving   – shows loading state on the Save button
 */
import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Check } from 'lucide-react'
import { useToast } from '../../context/ToastContext'

const STEPS = [
  { id: 1, label: 'Post ID' },
  { id: 2, label: 'Duties' },
  { id: 3, label: 'Reporting' },
  { id: 4, label: 'Contacts' },
  { id: 5, label: 'Impact' },
  { id: 6, label: 'Qualifications' },
  { id: 7, label: 'Endorsement' },
]

const TOTAL_STEPS = STEPS.length

const DUTY_KEYS = Array.from({ length: 9 }, (_, i) => `duty_7_${i + 1}`)

const APPROVAL_REASONS = [
  'Routine Revision of Existing Job Description',
  'New Post',
  'Regrading (Upgrade)',
  'Regrading (Downgrade)',
  'Other',
]

const PSC_DECISIONS = ['Approved', 'Deferred', 'Amended']

// Required fields per step — must be non-empty to proceed
const STEP_REQUIRED = {
  1: [{ key: 'job_title_location', label: 'Job Title & Location' }, { key: 'level_grade', label: 'Level / Grade' }],
  2: [], // validated specially (at least 1 duty)
  5: [{ key: 'reason_for_approval', label: 'Reason for Approval' }],
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function SectionHeader({ title }) {
  return (
    <div className="mt-6 mb-3 pb-1 border-b border-slate-200 dark:border-slate-700">
      <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {title}
      </h3>
    </div>
  )
}

function Field({ label, children, hint, required, hasError }) {
  return (
    <div>
      <label className={`block text-sm font-medium mb-1 ${hasError ? 'text-red-600 dark:text-red-400' : 'text-slate-700 dark:text-slate-300'}`}>
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <div className={hasError ? 'rounded-lg ring-2 ring-red-400 dark:ring-red-500' : ''}>
        {children}
      </div>
      {hasError
        ? <p className="mt-1 text-xs text-red-500 dark:text-red-400">This field is required.</p>
        : hint
          ? <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{hint}</p>
          : null}
    </div>
  )
}

function ReadField({ label, value, span }) {
  return (
    <div className={span ? 'col-span-2' : ''}>
      <p className="text-[11px] text-slate-400 dark:text-slate-500 mb-0.5">{label}</p>
      <p className="text-sm font-medium text-slate-800 dark:text-slate-100 whitespace-pre-wrap break-words">
        {value || <span className="text-slate-400 dark:text-slate-500 font-normal italic">—</span>}
      </p>
    </div>
  )
}

function fmt(dateStr) {
  if (!dateStr) return null
  return new Date(dateStr).toLocaleDateString('en-VU', { day: '2-digit', month: 'short', year: 'numeric' })
}

function activeDutyCount(form) {
  return DUTY_KEYS.filter(k => form[k] && form[k].trim()).length
}

function nextEmptyDutyIndex(form) {
  for (let i = 0; i < DUTY_KEYS.length; i++) {
    if (!form[DUTY_KEYS[i]] || !form[DUTY_KEYS[i]].trim()) return i + 1
  }
  return null
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function PSCForm22Fields({ form, setForm, submission, readOnly = false, onSave, isSaving }) {
  const toast = useToast()
  const [step, setStep] = useState(1)
  const [fieldErrors, setFieldErrors] = useState({})
  const [visibleDuties, setVisibleDuties] = useState(1)

  const set = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }))
    if (fieldErrors[field]) setFieldErrors(prev => { const n = { ...prev }; delete n[field]; return n })
  }

  // Auto-populate fields on mount
  useEffect(() => {
    setForm(prev => {
      const updates = {}
      if (!prev.ministry && submission?.ministry_name) updates.ministry = submission.ministry_name
      if (!prev.department && submission?.department?.name) updates.department = submission.department.name
      if (!prev.qualification_language) updates.qualification_language = 'English or French and Bislama'
      if (prev.qualification_good_character === undefined || prev.qualification_good_character === null) {
        updates.qualification_good_character = true
      }
      return Object.keys(updates).length ? { ...prev, ...updates } : prev
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Compute visible duty rows: show all filled rows + 1 empty row
  useEffect(() => {
    const filled = activeDutyCount(form)
    setVisibleDuties(prev => Math.max(prev, filled + 1, 1))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── ReadOnly mode ────────────────────────────────────────────────────────────
  if (readOnly) {
    const duties = DUTY_KEYS.filter(k => form[k] && form[k].trim())
    return (
      <div className="space-y-6 text-sm">
        <div>
          <SectionHeader title="Post Identification" />
          <div className="grid grid-cols-2 gap-4">
            <ReadField label="Job Title & Location" value={form.job_title_location} span />
            <ReadField label="Level / Grade" value={form.level_grade} />
            <ReadField label="Post Number" value={form.post_number} />
            <ReadField label="Ministry" value={form.ministry} />
            <ReadField label="Department" value={form.department} />
            <ReadField label="Post Purpose" value={form.post_purpose} span />
          </div>
        </div>

        <div>
          <SectionHeader title="Duties" />
          {duties.length === 0
            ? <p className="text-sm text-slate-400 italic">No duties recorded.</p>
            : (
              <ol className="list-decimal list-inside space-y-2">
                {duties.map((k) => (
                  <li key={k} className="text-sm text-slate-700 dark:text-slate-300">{form[k]}</li>
                ))}
              </ol>
            )
          }
        </div>

        <div>
          <SectionHeader title="Reporting & Supervision" />
          <div className="grid grid-cols-2 gap-4">
            <ReadField label="Reports Directly To" value={form.reports_directly_to} />
            <ReadField label="Directly Supervises" value={form.directly_supervises} />
          </div>
        </div>

        <div>
          <SectionHeader title="Contacts" />
          <div className="grid grid-cols-2 gap-4">
            <ReadField label="Frequent Internal Contacts" value={form.frequent_internal_contacts} />
            <ReadField label="Occasional Internal Contacts" value={form.occasional_internal_contacts} />
            <ReadField label="Frequent External Contacts" value={form.frequent_external_contacts} />
            <ReadField label="Occasional External Contacts" value={form.occasional_external_contacts} />
          </div>
        </div>

        <div>
          <SectionHeader title="Impact & Conditions" />
          <div className="grid grid-cols-2 gap-4">
            <ReadField label="Regular Decisions / Impact" value={form.impact_decisions_regular} span />
            <ReadField label="Financial Delegation" value={form.financial_delegation} />
            <ReadField label="Special Conditions" value={form.special_conditions} span />
            <ReadField label="Reason for Approval" value={form.reason_for_approval} />
            {form.reason_for_approval === 'Other' && (
              <ReadField label="Approval Reason Detail" value={form.approval_reason_detail} span />
            )}
          </div>
        </div>

        <div>
          <SectionHeader title="Qualifications" />
          <div className="grid grid-cols-2 gap-4">
            <ReadField label="Experience" value={form.qualification_experience} span />
            <ReadField label="Special Skills" value={form.qualification_special_skills} span />
            <ReadField label="Education" value={form.qualification_education} span />
            <ReadField label="Language" value={form.qualification_language} />
            <div>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 mb-0.5">Good Character</p>
              <p className={`text-sm font-medium ${form.qualification_good_character ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 italic'}`}>
                {form.qualification_good_character ? '✓ Required' : '—'}
              </p>
            </div>
          </div>
        </div>

        <div>
          <SectionHeader title="Endorsement" />
          <div className="grid grid-cols-2 gap-4">
            <ReadField label="Prepared by" value={form.prepared_by_name} />
            <ReadField label="Date" value={fmt(form.prepared_by_date)} />
            <ReadField label="Certified by DG" value={form.certified_dg_name} />
            <ReadField label="DG Certified Date" value={fmt(form.certified_dg_date)} />
          </div>
          {(form.psc_checked_by_name || form.psc_decision) && (
            <div className="mt-4 rounded-lg border border-dashed border-slate-300 dark:border-slate-600 p-3 space-y-2">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">PSC Review</p>
              <div className="grid grid-cols-2 gap-3">
                <ReadField label="Checked by" value={form.psc_checked_by_name} />
                <ReadField label="Date" value={fmt(form.psc_checked_date)} />
                <ReadField label="Decision" value={form.psc_decision} />
                <ReadField label="Decision Date" value={fmt(form.psc_decision_date)} />
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── Validation ───────────────────────────────────────────────────────────────

  const validateStep = (s) => {
    const errs = {}
    if (STEP_REQUIRED[s]) {
      for (const { key } of STEP_REQUIRED[s]) {
        if (!form[key] || !String(form[key]).trim()) errs[key] = true
      }
    }
    if (s === 2 && activeDutyCount(form) === 0) {
      errs['duty_7_1'] = true
    }
    setFieldErrors(errs)
    if (Object.keys(errs).length > 0) toast.warning('Please fill in all required fields before continuing.')
    return Object.keys(errs).length === 0
  }

  const handleNext = () => {
    if (!validateStep(step)) return
    setFieldErrors({})
    setStep(s => Math.min(s + 1, TOTAL_STEPS))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleBack = () => {
    setFieldErrors({})
    setStep(s => Math.max(s - 1, 1))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleSave = () => {
    if (!validateStep(step)) return
    onSave?.()
  }

  // ── Duty helpers ─────────────────────────────────────────────────────────────

  const handleAddDuty = () => {
    const next = nextEmptyDutyIndex(form)
    if (next && next <= 9) setVisibleDuties(prev => Math.min(prev + 1, 9))
  }

  const handleRemoveDuty = (keyIndex) => {
    setForm(prev => {
      const updated = { ...prev }
      for (let i = keyIndex; i < DUTY_KEYS.length - 1; i++) {
        updated[DUTY_KEYS[i]] = prev[DUTY_KEYS[i + 1]] || ''
      }
      updated[DUTY_KEYS[DUTY_KEYS.length - 1]] = ''
      return updated
    })
    setVisibleDuties(prev => Math.max(prev - 1, 1))
  }

  const shownDutyKeys = DUTY_KEYS.slice(0, Math.min(visibleDuties, 9))

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden">

      {/* ── Stepper header ── */}
      <div className="px-6 pt-5 pb-4 border-b border-slate-100 dark:border-slate-700">
        <div className="flex items-center">
          {STEPS.map((s, i) => {
            const isDone   = s.id < step
            const isActive = s.id === step
            return (
              <div key={s.id} className="flex items-center flex-1 last:flex-none">
                <button
                  type="button"
                  onClick={() => { if (isDone) { setFieldErrors({}); setStep(s.id) } }}
                  className={`relative flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-all ${
                    isDone
                      ? 'bg-primary-500 text-white cursor-pointer hover:bg-primary-600'
                      : isActive
                        ? 'bg-primary-600 text-white ring-4 ring-primary-100 dark:ring-primary-900/40'
                        : 'bg-slate-100 dark:bg-slate-700 text-slate-400 cursor-default'
                  }`}
                  title={s.label}
                  disabled={!isDone && !isActive}
                >
                  {isDone ? <Check size={13} /> : s.id}
                </button>
                {i < STEPS.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-1 transition-colors ${s.id < step ? 'bg-primary-500' : 'bg-slate-200 dark:bg-slate-700'}`} />
                )}
              </div>
            )
          })}
        </div>
        {/* Step labels */}
        <div className="flex mt-2">
          {STEPS.map(s => (
            <div key={s.id} className="flex-1 last:flex-none pr-1">
              <p className={`text-[11px] text-center leading-tight line-clamp-1 ${
                s.id === step
                  ? 'text-primary-600 dark:text-primary-400 font-semibold'
                  : s.id < step
                    ? 'text-slate-500 dark:text-slate-400'
                    : 'text-slate-300 dark:text-slate-600'
              }`}>
                {s.label}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Step counter + section title ── */}
      <div className="px-6 pt-5 pb-2">
        <p className="text-xs text-slate-400 dark:text-slate-500 mb-1">Step {step} of {TOTAL_STEPS}</p>
        <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">
          {STEPS.find(s => s.id === step)?.label}
        </h3>
      </div>

      {/* ── Step content ── */}
      <div className="px-6 pb-6 pt-4 space-y-4">

        {/* Step 1 — Post Identification */}
        {step === 1 && (
          <div className="space-y-4">
            <Field label="Job Title & Location" required hint="e.g. Senior HR Officer — Port Vila" hasError={!!fieldErrors.job_title_location}>
              <input
                className="input"
                value={form.job_title_location || ''}
                onChange={e => set('job_title_location', e.target.value)}
                placeholder="e.g. Senior HR Officer — Port Vila"
              />
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Level / Grade" required hasError={!!fieldErrors.level_grade}>
                <input
                  className="input"
                  value={form.level_grade || ''}
                  onChange={e => set('level_grade', e.target.value)}
                  placeholder="e.g. P8"
                />
              </Field>
              <Field label="Post Number">
                <input
                  className="input"
                  value={form.post_number || ''}
                  onChange={e => set('post_number', e.target.value)}
                  placeholder="e.g. MHA/HR/001"
                />
              </Field>
              <Field label="Ministry">
                <input
                  className="input"
                  value={form.ministry || ''}
                  onChange={e => set('ministry', e.target.value)}
                />
              </Field>
              <Field label="Department">
                <input
                  className="input"
                  value={form.department || ''}
                  onChange={e => set('department', e.target.value)}
                />
              </Field>
            </div>
            <Field label="Post Purpose" hint="A brief statement of the primary purpose of this post.">
              <textarea
                className="input min-h-[100px]"
                value={form.post_purpose || ''}
                onChange={e => set('post_purpose', e.target.value)}
                placeholder="Describe the primary purpose of the position..."
              />
            </Field>
          </div>
        )}

        {/* Step 2 — Duties */}
        {step === 2 && (
          <div className="space-y-3">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              List the key duties and responsibilities of this position. Up to 9 duties may be entered.
            </p>
            {fieldErrors.duty_7_1 && (
              <p className="text-xs text-red-500 dark:text-red-400">At least one duty is required.</p>
            )}
            {shownDutyKeys.map((key, idx) => (
              <div key={key} className="flex items-start gap-2">
                <span className="inline-flex items-center justify-center w-6 h-6 mt-2 rounded-full bg-slate-100 dark:bg-slate-700 text-[11px] font-bold text-slate-500 dark:text-slate-400 shrink-0">
                  {idx + 1}
                </span>
                <textarea
                  className="input min-h-[60px] flex-1"
                  value={form[key] || ''}
                  onChange={e => set(key, e.target.value)}
                  placeholder={`Duty ${idx + 1}...`}
                />
                {shownDutyKeys.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveDuty(idx)}
                    className="mt-2 p-1.5 rounded-md text-slate-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors shrink-0"
                    title="Remove this duty"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
            {shownDutyKeys.length < 9 && (
              <button
                type="button"
                onClick={handleAddDuty}
                className="inline-flex items-center gap-1.5 text-sm text-primary-600 dark:text-primary-400 hover:underline"
              >
                + Add duty
              </button>
            )}
          </div>
        )}

        {/* Step 3 — Reporting */}
        {step === 3 && (
          <div className="space-y-4">
            <Field label="Reports Directly To" hint="The position or title of the immediate supervisor.">
              <input
                className="input"
                value={form.reports_directly_to || ''}
                onChange={e => set('reports_directly_to', e.target.value)}
                placeholder="e.g. Director of Human Resources"
              />
            </Field>
            <Field label="Directly Supervises" hint="Positions or staff directly supervised by this post.">
              <textarea
                className="input min-h-[100px]"
                value={form.directly_supervises || ''}
                onChange={e => set('directly_supervises', e.target.value)}
                placeholder="List positions supervised, or 'None' if not applicable..."
              />
            </Field>
          </div>
        )}

        {/* Step 4 — Contacts */}
        {step === 4 && (
          <div className="space-y-4">
            <div className="rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 px-4 py-2 text-xs text-slate-600 dark:text-slate-400">
              "Frequent" = regular, ongoing contact as part of normal duties. "Occasional" = periodic or as-needed contact.
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Frequent Internal Contacts" hint="Within the ministry / department.">
                <textarea
                  className="input min-h-[80px]"
                  value={form.frequent_internal_contacts || ''}
                  onChange={e => set('frequent_internal_contacts', e.target.value)}
                  placeholder="e.g. Director-General, Finance Officers..."
                />
              </Field>
              <Field label="Occasional Internal Contacts">
                <textarea
                  className="input min-h-[80px]"
                  value={form.occasional_internal_contacts || ''}
                  onChange={e => set('occasional_internal_contacts', e.target.value)}
                  placeholder="e.g. Legal unit, IT team..."
                />
              </Field>
              <Field label="Frequent External Contacts" hint="Outside the ministry / government agencies, public, etc.">
                <textarea
                  className="input min-h-[80px]"
                  value={form.frequent_external_contacts || ''}
                  onChange={e => set('frequent_external_contacts', e.target.value)}
                  placeholder="e.g. PSC, Ministry of Finance..."
                />
              </Field>
              <Field label="Occasional External Contacts">
                <textarea
                  className="input min-h-[80px]"
                  value={form.occasional_external_contacts || ''}
                  onChange={e => set('occasional_external_contacts', e.target.value)}
                  placeholder="e.g. International agencies, donors..."
                />
              </Field>
            </div>
          </div>
        )}

        {/* Step 5 — Impact */}
        {step === 5 && (
          <div className="space-y-4">
            <Field label="Regular Decisions / Impact" hint="Describe the types of decisions made regularly and their impact.">
              <textarea
                className="input min-h-[100px]"
                value={form.impact_decisions_regular || ''}
                onChange={e => set('impact_decisions_regular', e.target.value)}
                placeholder="e.g. Advises on staffing decisions affecting..."
              />
            </Field>
            <Field label="Financial Delegation" hint="Enter financial delegation amount, or 'None'.">
              <input
                className="input"
                value={form.financial_delegation || ''}
                onChange={e => set('financial_delegation', e.target.value)}
                placeholder="e.g. VT 500,000 or None"
              />
            </Field>
            <Field label="Special Conditions" hint="Any special working conditions, travel requirements, etc.">
              <textarea
                className="input min-h-[80px]"
                value={form.special_conditions || ''}
                onChange={e => set('special_conditions', e.target.value)}
                placeholder="e.g. Field travel required, on-call roster..."
              />
            </Field>

            <Field label="Reason for Approval of this Job Description" required hasError={!!fieldErrors.reason_for_approval}>
              <div className="space-y-2 p-1">
                {APPROVAL_REASONS.map(reason => (
                  <label
                    key={reason}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      form.reason_for_approval === reason
                        ? 'border-primary-400 dark:border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                        : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                    }`}
                  >
                    <input
                      type="radio"
                      name="reason_for_approval"
                      value={reason}
                      checked={form.reason_for_approval === reason}
                      onChange={() => set('reason_for_approval', reason)}
                      className="shrink-0"
                    />
                    <span className="text-sm text-slate-800 dark:text-slate-200">{reason}</span>
                  </label>
                ))}
              </div>
            </Field>

            {form.reason_for_approval === 'Other' && (
              <Field label="Please specify the reason">
                <textarea
                  className="input min-h-[80px]"
                  value={form.approval_reason_detail || ''}
                  onChange={e => set('approval_reason_detail', e.target.value)}
                  placeholder="Describe the reason for this submission..."
                />
              </Field>
            )}
          </div>
        )}

        {/* Step 6 — Qualifications */}
        {step === 6 && (
          <div className="space-y-4">
            <Field label="Experience" hint="Minimum relevant work experience required.">
              <textarea
                className="input min-h-[80px]"
                value={form.qualification_experience || ''}
                onChange={e => set('qualification_experience', e.target.value)}
                placeholder="e.g. Minimum 3 years in HR management..."
              />
            </Field>
            <Field label="Special Skills" hint="Technical or specialist skills required.">
              <textarea
                className="input min-h-[80px]"
                value={form.qualification_special_skills || ''}
                onChange={e => set('qualification_special_skills', e.target.value)}
                placeholder="e.g. Proficiency in SAP, data analysis..."
              />
            </Field>
            <Field label="Education" hint="Minimum formal education or qualifications required.">
              <textarea
                className="input min-h-[80px]"
                value={form.qualification_education || ''}
                onChange={e => set('qualification_education', e.target.value)}
                placeholder="e.g. Bachelor's degree in Public Administration..."
              />
            </Field>
            <Field label="Language" hint="Language proficiency requirements.">
              <input
                className="input"
                value={form.qualification_language || ''}
                onChange={e => set('qualification_language', e.target.value)}
                placeholder="English or French and Bislama"
              />
            </Field>
            <label className="flex items-start gap-3 cursor-pointer rounded-lg border border-slate-200 dark:border-slate-700 p-3">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                checked={!!form.qualification_good_character}
                onChange={e => set('qualification_good_character', e.target.checked)}
              />
              <div>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Good Character</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  The successful applicant must be of good character. This requirement applies to all positions in the Public Service.
                </p>
              </div>
            </label>
          </div>
        )}

        {/* Step 7 — Endorsement */}
        {step === 7 && (
          <div className="space-y-5">
            <div>
              <SectionHeader title="Prepared by Ministry / Department" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Name">
                  <input
                    className="input"
                    value={form.prepared_by_name || ''}
                    onChange={e => set('prepared_by_name', e.target.value)}
                  />
                </Field>
                <Field label="Date">
                  <input type="date" className="input" value={form.prepared_by_date || ''} onChange={e => set('prepared_by_date', e.target.value)} />
                </Field>
              </div>
            </div>

            <div>
              <SectionHeader title="Certified by Director-General" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Director-General Name">
                  <input
                    className="input"
                    value={form.certified_dg_name || ''}
                    onChange={e => set('certified_dg_name', e.target.value)}
                  />
                </Field>
                <Field label="Date">
                  <input type="date" className="input" value={form.certified_dg_date || ''} onChange={e => set('certified_dg_date', e.target.value)} />
                </Field>
              </div>
            </div>

            <div>
              <div className="rounded-lg border border-dashed border-slate-300 dark:border-slate-600 p-4 space-y-4">
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                  PSC Review — To be completed by PSC
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Checked by (PSC Officer)">
                    <input className="input" value={form.psc_checked_by_name || ''} onChange={e => set('psc_checked_by_name', e.target.value)} />
                  </Field>
                  <Field label="Date Checked">
                    <input type="date" className="input" value={form.psc_checked_date || ''} onChange={e => set('psc_checked_date', e.target.value)} />
                  </Field>
                </div>
                <Field label="PSC Decision">
                  <div className="flex gap-4">
                    {PSC_DECISIONS.map(dec => (
                      <label key={dec} className="flex items-center gap-2 cursor-pointer text-sm">
                        <input type="radio" name="psc_decision" value={dec} checked={form.psc_decision === dec} onChange={() => set('psc_decision', dec)} />
                        {dec}
                      </label>
                    ))}
                  </div>
                </Field>
                <Field label="Decision Date">
                  <input type="date" className="input" value={form.psc_decision_date || ''} onChange={e => set('psc_decision_date', e.target.value)} />
                </Field>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Navigation footer ── */}
      <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between gap-4">
        {/* Back */}
        <button
          type="button"
          onClick={handleBack}
          disabled={step === 1}
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft size={15} />
          Back
        </button>

        {/* Dot indicators */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {STEPS.map(s => (
            <div
              key={s.id}
              className={`rounded-full transition-all duration-200 ${
                s.id === step
                  ? 'w-5 h-2 bg-primary-500'
                  : s.id < step
                    ? 'w-2 h-2 bg-primary-300 dark:bg-primary-700'
                    : 'w-2 h-2 bg-slate-200 dark:bg-slate-700'
              }`}
            />
          ))}
        </div>

        {/* Next / Save */}
        {step < TOTAL_STEPS ? (
          <button
            type="button"
            onClick={handleNext}
            className="inline-flex items-center gap-1 text-sm font-medium bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg transition-colors"
          >
            Next
            <ChevronRight size={15} />
          </button>
        ) : onSave ? (
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="inline-flex items-center gap-1 text-sm font-medium bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isSaving ? 'Saving…' : 'Save Form'}
          </button>
        ) : (
          <div className="w-20" />
        )}
      </div>
    </div>
  )
}
