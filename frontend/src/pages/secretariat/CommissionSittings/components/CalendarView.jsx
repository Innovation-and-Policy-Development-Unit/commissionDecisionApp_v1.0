import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import listPlugin from '@fullcalendar/list'
import interactionPlugin from '@fullcalendar/interaction'
import { MapPin, ListChecks, CheckCircle2, AlertCircle } from 'lucide-react'
import { SITTING_STATUSES } from '../constants'

export default function CalendarView({ meetings, onEventClick, getCapacity }) {
  const events = meetings.map(m => ({
    id: m.id,
    title: m.title,
    start: `${m.date}T${m.time}`,
    // Assume 2 hour meetings for visual block
    end: new Date(new Date(`${m.date}T${m.time}`).getTime() + 2 * 60 * 60 * 1000).toISOString(),
    backgroundColor: SITTING_STATUSES[m.status]?.calendarColor || '#cbd5e1',
    borderColor: SITTING_STATUSES[m.status]?.calendarColor || '#cbd5e1',
    extendedProps: { ...m }
  }))

  const renderEventContent = (eventInfo) => {
    const m = eventInfo.event.extendedProps
    const capacity = getCapacity(m.agenda_count || 0)
    
    return (
      <div className="p-1.5 h-full overflow-hidden flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase opacity-80 truncate">
            {eventInfo.timeText}
          </span>
          {m.decisions_count > 0 && (
            <CheckCircle2 size={10} className="text-white" />
          )}
        </div>
        
        <p className="text-xs font-bold leading-tight line-clamp-2">
          {eventInfo.event.title}
        </p>
        
        <div className="mt-auto pt-1 border-t border-white/20 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1 min-w-0">
            <MapPin size={10} className="shrink-0" />
            <span className="text-[9px] truncate opacity-90">{m.venue}</span>
          </div>
          <div className="flex items-center gap-1 shrink-0 bg-white/20 px-1 rounded">
            <ListChecks size={10} />
            <span className="text-[9px] font-bold">{m.agenda_count || 0}</span>
          </div>
        </div>
        
        {/* Capacity Indicator dot */}
        <div className={`absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full ring-1 ring-white bg-${capacity.color}-500`} 
             title={`Agenda Capacity: ${capacity.label}`} />
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm p-1 overflow-hidden fc-theme-custom">
      <FullCalendar
        plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
        initialView="dayGridMonth"
        headerToolbar={{
          left: 'prev,next today',
          center: 'title',
          right: 'dayGridMonth,timeGridWeek,timeGridDay,listMonth'
        }}
        events={events}
        eventContent={renderEventContent}
        eventClick={(info) => onEventClick(info.event.extendedProps)}
        height="auto"
        aspectRatio={1.5}
        editable={false}
        selectable={true}
        nowIndicator={true}
        dayMaxEvents={true}
        eventTimeFormat={{
          hour: '2-digit',
          minute: '2-digit',
          meridiem: 'short'
        }}
      />
      
      <style>{`
        .fc { --fc-border-color: #f1f5f9; --fc-today-bg-color: #f8fafc; }
        .dark .fc { --fc-border-color: #334155; --fc-today-bg-color: #1e293b; }
        .fc-theme-custom .fc-scrollgrid { border-radius: 1rem; border-style: hidden; }
        .fc-theme-custom .fc-col-header-cell { padding: 12px 0; background: #f8fafc; font-weight: 600; text-transform: uppercase; font-size: 11px; letter-spacing: 0.05em; color: #64748b; }
        .dark .fc-theme-custom .fc-col-header-cell { background: #1e293b; color: #94a3b8; }
        .fc-theme-custom .fc-daygrid-day-number { font-size: 13px; font-weight: 500; padding: 8px; color: #64748b; }
        .dark .fc-theme-custom .fc-daygrid-day-number { color: #94a3b8; }
        .fc-theme-custom .fc-event { border: none; border-radius: 10px; padding: 0; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); transition: transform 0.15s ease; }
        .fc-theme-custom .fc-event:hover { transform: scale(1.02); z-index: 10; }
        .fc-theme-custom .fc-toolbar-title { font-size: 1.1rem; font-weight: 700; color: #1e293b; }
        .dark .fc-theme-custom .fc-toolbar-title { color: #f1f5f9; }
        .fc-theme-custom .fc-button-primary { background: white; border: 1px solid #e2e8f0; color: #64748b; font-size: 13px; font-weight: 600; text-transform: capitalize; padding: 6px 12px; }
        .dark .fc-theme-custom .fc-button-primary { background: #1e293b; border-color: #334155; color: #94a3b8; }
        .fc-theme-custom .fc-button-primary:hover { background: #f8fafc; color: #1e293b; }
        .fc-theme-custom .fc-button-active { background: #1e293b !important; color: white !important; border-color: #1e293b !important; }
        .dark .fc-theme-custom .fc-button-active { background: #3b82f6 !important; border-color: #3b82f6 !important; }
      `}</style>
    </div>
  )
}
