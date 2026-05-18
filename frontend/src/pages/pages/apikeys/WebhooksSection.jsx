import { useState } from 'react'
import clsx from 'clsx'
import { Plus, Trash2, Globe } from 'lucide-react'
import { initialWebhooks } from './data'

function WebhookToggle({ checked, onChange }) {
  return (
    <div
      onClick={onChange}
      className={clsx(
        'relative w-9 h-5 rounded-full cursor-pointer transition-colors shrink-0',
        checked ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-600'
      )}
    >
      <div className={clsx(
        'absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform start-0.5',
        checked && 'translate-x-4 rtl:-translate-x-4'
      )} />
    </div>
  )
}

export default function WebhooksSection() {
  const [toggles, setToggles] = useState(
    Object.fromEntries(initialWebhooks.map(w => [w.id, w.active]))
  )

  const activeCount = Object.values(toggles).filter(Boolean).length

  return (
    <div className="card p-0 overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-violet-50 dark:bg-violet-900/30 flex items-center justify-center">
            <Globe size={16} className="text-violet-600 dark:text-violet-400" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-800 dark:text-slate-200">Webhooks</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {activeCount} active endpoint{activeCount !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <button className="btn-outline btn-sm">
          <Plus size={13} />
          Add Webhook
        </button>
      </div>
      <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
        {initialWebhooks.map(wh => (
          <div key={wh.id} className="flex items-start gap-4 px-6 py-4">
            <div className={clsx(
              'w-2.5 h-2.5 rounded-full mt-1.5 shrink-0',
              toggles[wh.id] ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'
            )} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-mono font-medium text-slate-700 dark:text-slate-300 truncate">{wh.url}</p>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {wh.events.map(ev => (
                  <span key={ev} className="badge badge-secondary text-[10px]">{ev}</span>
                ))}
              </div>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Last triggered: {wh.lastTriggered}</p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <WebhookToggle
                checked={toggles[wh.id]}
                onChange={() => setToggles(p => ({ ...p, [wh.id]: !p[wh.id] }))}
              />
              <button className="w-7 h-7 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center justify-center text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors">
                <Trash2 size={13} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
