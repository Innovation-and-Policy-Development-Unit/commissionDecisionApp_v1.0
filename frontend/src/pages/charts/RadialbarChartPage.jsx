import PageHeader from '../../components/shared/PageHeader'
import {
  RadialBarChart, RadialBar, RadarChart, Radar,
  PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, Tooltip, Legend
} from 'recharts'
import { Target, Users, Award, TrendingUp } from 'lucide-react'
import useChartColors from '../../hooks/useChartColors'

// ─── Data (no color references) ─────────────────────────────────────────────
const radarTeamA = [
  { subject: 'Communication', A: 88, B: 72 },
  { subject: 'Technical',     A: 92, B: 85 },
  { subject: 'Leadership',    A: 74, B: 90 },
  { subject: 'Creativity',    A: 80, B: 68 },
  { subject: 'Teamwork',      A: 96, B: 78 },
  { subject: 'Delivery',      A: 85, B: 94 },
]

// ─── Custom Tooltip ──────────────────────────────────────────────────────────
const RadialTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null
  const d = payload[0]
  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 shadow-lg">
      <p className="font-semibold text-xs text-slate-700 dark:text-slate-300">{d.payload.name}</p>
      <p className="text-xs mt-0.5" style={{ color: d.payload.fill }}>{d.value}%</p>
    </div>
  )
}

const RadarTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 shadow-lg min-w-[140px]">
      <p className="font-semibold text-xs text-slate-700 dark:text-slate-300 mb-1.5">{label}</p>
      {payload.map(p => (
        <div key={p.dataKey} className="flex items-center gap-1.5 text-xs">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
          <span className="text-slate-500">{p.name}:</span>
          <span className="font-semibold" style={{ color: p.color }}>{p.value}</span>
        </div>
      ))}
    </div>
  )
}

// ─── Chart Card ──────────────────────────────────────────────────────────────
function ChartCard({ title, subtitle, children }) {
  return (
    <div className="card">
      <div className="px-6 pt-5 pb-4 border-b border-slate-100 dark:border-slate-700/60">
        <h3 className="font-bold text-slate-800 dark:text-slate-100">{title}</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p>
      </div>
      <div className="p-6">{children}</div>
    </div>
  )
}

// ─── Custom Radial Legend ─────────────────────────────────────────────────────
function CustomRadialLegend({ data }) {
  return (
    <div className="flex flex-wrap justify-center gap-3 mt-3">
      {data.map((entry, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: entry.fill }} />
          <span className="text-xs text-slate-600 dark:text-slate-400">{entry.name}</span>
          <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{entry.performance}%</span>
        </div>
      ))}
    </div>
  )
}

// ─── Section 1: Team Radial Bar ───────────────────────────────────────────────
function TeamRadialBar() {
  const C = useChartColors()
  const teamPerformance = [
    { name: 'Alice',   performance: 92, fill: C.primary },
    { name: 'Bob',     performance: 78, fill: C.cyan    },
    { name: 'Carol',   performance: 85, fill: C.emerald },
    { name: 'David',   performance: 63, fill: C.amber   },
    { name: 'Eve',     performance: 97, fill: C.violet  },
  ]
  return (
    <ChartCard
      title="Team Performance"
      subtitle="Individual performance scores across 5 team members"
    >
      <div className="flex flex-col items-center">
        <ResponsiveContainer width="100%" height={300}>
          <RadialBarChart
            innerRadius="15%"
            outerRadius="90%"
            data={teamPerformance}
            startAngle={90}
            endAngle={-270}
          >
            <RadialBar
              dataKey="performance"
              background={{ fill: C.bg }}
              cornerRadius={6}
              label={{ position: 'insideStart', fill: '#fff', fontSize: 10, fontWeight: 700 }}
            />
            <Tooltip content={<RadialTooltip />} />
          </RadialBarChart>
        </ResponsiveContainer>
        <CustomRadialLegend data={teamPerformance} />
      </div>
    </ChartCard>
  )
}

// ─── Section 2: Radar Chart ───────────────────────────────────────────────────
function SkillsRadar() {
  const C = useChartColors()
  return (
    <ChartCard
      title="Skills Radar — Team A vs Team B"
      subtitle="Comparative skills assessment across 6 dimensions"
    >
      <ResponsiveContainer width="100%" height={300}>
        <RadarChart data={radarTeamA} margin={{ top: 5, right: 30, left: 30, bottom: 5 }}>
          <PolarGrid stroke={C.grid} />
          <PolarAngleAxis
            dataKey="subject"
            tick={{ fontSize: 11, fill: C.axis }}
          />
          <PolarRadiusAxis
            angle={30}
            domain={[0, 100]}
            tick={{ fontSize: 9, fill: C.axis }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<RadarTooltip />} />
          <Legend
            iconSize={8}
            iconType="circle"
            wrapperStyle={{ fontSize: '11px', paddingTop: '12px' }}
          />
          <Radar
            name="Team A"
            dataKey="A"
            stroke={C.primary}
            fill={C.primary}
            fillOpacity={0.2}
            strokeWidth={2}
          />
          <Radar
            name="Team B"
            dataKey="B"
            stroke={C.cyan}
            fill={C.cyan}
            fillOpacity={0.2}
            strokeWidth={2}
          />
        </RadarChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}

// ─── Section 3: Progress Radial Cards ────────────────────────────────────────
function ProgressRadialCard({ label, value, color, icon: Icon, sub }) {
  const C = useChartColors()
  const data = [
    { value, fill: color },
    { value: 100 - value, fill: C.grid },
  ]
  return (
    <div className="card p-5 flex flex-col items-center text-center">
      <div className="flex items-center gap-1.5 mb-2">
        <Icon size={13} style={{ color }} />
        <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">{label}</p>
      </div>
      <div className="relative">
        <RadialBarChart
          width={130}
          height={130}
          innerRadius={42}
          outerRadius={60}
          data={data}
          startAngle={90}
          endAngle={-270}
        >
          <RadialBar dataKey="value" background={{ fill: C.bg }} cornerRadius={8} />
        </RadialBarChart>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-xl font-bold text-slate-900 dark:text-slate-100">{value}%</span>
        </div>
      </div>
      <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1.5">{sub}</p>
    </div>
  )
}

// ─── Section 4: Multi-ring Progress ──────────────────────────────────────────
function MultiRingProgress() {
  const C = useChartColors()
  const multiRingData = [
    { name: 'Revenue',    value: 87, fill: C.primary },
    { name: 'Customers',  value: 72, fill: C.cyan    },
    { name: 'Conversion', value: 64, fill: C.emerald },
    { name: 'Retention',  value: 93, fill: C.rose    },
  ]
  return (
    <ChartCard
      title="Multi-ring Progress"
      subtitle="Four key business metrics displayed as concentric radial bars"
    >
      <div className="flex flex-col items-center">
        <ResponsiveContainer width="100%" height={300}>
          <RadialBarChart
            innerRadius="20%"
            outerRadius="95%"
            data={multiRingData}
            startAngle={90}
            endAngle={-270}
          >
            <RadialBar
              dataKey="value"
              background={{ fill: C.bg }}
              cornerRadius={10}
              label={{ position: 'insideStart', fill: '#fff', fontSize: 10, fontWeight: 700 }}
            />
            <Tooltip content={<RadialTooltip />} />
          </RadialBarChart>
        </ResponsiveContainer>
        <div className="flex flex-wrap justify-center gap-4 mt-2">
          {multiRingData.map((entry, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: entry.fill }} />
              <span className="text-xs text-slate-600 dark:text-slate-400">{entry.name}</span>
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{entry.value}%</span>
            </div>
          ))}
        </div>
      </div>
    </ChartCard>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────
export default function RadialbarChartPage() {
  const C = useChartColors()
  const progressMetrics = [
    { label: 'Sales Target',    value: 84, color: C.primary, icon: Target,    sub: '$84k of $100k'    },
    { label: 'User Retention',  value: 67, color: C.cyan,    icon: Users,     sub: '6.7k of 10k users' },
    { label: 'NPS Score',       value: 91, color: C.emerald, icon: Award,     sub: '91 out of 100'    },
    { label: 'MoM Growth',      value: 58, color: C.amber,   icon: TrendingUp, sub: '+58% milestone'   },
  ]
  return (
    <div className="space-y-6">
      <PageHeader
        title="Radial Bar & Radar Charts"
        subtitle="Circular progress charts and multi-dimensional radar charts for performance data"
      />

      {/* Row 1: Team Radial Bar + Multi-ring Progress */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TeamRadialBar />
        <MultiRingProgress />
      </div>

      {/* Row 2: Radar Chart (full width) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SkillsRadar />

        {/* Progress Radial Cards in a 2x2 sub-grid */}
        <div>
          <div className="mb-3">
            <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300">Progress Radials</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Key metric completion rates at a glance</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {progressMetrics.map(m => (
              <ProgressRadialCard key={m.label} {...m} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
