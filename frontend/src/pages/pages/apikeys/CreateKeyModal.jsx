import { useState } from 'react'
import { Key } from 'lucide-react'

const SCOPE_OPTIONS = [
  { key: 'read',   label: 'Read',   desc: 'Read-only access to all resources' },
  { key: 'write',  label: 'Write',  desc: 'Create and update resources' },
  { key: 'delete', label: 'Delete', desc: 'Permanently delete resources' },
]

export default function CreateKeyModal({ open, onClose, onCreate }) {
  const [name,    setName]    = useState('')
  const [desc,    setDesc]    = useState('')
  const [expiry,  setExpiry]  = useState('')
  const [scopes,  setScopes]  = useState({ read: true, write: false, delete: false })

  if (!open) return null

  const reset = () => {
    setName('')
    setDesc('')
    setExpiry('')
    setScopes({ read: true, write: false, delete: false })
  }

  const handleCreate = () => {
    if (!name.trim()) return
    onCreate({
      name,
      expiry,
      scopes: Object.entries(scopes).filter(([, v]) => v).map(([k]) => k),
    })
    reset()
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={handleClose} />
      <div className="relative bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-lg shadow-2xl z-10 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-primary-50 dark:bg-primary-900/30 flex items-center justify-center">
            <Key size={18} className="text-primary-600 dark:text-primary-400" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-800 dark:text-slate-200">Create New API Key</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">Configure access and permissions</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Key Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              className="input"
              placeholder="e.g., Production API v2"
              value={name}
              onChange={e => setName(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Description</label>
            <textarea
              rows={2}
              className="input resize-none"
              placeholder="What is this key used for?"
              value={desc}
              onChange={e => setDesc(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Permissions / Scopes</label>
            <div className="space-y-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-700/50">
              {SCOPE_OPTIONS.map(scope => (
                <label key={scope.key} className="flex items-start gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={scopes[scope.key]}
                    onChange={() => setScopes(p => ({ ...p, [scope.key]: !p[scope.key] }))}
                    className="w-4 h-4 mt-0.5 text-primary-600 rounded border-slate-300 dark:border-slate-600 focus:ring-primary-500"
                  />
                  <div>
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300 capitalize">{scope.label}</span>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{scope.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Expiry Date</label>
            <input
              type="date"
              className="input"
              value={expiry}
              onChange={e => setExpiry(e.target.value)}
            />
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Leave empty for no expiry.</p>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={handleClose} className="btn-outline flex-1">Cancel</button>
          <button onClick={handleCreate} className="btn-primary flex-1" disabled={!name.trim()}>
            <Key size={14} />
            Generate Key
          </button>
        </div>
      </div>
    </div>
  )
}
