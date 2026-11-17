import clsx from 'clsx'

const TH = 'bg-[#2f6f26] text-white text-left font-bold px-3 py-2 text-sm border border-[#2f6f26]'
const TD = 'border border-slate-400 dark:border-slate-500 px-3 py-2 align-top text-sm text-slate-800 dark:text-slate-200'

function Lines({ text }) {
  if (!text) return null
  return text.split(/\n{2,}/).map((p, i) => <p key={i} className="mb-2 last:mb-0 whitespace-pre-wrap">{p}</p>)
}

function Decision({ r }) {
  return (
    <>
      <Lines text={r.decision} />
      {r.action_items?.length > 0 && (
        <ol className="mt-1 list-decimal pl-4 text-xs">
          {r.action_items.map((a, i) => (
            <li key={i}>{a.action}{a.responsible ? ` — ${a.responsible}` : ''}{a.deadline ? ` (Due: ${a.deadline})` : ''}</li>
          ))}
        </ol>
      )}
      {r.officer && <p className="mt-2 font-bold">Action Officer: {r.officer}</p>}
    </>
  )
}

const Person = ({ p }) => <>{p.name}{p.role ? `, ${p.role}` : ''}{p.note ? ` (${p.note})` : ''}</>

/**
 * The minutes as they print: details table, Agenda | Decision No. | Discussion |
 * Decision table, then the closing block. Built from the same data as the PDF
 * (`print_layout` from the API) so the screen and the page cannot drift apart.
 * On narrow screens the table becomes stacked cards.
 */
export default function MinutesPrintedView({ layout, showSigningTable }) {
  if (!layout) return null
  const att = layout.attendance
  const detail = 'border border-slate-400 dark:border-slate-500 px-3 py-2 text-sm'
  return (
    <div className="space-y-6 text-slate-800 dark:text-slate-200">
      <table className="w-full border-collapse">
        <tbody>
          <tr><td className={clsx(detail, 'font-bold w-40 align-top')}>Meeting Name:</td><td colSpan={5} className={clsx(detail, 'font-bold')}>{layout.meeting_name}</td></tr>
          <tr>
            <td className={detail} />
            <td className={clsx(detail, 'font-bold')}>{layout.date_long}</td>
            <td className={clsx(detail, 'font-bold text-center')}>Time:</td><td className={detail}>{layout.time_text}</td>
            <td className={clsx(detail, 'font-bold text-center')}>Venue:</td><td className={detail}>{layout.venue}</td>
          </tr>
          <tr>
            <td className={clsx(detail, 'font-bold align-top')}>Attendees:</td>
            <td colSpan={5} className={detail}>
              {att ? (
                <ul className="list-[square] pl-5">
                  {att.present.map((p, i) => <li key={`p${i}`}><Person p={p} /></li>)}
                  {att.in_attendance.map((p, i) => <li key={`o${i}`}><Person p={p} /></li>)}
                </ul>
              ) : <span className="text-slate-400 text-xs">Attendance has not been recorded.</span>}
            </td>
          </tr>
          <tr><td className={clsx(detail, 'font-bold')}>Absent:</td><td colSpan={5} className={detail}>{att?.absent.map((p, i) => <span key={i}>{i > 0 && '; '}<Person p={p} /></span>)}</td></tr>
          <tr><td className={clsx(detail, 'font-bold')}>Apologies:</td><td colSpan={5} className={detail}>{att?.apologies.map((p, i) => <span key={i}>{i > 0 && '; '}<Person p={p} /></span>)}</td></tr>
          <tr><td className={clsx(detail, 'font-bold')}>Opening Prayer</td><td colSpan={5} className={detail}>{att?.opening_prayer_by}</td></tr>
        </tbody>
      </table>

      <div>
        <h3 className="text-sm font-bold underline mb-2 text-[#1f3a5f] dark:text-sky-300">Discussions &amp; Decisions</h3>

        <table className="w-full border-collapse table-fixed hidden md:table">
          <colgroup><col style={{ width: '21%' }} /><col style={{ width: '11%' }} /><col style={{ width: '34%' }} /><col style={{ width: '34%' }} /></colgroup>
          <thead><tr><th className={TH}>Agenda</th><th className={TH}>Decision No:</th><th className={TH}>Discussion of Recommendation (s)</th><th className={TH}>Decision</th></tr></thead>
          <tbody>
            {layout.rows.map((r, i) => (
              <tr key={i}>
                <td className={TD}><p className="font-bold">{r.agenda}</p>{r.ref && <p className="text-xs text-slate-500 mt-1">{r.ref}</p>}</td>
                <td className={TD}>{r.decision_number}</td>
                <td className={TD}>{r.note ? <em className="text-slate-500">{r.note}</em> : <Lines text={r.discussion} />}</td>
                <td className={TD}><Decision r={r} /></td>
              </tr>
            ))}
            {layout.rows.length === 0 && <tr><td colSpan={4} className={TD}><em>No agenda items recorded.</em></td></tr>}
          </tbody>
        </table>

        <div className="md:hidden space-y-3">
          {layout.rows.map((r, i) => (
            <div key={i} className="border border-slate-300 dark:border-slate-600 rounded-xl overflow-hidden">
              <div className="bg-[#2f6f26] text-white px-3 py-2 text-sm font-bold">{r.agenda}{r.decision_number ? ` · ${r.decision_number}` : ''}</div>
              <div className="p-3 space-y-2 text-sm">
                {r.note && <em className="text-slate-500">{r.note}</em>}
                {r.discussion && <div><p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Discussion</p><Lines text={r.discussion} /></div>}
                {(r.decision || r.officer) && <div><p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Decision</p><Decision r={r} /></div>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {(layout.closing || layout.next_meeting_date) && (
        <div className="text-sm">
          {layout.closing && <p className="whitespace-pre-wrap">{layout.closing}</p>}
          {layout.next_meeting_date && <p className="mt-1"><span className="font-bold">Next meeting:</span> {layout.next_meeting_date}</p>}
        </div>
      )}

      <table className="w-full border-collapse">
        <tbody>
          <tr><td className={clsx(detail, 'font-bold w-48')}>Closing Prayer</td><td className={detail}>{att?.closing_prayer_by}</td></tr>
          <tr><td className={clsx(detail, 'font-bold')}>Meeting end time:</td><td className={detail}>{layout.end_time_text}</td></tr>
        </tbody>
      </table>

      {showSigningTable && (
        <table className="w-full border-collapse">
          <tbody>
            <tr><td colSpan={4} className={clsx(detail, 'font-bold')}>Minutes checked by:</td></tr>
            <tr className="font-bold"><td className={detail}>Position Title</td><td className={detail}>Name</td><td className={detail}>Signature</td><td className={detail}>Date</td></tr>
            <tr className="h-14"><td className={detail}>{layout.signers.secretary.position}</td><td className={detail}>{layout.signers.secretary.name}</td><td className={detail} /><td className={detail} /></tr>
            <tr><td colSpan={4} className={clsx(detail, 'font-bold')}>Verified as true meeting minutes by:</td></tr>
            <tr className="font-bold"><td className={detail}>Member</td><td className={detail}>Name</td><td className={detail}>Signature</td><td className={detail}>Date</td></tr>
            <tr className="h-14"><td className={detail}>Chairman</td><td className={detail}>{layout.signers.chairman.name}</td><td className={detail} /><td className={detail} /></tr>
            {layout.signers.members.map((m, i) => (
              <tr key={i} className="h-14"><td className={detail}>Member</td><td className={detail}>{m.name}</td><td className={detail} /><td className={detail} /></tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
