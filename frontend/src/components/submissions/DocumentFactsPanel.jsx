import { useState } from 'react'
import { Sparkles, Loader2, Search, AlertCircle } from 'lucide-react'
import api from '../../api/client'
import clsx from 'clsx'

const STATUS_STYLES = {
  pending: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
  processing: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  completed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  failed: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  skipped: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
}

function FactList({ label, items }) {
  if (!items?.length) return null
  return (
    <div className="mt-2">
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">{label}</p>
      <ul className="text-xs text-slate-600 dark:text-slate-300 space-y-0.5 list-disc list-inside">
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </div>
  )
}

export default function DocumentFactsPanel({ submissionId, doc, canExtract, onRefresh }) {
  const [busy, setBusy] = useState(false)
  const facts = doc.extracted_facts || {}
  const keyFacts = facts.key_facts || facts

  const runExtract = async () => {
    setBusy(true)
    try {
      await api.post(`/submissions/${submissionId}/documents/${doc.id}/extract-facts/`)
      setTimeout(onRefresh, 2500)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/40 p-3">
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <span className={clsx('text-[10px] font-bold uppercase px-2 py-0.5 rounded-full', STATUS_STYLES[doc.ocr_status] || STATUS_STYLES.pending)}>
          {doc.ocr_status_display || doc.ocr_status || 'pending'}
        </span>
        {canExtract && (
          <button
            type="button"
            onClick={runExtract}
            disabled={busy || doc.ocr_status === 'processing'}
            className="inline-flex items-center gap-1 text-[10px] font-bold text-primary-600 hover:text-primary-700 disabled:opacity-50"
          >
            {busy || doc.ocr_status === 'processing' ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
            {doc.ocr_status === 'completed' ? 'Re-extract' : 'Extract text & facts'}
          </button>
        )}
      </div>

      {doc.ocr_error && (
        <p className="text-xs text-red-600 dark:text-red-400 flex items-start gap-1 mb-2">
          <AlertCircle size={12} className="shrink-0 mt-0.5" />
          {doc.ocr_error}
        </p>
      )}

      {facts.document_summary && (
        <p className="text-xs text-slate-600 dark:text-slate-300 mb-2">{facts.document_summary}</p>
      )}

      <FactList label="Names" items={keyFacts.names} />
      <FactList label="Dates" items={keyFacts.dates} />
      <FactList label="Positions" items={keyFacts.positions} />
      <FactList label="References" items={keyFacts.references} />
      <FactList label="Statements" items={keyFacts.statements} />

      {doc.extracted_text && (
        <details className="mt-2">
          <summary className="text-[10px] font-bold text-slate-500 cursor-pointer flex items-center gap-1">
            <Search size={11} /> Searchable text ({doc.extracted_text.length} chars)
          </summary>
          <pre className="mt-1 text-[10px] text-slate-500 dark:text-slate-400 whitespace-pre-wrap max-h-32 overflow-y-auto font-mono">
            {doc.extracted_text.slice(0, 4000)}
            {doc.extracted_text.length > 4000 ? '…' : ''}
          </pre>
        </details>
      )}
    </div>
  )
}
