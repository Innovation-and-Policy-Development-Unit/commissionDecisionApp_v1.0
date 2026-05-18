/**
 * PSC FORM 2-1 — Organisation Restructure / Establishment Variation
 *
 * Editable tabbed form. 6 tabs matching the 6 pages of the official form.
 * Props:
 *   form       – values object (keys match XML field_key values)
 *   setForm    – state updater
 *   submission – submission object (for auto-populating ministry name)
 *   readOnly   – render as read-only display when true
 */
import { useEffect, useState } from 'react'

const TABS = [
  { id: 1, label: 'Submission Details' },
  { id: 2, label: 'Background' },
  { id: 3, label: 'Proposal' },
  { id: 4, label: 'Costing' },
  { id: 5, label: 'Implementation' },
  { id: 6, label: 'Recommendation & Sign-off' },
]

const PROPOSAL_TYPES = [
  'Organisation Restructure',
  'Establishment Variation (New Post)',
  'Establishment Variation (Regrading)',
  'Establishment Variation (Deletion)',
  'Both Restructure and Establishment Variation',
]

// Determine what the proposal type requires
function proposalRequirements(proposalType) {
  if (!proposalType) return null
  const pt = proposalType
  const isDeletion = pt.includes('Deletion')
  const isRegrading = pt.includes('Regrading')
  const isNewPost = pt.includes('New Post')
  const isRestructure = pt === 'Organisation Restructure' || pt.includes('Both')
  if (isDeletion) return { badge: 'Deletion', color: 'red', showDeleted: true, showNew: false, showRegraded: false }
  if (isRegrading) return { badge: 'Regrading', color: 'amber', showDeleted: false, showNew: false, showRegraded: true }
  if (isNewPost) return { badge: 'New Post', color: 'blue', showDeleted: false, showNew: true, showRegraded: false }
  if (isRestructure) return { badge: 'Restructure', color: 'violet', showDeleted: false, showNew: true, showRegraded: false }
  return null
}

function badgeColorClasses(color) {
  const map = {
    red: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 border border-red-200 dark:border-red-800',
    amber: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800',
    blue: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800',
    violet: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300 border border-violet-200 dark:border-violet-800',
  }
  return map[color] || map.blue
}

// Required fields per tab (for validation dot indicator)
const TAB_REQUIRED_FIELDS = {
  1: ['ministry_department_name', 'proposal_title', 'submission_date', 'proposal_type'],
  2: ['background_reasons'],
  3: [],
  4: [],
  5: ['implementation_details'],
  6: ['recommendation_text', 'director_name', 'director_date'],
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function SectionHeader({ number, title }) {
  return (
    <div className="mt-6 mb-3 pb-1 border-b border-slate-200 dark:border-slate-700">
      <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {number && <span className="mr-2">{number}.</span>}{title}
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

// Read-only field for readOnly mode
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

// ─── Attachment row ────────────────────────────────────────────────────────────

function AttachmentRow({ docNum, label, hint, checkKey, refKey, form, set, extraFields }) {
  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 p-3 space-y-2">
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          id={checkKey}
          className="mt-0.5 shrink-0 h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
          checked={!!form[checkKey]}
          onChange={e => set(checkKey, e.target.checked)}
        />
        <div className="flex-1 min-w-0">
          <label htmlFor={checkKey} className="text-sm font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
            Doc {docNum}: {label}
          </label>
          {hint && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 italic">{hint}</p>
          )}
        </div>
      </div>
      {form[checkKey] && (
        <div className="pl-7 space-y-2">
          <Field label="File reference / filename">
            <input
              className="input"
              placeholder="e.g. Attachment A"
              value={form[refKey] || ''}
              onChange={e => set(refKey, e.target.value)}
            />
          </Field>
          {extraFields}
        </div>
      )}
    </div>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function PSCForm21Fields({ form, setForm, submission, readOnly = false }) {
  const [activeTab, setActiveTab] = useState(1)
  const [tabErrors, setTabErrors] = useState({})

  const set = (field, value) => setForm(prev => ({ ...prev, [field]: value }))

  // Auto-populate ministry name on mount
  useEffect(() => {
    if (!form.ministry_department_name && submission?.ministry_name) {
      setForm(prev => ({ ...prev, ministry_department_name: submission.ministry_name }))
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-calculate net salary difference when savings or cost change
  useEffect(() => {
    const savings = parseFloat(form.savings_deleted_positions) || 0
    const cost = parseFloat(form.cost_new_positions) || 0
    const net = cost - savings
    const netStr = isNaN(net) ? '' : String(net)
    if (form.net_salary_difference !== netStr) {
      setForm(prev => ({ ...prev, net_salary_difference: netStr }))
    }
  }, [form.savings_deleted_positions, form.cost_new_positions]) // eslint-disable-line react-hooks/exhaustive-deps

  // Validate tab on switch
  const validateTab = (tabId) => {
    const required = TAB_REQUIRED_FIELDS[tabId] || []
    const hasEmpty = required.some(k => !form[k])
    setTabErrors(prev => ({ ...prev, [tabId]: hasEmpty }))
  }

  const handleTabChange = (newTab) => {
    validateTab(activeTab)
    setActiveTab(newTab)
  }

  const reqs = proposalRequirements(form.proposal_type)

  // ── ReadOnly mode ────────────────────────────────────────────────────────────
  if (readOnly) {
    return (
      <div className="space-y-6 text-sm">
        {/* Submission Details */}
        <div>
          <SectionHeader title="Submission Details" />
          <div className="grid grid-cols-2 gap-4">
            <ReadField label="Ministry / Department" value={form.ministry_department_name} span />
            <ReadField label="Proposal Title" value={form.proposal_title} span />
            <ReadField label="Submission Date" value={fmt(form.submission_date)} />
            <ReadField label="Proposal Type" value={form.proposal_type} />
          </div>
        </div>

        {/* Background */}
        <div>
          <SectionHeader title="Background" />
          <div className="space-y-3">
            <ReadField label="Background / Reasons for Proposal" value={form.background_reasons} span />
            <ReadField label="Policy / Legislative Basis" value={form.policy_legislative_basis} span />
          </div>
        </div>

        {/* Proposal */}
        <div>
          <SectionHeader title="Proposal" />
          <div className="grid grid-cols-2 gap-4">
            {(reqs?.showDeleted || reqs?.showRegraded) && (
              <ReadField label={reqs?.showRegraded ? 'Positions to be Re-graded' : 'Positions to be Deleted'} value={form.positions_deleted_regraded} span />
            )}
            {reqs?.showNew && (
              <>
                <ReadField label="New Positions Sought" value={form.new_positions_sought} span />
                <ReadField label="Proposed Grading" value={form.proposed_grading} />
              </>
            )}
          </div>
        </div>

        {/* Costing */}
        <div>
          <SectionHeader title="Costing" />
          <div className="grid grid-cols-2 gap-4">
            <ReadField label="Savings from Deleted Positions (VT)" value={form.savings_deleted_positions} />
            <ReadField label="Cost of New Positions (VT)" value={form.cost_new_positions} />
            <ReadField label="Net Salary Difference (VT)" value={form.net_salary_difference} />
            <ReadField label="Breakdown Detail" value={form.cost_breakdown_detail} span />
            <ReadField label="Current Year Funding Statement" value={form.current_year_funding_statement} span />
            <ReadField label="Funds Allocated This Year?" value={form.funds_allocated_current_year} />
          </div>
        </div>

        {/* Implementation */}
        <div>
          <SectionHeader title="Implementation" />
          <div className="space-y-3">
            <ReadField label="Implementation Details" value={form.implementation_details} span />
            <ReadField label="How Will Positions be Filled?" value={form.how_positions_filled} />
            <ReadField label="Additional Information on Filling Positions" value={form.filling_positions_additional} span />
            <ReadField label="Implementation Timeline" value={form.implementation_timeline} />
          </div>
        </div>

        {/* Recommendation */}
        <div>
          <SectionHeader title="Recommendation" />
          <ReadField label="Recommendation Text" value={form.recommendation_text} span />
        </div>

        {/* Sign-off */}
        <div>
          <SectionHeader title="Director Sign-off" />
          <div className="grid grid-cols-2 gap-4">
            <ReadField label="Director Name" value={form.director_name} />
            <ReadField label="Director Title" value={form.director_title} />
            <ReadField label="Date" value={fmt(form.director_date)} />
          </div>
        </div>

        <div>
          <SectionHeader title="Director-General Endorsement" />
          <div className="grid grid-cols-2 gap-4">
            <ReadField label="DG Endorsement Confirmed" value={form.dg_endorsement_confirmed ? 'Yes' : form.dg_endorsement_confirmed === false ? 'No' : '—'} />
            <ReadField label="DG Name" value={form.dg_name} />
            <ReadField label="DG Date" value={fmt(form.dg_date)} />
          </div>
        </div>
      </div>
    )
  }

  // ── Editable mode — tabbed ────────────────────────────────────────────────────

  return (
    <div className="space-y-0">
      {/* Tab navigation */}
      <div className="overflow-x-auto">
        <div className="flex min-w-max border-b border-slate-200 dark:border-slate-700">
          {TABS.map(tab => {
            const isActive = tab.id === activeTab
            const hasError = tabErrors[tab.id]
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleTabChange(tab.id)}
                className={`relative flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap border-b-2 -mb-px ${
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
                {hasError && (
                  <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-red-500" title="Required fields missing" />
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Tab content */}
      <div className="p-1 pt-5 space-y-4">

        {/* Tab 1 — Submission Details */}
        {activeTab === 1 && (
          <div className="space-y-4">
            <Field label="Ministry / Department Name" required>
              <input
                className="input"
                value={form.ministry_department_name || ''}
                onChange={e => set('ministry_department_name', e.target.value)}
                placeholder="Enter ministry or department name"
              />
            </Field>
            <Field label="Proposal Title" required>
              <input
                className="input"
                value={form.proposal_title || ''}
                onChange={e => set('proposal_title', e.target.value)}
                placeholder="Brief title of the proposal"
              />
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Submission Date" required>
                <input
                  type="date"
                  className="input"
                  value={form.submission_date || ''}
                  onChange={e => set('submission_date', e.target.value)}
                />
              </Field>
            </div>
            <Field label="Proposal Type" required>
              <div className="space-y-2">
                {PROPOSAL_TYPES.map(pt => (
                  <label
                    key={pt}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      form.proposal_type === pt
                        ? 'border-primary-400 dark:border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                        : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                    }`}
                  >
                    <input
                      type="radio"
                      name="proposal_type"
                      value={pt}
                      checked={form.proposal_type === pt}
                      onChange={() => set('proposal_type', pt)}
                      className="shrink-0"
                    />
                    <span className="text-sm text-slate-800 dark:text-slate-200">{pt}</span>
                  </label>
                ))}
              </div>
            </Field>
          </div>
        )}

        {/* Tab 2 — Background */}
        {activeTab === 2 && (
          <div className="space-y-4">
            <Field label="Background / Reasons for Proposal" required hint="Explain the context and need for this organisational change.">
              <textarea
                className="input min-h-[140px]"
                value={form.background_reasons || ''}
                onChange={e => set('background_reasons', e.target.value)}
                placeholder="Describe the background and reasons..."
              />
            </Field>
            <Field label="Policy / Legislative Basis" hint="Reference any legislation, policy, or mandate that supports this proposal.">
              <textarea
                className="input min-h-[100px]"
                value={form.policy_legislative_basis || ''}
                onChange={e => set('policy_legislative_basis', e.target.value)}
                placeholder="e.g. Public Service Act [CAP 246], Section..."
              />
            </Field>
          </div>
        )}

        {/* Tab 3 — Proposal */}
        {activeTab === 3 && (
          <div className="space-y-4">
            {/* Proposal type badge */}
            {reqs ? (
              <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold ${badgeColorClasses(reqs.color)}`}>
                Proposal type: {reqs.badge}
              </div>
            ) : (
              <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 px-4 py-3 text-xs text-amber-700 dark:text-amber-300">
                Please select a Proposal Type on the Submission Details tab first.
              </div>
            )}

            {reqs?.showDeleted && (
              <Field label="Positions to be Deleted" hint="List all posts/positions proposed for deletion.">
                <textarea
                  className="input min-h-[100px]"
                  value={form.positions_deleted_regraded || ''}
                  onChange={e => set('positions_deleted_regraded', e.target.value)}
                  placeholder="List positions, grades, and post numbers..."
                />
              </Field>
            )}

            {reqs?.showRegraded && (
              <Field label="Positions to be Re-graded" hint="List all posts/positions proposed for regrading, including current and proposed grades.">
                <textarea
                  className="input min-h-[100px]"
                  value={form.positions_deleted_regraded || ''}
                  onChange={e => set('positions_deleted_regraded', e.target.value)}
                  placeholder="List positions, current grade → proposed grade..."
                />
              </Field>
            )}

            {reqs?.showNew && (
              <>
                <Field label="New Positions Sought" hint="Describe each new position being created.">
                  <textarea
                    className="input min-h-[100px]"
                    value={form.new_positions_sought || ''}
                    onChange={e => set('new_positions_sought', e.target.value)}
                    placeholder="List new positions and their responsibilities..."
                  />
                </Field>
                <Field label="Proposed Grading" hint="Specify the salary grade/level for each new position.">
                  <input
                    className="input"
                    value={form.proposed_grading || ''}
                    onChange={e => set('proposed_grading', e.target.value)}
                    placeholder="e.g. P8, C4..."
                  />
                </Field>
              </>
            )}
          </div>
        )}

        {/* Tab 4 — Costing */}
        {activeTab === 4 && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Savings from Deleted Positions (VT)" hint="Annual salary savings from positions being deleted or vacated.">
                <input
                  className="input"
                  type="number"
                  min="0"
                  value={form.savings_deleted_positions || ''}
                  onChange={e => set('savings_deleted_positions', e.target.value)}
                  placeholder="0"
                />
              </Field>
              <Field label="Cost of New Positions (VT)" hint="Annual salary cost of new positions being created.">
                <input
                  className="input"
                  type="number"
                  min="0"
                  value={form.cost_new_positions || ''}
                  onChange={e => set('cost_new_positions', e.target.value)}
                  placeholder="0"
                />
              </Field>
            </div>

            {/* Auto-calculated net difference */}
            <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 p-3 space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Net Salary Difference (auto-calculated)
              </p>
              <p className={`text-lg font-bold ${
                parseFloat(form.net_salary_difference) < 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : parseFloat(form.net_salary_difference) > 0
                    ? 'text-red-600 dark:text-red-400'
                    : 'text-slate-700 dark:text-slate-300'
              }`}>
                {form.net_salary_difference !== undefined && form.net_salary_difference !== ''
                  ? `VT ${parseFloat(form.net_salary_difference).toLocaleString()}`
                  : '—'}
              </p>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 italic">
                Formula: Cost of New Positions − Savings from Deleted Positions
              </p>
            </div>

            <Field label="Cost Breakdown Detail" hint="Provide a breakdown of salary costs by position.">
              <textarea
                className="input min-h-[100px]"
                value={form.cost_breakdown_detail || ''}
                onChange={e => set('cost_breakdown_detail', e.target.value)}
                placeholder="Itemised cost breakdown..."
              />
            </Field>

            <Field label="Current Year Funding Statement" hint="Explain how costs will be met in the current budget year.">
              <textarea
                className="input min-h-[80px]"
                value={form.current_year_funding_statement || ''}
                onChange={e => set('current_year_funding_statement', e.target.value)}
                placeholder="Funding statement..."
              />
            </Field>

            <Field label="Are funds allocated in the current year budget?">
              <div className="flex gap-4">
                {['Yes', 'No', 'Partial'].map(opt => (
                  <label key={opt} className="flex items-center gap-2 cursor-pointer text-sm">
                    <input
                      type="radio"
                      name="funds_allocated_current_year"
                      value={opt}
                      checked={form.funds_allocated_current_year === opt}
                      onChange={() => set('funds_allocated_current_year', opt)}
                    />
                    {opt}
                  </label>
                ))}
              </div>
            </Field>
          </div>
        )}

        {/* Tab 5 — Implementation */}
        {activeTab === 5 && (
          <div className="space-y-4">
            <Field label="Implementation Details" required hint="Describe how the restructure / variation will be implemented.">
              <textarea
                className="input min-h-[120px]"
                value={form.implementation_details || ''}
                onChange={e => set('implementation_details', e.target.value)}
                placeholder="Steps and approach for implementation..."
              />
            </Field>

            <Field label="How Will Positions be Filled?" hint="Recruitment, redeployment, transfer, etc.">
              <textarea
                className="input min-h-[80px]"
                value={form.how_positions_filled || ''}
                onChange={e => set('how_positions_filled', e.target.value)}
                placeholder="Recruitment process or internal transfer..."
              />
            </Field>

            <Field label="Additional Information on Filling Positions">
              <textarea
                className="input min-h-[80px]"
                value={form.filling_positions_additional || ''}
                onChange={e => set('filling_positions_additional', e.target.value)}
                placeholder="Any additional relevant details..."
              />
            </Field>

            <Field label="Implementation Timeline" hint="Key dates and milestones.">
              <textarea
                className="input min-h-[80px]"
                value={form.implementation_timeline || ''}
                onChange={e => set('implementation_timeline', e.target.value)}
                placeholder="e.g. Q1 2025: advertise positions..."
              />
            </Field>
          </div>
        )}

        {/* Tab 6 — Recommendation & Sign-off */}
        {activeTab === 6 && (
          <div className="space-y-5">
            {/* Recommendation */}
            <div>
              <SectionHeader title="Recommendation" />
              <Field label="Recommendation Text" required hint="Director's formal recommendation to the PSC.">
                <textarea
                  className="input min-h-[120px]"
                  value={form.recommendation_text || ''}
                  onChange={e => set('recommendation_text', e.target.value)}
                  placeholder="It is recommended that the PSC approves..."
                />
              </Field>
            </div>

            {/* Attachments */}
            <div>
              <SectionHeader title="Attachments Checklist" />
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                Tick each document that is included with this submission and provide a reference or filename.
              </p>

              <div className="space-y-3">
                <AttachmentRow
                  docNum={1}
                  label="Current Organisation Structure Chart"
                  hint="Required for all proposal types."
                  checkKey="attachment_current_structure"
                  refKey="attachment_current_structure_ref"
                  form={form}
                  set={set}
                />

                <AttachmentRow
                  docNum={2}
                  label="Proposed Organisation Structure Chart"
                  hint="Required for Restructure and both combined proposals."
                  checkKey="attachment_proposed_structure"
                  refKey="attachment_proposed_structure_ref"
                  form={form}
                  set={set}
                />

                <AttachmentRow
                  docNum={3}
                  label="Draft Job Descriptions"
                  hint="Required for New Post and Regrading proposals."
                  checkKey="attachment_job_descriptions"
                  refKey="attachment_jd_ref"
                  form={form}
                  set={set}
                  extraFields={
                    <>
                      <Field label="Number of JDs attached">
                        <input
                          type="number"
                          min="0"
                          className="input w-32"
                          value={form.attachment_jd_positions_count || ''}
                          onChange={e => set('attachment_jd_positions_count', e.target.value)}
                          placeholder="0"
                        />
                      </Field>
                      <Field label="List of positions with JDs attached">
                        <textarea
                          className="input min-h-[80px]"
                          value={form.attachment_jd_ref || ''}
                          onChange={e => set('attachment_jd_ref', e.target.value)}
                          placeholder="Position 1, Position 2..."
                        />
                      </Field>
                    </>
                  }
                />

                <AttachmentRow
                  docNum={4}
                  label="Cost Spreadsheet"
                  hint="Required where salary costing has been calculated."
                  checkKey="attachment_cost_spreadsheet"
                  refKey="attachment_cost_spreadsheet_ref"
                  form={form}
                  set={set}
                />

                <AttachmentRow
                  docNum={5}
                  label="Other Attachments"
                  hint="Any other supporting documents."
                  checkKey="attachment_other_included"
                  refKey="attachment_other_description"
                  form={form}
                  set={set}
                />
              </div>

              {/* Self-check */}
              <div className="mt-4 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 p-3 space-y-2">
                <p className="text-xs font-semibold text-blue-800 dark:text-blue-200">Self-check</p>
                <div className="flex gap-6">
                  {['Complete', 'Incomplete — details noted above'].map(opt => (
                    <label key={opt} className="flex items-center gap-2 cursor-pointer text-sm text-blue-700 dark:text-blue-300">
                      <input
                        type="radio"
                        name="attachment_self_check"
                        value={opt}
                        checked={form.attachment_self_check === opt}
                        onChange={() => set('attachment_self_check', opt)}
                      />
                      {opt}
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* Director sign-off */}
            <div>
              <SectionHeader title="Director Sign-off" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Director Name" required>
                  <input
                    className="input"
                    value={form.director_name || ''}
                    onChange={e => set('director_name', e.target.value)}
                  />
                </Field>
                <Field label="Director Title">
                  <input
                    className="input"
                    value={form.director_title || ''}
                    onChange={e => set('director_title', e.target.value)}
                    placeholder="e.g. Director of Human Resources"
                  />
                </Field>
                <Field label="Date" required>
                  <input
                    type="date"
                    className="input"
                    value={form.director_date || ''}
                    onChange={e => set('director_date', e.target.value)}
                  />
                </Field>
              </div>
            </div>

            {/* DG endorsement */}
            <div>
              <SectionHeader title="Director-General Endorsement" />
              <div className="space-y-4">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                    checked={!!form.dg_endorsement_confirmed}
                    onChange={e => set('dg_endorsement_confirmed', e.target.checked)}
                  />
                  <span className="text-sm text-slate-700 dark:text-slate-300">
                    I, the Director-General, endorse this proposal and confirm the information provided is accurate.
                  </span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="DG Name">
                    <input
                      className="input"
                      value={form.dg_name || ''}
                      onChange={e => set('dg_name', e.target.value)}
                    />
                  </Field>
                  <Field label="DG Date">
                    <input
                      type="date"
                      className="input"
                      value={form.dg_date || ''}
                      onChange={e => set('dg_date', e.target.value)}
                    />
                  </Field>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
