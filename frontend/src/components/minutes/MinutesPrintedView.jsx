import clsx from 'clsx'

const COLS = 'md:grid md:grid-cols-[21fr_11fr_34fr_34fr]'
const CELL = 'px-4 py-3 text-sm text-slate-800 dark:text-slate-200'
const LABEL = 'text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400'
const DIVIDE = 'border-b border-slate-100 dark:border-slate-700'

/** One labelled field: small caps label above, value below. */
function Field({ label, children, className }) {
  return (
    <div className={className}>
      <p className={LABEL}>{label}</p>
      <div className="mt-0.5 text-sm text-slate-800 dark:text-slate-200">{children || <span className="text-slate-300 dark:text-slate-600">—</span>}</div>
    </div>
  )
}

/** A label | value row inside a card. */
function Row({ label, children }) {
  return (
    <div className={clsx('grid grid-cols-1 sm:grid-cols-[10rem_1fr] gap-x-4 gap-y-0.5 px-4 py-2.5 last:border-b-0', DIVIDE)}>
      <p className={clsx(LABEL, 'sm:pt-0.5')}>{label}</p>
      <div className="text-sm text-slate-800 dark:text-slate-200 min-w-0">{children}</div>
    </div>
  )
}

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
 * The minutes as they read on screen: a details card, the Agenda | Decision No. |
 * Discussion | Decision rows, then the closing block. Built from the same data
 * as the PDF (`print_layout` from the API), so the screen and the page cannot
 * drift apart. The printed PDF keeps the Commission's ruled layout; this view
 * uses the app's card styling. On narrow screens the rows stack as cards.
 */
export default function MinutesPrintedView({ layout, showSigningTable }) {
  if (!layout) return null
  const att = layout.attendance
  const people = list => list?.length ? list.map((p, i) => <span key={i}>{i > 0 && '; '}<Person p={p} /></span>) : null
  return (
    <div className="space-y-6 text-slate-800 dark:text-slate-200">
      {/* ── Details ── */}
      <div className="card overflow-hidden">
        <div className={clsx('px-4 py-4 bg-primary-50 dark:bg-primary-900/20', DIVIDE)}>
          <p className={LABEL}>Meeting</p>
          <p className="mt-0.5 text-base font-bold text-primary-800 dark:text-primary-200 leading-snug">{layout.meeting_name}</p>
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Field label="Date">{layout.date_long}</Field>
            <Field label="Time">{layout.time_text}</Field>
            <Field label="Venue">{layout.venue}</Field>
          </div>
        </div>
        <Row label="Attendees">
          {att ? (
            <ul className="list-[square] pl-5 marker:text-primary-400">
              {att.present.map((p, i) => <li key={`p${i}`}><Person p={p} /></li>)}
              {att.in_attendance.map((p, i) => <li key={`o${i}`}><Person p={p} /></li>)}
            </ul>
          ) : <span className="text-slate-400 text-xs">Attendance has not been recorded.</span>}
        </Row>
        <Row label="Absent">{people(att?.absent)}</Row>
        <Row label="Apologies">{people(att?.apologies)}</Row>
        <Row label="Opening prayer">{att?.opening_prayer_by}</Row>
      </div>

      {/* ── Discussions & Decisions ── */}
      <div>
        <h3 className="text-sm font-bold mb-2 text-slate-800 dark:text-slate-100">Discussions &amp; Decisions</h3>

        <div className="card overflow-hidden hidden md:block">
          <div className={clsx(COLS, 'bg-primary-50 dark:bg-primary-900/20 text-primary-800 dark:text-primary-200 text-[11px] font-bold uppercase tracking-wider', DIVIDE)}>
            <div className="px-4 py-2.5">Agenda</div>
            <div className="px-4 py-2.5">Decision no.</div>
            <div className="px-4 py-2.5">Discussion of recommendation(s)</div>
            <div className="px-4 py-2.5">Decision</div>
          </div>
          {layout.rows.map((r, i) => (
            <div key={i} className={clsx(COLS, DIVIDE, 'last:border-b-0 hover:bg-slate-50/70 dark:hover:bg-slate-900/20')}>
              <div className={CELL}><p className="font-semibold">{r.agenda}</p>{r.ref && <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-mono">{r.ref}</p>}</div>
              <div className={clsx(CELL, 'text-slate-600 dark:text-slate-300')}>{r.decision_number}</div>
              <div className={CELL}>{r.note ? <em className="text-slate-500">{r.note}</em> : <Lines text={r.discussion} />}</div>
              <div className={CELL}><Decision r={r} /></div>
            </div>
          ))}
          {layout.rows.length === 0 && <p className={clsx(CELL, 'italic text-slate-500')}>No agenda items recorded.</p>}
        </div>

        <div className="md:hidden space-y-3">
          {layout.rows.map((r, i) => (
            <div key={i} className="card overflow-hidden">
              <div className="bg-primary-50 dark:bg-primary-900/20 text-primary-800 dark:text-primary-200 px-3 py-2 text-sm font-semibold">{r.agenda}{r.decision_number ? ` · ${r.decision_number}` : ''}</div>
              <div className="p-3 space-y-2 text-sm">
                {r.note && <em className="text-slate-500">{r.note}</em>}
                {r.discussion && <div><p className={LABEL}>Discussion</p><Lines text={r.discussion} /></div>}
                {(r.decision || r.officer) && <div><p className={LABEL}>Decision</p><Decision r={r} /></div>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {(layout.closing || layout.next_meeting_date) && (
        <div className="text-sm">
          {layout.closing && <p className="whitespace-pre-wrap">{layout.closing}</p>}
          {layout.next_meeting_date && <p className="mt-1"><span className="font-semibold">Next meeting:</span> {layout.next_meeting_date}</p>}
        </div>
      )}

      <div className="card overflow-hidden">
        <Row label="Closing prayer">{att?.closing_prayer_by}</Row>
        <Row label="Meeting end time">{layout.end_time_text}</Row>
      </div>

      {showSigningTable && (
        <div className="card overflow-hidden">
          <SignBlock title="Minutes checked by:" head={['Position title', 'Name', 'Signature', 'Date']} rows={[[layout.signers.secretary.position, layout.signers.secretary.name]]} />
          <SignBlock title="Verified as true meeting minutes by:" head={['Member', 'Name', 'Signature', 'Date']} rows={[['Chairman', layout.signers.chairman.name], ...layout.signers.members.map(m => ['Member', m.name])]} />
        </div>
      )}
    </div>
  )
}

/** Signature block: a heading, a column header, then one tall row per signer with empty signature and date boxes. */
function SignBlock({ title, head, rows }) {
  return (
    <div className="last:[&>*:last-child]:border-b-0">
      <p className={clsx('px-4 py-2.5 text-sm font-semibold bg-slate-50 dark:bg-slate-900/40', DIVIDE)}>{title}</p>
      <div className={clsx('grid grid-cols-4', DIVIDE)}>
        {head.map(h => <p key={h} className={clsx(LABEL, 'px-4 py-2')}>{h}</p>)}
      </div>
      {rows.map((r, i) => (
        <div key={i} className={clsx('grid grid-cols-4 min-h-14 items-stretch', DIVIDE)}>
          <p className="px-4 py-3 text-sm">{r[0]}</p>
          <p className="px-4 py-3 text-sm">{r[1]}</p>
          <div className="m-2 rounded-md border border-dashed border-slate-300 dark:border-slate-600" />
          <div className="m-2 rounded-md border border-dashed border-slate-300 dark:border-slate-600" />
        </div>
      ))}
    </div>
  )
}
