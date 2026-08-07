/**
 * SittingPackView.jsx
 *
 * Full-screen split "Sitting Pack" review mode for ODU restructure submissions.
 * Two modes, sharing the same shell and document preview:
 *   - 'checklist'   (default) — left: uploaded documents. right: the ODU
 *      Restructure Checklist, so the Manager ODU / assigned Principal can
 *      verify the package against the checklist side by side.
 *   - 'board_paper' — left: the ODU Board Submission Paper (editable).
 *      right: uploaded documents, for reference while drafting.
 */

import { useState, useEffect, useRef } from 'react'
import { X, Loader2, FileText, ClipboardCheck, FileSignature } from 'lucide-react'
import clsx from 'clsx'
import api from '../../api/client'
import ODURestructureChecklistForm from '../../pages/odu/ODURestructureChecklistForm'
import ODUBoardPaperForm from '../../pages/odu/ODUBoardPaperForm'

export default function SittingPackView({
  submissionId,
  submission,
  documents = [],
  checklist = [],
  mode = 'checklist',
  checklistPanel,
  onClose,
}) {
  const [activeDocId, setActiveDocId] = useState(documents[0]?.id ?? null)
  const [docUrl, setDocUrl] = useState('')
  const [docType, setDocType] = useState('')
  const [docLoading, setDocLoading] = useState(false)
  const chipRefs = useRef({})

  // Keep an active document selected as the list loads/changes.
  useEffect(() => {
    if (activeDocId == null && documents.length) setActiveDocId(documents[0].id)
  }, [documents, activeDocId])

  // Fetch the selected document as an authenticated blob for inline preview.
  useEffect(() => {
    if (activeDocId == null) {
      setDocUrl('')
      return undefined
    }
    let cancelled = false
    let objectUrl = ''
    setDocLoading(true)
    api
      .get(`/submissions/${submissionId}/documents/${activeDocId}/`, { responseType: 'blob' })
      .then(r => {
        if (cancelled) return
        const ct = r.headers['content-type'] || 'application/octet-stream'
        objectUrl = URL.createObjectURL(new Blob([r.data], { type: ct }))
        setDocType(ct)
        setDocUrl(objectUrl)
      })
      .catch(() => {
        if (!cancelled) setDocUrl('')
      })
      .finally(() => {
        if (!cancelled) setDocLoading(false)
      })
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [activeDocId, submissionId])

  // Esc exits the sitting pack.
  useEffect(() => {
    const onKey = e => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const activeDoc = documents.find(d => d.id === activeDocId)
  const isImage = docType.startsWith('image/')
  const isPdf = docType.includes('pdf')

  // Checklist items click through to the document that answers them —
  // resolves a RequiredDocument id (via `checklist`, the id/name mapping)
  // to the actual uploaded SubmissionDocument, then selects + scrolls to it.
  const handleNavigateToDocument = (documentId) => {
    if (documentId == null) return
    setActiveDocId(documentId)
    requestAnimationFrame(() => {
      chipRefs.current[documentId]?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
    })
  }

  const documentsPane = (
    <div className="min-h-0 flex flex-col border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-slate-700">
      <div className="flex items-center gap-1.5 px-3 py-2.5 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shrink-0 text-xs font-medium text-slate-500 dark:text-slate-400">
        <FileText size={13} />
        Documents{documents.length ? ` (${documents.length})` : ''}
      </div>
      {documents.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-sm text-slate-400">
          No documents attached.
        </div>
      ) : (
        <>
          {/* Document selector */}
          <div className="flex gap-1.5 overflow-x-auto px-3 py-2 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shrink-0">
            {documents.map(d => (
              <button
                key={d.id}
                ref={el => { chipRefs.current[d.id] = el }}
                type="button"
                onClick={() => setActiveDocId(d.id)}
                title={d.original_name}
                className={clsx(
                  'shrink-0 max-w-[12rem] truncate rounded-lg px-2.5 py-1 text-xs font-medium border transition-colors',
                  d.id === activeDocId
                    ? 'border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700',
                )}
              >
                {d.original_name}
              </button>
            ))}
          </div>
          {/* Preview */}
          <div className="flex-1 min-h-0 bg-slate-200 dark:bg-slate-950">
            {docLoading ? (
              <div className="h-full flex items-center justify-center text-slate-400 gap-2 text-sm">
                <Loader2 size={16} className="animate-spin" /> Loading document…
              </div>
            ) : !docUrl ? (
              <div className="h-full flex items-center justify-center text-slate-400 text-sm">
                Preview unavailable.
              </div>
            ) : isImage ? (
              <div className="h-full overflow-auto p-4 flex items-start justify-center">
                <img src={docUrl} alt={activeDoc?.original_name} className="max-w-full" />
              </div>
            ) : isPdf ? (
              <iframe
                src={docUrl}
                title={activeDoc?.original_name || 'document'}
                className="w-full h-full border-0"
              />
            ) : (
              <div className="h-full flex flex-col items-center justify-center gap-3 text-slate-400 text-sm">
                <FileText size={28} />
                <p>Inline preview not supported for this file type.</p>
                <a
                  href={docUrl}
                  download={activeDoc?.original_name}
                  className="btn-outline inline-flex items-center gap-1.5"
                >
                  Download {activeDoc?.original_name}
                </a>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )

  const isBoardPaperMode = mode === 'board_paper'

  return (
    <div className="fixed inset-0 z-[80] flex flex-col bg-slate-100 dark:bg-slate-900">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={clsx(
            'flex items-center justify-center w-8 h-8 rounded-lg shrink-0',
            isBoardPaperMode ? 'bg-amber-100 dark:bg-amber-900/30' : 'bg-indigo-100 dark:bg-indigo-900/30',
          )}>
            {isBoardPaperMode
              ? <FileSignature size={16} className="text-amber-600 dark:text-amber-400" />
              : <ClipboardCheck size={16} className="text-indigo-600 dark:text-indigo-400" />}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">
              {isBoardPaperMode ? 'Draft Board Paper' : 'Review Submission'} — {submission?.reference_number}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
              {submission?.title}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="btn-outline inline-flex items-center gap-1.5 shrink-0"
        >
          <X size={14} />
          Exit Review
        </button>
      </div>

      {/* Body — split */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-2">
        {isBoardPaperMode ? (
          <>
            {/* ── Left: ODU Board Paper (editable) ── */}
            <div className="min-h-0 overflow-y-auto p-4 bg-white dark:bg-slate-900 border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-slate-700">
              <ODUBoardPaperForm submissionId={Number(submissionId)} submission={submission} />
            </div>
            {/* ── Right: ministry submission, for reference ── */}
            {documentsPane}
          </>
        ) : (
          <>
            {/* ── Left: documents ── */}
            {documentsPane}
            {/* ── Right: checklist ── */}
            <div className="min-h-0 overflow-y-auto p-4 bg-white dark:bg-slate-900">
              {checklistPanel ?? (
                <ODURestructureChecklistForm
                  submissionId={Number(submissionId)}
                  submission={submission}
                  documents={documents}
                  checklistItems={checklist}
                  onNavigateToDocument={handleNavigateToDocument}
                />
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
