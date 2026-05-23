import { Fragment, useState, useEffect } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { useTranslation } from 'react-i18next'
import {
  X, Usb, Ban, Monitor, Video, Mic2, PlayCircle,
  ChevronRight, CheckCircle2,
} from 'lucide-react'
import clsx from 'clsx'

const STEPS = [
  { key: 'usb', icon: Usb, color: 'from-blue-500 to-cyan-500' },
  { key: 'forbid', icon: Ban, color: 'from-red-500 to-orange-500' },
  { key: 'windows', icon: Monitor, color: 'from-violet-500 to-purple-500' },
  { key: 'zoom', icon: Video, color: 'from-primary-500 to-blue-600' },
  { key: 'expansion', icon: Mic2, color: 'from-emerald-500 to-teal-500' },
  { key: 'record', icon: PlayCircle, color: 'from-amber-500 to-yellow-500' },
]

export default function LogitechGroupGuideDialog({ open, onClose }) {
  const { t } = useTranslation()
  const [activeStep, setActiveStep] = useState(0)

  useEffect(() => {
    if (open) setActiveStep(0)
  }, [open])

  return (
    <Transition show={open} as={Fragment}>
      <Dialog as="div" className="relative z-[70]" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto p-4 sm:p-6">
          <div className="flex min-h-full items-center justify-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-200"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-150"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-4xl transform overflow-hidden rounded-2xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-700">
                <div className="flex items-start justify-between gap-4 border-b border-slate-100 dark:border-slate-800 px-6 py-4">
                  <div>
                    <Dialog.Title className="text-lg font-bold text-slate-900 dark:text-slate-100">
                      {t('meeting_room.logitech_title')}
                    </Dialog.Title>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                      {t('meeting_room.logitech_subtitle')}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-600"
                    aria-label={t('common.close')}
                  >
                    <X size={20} />
                  </button>
                </div>

                <div className="px-6 py-4 max-h-[calc(90vh-5rem)] overflow-y-auto">
                  <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800/50 dark:bg-amber-900/20 dark:text-amber-100">
                    {t('meeting_room.logitech_policy')}
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      {STEPS.map((step, idx) => {
                        const Icon = step.icon
                        const isActive = activeStep === idx
                        const isDone = activeStep > idx
                        return (
                          <button
                            key={step.key}
                            type="button"
                            onClick={() => setActiveStep(idx)}
                            className={clsx(
                              'w-full flex items-center gap-2 rounded-lg border px-3 py-2 text-left transition-all text-sm',
                              isActive
                                ? 'border-primary-400 bg-primary-50 dark:bg-primary-900/30'
                                : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50',
                            )}
                          >
                            <div
                              className={clsx(
                                'w-8 h-8 rounded-md flex items-center justify-center shrink-0 bg-gradient-to-br text-white',
                                step.color,
                              )}
                            >
                              {isDone ? <CheckCircle2 size={14} /> : <Icon size={14} />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                {t('meeting_room.step_n', { n: idx + 1 })}
                              </p>
                              <p className="font-bold text-slate-800 dark:text-slate-100 truncate text-xs">
                                {t(`meeting_room.logitech_step_${step.key}_title`)}
                              </p>
                            </div>
                            <ChevronRight size={12} className={clsx('text-slate-400 shrink-0', isActive && 'text-primary-500')} />
                          </button>
                        )
                      })}
                    </div>

                    <div className="lg:col-span-2">
                      {STEPS.map((step, idx) => {
                        const Icon = step.icon
                        if (activeStep !== idx) return null
                        return (
                          <div key={step.key} className="rounded-xl border border-slate-200 dark:border-slate-700 p-5">
                            <div
                              className={clsx(
                                'w-12 h-12 rounded-xl flex items-center justify-center mb-4 bg-gradient-to-br text-white',
                                step.color,
                              )}
                            >
                              <Icon size={24} />
                            </div>
                            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-2">
                              {t(`meeting_room.logitech_step_${step.key}_title`)}
                            </h3>
                            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed mb-3">
                              {t(`meeting_room.logitech_step_${step.key}_body`)}
                            </p>
                            <ul className="space-y-1.5 text-sm text-slate-600 dark:text-slate-400 mb-4">
                              {[1, 2, 3].map(n => {
                                const tipKey = `meeting_room.logitech_step_${step.key}_tip_${n}`
                                const tip = t(tipKey)
                                if (tip === tipKey) return null
                                return (
                                  <li key={n} className="flex items-start gap-2">
                                    <span className="text-primary-500 font-bold">•</span>
                                    {tip}
                                  </li>
                                )
                              })}
                            </ul>
                            <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                              <button
                                type="button"
                                disabled={idx === 0}
                                onClick={() => setActiveStep(s => Math.max(0, s - 1))}
                                className="btn-secondary btn-sm disabled:opacity-40"
                              >
                                {t('common.previous')}
                              </button>
                              {idx < STEPS.length - 1 ? (
                                <button
                                  type="button"
                                  onClick={() => setActiveStep(s => Math.min(STEPS.length - 1, s + 1))}
                                  className="btn-primary btn-sm"
                                >
                                  {t('common.next')}
                                </button>
                              ) : (
                                <button type="button" onClick={onClose} className="btn-primary btn-sm">
                                  {t('common.close')}
                                </button>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  )
}
