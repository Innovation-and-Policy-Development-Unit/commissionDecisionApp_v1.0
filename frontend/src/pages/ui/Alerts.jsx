import { useState } from 'react'
import PageHeader from '../../components/shared/PageHeader'
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X, Bell, Zap, Shield } from 'lucide-react'

function AlertBox({ variant, icon: Icon, title, message, onClose, className = '' }) {
  return (
    <div className={`alert-${variant} ${className}`}>
      {Icon && <Icon size={18} className="shrink-0 mt-0.5" />}
      <div className="flex-1">
        {title && <p className="font-semibold">{title}</p>}
        <p className={title ? 'text-sm mt-0.5 opacity-90' : ''}>{message}</p>
      </div>
      {onClose && (
        <button onClick={onClose} className="shrink-0 p-0.5 rounded hover:opacity-70 transition-opacity">
          <X size={16} />
        </button>
      )}
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div className="card p-6 mb-5">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-4">{title}</h3>
      <div className="space-y-3">{children}</div>
    </div>
  )
}

export default function Alerts() {
  const [dismissed, setDismissed] = useState([])

  const dismiss = (id) => setDismissed(p => [...p, id])
  const isDismissed = (id) => dismissed.includes(id)

  return (
    <div>
      <PageHeader title="Alerts" subtitle="Alert components for displaying important messages and notifications" />

      <Section title="Basic Alerts">
        <div className="alert-primary"><Info size={18} className="shrink-0 mt-0.5" /><p>This is a primary info alert with important information.</p></div>
        <div className="alert-success"><CheckCircle2 size={18} className="shrink-0 mt-0.5" /><p>Operation completed successfully! Your changes have been saved.</p></div>
        <div className="alert-warning"><AlertTriangle size={18} className="shrink-0 mt-0.5" /><p>Warning: This action cannot be undone. Please proceed with caution.</p></div>
        <div className="alert-danger"><AlertCircle size={18} className="shrink-0 mt-0.5" /><p>Error! Something went wrong. Please try again or contact support.</p></div>
        <div className="alert-info"><Bell size={18} className="shrink-0 mt-0.5" /><p>New notification: You have 3 pending tasks that need attention.</p></div>
      </Section>

      <Section title="Alerts with Titles">
        <AlertBox variant="primary" icon={Info} title="Information" message="Your dashboard has been updated to version 2.1.0 with new features and improvements." />
        <AlertBox variant="success" icon={CheckCircle2} title="Payment Successful" message="Your payment of $299.00 has been processed successfully. A receipt has been sent to your email." />
        <AlertBox variant="warning" icon={AlertTriangle} title="Storage Almost Full" message="You're using 85% of your available storage. Consider upgrading your plan to avoid service interruption." />
        <AlertBox variant="danger" icon={AlertCircle} title="Authentication Failed" message="Invalid credentials. Please check your email and password, or reset your password if you've forgotten it." />
      </Section>

      <Section title="Dismissible Alerts">
        {!isDismissed('d1') && <AlertBox variant="primary" icon={Info} title="New Feature Available" message="Check out our new analytics dashboard with real-time data updates." onClose={() => dismiss('d1')} />}
        {!isDismissed('d2') && <AlertBox variant="success" icon={CheckCircle2} title="Profile Updated" message="Your profile information has been saved and is now visible to your team." onClose={() => dismiss('d2')} />}
        {!isDismissed('d3') && <AlertBox variant="warning" icon={AlertTriangle} title="Session Expiring Soon" message="Your session will expire in 5 minutes. Please save your work." onClose={() => dismiss('d3')} />}
        {!isDismissed('d4') && <AlertBox variant="danger" icon={AlertCircle} title="Connection Error" message="Unable to connect to the server. Some features may be unavailable." onClose={() => dismiss('d4')} />}
        {dismissed.length > 0 && (
          <button onClick={() => setDismissed([])} className="btn-outline btn-sm">
            Reset Dismissed Alerts
          </button>
        )}
      </Section>

      <Section title="Solid Background Alerts">
        {[
          { bg: 'bg-primary-600', icon: Info, text: 'System maintenance scheduled for March 15, 2026 from 2:00 AM to 4:00 AM UTC.' },
          { bg: 'bg-emerald-600', icon: CheckCircle2, text: 'All systems operational. Current uptime: 99.98% over the last 30 days.' },
          { bg: 'bg-amber-500', icon: AlertTriangle, text: 'Elevated error rates detected in the payment processing system. Our team is investigating.' },
          { bg: 'bg-red-600', icon: AlertCircle, text: 'Critical security update available. Please update your password immediately.' },
        ].map((alert, i) => {
          const Icon = alert.icon
          return (
            <div key={i} className={`${alert.bg} text-white rounded-xl p-4 flex items-start gap-3`}>
              <Icon size={18} className="shrink-0 mt-0.5" />
              <p className="text-sm leading-relaxed">{alert.text}</p>
            </div>
          )
        })}
      </Section>

      <Section title="Border Left Style">
        {[
          { border: 'border-l-4 border-primary-500 bg-primary-50 dark:bg-primary-900/20', icon: Info, color: 'text-primary-600 dark:text-primary-400', title: 'Pro Tip', text: 'Use keyboard shortcut Ctrl+K to quickly access the command palette.' },
          { border: 'border-l-4 border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20', icon: CheckCircle2, color: 'text-emerald-600 dark:text-emerald-400', title: 'Build Successful', text: 'Your application has been built and deployed to production in 48 seconds.' },
          { border: 'border-l-4 border-amber-500 bg-amber-50 dark:bg-amber-900/20', icon: AlertTriangle, color: 'text-amber-600 dark:text-amber-400', title: 'Deprecation Warning', text: 'The legacy API endpoint will be removed in v3.0. Please migrate to the new API.' },
          { border: 'border-l-4 border-red-500 bg-red-50 dark:bg-red-900/20', icon: Shield, color: 'text-red-600 dark:text-red-400', title: 'Security Alert', text: 'Unusual login activity detected from a new location. Was this you?' },
        ].map((alert, i) => {
          const Icon = alert.icon
          return (
            <div key={i} className={`p-4 rounded-r-xl ${alert.border} flex items-start gap-3`}>
              <Icon size={18} className={`shrink-0 mt-0.5 ${alert.color}`} />
              <div>
                <p className={`font-semibold text-sm ${alert.color}`}>{alert.title}</p>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">{alert.text}</p>
              </div>
            </div>
          )
        })}
      </Section>

      <Section title="Toast Style Alerts">
        {[
          { icon: Zap, bg: 'bg-white dark:bg-slate-800', color: 'text-primary-500', title: 'Action completed', text: 'File uploaded successfully', border: 'border-l-4 border-primary-500' },
          { icon: CheckCircle2, bg: 'bg-white dark:bg-slate-800', color: 'text-emerald-500', title: 'Success', text: 'Changes saved to database', border: 'border-l-4 border-emerald-500' },
          { icon: Bell, bg: 'bg-white dark:bg-slate-800', color: 'text-amber-500', title: 'Reminder', text: 'Team meeting starts in 10 minutes', border: 'border-l-4 border-amber-500' },
        ].map((toast, i) => {
          const Icon = toast.icon
          return (
            <div key={i} className={`flex items-center gap-3 p-4 rounded-xl shadow-card-md ${toast.bg} border border-slate-200 dark:border-slate-700 ${toast.border} max-w-sm`}>
              <Icon size={20} className={`${toast.color} shrink-0`} />
              <div>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{toast.title}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{toast.text}</p>
              </div>
              <button className="ml-auto p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400">
                <X size={14} />
              </button>
            </div>
          )
        })}
      </Section>
    </div>
  )
}
