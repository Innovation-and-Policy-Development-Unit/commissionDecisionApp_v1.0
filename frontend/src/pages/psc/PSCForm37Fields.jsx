/**
 * PSC FORM 3-7 — Request to Employ a Temporary Salaried Employee,
 * a Daily Rated Worker or a Contract Employee
 *
 * Rendered inline inside SubmissionForm when form type "PSC 3-7" is selected.
 * Props:
 *   form37  – state object
 *   setForm37 – updater function
 *   readOnly  – optional; hides OPSC office section when false (default)
 *   showOpscSection – optional; show OPSC-only fields (for secretary view)
 */
export default function PSCForm37Fields({ form37, setForm37, showOpscSection = false }) {
  const set = (field, value) => setForm37(prev => ({ ...prev, [field]: value }))

  const Field = ({ label, children, hint }) => (
    <div>
      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
        {label}
      </label>
      {children}
      {hint && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{hint}</p>}
    </div>
  )

  const SectionHeader = ({ number, title }) => (
    <div className="mt-6 mb-3 pb-1 border-b border-slate-200 dark:border-slate-700">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {number && <span className="mr-2">{number}.</span>}{title}
      </h3>
    </div>
  )

  return (
    <div className="space-y-4">

      {/* ── Proposed Employee ─────────────────────────────────────────── */}
      <SectionHeader number="1" title="Proposed Employee" />
      <Field label="Name of Proposed Employee" hint="Person is to complete a Job Application (PSC Form 3-2), which is to be attached.">
        <input
          className="input"
          value={form37.proposed_employee_name || ''}
          onChange={e => set('proposed_employee_name', e.target.value)}
          placeholder="Full name"
        />
      </Field>

      {/* ── Established Post ──────────────────────────────────────────── */}
      <SectionHeader number="2" title="Established Post" />
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
        <div className="rounded-md border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 px-4 py-2 text-xs text-amber-700 dark:text-amber-300">
          If not an established post, please prepare a draft job description and attach to this request form.
        </div>
      )}

      {/* ── Reasons ───────────────────────────────────────────────────── */}
      <SectionHeader number="3" title="Reasons for Employment" />
      <Field label="Reasons why it is necessary to employ this additional staff member">
        <textarea
          className="input min-h-[100px]"
          value={form37.reasons_for_employment || ''}
          onChange={e => set('reasons_for_employment', e.target.value)}
        />
      </Field>

      {/* ── Selection ─────────────────────────────────────────────────── */}
      <SectionHeader number="4" title="Selection" />
      <Field label="How was the proposed employee selected?">
        <textarea
          className="input min-h-[80px]"
          value={form37.how_selected || ''}
          onChange={e => set('how_selected', e.target.value)}
        />
      </Field>

      {/* ── Employment Type ───────────────────────────────────────────── */}
      <SectionHeader number="5" title="Employment Type" />
      <div className="space-y-3">
        {[
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
        ].map(opt => (
          <label
            key={opt.value}
            className={`flex gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
              form37.employment_type === opt.value
                ? 'border-blue-400 dark:border-blue-500 bg-blue-50 dark:bg-blue-900/20'
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

      {/* ── Period of Employment ──────────────────────────────────────── */}
      <SectionHeader number="6" title="Proposed Period of Employment" />
      <div className="rounded-md border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 px-4 py-2 text-xs text-amber-700 dark:text-amber-300">
        Employee must not commence duty prior to obtaining the approval of the OPSC.
      </div>
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

      {/* ── Salary ────────────────────────────────────────────────────── */}
      <SectionHeader number="7" title="Proposed Salary" />
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

      {/* ── Director Certification ────────────────────────────────────── */}
      <SectionHeader number="8" title="Director Certification" />
      <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 p-4 text-xs text-slate-600 dark:text-slate-400 mb-3">
        <p className="font-medium mb-1">I hereby certify that:</p>
        <ol className="list-decimal list-inside space-y-1">
          <li>The employment of this person is essential for the Department to maintain an adequate level of service delivery to our clients;</li>
          <li>Funds are available to cover the cost of salary for the full period of the proposed period of employment.</li>
        </ol>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Name of Director">
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

      {/* ── Director-General ──────────────────────────────────────────── */}
      <SectionHeader number="9" title="Director-General Endorsement" />
      <p className="text-xs text-slate-500 dark:text-slate-400 -mt-1 mb-2 italic">I support the Director's request.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Name of Director-General">
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

      {/* ── OPSC Office Use Only ──────────────────────────────────────── */}
      {showOpscSection && (
        <>
          <SectionHeader title="To be completed by the Secretary, OPSC" />
          <div className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 p-4 space-y-4">
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
        </>
      )}
    </div>
  )
}
