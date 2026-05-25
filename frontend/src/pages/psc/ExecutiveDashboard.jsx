import React, { useState, useEffect, useCallback } from 'react'
import {
  Text, Card, CardHeader, Spinner, Badge,
  makeStyles, shorthands, tokens,
} from '@fluentui/react-components'
import {
  DocumentRegular, AlertUrgentRegular, CheckmarkCircleRegular,
  ClockRegular, PeopleRegular, DataBarVerticalRegular,
  BrainCircuitRegular, BuildingRegular,
} from '@fluentui/react-icons'
import api from '../../api/client'
import PageHeader from '../../components/shared/PageHeader'
import StatCard from '../../components/shared/StatCard'

const useStyles = makeStyles({
  container: {
    display: 'flex',
    flexDirection: 'column',
    rowGap: '24px',
    maxWidth: '1400px',
    ...shorthands.margin('0', 'auto'),
    paddingBottom: '40px',
  },
  kpiGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    columnGap: '16px',
    rowGap: '16px',
  },
  twoCol: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    columnGap: '24px',
    rowGap: '24px',
    '@media (max-width: 768px)': { gridTemplateColumns: '1fr' },
  },
  stageBar: {
    display: 'flex',
    flexDirection: 'column',
    rowGap: '8px',
  },
  stageRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  stageTrack: {
    flex: 1,
    height: '8px',
    backgroundColor: tokens.colorNeutralBackground3,
    borderRadius: tokens.borderRadiusMedium,
    overflow: 'hidden',
  },
  stageFill: {
    height: '100%',
    backgroundColor: tokens.colorBrandBackground,
    borderRadius: tokens.borderRadiusMedium,
  },
})

const STAGE_LABELS = {
  draft: 'Draft',
  submitted: 'Submitted',
  secretary_review: 'Secretary Review',
  manager_checklist_review: 'Manager Review',
  under_assessment: 'Under Assessment',
  forwarded_to_commission: 'Forwarded to Commission',
  commission_sitting: 'Commission Sitting',
  decided_approved: 'Approved',
  decided_rejected: 'Rejected',
  deferred: 'Deferred',
  returned_for_clarification: 'Returned for Clarification',
  withdrawn: 'Withdrawn',
}

export default function ExecutiveDashboard() {
  const styles = useStyles()
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  const loadStats = useCallback(async () => {
    try {
      const res = await api.get('/dashboard/stats/')
      setStats(res.data)
    } catch (e) {
      console.error('Dashboard stats error', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadStats() }, [loadStats])

  const slaColor = stats?.sla_compliance_pct >= 90 ? 'success'
    : stats?.sla_compliance_pct >= 70 ? 'warning' : 'danger'

  const stageEntries = Object.entries(stats?.stage_breakdown || {})
  const maxStageCount = Math.max(1, ...stageEntries.map(([, c]) => c))

  if (loading) {
    return (
      <div className={styles.container}>
        <PageHeader title="Executive Dashboard" subtitle="Commission-wide performance overview" />
        <div style={{ textAlign: 'center', padding: '60px' }}>
          <Spinner size="large" label="Loading metrics…" />
        </div>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <PageHeader
        title="Executive Dashboard"
        subtitle="Commission-wide performance at a glance"
      />

      {/* KPI Row */}
      <div className={styles.kpiGrid}>
        <StatCard
          label="Total Submissions"
          value={stats?.total_submissions ?? 0}
          icon={<DocumentRegular fontSize={24} />}
          color="brand"
        />
        <StatCard
          label="Active / Pending"
          value={stats?.pending_active ?? 0}
          icon={<ClockRegular fontSize={24} />}
          color="warning"
        />
        <StatCard
          label="Submitted This Week"
          value={stats?.submitted_this_week ?? 0}
          icon={<DataBarVerticalRegular fontSize={24} />}
          color="success"
        />
        <StatCard
          label="Submitted This Month"
          value={stats?.submitted_this_month ?? 0}
          icon={<DataBarVerticalRegular fontSize={24} />}
        />
        <StatCard
          label="Overdue (>30 days)"
          value={stats?.overdue_count ?? 0}
          icon={<AlertUrgentRegular fontSize={24} />}
          color={stats?.overdue_count > 0 ? 'danger' : 'success'}
        />
        <Card style={{ padding: '16px' }}>
          <Text weight="semibold" size={200} style={{ color: 'var(--colorNeutralForeground3)' }}>
            SLA Compliance
          </Text>
          <Text weight="bold" size={800} style={{ lineHeight: 1.2 }}>
            {stats?.sla_compliance_pct ?? 100}%
          </Text>
          <Badge appearance="tint" color={slaColor} size="small" style={{ marginTop: '4px' }}>
            {slaColor === 'success' ? 'On Target' : slaColor === 'warning' ? 'At Risk' : 'Below Target'}
          </Badge>
        </Card>
      </div>

      <div className={styles.twoCol}>
        {/* Stage Breakdown */}
        <Card>
          <CardHeader header={<Text weight="bold" size={400}>Submissions by Stage</Text>} />
          <div className={styles.stageBar} style={{ padding: '0 16px 16px' }}>
            {stageEntries
              .sort((a, b) => b[1] - a[1])
              .slice(0, 10)
              .map(([stage, count]) => (
                <div key={stage} className={styles.stageRow}>
                  <Text size={200} style={{ width: '180px', flexShrink: 0 }}>
                    {STAGE_LABELS[stage] || stage}
                  </Text>
                  <div className={styles.stageTrack}>
                    <div
                      className={styles.stageFill}
                      style={{ width: `${Math.round((count / maxStageCount) * 100)}%` }}
                    />
                  </div>
                  <Text size={200} style={{ width: '30px', textAlign: 'right' }}>{count}</Text>
                </div>
              ))}
          </div>
        </Card>

        {/* Ministry Breakdown */}
        <Card>
          <CardHeader header={<Text weight="bold" size={400}>Top Ministries by Volume</Text>} />
          {!stats?.ministry_breakdown?.length ? (
            <Text size={200} style={{ color: 'var(--colorNeutralForeground3)', padding: '0 16px 16px' }}>
              No data available or access restricted.
            </Text>
          ) : (
            <div className={styles.stageBar} style={{ padding: '0 16px 16px' }}>
              {stats.ministry_breakdown.map(({ ministry, count }) => {
                const maxMinistry = Math.max(1, ...stats.ministry_breakdown.map(m => m.count))
                return (
                  <div key={ministry} className={styles.stageRow}>
                    <Text size={200} style={{ width: '200px', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {ministry || 'Unknown'}
                    </Text>
                    <div className={styles.stageTrack}>
                      <div
                        className={styles.stageFill}
                        style={{ width: `${Math.round((count / maxMinistry) * 100)}%`, backgroundColor: tokens.colorPaletteTealBackground2 }}
                      />
                    </div>
                    <Text size={200} style={{ width: '30px', textAlign: 'right' }}>{count}</Text>
                  </div>
                )
              })}
            </div>
          )}
        </Card>
      </div>

      {/* AI Processing Stats */}
      <Card>
        <CardHeader
          header={<div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <BrainCircuitRegular fontSize={20} />
            <Text weight="bold" size={400}>AI Processing Rates</Text>
          </div>}
        />
        <div style={{ display: 'flex', gap: '32px', padding: '0 16px 16px', flexWrap: 'wrap' }}>
          <div>
            <Text size={200} style={{ color: 'var(--colorNeutralForeground3)' }}>Executive Briefs</Text>
            <Text weight="bold" size={500}>{stats?.ai_brief_processing_rate ?? 0}%</Text>
          </div>
          <div>
            <Text size={200} style={{ color: 'var(--colorNeutralForeground3)' }}>Risk Assessments</Text>
            <Text weight="bold" size={500}>{stats?.ai_risk_processing_rate ?? 0}%</Text>
          </div>
        </div>
      </Card>
    </div>
  )
}
