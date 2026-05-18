/**
 * PSC FORM 2-2 — Job Description
 *
 * Editable tabbed form. 7 tabs matching the sections of the official form.
 * Props:
 *   form       – values object (keys match XML field_key values)
 *   setForm    – state updater
 *   submission – submission object (for auto-populating ministry/department)
 *   readOnly   – render as read-only display when true
 */
import { useEffect, useState } from 'react'

const TABS = [
  { id: 1, label: 'Post ID' },
  { id: 2, label: 'Duties' },
  { id: 3, label: 'Reporting' },
  { id: 4, label: 'Contacts' },
  { id: 5, label: 'Impact' },
  { id: 6, label: 'Qualifications' },
  { id: 7, label: 'Endorsement' },
]

const DUTY_KEYS = Array.from({ length: 9 }, (_, i) => `duty_7_${i + 1}`)

const APPROVAL_REASONS = [
  'Routine Revision of Existing Job Description',
  'New Post',
  'Regrading (Upgrade)',
  'Regrading (Downgrade)',
  'Other',
]

const PSC_DECISIONS = ['Approved', 'Deferred', 'Amended']

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

function Field({ label, children, hint, required }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{hint}</p>}
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

// Count how many duty keys have values
function activeDutyCount(form) {
  return DUTY_KEYS.filter(k => form[k] && form[k].trim()).length
}

// Get the index (1-based) of the next empty duty slot
function nextEmptyDutyIndex(form) {
  for (let i = 0; i < DUTY_KEYS.length; i++) {
    if (!form[DUTY_KEYS[i]] || !form[DUTY_KEYS[i]].trim()) return i + 1
  }
  return null
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function PSCForm22Fields({ form, setForm, submission, readOnly = false }) {
  const [activeTab, setActiveTab] = useState(1)
  // Number of visible duty rows (at least 1, at most 9)
  const [visibleDuties, setVisibleDuties] = useState(1)

  const set = (field, value) => setForm(prev => ({ ...prev, [field]: value }))

  // Auto-populate fields on mount
  useEffect(() => {
    setForm(prev => {
      const updates = {}
      if (!prev.ministry && submission?.ministry_name) {
        updates.ministry = submission.ministry_name
      }
      if (!prev.department && submission?.department?.name) {
        updates.department = submission.department.name
      }
      if (!prev.qualification_language) {
        updates.qualification_language = 'English or French and Bislama'
      }
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
                {duties.map((k, idx) => (
                  <li key={k} className="text-sm text-slate-700 dark:text-slate-300">
                    {form[k]}
                  </li>
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

  // ── Editable mode — tabbed ────────────────────────────────────────────────────

  const handleAddDuty = () => {
    const next = nextEmptyDutyIndex(form)
    if (next && next <= 9) {
      setVisibleDuties(prev => Math.min(prev + 1, 9))
    }
  }

  const handleRemoveDuty = (keyIndex) => {
    // Shift all duties down by one from keyIndex onwards
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

  return (
    <div className="space-y-0">
      {/* Tab navigation */}
      <div className="overflow-x-auto">
        <div className="flex min-w-max border-b border-slate-200 dark:border-slate-700">
          {TABS.map(tab => {
            const isActive = tab.id === activeTab
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap border-b-2 -mb-px ${
                  isActive
                    ? 'border-primary-600 text-primary-700 dark:text-primary-400 dark:border-primary-400'
                    : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600'
                }`}
              >
                <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[11px] font-bold ${
                  isActive
                    ? 'bg-primary-600 text-white dark:bg-primary-400 dark:text-slate-900'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                }`}>
                  {tab.id}
                </span>
                {tab.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Tab content */}
      <div className="p-1 pt-5 space-y-4">

        {/* Tab 1 — Post Identification */}
        {activeTab === 1 && (
          <div className="space-y-4">
            <Field label="Job Title & Location" required>
              <input
                className="input"
                value={form.job_title_location || ''}
                onChange={e => set('job_title_location', e.target.value)}
                placeholder="e.g. Senior HR Officer — Port Vila"
              />
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Level / Grade" required>
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

        {/* Tab 2 — Duties */}
        {activeTab === 2 && (
          <div className="space-y-3">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              List the key duties and responsibilities of this position. Up to 9 duties may be entered.
            </p>
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

        {/* Tab 3 — Reporting */}
        {activeTab === 3 && (
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

        {/* Tab 4 — Contacts */}
        {activeTab === 4 && (
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

        {/* Tab 5 — Impact */}
        {activeTab === 5 && (
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

            <Field label="Reason for Approval of this Job Description" required>
              <div className="space-y-2">
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

        {/* Tab 6 — Qualifications */}
        {activeTab === 6 && (
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

        {/* Tab 7 — Endorsement */}
        {activeTab === 7 && (
          <div className="space-y-5">
            {/* Prepared by */}
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
                  <input
                    type="date"
                    className="input"
                    value={form.prepared_by_date || ''}
                    onChange={e => set('prepared_by_date', e.target.value)}
                  />
                </Field>
              </div>
            </div>

            {/* DG certification */}
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
                  <input
                    type="date"
                    className="input"
                    value={form.certified_dg_date || ''}
                    onChange={e => set('certified_dg_date', e.target.value)}
                  />
                </Field>
              </div>
            </div>

            {/* PSC office use only */}
            <div>
              <div className="rounded-lg border border-dashed border-slate-300 dark:border-slate-600 p-4 space-y-4">
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                  PSC Review — To be completed by PSC
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Checked by (PSC Officer)">
                    <input
                      className="input"
                      value={form.psc_checked_by_name || ''}
                      onChange={e => set('psc_checked_by_name', e.target.value)}
                    />
                  </Field>
                  <Field label="Date Checked">
                    <input
                      type="date"
                      className="input"
                      value={form.psc_checked_date || ''}
                      onChange={e => set('psc_checked_date', e.target.value)}
                    />
                  </Field>
                </div>
                <Field label="PSC Decision">
                  <div className="flex gap-4">
                    {PSC_DECISIONS.map(dec => (
                      <label key={dec} className="flex items-center gap-2 cursor-pointer text-sm">
                        <input
                          type="radio"
                          name="psc_decision"
                          value={dec}
                          checked={form.psc_decision === dec}
                          onChange={() => set('psc_decision', dec)}
                        />
                        {dec}
                      </label>
                    ))}
                  </div>
                </Field>
                <Field label="Decision Date">
                  <input
                    type="date"
                    className="input"
                    value={form.psc_decision_date || ''}
                    onChange={e => set('psc_decision_date', e.target.value)}
                  />
                </Field>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
