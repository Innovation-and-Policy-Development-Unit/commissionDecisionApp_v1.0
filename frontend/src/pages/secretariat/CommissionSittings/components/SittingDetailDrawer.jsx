import { Fragment } from 'react'
import { useNavigate } from 'react-router-dom'
import { Dialog, Transition } from '@headlessui/react'
import { X, Calendar, Clock, MapPin, ListChecks, FileText, CheckSquare, Users, Trash2, Edit3, ChevronRight, AlertCircle, Mic, FileSignature } from 'lucide-react'
import { SITTING_STATUSES } from '../constants'
import clsx from 'clsx'

export default function SittingDetailDrawer({ sitting, isOpen, onClose, getCapacity }) {
  const navigate = useNavigate()
  if (!sitting) return null

  const status = SITTING_STATUSES[sitting.status] || {}
  const capacity = getCapacity(sitting.agenda_count || 0)

  return (
    <Transition.Root show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-[60]" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-in-out duration-500"
          enterFrom="opacity-0"
          leave="ease-in-out duration-500"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-hidden">
          <div className="absolute inset-0 overflow-hidden">
            <div className="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-10">
              <Transition.Child
                as={Fragment}
                enter="transform transition ease-in-out duration-500 sm:duration-700"
                enterFrom="translate-x-full"
                enterTo="translate-x-0"
                leave="transform transition ease-in-out duration-500 sm:duration-700"
                leaveFrom="translate-x-0"
                leaveTo="translate-x-full"
              >
                <Dialog.Panel className="pointer-events-auto w-screen max-w-2xl">
                  <div className="flex h-full flex-col overflow-y-scroll bg-white dark:bg-slate-900 shadow-2xl">
                    {/* Header */}
                    <div className="relative border-b border-slate-100 dark:border-slate-800 px-8 py-8">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-3 mb-3">
                            <span className="font-mono text-xs font-bold text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20 px-2 py-1 rounded-lg">
                              {sitting.reference_number}
                            </span>
                            <div className={clsx(
                              "inline-flex items-center gap-1.5 rounded-full px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider border shadow-sm",
                              status.bg, status.text, status.border
                            )}>
                              {status.label}
                            </div>
                          </div>
                          <Dialog.Title className="text-2xl font-black text-slate-900 dark:text-slate-100 leading-tight">
                            {sitting.title}
                          </Dialog.Title>
                        </div>
                        <div className="ml-3 flex h-7 items-center">
                          <button
                            type="button"
                            className="rounded-xl bg-slate-50 dark:bg-slate-800 p-2 text-slate-400 hover:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all focus:outline-none"
                            onClick={onClose}
                          >
                            <X className="h-6 w-6" aria-hidden="true" />
                          </button>
                        </div>
                      </div>
                      
                      <div className="mt-6 grid grid-cols-2 gap-6">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-400">
                            <Calendar size={20} />
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Date</p>
                            <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
                              {new Date(sitting.date + 'T00:00').toLocaleDateString('en-VU', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-400">
                            <Clock size={20} />
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Time</p>
                            <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{sitting.time.slice(0, 5)}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 col-span-2">
                          <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-400 shrink-0">
                            <MapPin size={20} />
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Venue</p>
                            <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{sitting.venue}</p>
                          </div>
                        </div>
                      </div>

                      {/* Quick Summary Cards */}
                      <div className="mt-8 grid grid-cols-3 gap-4">
                        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 border border-slate-100 dark:border-slate-800">
                          <ListChecks size={18} className="text-primary-500 mb-2" />
                          <p className="text-lg font-bold text-slate-900 dark:text-slate-100 leading-none">{sitting.agenda_count || 0}</p>
                          <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-tight">Agenda Items</p>
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 border border-slate-100 dark:border-slate-800">
                          <CheckSquare size={18} className="text-emerald-500 mb-2" />
                          <p className="text-lg font-bold text-slate-900 dark:text-slate-100 leading-none">{sitting.decisions_count || 0}</p>
                          <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-tight">Decisions</p>
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 border border-slate-100 dark:border-slate-800">
                          <div className={`w-2 h-2 rounded-full bg-${capacity.color}-500 mb-3`} />
                          <p className="text-lg font-bold text-slate-900 dark:text-slate-100 leading-none">{capacity.label}</p>
                          <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-tight">Agenda Load</p>
                        </div>
                      </div>
                    </div>

                    {/* Operational Sections */}
                    <div className="p-8 space-y-8">
                      {/* Agenda Section */}
                      <section>
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-2">
                            <FileText size={18} className="text-slate-400" />
                            <h3 className="font-bold text-slate-900 dark:text-slate-100 uppercase text-xs tracking-wider">Sitting Agenda</h3>
                          </div>
                          <button className="text-xs font-bold text-primary-600 dark:text-primary-400 hover:underline">View Full Agenda</button>
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-800/30 rounded-2xl p-6 border border-dashed border-slate-200 dark:border-slate-700 text-center">
                          <p className="text-sm text-slate-500 italic">No agenda items loaded yet for this session.</p>
                        </div>
                      </section>

                      {/* Attendance Section */}
                      <section>
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-2">
                            <Users size={18} className="text-slate-400" />
                            <h3 className="font-bold text-slate-900 dark:text-slate-100 uppercase text-xs tracking-wider">Attendance & Quorum</h3>
                          </div>
                          <button className="text-xs font-bold text-primary-600 dark:text-primary-400 hover:underline">Record Attendance</button>
                        </div>
                        <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30 rounded-xl text-amber-700 dark:text-amber-300 text-xs">
                          <AlertCircle size={14} />
                          <span>Attendance has not been recorded yet.</span>
                        </div>
                      </section>

                      {/* Recording Section */}
                      <section>
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-2">
                            <Mic size={18} className="text-slate-400" />
                            <h3 className="font-bold text-slate-900 dark:text-slate-100 uppercase text-xs tracking-wider">Meeting Recording</h3>
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            onClose()
                            navigate(`/meetings/capture?meetingId=${sitting.id}`)
                          }}
                          className="w-full flex items-center justify-center gap-2 bg-primary-50 dark:bg-primary-900/20 hover:bg-primary-100 dark:hover:bg-primary-900/40 border border-dashed border-primary-300 dark:border-primary-700 rounded-xl p-4 text-primary-700 dark:text-primary-300 font-semibold text-sm transition-colors"
                        >
                          <Mic size={18} />
                          Record this meeting
                        </button>
                      </section>

                      {/* Minutes Section */}
                      <section>
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-2">
                            <FileSignature size={18} className="text-slate-400" />
                            <h3 className="font-bold text-slate-900 dark:text-slate-100 uppercase text-xs tracking-wider">Minutes</h3>
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            onClose()
                            navigate(`/secretariat/meetings/${sitting.id}/minutes`)
                          }}
                          className="w-full flex items-center justify-center gap-2 bg-emerald-50 dark:bg-emerald-900/20 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 border border-dashed border-emerald-300 dark:border-emerald-700 rounded-xl p-4 text-emerald-700 dark:text-emerald-300 font-semibold text-sm transition-colors"
                        >
                          <FileSignature size={18} />
                          Manage Minutes & AI Tools
                        </button>
                      </section>
                    </div>

                    {/* Footer Actions */}
                    <div className="mt-auto border-t border-slate-100 dark:border-slate-800 p-8 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/20">
                      <button className="flex items-center gap-2 text-sm font-bold text-red-600 hover:text-red-700 transition-colors">
                        <Trash2 size={18} /> Cancel Sitting
                      </button>
                      <div className="flex items-center gap-3">
                        <button className="btn-secondary py-2.5 px-6 flex items-center gap-2">
                          <Edit3 size={16} /> Edit Details
                        </button>
                        <button className="btn-gradient py-2.5 px-6 flex items-center gap-2 shadow-lg shadow-primary-500/20">
                          Launch Operations <ChevronRight size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  )
}
