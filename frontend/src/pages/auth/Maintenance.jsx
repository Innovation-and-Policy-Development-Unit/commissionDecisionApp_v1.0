import { useState, useEffect, Fragment } from 'react'
import { Link } from 'react-router-dom'
import { Wrench, Mail, Twitter, Clock } from 'lucide-react'
import Logo from '../../components/shared/Logo'

function useCountdown(targetHours = 4) {
  const [time, setTime] = useState({ h: targetHours, m: 32, s: 47 })

  useEffect(() => {
    const id = setInterval(() => {
      setTime(t => {
        if (t.s > 0) return { ...t, s: t.s - 1 }
        if (t.m > 0) return { ...t, m: t.m - 1, s: 59 }
        if (t.h > 0) return { ...t, h: t.h - 1, m: 59, s: 59 }
        clearInterval(id)
        return t
      })
    }, 1000)
    return () => clearInterval(id)
  }, [])

  return time
}

export default function Maintenance() {
  const [email, setEmail] = useState('')
  const [notified, setNotified] = useState(false)
  const time = useCountdown(4)

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-primary-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-violet-500/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary-900/20 rounded-full blur-3xl" />
      </div>

      {/* Floating gears decoration */}
      <div className="absolute top-20 end-20 text-primary-500/10 animate-spin" style={{ animationDuration: '20s' }}>
        <svg width="80" height="80" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 15a3 3 0 100-6 3 3 0 000 6z M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
        </svg>
      </div>
      <div className="absolute bottom-32 start-20 text-violet-500/10 animate-spin" style={{ animationDuration: '35s', animationDirection: 'reverse' }}>
        <svg width="60" height="60" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 15a3 3 0 100-6 3 3 0 000 6z M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
        </svg>
      </div>

      <div className="text-center max-w-lg w-full">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-10">
          <Logo size={40} />
          <span className="text-2xl font-bold text-white">Liner Admin</span>
        </div>

        {/* Icon */}
        <div className="w-24 h-24 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center mx-auto mb-6 border border-white/20">
          <Wrench size={44} className="text-primary-400" />
        </div>

        <h1 className="text-4xl font-extrabold text-white mb-3">Under Maintenance</h1>
        <p className="text-slate-400 text-lg mb-8 leading-relaxed">
          We're currently performing scheduled maintenance to improve your experience. We'll be back shortly!
        </p>

        {/* Countdown */}
        <div className="flex items-center justify-center gap-4 mb-8">
          {[
            { label: 'Hours', value: String(time.h).padStart(2, '0') },
            { label: 'Minutes', value: String(time.m).padStart(2, '0') },
            { label: 'Seconds', value: String(time.s).padStart(2, '0') },
          ].map((unit, i) => (
            <Fragment key={unit.label}>
              {i > 0 && <span className="text-3xl font-bold text-primary-400 -mt-6">:</span>}
              <div className="text-center">
                <div className="w-20 h-20 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center mb-1">
                  <span className="text-3xl font-bold text-white font-mono">{unit.value}</span>
                </div>
                <span className="text-xs text-slate-400 uppercase tracking-widest font-medium">{unit.label}</span>
              </div>
            </Fragment>
          ))}
        </div>

        {/* Notify form */}
        {!notified ? (
          <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-6 mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Clock size={16} className="text-primary-400" />
              <p className="text-sm text-slate-300 font-medium">Get notified when we're back</p>
            </div>
            <div className="flex gap-2">
              <input
                type="email"
                placeholder="Enter your email"
                className="input bg-white/10 border-white/20 text-white placeholder-slate-400 focus:border-primary-500 flex-1"
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
              <button onClick={() => email && setNotified(true)} className="btn btn-primary shrink-0">
                <Mail size={15} /> Notify Me
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-emerald-500/20 border border-emerald-500/30 rounded-2xl p-4 mb-6">
            <p className="text-emerald-300 text-sm font-medium">You'll be notified at {email} when we're back!</p>
          </div>
        )}

        <div className="flex items-center justify-center gap-4 text-sm">
          <Link to="/" className="text-primary-400 hover:text-primary-300 transition-colors">Try Again</Link>
          <span className="text-slate-600">·</span>
          <a href="https://status.liner.com" className="text-slate-400 hover:text-slate-300 transition-colors">Status Page</a>
          <span className="text-slate-600">·</span>
          <a href="#" onClick={(e) => e.preventDefault()} className="text-slate-400 hover:text-slate-300 flex items-center gap-1 transition-colors">
            <Twitter size={13} /> @LinerAdmin
          </a>
        </div>
      </div>
    </div>
  )
}
