import { useCallback, useEffect, useState } from 'react'
import { Search, Bell, Keyboard, Sparkles } from 'lucide-react'
import Modal from './Modal'
import BaseButton from './BaseButton'
import { useAuth } from '../../context/AuthContext'

const STEPS = [
  {
    icon: Sparkles,
    title: 'Welcome to SCDMS',
    body: 'Lodge submissions, follow them through every stage, and keep Commission decisions in one place. This 30-second tour shows where things are.',
  },
  {
    icon: Search,
    title: 'Find anything fast',
    body: 'Press Ctrl+K (or /) from any page to search submissions by reference number or jump straight to any page you have access to.',
  },
  {
    icon: Bell,
    title: 'Stay on top of what needs you',
    body: 'Your dashboard opens with a daily briefing of what needs action. The bell in the top bar shows new activity as it happens.',
  },
  {
    icon: Keyboard,
    title: 'Shortcuts when you want them',
    body: 'Press ? at any time to see keyboard shortcuts. You can reopen this tour from that list.',
  },
]

function storageKey(user) {
  return `scdms:welcome-tour:${user?.id ?? 'anon'}`
}

/** First-login walkthrough. Remembers dismissal per user in this browser; reopen with the `psc:tour:open` event. */
export default function WelcomeTour() {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState(0)

  useEffect(() => {
    if (!user) return
    try {
      if (localStorage.getItem(storageKey(user)) !== 'done') setOpen(true)
    } catch {
      // storage blocked — skip the automatic tour rather than nag every load
    }
  }, [user])

  useEffect(() => {
    const onOpen = () => { setStep(0); setOpen(true) }
    document.addEventListener('psc:tour:open', onOpen)
    return () => document.removeEventListener('psc:tour:open', onOpen)
  }, [])

  const finish = useCallback(() => {
    setOpen(false)
    try { localStorage.setItem(storageKey(user), 'done') } catch { /* ignore */ }
  }, [user])

  if (!open) return null
  const current = STEPS[step]
  const Icon = current.icon
  const last = step === STEPS.length - 1

  return (
    <Modal
      open
      onClose={finish}
      size="sm"
      title={current.title}
      footer={(
        <>
          <span className="mr-auto self-center text-xs text-slate-500 dark:text-slate-400">{step + 1} / {STEPS.length}</span>
          {step > 0 && <BaseButton variant="secondary" onClick={() => setStep(s => s - 1)}>Back</BaseButton>}
          {!last && <BaseButton variant="ghost" onClick={finish}>Skip</BaseButton>}
          <BaseButton variant="primary" onClick={() => (last ? finish() : setStep(s => s + 1))}>
            {last ? 'Get started' : 'Next'}
          </BaseButton>
        </>
      )}
    >
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-50 text-primary-600 dark:bg-primary-900/30 dark:text-primary-300" aria-hidden="true">
          <Icon size={22} />
        </span>
        <p className="pt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{current.body}</p>
      </div>
    </Modal>
  )
}
