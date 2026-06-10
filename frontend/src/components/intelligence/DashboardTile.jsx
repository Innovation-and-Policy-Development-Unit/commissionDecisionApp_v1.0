import { useEffect, useState } from 'react'
import { Loader2, AlertCircle } from 'lucide-react'
import { intelligenceApi } from '../../api/intelligence'
import ExplorerChart from './ExplorerChart'

/**
 * A single dashboard tile. Runs its own (RBAC-scoped) query against the
 * Intelligence engine and renders the result with the shared ExplorerChart.
 * `refreshKey` lets the parent force a re-fetch (e.g. a "Refresh all" button).
 */
export default function DashboardTile({ tile, refreshKey = 0, onSelect }) {
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    intelligenceApi.query(tile.dataset, tile.spec)
      .then(r => { if (!cancelled) setResult(r) })
      .catch(e => { if (!cancelled) setError(e?.response?.data?.detail || 'Query failed') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tile.dataset, JSON.stringify(tile.spec), refreshKey])

  return (
    <div className="h-full min-h-[260px]">
      {loading ? (
        <div className="h-full flex items-center justify-center text-slate-400">
          <Loader2 size={18} className="animate-spin" />
        </div>
      ) : error ? (
        <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-2 px-4 text-center">
          <AlertCircle size={20} className="text-amber-500" />
          <span className="text-xs">{error}</span>
        </div>
      ) : (
        <ExplorerChart result={result} chartType={tile.chart_type} onSelect={onSelect} />
      )}
    </div>
  )
}
