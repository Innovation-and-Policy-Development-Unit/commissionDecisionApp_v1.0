/**
 * ReportAnalytics — FR-10 Live compliance analytics
 * Four panels:
 *   1. Case volumes by family + outcome
 *   2. Average stage completion time
 *   3. Overdue cases by responsible role
 *   4. Caseload trend (monthly open/close)
 */
import { useState, useEffect, useCallback } from 'react'
import {
  BarChart3, Clock, AlertCircle, TrendingUp, RefreshCw,
  CheckCircle2, Users, Calendar, Download, Loader2,
} from 'lucide-react'
import api from '../../api/client'

// ── colour palettes ────────────────────────────────────────────────────────────
const FAMILY_COLORS = {
  employee_disciplinary:       '#3b82f6',
  serious_misconduct_employee: '#ef4444',
  temporary_suspension:        '#f59e0b',
  grievance:                   '#10b981',
  senior_serious_misconduct:   '#8b5cf6',
  senior_poor_performance:     '#6366f1',
  policy_review:               '#64748b',
}

const OUTCOME_COLORS = {
  reinstate:         '#10b981',
  terminate:         '#ef4444',
  warn:              '#f59e0b',
  demote:            '#f97316',
  suspend_no_pay:    '#e11d48',
  compulsory_retire: '#7c3aed',
  no_action:         '#64748b',
  referred_psdb:     '#3b82f6',
  settled:           '#06b6d4',
  not_settled:       '#dc2626',
}

// ── shared bar component ───────────────────────────────────────────────────────
function HBar({ label, value, max, color = '#3b82f6', sublabel }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0
  return (
    <div className="flex items-center gap-3 py-1.5">
      <div className="w-48 shrink-0 text-xs text-slate-600 dark:text-slate-300 truncate" title={label}>{label}</div>
      <div className="flex-1 rounded-full bg-slate-100 dark:bg-slate-700/60 h-3 overflow-hidden">
        <div className="h-3 rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <div className="w-12 text-right text-xs font-semibold text-slate-700 dark:text-slate-200 tabular-nums">{value}{sublabel ? ` ${sublabel}` : ''}</div>
    </div>
  )
}

// ── inline mini sparkline for trend ───────────────────────────────────────────
function TrendChart({ data }) {
  if (!data || data.length === 0) {
    return <p className="text-sm text-slate-400 py-8 text-center">No trend data yet.</p>
  }

  const maxVal = Math.max(...data.flatMap((d) => [d.opened, d.closed]), 1)
  const H = 100
  const W = 600
  const pad = 32
  const innerW = W - pad * 2
  const innerH = H - 16

  const xOf = (i) => pad + (i / (data.length - 1 || 1)) * innerW
  const yOf = (v) => 8 + (1 - v / maxVal) * innerH

  // Build SVG polyline points
  const openedPts = data.map((d, i) => `${xOf(i)},${yOf(d.opened)}`).join(' ')
  const closedPts = data.map((d, i) => `${xOf(i)},${yOf(d.closed)}`).join(' ')

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H + 30}`} className="w-full min-w-[320px]" xmlns="http://www.w3.org/2000/svg">
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
          const y = 8 + frac * innerH
          return (
            <line key={frac} x1={pad} y1={y} x2={W - pad} y2={y}
              stroke="currentColor" strokeOpacity="0.08" strokeWidth="1" />
          )
        })}

        {/* Opened line */}
        <polyline points={openedPts} fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {/* Closed line */}
        <polyline points={closedPts} fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />

        {/* Dots */}
        {data.map((d, i) => (
          <g key={i}>
            <circle cx={xOf(i)} cy={yOf(d.opened)} r="3" fill="#3b82f6" />
            <circle cx={xOf(i)} cy={yOf(d.closed)}  r="3" fill="#10b981" />
          </g>
        ))}

        {/* Month labels — show every 2nd to avoid crowding */}
        {data.map((d, i) => (
          (i % 2 === 0 || i === data.length - 1) && (
            <text key={i} x={xOf(i)} y={H + 14} textAnchor="middle"
              fontSize="9" fill="currentColor" opacity="0.5">
              {d.month}
            </text>
          )
        ))}
      </svg>

      <div className="flex items-center gap-6 mt-1 text-xs text-slate-500 dark:text-slate-400">
        <span className="flex items-center gap-1.5"><span className="inline-block w-4 h-0.5 bg-blue-500 rounded" /> Cases opened</span>
        <span className="flex items-center gap-1.5"><span className="inline-block w-4 h-0.5 bg-emerald-500 rounded" /> Cases closed</span>
      </div>
    </div>
  )
}

// ── overdue case table ─────────────────────────────────────────────────────────
function OverdueCasesTable({ cases }) {
  if (!cases.length) return (
    <div className="py-8 text-center">
      <CheckCircle2 size={32} className="mx-auto mb-2 text-emerald-400" />
      <p className="text-sm text-slate-400">No overdue stages — all cases on track.</p>
    </div>
  )

  const today = new Date()
  const daysOver = (due) => {
    if (!due) return null
    const diff = Math.ceil((today - new Date(due)) / 86400000)
    return diff > 0 ? diff : null
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
      <table className="min-w-full text-xs">
        <thead className="bg-slate-50 dark:bg-slate-800/60 text-left text-[11px] uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-3 py-2.5">Case</th>
            <th className="px-3 py-2.5">Subject</th>
            <th className="px-3 py-2.5">Ministry</th>
            <th className="px-3 py-2.5">Overdue stage</th>
            <th className="px-3 py-2.5">Responsible</th>
            <th className="px-3 py-2.5 text-right">Days overdue</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
          {cases.map((c) => {
            const over = daysOver(c.due_date)
            return (
              <tr key={c.case_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                <td className="px-3 py-2 font-mono text-primary-600 dark:text-primary-400">{c.reference}</td>
                <td className="px-3 py-2 font-medium text-slate-800 dark:text-slate-100">{c.subject}</td>
                <td className="px-3 py-2 text-slate-500">{c.ministry || '—'}</td>
                <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{c.stage_name}</td>
                <td className="px-3 py-2 text-slate-500">{c.responsible || '—'}</td>
                <td className={`px-3 py-2 text-right font-semibold tabular-nums ${over ? (over > 14 ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400') : 'text-slate-400'}`}>
                  {over != null ? `+${over}d` : (c.due_date ? c.due_date : '—')}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ── PDF export ─────────────────────────────────────────────────────────────────
async function exportAnalyticsPdf(data) {
  const { jsPDF }  = await import('jspdf')
  const autoTable  = (await import('jspdf-autotable')).default

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const W   = doc.internal.pageSize.getWidth()
  const now = new Date().toLocaleString('en-AU', { dateStyle: 'long', timeStyle: 'short' })

  doc.setFillColor(30, 64, 175)
  doc.rect(0, 0, W, 22, 'F')
  doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(255, 255, 255)
  doc.text('Office of the Public Service Commission — Compliance Unit', 14, 9)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9)
  doc.text('Analytics & Performance Report', 14, 15)
  doc.text(now, W - 14, 15, { align: 'right' })

  doc.setTextColor(30, 41, 59)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(15)
  doc.text('Compliance Analytics Report', 14, 33)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(100, 116, 139)
  doc.text(`Generated ${now}`, 14, 38)

  // Summary row
  const { summary } = data
  const stats = [['Total', summary.total], ['Active', summary.active], ['Closed', summary.closed], ['Overdue', summary.overdue_cases]]
  autoTable(doc, {
    startY: 43,
    head:   [stats.map(([l]) => l)],
    body:   [stats.map(([, v]) => String(v))],
    theme:  'grid',
    headStyles: { fillColor: [30, 64, 175], textColor: 255, fontSize: 8, fontStyle: 'bold' },
    bodyStyles: { fontSize: 11, fontStyle: 'bold', halign: 'center', textColor: [30, 41, 59] },
    margin: { left: 14, right: 14 },
  })

  let y = doc.lastAutoTable.finalY + 8

  const sh = (title, yy) => {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(30, 41, 59)
    doc.text(title, 14, yy)
    doc.setDrawColor(203, 213, 225); doc.line(14, yy + 1.5, W - 14, yy + 1.5)
  }

  sh('Cases by Family', y); y += 6
  autoTable(doc, {
    startY: y,
    head: [['Family', 'Total', 'Active', 'Closed']],
    body: data.by_family.map((r) => [r.label, r.total, r.active, r.closed]),
    theme: 'striped',
    headStyles: { fillColor: [51, 65, 85], textColor: 255, fontSize: 8 },
    bodyStyles: { fontSize: 8 },
    columnStyles: { 1: { halign: 'center' }, 2: { halign: 'center' }, 3: { halign: 'center' } },
    margin: { left: 14, right: 14 },
  })
  y = doc.lastAutoTable.finalY + 8

  if (data.by_outcome.length) {
    sh('Decisions by Outcome', y); y += 6
    autoTable(doc, {
      startY: y,
      head: [['Outcome', 'Decisions']],
      body: data.by_outcome.map((r) => [r.label, r.count]),
      theme: 'striped',
      headStyles: { fillColor: [51, 65, 85], textColor: 255, fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      columnStyles: { 1: { halign: 'center' } },
      margin: { left: 14, right: 14 },
    })
    y = doc.lastAutoTable.finalY + 8
  }

  if (data.avg_stage_time.length) {
    if (y > 220) { doc.addPage(); y = 20 }
    sh('Average Stage Completion Time', y); y += 6
    autoTable(doc, {
      startY: y,
      head: [['Stage', 'Avg Days', 'Sample (n)']],
      body: data.avg_stage_time.map((r) => [r.stage_name, r.avg_days, r.sample_n]),
      theme: 'striped',
      headStyles: { fillColor: [51, 65, 85], textColor: 255, fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      columnStyles: { 1: { halign: 'center' }, 2: { halign: 'center' } },
      margin: { left: 14, right: 14 },
    })
    y = doc.lastAutoTable.finalY + 8
  }

  if (data.overdue_cases.length) {
    if (y > 220) { doc.addPage(); y = 20 }
    sh('Overdue Cases', y); y += 6
    autoTable(doc, {
      startY: y,
      head: [['Reference', 'Subject', 'Ministry', 'Overdue Stage', 'Responsible', 'Due Date']],
      body: data.overdue_cases.map((c) => [c.reference, c.subject, c.ministry || '—', c.stage_name, c.responsible || '—', c.due_date || '—']),
      theme: 'striped',
      headStyles: { fillColor: [51, 65, 85], textColor: 255, fontSize: 7 },
      bodyStyles: { fontSize: 7 },
      margin: { left: 14, right: 14 },
    })
  }

  const pages = doc.internal.getNumberOfPages()
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i)
    doc.setFontSize(7); doc.setTextColor(148, 163, 184)
    doc.text('CONFIDENTIAL — OPSC Compliance Unit', 14, 290)
    doc.text(`Page ${i} of ${pages}`, W - 14, 290, { align: 'right' })
  }
  doc.save(`OPSC_Compliance_Analytics_${new Date().toISOString().slice(0, 10)}.pdf`)
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function ReportAnalytics() {
  const [data,      setData]      = useState(null)
  const [loading,   setLoading]   = useState(true)
  const [exporting, setExporting] = useState(false)
  const [error,     setError]     = useState('')

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const res = await api.get('/compliance/cases/analytics/')
      setData(res.data)
    } catch (e) {
      setError(e.response?.data?.detail || 'Could not load analytics.')
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const handleExport = async () => {
    if (!data) return
    setExporting(true)
    try { await exportAnalyticsPdf(data) }
    finally { setExporting(false) }
  }

  if (loading) return <div className="py-16 text-center text-slate-400">Loading analytics…</div>
  if (error)   return <div className="rounded-lg bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-300">{error}</div>
  if (!data)   return null

  const { summary, by_family, by_outcome, avg_stage_time, overdue_by_role, overdue_cases, caseload_trend } = data
  const maxFamily  = Math.max(...by_family.map((r) => r.total), 1)
  const maxOutcome = Math.max(...by_outcome.map((r) => r.count), 1)
  const maxStage   = Math.max(...avg_stage_time.map((r) => r.avg_days), 1)
  const maxRole    = Math.max(...overdue_by_role.map((r) => r.overdue_count), 1)

  return (
    <div className="space-y-6">
      {/* Header + export */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={load} disabled={loading} className="btn-outline flex items-center gap-1.5 py-1.5 px-3 text-xs">
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
          <p className="text-xs text-slate-400">Live data — refreshes on each load</p>
        </div>
        <button
          onClick={handleExport}
          disabled={exporting}
          className="btn-primary flex items-center gap-2 py-2 px-3 text-sm disabled:opacity-60"
        >
          {exporting
            ? <><Loader2 size={14} className="animate-spin" /> Generating…</>
            : <><Download size={14} /> Export PDF</>
          }
        </button>
      </div>

      {/* Summary KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total cases',   value: summary.total,         cls: 'text-slate-800 dark:text-slate-100', Icon: BarChart3,   iconCls: 'text-primary-500' },
          { label: 'Active cases',  value: summary.active,        cls: 'text-blue-700 dark:text-blue-300',   Icon: Clock,       iconCls: 'text-blue-500' },
          { label: 'Closed cases',  value: summary.closed,        cls: 'text-emerald-700 dark:text-emerald-300', Icon: CheckCircle2, iconCls: 'text-emerald-500' },
          { label: 'Overdue cases', value: summary.overdue_cases, cls: summary.overdue_cases > 0 ? 'text-red-700 dark:text-red-300' : 'text-slate-500', Icon: AlertCircle, iconCls: summary.overdue_cases > 0 ? 'text-red-500' : 'text-slate-400' },
        ].map(({ label, value, cls, Icon, iconCls }) => (
          <div key={label} className="rounded-xl border border-slate-200 dark:border-slate-700 p-4">
            <div className="flex items-center gap-2 mb-1">
              <Icon size={15} className={iconCls} />
              <span className="text-xs text-slate-500">{label}</span>
            </div>
            <div className={`text-2xl font-bold ${cls}`}>{value}</div>
          </div>
        ))}
      </div>

      {/* Row 1: Volumes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Case volumes by family */}
        <section className="rounded-xl border border-slate-200 dark:border-slate-700 p-5">
          <h3 className="mb-4 flex items-center gap-2 font-semibold text-slate-700 dark:text-slate-200">
            <BarChart3 size={16} /> Case volumes by family
          </h3>
          {by_family.length === 0
            ? <p className="text-sm text-slate-400">No cases yet.</p>
            : by_family.map((r) => (
                <div key={r.family} className="mb-1">
                  <HBar label={r.label} value={r.total} max={maxFamily} color={FAMILY_COLORS[r.family] ?? '#3b82f6'} />
                  <div className="flex pl-48 gap-3 text-[10px] text-slate-400 -mt-1 mb-1">
                    <span className="text-blue-500">{r.active} active</span>
                    <span className="text-emerald-500">{r.closed} closed</span>
                  </div>
                </div>
              ))
          }
        </section>

        {/* Outcomes by type */}
        <section className="rounded-xl border border-slate-200 dark:border-slate-700 p-5">
          <h3 className="mb-4 flex items-center gap-2 font-semibold text-slate-700 dark:text-slate-200">
            <CheckCircle2 size={16} /> Decisions by outcome
          </h3>
          {by_outcome.length === 0
            ? (
              <div className="py-6 text-center">
                <p className="text-sm text-slate-400">No decisions recorded yet.</p>
                <p className="text-xs text-slate-400 mt-1">Outcomes will appear here once decisions are recorded in case files.</p>
              </div>
            )
            : by_outcome.map((r) => (
                <HBar key={r.outcome} label={r.label} value={r.count} max={maxOutcome} color={OUTCOME_COLORS[r.outcome] ?? '#64748b'} />
              ))
          }
        </section>
      </div>

      {/* Row 2: Stage timing + Overdue by role */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Average stage completion time */}
        <section className="rounded-xl border border-slate-200 dark:border-slate-700 p-5">
          <h3 className="mb-4 flex items-center gap-2 font-semibold text-slate-700 dark:text-slate-200">
            <Clock size={16} /> Avg stage completion time
          </h3>
          {avg_stage_time.length === 0
            ? (
              <div className="py-6 text-center">
                <Clock size={28} className="mx-auto mb-2 text-slate-300 dark:text-slate-600" />
                <p className="text-sm text-slate-400">No completed stages with timing data yet.</p>
                <p className="text-xs text-slate-400 mt-1">This panel fills as stages are started and completed.</p>
              </div>
            )
            : avg_stage_time.map((r) => (
                <HBar
                  key={r.stage_code}
                  label={r.stage_name}
                  value={r.avg_days}
                  max={maxStage}
                  color={r.avg_days > 21 ? '#ef4444' : r.avg_days > 10 ? '#f59e0b' : '#10b981'}
                  sublabel={`d (n=${r.sample_n})`}
                />
              ))
          }
        </section>

        {/* Overdue by responsible role */}
        <section className="rounded-xl border border-slate-200 dark:border-slate-700 p-5">
          <h3 className="mb-4 flex items-center gap-2 font-semibold text-slate-700 dark:text-slate-200">
            <Users size={16} /> Overdue stages by responsible role
          </h3>
          {overdue_by_role.length === 0
            ? (
              <div className="py-6 text-center">
                <CheckCircle2 size={28} className="mx-auto mb-2 text-emerald-400" />
                <p className="text-sm text-slate-400">No overdue stages — all on track.</p>
              </div>
            )
            : overdue_by_role.map((r) => (
                <HBar key={r.role} label={r.label} value={r.overdue_count} max={maxRole} color="#ef4444" sublabel="stages" />
              ))
          }
        </section>
      </div>

      {/* Row 3: Caseload trend */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-700 p-5">
        <h3 className="mb-4 flex items-center gap-2 font-semibold text-slate-700 dark:text-slate-200">
          <TrendingUp size={16} /> Caseload trend — last 18 months
        </h3>
        <TrendChart data={caseload_trend} />
      </section>

      {/* Row 4: Overdue case detail table */}
      {overdue_cases.length > 0 && (
        <section className="rounded-xl border border-red-200 dark:border-red-800 p-5">
          <h3 className="mb-3 flex items-center gap-2 font-semibold text-red-700 dark:text-red-300">
            <AlertCircle size={16} /> Overdue cases requiring attention
            <span className="text-xs font-normal text-red-500 dark:text-red-400">(up to 20 shown)</span>
          </h3>
          <OverdueCasesTable cases={overdue_cases} />
        </section>
      )}

      {/* Monthly breakdown table */}
      {caseload_trend.length > 0 && (
        <section className="rounded-xl border border-slate-200 dark:border-slate-700 p-5">
          <h3 className="mb-3 flex items-center gap-2 font-semibold text-slate-700 dark:text-slate-200">
            <Calendar size={16} /> Monthly breakdown
          </h3>
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-[11px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2.5 text-left">Month</th>
                  <th className="px-4 py-2.5 text-center">Opened</th>
                  <th className="px-4 py-2.5 text-center">Closed</th>
                  <th className="px-4 py-2.5 text-center">Net</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                {[...caseload_trend].reverse().map((d) => {
                  const net = d.opened - d.closed
                  return (
                    <tr key={d.month} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="px-4 py-2 font-mono text-slate-600 dark:text-slate-300">{d.month}</td>
                      <td className="px-4 py-2 text-center text-blue-600 dark:text-blue-400 font-medium">{d.opened}</td>
                      <td className="px-4 py-2 text-center text-emerald-600 dark:text-emerald-400 font-medium">{d.closed}</td>
                      <td className={`px-4 py-2 text-center font-semibold ${net > 0 ? 'text-red-600 dark:text-red-400' : net < 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
                        {net > 0 ? `+${net}` : net}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}
