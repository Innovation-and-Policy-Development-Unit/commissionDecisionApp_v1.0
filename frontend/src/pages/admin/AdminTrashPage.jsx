import { useState, useEffect, useCallback } from 'react'
import { Trash2, RotateCcw, RefreshCw, AlertCircle, FileText, File } from 'lucide-react'
import api from '../../api/client'
import PageHeader from '../../components/shared/PageHeader'
import { useToast } from '../../context/ToastContext'
import { useConfirm } from '../../context/ConfirmContext'

const fmt = (iso) =>
  new Date(iso).toLocaleString('en-VU', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })

/**
 * Admin Trash Bin: nothing in SCDMS is ever destroyed — trashed submissions
 * and archived documents land here and can be restored with one click.
 */
export default function AdminTrashPage() {
  const toast = useToast()
  const confirm = useConfirm()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const r = await api.get('/admin/trash/')
      setData(r.data)
    } catch (e) {
      setError(e.response?.data?.detail || 'Could not load the trash bin.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const restore = async (type, item, label) => {
    const ok = await confirm({
      title: 'Restore',
      message: `Restore ${label}? It will reappear everywhere it was before.`,
      confirmLabel: 'Restore',
    })
    if (!ok) return
    setBusyId(`${type}-${item.id}`)
    try {
      await api.post('/admin/trash/restore/', { type, id: item.id })
      await load()
      toast.success('Restored.')
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Restore failed.')
    } finally {
      setBusyId(null)
    }
  }

  const submissions = data?.submissions ?? []
  const documents = data?.documents ?? []

  return (
    <div>
      <PageHeader
        title="Trash Bin"
        subtitle="Nothing is ever destroyed — trashed submissions and archived documents are listed here and can be restored."
        action={
          <button
            type="button"
            className="btn-outline flex items-center gap-2 py-2 px-3 text-sm"
            onClick={load}
            disabled={loading}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        }
      />

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {/* Trashed submissions */}
      <div className="card overflow-hidden mb-6">
        <div className="p-5 border-b border-slate-100 dark:border-slate-700 flex items-center gap-2">
          <Trash2 size={16} className="text-slate-400" />
          <h3 className="font-semibold text-slate-800 dark:text-slate-200">Trashed submissions</h3>
          {submissions.length > 0 && <span className="text-xs text-slate-400">{submissions.length}</span>}
        </div>
        {loading ? (
          <div className="p-10 text-center text-sm text-slate-400">Loading…</div>
        ) : submissions.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">The trash bin is empty.</div>
        ) : (
          <div className="table-wrapper">
            <table className="table w-full">
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Title</th>
                  <th>Ministry</th>
                  <th>Deleted</th>
                  <th>By</th>
                  <th>Reason</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {submissions.map(s => (
                  <tr key={s.id}>
                    <td className="text-sm font-medium">
                      <span className="inline-flex items-center gap-1.5">
                        <FileText size={13} className="text-slate-400" />
                        {s.reference_number}
                        {s.is_attachment && <span className="text-[10px] uppercase text-slate-400">attachment</span>}
                      </span>
                    </td>
                    <td className="text-sm max-w-[280px] truncate" title={s.title}>{s.title}</td>
                    <td className="text-sm">{s.ministry || '—'}</td>
                    <td className="text-sm">{fmt(s.deleted_at)}</td>
                    <td className="text-sm">{s.deleted_by || '—'}</td>
                    <td className="text-xs text-slate-500 max-w-[200px] truncate" title={s.delete_reason}>{s.delete_reason || '—'}</td>
                    <td>
                      <button
                        type="button"
                        className="btn-outline btn-sm flex items-center gap-1.5"
                        onClick={() => restore('submission', s, `"${s.reference_number} — ${s.title}"`)}
                        disabled={busyId === `submission-${s.id}`}
                      >
                        <RotateCcw size={13} /> Restore
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Archived documents */}
      <div className="card overflow-hidden">
        <div className="p-5 border-b border-slate-100 dark:border-slate-700 flex items-center gap-2">
          <File size={16} className="text-slate-400" />
          <h3 className="font-semibold text-slate-800 dark:text-slate-200">Archived documents</h3>
          {documents.length > 0 && <span className="text-xs text-slate-400">{documents.length}</span>}
        </div>
        {loading ? (
          <div className="p-10 text-center text-sm text-slate-400">Loading…</div>
        ) : documents.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">No archived documents.</div>
        ) : (
          <div className="table-wrapper">
            <table className="table w-full">
              <thead>
                <tr>
                  <th>Document</th>
                  <th>Submission</th>
                  <th>Archived</th>
                  <th>By</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {documents.map(d => (
                  <tr key={d.id}>
                    <td className="text-sm font-medium max-w-[280px] truncate" title={d.original_name}>{d.original_name}</td>
                    <td className="text-sm">{d.submission_reference}</td>
                    <td className="text-sm">{fmt(d.archived_at)}</td>
                    <td className="text-sm">{d.archived_by || '—'}</td>
                    <td>
                      <button
                        type="button"
                        className="btn-outline btn-sm flex items-center gap-1.5"
                        onClick={() => restore('document', d, `"${d.original_name}"`)}
                        disabled={busyId === `document-${d.id}`}
                      >
                        <RotateCcw size={13} /> Restore
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
