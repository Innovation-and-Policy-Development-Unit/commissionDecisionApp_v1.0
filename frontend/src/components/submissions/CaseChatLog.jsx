/**
 * CaseChatLog.jsx
 * Secretariat-only, read-only record of what was asked of the case assistant.
 */
import { useState, useEffect } from 'react'
import api from '../../api/client'

export default function CaseChatLog({ submissionId }) {
  const [threads, setThreads] = useState(null)

  useEffect(() => {
    let alive = true
    api.get(`/submissions/${submissionId}/case-chat/log/`)
      .then(res => { if (alive) setThreads(res.data.threads || []) })
      .catch(() => { if (alive) setThreads([]) })
    return () => { alive = false }
  }, [submissionId])

  if (!threads || threads.length === 0) return null
  return (
    <details className="card p-4">
      <summary className="cursor-pointer font-semibold text-sm text-slate-800 dark:text-slate-100">
        Case assistant record ({threads.reduce((n, t) => n + t.messages.filter(m => m.role === 'user').length, 0)} questions)
      </summary>
      <div className="mt-3 flex flex-col gap-4">
        {threads.map(t => (
          <div key={t.user_id}>
            <div className="text-xs font-semibold text-slate-500 mb-1">{t.name}</div>
            <ul className="flex flex-col gap-1.5 text-sm">
              {t.messages.map(m => (
                <li key={m.id} className={m.role === 'user' ? 'text-slate-800 dark:text-slate-100 font-medium' : 'text-slate-600 dark:text-slate-300 whitespace-pre-wrap ms-3'}>
                  {m.role === 'user' ? 'Q: ' : 'A: '}{m.content}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </details>
  )
}
