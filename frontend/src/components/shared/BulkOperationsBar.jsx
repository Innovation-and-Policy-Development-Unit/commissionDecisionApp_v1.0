import { useState } from 'react'
import { X, AlertTriangle, FileDown, BrainCircuit } from 'lucide-react'
import BaseButton from './BaseButton'
import BaseSpinner from './BaseSpinner'

/**
 * BulkOperationsBar — appears when submissions are selected.
 *   selectedIds: number[]
 *   onClear: () => void
 *   onBulkAction: (action, extraData?) => Promise<void>
 */
export default function BulkOperationsBar({ selectedIds = [], onClear, onBulkAction }) {
  const [loading, setLoading] = useState(false)
  if (selectedIds.length === 0) return null

  const handle = async (action, extra = {}) => {
    setLoading(true)
    try {
      await onBulkAction(action, extra)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3 px-4 py-2.5 rounded-lg border border-primary-200 bg-primary-50 dark:border-primary-800/60 dark:bg-primary-900/20">
      <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{selectedIds.length} selected</span>
      {loading && <BaseSpinner size="sm" label="" />}
      <BaseButton size="sm" variant="ghost" icon={<AlertTriangle size={15} />} onClick={() => handle('mark_urgent')} disabled={loading}>Mark Urgent</BaseButton>
      <BaseButton size="sm" variant="ghost" icon={<BrainCircuit size={15} />} onClick={() => handle('run_ai_risk')} disabled={loading}>AI Risk Scan</BaseButton>
      <BaseButton size="sm" variant="ghost" icon={<FileDown size={15} />} onClick={() => handle('export_list')} disabled={loading}>Export List</BaseButton>
      <BaseButton size="sm" variant="ghost" icon={<X size={15} />} onClick={onClear} disabled={loading}>Clear</BaseButton>
    </div>
  )
}
