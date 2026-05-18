import { Printer } from 'lucide-react'

const val = (values, key, fallback = '') =>
  (values?.[key] !== undefined && values[key] !== null && values[key] !== '')
    ? String(values[key])
    : fallback

const duties = (values) =>
  ['7_1','7_2','7_3','7_4','7_5','7_6','7_7','7_8','7_9']
    .map((n, i) => ({ n: i + 1, v: val(values, `duty_${n}`) }))
    .filter(d => d.v)

function Row({ label, value, multiline = false }) {
  return (
    <tr className="border-b border-slate-200 last:border-0">
      <td className="w-56 py-1.5 pr-3 text-[11px] font-semibold text-slate-600 align-top whitespace-nowrap">{label}</td>
      <td className={`py-1.5 text-[12px] text-slate-800 align-top ${multiline ? 'whitespace-pre-wrap' : ''}`}>
        {value || <span className="text-slate-300">—</span>}
      </td>
    </tr>
  )
}

function Section({ number, title, children }) {
  return (
    <div className="mb-5 break-inside-avoid">
      <div className="flex items-baseline gap-2 bg-slate-100 px-3 py-1.5 rounded-sm mb-2">
        {number && <span className="text-[11px] font-bold text-slate-500 w-5 shrink-0">{number}.</span>}
        <span className="text-[12px] font-bold text-slate-700 uppercase tracking-wide">{title}</span>
      </div>
      <div className="px-3">{children}</div>
    </div>
  )
}

export default function PSCForm22Preview({ values = {}, submissionRef = '', onPrint }) {
  const handlePrint = () => {
    if (onPrint) { onPrint(); return }
    // Open preview in a new window for clean printing
    const content = document.getElementById('psc-form-preview-content')?.innerHTML
    if (!content) return
    const w = window.open('', '_blank', 'width=900,height=700')
    w.document.write(`<!DOCTYPE html><html><head>
      <title>PSC Form 2-2${submissionRef ? ' — ' + submissionRef : ''}</title>
      <style>
        * { box-sizing: border-box; }
        body { font-family: Georgia, serif; margin: 0; padding: 24px 40px; color: #1e293b; }
        table { width: 100%; border-collapse: collapse; }
        td { padding: 6px 8px; vertical-align: top; font-size: 11.5px; border-bottom: 1px solid #e2e8f0; }
        td:first-child { width: 220px; font-weight: 600; color: #475569; white-space: nowrap; padding-right: 12px; }
        .section-header { background: #f1f5f9; padding: 6px 12px; margin: 16px 0 8px; border-radius: 2px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #475569; }
        .center { text-align: center; }
        .sig-box { border: 1px solid #cbd5e1; border-radius: 4px; padding: 8px 12px; min-height: 60px; display: inline-block; width: 48%; margin-right: 2%; }
        .footer { margin-top: 32px; padding-top: 12px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 10px; color: #94a3b8; }
        @media print { body { padding: 12px 24px; } }
      </style>
    </head><body>${content}</body></html>`)
    w.document.close()
    w.focus()
    setTimeout(() => { w.print() }, 400)
  }

  const dutyRows = duties(values)

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 shrink-0">
        <p className="text-xs font-medium text-slate-600 dark:text-slate-400">Live Preview — PSC Form 2-2</p>
        <button
          type="button"
          onClick={handlePrint}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-white bg-slate-700 hover:bg-slate-800 dark:bg-slate-600 dark:hover:bg-slate-500 px-3 py-1.5 rounded-lg transition-colors"
        >
          <Printer size={12} />
          Print / PDF
        </button>
      </div>

      {/* Scrollable preview area */}
      <div className="flex-1 overflow-y-auto bg-white dark:bg-slate-900" id="psc-form-preview">
        <div id="psc-form-preview-content" className="psc-form-paper mx-auto" style={{ maxWidth: 680, padding: '28px 32px', fontFamily: 'Georgia, serif' }}>

          {/* ── Official Header ── */}
          <div className="text-center mb-6 pb-4 border-b-2 border-slate-800">
            <p className="text-[10px] font-bold tracking-widest text-slate-500 uppercase mb-1">Republic of Vanuatu</p>
            <p className="text-[17px] font-bold text-slate-900 leading-tight">PUBLIC SERVICE COMMISSION</p>
            <p className="text-[13px] font-semibold text-slate-700 mt-1">PSC Form 2-2 — Job Description</p>
            {submissionRef && (
              <p className="mt-2 text-[11px] text-slate-500">Reference: <span className="font-mono font-semibold">{submissionRef}</span></p>
            )}
          </div>

          {/* ── Section 1–6: Post Identification ── */}
          <Section number={null} title="Post Identification">
            <table className="w-full">
              <tbody>
                <Row label="1. Job Title and Location" value={val(values, 'job_title_location')} />
                <Row label="2. Level / Grade" value={val(values, 'level_grade')} />
                <Row label="3. Post Number" value={val(values, 'post_number')} />
                <Row label="4. Ministry" value={val(values, 'ministry')} />
                <Row label="5. Department" value={val(values, 'department')} />
                <Row label="6. Purpose of Post" value={val(values, 'post_purpose')} multiline />
              </tbody>
            </table>
          </Section>

          {/* ── Section 7: Duties ── */}
          <Section number={7} title="Duties and Responsibilities">
            {dutyRows.length === 0 ? (
              <p className="text-[11px] text-slate-300 italic py-2">Not yet completed.</p>
            ) : (
              <table className="w-full">
                <tbody>
                  {dutyRows.map(d => (
                    <Row key={d.n} label={`7.${d.n}`} value={d.v} multiline />
                  ))}
                </tbody>
              </table>
            )}
          </Section>

          {/* ── Section 8–13: Reporting & Contacts ── */}
          <Section title="Reporting, Supervision and Contacts">
            <table className="w-full">
              <tbody>
                <Row label="8. Reports Directly To" value={val(values, 'reports_directly_to')} />
                <Row label="9. Directly Supervises" value={val(values, 'directly_supervises')} multiline />
                <Row label="10. Frequent Internal Contacts" value={val(values, 'frequent_internal_contacts')} multiline />
                <Row label="11. Occasional Internal Contacts" value={val(values, 'occasional_internal_contacts')} multiline />
                <Row label="12. Frequent External Contacts" value={val(values, 'frequent_external_contacts')} multiline />
                <Row label="13. Occasional External Contacts" value={val(values, 'occasional_external_contacts')} multiline />
              </tbody>
            </table>
          </Section>

          {/* ── Section 14–16: Impact ── */}
          <Section title="Impact, Conditions and Reason for Approval">
            <table className="w-full">
              <tbody>
                <Row label="14a. Key Decisions Made Independently" value={val(values, 'impact_decisions_regular')} multiline />
                <Row label="14b. Financial Delegation" value={val(values, 'financial_delegation')} />
                <Row label="15. Special Conditions" value={val(values, 'special_conditions')} multiline />
                <Row label="16. Reason for Seeking Approval" value={val(values, 'reason_for_approval')} />
                <Row label="16. Additional Details" value={val(values, 'approval_reason_detail')} multiline />
              </tbody>
            </table>
          </Section>

          {/* ── Section 17: Qualifications ── */}
          <Section number={17} title="Minimum Qualifications">
            <table className="w-full">
              <tbody>
                <Row label="17.1 Experience" value={val(values, 'qualification_experience')} multiline />
                <Row label="17.2 Special Skills" value={val(values, 'qualification_special_skills')} multiline />
                <Row label="17.3 Education" value={val(values, 'qualification_education')} multiline />
                <Row label="17.4 Language" value={val(values, 'qualification_language')} />
                <Row
                  label="17.5 Good Character"
                  value={values?.qualification_good_character ? '✓ Confirmed — Good Character applies to this post' : ''}
                />
              </tbody>
            </table>
          </Section>

          {/* ── Section 18: Endorsement ── */}
          <Section number={18} title="Endorsement">
            {/* Ministry preparation */}
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1 mt-1">Ministry Preparation</p>
            <table className="w-full mb-4">
              <tbody>
                <Row label="18.1 Prepared by — Name" value={val(values, 'prepared_by_name')} />
                <Row label="18.1 Prepared by — Date" value={val(values, 'prepared_by_date')} />
              </tbody>
            </table>

            {/* DG certification */}
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Director-General Certification</p>
            <table className="w-full mb-4">
              <tbody>
                <Row label="18.2 Certified by DG — Name" value={val(values, 'certified_dg_name')} />
                <Row label="18.2 Certified by DG — Date" value={val(values, 'certified_dg_date')} />
              </tbody>
            </table>

            {/* Signature boxes */}
            <div className="grid grid-cols-2 gap-6 mt-4">
              {[
                { label: 'Signature — Prepared by', sub: val(values, 'prepared_by_name') },
                { label: 'Signature — Director-General', sub: val(values, 'certified_dg_name') },
              ].map(({ label, sub }) => (
                <div key={label} className="border border-slate-300 rounded px-3 pt-2 pb-8">
                  <p className="text-[10px] font-semibold text-slate-500 uppercase">{label}</p>
                  {sub && <p className="text-[11px] text-slate-600 mt-1">{sub}</p>}
                </div>
              ))}
            </div>

            {/* PSC section */}
            <div className="mt-4 border-t border-dashed border-slate-300 pt-4">
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-2">PSC Review (Office Use Only)</p>
              <table className="w-full mb-3">
                <tbody>
                  <Row label="18.3 Checked by PSC — Name" value={val(values, 'psc_checked_by_name')} />
                  <Row label="18.3 Checked by PSC — Date" value={val(values, 'psc_checked_date')} />
                  <Row label="18.4 PSC Decision" value={val(values, 'psc_decision')} />
                  <Row label="18.4 Date of PSC Decision" value={val(values, 'psc_decision_date')} />
                </tbody>
              </table>
            </div>
          </Section>

          {/* Footer */}
          <div className="mt-8 pt-4 border-t border-slate-300 text-center">
            <p className="text-[10px] text-slate-400">
              PSC Form 2-2 — Job Description &nbsp;|&nbsp; Public Service Commission of Vanuatu
            </p>
          </div>

        </div>
      </div>

    </div>
  )
}
