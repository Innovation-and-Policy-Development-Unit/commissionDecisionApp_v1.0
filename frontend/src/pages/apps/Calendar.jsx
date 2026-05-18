import { useState } from 'react'
import PageHeader from '../../components/shared/PageHeader'
import { ChevronLeft, ChevronRight, Plus, X } from 'lucide-react'
import clsx from 'clsx'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

const initialEvents = [
  { id: 1, title: 'Team Standup', date: '2026-03-09', time: '09:00', color: 'bg-primary-500', category: 'Work' },
  { id: 2, title: 'Product Review', date: '2026-03-11', time: '14:00', color: 'bg-cyan-500', category: 'Work' },
  { id: 3, title: 'Client Meeting', date: '2026-03-13', time: '11:00', color: 'bg-emerald-500', category: 'Business' },
  { id: 4, title: 'Design Sprint', date: '2026-03-15', time: '10:00', color: 'bg-violet-500', category: 'Work' },
  { id: 5, title: 'Team Lunch', date: '2026-03-17', time: '12:30', color: 'bg-amber-500', category: 'Social' },
  { id: 6, title: 'Quarterly Review', date: '2026-03-20', time: '15:00', color: 'bg-red-500', category: 'Work' },
  { id: 7, title: 'UX Workshop', date: '2026-03-22', time: '09:30', color: 'bg-pink-500', category: 'Training' },
  { id: 8, title: 'Board Meeting', date: '2026-03-25', time: '10:00', color: 'bg-indigo-500', category: 'Business' },
  { id: 9, title: 'Sprint Planning', date: '2026-03-28', time: '13:00', color: 'bg-teal-500', category: 'Work' },
  { id: 10, title: 'Release v2.0', date: '2026-03-31', time: '08:00', color: 'bg-orange-500', category: 'Milestone' },
]

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfMonth(year, month) {
  return new Date(year, month, 1).getDay()
}

export default function Calendar() {
  const today = new Date()
  const [viewDate, setViewDate] = useState({ year: today.getFullYear(), month: today.getMonth() })
  const [events, setEvents] = useState(initialEvents)
  const [selectedDay, setSelectedDay] = useState(today.getDate())
  const [showModal, setShowModal] = useState(false)
  const [newEvent, setNewEvent] = useState({ title: '', time: '09:00', color: 'bg-primary-500', category: 'Work' })

  const { year, month } = viewDate
  const daysInMonth = getDaysInMonth(year, month)
  const firstDay = getFirstDayOfMonth(year, month)

  const getEventsForDay = (day) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    return events.filter(e => e.date === dateStr)
  }

  const isToday = (day) => {
    return day === today.getDate() && month === today.getMonth() && year === today.getFullYear()
  }

  const prevMonth = () => {
    setViewDate(d => {
      if (d.month === 0) return { year: d.year - 1, month: 11 }
      return { ...d, month: d.month - 1 }
    })
  }

  const nextMonth = () => {
    setViewDate(d => {
      if (d.month === 11) return { year: d.year + 1, month: 0 }
      return { ...d, month: d.month + 1 }
    })
  }

  const addEvent = () => {
    if (!newEvent.title.trim()) return
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`
    setEvents(prev => [...prev, { id: Date.now(), ...newEvent, date: dateStr }])
    setNewEvent({ title: '', time: '09:00', color: 'bg-primary-500', category: 'Work' })
    setShowModal(false)
  }

  const selectedDateEvents = getEventsForDay(selectedDay)
  const colorOptions = ['bg-primary-500', 'bg-cyan-500', 'bg-emerald-500', 'bg-amber-500', 'bg-red-500', 'bg-violet-500']

  return (
    <div>
      <PageHeader
        title="Calendar"
        subtitle="Manage your schedule and events"
        action={
          <button className="btn-primary" onClick={() => setShowModal(true)}>
            <Plus size={16} />
            Add Event
          </button>
        }
      />

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
        {/* Calendar */}
        <div className="xl:col-span-3 card p-5">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200">
              {MONTHS[month]} {year}
            </h2>
            <div className="flex items-center gap-2">
              <button onClick={prevMonth} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 transition-colors">
                <ChevronLeft size={18} />
              </button>
              <button
                onClick={() => setViewDate({ year: today.getFullYear(), month: today.getMonth() })}
                className="px-3 py-1.5 text-sm font-medium rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 transition-colors"
              >
                Today
              </button>
              <button onClick={nextMonth} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 transition-colors">
                <ChevronRight size={18} />
              </button>
            </div>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 mb-2">
            {DAYS.map(day => (
              <div key={day} className="text-center text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider py-2">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-1">
            {/* Empty cells before first day */}
            {Array.from({ length: firstDay }, (_, i) => (
              <div key={`empty-${i}`} />
            ))}

            {/* Day cells */}
            {Array.from({ length: daysInMonth }, (_, i) => {
              const day = i + 1
              const dayEvents = getEventsForDay(day)
              const isSelected = day === selectedDay

              return (
                <div
                  key={day}
                  onClick={() => setSelectedDay(day)}
                  className={clsx(
                    'min-h-20 p-1.5 rounded-xl cursor-pointer transition-all duration-150 border',
                    isSelected
                      ? 'border-primary-300 dark:border-primary-700 bg-primary-50 dark:bg-primary-900/20'
                      : 'border-transparent hover:border-slate-200 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700/30'
                  )}
                >
                  <div className={clsx(
                    'w-7 h-7 flex items-center justify-center rounded-full text-sm font-medium mb-1',
                    isToday(day)
                      ? 'bg-primary-500 text-white'
                      : isSelected
                        ? 'text-primary-600 dark:text-primary-400 font-semibold'
                        : 'text-slate-700 dark:text-slate-300'
                  )}>
                    {day}
                  </div>
                  <div className="space-y-0.5">
                    {dayEvents.slice(0, 2).map(ev => (
                      <div
                        key={ev.id}
                        className={clsx('text-[10px] text-white px-1.5 py-0.5 rounded-md truncate font-medium', ev.color)}
                      >
                        {ev.title}
                      </div>
                    ))}
                    {dayEvents.length > 2 && (
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 pl-1">+{dayEvents.length - 2} more</div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Selected day events */}
          <div className="card p-4">
            <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-3">
              {MONTHS[month]} {selectedDay}, {year}
            </h3>
            {selectedDateEvents.length === 0 ? (
              <div className="text-center py-6">
                <div className="w-12 h-12 bg-slate-100 dark:bg-slate-700 rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <Plus size={24} className="text-slate-400" />
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400">No events this day</p>
                <button onClick={() => setShowModal(true)} className="text-xs text-primary-600 dark:text-primary-400 mt-2 hover:underline">
                  Add an event
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {selectedDateEvents.map(ev => (
                  <div key={ev.id} className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-700/50">
                    <div className={clsx('w-2 h-2 rounded-full mt-1.5 shrink-0', ev.color)} />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{ev.title}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{ev.time} · {ev.category}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Upcoming events */}
          <div className="card p-4">
            <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-3">Upcoming Events</h3>
            <div className="space-y-2">
              {events.slice(0, 6).map(ev => (
                <div key={ev.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer transition-colors">
                  <div className={clsx('w-8 h-8 rounded-xl flex items-center justify-center text-white text-xs font-bold shrink-0', ev.color)}>
                    {new Date(ev.date).getDate()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">{ev.title}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{ev.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Add Event Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="card w-full max-w-md p-6 animate-scale-in">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">Add New Event</h3>
              <button onClick={() => setShowModal(false)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Event Title</label>
                <input
                  type="text"
                  className="input"
                  placeholder="Enter event title..."
                  value={newEvent.title}
                  onChange={e => setNewEvent(p => ({ ...p, title: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Time</label>
                <input
                  type="time"
                  className="input"
                  value={newEvent.time}
                  onChange={e => setNewEvent(p => ({ ...p, time: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Category</label>
                <select
                  className="input"
                  value={newEvent.category}
                  onChange={e => setNewEvent(p => ({ ...p, category: e.target.value }))}
                >
                  {['Work', 'Business', 'Social', 'Training', 'Personal', 'Milestone'].map(c => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Color</label>
                <div className="flex gap-2">
                  {colorOptions.map(c => (
                    <button
                      key={c}
                      onClick={() => setNewEvent(p => ({ ...p, color: c }))}
                      className={clsx('w-8 h-8 rounded-full transition-all', c, newEvent.color === c && 'ring-2 ring-offset-2 ring-offset-white dark:ring-offset-slate-800 ring-slate-400')}
                    />
                  ))}
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowModal(false)} className="flex-1 btn-outline">Cancel</button>
                <button onClick={addEvent} className="flex-1 btn-primary">Add Event</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
