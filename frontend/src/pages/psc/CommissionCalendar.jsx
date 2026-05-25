import React, { useState, useEffect, useCallback } from 'react'
import {
  Text, Card, CardHeader, Badge, Spinner, Button,
  makeStyles, shorthands, tokens,
} from '@fluentui/react-components'
import {
  CalendarRegular, AlertRegular, TaskListRegular, WarningRegular,
} from '@fluentui/react-icons'
import { useNavigate } from 'react-router-dom'
import api from '../../api/client'
import PageHeader from '../../components/shared/PageHeader'

const useStyles = makeStyles({
  container: {
    display: 'flex',
    flexDirection: 'column',
    rowGap: '24px',
    maxWidth: '1200px',
    ...shorthands.margin('0', 'auto'),
    paddingBottom: '40px',
  },
  eventList: {
    display: 'flex',
    flexDirection: 'column',
    rowGap: '8px',
  },
  eventRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    ...shorthands.padding('12px', '16px'),
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    cursor: 'pointer',
    ':hover': { backgroundColor: tokens.colorNeutralBackground1Hover },
    borderLeft: '4px solid transparent',
  },
  typeTag: {
    width: '120px',
    flexShrink: 0,
  },
})

const TYPE_CONFIG = {
  meeting: { color: 'brand', label: 'Meeting', icon: <CalendarRegular /> },
  task_deadline: { color: 'warning', label: 'Task Deadline', icon: <TaskListRegular /> },
  sla_warning: { color: 'danger', label: 'SLA Warning', icon: <WarningRegular /> },
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function groupByMonth(events) {
  const groups = {}
  for (const ev of events) {
    if (!ev.date) continue
    const d = new Date(ev.date)
    const key = `${d.getFullYear()}-${d.getMonth()}`
    if (!groups[key]) groups[key] = { label: `${MONTHS[d.getMonth()]} ${d.getFullYear()}`, events: [] }
    groups[key].events.push(ev)
  }
  return Object.values(groups).sort((a, b) => a.label.localeCompare(b.label))
}

export default function CommissionCalendar() {
  const styles = useStyles()
  const navigate = useNavigate()
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')

  const loadEvents = useCallback(async () => {
    try {
      const res = await api.get('/calendar/events/')
      setEvents(res.data.events || [])
    } catch (e) {
      console.error('Calendar error', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadEvents() }, [loadEvents])

  const filtered = filter === 'all' ? events : events.filter(e => e.type === filter)
  const grouped = groupByMonth(filtered)

  const handleClick = (ev) => {
    if (ev.url) navigate(ev.url)
  }

  const types = ['all', 'meeting', 'task_deadline', 'sla_warning']

  return (
    <div className={styles.container}>
      <PageHeader
        title="Commission Calendar"
        subtitle="Meeting dates, task deadlines, and SLA warnings"
      />

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {types.map(t => (
          <Button
            key={t}
            size="small"
            appearance={filter === t ? 'primary' : 'outline'}
            onClick={() => setFilter(t)}
          >
            {t === 'all' ? 'All Events' : TYPE_CONFIG[t]?.label || t}
          </Button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px' }}>
          <Spinner label="Loading calendar…" />
        </div>
      ) : grouped.length === 0 ? (
        <Card>
          <Text style={{ padding: '24px', color: 'var(--colorNeutralForeground3)' }}>
            No events found.
          </Text>
        </Card>
      ) : (
        grouped.map(group => (
          <Card key={group.label}>
            <CardHeader header={<Text weight="bold" size={500}>{group.label}</Text>} />
            <div className={styles.eventList} style={{ padding: '0 8px 16px' }}>
              {group.events.map(ev => {
                const cfg = TYPE_CONFIG[ev.type] || {}
                const d = ev.date ? new Date(ev.date) : null
                return (
                  <div
                    key={ev.id}
                    className={styles.eventRow}
                    onClick={() => handleClick(ev)}
                    style={{
                      borderLeftColor: ev.type === 'sla_warning'
                        ? tokens.colorStatusDangerForeground1
                        : ev.type === 'task_deadline'
                          ? tokens.colorStatusWarningForeground1
                          : tokens.colorBrandForeground1,
                    }}
                  >
                    <div style={{ width: '48px', textAlign: 'center', flexShrink: 0 }}>
                      {d && (
                        <>
                          <Text weight="bold" size={500}>{d.getDate()}</Text>
                          <Text size={100} block style={{ color: 'var(--colorNeutralForeground3)' }}>
                            {MONTHS[d.getMonth()]}
                          </Text>
                        </>
                      )}
                    </div>
                    <div style={{ flex: 1 }}>
                      <Text weight="semibold" size={300}>{ev.title}</Text>
                      {ev.status && (
                        <Text size={100} block style={{ color: 'var(--colorNeutralForeground3)' }}>
                          Status: {ev.status}
                        </Text>
                      )}
                    </div>
                    <Badge appearance="tint" color={cfg.color} size="small" icon={cfg.icon}>
                      {cfg.label}
                    </Badge>
                  </div>
                )
              })}
            </div>
          </Card>
        ))
      )}
    </div>
  )
}
