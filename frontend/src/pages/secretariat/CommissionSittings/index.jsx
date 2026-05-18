import { useState, useMemo } from 'react'
import PageHeader from '../../../components/shared/PageHeader'
import { Calendar, List, Search, RefreshCw, X, Plus } from 'lucide-react'
import KPIBanner from './components/KPIBanner'
import OperationalSidebar from './components/OperationalSidebar'
import CalendarView from './components/CalendarView'
import ListView from './components/ListView'
import SittingDetailDrawer from './components/SittingDetailDrawer'
import { useSittingOperations } from './hooks/useSittingOperations'
import { VENUES, SITTING_TYPES } from './constants'
import api from '../../../api/client'
import clsx from 'clsx'
import { useToast } from '../../../context/ToastContext'

export default function CommissionSittings() {
  const toast = useToast()
  const { meetings, loading, error, conflicts, kpis, getCapacity, refresh } = useSittingOperations()
  
  const [viewMode, setViewMode] = useState('calendar') // 'calendar' | 'list'
  const [q, setQ] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  
  const [selectedSitting, setSelectedSitting] = useState(null)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    title: '', date: new Date().toISOString().split('T')[0], time: '09:00', venue: VENUES[0], type: 'ordinary', notes: ''
  })

  const filteredMeetings = useMemo(() => {
    const s = q.trim().toLowerCase()
    return meetings.filter(m => {
      if (statusFilter && m.status !== statusFilter) return false
      if (typeFilter && m.type !== typeFilter) return false
      if (s && !m.reference_number.toLowerCase().includes(s) && !m.title.toLowerCase().includes(s) && !m.venue.toLowerCase().includes(s)) return false
      return true
    })
  }, [meetings, q, statusFilter, typeFilter])

  const handleSittingClick = (sitting) => {
    setSelectedSitting(sitting)
    setIsDrawerOpen(true)
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await api.post('/meetings/', form)
      refresh()
      setIsModalOpen(false)
      setForm({ title: '', date: new Date().toISOString().split('T')[0], time: '09:00', venue: VENUES[0], type: 'ordinary', notes: '' })
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to schedule sitting.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader 
        title="Commission Sittings" 
        subtitle="Manage PSC meetings, agenda capacity, and decision recording."
      />

      <KPIBanner kpis={kpis} />

      <div className="flex flex-1 gap-6 overflow-hidden min-h-0">
        <OperationalSidebar 
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          typeFilter={typeFilter}
          setTypeFilter={setTypeFilter}
          onScheduleClick={() => setIsModalOpen(true)}
          conflicts={conflicts}
        />

        <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Toolbar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-4">
            <div className="relative w-full sm:w-96">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Search size={16} />
              </div>
              <input 
                type="text" 
                className="input pl-10 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-sm"
                placeholder="Search sittings by reference, title..."
                value={q}
                onChange={e => setQ(e.target.value)}
              />
              <button 
                onClick={refresh}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-primary-600 transition-colors"
              >
                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              </button>
            </div>

            <div className="inline-flex p-1 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
              <button 
                onClick={() => setViewMode('calendar')}
                className={clsx(
                  "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all",
                  viewMode === 'calendar' ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-md" : "text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700"
                )}
              >
                <Calendar size={14} /> Calendar View
              </button>
              <button 
                onClick={() => setViewMode('list')}
                className={clsx(
                  "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all",
                  viewMode === 'list' ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-md" : "text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700"
                )}
              >
                <List size={14} /> Operational List
              </button>
            </div>
          </div>

          {/* Main Content Area */}
          <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar">
            {viewMode === 'calendar' ? (
              <CalendarView 
                meetings={filteredMeetings} 
                onEventClick={handleSittingClick}
                getCapacity={getCapacity}
              />
            ) : (
              <ListView 
                meetings={filteredMeetings} 
                onSittingClick={handleSittingClick}
                getCapacity={getCapacity}
              />
            )}
          </div>
        </main>
      </div>

      <SittingDetailDrawer 
        sitting={selectedSitting}
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        getCapacity={getCapacity}
      />

      {/* Schedule Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-scale-in">
            <div className="px-8 py-6 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
              <h2 className="text-xl font-black text-slate-900 dark:text-white">Schedule Sitting</h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl text-slate-400">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCreate} className="p-8 space-y-5">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Sitting Title</label>
                <input 
                  className="input" required 
                  placeholder='e.g. "8th Ordinary Sitting 2024"' 
                  value={form.title} 
                  onChange={e => setForm({...form, title: e.target.value})} 
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Date</label>
                  <input type="date" className="input" required value={form.date} onChange={e => setForm({...form, date: e.target.value})} />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Time</label>
                  <input type="time" className="input" required value={form.time} onChange={e => setForm({...form, time: e.target.value})} />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Venue</label>
                <select className="input" value={form.venue} onChange={e => setForm({...form, venue: e.target.value})}>
                  {VENUES.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Sitting Type</label>
                <select className="input" value={form.type} onChange={e => setForm({...form, type: e.target.value})}>
                  {SITTING_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div className="pt-4 flex gap-3">
                <button type="submit" disabled={saving} className="flex-1 btn-gradient py-3 shadow-lg shadow-primary-500/20">
                  {saving ? 'Scheduling...' : 'Schedule Sitting'}
                </button>
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 btn-secondary">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
