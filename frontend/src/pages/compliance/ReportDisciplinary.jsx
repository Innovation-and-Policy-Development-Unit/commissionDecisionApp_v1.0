/**
 * ReportDisciplinary — Active Case Tracker (mirrors the XLSX 3-sheet format)
 * Tabs: Active Cases | Under Investigation | At Commission
 * Features: ministry chart, PSDB-blocked badge, inline quick-note, PDF export per tab.
 */
import { useMemo, useState, useCallback } from 'react'
import { Download, Loader2, AlertTriangle, PenLine, Check, X as XIcon, Building2 } from 'lucide-react'
import api from '../../api/client'

const FAMILY_LABELS = {
  employee_disciplinary:       'Employee Disciplinary',
  serious_misconduct_employee: 'Serious Misconduct',
  temporary_suspension:        'Temporary Suspension',
  grievance:                   'Grievance',
  senior_serious_misconduct:   'Senior — Serious Misconduct',
  senior_poor_performance:     'Senior — Poor Performance',
  policy_review:               'Policy Review',
}

const TABS = [
  { key: 'active',        label: 'Active Cases' },
  { key: 'investigation', label: 'Under Investigation' },
  { key: 'commission',    label: 'At Commission' },
]

function isPsdbBlocked(c) {
  return (c.description || c.title || '').toLowerCase().includes('psdb') ||
         (c.latest_note || '').toLowerCase().includes('psdb')
}

function tabFilter(cases, tab) {
  if (tab === 'active') {
    return cases.filter((c) => ['active', 'draft', 'pending_manager_approval'].includes(c.status))
  }
  if (tab === 'investigation') {
    return cases.filter((c) => {
      const note = (c.latest_note || '').toLowerCase()
      const desc = (c.description || c.title || '').toLowerCase()
      return note.includes('panel') || note.includes('investigation') ||
             desc.includes('panel') || desc.includes('investigation')
    })
  }
  if (tab === 'commission') {
    return cases.filter((c) =>
      c.status === 'with_commission' ||
      (c.latest_note || '').toLowerCase().includes('commission') ||
      (c.description || '').toLowerCase().includes('commission')
    )
  }
  return cases
}

// ── Ministry chart ─────────────────────────────────────────────────────────────
function MinistryChart({ cases }) {
  const byMinistry = useMemo(() => {
    const map = {}
    cases.forEach((c) => {
      const key = c.subject_ministry || 'Unknown'
      map[key] = (map[key] || 0) + 1
    })
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 10)
  }, [cases])

  if (!byMinistry.length) return null
  const max = byMinistry[0][1]

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 mb-5">
      <h4 className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
        <Building2 size={13} /> Caseload by Ministry
      </h4>
      <div className="space-y-1.5">
        {byMinistry.map(([ministry, count]) => (
          <div key={ministry} className="flex items-center gap-2">
            <div className="w-24 shrink-0 text-xs text-slate-600 dark:text-slate-300 truncate">{ministry}</div>
            <div className="flex-1 h-3 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
              <div
                className="h-3 rounded-full bg-blue-500"
                style={{ width: `${Math.round((count / max) * 100)}%` }}
              />
            </div>
            <div className="w-5 text-right text-xs font-semibold text-slate-700 dark:text-slate-200">{count}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Inline quick-note ──────────────────────────────────────────────────────────
function InlineNote({ caseId, currentNote, onSaved }) {
  const [editing, setEditing]   = useState(false)
  const [text, setText]         = useState('')
  const [saving, setSaving]     = useState(false)

  const startEdit = () => { setText(''); setEditing(true) }
  const cancel    = () => setEditing(false)

  const save = useCallback(async () => {
    if (!text.trim()) { cancel(); return }
    setSaving(true)
    try {
      await api.post(`/compliance/cases/${caseId}/notes/`, { text: text.trim() })
      onSaved()
      setEditing(false)
    } catch {
      alert('Could not save note.')
    } finally { setSaving(false) }
  }, [caseId, text, onSaved])

  if (editing) {
    return (
      <div className="flex items-start gap-1" onClick={(e) => e.stopPropagation()}>
        <textarea
          autoFocus
          rows={2}
          className="form-input text-xs py-1 px-2 flex-1 resize-none min-w-[180px]"
          placeholder="Add update note…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); save() } if (e.key === 'Escape') cancel() }}
        />
        <button
          disabled={saving}
          onClick={save}
          className="p-1 rounded text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 disabled:opacity-50"
        >
          {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
        </button>
        <button onClick={cancel} className="p-1 rounded text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700">
          <XIcon size={13} />
        </button>
      </div>
    )
  }

  return (
    <div className="flex items-start gap-1 group/note">
      <span className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[200px]" title={currentNote || ''}>
        {currentNote || <span className="italic text-slate-300 dark:text-slate-600">No update</span>}
      </span>
      <button
        onClick={(e) => { e.stopPropagation(); startEdit() }}
        className="shrink-0 p-0.5 rounded text-slate-300 hover:text-primary-500 opacity-0 group-hover/note:opacity-100 transition-opacity"
        title="Add note"
      >
        <PenLine size={12} />
      </button>
    </div>
  )
}

// ── PDF export ────────────────────────────────────────────────────────────────
async function exportDisciplinaryPdf(tabLabel, cases) {
  const { jsPDF }  = await import('jspdf')
  const autoTable  = (await import('jspdf-autotable')).default

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const W   = doc.internal.pageSize.getWidth()
  const now = new Date().toLocaleString('en-AU', { dateStyle: 'long', timeStyle: 'short' })

  doc.setFillColor(30, 64, 175)
  doc.rect(0, 0, W, 22, 'F')
  doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(255, 255, 255)
  doc.text('Office of the Public Service Commission — Compliance Unit', 14, 9)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9)
  doc.text(`Disciplinary Cases Report — ${tabLabel}`, 14, 15)
  doc.text(now, W - 14, 15, { align: 'right' })

  doc.setTextColor(30, 41, 59)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(14)
  doc.text(`Disciplinary Cases — ${tabLabel}`, 14, 33)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(100, 116, 139)
  doc.text(`${cases.length} case${cases.length !== 1 ? 's' : ''}`, 14, 38)

  autoTable(doc, {
    startY: 43,
    head: [['Name', 'Ministry', 'Case Type', 'Year', 'Days Open', 'Latest Update', 'Next Action']],
    body: cases.map((c) => [
      c.subject_name + (isPsdbBlocked(c) ? ' ⚑' : ''),
      c.subject_ministry || '—',
      FAMILY_LABELS[c.case_family] || c.case_family_display,
      c.year_group ?? '—',
      c.days_open != null ? String(c.days_open) : '—',
      c.latest_note || c.description || '—',
      c.next_action_due || '—',
    ]),
    theme: 'striped',
    headStyles: { fillColor: [51, 65, 85], textColor: 255, fontSize: 7, fontStyle: 'bold' },
    bodyStyles: { fontSize: 7, textColor: [30, 41, 59] },
    columnStyles: {
      0: { cellWidth: 35 },
      1: { cellWidth: 20 },
      2: { cellWidth: 35 },
      3: { cellWidth: 14, halign: 'center' },
      4: { cellWidth: 16, halign: 'center' },
      5: { cellWidth: 80 },
      6: { cellWidth: 27, halign: 'center' },
    },
    margin: { left: 14, right: 14 },
  })

  const pages = doc.internal.getNumberOfPages()
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i)
    doc.setFontSize(7); doc.setTextColor(148, 163, 184)
    doc.text('CONFIDENTIAL — OPSC Compliance Unit', 14, doc.internal.pageSize.getHeight() - 6)
    doc.text(`Page ${i} of ${pages}`, W - 14, doc.internal.pageSize.getHeight() - 6, { align: 'right' })
  }

  const slug = tabLabel.toLowerCase().replace(/\s+/g, '_')
  doc.save(`OPSC_Disciplinary_${slug}_${new Date().toISOString().slice(0, 10)}.pdf`)
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function ReportDisciplinary({ cases, onRefresh }) {
  const [tab, setTab]           = useState('active')
  const [exporting, setExporting] = useState(false)

  const tabCases = useMemo(() => tabFilter(cases, tab), [cases, tab])
  const tabLabel = TABS.find((t) => t.key === tab)?.label || tab

  const handleExport = async () => {
    setExporting(true)
    try { await exportDisciplinaryPdf(tabLabel, tabCases) }
    finally { setExporting(false) }
  }

  return (
    <div>
      {/* Tabs + export */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex gap-1 rounded-lg border border-slate-200 dark:border-slate-700 p-0.5 bg-slate-50 dark:bg-slate-800">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-3 py-1.5 text-xs rounded-md font-medium transition-colors ${
                tab === t.key
                  ? 'bg-white dark:bg-slate-700 text-primary-700 dark:text-primary-300 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
            >
              {t.label}
              <span className="ml-1.5 rounded-full bg-slate-200 dark:bg-slate-600 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 dark:text-slate-300">
                {tabFilter(cases, t.key).length}
              </span>
            </button>
          ))}
        </div>
        <button
          className="btn-primary flex items-center gap-2 py-2 px-3 text-sm disabled:opacity-60"
          onClick={handleExport}
          disabled={exporting || tabCases.length === 0}
        >
          {exporting ? <><Loader2 size={14} className="animate-spin" /> Generating…</> : <><Download size={14} /> Export {tabLabel} PDF</>}
        </button>
      </div>

      {/* Ministry chart (shown for active tab) */}
      {tab === 'active' && <MinistryChart cases={tabCases} />}

      {/* Table */}
      {tabCases.length === 0 ? (
        <p className="py-12 text-center text-sm text-slate-400">No cases in this category.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
          <table className="min-w-full text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-left text-[11px] uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2.5">Name</th>
                <th className="px-3 py-2.5">Ministry</th>
                <th className="px-3 py-2.5">Case Type</th>
                <th className="px-3 py-2.5 text-center">Year</th>
                <th className="px-3 py-2.5 text-center">Days Open</th>
                <th className="px-3 py-2.5">Case Update</th>
                <th className="px-3 py-2.5 text-center">Next Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
              {tabCases.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="px-3 py-2.5 font-medium text-slate-800 dark:text-slate-100">
                    <div className="flex flex-col gap-0.5">
                      <span>{c.subject_name}</span>
                      {isPsdbBlocked(c) && (
                        <span className="inline-flex items-center gap-0.5 rounded bg-orange-100 dark:bg-orange-900/30 px-1.5 py-0.5 text-[10px] font-semibold text-orange-700 dark:text-orange-300 w-fit">
                          <AlertTriangle size={9} /> PSDB pending
                        </span>
                      )}
                      {c.is_senior_executive && (
                        <span className="inline-block rounded bg-purple-100 dark:bg-purple-900/30 px-1.5 py-0.5 text-[10px] font-semibold text-purple-700 dark:text-purple-300 w-fit">Senior Exec</span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-slate-500 dark:text-slate-400 whitespace-nowrap">{c.subject_ministry || '—'}</td>
                  <td className="px-3 py-2.5 text-slate-500 dark:text-slate-400">{FAMILY_LABELS[c.case_family] || c.case_family_display}</td>
                  <td className="px-3 py-2.5 text-center text-slate-500">{c.year_group || '—'}</td>
                  <td className={`px-3 py-2.5 text-center tabular-nums font-medium ${
                    c.days_open > 365 ? 'text-red-600 dark:text-red-400' :
                    c.days_open > 180 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500'
                  }`}>
                    {c.days_open != null ? c.days_open : '—'}
                  </td>
                  <td className="px-3 py-2.5 max-w-xs">
                    <InlineNote
                      caseId={c.id}
                      currentNote={c.latest_note}
                      onSaved={onRefresh}
                    />
                  </td>
                  <td className={`px-3 py-2.5 text-center whitespace-nowrap text-xs ${
                    c.next_action_due && new Date(c.next_action_due) < new Date() ? 'text-red-600 dark:text-red-400 font-semibold' :
                    c.next_action_due && (new Date(c.next_action_due) - new Date()) / 86400000 <= 7 ? 'text-amber-600 dark:text-amber-400 font-semibold' :
                    'text-slate-500'
                  }`}>
                    {c.next_action_due || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
