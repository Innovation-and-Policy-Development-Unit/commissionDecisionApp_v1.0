import { useState, useEffect, useCallback, useRef } from 'react'
import { FileText, Upload, Download, Trash2, Loader2, Paperclip } from 'lucide-react'
import api from '../../api/client'
import { useToast } from '../../context/ToastContext'

const DOC_TYPES = [
  'SMDR (PSC Form 6-1)',
  'First Warning Letter',
  'Second Warning Letter',
  'Subject Response',
  'Investigation Report',
  'Documentary Evidence',
  'Outcome Letter',
  'Other',
]

/**
 * Documents / evidence for a compliance case — reuses the submission document
 * store via /compliance/cases/{id}/documents/. Uploads are tagged by workflow
 * document type so the file set mirrors the statutory process.
 */
export default function DocumentsSection({ caseId, canWrite }) {
  const toast = useToast()
  const [docs, setDocs] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [docType, setDocType] = useState(DOC_TYPES[0])
  const fileRef = useRef(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get(`/compliance/cases/${caseId}/documents/`)
      setDocs(Array.isArray(data) ? data : (data?.results || []))
    } catch { setDocs([]) } finally { setLoading(false) }
  }, [caseId])

  useEffect(() => { load() }, [load])

  const upload = async (file) => {
    if (!file) return
    if (file.size > 20 * 1024 * 1024) { toast.error('File exceeds the 20 MB limit.'); return }
    setBusy(true)
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('doc_type', docType)
      await api.post(`/compliance/cases/${caseId}/documents/`, form, { headers: { 'Content-Type': 'multipart/form-data' } })
      toast.success('Document uploaded.')
      await load()
    } catch (e) { toast.error(e.response?.data?.detail || 'Upload failed.') }
    finally { setBusy(false) }
  }

  const download = async (doc) => {
    try {
      const res = await api.get(`/compliance/cases/${caseId}/documents/${doc.id}/download/`, { responseType: 'blob' })
      const url = URL.createObjectURL(res.data)
      const a = document.createElement('a')
      a.href = url; a.download = doc.original_name; a.click()
      URL.revokeObjectURL(url)
    } catch { toast.error('Could not download document.') }
  }

  const remove = async (doc) => {
    if (!window.confirm(`Remove "${doc.original_name}"?`)) return
    setBusy(true)
    try {
      await api.post(`/compliance/cases/${caseId}/documents/${doc.id}/remove/`)
      toast.success('Document removed.')
      await load()
    } catch (e) { toast.error(e.response?.data?.detail || 'Could not remove.') }
    finally { setBusy(false) }
  }

  return (
    <section className="rounded-xl border border-slate-200 dark:border-slate-700 p-5">
      <h3 className="mb-3 flex items-center gap-2 font-semibold text-slate-700 dark:text-slate-200"><Paperclip size={17} /> Documents &amp; Evidence</h3>

      {canWrite && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 p-3">
          <select className="form-input text-sm flex-1 min-w-[160px]" value={docType} onChange={(e) => setDocType(e.target.value)}>
            {DOC_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <input ref={fileRef} type="file" className="hidden" onChange={(e) => { upload(e.target.files?.[0]); e.target.value = '' }} />
          <button disabled={busy} onClick={() => fileRef.current?.click()} className="btn-primary text-sm inline-flex items-center gap-2">
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} Upload
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-4"><Loader2 size={18} className="animate-spin text-slate-300" /></div>
      ) : docs.length === 0 ? (
        <p className="text-sm text-slate-400">No documents attached.</p>
      ) : (
        <ul className="space-y-1.5">
          {docs.map((d) => (
            <li key={d.id} className="flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2">
              <FileText size={15} className="shrink-0 text-slate-400" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">{d.original_name}</p>
                <p className="text-[11px] text-slate-400">
                  {d.description ? <span className="font-medium text-primary-600 dark:text-primary-400">{d.description}</span> : 'Untyped'}
                  {d.uploaded_by_username ? ` · ${d.uploaded_by_username}` : ''}
                  {d.uploaded_at ? ` · ${new Date(d.uploaded_at).toLocaleDateString()}` : ''}
                </p>
              </div>
              <button onClick={() => download(d)} className="text-slate-400 hover:text-primary-600" title="Download"><Download size={15} /></button>
              {canWrite && <button onClick={() => remove(d)} disabled={busy} className="text-slate-400 hover:text-red-600" title="Remove"><Trash2 size={15} /></button>}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
