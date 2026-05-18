/**
 * Read-only display of PSC Form 3-7 data for the submission detail page.
 */

const EMPLOYMENT_TYPE_LABELS = {
  temporary_salaried: 'Temporary Salaried Employee',
  daily_rated: 'Daily Rated Worker',
  contract: 'Contract Employee',
}

function SectionHeader({ number, title }) {
  return (
    <div className="mt-5 mb-3 pb-1 border-b border-slate-100 dark:border-slate-700">
      <h4 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {number && <span className="mr-1.5">{number}.</span>}{title}
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

export default function PSCForm37View({ data }) {
  if (!data || !Object.keys(data).length) {
    return (
      <p className="text-sm text-slate-400 dark:text-slate-500 italic py-2">
        No form data submitted yet.
      </p>
    )
  }

  return (
    <div className="text-sm space-y-1">

      {/* 1. Proposed Employee */}
      <SectionHeader number="1" title="Proposed Employee" />
      <Field label="Name of Proposed Employee" value={data.proposed_employee_name} />

      {/* 2. Established Post */}
      <SectionHeader number="2" title="Established Post" />
      <p className="text-xs text-slate-600 dark:text-slate-300">
        Employed in an established post?{' '}
        <span className="font-semibold">
          {data.is_established_post === true ? 'Yes' : data.is_established_post === false ? 'No' : '—'}
        </span>
      </p>
      {data.is_established_post && (
        <div className="mt-2 grid grid-cols-2 gap-3 pl-3 border-l-2 border-slate-200 dark:border-slate-700">
          <Field label="Post Title" value={data.post_title} span />
          <Field label="Post Number" value={data.post_number} />
          <Field label="Post Level" value={data.post_level} />
        </div>
      )}

      {/* 3. Reasons */}
      <SectionHeader number="3" title="Reasons for Employment" />
      <Field label="Reasons" value={data.reasons_for_employment} span />

      {/* 4. Selection */}
      <SectionHeader number="4" title="Selection" />
      <Field label="How was the proposed employee selected?" value={data.how_selected} span />

      {/* 5. Employment Type */}
      <SectionHeader number="5" title="Employment Type" />
      <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
        {EMPLOYMENT_TYPE_LABELS[data.employment_type] || data.employment_type || '—'}
      </p>

      {/* 6. Period */}
      <SectionHeader number="6" title="Proposed Period of Employment" />
      <div className="grid grid-cols-2 gap-3">
        <Field label="From" value={fmt(data.period_from)} />
        <Field label="To" value={fmt(data.period_to)} />
      </div>

      {/* 7. Salary */}
      <SectionHeader number="7" title="Proposed Salary" />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Salary (VT)" value={data.salary_vt} />
        <Field label="Salary Scale" value={data.salary_scale} />
      </div>

      {/* 8. Director Certification */}
      <SectionHeader number="8" title="Director Certification" />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Director Name" value={data.director_name} />
        <Field label="Department" value={data.director_department} />
        <Field label="Date" value={fmt(data.director_date)} />
      </div>

      {/* 9. Director-General */}
      <SectionHeader number="9" title="Director-General Endorsement" />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Director-General Name" value={data.dg_name} />
        <Field label="Ministry" value={data.dg_ministry} />
        <Field label="Date" value={fmt(data.dg_date)} />
      </div>

      {/* OPSC section — only if secretary data present */}
      {(data.secretary_name || data.approved != null) && (
        <>
          <SectionHeader title="OPSC — Secretary Decision" />
          <div className="grid grid-cols-2 gap-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 p-3">
            <div className="col-span-2">
              <p className="text-[11px] text-slate-400 dark:text-slate-500 mb-0.5">Approved?</p>
              <p className="text-sm font-semibold">
                {data.approved === true
                  ? <span className="text-emerald-600 dark:text-emerald-400">Yes</span>
                  : data.approved === false
                    ? <span className="text-red-600 dark:text-red-400">No</span>
                    : '—'}
              </p>
            </div>
            <Field label="Secretary Name" value={data.secretary_name} />
            <Field label="Secretary Date" value={fmt(data.secretary_date)} />
            {data.ministry_advised_date && <Field label="Ministry Advised On" value={fmt(data.ministry_advised_date)} />}
            {data.job_offer_letter_date && <Field label="Job Offer Letter Issued" value={fmt(data.job_offer_letter_date)} />}
            {data.agreement_service_date && <Field label="Agreement of Service Forwarded" value={fmt(data.agreement_service_date)} />}
          </div>
        </>
      )}
    </div>
  )
}
