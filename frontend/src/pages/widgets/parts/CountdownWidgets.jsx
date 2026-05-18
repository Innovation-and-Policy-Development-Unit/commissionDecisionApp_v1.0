import { useState, useEffect } from 'react'
import { Award, Check } from 'lucide-react'
import Section from './Section'
import { getTimeLeft } from './data'

const planFeatures = [
  'Unlimited projects',
  'Priority support',
  'Advanced analytics',
  'Custom integrations',
  'Team collaboration',
]

function CountdownCard() {
  const [timeLeft, setTimeLeft] = useState(getTimeLeft())

  useEffect(() => {
    const id = setInterval(() => setTimeLeft(getTimeLeft()), 1000)
    return () => clearInterval(id)
  }, [])

  const units = [
    { label: 'Days',    value: timeLeft.days    },
    { label: 'Hours',   value: timeLeft.hours   },
    { label: 'Minutes', value: timeLeft.minutes },
    { label: 'Seconds', value: timeLeft.seconds },
  ]

  return (
    <div className="md:col-span-2 card overflow-hidden">
      <div className="bg-primary-600 px-8 pt-8 pb-6 text-white text-center">
        <div className="inline-flex items-center gap-2 bg-white/15 backdrop-blur-sm border border-white/25 px-4 py-1.5 rounded-full mb-4">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs font-semibold uppercase tracking-widest">Coming Soon</span>
        </div>
        <h3 className="text-2xl font-bold mb-1">Product Launch</h3>
        <p className="text-sm opacity-75 mb-6">June 1, 2026 · The next generation of Liner</p>
        <div className="grid grid-cols-4 gap-3">
          {units.map(({ label, value }) => (
            <div key={label} className="bg-white/15 backdrop-blur-sm rounded-2xl p-4 border border-white/20">
              <p className="text-4xl font-bold tabular-nums leading-none">{String(value).padStart(2, '0')}</p>
              <p className="text-xs opacity-70 mt-1.5 uppercase tracking-wider font-medium">{label}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="px-8 py-5 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Get notified on launch day</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Be the first to experience Liner 2.0</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <input type="email" placeholder="you@company.com" className="input sm:w-52" readOnly />
          <button className="btn btn-gradient shrink-0">Notify Me</button>
        </div>
      </div>
    </div>
  )
}

function PricingCard() {
  return (
    <div className="card p-0 overflow-hidden flex flex-col">
      <div className="bg-emerald-500 p-5 text-white text-center">
        <Award size={28} className="mx-auto mb-2 opacity-90" />
        <h4 className="font-bold text-lg">Pro Plan</h4>
        <p className="text-xs opacity-75">Most popular choice</p>
        <div className="mt-3">
          <span className="text-4xl font-bold">$29</span>
          <span className="text-sm opacity-70">/mo</span>
        </div>
      </div>
      <div className="p-5 flex-1 flex flex-col">
        <div className="space-y-3 flex-1">
          {planFeatures.map((f, i) => (
            <div key={i} className="flex items-center gap-2.5">
              <div className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
                <Check size={11} className="text-emerald-600 dark:text-emerald-400" />
              </div>
              <span className="text-sm text-slate-600 dark:text-slate-400">{f}</span>
            </div>
          ))}
        </div>
        <button className="w-full mt-5 btn btn-primary py-2.5">Get Started</button>
      </div>
    </div>
  )
}

export default function CountdownWidgets() {
  return (
    <Section title="Countdown & Pricing Widgets" subtitle="Launch countdown and plan comparison cards">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <CountdownCard />
        <PricingCard />
      </div>
    </Section>
  )
}
