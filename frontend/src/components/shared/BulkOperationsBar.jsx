import { useEffect, useState } from 'react'
import { X, FileDown, BrainCircuit, AlertTriangle, UserPlus } from 'lucide-react'
import BaseButton from './BaseButton'
import BaseSpinner from './BaseSpinner'
import BaseSelect from './BaseSelect'
import api from '../../api/client'

/**
 * BulkOperationsBar — appears when submissions are selected.
 *   selectedIds: number[]
 *   onClear: () => void
 *   onBulkAction: (action, extraData?) => Promise<void>
 *   canGeneralBulk: export / AI risk scan (secretariat + admin roles)
 *   canFlagUrgent:  Secretary and managers only — mirrors the backend rule
 *   canAssign:      unit managers (and admins) — loads their assignable staff
 */
export default function BulkOperationsBar({
  selectedIds = [], onClear, onBulkAction,
  canGeneralBulk = true, canFlagUrgent = false, canAssign = false,
}) {
  const [loading, setLoading] = useState(false)
  const [assignOpen, setAssignOpen] = useState(false)
  const [staff, setStaff] = useState(null)
  const [assignee, setAssignee] = useState('')

  useEffect(() => {
    if (!assignOpen || staff) return
    api.get('/submissions/assignable-staff/')
      .then(r => setStaff(r.data))
      .catch(() => setStaff([]))
  }, [assignOpen, staff])

  if (selectedIds.length === 0) return null

  const handle = async (action, extra = {}) => {
    setLoading(true)
    try {
      await onBulkAction(action, extra)
    } finally {
      setLoading(false)
    }
  }

  const markUrgent = () => {
    const reason = window.prompt('Reason for flagging urgent (optional)', '')
    if (reason === null) return
    handle('mark_urgent', { reason })
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-3 px-4 py-2.5 rounded-lg border border-primary-200 bg-primary-50 dark:border-primary-800/60 dark:bg-primary-900/20">
        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{selectedIds.length} selected</span>
        {loading && <BaseSpinner size="sm" label="" />}
        {canFlagUrgent && (
          <>
            <BaseButton size="sm" variant="ghost" icon={<AlertTriangle size={15} />} onClick={markUrgent} disabled={loading}>Mark Urgent</BaseButton>
            <BaseButton size="sm" variant="ghost" onClick={() => handle('clear_urgent')} disabled={loading}>Clear Urgent</BaseButton>
          </>
        )}
        {canAssign && (
          <BaseButton size="sm" variant="ghost" icon={<UserPlus size={15} />} onClick={() => setAssignOpen(o => !o)} disabled={loading} aria-expanded={assignOpen}>Assign</BaseButton>
        )}
        {canGeneralBulk && (
          <>
            <BaseButton size="sm" variant="ghost" icon={<BrainCircuit size={15} />} onClick={() => handle('run_ai_risk')} disabled={loading}>AI Risk Scan</BaseButton>
            <BaseButton size="sm" variant="ghost" icon={<FileDown size={15} />} onClick={() => handle('export_list')} disabled={loading}>Export List</BaseButton>
          </>
        )}
        <BaseButton size="sm" variant="ghost" icon={<X size={15} />} onClick={onClear} disabled={loading}>Clear</BaseButton>
      </div>
      {assignOpen && (
        <div className="flex flex-wrap items-end gap-3 px-4 py-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
          <BaseSelect
            label="Assign selected to"
            className="w-72"
            placeholder={staff ? 'Choose an officer…' : 'Loading…'}
            options={(staff || []).map(o => ({ value: String(o.id), label: `${o.full_name} — ${o.active_count} active` }))}
            value={assignee}
            onChange={(_, v) => setAssignee(v)}
          />
          <BaseButton
            variant="primary"
            size="sm"
            disabled={!assignee || loading}
            onClick={async () => { await handle('assign', { assignee_id: Number(assignee) }); setAssignOpen(false); setAssignee('') }}
          >
            Assign {selectedIds.length}
          </BaseButton>
        </div>
      )}
    </div>
  )
}
