import { useState } from 'react'
import PageHeader from '../../components/shared/PageHeader'
import {
  CheckCircle, XCircle, AlertTriangle, Info, X,
  Wifi, Download, ArrowRight
} from 'lucide-react'

/* ─── Reusable inline alert ─────────────────────────────────────── */
function Alert({ variant = 'info', title, message, dismissible = false, onDismiss, icon: IconOverride }) {
  const cfg = {
    success: {
      wrap: 'bg-emerald-50 border border-emerald-200 text-emerald-800 dark:bg-emerald-900/20 dark:border-emerald-700 dark:text-emerald-300',
      icon: CheckCircle,
      iconCls: 'text-emerald-500',
    },
    info: {
      wrap: 'bg-cyan-50 border border-cyan-200 text-cyan-800 dark:bg-cyan-900/20 dark:border-cyan-700 dark:text-cyan-300',
      icon: Info,
      iconCls: 'text-cyan-500',
    },
    warning: {
      wrap: 'bg-amber-50 border border-amber-200 text-amber-800 dark:bg-amber-900/20 dark:border-amber-700 dark:text-amber-300',
      icon: AlertTriangle,
      iconCls: 'text-amber-500',
    },
    danger: {
      wrap: 'bg-red-50 border border-red-200 text-red-800 dark:bg-red-900/20 dark:border-red-700 dark:text-red-300',
      icon: XCircle,
      iconCls: 'text-red-500',
    },
    primary: {
      wrap: 'bg-primary-50 border border-primary-200 text-primary-800 dark:bg-primary-900/20 dark:border-primary-700 dark:text-primary-300',
      icon: Info,
      iconCls: 'text-primary-500',
    },
  }

  const c = cfg[variant] || cfg.info
  const Icon = IconOverride || c.icon

  return (
    <div className={`flex items-start gap-3 p-4 rounded-xl text-sm ${c.wrap}`}>
      <Icon size={18} className={`shrink-0 mt-0.5 ${c.iconCls}`} />
      <div className="flex-1 min-w-0">
        {title && <p className="font-semibold mb-0.5">{title}</p>}
        <p className={title ? 'opacity-80 leading-relaxed' : 'leading-relaxed'}>{message}</p>
      </div>
      {dismissible && (
        <button
          onClick={onDismiss}
          className="shrink-0 opacity-50 hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-black/10 dark:hover:bg-white/10"
          aria-label="Dismiss"
        >
          <X size={15} />
        </button>
      )}
    </div>
  )
}

/* ─── Section wrapper ────────────────────────────────────────────── */
function Section({ title, description, children }) {
  return (
    <div className="card p-6">
      <div className="mb-4">
        <h3 className="font-semibold text-slate-800 dark:text-slate-200">{title}</h3>
        {description && (
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{description}</p>
        )}
      </div>
      {children}
    </div>
  )
}

/* ─── Main page ──────────────────────────────────────────────────── */
export default function AlertPage() {
  // Dismissible section state
  const initialDismissed = { success: false, info: false, warning: false, danger: false, primary: false }
  const [dismissed, setDismissed] = useState(initialDismissed)

  function dismiss(key) {
    setDismissed(prev => ({ ...prev, [key]: true }))
  }

  const dismissedCount = Object.values(dismissed).filter(Boolean).length

  // Toast state
  const [toasts, setToasts] = useState([
    { id: 1, variant: 'success', title: 'Changes saved', message: 'Your profile has been updated successfully.' },
    { id: 2, variant: 'info', title: 'New message', message: 'Alice sent you a new message in Project Alpha.' },
    { id: 3, variant: 'warning', title: 'Storage almost full', message: 'You\'re using 92% of your 5 GB storage limit.' },
    { id: 4, variant: 'danger', title: 'Sync failed', message: 'Could not sync files. Check your connection and retry.' },
  ])

  function dismissToast(id) {
    setToasts(prev => prev.filter(t => t.id !== id))
  }

  // Download progress state
  const [progress, setProgress] = useState(62)

  function simulateDownload() {
    setProgress(0)
    let p = 0
    const interval = setInterval(() => {
      p += Math.floor(Math.random() * 12) + 4
      if (p >= 100) {
        p = 100
        clearInterval(interval)
      }
      setProgress(p)
    }, 250)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Alerts"
        subtitle="Display important messages, notifications and system feedback to users"
      />

      {/* 1. Color Variants */}
      <Section
        title="Color Variants"
        description="Five semantic alert styles — each with icon, title, message and dismiss button"
      >
        <div className="space-y-3">
          <Alert
            variant="success"
            title="Success — Changes Saved"
            message="Your account settings have been updated and are now live."
            dismissible
            onDismiss={() => {}}
          />
          <Alert
            variant="info"
            title="Info — System Update"
            message="A new version of the dashboard is available. Refresh to apply the update."
            dismissible
            onDismiss={() => {}}
          />
          <Alert
            variant="warning"
            title="Warning — Subscription Expiring"
            message="Your Pro subscription expires in 7 days. Renew now to avoid interruptions."
            dismissible
            onDismiss={() => {}}
          />
          <Alert
            variant="danger"
            title="Error — Upload Failed"
            message="The file could not be uploaded. Maximum size is 10 MB and only JPG/PNG are accepted."
            dismissible
            onDismiss={() => {}}
          />
          <Alert
            variant="primary"
            title="Primary — Action Required"
            message="Please verify your email address to unlock all features of your account."
            dismissible
            onDismiss={() => {}}
          />
        </div>
      </Section>

      {/* 2. With Actions */}
      <Section
        title="With Actions"
        description="Alerts that include inline action buttons for immediate response"
      >
        <div className="space-y-4">
          {/* Warning with actions */}
          <div className="flex items-start gap-3 p-4 rounded-xl border bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-900/20 dark:border-amber-700 dark:text-amber-300 text-sm">
            <AlertTriangle size={18} className="shrink-0 mt-0.5 text-amber-500" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold mb-0.5">Unsaved Changes Detected</p>
              <p className="opacity-80 leading-relaxed mb-3">
                You have unsaved changes to your project. If you leave now, all changes will be lost.
              </p>
              <div className="flex flex-wrap gap-2">
                <button className="btn bg-amber-600 hover:bg-amber-700 text-white focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-1 btn-sm rounded-lg">
                  Save Changes
                </button>
                <button className="btn bg-amber-100 hover:bg-amber-200 text-amber-800 dark:bg-amber-800/50 dark:hover:bg-amber-800 dark:text-amber-200 focus:outline-none btn-sm rounded-lg">
                  Discard
                </button>
              </div>
            </div>
          </div>

          {/* Info with link action */}
          <div className="flex items-start gap-3 p-4 rounded-xl border bg-cyan-50 border-cyan-200 text-cyan-800 dark:bg-cyan-900/20 dark:border-cyan-700 dark:text-cyan-300 text-sm">
            <Info size={18} className="shrink-0 mt-0.5 text-cyan-500" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold mb-0.5">New Features Available</p>
              <p className="opacity-80 leading-relaxed mb-3">
                We've rolled out a new analytics dashboard with real-time metrics, custom reports and export tools.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <button className="btn btn-sm bg-cyan-600 hover:bg-cyan-700 text-white focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-offset-1 rounded-lg">
                  Explore Features <ArrowRight size={14} />
                </button>
                <button className="text-xs font-medium underline opacity-70 hover:opacity-100 transition-opacity">
                  Remind me later
                </button>
              </div>
            </div>
            <button className="shrink-0 opacity-50 hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-black/10 dark:hover:bg-white/10">
              <X size={15} />
            </button>
          </div>

          {/* Danger with actions */}
          <div className="flex items-start gap-3 p-4 rounded-xl border bg-red-50 border-red-200 text-red-800 dark:bg-red-900/20 dark:border-red-700 dark:text-red-300 text-sm">
            <XCircle size={18} className="shrink-0 mt-0.5 text-red-500" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold mb-0.5">Account Deletion Requested</p>
              <p className="opacity-80 leading-relaxed mb-3">
                Your account is scheduled for deletion in 30 days. This action is reversible until the deadline.
              </p>
              <div className="flex flex-wrap gap-2">
                <button className="btn btn-sm bg-red-600 hover:bg-red-700 text-white focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-1 rounded-lg">
                  Cancel Deletion
                </button>
                <button className="btn btn-sm bg-red-100 hover:bg-red-200 text-red-700 dark:bg-red-800/50 dark:hover:bg-red-800 dark:text-red-200 focus:outline-none rounded-lg">
                  Learn More
                </button>
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* 3. Filled Variants */}
      <Section
        title="Filled Variants"
        description="Solid color background alerts for high-visibility messaging"
      >
        <div className="space-y-3">
          {[
            { variant: 'success', icon: CheckCircle, bg: 'bg-emerald-500', msg: 'Deployment successful — all 24 services are running normally.' },
            { variant: 'info', icon: Info, bg: 'bg-cyan-500', msg: 'Scheduled maintenance on Saturday, March 15 from 2–4 AM UTC.' },
            { variant: 'warning', icon: AlertTriangle, bg: 'bg-amber-500', msg: 'High server load detected. Consider scaling up your instances.' },
            { variant: 'danger', icon: XCircle, bg: 'bg-red-500', msg: 'Critical error in module auth-service. Immediate attention required.' },
          ].map(({ variant, icon: Icon, bg, msg }) => (
            <div key={variant} className={`flex items-start gap-3 p-4 rounded-xl text-white text-sm ${bg}`}>
              <Icon size={18} className="shrink-0 mt-0.5 text-white/90" />
              <p className="flex-1 leading-relaxed">{msg}</p>
              <button className="shrink-0 opacity-70 hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-white/20">
                <X size={15} />
              </button>
            </div>
          ))}
        </div>
      </Section>

      {/* 4. Borderless / Soft */}
      <Section
        title="Borderless / Soft"
        description="No border, just a soft background tint — clean and minimal"
      >
        <div className="space-y-3">
          {[
            { cls: 'bg-emerald-50 text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300', icon: CheckCircle, iconCls: 'text-emerald-400', title: 'Password updated', msg: 'Your password has been changed successfully. All sessions have been refreshed.' },
            { cls: 'bg-cyan-50 text-cyan-800 dark:bg-cyan-900/20 dark:text-cyan-300', icon: Info, iconCls: 'text-cyan-400', title: 'Tips for you', msg: 'Pro tip: Use keyboard shortcut Ctrl+K to open the command palette instantly.' },
            { cls: 'bg-amber-50 text-amber-800 dark:bg-amber-900/20 dark:text-amber-300', icon: AlertTriangle, iconCls: 'text-amber-400', title: 'License expiring', msg: 'Your license expires in 14 days. Upgrade to avoid any service interruptions.' },
            { cls: 'bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-300', icon: XCircle, iconCls: 'text-red-400', title: 'API rate limit', msg: 'You\'ve reached 90% of your hourly API rate limit. Reduce request frequency.' },
            { cls: 'bg-primary-50 text-primary-800 dark:bg-primary-900/20 dark:text-primary-300', icon: Info, iconCls: 'text-primary-400', title: 'New update', msg: 'Version 2.4.0 is now available with improved performance and new features.' },
          ].map(({ cls, icon: Icon, iconCls, title, msg }) => (
            <div key={title} className={`flex items-start gap-3 p-4 rounded-xl text-sm ${cls}`}>
              <Icon size={18} className={`shrink-0 mt-0.5 ${iconCls}`} />
              <div className="flex-1">
                <p className="font-semibold mb-0.5">{title}</p>
                <p className="opacity-80 leading-relaxed">{msg}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* 5. Dismissible Alerts */}
      <Section
        title="Dismissible Alerts"
        description="Individual dismiss buttons — each tracked in state independently"
      >
        <div className="space-y-3">
          {dismissedCount > 0 && (
            <div className="flex items-center justify-between p-3 rounded-lg bg-slate-100 dark:bg-slate-700/50 text-sm text-slate-600 dark:text-slate-400">
              <span>{dismissedCount} alert{dismissedCount > 1 ? 's' : ''} dismissed</span>
              <button
                onClick={() => setDismissed(initialDismissed)}
                className="text-xs font-semibold text-primary-600 dark:text-primary-400 hover:underline"
              >
                Reset All
              </button>
            </div>
          )}
          {!dismissed.success && (
            <Alert variant="success" title="Account Verified" message="Your email address has been verified. You now have full access." dismissible onDismiss={() => dismiss('success')} />
          )}
          {!dismissed.info && (
            <Alert variant="info" title="Scheduled Downtime" message="The platform will be offline for maintenance from 3–4 AM UTC on Sunday." dismissible onDismiss={() => dismiss('info')} />
          )}
          {!dismissed.warning && (
            <Alert variant="warning" title="Two-Factor Auth Disabled" message="Your account is more secure with 2FA enabled. Set it up in settings." dismissible onDismiss={() => dismiss('warning')} />
          )}
          {!dismissed.danger && (
            <Alert variant="danger" title="Login Attempt Blocked" message="A suspicious login attempt from 192.168.1.42 was blocked. Review your activity." dismissible onDismiss={() => dismiss('danger')} />
          )}
          {!dismissed.primary && (
            <Alert variant="primary" title="Profile Incomplete" message="Complete your profile to get the most out of the platform — it takes under 2 minutes." dismissible onDismiss={() => dismiss('primary')} />
          )}
          {dismissedCount === 5 && (
            <p className="text-center text-sm text-slate-400 py-4">All alerts dismissed. Click "Reset All" above to restore them.</p>
          )}
        </div>
      </Section>

      {/* 6. Toast / Notification Style */}
      <Section
        title="Toast / Notification Style"
        description="Compact floating-style notification cards with dismiss support"
      >
        {toasts.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-sm text-slate-400 mb-3">All toasts dismissed.</p>
            <button
              onClick={() => setToasts([
                { id: Date.now(), variant: 'success', title: 'Changes saved', message: 'Your profile has been updated successfully.' },
                { id: Date.now() + 1, variant: 'info', title: 'New message', message: 'Alice sent you a new message in Project Alpha.' },
                { id: Date.now() + 2, variant: 'warning', title: 'Storage almost full', message: 'You\'re using 92% of your 5 GB storage limit.' },
                { id: Date.now() + 3, variant: 'danger', title: 'Sync failed', message: 'Could not sync files. Check your connection.' },
              ])}
              className="btn-primary btn-sm"
            >
              Restore Toasts
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5 max-w-sm">
            {toasts.map(toast => {
              const cfg = {
                success: { icon: CheckCircle, iconCls: 'text-emerald-500', dot: 'bg-emerald-500' },
                info: { icon: Info, iconCls: 'text-cyan-500', dot: 'bg-cyan-500' },
                warning: { icon: AlertTriangle, iconCls: 'text-amber-500', dot: 'bg-amber-500' },
                danger: { icon: XCircle, iconCls: 'text-red-500', dot: 'bg-red-500' },
              }[toast.variant]
              const Icon = cfg.icon

              return (
                <div
                  key={toast.id}
                  className="flex items-start gap-3 p-3.5 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-lg text-sm"
                >
                  <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${cfg.dot}`} />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-800 dark:text-slate-200 leading-tight">{toast.title}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">{toast.message}</p>
                  </div>
                  <button
                    onClick={() => dismissToast(toast.id)}
                    className="shrink-0 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-0.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700"
                    aria-label="Dismiss"
                  >
                    <X size={14} />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </Section>

      {/* 7. Alert with Icon + Progress Bar */}
      <Section
        title="Alert with Progress Bar"
        description="Alert that includes an animated progress bar for in-progress operations"
      >
        <div className="space-y-4">
          {/* Download progress */}
          <div className="flex items-start gap-3 p-4 rounded-xl border bg-primary-50 border-primary-200 text-primary-800 dark:bg-primary-900/20 dark:border-primary-700 dark:text-primary-300 text-sm">
            <Download size={18} className="shrink-0 mt-0.5 text-primary-500" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1.5">
                <p className="font-semibold">Downloading dashboard-export.zip</p>
                <span className="text-xs font-semibold tabular-nums">{progress}%</span>
              </div>
              <div className="w-full h-1.5 bg-primary-200 dark:bg-primary-800/50 rounded-full overflow-hidden mb-2">
                <div
                  className="h-full bg-primary-500 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="flex items-center justify-between">
                <p className="text-xs opacity-70">
                  {progress < 100 ? `${Math.round(progress * 0.42)} MB of 42 MB` : 'Download complete!'}
                </p>
                <button onClick={simulateDownload} className="text-xs font-semibold hover:underline opacity-80 hover:opacity-100">
                  {progress === 100 ? 'Download Again' : progress === 0 ? 'Downloading…' : 'Restart'}
                </button>
              </div>
            </div>
          </div>

          {/* Multi-step progress */}
          <div className="flex items-start gap-3 p-4 rounded-xl border bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-900/20 dark:border-emerald-700 dark:text-emerald-300 text-sm">
            <CheckCircle size={18} className="shrink-0 mt-0.5 text-emerald-500" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold mb-2">Onboarding Progress</p>
              <div className="flex gap-1 mb-2">
                {[100, 100, 100, 75, 0].map((pct, i) => (
                  <div key={i} className="flex-1 h-1.5 bg-emerald-200 dark:bg-emerald-800/50 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                ))}
              </div>
              <p className="text-xs opacity-70">Step 4 of 5 — Configure notifications</p>
            </div>
          </div>
        </div>
      </Section>

      {/* 8. System Status Banners */}
      <Section
        title="System Status Banners"
        description="Full-width banners for global system announcements and status updates"
      >
        <div className="space-y-3">
          {/* Maintenance warning */}
          <div className="flex items-center gap-3 px-5 py-3.5 rounded-xl bg-amber-500 text-white text-sm font-medium">
            <AlertTriangle size={18} className="shrink-0" />
            <p className="flex-1">
              <span className="font-bold">Scheduled Maintenance —</span>{' '}
              The platform will be unavailable on Saturday, March 15 from 2:00–4:00 AM UTC.
              <button className="ml-2 underline text-white/90 hover:text-white font-semibold text-xs">
                See details
              </button>
            </p>
            <button className="shrink-0 opacity-80 hover:opacity-100 transition-opacity p-1 rounded hover:bg-white/20">
              <X size={16} />
            </button>
          </div>

          {/* Success deployment */}
          <div className="flex items-center gap-3 px-5 py-3.5 rounded-xl bg-emerald-500 text-white text-sm font-medium">
            <CheckCircle size={18} className="shrink-0" />
            <p className="flex-1">
              <span className="font-bold">Deployment Successful —</span>{' '}
              Version 2.4.1 has been deployed to production. All systems are operational.
              <button className="ml-2 underline text-white/90 hover:text-white font-semibold text-xs">
                View changelog
              </button>
            </p>
            <button className="shrink-0 opacity-80 hover:opacity-100 transition-opacity p-1 rounded hover:bg-white/20">
              <X size={16} />
            </button>
          </div>

          {/* Connectivity banner */}
          <div className="flex items-center gap-3 px-5 py-3.5 rounded-xl bg-red-500 text-white text-sm font-medium">
            <Wifi size={18} className="shrink-0" />
            <p className="flex-1">
              <span className="font-bold">Connection Lost —</span>{' '}
              You appear to be offline. Changes will be saved locally and synced when reconnected.
            </p>
            <button className="shrink-0 bg-white/20 hover:bg-white/30 transition-colors text-white text-xs font-semibold px-3 py-1 rounded-lg">
              Retry
            </button>
          </div>

          {/* Info banner with gradient */}
          <div className="flex items-center gap-3 px-5 py-3.5 rounded-xl bg-primary-600 text-white text-sm font-medium">
            <Info size={18} className="shrink-0" />
            <p className="flex-1">
              <span className="font-bold">You're on the Free plan —</span>{' '}
              Upgrade to Pro for unlimited projects, advanced analytics and priority support.
              <button className="ml-2 bg-white/20 hover:bg-white/30 transition-colors text-xs font-bold px-2.5 py-0.5 rounded-full">
                Upgrade Now
              </button>
            </p>
            <button className="shrink-0 opacity-80 hover:opacity-100 transition-opacity p-1 rounded hover:bg-white/20">
              <X size={16} />
            </button>
          </div>
        </div>
      </Section>
    </div>
  )
}
