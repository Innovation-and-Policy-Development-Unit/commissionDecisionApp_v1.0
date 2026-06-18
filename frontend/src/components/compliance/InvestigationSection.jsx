import { useState, useRef } from 'react'
import { Search, Plus, Paperclip, Download } from 'lucide-react'
import api from '../../api/client'
import { useToast } from '../../context/ToastContext'

const STATUS = {
  appointed: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  in_progress: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  reported: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
  closed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
}

/**
 * Structured investigation (panel, terms of reference, findings, recommendation)
 * for a compliance case. POSTs to /compliance/cases/{id}/investigation/.
 */
export default function InvestigationSection({ caseId, investigation, canWrite, onReload }) {
  const toast = useToast()
  const inv = investigation || null
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [file, setFile] = useState(null)
  const fileRef = useRef(null)
  const [f, setF] = useState({
    panel_members_text: inv?.panel_members_text || '',
    terms_of_reference: inv?.terms_of_reference || '',
    appointed_at: inv?.appointed_at || '',
    started_at: inv?.started_at || '',
    completed_at: inv?.completed_at || '',
    findings: inv?.findings || '',
    recommendation: inv?.recommendation || '',
    status: inv?.status || 'appointed',
  })
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }))

  const save = async () => {
    setSaving(true)
    try {
      const form = new FormData()
      Object.entries(f).forEach(([k, v]) => {
        if (['appointed_at', 'started_at', 'completed_at'].includes(k) && !v) return
        form.append(k, v ?? '')
      })
      if (file) form.append('report_document', file)
      await api.post(`/compliance/cases/${caseId}/investigation/`, form, { headers: { 'Content-Type': 'multipart/form-data' } })
      toast.success('Investigation saved.')
      setOpen(false); setFile(null)
      onReload?.()
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Could not save investigation.')
    } finally { setSaving(false) }
  }

  const busy = saving

  return (
    <section className="rounded-xl border border-slate-200 dark:border-slate-700 p-5">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="flex items-center gap-2 font-semibold text-slate-700 dark:text-slate-200"><Search size={17} /> Investigation</h3>
        {canWrite && (
          <button className="text-slate-400 hover:text-slate-600" onClick={() => setOpen((v) => !v)}><Plus size={16} /></button>
        )}
      </div>

      {open && (
        <div className="mb-3 space-y-2 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 p-3">
          <input className="form-input w-full text-sm" placeholder="Panel members (names)" value={f.panel_members_text} onChange={set('panel_members_text')} />
          <textarea className="form-input w-full text-sm" rows={2} placeholder="Terms of reference" value={f.terms_of_reference} onChange={set('terms_of_reference')} />
          <div className="grid grid-cols-3 gap-2">
            <div><label className="block text-[10px] text-slate-500 mb-0.5">Appointed</label><input type="date" className="form-input w-full text-sm" value={f.appointed_at} onChange={set('appointed_at')} /></div>
            <div><label className="block text-[10px] text-slate-500 mb-0.5">Started</label><input type="date" className="form-input w-full text-sm" value={f.started_at} onChange={set('started_at')} /></div>
            <div><label className="block text-[10px] text-slate-500 mb-0.5">Completed</label><input type="date" className="form-input w-full text-sm" value={f.completed_at} onChange={set('completed_at')} /></div>
          </div>
          <textarea className="form-input w-full text-sm" rows={2} placeholder="Findings" value={f.findings} onChange={set('findings')} />
          <textarea className="form-input w-full text-sm" rows={2} placeholder="Recommendation" value={f.recommendation} onChange={set('recommendation')} />
          <select className="form-input w-full text-sm" value={f.status} onChange={set('status')}>
            <option value="appointed">Panel Appointed</option>
            <option value="in_progress">In Progress</option>
            <option value="reported">Report Submitted</option>
            <option value="closed">Closed</option>
          </select>
          <div className="flex items-center gap-2">
            <input ref={fileRef} type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
            <button type="button" onClick={() => fileRef.current?.click()} className="btn-outline text-sm inline-flex items-center gap-2"><Paperclip size={14} /> {file ? 'Change report' : 'Attach report'}</button>
            {file && <span className="truncate text-xs text-slate-500">{file.name}</span>}
            {!file && inv?.has_report && <span className="text-xs text-emerald-600">Report on file</span>}
          </div>
          <button disabled={busy} className="btn-primary text-sm w-full" onClick={save}>{inv ? 'Update investigation' : 'Save investigation'}</button>
        </div>
      )}

      {inv ? (
        <dl className="space-y-1.5 text-sm">
          <div className="flex justify-between"><dt className="text-slate-500">Status</dt><dd><span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS[inv.status] || STATUS.appointed}`}>{inv.status_display}</span></dd></div>
          {inv.panel_member_names?.length > 0 && <div><dt className="text-slate-500 text-xs">Panel</dt><dd className="text-slate-700 dark:text-slate-200">{inv.panel_member_names.join(', ')}</dd></div>}
          {inv.panel_members_text && <div><dt className="text-slate-500 text-xs">Panel (named)</dt><dd className="text-slate-700 dark:text-slate-200">{inv.panel_members_text}</dd></div>}
          {inv.terms_of_reference && <div><dt className="text-slate-500 text-xs">Terms of reference</dt><dd className="text-slate-600 dark:text-slate-300">{inv.terms_of_reference}</dd></div>}
          {inv.findings && <div><dt className="text-slate-500 text-xs">Findings</dt><dd className="text-slate-600 dark:text-slate-300">{inv.findings}</dd></div>}
          {inv.recommendation && <div><dt className="text-slate-500 text-xs">Recommendation</dt><dd className="text-slate-600 dark:text-slate-300">{inv.recommendation}</dd></div>}
          <div className="flex justify-between"><dt className="text-slate-500 text-xs">Report</dt><dd className={inv.has_report ? 'text-emerald-600 inline-flex items-center gap-1' : 'text-slate-400'}>{inv.has_report ? <><Download size={12} /> On file</> : 'Not submitted'}</dd></div>
        </dl>
      ) : !open && <p className="text-sm text-slate-400">No investigation recorded.</p>}
    </section>
  )
}
