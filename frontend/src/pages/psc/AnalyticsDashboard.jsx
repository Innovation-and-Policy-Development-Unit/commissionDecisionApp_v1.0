import React, { useState, useEffect, useCallback } from 'react'
import {
  Text, Card, CardHeader, Button, Spinner, Badge,
  makeStyles, shorthands, tokens,
} from '@fluentui/react-components'
import { DataBarVerticalRegular, ArrowTrendingRegular } from '@fluentui/react-icons'
import api from '../../api/client'
import PageHeader from '../../components/shared/PageHeader'
import StatCard from '../../components/shared/StatCard'

const useStyles = makeStyles({
  container: {
    display: 'flex', flexDirection: 'column', rowGap: '24px',
    maxWidth: '1400px', ...shorthands.margin('0', 'auto'), paddingBottom: '40px',
  },
  twoCol: {
    display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: '24px',
    '@media (max-width: 900px)': { gridTemplateColumns: '1fr' },
  },
  bar: { display: 'flex', flexDirection: 'column', rowGap: '8px' },
  barRow: { display: 'flex', alignItems: 'center', gap: '8px' },
  track: {
    flex: 1, height: '10px',
    backgroundColor: tokens.colorNeutralBackground3,
    borderRadius: tokens.borderRadiusMedium, overflow: 'hidden',
  },
  fill: {
    height: '100%', borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorBrandBackground,
  },
  monthBar: {
    display: 'flex', alignItems: 'flex-end', gap: '6px',
    height: '120px', paddingBottom: '8px',
  },
  monthCol: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    flex: 1, gap: '4px',
  },
})

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

export default function AnalyticsDashboard() {
  const styles = useStyles()
  const [overview, setOverview] = useState(null)
  const [trends, setTrends] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const [ovRes, trRes] = await Promise.all([
        api.get('/analytics/overview/'),
        api.get('/analytics/trends/'),
      ])
      setOverview(ovRes.data)
      setTrends(trRes.data)
    } catch (e) {
      console.error('Analytics error', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) {
    return (
      <div className={styles.container}>
        <PageHeader title="Analytics Dashboard" subtitle="Submission trends and outcome analysis" />
        <div style={{ textAlign: 'center', padding: '60px' }}><Spinner label="Loading analytics…" /></div>
      </div>
    )
  }

  const maxMonthly = Math.max(1, ...(overview?.monthly_submissions || []).map(m => m.count))
  const maxWeekly = Math.max(1, ...(trends?.weekly_trends || []).map(w => w.count))
  const byFormType = overview?.by_form_type || []
  const maxFormType = Math.max(1, ...byFormType.map(f => f.count))

  return (
    <div className={styles.container}>
      <PageHeader title="Analytics Dashboard" subtitle="Submission trends and outcome analysis" />

      {/* KPI Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '16px' }}>
        <StatCard label="Total" value={overview?.total ?? 0} color="brand" />
        <StatCard label="Approved" value={overview?.approved ?? 0} color="success" />
        <StatCard label="Rejected" value={overview?.rejected ?? 0} color="danger" />
        <StatCard label="Deferred" value={overview?.deferred ?? 0} color="warning" />
        <StatCard label="Pending" value={overview?.pending ?? 0} />
      </div>

      <div className={styles.twoCol}>
        {/* Monthly chart */}
        <Card>
          <CardHeader header={<Text weight="bold" size={400}>Monthly Submissions ({overview?.year})</Text>} />
          <div style={{ padding: '8px 16px 16px' }}>
            <div className={styles.monthBar}>
              {(overview?.monthly_submissions || []).map(({ month, count }) => {
                const pct = Math.round((count / maxMonthly) * 100)
                return (
                  <div key={month} className={styles.monthCol}>
                    <Text size={100} weight="semibold">{count}</Text>
                    <div style={{
                      width: '100%', height: `${Math.max(4, pct)}%`,
                      backgroundColor: tokens.colorBrandBackground,
                      borderRadius: '2px 2px 0 0', minHeight: '4px',
                    }} />
                    <Text size={100} style={{ color: 'var(--colorNeutralForeground3)' }}>
                      {MONTH_NAMES[month - 1]}
                    </Text>
                  </div>
                )
              })}
            </div>
          </div>
        </Card>

        {/* By Form Type */}
        <Card>
          <CardHeader header={<Text weight="bold" size={400}>By Form Type</Text>} />
          <div className={styles.bar} style={{ padding: '8px 16px 16px' }}>
            {byFormType.map(({ form_type, count }) => (
              <div key={form_type} className={styles.barRow}>
                <Text size={200} style={{ width: '120px', flexShrink: 0, fontFamily: 'monospace' }}>
                  {form_type || 'Unknown'}
                </Text>
                <div className={styles.track}>
                  <div className={styles.fill} style={{ width: `${Math.round(count / maxFormType * 100)}%` }} />
                </div>
                <Text size={200} style={{ width: '30px', textAlign: 'right' }}>{count}</Text>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Weekly Trends */}
      <Card>
        <CardHeader header={
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ArrowTrendingRegular fontSize={20} />
            <Text weight="bold" size={400}>12-Week Submission Trend</Text>
          </div>
        } />
        <div style={{ padding: '8px 16px 16px', display: 'flex', gap: '6px', alignItems: 'flex-end', height: '120px' }}>
          {(trends?.weekly_trends || []).map((w, i) => {
            const pct = Math.round((w.count / maxWeekly) * 100)
            const d = new Date(w.week_end)
            return (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                <Text size={100} weight="semibold">{w.count}</Text>
                <div style={{
                  width: '100%', height: `${Math.max(4, pct)}%`,
                  backgroundColor: tokens.colorPaletteTealBackground2,
                  borderRadius: '2px 2px 0 0', minHeight: '4px',
                }} />
                <Text size={100} style={{ color: 'var(--colorNeutralForeground3)', fontSize: '10px' }}>
                  {MONTH_NAMES[d.getMonth()]}{d.getDate()}
                </Text>
              </div>
            )
          })}
        </div>
      </Card>
    </div>
  )
}
