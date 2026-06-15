/**
 * ReportSummary — Case Status Overview
 * Cases grouped by year with Days Open, Latest Update, Next Action Due.
 * Mirrors the "Summary Report" template. PDF export included.
 */
import { useMemo, useState } from 'react'
import { Download, Loader2, ChevronDown, ChevronRight, AlertTriangle } from 'lucide-react'

const FAMILY_LABELS = {
  employee_disciplinary:       'Employee Disciplinary',
  serious_misconduct_employee: 'Serious Misconduct',
  temporary_suspension:        'Temporary Suspension',
  grievance:                   'Grievance',
  senior_serious_misconduct:   'Senior — Serious Misconduct',
  senior_poor_performance:     'Senior — Poor Performance',
  policy_review:               'Policy Review',
}

function daysOpenCls(days) {
  if (days == null) return ''
  if (days > 365) return 'text-red-600 dark:text-red-400 font-bold'
  if (days > 180) return 'text-amber-600 dark:text-amber-400 font-semibold'
  return 'text-slate-600 dark:text-slate-300'
}

function nextActionCls(dateStr) {
  if (!dateStr) return ''
  const diff = Math.ceil((new Date(dateStr) - new Date()) / 86400000)
  if (diff < 0)  return 'text-red-600 dark:text-red-400 font-semibold'
  if (diff <= 7) return 'text-amber-600 dark:text-amber-400 font-semibold'
  return 'text-slate-600 dark:text-slate-300'
}

function isPsdbBlocked(c) {
  return (c.description || c.title || '').toLowerCase().includes('psdb') ||
         (c.latest_note || '').toLowerCase().includes('psdb')
}

// ── PDF export ────────────────────────────────────────────────────────────────
async function exportSummaryPdf(grouped) {
  const { jsPDF }  = await import('jspdf')
  const autoTable  = (await import('jspdf-autotable')).default

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const W   = doc.internal.pageSize.getWidth()
  const now = new Date().toLocaleString('en-AU', { dateStyle: 'long', timeStyle: 'short' })

  // Header
  doc.setFillColor(30, 64, 175)
  doc.rect(0, 0, W, 22, 'F')
  doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(255, 255, 255)
  doc.text('Office of the Public Service Commission — Compliance Unit', 14, 9)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9)
  doc.text('Case Status Overview Report', 14, 15)
  doc.text(now, W - 14, 15, { align: 'right' })

  doc.setTextColor(30, 41, 59)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(14)
  doc.text('Case Status Overview', 14, 33)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(100, 116, 139)
  doc.text('Active disciplinary and compliance cases grouped by year of receipt', 14, 38)

  let y = 43

  for (const [year, cases] of grouped) {
    if (y > 175) { doc.addPage(); y = 15 }
    // Year heading
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(30, 41, 59)
    doc.text(`${year} Cases (${cases.length})`, 14, y)
    doc.setDrawColor(203, 213, 225)
    doc.line(14, y + 1.5, W - 14, y + 1.5)
    y += 5

    autoTable(doc, {
      startY: y,
      head: [['Name', 'Ministry', 'Case Type', 'Days Open', 'Latest Update', 'Next Action Due']],
      body: cases.map((c) => [
        c.subject_name + (isPsdbBlocked(c) ? ' ⚑' : ''),
        c.subject_ministry || '—',
        FAMILY_LABELS[c.case_family] || c.case_family_display || c.case_family,
        c.days_open != null ? String(c.days_open) : '—',
        c.latest_note || c.description || '—',
        c.next_action_due || '—',
      ]),
      theme: 'striped',
      headStyles: { fillColor: [51, 65, 85], textColor: 255, fontSize: 7, fontStyle: 'bold' },
      bodyStyles: { fontSize: 7, textColor: [30, 41, 59] },
      columnStyles: {
        0: { cellWidth: 38 },
        1: { cellWidth: 22 },
        2: { cellWidth: 34 },
        3: { cellWidth: 16, halign: 'center' },
        4: { cellWidth: 80 },
        5: { cellWidth: 28, halign: 'center' },
      },
      didParseCell(data) {
        if (data.section === 'body' && data.column.index === 3) {
          const n = parseInt(data.cell.text[0])
          if (n > 365) data.cell.styles.textColor = [220, 38, 38]
          else if (n > 180) data.cell.styles.textColor = [217, 119, 6]
        }
      },
      margin: { left: 14, right: 14 },
    })
    y = doc.lastAutoTable.finalY + 8
  }

  // PSDB note
  if (y > 175) { doc.addPage(); y = 15 }
  doc.setFont('helvetica', 'italic'); doc.setFontSize(7); doc.setTextColor(100, 116, 139)
  doc.text('⚑ Cases flagged as awaiting PSDB hearing or chairperson appointment.', 14, y)

  // Footer
  const pages = doc.internal.getNumberOfPages()
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i)
    doc.setFontSize(7); doc.setTextColor(148, 163, 184)
    doc.text('CONFIDENTIAL — OPSC Compliance Unit', 14, doc.internal.pageSize.getHeight() - 6)
    doc.text(`Page ${i} of ${pages}`, W - 14, doc.internal.pageSize.getHeight() - 6, { align: 'right' })
  }

  doc.save(`OPSC_Summary_Status_Report_${new Date().toISOString().slice(0, 10)}.pdf`)
}

// ── Year group row ─────────────────────────────────────────────────────────────
function YearGroup({ year, cases }) {
  const [open, setOpen] = useState(true)
  return (
    <div className="mb-6">
      <button
        className="flex items-center gap-2 w-full text-left mb-2 group"
        onClick={() => setOpen((o) => !o)}
      >
        {open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
        <span className="font-semibold text-slate-700 dark:text-slate-200 text-sm">
          {year} Cases
        </span>
        <span className="text-xs text-slate-400 ml-1">({cases.length})</span>
      </button>

      {open && (
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
          <table className="min-w-full text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-left text-[11px] uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2.5">Name</th>
                <th className="px-3 py-2.5">Ministry</th>
                <th className="px-3 py-2.5">Case Type</th>
                <th className="px-3 py-2.5 text-center">Days Open</th>
                <th className="px-3 py-2.5">Latest Update</th>
                <th className="px-3 py-2.5 text-center">Next Action Due</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
              {cases.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="px-3 py-2.5 font-medium text-slate-800 dark:text-slate-100">
                    <div className="flex items-center gap-1.5">
                      {c.subject_name}
                      {isPsdbBlocked(c) && (
                        <span title="Awaiting PSDB" className="inline-flex items-center gap-0.5 rounded bg-orange-100 dark:bg-orange-900/30 px-1.5 py-0.5 text-[10px] font-semibold text-orange-700 dark:text-orange-300">
                          <AlertTriangle size={9} /> PSDB
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-slate-500 dark:text-slate-400 whitespace-nowrap">{c.subject_ministry || '—'}</td>
                  <td className="px-3 py-2.5 text-slate-500 dark:text-slate-400">
                    {FAMILY_LABELS[c.case_family] || c.case_family_display}
                  </td>
                  <td className={`px-3 py-2.5 text-center tabular-nums ${daysOpenCls(c.days_open)}`}>
                    {c.days_open != null ? c.days_open : '—'}
                  </td>
                  <td className="px-3 py-2.5 text-slate-500 dark:text-slate-400 max-w-xs truncate" title={c.latest_note || ''}>
                    {c.latest_note || <span className="italic text-slate-300 dark:text-slate-600">No update</span>}
                  </td>
                  <td className={`px-3 py-2.5 text-center whitespace-nowrap ${nextActionCls(c.next_action_due)}`}>
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

export default function ReportSummary({ cases }) {
  const [exporting, setExporting] = useState(false)

  const grouped = useMemo(() => {
    const map = {}
    cases.forEach((c) => {
      const y = c.year_group ?? new Date(c.date_received).getFullYear()
      if (!map[y]) map[y] = []
      map[y].push(c)
    })
    return Object.entries(map).sort((a, b) => b[0] - a[0])
  }, [cases])

  const handleExport = async () => {
    setExporting(true)
    try { await exportSummaryPdf(grouped) }
    finally { setExporting(false) }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Active disciplinary cases grouped by year of receipt. <span className="text-orange-600 dark:text-orange-400 font-medium">⚑ PSDB</span> = awaiting PSDB hearing.
          </p>
        </div>
        <button
          className="btn-primary flex items-center gap-2 py-2 px-3 text-sm disabled:opacity-60"
          onClick={handleExport}
          disabled={exporting || cases.length === 0}
        >
          {exporting ? <><Loader2 size={14} className="animate-spin" /> Generating…</> : <><Download size={14} /> Export PDF</>}
        </button>
      </div>

      {cases.length === 0
        ? <p className="py-12 text-center text-sm text-slate-400">No cases to display.</p>
        : grouped.map(([year, cs]) => <YearGroup key={year} year={year} cases={cs} />)
      }
    </div>
  )
}
