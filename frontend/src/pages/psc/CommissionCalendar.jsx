import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Calendar, ListChecks, AlertTriangle, FileClock } from 'lucide-react'
import api from '../../api/client'
import { normalizeFieldPayload } from '../../utils/listPayload'
import PageHeader from '../../components/shared/PageHeader'
import BaseBadge from '../../components/shared/BaseBadge'
import BaseButton from '../../components/shared/BaseButton'
import BaseSpinner from '../../components/shared/BaseSpinner'

const TYPE_CONFIG = {
  meeting: { color: 'primary', label: 'Meeting', icon: <Calendar size={13} />, border: 'border-l-primary-500' },
  task_deadline: { color: 'warning', label: 'Task Deadline', icon: <ListChecks size={13} />, border: 'border-l-amber-500' },
  sla_warning: { color: 'danger', label: 'SLA Warning', icon: <AlertTriangle size={13} />, border: 'border-l-red-500' },
  minutes_review: { color: 'warning', label: 'Minutes Review', icon: <FileClock size={13} />, border: 'border-l-amber-500' },
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function groupByMonth(events) {
  const groups = {}
  for (const ev of events) {
    if (!ev.date) continue
    const d = new Date(ev.date)
    const key = `${d.getFullYear()}-${d.getMonth()}`
    if (!groups[key]) groups[key] = { label: `${MONTHS[d.getMonth()]} ${d.getFullYear()}`, events: [] }
    groups[key].events.push(ev)
  }
  return Object.values(groups).sort((a, b) => a.label.localeCompare(b.label))
}

export default function CommissionCalendar() {
  const navigate = useNavigate()
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')

  const loadEvents = useCallback(async () => {
    try {
      const res = await api.get('/calendar/events/')
      setEvents(normalizeFieldPayload(res.data, 'events'))
    } catch (e) {
      console.error('Calendar error', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadEvents() }, [loadEvents])

  const filtered = filter === 'all' ? events : events.filter(e => e.type === filter)
  const grouped = groupByMonth(filtered)
  const handleClick = (ev) => { if (ev.url) navigate(ev.url) }
  const types = ['all', 'meeting', 'task_deadline', 'sla_warning', 'minutes_review']

  return (
    <div className="flex flex-col gap-6 max-w-[1200px] mx-auto pb-10">
      <PageHeader title="Commission Calendar" subtitle="Meeting dates, task deadlines, and SLA warnings" />

      <div className="flex gap-2 flex-wrap">
        {types.map(tp => (
          <BaseButton key={tp} size="sm" variant={filter === tp ? 'primary' : 'outline'} onClick={() => setFilter(tp)}>
            {tp === 'all' ? 'All Events' : TYPE_CONFIG[tp]?.label || tp}
          </BaseButton>
        ))}
      </div>

      {loading ? (
        <div className="text-center p-16"><BaseSpinner label="Loading calendar…" /></div>
      ) : grouped.length === 0 ? (
        <div className="card"><p className="p-6 text-slate-500">No events found.</p></div>
      ) : (
        grouped.map(group => (
          <div key={group.label} className="card">
            <div className="p-4 border-b border-slate-100 dark:border-slate-700"><span className="font-bold text-lg text-slate-800 dark:text-slate-100">{group.label}</span></div>
            <div className="flex flex-col gap-2 p-2">
              {group.events.map(ev => {
                const cfg = TYPE_CONFIG[ev.type] || {}
                const d = ev.date ? new Date(ev.date) : null
                return (
                  <div
                    key={ev.id}
                    onClick={() => handleClick(ev)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg border-l-4 ${ev.url ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50' : 'cursor-default'} ${cfg.border || 'border-l-transparent'}`}
                  >
                    <div className="w-12 text-center shrink-0">
                      {d && (
                        <>
                          <span className="font-bold text-lg text-slate-800 dark:text-slate-100">{d.getDate()}</span>
                          <span className="block text-[10px] text-slate-500">{MONTHS[d.getMonth()]}</span>
                        </>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="font-semibold text-slate-800 dark:text-slate-100">{ev.title}</span>
                      {ev.status && <span className="block text-[10px] text-slate-500">Status: {ev.status}</span>}
                    </div>
                    <BaseBadge color={cfg.color} size="small" icon={cfg.icon}>{cfg.label}</BaseBadge>
                  </div>
                )
              })}
            </div>
          </div>
        ))
      )}
    </div>
  )
}
