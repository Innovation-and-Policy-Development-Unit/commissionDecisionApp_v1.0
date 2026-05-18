import { useState } from 'react'
import PageHeader from '../../components/shared/PageHeader'
import { Check, Star, Mail, Bell, Settings, User, ChevronRight, ExternalLink, MoreVertical, MapPin, Calendar, Briefcase } from 'lucide-react'
import { img } from '../../utils/imgPath'

const menuItems = [
  { icon: User, label: 'Profile', desc: 'Manage your account' },
  { icon: Bell, label: 'Notifications', desc: 'Set notification preferences', badge: '3' },
  { icon: Settings, label: 'Settings', desc: 'App configuration' },
  { icon: Mail, label: 'Messages', desc: 'Inbox and sent items', badge: '12' },
]

export default function ListPage() {
  const [selected, setSelected] = useState(null)
  const [checked, setChecked] = useState(new Set())

  const toggleCheck = (i) => setChecked(s => { const n = new Set(s); n.has(i) ? n.delete(i) : n.add(i); return n })

  return (
    <div className="space-y-6">
      <PageHeader title="List" subtitle="Flexible and customizable list components" />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Basic List */}
        <div className="card p-6">
          <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-4">Basic List</h3>
          <ul className="divide-y divide-slate-100 dark:divide-slate-700">
            {['Dashboard Overview', 'User Management', 'Analytics Reports', 'System Settings', 'Help Center'].map((item, i) => (
              <li key={i} className="py-3 text-sm text-slate-700 dark:text-slate-300 first:pt-0 last:pb-0">{item}</li>
            ))}
          </ul>
        </div>

        {/* List with Icons */}
        <div className="card p-6">
          <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-4">List with Icons</h3>
          <ul className="divide-y divide-slate-100 dark:divide-slate-700">
            {menuItems.map((item, i) => (
              <li key={i} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                <div className="w-9 h-9 rounded-xl bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center shrink-0">
                  <item.icon size={16} className="text-primary-600 dark:text-primary-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{item.label}</p>
                  <p className="text-xs text-slate-400">{item.desc}</p>
                </div>
                {item.badge && (
                  <span className="badge badge-primary">{item.badge}</span>
                )}
              </li>
            ))}
          </ul>
        </div>

        {/* Ordered List */}
        <div className="card p-6">
          <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-4">Ordered List</h3>
          <ol className="space-y-3">
            {['Install dependencies with npm install', 'Configure environment variables', 'Run database migrations', 'Start development server', 'Open http://localhost:3000'].map((item, i) => (
              <li key={i} className="flex items-start gap-3 text-sm">
                <span className="w-6 h-6 rounded-full bg-primary-500 text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">{i + 1}</span>
                <span className="text-slate-600 dark:text-slate-400">{item}</span>
              </li>
            ))}
          </ol>
        </div>

        {/* Interactive List */}
        <div className="card p-6">
          <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-4">Interactive List</h3>
          <ul>
            {menuItems.map((item, i) => (
              <li key={i}>
                <button
                  onClick={() => setSelected(i)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-colors ${selected === i ? 'bg-primary-50 dark:bg-primary-900/20' : 'hover:bg-slate-50 dark:hover:bg-slate-700/30'}`}
                >
                  <item.icon size={16} className={selected === i ? 'text-primary-600 dark:text-primary-400' : 'text-slate-400'} />
                  <span className={`flex-1 text-sm font-medium ${selected === i ? 'text-primary-700 dark:text-primary-300' : 'text-slate-600 dark:text-slate-400'}`}>{item.label}</span>
                  <ChevronRight size={14} className="text-slate-300" />
                </button>
              </li>
            ))}
          </ul>
        </div>

        {/* Checklist */}
        <div className="card p-6">
          <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-4">Checklist</h3>
          <ul className="space-y-2">
            {['Set up project structure', 'Create design system', 'Build core components', 'Write unit tests', 'Deploy to staging', 'Run performance audit'].map((item, i) => (
              <li key={i}>
                <button onClick={() => toggleCheck(i)} className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors text-left">
                  <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${checked.has(i) ? 'bg-primary-500 border-primary-500' : 'border-slate-300 dark:border-slate-600'}`}>
                    {checked.has(i) && <Check size={12} className="text-white" />}
                  </div>
                  <span className={`text-sm ${checked.has(i) ? 'line-through text-slate-400' : 'text-slate-700 dark:text-slate-300'}`}>{item}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>

        {/* Nested List */}
        <div className="card p-6">
          <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-4">Nested List</h3>
          <ul className="space-y-2 text-sm">
            {[
              { title: 'Frontend', children: ['React', 'TypeScript', 'Tailwind CSS'] },
              { title: 'Backend', children: ['Node.js', 'Express', 'PostgreSQL'] },
              { title: 'DevOps', children: ['Docker', 'Kubernetes', 'CI/CD'] },
            ].map((group, i) => (
              <li key={i}>
                <div className="flex items-center gap-2 font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  <div className="w-2 h-2 rounded-full bg-primary-500" />
                  {group.title}
                </div>
                <ul className="ms-5 space-y-1 border-s-2 border-slate-200 dark:border-slate-700 ps-3">
                  {group.children.map((child, j) => (
                    <li key={j} className="text-slate-500 dark:text-slate-400 flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600" />
                      {child}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </div>

        {/* Avatar List */}
        <div className="card p-6 lg:col-span-2">
          <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-4">List with Avatars</h3>
          <ul className="divide-y divide-slate-100 dark:divide-slate-700">
            {[
              { name: 'Alice Johnson', role: 'Frontend Developer', status: 'online', rating: 5, img: img('/images/avatars/avatar-woman-alice.jpg') },
              { name: 'Bob Smith', role: 'Backend Developer', status: 'away', rating: 4, img: img('/images/avatars/avatar-man-bob.jpg') },
              { name: 'Carol White', role: 'UX Designer', status: 'offline', rating: 5, img: img('/images/avatars/avatar-woman-carol.jpg') },
              { name: 'David Lee', role: 'DevOps Engineer', status: 'online', rating: 4, img: img('/images/avatars/avatar-man-david.jpg') },
            ].map((user, i) => (
              <li key={i} className="flex items-center gap-4 py-3 first:pt-0 last:pb-0">
                <div className="relative shrink-0">
                  <img src={user.img} alt={user.name} className="w-10 h-10 rounded-full object-cover" />
                  <div className={`absolute bottom-0 end-0 w-3 h-3 rounded-full border-2 border-white dark:border-slate-800 ${user.status === 'online' ? 'bg-emerald-500' : user.status === 'away' ? 'bg-amber-500' : 'bg-slate-400'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{user.name}</p>
                  <p className="text-xs text-slate-500">{user.role}</p>
                </div>
                <div className="flex items-center gap-0.5">
                  {Array.from({ length: user.rating }).map((_, j) => (
                    <Star key={j} size={12} className="text-amber-400 fill-amber-400" />
                  ))}
                </div>
                <button className="btn btn-sm btn-outline hidden sm:flex"><ExternalLink size={12} /></button>
              </li>
            ))}
          </ul>
        </div>

        {/* List with Avatars & Actions */}
        <div className="card p-6">
          <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-4">List with Avatars & Actions</h3>
          <p className="text-sm text-slate-500 mb-4">Rich user list with detailed info and action buttons</p>
          <ul className="space-y-3">
            {[
              { name: 'Jessica Park', role: 'Senior Designer', location: 'San Francisco', joined: 'Jan 2023', img: img('/images/avatars/avatar-woman-grace.jpg'), status: 'online', tasks: 14 },
              { name: 'Ryan Cooper', role: 'Full Stack Dev', location: 'New York', joined: 'Mar 2022', img: img('/images/avatars/avatar-man-mike.jpg'), status: 'online', tasks: 23 },
              { name: 'Maya Singh', role: 'Project Manager', location: 'London', joined: 'Jul 2023', img: img('/images/avatars/avatar-woman-jessica.jpg'), status: 'away', tasks: 8 },
              { name: 'Lucas Chen', role: 'Data Engineer', location: 'Toronto', joined: 'Nov 2022', img: img('/images/avatars/avatar-man-henry.jpg'), status: 'busy', tasks: 19 },
              { name: 'Sophie Martin', role: 'QA Engineer', location: 'Berlin', joined: 'Sep 2023', img: img('/images/avatars/avatar-woman-sarah-kim.jpg'), status: 'offline', tasks: 6 },
            ].map((user, i) => (
              <li key={i} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-700/30 hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors">
                <div className="relative shrink-0">
                  <img src={user.img} alt={user.name} className="w-11 h-11 rounded-full object-cover" />
                  <div className={`absolute bottom-0 end-0 w-3 h-3 rounded-full border-2 border-slate-50 dark:border-slate-700 ${user.status === 'online' ? 'bg-emerald-500' : user.status === 'away' ? 'bg-amber-500' : user.status === 'busy' ? 'bg-red-500' : 'bg-slate-400'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{user.name}</p>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-xs text-slate-500 flex items-center gap-1"><Briefcase size={10} />{user.role}</span>
                    <span className="text-xs text-slate-400 flex items-center gap-1"><MapPin size={10} />{user.location}</span>
                  </div>
                </div>
                <div className="hidden sm:flex flex-col items-end gap-0.5">
                  <span className="text-xs font-medium text-primary-600 dark:text-primary-400">{user.tasks} tasks</span>
                  <span className="text-xs text-slate-400 flex items-center gap-1"><Calendar size={10} />{user.joined}</span>
                </div>
                <button className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">
                  <MoreVertical size={14} className="text-slate-400" />
                </button>
              </li>
            ))}
          </ul>
        </div>

        {/* Horizontal List */}
        <div className="card p-6">
          <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-4">Horizontal List</h3>
          <p className="text-sm text-slate-500 mb-4">Scrollable horizontal list for compact display</p>
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
            {[
              { name: 'Design', icon: '🎨', count: 24, gradient: 'bg-primary-500' },
              { name: 'Development', icon: '💻', count: 42, gradient: 'bg-sky-500' },
              { name: 'Marketing', icon: '📊', count: 18, gradient: 'bg-emerald-500' },
              { name: 'Analytics', icon: '📈', count: 31, gradient: 'bg-amber-500' },
              { name: 'Support', icon: '🎧', count: 15, gradient: 'bg-rose-500' },
              { name: 'Finance', icon: '💰', count: 9, gradient: 'bg-primary-500' },
            ].map((item, i) => (
              <div key={i} className="flex-shrink-0 w-28 p-3 rounded-xl bg-slate-50 dark:bg-slate-700/30 hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors text-center cursor-pointer group">
                <div className={`w-10 h-10 rounded-xl ${item.gradient} flex items-center justify-center mx-auto mb-2 group-hover:scale-110 transition-transform`}>
                  <span className="text-lg">{item.icon}</span>
                </div>
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 truncate">{item.name}</p>
                <p className="text-xs text-slate-400 mt-0.5">{item.count} items</p>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700">
            <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-3">Recent Activity</p>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {[
                { label: 'Updated landing page design', time: '2m ago', color: 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300' },
                { label: 'Deployed v2.1.0 to staging', time: '15m ago', color: 'bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300' },
                { label: 'Merged PR #142', time: '1h ago', color: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300' },
                { label: 'Fixed checkout bug', time: '3h ago', color: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300' },
              ].map((activity, i) => (
                <div key={i} className={`flex-shrink-0 px-3 py-2 rounded-lg ${activity.color} text-xs font-medium`}>
                  <p>{activity.label}</p>
                  <p className="opacity-60 mt-0.5">{activity.time}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
