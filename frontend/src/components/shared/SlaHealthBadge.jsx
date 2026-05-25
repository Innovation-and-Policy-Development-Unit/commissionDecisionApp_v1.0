import React from 'react'
import { Badge } from '@fluentui/react-components'
import { ClockRegular, CheckmarkCircleRegular, ErrorCircleRegular, WarningRegular } from '@fluentui/react-icons'

/**
 * SlaHealthBadge — shows SLA status for a submission.
 * Props:
 *   status: "on_track" | "warning" | "overdue" | "resolved" | "not_submitted"
 *   daysElapsed: number (optional)
 *   daysRemaining: number (optional)
 *   compact: bool (omit label text)
 */
export default function SlaHealthBadge({ status, daysElapsed, daysRemaining, compact = false }) {
  const config = {
    on_track: {
      color: 'success',
      icon: <CheckmarkCircleRegular />,
      label: compact ? `${daysRemaining}d` : `On Track (${daysRemaining}d left)`,
    },
    warning: {
      color: 'warning',
      icon: <WarningRegular />,
      label: compact ? `${daysRemaining}d` : `Warning (${daysRemaining}d left)`,
    },
    overdue: {
      color: 'danger',
      icon: <ErrorCircleRegular />,
      label: compact ? `${daysElapsed}d` : `Overdue (${daysElapsed}d)`,
    },
    resolved: {
      color: 'informative',
      icon: <CheckmarkCircleRegular />,
      label: 'Resolved',
    },
    not_submitted: {
      color: 'subtle',
      icon: <ClockRegular />,
      label: 'Draft',
    },
  }

  const cfg = config[status] || config.not_submitted

  return (
    <Badge
      appearance="tint"
      color={cfg.color}
      icon={cfg.icon}
      size="small"
    >
      {cfg.label}
    </Badge>
  )
}
