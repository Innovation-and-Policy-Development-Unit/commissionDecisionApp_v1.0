/**
 * PSC FORM 3-7 — Request to Employ a Temporary Salaried Employee,
 * a Daily Rated Worker or a Contract Employee
 *
 * Multi-step wizard, one step per numbered section of the official form.
 * Rendered inline inside SubmissionForm / SubmissionDetail when form type
 * "PSC 3-7" is selected.
 *
 * Props:
 *   form37    – state object
 *   setForm37 – updater function
 *   showOpscSection – optional; adds a final "OPSC Office Use" step (secretary view)
 *   onSave    – called when Save is clicked on the last step
 *   isSaving  – shows loading state on the Save button
 */
import { useState } from 'react'
import { ChevronLeft, ChevronRight, Check } from 'lucide-react'
import { useToast } from '../../context/ToastContext'

const EMPLOYMENT_TYPES = [
  {
    value: 'temporary_salaried',
    label: 'Temporary Salaried Employee',
    note: 'Generally applicable where there is an established position and a person is required to cover the absence of an officer on leave or to fill a temporary vacancy pending recruitment action — maximum period of employment is 6 months.',
  },
  {
    value: 'daily_rated',
    label: 'Daily Rated Worker',
    note: 'Applicable where there is no established position and the work to be performed by reason of its temporary, fluctuating or special nature does not warrant the employment of a permanent officer — maximum period of employment is 3 years. An approved financial visa is to be attached for proposed periods in excess of 6 months.',
  },
  {
    value: 'contract',
    label: 'Contract Employee',
    note: 'Applicable where it is necessary to employ short-term specialist services; generally where there is no established position and where it is inappropriate for a person to be employed on a permanent basis — maximum period of employment is 6 months. Please complete an Agreement of Service, duly signed by the Director-General and the contractor, and attach to this form.',
  },
]

function baseSteps() {
  return [
    { id: 1, label: 'Employee' },
    { id: 2, label: 'Post' },
    { id: 3, label: 'Reasons' },
    { id: 4, label: 'Selection' },
    { id: 5, label: 'Type' },
    { id: 6, label: 'Period' },
    { id: 7, label: 'Salary' },
    { id: 8, label: 'Director' },
    { id: 9, label: 'DG Endorsement' },
  ]
}

// Required fields per step — must be non-empty to proceed
const STEP_REQUIRED = {
  1: [{ key: 'proposed_employee_name', label: 'Name of Proposed Employee' }],
  8: [{ key: 'director_name', label: 'Name of Director' }],
  9: [{ key: 'dg_name', label: 'Name of Director-General' }],
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

function SectionNote({ children }) {
  return (
    <div className="rounded-md border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 px-4 py-2 text-xs text-amber-700 dark:text-amber-300">
      {children}
    </div>
  )
}

export default function PSCForm37Fields({ form37, setForm37, showOpscSection = false, onSave, isSaving }) {
  const toast = useToast()
  const [step, setStep] = useState(1)
  const [fieldErrors, setFieldErrors] = useState({})

  const STEPS = showOpscSection
    ? [...baseSteps(), { id: 10, label: 'OPSC Office' }]
    : baseSteps()
  const TOTAL_STEPS = STEPS.length

  const set = (field, value) => {
    setForm37(prev => ({ ...prev, [field]: value }))
    if (fieldErrors[field]) setFieldErrors(prev => { const n = { ...prev }; delete n[field]; return n })
  }

  const validateStep = (s) => {
    const errs = {}
    if (STEP_REQUIRED[s]) {
      for (const { key } of STEP_REQUIRED[s]) {
        if (!form37[key] || !String(form37[key]).trim()) errs[key] = true
      }
    }
    if (s === 5 && !form37.employment_type) {
      errs.employment_type = true
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

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden">

      {/* ── Stepper header ── */}
      <div className="px-6 pt-5 pb-4 border-b border-slate-100 dark:border-slate-700">
        <div className="flex items-center">
          {STEPS.map((s, i) => {
            const isDone = s.id < step
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
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Step {step} of {TOTAL_STEPS}</p>
        <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">
          {STEPS.find(s => s.id === step)?.label}
        </h3>
      </div>

      {/* ── Step content ── */}
      <div className="px-6 pb-6 pt-4 space-y-4">

        {/* Step 1 — Proposed Employee */}
        {step === 1 && (
          <Field
            label="Name of Proposed Employee"
            required
            hasError={!!fieldErrors.proposed_employee_name}
            hint="Person is to complete a Job Application (PSC Form 3-2), which is to be attached."
          >
            <input
              className="input"
              value={form37.proposed_employee_name || ''}
              onChange={e => set('proposed_employee_name', e.target.value)}
              placeholder="Full name"
            />
          </Field>
        )}

        {/* Step 2 — Established Post */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="flex items-center gap-6">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Is the person to be employed in an established post?</span>
              <label className="flex items-center gap-1.5 cursor-pointer text-sm">
                <input
                  type="radio"
                  name="is_established_post"
                  checked={form37.is_established_post === true}
                  onChange={() => set('is_established_post', true)}
                />
                Yes
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer text-sm">
                <input
                  type="radio"
                  name="is_established_post"
                  checked={form37.is_established_post === false}
                  onChange={() => set('is_established_post', false)}
                />
                No
              </label>
            </div>

            {form37.is_established_post && (
              <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 p-4 space-y-3">
                <p className="text-xs text-slate-500 dark:text-slate-400">Please attach a copy of the approved job description form.</p>
                <Field label="Post Title">
                  <input
                    className="input"
                    value={form37.post_title || ''}
                    onChange={e => set('post_title', e.target.value)}
                  />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Post Number">
                    <input
                      className="input"
                      value={form37.post_number || ''}
                      onChange={e => set('post_number', e.target.value)}
                    />
                  </Field>
                  <Field label="Post Level">
                    <input
                      className="input"
                      value={form37.post_level || ''}
                      onChange={e => set('post_level', e.target.value)}
                    />
                  </Field>
                </div>
              </div>
            )}

            {form37.is_established_post === false && (
              <SectionNote>
                If not an established post, please prepare a draft job description and attach to this request form.
              </SectionNote>
            )}
          </div>
        )}

        {/* Step 3 — Reasons for Employment */}
        {step === 3 && (
          <Field label="Reasons why it is necessary to employ this additional staff member">
            <textarea
              className="input min-h-[120px]"
              value={form37.reasons_for_employment || ''}
              onChange={e => set('reasons_for_employment', e.target.value)}
            />
          </Field>
        )}

        {/* Step 4 — Selection */}
        {step === 4 && (
          <Field label="How was the proposed employee selected?">
            <textarea
              className="input min-h-[100px]"
              value={form37.how_selected || ''}
              onChange={e => set('how_selected', e.target.value)}
            />
          </Field>
        )}

        {/* Step 5 — Employment Type */}
        {step === 5 && (
          <div className="space-y-3">
            {fieldErrors.employment_type && (
              <p className="text-xs text-red-500 dark:text-red-400">Please select an employment type.</p>
            )}
            {EMPLOYMENT_TYPES.map(opt => (
              <label
                key={opt.value}
                className={`flex gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  form37.employment_type === opt.value
                    ? 'border-blue-400 dark:border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : fieldErrors.employment_type
                      ? 'border-red-300 dark:border-red-700'
                      : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                }`}
              >
                <input
                  type="radio"
                  name="employment_type"
                  value={opt.value}
                  checked={form37.employment_type === opt.value}
                  onChange={() => set('employment_type', opt.value)}
                  className="mt-0.5 shrink-0"
                />
                <div>
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{opt.label}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{opt.note}</p>
                </div>
              </label>
            ))}
          </div>
        )}

        {/* Step 6 — Period of Employment */}
        {step === 6 && (
          <div className="space-y-4">
            <SectionNote>
              Employee must not commence duty prior to obtaining the approval of the OPSC.
            </SectionNote>
            <div className="grid grid-cols-2 gap-4">
              <Field label="From">
                <input
                  type="date"
                  className="input"
                  value={form37.period_from || ''}
                  onChange={e => set('period_from', e.target.value)}
                />
              </Field>
              <Field label="To">
                <input
                  type="date"
                  className="input"
                  value={form37.period_to || ''}
                  onChange={e => set('period_to', e.target.value)}
                />
              </Field>
            </div>
          </div>
        )}

        {/* Step 7 — Salary */}
        {step === 7 && (
          <div className="grid grid-cols-2 gap-4">
            <Field label="Salary Level (VT)" hint="Enter the VT amount">
              <input
                className="input"
                placeholder="e.g. 25,000"
                value={form37.salary_vt || ''}
                onChange={e => set('salary_vt', e.target.value)}
              />
            </Field>
            <Field label="Salary Scale" hint="Insert relevant salary scale e.g. P12.1 or C2.2">
              <input
                className="input"
                placeholder="e.g. P12.1 or C2.2"
                value={form37.salary_scale || ''}
                onChange={e => set('salary_scale', e.target.value)}
              />
            </Field>
          </div>
        )}

        {/* Step 8 — Director Certification */}
        {step === 8 && (
          <div className="space-y-4">
            <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 p-4 text-xs text-slate-600 dark:text-slate-400">
              <p className="font-medium mb-1">I hereby certify that:</p>
              <ol className="list-decimal list-inside space-y-1">
                <li>The employment of this person is essential for the Department to maintain an adequate level of service delivery to our clients;</li>
                <li>Funds are available to cover the cost of salary for the full period of the proposed period of employment.</li>
              </ol>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Name of Director" required hasError={!!fieldErrors.director_name}>
                <input
                  className="input"
                  value={form37.director_name || ''}
                  onChange={e => set('director_name', e.target.value)}
                />
              </Field>
              <Field label="Name of Department">
                <input
                  className="input"
                  value={form37.director_department || ''}
                  onChange={e => set('director_department', e.target.value)}
                />
              </Field>
              <Field label="Date">
                <input
                  type="date"
                  className="input"
                  value={form37.director_date || ''}
                  onChange={e => set('director_date', e.target.value)}
                />
              </Field>
            </div>
          </div>
        )}

        {/* Step 9 — Director-General Endorsement */}
        {step === 9 && (
          <div className="space-y-4">
            <p className="text-xs text-slate-500 dark:text-slate-400 italic">I support the Director's request.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Name of Director-General" required hasError={!!fieldErrors.dg_name}>
                <input
                  className="input"
                  value={form37.dg_name || ''}
                  onChange={e => set('dg_name', e.target.value)}
                />
              </Field>
              <Field label="Name of Ministry">
                <input
                  className="input"
                  value={form37.dg_ministry || ''}
                  onChange={e => set('dg_ministry', e.target.value)}
                />
              </Field>
              <Field label="Date">
                <input
                  type="date"
                  className="input"
                  value={form37.dg_date || ''}
                  onChange={e => set('dg_date', e.target.value)}
                />
              </Field>
            </div>
          </div>
        )}

        {/* Step 10 — OPSC Office Use Only (secretary view only) */}
        {step === 10 && showOpscSection && (
          <div className="space-y-4">
            <p className="text-xs text-slate-500 dark:text-slate-400">To be completed by the Secretary, OPSC.</p>
            <div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Approved?</p>
              <div className="flex gap-6">
                <label className="flex items-center gap-1.5 cursor-pointer text-sm">
                  <input
                    type="radio"
                    name="approved"
                    checked={form37.approved === true}
                    onChange={() => set('approved', true)}
                  />
                  Yes
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer text-sm">
                  <input
                    type="radio"
                    name="approved"
                    checked={form37.approved === false}
                    onChange={() => set('approved', false)}
                  />
                  No
                </label>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Secretary Name">
                <input
                  className="input"
                  value={form37.secretary_name || ''}
                  onChange={e => set('secretary_name', e.target.value)}
                />
              </Field>
              <Field label="Secretary Date">
                <input
                  type="date"
                  className="input"
                  value={form37.secretary_date || ''}
                  onChange={e => set('secretary_date', e.target.value)}
                />
              </Field>
              <Field label="Ministry Advised of Decision On">
                <input
                  type="date"
                  className="input"
                  value={form37.ministry_advised_date || ''}
                  onChange={e => set('ministry_advised_date', e.target.value)}
                />
              </Field>
              <Field label="Job Offer Letter Issued & Copy Forwarded On">
                <input
                  type="date"
                  className="input"
                  value={form37.job_offer_letter_date || ''}
                  onChange={e => set('job_offer_letter_date', e.target.value)}
                />
              </Field>
              <Field label="Signed Agreement of Service Forwarded to Ministry On">
                <input
                  type="date"
                  className="input"
                  value={form37.agreement_service_date || ''}
                  onChange={e => set('agreement_service_date', e.target.value)}
                />
              </Field>
            </div>
          </div>
        )}
      </div>

      {/* ── Navigation footer ── */}
      <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={handleBack}
          disabled={step === 1}
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft size={15} />
          Back
        </button>

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
            {isSaving ? 'Saving…' : 'Save Form 3-7'}
          </button>
        ) : (
          <div className="w-20" />
        )}
      </div>
    </div>
  )
}
