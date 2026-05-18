import Section from './Section'
import { goals, skills } from './data'

export default function ProgressWidgets() {
  return (
    <Section title="Progress & Goal Widgets" subtitle="Goal trackers and skill progress bars">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

        <div className="card p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="font-bold text-slate-900 dark:text-slate-100">Q1 Goal Tracker</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">January – March 2026</p>
            </div>
            <span className="badge badge-success">On Track</span>
          </div>
          <div className="space-y-5">
            {goals.map((goal, i) => (
              <div key={i}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm text-slate-700 dark:text-slate-300 font-medium">{goal.name}</span>
                  <span className="text-sm font-bold text-slate-900 dark:text-slate-100">{goal.current}%</span>
                </div>
                <div className="h-2.5 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                  <div className={`h-full rounded-full ${goal.color} transition-all duration-700`} style={{ width: `${goal.current}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="font-bold text-slate-900 dark:text-slate-100">Skills Overview</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Team competency ratings</p>
            </div>
            <button className="btn btn-outline btn-sm">Edit</button>
          </div>
          <div className="space-y-5">
            {skills.map((skill, i) => (
              <div key={i}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm text-slate-700 dark:text-slate-300 font-medium">{skill.name}</span>
                  <span className="text-sm font-bold text-slate-900 dark:text-slate-100">{skill.pct}%</span>
                </div>
                <div className="h-2.5 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                  <div className={`h-full rounded-full ${skill.color} transition-all duration-700`} style={{ width: `${skill.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </Section>
  )
}
