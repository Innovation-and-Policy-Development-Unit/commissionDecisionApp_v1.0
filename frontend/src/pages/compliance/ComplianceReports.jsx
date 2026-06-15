/**
 * ComplianceReports — tabbed reporting hub
 * Tab 1: Summary Status Report  (ReportSummary)
 * Tab 2: Disciplinary Tracker   (ReportDisciplinary)
 * Tab 3: NSDP Annual Trend      (ReportNSDP)
 * Tab 4: Aggregate Stats        (inline — aggregate charts + PDF, existing behaviour)
 */
import { useState, useEffect, useCallback } from 'react'
import { BarChart3, RefreshCw, AlertCircle, Clock, CheckCircle2, Download, Loader2, FileText, TrendingDown, ClipboardList } from 'lucide-react'
import api from '../../api/client'
import PageHeader from '../../components/shared/PageHeader'
import ReportSummary     from './ReportSummary'
import ReportDisciplinary from './ReportDisciplinary'
import ReportNSDP        from './ReportNSDP'

const FAMILY_LABELS = {
  employee_disciplinary:       'Employee Disciplinary',
  serious_misconduct_employee: 'Serious Misconduct (Employee)',
  temporary_suspension:        'Temporary Suspension',
  grievance:                   'Grievance',
  senior_serious_misconduct:   'Senior Exec — Serious Misconduct',
  senior_poor_performance:     'Senior Exec — Poor Performance',
  policy_review:               'Policy / PSA Amendment',
}

const FAMILY_COLORS = {
  employee_disciplinary:       'bg-blue-500',
  serious_misconduct_employee: 'bg-red-500',
  temporary_suspension:        'bg-amber-500',
  grievance:                   'bg-emerald-500',
  senior_serious_misconduct:   'bg-purple-500',
  senior_poor_performance:     'bg-indigo-500',
  policy_review:               'bg-slate-500',
}

const STATUS_ORDER = ['draft', 'pending_manager_approval', 'active', 'with_secretary', 'with_commission', 'closed', 'archived']

const TABS = [
  { key: 'summary',       label: 'Summary Status',     icon: FileText },
  { key: 'disciplinary',  label: 'Disciplinary Tracker', icon: ClipboardList },
  { key: 'nsdp',          label: 'Annual Trend (NSDP)',  icon: TrendingDown },
  { key: 'aggregate',     label: 'Aggregate Stats',     icon: BarChart3 },
]

function BarRow({ label, value, max, colorCls = 'bg-primary-500' }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div className="flex items-center gap-3 py-1.5">
      <div className="w-44 shrink-0 text-xs text-slate-600 dark:text-slate-300 truncate">{label}</div>
      <div className="flex-1 rounded-full bg-slate-100 dark:bg-slate-700 h-3 overflow-hidden">
        <div className={`h-3 rounded-full ${colorCls}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="w-8 text-right text-xs font-semibold text-slate-700 dark:text-slate-200">{value}</div>
    </div>
  )
}

// ── Aggregate PDF (unchanged from original) ───────────────────────────────────
async function exportAggregatePdf(aggregates) {
  const { jsPDF } = await import('jspdf')
  const autoTable  = (await import('jspdf-autotable')).default

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const W   = doc.internal.pageSize.getWidth()
  const now = new Date().toLocaleString('en-AU', { dateStyle: 'long', timeStyle: 'short' })

  doc.setFillColor(30, 64, 175)
  doc.rect(0, 0, W, 22, 'F')
  doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(255, 255, 255)
  doc.text('Office of the Public Service Commission', 14, 9)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9)
  doc.text('Compliance Case Management System', 14, 15)
  doc.text(now, W - 14, 15, { align: 'right' })

  doc.setTextColor(30, 41, 59)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(16)
  doc.text('Compliance Case Report', 14, 34)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(100, 116, 139)
  doc.text('Aggregate statistics — all compliance cases', 14, 40)

  const { total, open, overdue, atRisk, senior } = aggregates.summary
  const stats = [['Total cases', total], ['Open cases', open], ['Overdue SLA', overdue], ['At risk', atRisk], ['Senior exec', senior]]
  autoTable(doc, {
    startY: 46,
    head:   [stats.map(([l]) => l)],
    body:   [stats.map(([, v]) => String(v))],
    theme:  'grid',
    headStyles:  { fillColor: [30, 64, 175], textColor: 255, fontSize: 8, fontStyle: 'bold' },
    bodyStyles:  { fontSize: 10, fontStyle: 'bold', halign: 'center', textColor: [30, 41, 59] },
    margin: { left: 14, right: 14 },
  })

  let y = doc.lastAutoTable.finalY + 8
  const sh = (title, yy) => {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(30, 41, 59)
    doc.text(title, 14, yy)
    doc.setDrawColor(203, 213, 225); doc.line(14, yy + 1.5, W - 14, yy + 1.5)
  }

  sh('Cases by Case Family', y); y += 6
  autoTable(doc, {
    startY: y,
    head: [['Case family', 'Count', 'Overdue SLA', 'Closed']],
    body: aggregates.byFamily.map(({ label, total: t, overdue: od, closed: cl }) => [label, t, od, cl]),
    theme: 'striped',
    headStyles: { fillColor: [51, 65, 85], textColor: 255, fontSize: 8 },
    bodyStyles: { fontSize: 8, textColor: [30, 41, 59] },
    columnStyles: { 1: { halign: 'center' }, 2: { halign: 'center' }, 3: { halign: 'center' } },
    margin: { left: 14, right: 14 },
  })
  y = doc.lastAutoTable.finalY + 8

  const { slaOverdue, slaAtRisk, slaOnTrack, slaDone, slaTotal } = aggregates.sla
  const pct = (n) => slaTotal > 0 ? `${Math.round((n / slaTotal) * 100)}%` : '—'
  sh('SLA Health (All Stages)', y); y += 6
  autoTable(doc, {
    startY: y,
    head: [['Status', 'Count', 'Share']],
    body: [['Overdue', slaOverdue, pct(slaOverdue)], ['At risk', slaAtRisk, pct(slaAtRisk)], ['On track', slaOnTrack, pct(slaOnTrack)], ['Completed', slaDone, pct(slaDone)]],
    theme: 'striped',
    headStyles: { fillColor: [51, 65, 85], textColor: 255, fontSize: 8 },
    bodyStyles: { fontSize: 8, textColor: [30, 41, 59] },
    columnStyles: { 1: { halign: 'center' }, 2: { halign: 'center' } },
    margin: { left: 14, right: 14 },
  })
  y = doc.lastAutoTable.finalY + 8

  if (aggregates.byStatus.length) {
    sh('Cases by Status', y); y += 6
    autoTable(doc, {
      startY: y,
      head: [['Status', 'Count']],
      body: aggregates.byStatus.map(({ status, count }) => [status.replace(/_/g, ' '), count]),
      theme: 'striped',
      headStyles: { fillColor: [51, 65, 85], textColor: 255, fontSize: 8 },
      bodyStyles: { fontSize: 8, textColor: [30, 41, 59] },
      columnStyles: { 1: { halign: 'center' } },
      margin: { left: 14, right: 14 },
    })
    y = doc.lastAutoTable.finalY + 8
  }

  if (aggregates.bySenior.length) {
    if (y > 230) { doc.addPage(); y = 20 }
    sh('Senior Executive Cases', y); y += 6
    autoTable(doc, {
      startY: y,
      head: [['Case family', 'Count']],
      body: aggregates.bySenior.map(({ label, count }) => [label, count]),
      theme: 'striped',
      headStyles: { fillColor: [88, 28, 135], textColor: 255, fontSize: 8 },
      bodyStyles: { fontSize: 8, textColor: [30, 41, 59] },
      columnStyles: { 1: { halign: 'center' } },
      margin: { left: 14, right: 14 },
    })
  }

  const pageCount = doc.internal.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(7); doc.setTextColor(148, 163, 184)
    doc.text('CONFIDENTIAL — OPSC Compliance Unit', 14, 290)
    doc.text(`Page ${i} of ${pageCount}`, W - 14, 290, { align: 'right' })
  }
  doc.save(`OPSC_Compliance_Report_${new Date().toISOString().slice(0, 10)}.pdf`)
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function ComplianceReports() {
  const [cases,     setCases]     = useState([])
  const [loading,   setLoading]   = useState(true)
  const [exporting, setExporting] = useState(false)
  const [error,     setError]     = useState('')
  const [activeTab, setActiveTab] = useState('summary')

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const res = await api.get('/compliance/cases/')
      setCases(res.data?.results ?? res.data ?? [])
    } catch (e) {
      setError(e.response?.data?.detail || 'Could not load cases.')
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  // ── Aggregates (for the Aggregate Stats tab) ──────────────────────────────
  const byFamilyMap = {}
  cases.forEach((c) => {
    if (!byFamilyMap[c.case_family]) byFamilyMap[c.case_family] = { label: FAMILY_LABELS[c.case_family] || c.case_family_display, total: 0, overdue: 0, closed: 0 }
    byFamilyMap[c.case_family].total++
    if ((c.sla_summary?.overdue ?? 0) > 0) byFamilyMap[c.case_family].overdue++
    if (c.status === 'closed' || c.status === 'archived') byFamilyMap[c.case_family].closed++
  })
  const byStatusMap = {}
  cases.forEach((c) => { byStatusMap[c.status] = (byStatusMap[c.status] || 0) + 1 })
  const slaOverdue = cases.reduce((s, c) => s + (c.sla_summary?.overdue  ?? 0), 0)
  const slaAtRisk  = cases.reduce((s, c) => s + (c.sla_summary?.at_risk  ?? 0), 0)
  const slaOnTrack = cases.reduce((s, c) => s + (c.sla_summary?.on_track ?? 0), 0)
  const slaDone    = cases.reduce((s, c) => s + (c.sla_summary?.completed ?? 0), 0)
  const slaTotal   = slaOverdue + slaAtRisk + slaOnTrack + slaDone
  const seniorCases = cases.filter((c) => c.is_senior_executive)
  const bySeniorMap = {}
  seniorCases.forEach((c) => { bySeniorMap[c.case_family] = (bySeniorMap[c.case_family] || 0) + 1 })
  const maxFamily = Math.max(...Object.values(byFamilyMap).map((f) => f.total), 1)
  const maxStatus = Math.max(...Object.values(byStatusMap), 1)
  const maxSenior = Math.max(...Object.values(bySeniorMap), 1)

  const handleAggregateExport = async () => {
    setExporting(true)
    try {
      await exportAggregatePdf({
        summary: {
          total:   cases.length,
          open:    cases.filter((c) => c.status !== 'closed' && c.status !== 'archived').length,
          overdue: cases.filter((c) => (c.sla_summary?.overdue ?? 0) > 0).length,
          atRisk:  cases.filter((c) => (c.sla_summary?.at_risk  ?? 0) > 0).length,
          senior:  seniorCases.length,
        },
        byFamily: Object.entries(byFamilyMap).sort((a, b) => b[1].total - a[1].total).map(([, v]) => v),
        sla: { slaOverdue, slaAtRisk, slaOnTrack, slaDone, slaTotal },
        byStatus: STATUS_ORDER.filter((s) => byStatusMap[s]).map((s) => ({ status: s, count: byStatusMap[s] })),
        bySenior: Object.entries(bySeniorMap).sort((a, b) => b[1] - a[1]).map(([key, count]) => ({ label: FAMILY_LABELS[key] || key, count })),
      })
    } finally { setExporting(false) }
  }

  return (
    <div>
      <PageHeader
        title="Case Reports"
        subtitle="Compliance reporting — summary status, disciplinary tracker, annual trend, and aggregate statistics"
        action={
          <div className="flex items-center gap-2">
            <button className="btn-outline flex items-center gap-2 py-2 px-3 text-sm" onClick={load} disabled={loading}>
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Refresh
            </button>
          </div>
        }
      />

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-300">{error}</div>
      )}

      {/* Tab bar */}
      <div className="flex gap-1 rounded-xl border border-slate-200 dark:border-slate-700 p-1 bg-slate-50 dark:bg-slate-800/60 mb-6 flex-wrap">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === key
                ? 'bg-white dark:bg-slate-700 text-primary-700 dark:text-primary-300 shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
            }`}
          >
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-16 text-center text-slate-400">Loading…</div>
      ) : (
        <>
          {activeTab === 'summary'      && <ReportSummary cases={cases} />}
          {activeTab === 'disciplinary' && <ReportDisciplinary cases={cases} onRefresh={load} />}
          {activeTab === 'nsdp'         && <ReportNSDP cases={cases} />}
          {activeTab === 'aggregate'    && (
            <div>
              <div className="flex justify-end mb-4">
                <button
                  className="btn-primary flex items-center gap-2 py-2 px-3 text-sm disabled:opacity-60"
                  onClick={handleAggregateExport}
                  disabled={exporting || cases.length === 0}
                >
                  {exporting
                    ? <><Loader2 size={15} className="animate-spin" /> Generating…</>
                    : <><Download size={15} /> Export PDF</>
                  }
                </button>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <section className="rounded-xl border border-slate-200 dark:border-slate-700 p-5">
                  <h3 className="mb-4 flex items-center gap-2 font-semibold text-slate-700 dark:text-slate-200"><BarChart3 size={16} /> Cases by family</h3>
                  {Object.keys(byFamilyMap).length === 0
                    ? <p className="text-sm text-slate-400">No cases yet.</p>
                    : Object.entries(byFamilyMap).sort((a, b) => b[1].total - a[1].total)
                        .map(([key, { label, total }]) => (
                          <BarRow key={key} label={label} value={total} max={maxFamily} colorCls={FAMILY_COLORS[key] || 'bg-primary-500'} />
                        ))
                  }
                </section>
                <section className="rounded-xl border border-slate-200 dark:border-slate-700 p-5">
                  <h3 className="mb-4 flex items-center gap-2 font-semibold text-slate-700 dark:text-slate-200"><Clock size={16} /> SLA health (all stages)</h3>
                  <div className="space-y-3">
                    {[
                      { label: 'Overdue',   n: slaOverdue, Icon: AlertCircle,  cls: 'text-red-500',     bar: 'bg-red-500' },
                      { label: 'At risk',   n: slaAtRisk,  Icon: Clock,        cls: 'text-amber-500',   bar: 'bg-amber-500' },
                      { label: 'On track',  n: slaOnTrack, Icon: null,         cls: 'text-slate-400',   bar: 'bg-slate-400' },
                      { label: 'Completed', n: slaDone,    Icon: CheckCircle2, cls: 'text-emerald-500', bar: 'bg-emerald-500' },
                    ].map(({ label, n, Icon, cls, bar }) => (
                      <div key={label} className="flex items-center gap-3">
                        {Icon ? <Icon size={15} className={`${cls} shrink-0`} /> : <div className="w-[15px] h-[15px] shrink-0 rounded-full bg-slate-400" />}
                        <span className="w-24 text-xs text-slate-600 dark:text-slate-300">{label}</span>
                        <div className="flex-1 rounded-full bg-slate-100 dark:bg-slate-700 h-3 overflow-hidden">
                          <div className={`h-3 rounded-full ${bar}`} style={{ width: `${slaTotal > 0 ? Math.round((n / slaTotal) * 100) : 0}%` }} />
                        </div>
                        <span className="w-8 text-right text-xs font-semibold text-slate-700 dark:text-slate-200">{n}</span>
                      </div>
                    ))}
                  </div>
                </section>
                <section className="rounded-xl border border-slate-200 dark:border-slate-700 p-5">
                  <h3 className="mb-4 flex items-center gap-2 font-semibold text-slate-700 dark:text-slate-200"><BarChart3 size={16} /> Cases by status</h3>
                  {Object.keys(byStatusMap).length === 0
                    ? <p className="text-sm text-slate-400">No cases yet.</p>
                    : STATUS_ORDER.filter((s) => byStatusMap[s]).map((s) => (
                        <BarRow key={s} label={s.replace(/_/g, ' ')} value={byStatusMap[s]} max={maxStatus} />
                      ))
                  }
                </section>
                <section className="rounded-xl border border-slate-200 dark:border-slate-700 p-5">
                  <h3 className="mb-4 flex items-center gap-2 font-semibold text-slate-700 dark:text-slate-200"><BarChart3 size={16} /> Senior executive cases</h3>
                  {seniorCases.length === 0
                    ? <p className="text-sm text-slate-400">No senior executive cases.</p>
                    : Object.entries(bySeniorMap).sort((a, b) => b[1] - a[1]).map(([key, n]) => (
                        <BarRow key={key} label={FAMILY_LABELS[key] || key} value={n} max={maxSenior} colorCls={FAMILY_COLORS[key] || 'bg-primary-500'} />
                      ))
                  }
                </section>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
