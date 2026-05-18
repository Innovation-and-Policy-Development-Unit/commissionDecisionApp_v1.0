import { useState } from 'react'
import PageHeader from '../../components/shared/PageHeader'
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer
} from 'recharts'
import { HardDrive, Cpu, MemoryStick } from 'lucide-react'
import useChartColors from '../../hooks/useChartColors'

// ─── Tooltip ─────────────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null
  const d = payload[0]
  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 shadow-lg min-w-[130px]">
      <div className="flex items-center gap-1.5 mb-0.5">
        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: d.payload.color }} />
        <p className="font-semibold text-xs text-slate-700 dark:text-slate-300">{d.name}</p>
      </div>
      <p className="text-xs text-slate-500">
        {d.value}
        {typeof d.value === 'number' && d.value <= 100 ? '%' : ''}
      </p>
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

// ─── Section 1: Donut with center label + right legend ───────────────────────
function DonutWithLegend() {
  const C = useChartColors()
  const categoryData = [
    { name: 'Electronics', value: 38, color: C.primary },
    { name: 'Clothing',    value: 24, color: C.cyan    },
    { name: 'Home & Garden', value: 18, color: C.emerald },
    { name: 'Sports',      value: 12, color: C.amber   },
    { name: 'Books',       value:  8, color: C.violet  },
  ]
  const total = categoryData.reduce((a, b) => a + b.value, 0)
  return (
    <ChartCard
      title="Category Breakdown"
      subtitle="Sales distribution across product categories"
    >
      <div className="flex flex-col sm:flex-row items-center gap-6">
        {/* Donut */}
        <div className="relative shrink-0">
          <PieChart width={220} height={220}>
            <Pie
              data={categoryData}
              cx="50%"
              cy="50%"
              innerRadius={68}
              outerRadius={100}
              paddingAngle={3}
              dataKey="value"
            >
              {categoryData.map((entry, i) => (
                <Cell key={i} fill={entry.color} stroke="transparent" />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{total}%</p>
            <p className="text-[10px] text-slate-500 mt-0.5">Total</p>
          </div>
        </div>

        {/* Right legend list */}
        <div className="flex-1 space-y-3 w-full">
          {categoryData.map(d => (
            <div key={d.name}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                  <span className="text-sm text-slate-700 dark:text-slate-300">{d.name}</span>
                </div>
                <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">{d.value}%</span>
              </div>
              <div className="h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${d.value}%`, backgroundColor: d.color }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </ChartCard>
  )
}

// ─── Section 2: Pie with active sector on hover ───────────────────────────────
function ActivePieChart() {
  const C = useChartColors()
  const [activeIndex, setActiveIndex] = useState(null)

  const simplePieData = [
    { name: 'Direct',   value: 42, color: C.primary },
    { name: 'Organic',  value: 28, color: C.cyan    },
    { name: 'Referral', value: 18, color: C.emerald },
    { name: 'Paid',     value: 12, color: C.amber   },
  ]

  const renderActiveShape = (props) => {
    const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props
    return (
      <g>
        <circle cx={cx} cy={cy} r={outerRadius + 6} fill="none" stroke={fill} strokeWidth={2} opacity={0.3} />
        <Pie
          data={[props]}
          cx={cx}
          cy={cy}
          innerRadius={innerRadius}
          outerRadius={outerRadius + 6}
          startAngle={startAngle}
          endAngle={endAngle}
          fill={fill}
          dataKey="value"
        />
      </g>
    )
  }

  return (
    <ChartCard
      title="Traffic Sources"
      subtitle="Hover over a slice to highlight · onMouseEnter active sector"
    >
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={simplePieData}
            cx="50%"
            cy="50%"
            outerRadius={110}
            dataKey="value"
            onMouseEnter={(_, index) => setActiveIndex(index)}
            onMouseLeave={() => setActiveIndex(null)}
          >
            {simplePieData.map((entry, i) => (
              <Cell
                key={i}
                fill={entry.color}
                stroke="transparent"
                opacity={activeIndex === null || activeIndex === i ? 1 : 0.55}
                style={{ cursor: 'pointer', transition: 'opacity 0.2s' }}
              />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend
            iconSize={8}
            iconType="circle"
            wrapperStyle={{ fontSize: '11px', paddingTop: '12px' }}
          />
        </PieChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}

// ─── Section 3: Multi-donut row ───────────────────────────────────────────────
function MiniDonutCard({ icon: Icon, label, percent, color, used, total }) {
  const C = useChartColors()
  const data = [
    { value: percent, color },
    { value: 100 - percent, color: C.grid },
  ]
  return (
    <div className="card p-5 flex flex-col items-center text-center">
      <div className="flex items-center gap-1.5 mb-3">
        <Icon size={14} style={{ color }} />
        <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">{label}</p>
      </div>
      <div className="relative">
        <PieChart width={120} height={120}>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={38}
            outerRadius={54}
            startAngle={90}
            endAngle={-270}
            dataKey="value"
            paddingAngle={2}
          >
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.color} stroke="transparent" />
            ))}
          </Pie>
        </PieChart>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <p className="text-base font-bold text-slate-900 dark:text-slate-100">{percent}%</p>
        </div>
      </div>
      <p className="text-[10px] text-slate-500 mt-2">{used} / {total}</p>
    </div>
  )
}

// ─── Section 4: Semi-donut goal progress ─────────────────────────────────────
function SemiDonut() {
  const C = useChartColors()
  const goal = 73
  const data = [
    { value: goal, color: C.emerald },
    { value: 100 - goal, color: C.grid },
  ]
  return (
    <ChartCard
      title="Annual Goal Progress"
      subtitle="Semi-donut · startAngle=180 endAngle=0 showing goal completion"
    >
      <div className="flex flex-col items-center">
        <div className="relative">
          <PieChart width={300} height={170}>
            <Pie
              data={data}
              cx="50%"
              cy="100%"
              innerRadius={80}
              outerRadius={130}
              startAngle={180}
              endAngle={0}
              dataKey="value"
              paddingAngle={2}
            >
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.color} stroke="transparent" />
              ))}
            </Pie>
          </PieChart>
          <div className="absolute bottom-2 left-0 right-0 flex flex-col items-center pointer-events-none">
            <p className="text-3xl font-bold text-slate-900 dark:text-slate-100">{goal}%</p>
            <p className="text-xs text-slate-500 mt-0.5">of annual goal</p>
          </div>
        </div>

        {/* Progress summary row */}
        <div className="flex justify-between w-full max-w-xs mt-4 px-2">
          <div className="text-center">
            <p className="text-lg font-bold text-slate-800 dark:text-slate-100">$3.28M</p>
            <p className="text-[10px] text-slate-500">Achieved</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-slate-800 dark:text-slate-100">$4.5M</p>
            <p className="text-[10px] text-slate-500">Target</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-emerald-600">$1.22M</p>
            <p className="text-[10px] text-slate-500">Remaining</p>
          </div>
        </div>
      </div>
    </ChartCard>
  )
}

// ─── Section 5: Nested Ring Donut ────────────────────────────────────────────
function NestedRingDonut() {
  const C = useChartColors()
  const outerRingData = [
    { name: 'Desktop', value: 52, color: C.primary },
    { name: 'Mobile',  value: 32, color: C.cyan    },
    { name: 'Tablet',  value: 16, color: C.emerald },
  ]

  const innerRingData = [
    { name: 'Chrome',  value: 40, color: C.primary },
    { name: 'Safari',  value: 25, color: C.cyan    },
    { name: 'Firefox', value: 18, color: C.emerald },
    { name: 'Edge',    value: 12, color: C.amber   },
    { name: 'Other',   value:  5, color: C.violet  },
  ]

  return (
    <ChartCard
      title="Nested Ring Chart"
      subtitle="Device types (outer) vs browser share (inner)"
    >
      <div className="flex flex-col items-center">
        <ResponsiveContainer width="100%" height={320}>
          <PieChart>
            <Pie
              data={outerRingData}
              cx="50%"
              cy="50%"
              innerRadius={95}
              outerRadius={120}
              paddingAngle={3}
              dataKey="value"
            >
              {outerRingData.map((entry, i) => (
                <Cell key={i} fill={entry.color} stroke="transparent" />
              ))}
            </Pie>
            <Pie
              data={innerRingData}
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={80}
              paddingAngle={2}
              dataKey="value"
            >
              {innerRingData.map((entry, i) => (
                <Cell key={i} fill={entry.color} stroke="transparent" />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend
              iconSize={8}
              iconType="circle"
              wrapperStyle={{ fontSize: '11px', paddingTop: '12px' }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────
export default function DonutChartPage() {
  const C = useChartColors()
  return (
    <div className="space-y-6">
      <PageHeader
        title="Donut & Pie Charts"
        subtitle="Proportional data visualisation with interactive pie and donut charts"
      />

      {/* Row 1: Donut with legend + Active hover pie */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <DonutWithLegend />
        <ActivePieChart />
      </div>

      {/* Row 2: Semi-donut + Nested ring */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SemiDonut />
        <NestedRingDonut />
      </div>

      {/* Row 3: System Metrics mini donuts */}
      <div>
        <div className="mb-3">
          <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300">System Metrics</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Real-time resource usage at a glance</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <MiniDonutCard
            icon={HardDrive}
            label="Storage Used"
            percent={72}
            color={C.primary}
            used="360 GB"
            total="500 GB"
          />
          <MiniDonutCard
            icon={Cpu}
            label="CPU Load"
            percent={45}
            color={C.cyan}
            used="4.5 cores"
            total="10 cores"
          />
          <MiniDonutCard
            icon={MemoryStick}
            label="Memory"
            percent={68}
            color={C.amber}
            used="10.9 GB"
            total="16 GB"
          />
        </div>
      </div>
    </div>
  )
}
