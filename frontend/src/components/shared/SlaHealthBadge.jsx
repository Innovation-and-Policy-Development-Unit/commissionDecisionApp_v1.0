import { Clock, CheckCircle2, AlertCircle, AlertTriangle } from 'lucide-react'
import BaseBadge from './BaseBadge'

/**
 * SlaHealthBadge — SLA status for a submission.
 * status: "on_track" | "warning" | "overdue" | "resolved" | "not_submitted"
 */
export default function SlaHealthBadge({ status, daysElapsed, daysRemaining, compact = false }) {
  const config = {
    on_track: { color: 'success', Icon: CheckCircle2, label: compact ? `${daysRemaining}d` : `On Track (${daysRemaining}d left)` },
    warning: { color: 'warning', Icon: AlertTriangle, label: compact ? `${daysRemaining}d` : `Warning (${daysRemaining}d left)` },
    overdue: { color: 'danger', Icon: AlertCircle, label: compact ? `${daysElapsed}d` : `Overdue (${daysElapsed}d)` },
    resolved: { color: 'info', Icon: CheckCircle2, label: 'Resolved' },
    not_submitted: { color: 'default', Icon: Clock, label: 'Draft' },
  }
  const cfg = config[status] || config.not_submitted
  const Icon = cfg.Icon

  return (
    <BaseBadge color={cfg.color} size="small" icon={<Icon size={12} />}>
      {cfg.label}
    </BaseBadge>
  )
}
