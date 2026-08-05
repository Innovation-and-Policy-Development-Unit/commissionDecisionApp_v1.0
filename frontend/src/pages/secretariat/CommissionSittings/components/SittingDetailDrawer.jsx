import { Fragment, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Dialog, Transition } from '@headlessui/react'
import { X, Calendar, Clock, MapPin, ListChecks, FileText, CheckSquare, Users, Trash2, Edit3, ChevronRight, AlertCircle, FileSignature, PenLine, Rocket } from 'lucide-react'
import { SITTING_STATUSES, VENUES, SITTING_TYPES } from '../constants'
import clsx from 'clsx'
import AgendaReadinessChip from '../../../../components/shared/AgendaReadinessChip'
import MeetingBriefingPack from '../../../../components/meetings/MeetingBriefingPack'
import Modal from '../../../../components/shared/Modal'
import { useAuth } from '../../../../context/AuthContext'
import { useToast } from '../../../../context/ToastContext'
import { useConfirm } from '../../../../context/ConfirmContext'
import { userIsOpscInternal, userCanRegenerateAiBrief } from '../../../../utils/opscAccess'
import api from '../../../../api/client'

const MANAGE_ROLES = new Set(['psc_secretary', 'senior_admin_officer', 'psc_admin'])

export default function SittingDetailDrawer({ sitting, isOpen, onClose, getCapacity, onOpenLogitechGuide, onUpdated }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const toast = useToast()
  const confirm = useConfirm()

  const [isEditOpen, setIsEditOpen] = useState(false)
  const [editForm, setEditForm] = useState(null)
  const [editSaving, setEditSaving] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [launching, setLaunching] = useState(false)

  if (!sitting) return null

  const canViewBriefingPack = userIsOpscInternal(user)
  const canRegenerateBriefingPack = userCanRegenerateAiBrief(user)
  const canManage = user && MANAGE_ROLES.has(user.role)

  const status = SITTING_STATUSES[sitting.status] || {}
  const capacity = getCapacity(sitting.agenda_count || 0)
  const isCancelled = sitting.status === 'cancelled'
  const isInProgress = sitting.status === 'in_progress'

  const openEdit = () => {
    setEditForm({
      title: sitting.title || '',
      date: sitting.date || '',
      time: (sitting.time || '09:00').slice(0, 5),
      venue: sitting.venue || VENUES[0],
      type: sitting.type || 'ordinary',
    })
    setIsEditOpen(true)
  }

  const submitEdit = async (e) => {
    e.preventDefault()
    setEditSaving(true)
    try {
      await api.patch(`/meetings/${sitting.id}/`, editForm)
      toast.success('Sitting details updated.')
      setIsEditOpen(false)
      onUpdated?.()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to update sitting.')
    } finally {
      setEditSaving(false)
    }
  }

  const handleCancelSitting = async () => {
    const ok = await confirm({
      title: 'Cancel this sitting?',
      message: `"${sitting.title}" will be marked as cancelled. This does not delete its record, agenda, or minutes — it can still be viewed, just no longer scheduled to proceed.`,
      confirmLabel: 'Cancel sitting',
      cancelLabel: 'Keep sitting',
      variant: 'danger',
    })
    if (!ok) return
    setCancelling(true)
    try {
      await api.patch(`/meetings/${sitting.id}/`, { status: 'cancelled' })
      toast.success('Sitting cancelled.')
      onUpdated?.()
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to cancel sitting.')
    } finally {
      setCancelling(false)
    }
  }

  const launchOperations = async () => {
    setLaunching(true)
    try {
      await api.patch(`/meetings/${sitting.id}/`, { status: 'in_progress' })
      toast.success('Sitting is now in progress.')
      onUpdated?.()
      onClose()
      navigate(`/secretariat/meetings/${sitting.id}/workspace`)
    } catch (err) {
      toast.error(
        err.response?.data?.detail
        || 'Could not launch operations — the agenda must be adopted by the Chairperson first.'
      )
    } finally {
      setLaunching(false)
    }
  }

  return (
    <>
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
                            {sitting.agenda_readiness && sitting.status !== 'completed' && (
                              <AgendaReadinessChip readiness={sitting.agenda_readiness} size="sm" />
                            )}
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
                          <button
                            type="button"
                            onClick={() => {
                              onClose()
                              navigate(`/secretariat/meetings/${sitting.id}/workspace`)
                            }}
                            className="text-xs font-bold text-primary-600 dark:text-primary-400 hover:underline"
                          >
                            Open Workspace
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            onClose()
                            navigate(`/secretariat/meetings/${sitting.id}/workspace`)
                          }}
                          className="w-full bg-slate-50 dark:bg-slate-800/30 rounded-2xl p-6 border border-dashed border-slate-200 dark:border-slate-700 text-center hover:border-primary-300 dark:hover:border-primary-700 transition-colors"
                        >
                          {sitting.agenda_count
                            ? <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{sitting.agenda_count} item{sitting.agenda_count !== 1 ? 's' : ''} — open the Sitting Workspace</p>
                            : <p className="text-sm text-slate-500 italic">No agenda items yet — open the Sitting Workspace to schedule submissions.</p>}
                        </button>
                        {canViewBriefingPack && (
                          <MeetingBriefingPack
                            meetingId={sitting.id}
                            meetingRef={sitting.reference_number}
                            canRegenerate={canRegenerateBriefingPack}
                          />
                        )}
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

                      {/* Minutes Section */}
                      <section>
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-2">
                            <FileSignature size={18} className="text-slate-400" />
                            <h3 className="font-bold text-slate-900 dark:text-slate-100 uppercase text-xs tracking-wider">Minutes</h3>
                          </div>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <button
                            type="button"
                            onClick={() => {
                              onClose()
                              navigate(`/secretariat/minute-intake/${sitting.id}`)
                            }}
                            className="w-full flex items-center justify-center gap-2 bg-primary-50 dark:bg-primary-900/20 hover:bg-primary-100 dark:hover:bg-primary-900/40 border border-dashed border-primary-300 dark:border-primary-700 rounded-xl p-4 text-primary-700 dark:text-primary-300 font-semibold text-sm transition-colors"
                          >
                            <PenLine size={18} />
                            {t('nav.minute_intake')}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              onClose()
                              navigate(`/secretariat/meetings/${sitting.id}/minutes`)
                            }}
                            className="w-full flex items-center justify-center gap-2 bg-emerald-50 dark:bg-emerald-900/20 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 border border-dashed border-emerald-300 dark:border-emerald-700 rounded-xl p-4 text-emerald-700 dark:text-emerald-300 font-semibold text-sm transition-colors"
                          >
                            <FileSignature size={18} />
                            {t('meeting_room.minutes_edit_sign')}
                          </button>
                        </div>
                      </section>
                    </div>

                    {/* Footer Actions */}
                    {canManage && (
                      <div className="mt-auto border-t border-slate-100 dark:border-slate-800 p-8 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/20">
                        <button
                          type="button"
                          disabled={isCancelled || cancelling}
                          onClick={handleCancelSitting}
                          className="flex items-center gap-2 text-sm font-bold text-red-600 hover:text-red-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:text-red-600"
                        >
                          <Trash2 size={18} /> {cancelling ? 'Cancelling…' : 'Cancel Sitting'}
                        </button>
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            disabled={isCancelled}
                            onClick={openEdit}
                            className="btn-secondary py-2.5 px-6 flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <Edit3 size={16} /> Edit Details
                          </button>
                          {!isInProgress && (
                            <button
                              type="button"
                              disabled={isCancelled || launching}
                              onClick={launchOperations}
                              className="btn-gradient py-2.5 px-6 flex items-center gap-2 shadow-lg shadow-primary-500/20 disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              {launching ? 'Launching…' : 'Launch Operations'}
                              {!launching && <ChevronRight size={16} />}
                              {launching && <Rocket size={16} className="animate-pulse" />}
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </div>
      </Dialog>
    </Transition.Root>

    {isEditOpen && editForm && (
      <Modal
        open={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        size="md"
        title="Edit Sitting Details"
      >
        <form onSubmit={submitEdit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Sitting title</label>
            <input
              className="input"
              required
              value={editForm.title}
              onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Date</label>
              <input
                type="date"
                className="input"
                required
                value={editForm.date}
                onChange={e => setEditForm(f => ({ ...f, date: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Time</label>
              <input
                type="time"
                className="input"
                required
                value={editForm.time}
                onChange={e => setEditForm(f => ({ ...f, time: e.target.value }))}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Venue</label>
            <select
              className="input"
              value={editForm.venue}
              onChange={e => setEditForm(f => ({ ...f, venue: e.target.value }))}
            >
              {VENUES.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Sitting type</label>
            <select
              className="input"
              value={editForm.type}
              onChange={e => setEditForm(f => ({ ...f, type: e.target.value }))}
            >
              {SITTING_TYPES.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-3 pt-2">
            <button type="submit" disabled={editSaving} className="btn-primary flex-1 py-2.5 disabled:opacity-50">
              {editSaving ? 'Saving…' : 'Save changes'}
            </button>
            <button type="button" onClick={() => setIsEditOpen(false)} className="btn-secondary px-6 py-2.5">
              Cancel
            </button>
          </div>
        </form>
      </Modal>
    )}
    </>
  )
}
