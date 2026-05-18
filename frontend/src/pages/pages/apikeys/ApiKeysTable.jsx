import { useState, useEffect, useRef } from 'react'
import clsx from 'clsx'
import { Plus, Copy, Eye, EyeOff, Trash2, RotateCcw, CheckCircle, Key } from 'lucide-react'
import { scopeColors } from './data'

export default function ApiKeysTable({ keys, activeCount, onCreate, onRevoke, onDelete }) {
  const [showKeys, setShowKeys] = useState(new Set())
  const [copiedId, setCopiedId] = useState(null)
  const copyTimeoutRef = useRef(null)

  useEffect(() => () => {
    if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current)
  }, [])

  const toggleShow = (id) =>
    setShowKeys(s => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  const copyKey = (id, raw) => {
    navigator.clipboard?.writeText(raw)
    setCopiedId(id)
    if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current)
    copyTimeoutRef.current = setTimeout(() => setCopiedId(null), 2000)
  }

  return (
    <div className="card p-0 overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
        <div>
          <h3 className="font-semibold text-slate-800 dark:text-slate-200">API Keys</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {keys.length} keys configured · {activeCount} active
          </p>
        </div>
        <button onClick={onCreate} className="btn-outline btn-sm">
          <Plus size={13} />
          New Key
        </button>
      </div>
      <div className="table-wrapper">
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>API Key</th>
              <th>Scopes</th>
              <th>Last Used</th>
              <th>Expires</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {keys.map(apiKey => (
              <tr key={apiKey.id}>
                <td>
                  <div className="flex items-center gap-3">
                    <div className={clsx(
                      'w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
                      apiKey.status === 'Active'
                        ? 'bg-primary-50 dark:bg-primary-900/30'
                        : 'bg-slate-100 dark:bg-slate-700'
                    )}>
                      <Key size={13} className={apiKey.status === 'Active' ? 'text-primary-500' : 'text-slate-400'} />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800 dark:text-slate-200 text-sm">{apiKey.name}</p>
                      <p className="text-xs text-slate-400 dark:text-slate-500">Created {apiKey.created}</p>
                    </div>
                  </div>
                </td>
                <td>
                  <div className="flex items-center gap-2">
                    <code className="font-mono text-xs text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded-md">
                      {showKeys.has(apiKey.id) ? apiKey.key : apiKey.masked}
                    </code>
                    <button
                      onClick={() => toggleShow(apiKey.id)}
                      className="w-6 h-6 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                      title={showKeys.has(apiKey.id) ? 'Hide' : 'Show'}
                    >
                      {showKeys.has(apiKey.id) ? <EyeOff size={12} /> : <Eye size={12} />}
                    </button>
                    <button
                      onClick={() => copyKey(apiKey.id, apiKey.key)}
                      className="w-6 h-6 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                      title="Copy"
                    >
                      {copiedId === apiKey.id
                        ? <CheckCircle size={12} className="text-emerald-500" />
                        : <Copy size={12} />}
                    </button>
                  </div>
                </td>
                <td>
                  <div className="flex flex-wrap gap-1">
                    {apiKey.scopes.map(s => (
                      <span key={s} className={clsx('badge text-[10px] capitalize', scopeColors[s] || 'badge-secondary')}>
                        {s}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">{apiKey.lastUsed}</td>
                <td className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">{apiKey.expires}</td>
                <td>
                  <span className={clsx('badge', apiKey.status === 'Active' ? 'badge-success' : 'badge-danger')}>
                    {apiKey.status}
                  </span>
                </td>
                <td>
                  <div className="flex items-center gap-1">
                    {apiKey.status === 'Active' && (
                      <button
                        onClick={() => onRevoke(apiKey.id)}
                        className="w-7 h-7 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-900/20 flex items-center justify-center text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 transition-colors"
                        title="Revoke"
                      >
                        <RotateCcw size={13} />
                      </button>
                    )}
                    <button
                      onClick={() => onDelete(apiKey.id)}
                      className="w-7 h-7 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center justify-center text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                      title="Delete"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
