import { useState, useEffect, useRef } from 'react'
import clsx from 'clsx'
import { Copy, CheckCircle, Code, Terminal, ChevronRight } from 'lucide-react'
import { sdkTabs, codeSnippets } from './data'
import ColoredLine from './ColoredLine'

export default function SdkQuickStart() {
  const [tab, setTab] = useState('curl')
  const [copied, setCopied] = useState(false)
  const copyTimeoutRef = useRef(null)

  useEffect(() => () => {
    if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current)
  }, [])

  const copyCode = () => {
    navigator.clipboard?.writeText(codeSnippets[tab])
    setCopied(true)
    if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current)
    copyTimeoutRef.current = setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="card p-0 overflow-hidden">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-200 dark:border-slate-700">
        <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
          <Code size={16} className="text-slate-600 dark:text-slate-400" />
        </div>
        <div>
          <h3 className="font-semibold text-slate-800 dark:text-slate-200">Quick Start</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">Get started with the Liner API in seconds</p>
        </div>
      </div>

      <div className="flex items-center gap-1 px-6 py-3 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
        {sdkTabs.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={clsx(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all capitalize',
              tab === t
                ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
            )}
          >
            <Terminal size={11} />
            {t === 'javascript' ? 'JavaScript' : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
        <div className="ml-auto">
          <button
            onClick={copyCode}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-white dark:hover:bg-slate-700 transition-all"
          >
            {copied ? <CheckCircle size={11} className="text-emerald-500" /> : <Copy size={11} />}
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      </div>

      <div className="bg-slate-900 dark:bg-slate-950 px-6 py-5 overflow-x-auto">
        <pre className="text-sm font-mono text-slate-300 leading-relaxed">
          {codeSnippets[tab].split('\n').map((line, i) => (
            <div key={i} className="flex gap-4">
              <span className="select-none text-slate-600 w-4 text-right shrink-0">{i + 1}</span>
              <ColoredLine raw={line} />
            </div>
          ))}
        </pre>
      </div>

      <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Replace <code className="font-mono bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded text-slate-600 dark:text-slate-300">LINER_API_KEY</code> with your actual key above.
        </p>
        <a href="#" onClick={(e) => e.preventDefault()} className="text-xs text-primary-600 dark:text-primary-400 hover:underline font-medium flex items-center gap-0.5">
          Full API Docs <ChevronRight size={12} />
        </a>
      </div>
    </div>
  )
}
