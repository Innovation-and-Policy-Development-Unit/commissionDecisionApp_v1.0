import { useEffect, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { ArrowLeft, Paperclip, Printer, StickyNote } from 'lucide-react'
import api from '../../api/client'
import PageHeader from '../../components/shared/PageHeader'
import PrivateNotePanel from '../../components/submissions/PrivateNotePanel'
import { useToast } from '../../context/ToastContext'

function fmtMeetingDate(d) {
  if (!d) return ''
  return new Date(`${d}T00:00`).toLocaleDateString('en-VU', { day: '2-digit', month: 'long', year: 'numeric' })
}

/**
 * The consolidated "read through all my notes before the sitting" view —
 * every agenda item for a meeting, in agenda order, with the requesting
 * Commission member's own private note inline (blank items included, so
 * they can jump straight into writing one), plus each item's submission
 * documents so this also doubles as a pre-meeting reading list. Print-
 * friendly: this doubles as the "export my notes" flow via the browser's
 * own print dialog.
 */
export default function AgendaMyNotes() {
  const toast = useToast()
  const [searchParams] = useSearchParams()
  const meetingId = searchParams.get('meeting')
  const [data, setData] = useState(undefined) // undefined = loading, null = error/no meeting

  const openDocument = (submissionId, doc) => {
    api.get(`/submissions/${submissionId}/documents/${doc.id}/`, { responseType: 'blob' }).then(r => {
      const contentType = r.headers['content-type']
      const url = URL.createObjectURL(new Blob([r.data], { type: contentType }))
      const a = document.createElement('a')
      a.href = url
      if (contentType === 'application/pdf') {
        a.target = '_blank'
        a.rel = 'noopener'
      } else {
        a.download = doc.original_name
      }
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 5000)
    }).catch(() => toast.error('Could not open document.'))
  }

  useEffect(() => {
    if (!meetingId) { setData(null); return }
    let cancelled = false
    setData(undefined)
    api.get(`/meetings/${meetingId}/my-notes/`)
      .then(r => { if (!cancelled) setData(r.data) })
      .catch(() => { if (!cancelled) setData(null) })
    return () => { cancelled = true }
  }, [meetingId])

  return (
    <div className="max-w-3xl mx-auto pb-10">
      <PageHeader
        title="My Notes"
        subtitle={
          data?.meeting
            ? `${data.meeting.reference_number} — ${data.meeting.title} · ${fmtMeetingDate(data.meeting.date)}`
            : 'Your private prep notes for a Commission sitting'
        }
        action={
          <div className="flex items-center gap-2 print:hidden">
            <Link
              to={`/secretariat/agenda${meetingId ? `?meeting=${meetingId}` : ''}`}
              className="btn-outline flex items-center gap-2 px-4 py-2"
            >
              <ArrowLeft size={15} /> Back to Agenda
            </Link>
            {data?.items?.length > 0 && (
              <button type="button" onClick={() => window.print()} className="btn-outline flex items-center gap-2 px-4 py-2">
                <Printer size={15} /> Print / Export
              </button>
            )}
          </div>
        }
      />

      {data === undefined && (
        <p className="text-sm text-slate-500 dark:text-slate-400 italic py-10 text-center">Loading…</p>
      )}
      {data === null && (
        <div className="flex flex-col items-center justify-center py-16 text-slate-400 print:hidden">
          <StickyNote size={32} className="mb-3 opacity-40" />
          <p className="text-sm">Open this from the Agenda page to see your notes for that sitting.</p>
        </div>
      )}
      {data && data.items.length === 0 && (
        <p className="text-sm text-slate-500 dark:text-slate-400 italic py-10 text-center">
          No agenda items yet for this sitting.
        </p>
      )}
      {data && data.items.length > 0 && (
        <div className="space-y-4">
          {data.items.map((item, idx) => (
            <div
              key={item.agenda_item_id}
              className="card card-compact print:border print:border-slate-300 print:break-inside-avoid"
            >
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1 print:text-black">
                {item.category_display || 'Other'}
              </p>
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 print:text-black leading-snug">
                {idx + 1}. {item.submission_title}
              </p>
              <p className="text-[11px] text-slate-400 font-mono mb-3 print:text-black">
                {item.submission_reference}
              </p>
              {item.documents.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3 print:hidden">
                  {item.documents.map(doc => (
                    <button
                      key={doc.id}
                      type="button"
                      onClick={() => openDocument(item.submission_id, doc)}
                      className="btn-outline flex items-center gap-1.5 px-2.5 py-1 text-xs"
                      title={doc.description || doc.original_name}
                    >
                      <Paperclip size={12} /> {doc.original_name}
                    </button>
                  ))}
                </div>
              )}
              <PrivateNotePanel
                submissionId={item.submission_id}
                initialBody={item.note_body}
                compact
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
