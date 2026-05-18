/**
 * Read-only display of PSC Form 2-1 data.
 * Sections: Submission Details → Background → Proposal → Costing →
 *           Implementation → Recommendation → Attachments → Sign-off
 */

function SectionHeader({ title }) {
  return (
    <div className="mt-5 mb-3 pb-1 border-b border-slate-100 dark:border-slate-700">
      <h4 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {title}
      </h4>
    </div>
  )
}

function Field({ label, value, span }) {
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

const PROPOSAL_TYPE_COLORS = {
  'Organisation Restructure': 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
  'Establishment Variation (New Post)': 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  'Establishment Variation (Regrading)': 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  'Establishment Variation (Deletion)': 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  'Both Restructure and Establishment Variation': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
}

function ProposalTypeBadge({ value }) {
  if (!value) return <span className="text-slate-400 dark:text-slate-500 italic">—</span>
  const cls = PROPOSAL_TYPE_COLORS[value] || 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${cls}`}>
      {value}
    </span>
  )
}

function CheckVal({ value }) {
  return (
    <span className={value ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-slate-400 dark:text-slate-500 italic'}>
      {value ? '✓ Included' : '—'}
    </span>
  )
}

export default function PSCForm21View({ data }) {
  if (!data || !Object.keys(data).length) {
    return (
      <p className="text-sm text-slate-400 dark:text-slate-500 italic py-2">
        No form data submitted yet.
      </p>
    )
  }

  const isDeletion = data.proposal_type?.includes('Deletion')
  const isRegrading = data.proposal_type?.includes('Regrading')
  const isNewPost = data.proposal_type?.includes('New Post')
  const isRestructure = data.proposal_type === 'Organisation Restructure' || data.proposal_type?.includes('Both')

  const net = parseFloat(data.net_salary_difference)

  return (
    <div className="text-sm space-y-1">

      {/* Submission Details */}
      <SectionHeader title="Submission Details" />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Ministry / Department" value={data.ministry_department_name} span />
        <Field label="Proposal Title" value={data.proposal_title} span />
        <Field label="Submission Date" value={fmt(data.submission_date)} />
        <div>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mb-0.5">Proposal Type</p>
          <ProposalTypeBadge value={data.proposal_type} />
        </div>
      </div>

      {/* Background */}
      <SectionHeader title="Background" />
      <div className="space-y-3">
        <Field label="Background / Reasons for Proposal" value={data.background_reasons} span />
        <Field label="Policy / Legislative Basis" value={data.policy_legislative_basis} span />
      </div>

      {/* Proposal */}
      <SectionHeader title="Proposal" />
      <div className="grid grid-cols-2 gap-3">
        {(isDeletion || isRegrading) && (
          <Field
            label={isRegrading ? 'Positions to be Re-graded' : 'Positions to be Deleted'}
            value={data.positions_deleted_regraded}
            span
          />
        )}
        {(isNewPost || isRestructure) && (
          <>
            <Field label="New Positions Sought" value={data.new_positions_sought} span />
            <Field label="Proposed Grading" value={data.proposed_grading} />
          </>
        )}
        {!isDeletion && !isRegrading && !isNewPost && !isRestructure && (
          <Field label="Positions / Changes" value={data.positions_deleted_regraded || data.new_positions_sought} span />
        )}
      </div>

      {/* Costing */}
      <SectionHeader title="Costing" />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Savings from Deleted Positions (VT)" value={data.savings_deleted_positions ? `VT ${parseFloat(data.savings_deleted_positions).toLocaleString()}` : null} />
        <Field label="Cost of New Positions (VT)" value={data.cost_new_positions ? `VT ${parseFloat(data.cost_new_positions).toLocaleString()}` : null} />
        <div>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mb-0.5">Net Salary Difference (VT)</p>
          <p className={`text-sm font-semibold ${
            !isNaN(net) && net < 0
              ? 'text-emerald-600 dark:text-emerald-400'
              : !isNaN(net) && net > 0
                ? 'text-red-600 dark:text-red-400'
                : 'text-slate-800 dark:text-slate-100'
          }`}>
            {!isNaN(net) && data.net_salary_difference !== ''
              ? `VT ${net.toLocaleString()}`
              : <span className="text-slate-400 italic font-normal">—</span>}
          </p>
        </div>
        <Field label="Funds Allocated This Year?" value={data.funds_allocated_current_year} />
        <Field label="Cost Breakdown Detail" value={data.cost_breakdown_detail} span />
        <Field label="Current Year Funding Statement" value={data.current_year_funding_statement} span />
      </div>

      {/* Implementation */}
      <SectionHeader title="Implementation" />
      <div className="space-y-3">
        <Field label="Implementation Details" value={data.implementation_details} span />
        <Field label="How Will Positions be Filled?" value={data.how_positions_filled} />
        <Field label="Additional Information on Filling" value={data.filling_positions_additional} span />
        <Field label="Implementation Timeline" value={data.implementation_timeline} />
      </div>

      {/* Recommendation */}
      <SectionHeader title="Recommendation" />
      <Field label="Recommendation Text" value={data.recommendation_text} span />

      {/* Attachments */}
      {(data.attachment_current_structure || data.attachment_proposed_structure || data.attachment_job_descriptions || data.attachment_cost_spreadsheet || data.attachment_other_included) && (
        <>
          <SectionHeader title="Attachments" />
          <div className="space-y-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/30 p-3">
            {[
              { key: 'attachment_current_structure', label: 'Current Organisation Structure', refKey: 'attachment_current_structure_ref' },
              { key: 'attachment_proposed_structure', label: 'Proposed Organisation Structure', refKey: 'attachment_proposed_structure_ref' },
              { key: 'attachment_job_descriptions', label: 'Draft Job Descriptions', refKey: 'attachment_jd_ref' },
              { key: 'attachment_cost_spreadsheet', label: 'Cost Spreadsheet', refKey: 'attachment_cost_spreadsheet_ref' },
              { key: 'attachment_other_included', label: 'Other Attachments', refKey: 'attachment_other_description' },
            ].map(doc => (
              <div key={doc.key} className="flex items-start gap-3">
                <span className="text-sm">
                  <CheckVal value={data[doc.key]} />
                </span>
                <div>
                  <p className="text-xs font-medium text-slate-700 dark:text-slate-300">{doc.label}</p>
                  {data[doc.key] && data[doc.refKey] && (
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 italic mt-0.5">{data[doc.refKey]}</p>
                  )}
                  {data[doc.key] && doc.key === 'attachment_job_descriptions' && data.attachment_jd_positions_count && (
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{data.attachment_jd_positions_count} JD(s) attached</p>
                  )}
                </div>
              </div>
            ))}
            {data.attachment_self_check && (
              <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
                <p className="text-[11px] text-slate-400 dark:text-slate-500 mb-0.5">Self-check</p>
                <p className="text-xs font-medium text-slate-700 dark:text-slate-300">{data.attachment_self_check}</p>
              </div>
            )}
          </div>
        </>
      )}

      {/* Director Sign-off */}
      <SectionHeader title="Director Sign-off" />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Director Name" value={data.director_name} />
        <Field label="Director Title" value={data.director_title} />
        <Field label="Date" value={fmt(data.director_date)} />
      </div>

      {/* DG Endorsement */}
      <SectionHeader title="Director-General Endorsement" />
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mb-0.5">Endorsement Confirmed</p>
          <p className={`text-sm font-semibold ${data.dg_endorsement_confirmed ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500 italic font-normal'}`}>
            {data.dg_endorsement_confirmed ? '✓ Confirmed' : '—'}
          </p>
        </div>
        <Field label="DG Name" value={data.dg_name} />
        <Field label="DG Date" value={fmt(data.dg_date)} />
      </div>
    </div>
  )
}
