import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FileText, Loader2, Download } from 'lucide-react'
import clsx from 'clsx'
import api from '../../api/client'

/**
 * Read-only "Papers" pane for the commissioner sitting view: the documents
 * exactly as filed on the submission, previewed inline (PDF/image) with a
 * download fallback for other formats. No edit affordances by design.
 */
export default function SittingPackPapersPanel({ submissionId, itemLabel }) {
  const { t } = useTranslation()
  const [documents, setDocuments] = useState([])
  const [docsLoading, setDocsLoading] = useState(false)
  const [activeDocId, setActiveDocId] = useState(null)
  const [docUrl, setDocUrl] = useState('')
  const [docType, setDocType] = useState('')
  const [docLoading, setDocLoading] = useState(false)

  // Load the document list whenever the agenda item changes.
  useEffect(() => {
    if (!submissionId) { setDocuments([]); setActiveDocId(null); return undefined }
    let cancelled = false
    setDocsLoading(true)
    api.get(`/submissions/${submissionId}/documents/`)
      .then(r => {
        if (cancelled) return
        const docs = r.data || []
        setDocuments(docs)
        setActiveDocId(docs[0]?.id ?? null)
      })
      .catch(() => { if (!cancelled) { setDocuments([]); setActiveDocId(null) } })
      .finally(() => { if (!cancelled) setDocsLoading(false) })
    return () => { cancelled = true }
  }, [submissionId])

  // Fetch the selected document as an authenticated blob for inline preview.
  useEffect(() => {
    if (activeDocId == null || !submissionId) { setDocUrl(''); return undefined }
    let cancelled = false
    let objectUrl = ''
    setDocLoading(true)
    api.get(`/submissions/${submissionId}/documents/${activeDocId}/`, { responseType: 'blob' })
      .then(r => {
        if (cancelled) return
        const ct = r.headers['content-type'] || 'application/octet-stream'
        objectUrl = URL.createObjectURL(new Blob([r.data], { type: ct }))
        setDocType(ct)
        setDocUrl(objectUrl)
      })
      .catch(() => { if (!cancelled) setDocUrl('') })
      .finally(() => { if (!cancelled) setDocLoading(false) })
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [activeDocId, submissionId])

  if (!submissionId) {
    return (
      <div className="card h-full flex items-center justify-center">
        <p className="text-center text-slate-500 px-6">{t('sitting_pack.select_item')}</p>
      </div>
    )
  }

  const activeDoc = documents.find(d => d.id === activeDocId)
  const isPdf = docType.includes('pdf')
  const isImage = docType.startsWith('image/')

  const downloadActive = () => {
    if (!docUrl || !activeDoc) return
    const a = document.createElement('a')
    a.href = docUrl
    a.download = activeDoc.original_name
    a.click()
  }

  return (
    <div className="card h-full flex flex-col overflow-hidden">
      <div className="p-4 border-b border-slate-100 dark:border-slate-700">
        <div className="flex items-center gap-2">
          <FileText size={16} className="text-primary-500" />
          <span className="font-semibold text-slate-800 dark:text-slate-100">{t('sitting_pack.papers_panel')}</span>
          {documents.length > 0 && (
            <span className="text-xs text-slate-400">{documents.length}</span>
          )}
        </div>
        {itemLabel && <span className="block mt-1 truncate text-xs text-slate-500" title={itemLabel}>{itemLabel}</span>}
      </div>

      {/* Document selector — large tap targets for tablet use */}
      {documents.length > 1 && (
        <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-700 flex gap-2 overflow-x-auto shrink-0">
          {documents.map(doc => (
            <button
              key={doc.id}
              type="button"
              onClick={() => setActiveDocId(doc.id)}
              className={clsx(
                'shrink-0 max-w-[220px] truncate rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
                doc.id === activeDocId
                  ? 'bg-primary-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600',
              )}
              title={doc.original_name}
            >
              {doc.original_name}
            </button>
          ))}
        </div>
      )}

      <div className="flex-1 min-h-0 bg-slate-200/60 dark:bg-slate-900/60">
        {docsLoading || docLoading ? (
          <div className="h-full flex items-center justify-center">
            <Loader2 size={22} className="animate-spin text-slate-400" />
          </div>
        ) : documents.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <p className="text-center text-slate-500 px-6">{t('sitting_pack.papers_empty')}</p>
          </div>
        ) : !docUrl ? (
          <div className="h-full flex items-center justify-center">
            <p className="text-center text-slate-500 px-6">{t('sitting_pack.papers_unavailable')}</p>
          </div>
        ) : isPdf ? (
          <iframe src={docUrl} title={activeDoc?.original_name || 'Document'} className="w-full h-full border-0" />
        ) : isImage ? (
          <div className="h-full overflow-auto flex items-start justify-center p-4">
            <img src={docUrl} alt={activeDoc?.original_name || 'Document'} className="max-w-full rounded shadow" />
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center gap-3 px-6">
            <p className="text-center text-slate-500">{t('sitting_pack.papers_no_preview')}</p>
            <button type="button" className="btn-outline btn-sm inline-flex items-center gap-1.5" onClick={downloadActive}>
              <Download size={13} /> {activeDoc?.original_name}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
