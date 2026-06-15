/**
 * ReportNSDP — Annual Trend Report (NSDP PSDB Progress Review)
 * Auto-generates the 5-year summary table from live DB data.
 * Mirrors the NSDP template: registered cases, PSDB referrals, dismissals,
 * reinstatements, unresolved, other sanctions.
 */
import { useMemo, useState } from 'react'
import { Download, Loader2, TrendingDown, TrendingUp, Minus } from 'lucide-react'

// ── Derive annual stats from case data ────────────────────────────────────────
function buildYearStats(cases) {
  const map = {}
  cases.forEach((c) => {
    const y = c.year_group ?? new Date(c.date_received).getFullYear()
    if (!map[y]) map[y] = { year: y, total: 0, psdb: 0, closed: 0, active: 0, senior: 0 }
    map[y].total++
    // PSDB referral: description/notes mention PSDB
    const text = ((c.description || '') + ' ' + (c.latest_note || '')).toLowerCase()
    if (text.includes('psdb')) map[y].psdb++
    if (c.status === 'closed' || c.status === 'archived') map[y].closed++
    else map[y].active++
    if (c.is_senior_executive) map[y].senior++
  })
  return Object.values(map).sort((a, b) => a.year - b.year)
}

function TrendIcon({ current, prev }) {
  if (prev == null || prev === 0) return null
  const delta = current - prev
  if (delta < 0) return <TrendingDown size={13} className="text-emerald-500 inline-block ml-1" title={`${delta} vs prior year`} />
  if (delta > 0) return <TrendingUp size={13} className="text-red-500 inline-block ml-1" title={`+${delta} vs prior year`} />
  return <Minus size={13} className="text-slate-400 inline-block ml-1" />
}

// ── Sparkline bar ─────────────────────────────────────────────────────────────
function SparkBar({ value, max, colorCls = 'bg-blue-500' }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div className="inline-flex items-center gap-1.5 align-middle">
      <div className="w-16 h-2 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
        <div className={`h-2 rounded-full ${colorCls}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="tabular-nums font-semibold">{value}</span>
    </div>
  )
}

// ── PDF export ────────────────────────────────────────────────────────────────
async function exportNsdpPdf(rows) {
  const { jsPDF }  = await import('jspdf')
  const autoTable  = (await import('jspdf-autotable')).default

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const W   = doc.internal.pageSize.getWidth()
  const now = new Date().toLocaleString('en-AU', { dateStyle: 'long', timeStyle: 'short' })

  // Header
  doc.setFillColor(30, 64, 175)
  doc.rect(0, 0, W, 22, 'F')
  doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(255, 255, 255)
  doc.text('Office of the Public Service Commission', 14, 9)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9)
  doc.text('NSDP — Annual Disciplinary Trend Report', 14, 15)
  doc.text(now, W - 14, 15, { align: 'right' })

  doc.setTextColor(30, 41, 59)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(15)
  doc.text('Annual PSDB Disciplinary Trend', 14, 34)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(100, 116, 139)
  doc.text('Reduction in Annual Public Service Disciplinary Board (PSDB) Decisions', 14, 40)

  autoTable(doc, {
    startY: 46,
    head: [['Year', 'Total Registered', 'Referred to PSDB', 'Closed / Resolved', 'Ongoing', 'Senior Exec', 'YoY Change']],
    body: rows.map((r, i) => {
      const prev = i > 0 ? rows[i - 1].total : null
      const delta = prev != null ? r.total - prev : null
      return [
        String(r.year),
        String(r.total),
        String(r.psdb),
        String(r.closed),
        String(r.active),
        String(r.senior),
        delta == null ? '—' : delta > 0 ? `+${delta}` : String(delta),
      ]
    }),
    theme: 'striped',
    headStyles: { fillColor: [30, 64, 175], textColor: 255, fontSize: 8, fontStyle: 'bold' },
    bodyStyles: { fontSize: 9, textColor: [30, 41, 59] },
    columnStyles: {
      0: { fontStyle: 'bold' },
      1: { halign: 'center' },
      2: { halign: 'center' },
      3: { halign: 'center' },
      4: { halign: 'center' },
      5: { halign: 'center' },
      6: { halign: 'center' },
    },
    didParseCell(data) {
      if (data.section === 'body' && data.column.index === 6) {
        const v = data.cell.text[0]
        if (v.startsWith('+')) data.cell.styles.textColor = [220, 38, 38]
        else if (v.startsWith('-')) data.cell.styles.textColor = [22, 163, 74]
      }
    },
    margin: { left: 14, right: 14 },
  })

  let y = doc.lastAutoTable.finalY + 12

  // Key highlights section (auto-generated bullets)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(30, 41, 59)
  doc.text('Key Highlights', 14, y); y += 6
  doc.setDrawColor(203, 213, 225); doc.line(14, y - 2, W - 14, y - 2)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(51, 65, 85)

  const bullets = buildHighlights(rows)
  bullets.forEach((b) => {
    const lines = doc.splitTextToSize(`• ${b}`, W - 28)
    if (y + lines.length * 5 > 270) { doc.addPage(); y = 20 }
    doc.text(lines, 14, y); y += lines.length * 5 + 2
  })

  // Footer
  const pages = doc.internal.getNumberOfPages()
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i)
    doc.setFontSize(7); doc.setTextColor(148, 163, 184)
    doc.text('CONFIDENTIAL — OPSC Compliance Unit', 14, 290)
    doc.text(`Page ${i} of ${pages}`, W - 14, 290, { align: 'right' })
  }

  doc.save(`OPSC_NSDP_Annual_Trend_${new Date().toISOString().slice(0, 10)}.pdf`)
}

function buildHighlights(rows) {
  const bullets = []
  if (rows.length < 2) return ['Insufficient data for year-on-year analysis.']

  const first = rows[0]
  const last  = rows[rows.length - 1]
  const totalDelta = last.total - first.total
  if (totalDelta < 0) {
    bullets.push(`Total registered disciplinary cases reduced by ${Math.abs(totalDelta)} (from ${first.total} in ${first.year} to ${last.total} in ${last.year}), reflecting improved internal case management.`)
  } else if (totalDelta > 0) {
    bullets.push(`Total registered disciplinary cases increased by ${totalDelta} (from ${first.total} in ${first.year} to ${last.total} in ${last.year}).`)
  }

  const maxPsdb = rows.reduce((m, r) => r.psdb > m.psdb ? r : m, rows[0])
  if (maxPsdb.psdb > 0) {
    bullets.push(`PSDB referrals peaked at ${maxPsdb.psdb} in ${maxPsdb.year}. Cases referred to the PSDB represent the most serious matters requiring Board-level determination.`)
  }

  const maxActive = rows.reduce((m, r) => r.active > m.active ? r : m, rows[0])
  bullets.push(`${last.year} recorded ${last.active} ongoing case${last.active !== 1 ? 's' : ''} pending resolution.`)

  if (last.senior > 0) {
    bullets.push(`${last.senior} senior executive case${last.senior !== 1 ? 's' : ''} ${last.senior > 1 ? 'are' : 'is'} currently active, requiring heightened oversight under the applicable statutory procedure.`)
  }

  bullets.push('The PSC continues to strengthen the Ministerial Disciplinary Committee (MDC) model to reduce escalation to the PSDB and improve early resolution of disciplinary matters.')
  bullets.push('Ongoing alignment with NSDP governance objectives — reducing employment disciplinary cases through preventive, fair, and effective public service management.')

  return bullets
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function ReportNSDP({ cases }) {
  const [exporting, setExporting] = useState(false)

  const rows = useMemo(() => buildYearStats(cases), [cases])
  const maxTotal = Math.max(...rows.map((r) => r.total), 1)

  const highlights = useMemo(() => buildHighlights(rows), [rows])

  const handleExport = async () => {
    setExporting(true)
    try { await exportNsdpPdf(rows) }
    finally { setExporting(false) }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Annual disciplinary case trend — auto-generated from live CCMS data. Mirrors the NSDP PSDB Progress Review template.
        </p>
        <button
          className="btn-primary flex items-center gap-2 py-2 px-3 text-sm disabled:opacity-60"
          onClick={handleExport}
          disabled={exporting || rows.length === 0}
        >
          {exporting ? <><Loader2 size={14} className="animate-spin" /> Generating…</> : <><Download size={14} /> Export PDF</>}
        </button>
      </div>

      {rows.length === 0 ? (
        <p className="py-12 text-center text-sm text-slate-400">No case data available.</p>
      ) : (
        <>
          {/* Year-on-year table */}
          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700 mb-6">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Year</th>
                  <th className="px-4 py-3">Total Registered</th>
                  <th className="px-4 py-3 text-center">Referred to PSDB</th>
                  <th className="px-4 py-3 text-center">Closed / Resolved</th>
                  <th className="px-4 py-3 text-center">Ongoing</th>
                  <th className="px-4 py-3 text-center">Senior Exec</th>
                  <th className="px-4 py-3 text-center">YoY</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                {rows.map((r, i) => {
                  const prev = i > 0 ? rows[i - 1] : null
                  const delta = prev != null ? r.total - prev.total : null
                  return (
                    <tr key={r.year} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="px-4 py-3 font-bold text-slate-700 dark:text-slate-200">{r.year}</td>
                      <td className="px-4 py-3">
                        <SparkBar value={r.total} max={maxTotal} colorCls="bg-blue-500" />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`font-semibold ${r.psdb > 0 ? 'text-purple-600 dark:text-purple-400' : 'text-slate-400'}`}>
                          {r.psdb}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="font-semibold text-emerald-600 dark:text-emerald-400">{r.closed}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`font-semibold ${r.active > 5 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-600 dark:text-slate-300'}`}>
                          {r.active}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`font-semibold ${r.senior > 0 ? 'text-purple-600 dark:text-purple-400' : 'text-slate-400'}`}>
                          {r.senior}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-xs font-semibold">
                        {delta == null ? (
                          <span className="text-slate-400">—</span>
                        ) : delta < 0 ? (
                          <span className="text-emerald-600 dark:text-emerald-400 flex items-center justify-center gap-0.5">
                            <TrendingDown size={12} /> {delta}
                          </span>
                        ) : delta > 0 ? (
                          <span className="text-red-600 dark:text-red-400 flex items-center justify-center gap-0.5">
                            <TrendingUp size={12} /> +{delta}
                          </span>
                        ) : (
                          <span className="text-slate-400"><Minus size={12} className="inline" /></span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Key Highlights — auto-generated */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-5">
            <h3 className="font-semibold text-slate-700 dark:text-slate-200 mb-3 text-sm">Key Highlights</h3>
            <ul className="space-y-2.5">
              {highlights.map((b, i) => (
                <li key={i} className="flex gap-2 text-sm text-slate-600 dark:text-slate-300">
                  <span className="shrink-0 mt-0.5 w-4 h-4 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 text-[10px] font-bold flex items-center justify-center">
                    {i + 1}
                  </span>
                  {b}
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  )
}
