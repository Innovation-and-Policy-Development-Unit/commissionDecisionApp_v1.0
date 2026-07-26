import { useState, useEffect, useRef } from 'react'
import { X, Paperclip, Download, Loader2, FileText } from 'lucide-react'
import api from '../../api/client'
import { useToast } from '../../context/ToastContext'

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'skipped', label: 'Skipped' },
]
const d10 = (v) => (v ? String(v).slice(0, 10) : '')

/**
 * Slide-over detail view for a single statutory stage: status, outcome notes,
 * responsible officer, editable dates, and the stage's documents.
 */
export default function StageDetailDrawer({ caseId, stage, canWrite, onClose, onSaved }) {
  const toast = useToast()
  const [f, setF] = useState({ status: 'pending', outcome_notes: '', responsible_officer: '', started_at: '', completed_at: '' })
  const [saving, setSaving] = useState(false)
  const [busy, setBusy] = useState(false)
  const [docType, setDocType] = useState('')
  const [docNote, setDocNote] = useState('')
  const fileRef = useRef(null)

  useEffect(() => {
    if (!stage) return
    setF({
      status: stage.status || 'pending',
      outcome_notes: stage.outcome_notes || '',
      responsible_officer: stage.responsible_officer || '',
      started_at: d10(stage.started_at),
      completed_at: d10(stage.completed_at),
    })
  }, [stage?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!stage) return null
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }))
  const docs = stage.documents || []

  const save = async () => {
    setSaving(true)
    try {
      await api.post(`/compliance/cases/${caseId}/stage/`, { stage_id: stage.id, ...f })
      toast.success('Stage updated.')
      onSaved?.()
    } catch (e) { toast.error(e.response?.data?.detail || 'Could not save stage.') }
    finally { setSaving(false) }
  }

  const attach = async (file) => {
    if (!file) return
    setBusy(true)
    try {
      const form = new FormData()
      form.append('file', file)
      if (docType) form.append('doc_type', docType)
      if (docNote) form.append('note', docNote)
      await api.post(`/compliance/cases/${caseId}/stages/${stage.id}/documents/`, form, { headers: { 'Content-Type': 'multipart/form-data' } })
      setDocNote('')
      onSaved?.()
    } catch (e) { toast.error(e.response?.data?.detail || 'Upload failed.') }
    finally { setBusy(false) }
  }
  const unlink = async (docId) => {
    setBusy(true)
    try { await api.post(`/compliance/cases/${caseId}/stages/${stage.id}/documents/${docId}/unlink/`); onSaved?.() }
    catch (e) { toast.error(e.response?.data?.detail || 'Could not unlink.') }
    finally { setBusy(false) }
  }
  const download = async (doc) => {
    try {
      const res = await api.get(`/compliance/cases/${caseId}/documents/${doc.id}/download/`, { responseType: 'blob' })
      const url = URL.createObjectURL(res.data)
      const a = document.createElement('a'); a.href = url; a.download = doc.original_name; a.click(); URL.revokeObjectURL(url)
    } catch { toast.error('Could not download.') }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
      <div className="h-full w-full max-w-lg overflow-y-auto bg-white dark:bg-slate-900 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-start justify-between border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-5 py-4">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-slate-400">Stage {stage.stage_order} · {stage.statutory_ref}</p>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{stage.stage_name}</h3>
            {stage.notes && <p className="mt-1 text-xs italic text-slate-500 dark:text-slate-400 max-w-md">{stage.notes}</p>}
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
        </div>

        <div className="space-y-4 p-5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1 text-slate-600 dark:text-slate-300">Status</label>
              <select className="form-input w-full text-sm" value={f.status} onChange={set('status')} disabled={!canWrite}>
                {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1 text-slate-600 dark:text-slate-300">Responsible officer</label>
              <input className="form-input w-full text-sm" value={f.responsible_officer} onChange={set('responsible_officer')} disabled={!canWrite} placeholder="Name / unit" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1 text-slate-600 dark:text-slate-300">Started</label>
              <input type="date" className="form-input w-full text-sm" value={f.started_at} onChange={set('started_at')} disabled={!canWrite} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1 text-slate-600 dark:text-slate-300">Completed</label>
              <input type="date" className="form-input w-full text-sm" value={f.completed_at} onChange={set('completed_at')} disabled={!canWrite} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1 text-slate-600 dark:text-slate-300">Notes / outcome</label>
            <textarea className="form-input w-full text-sm min-h-[90px]" value={f.outcome_notes} onChange={set('outcome_notes')} disabled={!canWrite} placeholder="What happened at this stage, the decision/outcome, references…" />
          </div>
          {canWrite && (
            <button onClick={save} disabled={saving} className="btn-primary text-sm w-full">{saving ? 'Saving…' : 'Save stage'}</button>
          )}

          {/* Stage documents */}
          <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
            <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200"><Paperclip size={15} /> Stage documents</h4>
            {docs.length === 0 && <p className="text-xs text-slate-400 mb-2">No documents linked to this stage.</p>}
            <ul className="space-y-1.5 mb-3">
              {docs.map((d) => (
                <li key={d.id} className="flex items-start gap-2 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1.5">
                  <FileText size={14} className="mt-0.5 shrink-0 text-slate-400" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-slate-800 dark:text-slate-100">{d.original_name}</p>
                    {d.description && <p className="text-[11px] font-medium text-primary-600 dark:text-primary-400">{d.description}</p>}
                    {d.note && <p className="text-[11px] text-slate-500 dark:text-slate-400 italic">{d.note}</p>}
                  </div>
                  <button onClick={() => download(d)} className="text-slate-400 hover:text-primary-600" title="Download"><Download size={14} /></button>
                  {canWrite && <button onClick={() => unlink(d.id)} className="text-slate-400 hover:text-red-600" title="Unlink"><X size={14} /></button>}
                </li>
              ))}
            </ul>
            {canWrite && (
              <div className="space-y-2 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 p-2.5">
                <input className="form-input w-full text-sm" placeholder="Document type (optional)" value={docType} onChange={(e) => setDocType(e.target.value)} />
                <input className="form-input w-full text-sm" placeholder="Note (optional)" value={docNote} onChange={(e) => setDocNote(e.target.value)} />
                <input ref={fileRef} type="file" className="hidden" onChange={(e) => { attach(e.target.files?.[0]); e.target.value = '' }} />
                <button onClick={() => fileRef.current?.click()} disabled={busy} className="btn-outline text-sm inline-flex items-center gap-2">
                  {busy ? <Loader2 size={14} className="animate-spin" /> : <Paperclip size={14} />} Attach to this stage
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
