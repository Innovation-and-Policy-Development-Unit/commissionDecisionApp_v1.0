/**
 * Read-only display of PSC Form 2-2 (Job Description) data.
 * Sections: Post Identification → Duties → Reporting & Supervision →
 *           Contacts → Impact & Conditions → Qualifications → Endorsement
 */

const DUTY_KEYS = Array.from({ length: 9 }, (_, i) => `duty_7_${i + 1}`)

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

const PSC_DECISION_COLORS = {
  Approved: 'text-emerald-600 dark:text-emerald-400',
  Deferred: 'text-amber-600 dark:text-amber-400',
  Amended: 'text-blue-600 dark:text-blue-400',
}

export default function PSCForm22View({ data }) {
  if (!data || !Object.keys(data).length) {
    return (
      <p className="text-sm text-slate-400 dark:text-slate-500 italic py-2">
        No form data submitted yet.
      </p>
    )
  }

  const duties = DUTY_KEYS.filter(k => data[k] && data[k].trim())

  return (
    <div className="text-sm space-y-1">

      {/* Post Identification */}
      <SectionHeader title="Post Identification" />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Job Title & Location" value={data.job_title_location} span />
        <Field label="Level / Grade" value={data.level_grade} />
        <Field label="Post Number" value={data.post_number} />
        <Field label="Ministry" value={data.ministry} />
        <Field label="Department" value={data.department} />
        <Field label="Post Purpose" value={data.post_purpose} span />
      </div>

      {/* Duties */}
      <SectionHeader title="Duties & Responsibilities" />
      {duties.length === 0 ? (
        <p className="text-sm text-slate-400 dark:text-slate-500 italic">No duties recorded.</p>
      ) : (
        <ol className="list-none space-y-1.5 pl-0">
          {duties.map((key, idx) => (
            <li key={key} className="flex gap-3">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-700 text-[11px] font-bold text-slate-500 dark:text-slate-400 shrink-0 mt-0.5">
                {idx + 1}
              </span>
              <p className="text-sm text-slate-700 dark:text-slate-300 flex-1">{data[key]}</p>
            </li>
          ))}
        </ol>
      )}

      {/* Reporting & Supervision */}
      <SectionHeader title="Reporting & Supervision" />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Reports Directly To" value={data.reports_directly_to} />
        <Field label="Directly Supervises" value={data.directly_supervises} />
      </div>

      {/* Contacts */}
      <SectionHeader title="Contacts" />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Frequent Internal Contacts" value={data.frequent_internal_contacts} />
        <Field label="Occasional Internal Contacts" value={data.occasional_internal_contacts} />
        <Field label="Frequent External Contacts" value={data.frequent_external_contacts} />
        <Field label="Occasional External Contacts" value={data.occasional_external_contacts} />
      </div>

      {/* Impact & Conditions */}
      <SectionHeader title="Impact & Conditions" />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Regular Decisions / Impact" value={data.impact_decisions_regular} span />
        <Field label="Financial Delegation" value={data.financial_delegation} />
        <Field label="Special Conditions" value={data.special_conditions} span />
        <Field label="Reason for Approval" value={data.reason_for_approval} />
        {data.reason_for_approval === 'Other' && (
          <Field label="Approval Reason Detail" value={data.approval_reason_detail} span />
        )}
      </div>

      {/* Qualifications */}
      <SectionHeader title="Qualifications" />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Experience" value={data.qualification_experience} span />
        <Field label="Special Skills" value={data.qualification_special_skills} span />
        <Field label="Education" value={data.qualification_education} span />
        <Field label="Language" value={data.qualification_language} />
        <div>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mb-0.5">Good Character</p>
          <p className={`text-sm font-semibold ${data.qualification_good_character ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500 italic font-normal'}`}>
            {data.qualification_good_character ? '✓ Required' : '—'}
          </p>
        </div>
      </div>

      {/* Endorsement */}
      <SectionHeader title="Endorsement" />
      <div className="grid grid-cols-2 gap-4">
        {/* Ministry prep */}
        <div className="col-span-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 p-3 space-y-2">
          <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Ministry Prepared by</p>
          <Field label="Name" value={data.prepared_by_name} />
          <Field label="Date" value={fmt(data.prepared_by_date)} />
        </div>

        {/* DG cert */}
        <div className="col-span-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 p-3 space-y-2">
          <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Certified by Director-General</p>
          <Field label="DG Name" value={data.certified_dg_name} />
          <Field label="Date" value={fmt(data.certified_dg_date)} />
        </div>

        {/* PSC Review */}
        {(data.psc_checked_by_name || data.psc_decision) && (
          <div className="col-span-2 rounded-lg border border-dashed border-slate-300 dark:border-slate-600 p-3 space-y-3">
            <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">PSC Review</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Checked by" value={data.psc_checked_by_name} />
              <Field label="Date" value={fmt(data.psc_checked_date)} />
              <div>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 mb-0.5">Decision</p>
                {data.psc_decision ? (
                  <p className={`text-sm font-semibold ${PSC_DECISION_COLORS[data.psc_decision] || 'text-slate-800 dark:text-slate-100'}`}>
                    {data.psc_decision}
                  </p>
                ) : (
                  <p className="text-sm text-slate-400 italic font-normal">—</p>
                )}
              </div>
              <Field label="Decision Date" value={fmt(data.psc_decision_date)} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
