import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
  Text, Card, Input, Button, Table, TableHeader, TableRow,
  TableHeaderCell, TableBody, TableCell, Badge, Spinner,
  Select, makeStyles, shorthands, tokens,
} from '@fluentui/react-components'
import { SearchRegular, FilterRegular, ChevronLeftRegular, ChevronRightRegular } from '@fluentui/react-icons'
import api from '../../api/client'
import PageHeader from '../../components/shared/PageHeader'

const useStyles = makeStyles({
  container: {
    display: 'flex', flexDirection: 'column', rowGap: '24px',
    maxWidth: '1400px', ...shorthands.margin('0', 'auto'), paddingBottom: '40px',
  },
  filterBar: {
    display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end',
    ...shorthands.padding('16px'), backgroundColor: tokens.colorNeutralBackground2,
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
  },
})

const ACTION_COLORS = {
  CREATE: 'success', UPDATE: 'informative', DELETE: 'danger',
  LOGIN: 'subtle', LOGOUT: 'subtle', DECISION: 'brand',
}

export default function AuditTrailExplorer() {
  const styles = useStyles()
  const [records, setRecords] = useState([])
  const [total, setTotal] = useState(0)
  const [numPages, setNumPages] = useState(1)
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [filters, setFilters] = useState({
    q: '', action: '', resource_type: '', date_from: '', date_to: '',
  })
  const searchTimer = useRef(null)

  const load = useCallback(async (params = {}) => {
    setLoading(true)
    try {
      const p = { ...filters, ...params, page }
      const res = await api.get('/audit-logs/search/', { params: p })
      setRecords(res.data.results || [])
      setTotal(res.data.total || 0)
      setNumPages(res.data.num_pages || 1)
    } catch (e) {
      console.error('Audit log error', e)
    } finally {
      setLoading(false)
    }
  }, [filters, page])

  useEffect(() => { load() }, [load])

  const handleSearchChange = (val) => {
    const newFilters = { ...filters, q: val }
    setFilters(newFilters)
    clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => {
      setPage(1)
    }, 400)
  }

  const applyFilters = () => {
    setPage(1)
  }

  return (
    <div className={styles.container}>
      <PageHeader
        title="Audit Trail Explorer"
        subtitle="Search and filter all system activity logs"
      />

      <div className={styles.filterBar}>
        <div style={{ flex: 1, minWidth: '200px' }}>
          <Input
            placeholder="Search description, user, resource…"
            contentBefore={<SearchRegular />}
            value={filters.q}
            onChange={(e) => handleSearchChange(e.target.value)}
          />
        </div>
        <Select
          value={filters.action}
          onChange={(e, d) => setFilters(f => ({ ...f, action: d.value }))}
        >
          <option value="">All Actions</option>
          <option value="CREATE">Create</option>
          <option value="UPDATE">Update</option>
          <option value="DELETE">Delete</option>
          <option value="LOGIN">Login</option>
          <option value="LOGOUT">Logout</option>
          <option value="DECISION">Decision</option>
        </Select>
        <Select
          value={filters.resource_type}
          onChange={(e, d) => setFilters(f => ({ ...f, resource_type: d.value }))}
        >
          <option value="">All Resources</option>
          <option value="Submission">Submission</option>
          <option value="Meeting">Meeting</option>
          <option value="User">User</option>
          <option value="Minutes">Minutes</option>
          <option value="CommissionTask">Commission Task</option>
        </Select>
        <Input
          type="date"
          value={filters.date_from}
          onChange={(e) => setFilters(f => ({ ...f, date_from: e.target.value }))}
          placeholder="From date"
        />
        <Input
          type="date"
          value={filters.date_to}
          onChange={(e) => setFilters(f => ({ ...f, date_to: e.target.value }))}
          placeholder="To date"
        />
        <Button icon={<FilterRegular />} appearance="primary" onClick={applyFilters}>
          Filter
        </Button>
      </div>

      <Card>
        <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Text weight="semibold">{total.toLocaleString()} results</Text>
          {loading && <Spinner size="tiny" />}
        </div>
        <Table aria-label="Audit log table">
          <TableHeader>
            <TableRow>
              <TableHeaderCell style={{ width: '160px' }}>Timestamp</TableHeaderCell>
              <TableHeaderCell style={{ width: '120px' }}>User</TableHeaderCell>
              <TableHeaderCell style={{ width: '100px' }}>Action</TableHeaderCell>
              <TableHeaderCell style={{ width: '130px' }}>Resource</TableHeaderCell>
              <TableHeaderCell>Description</TableHeaderCell>
              <TableHeaderCell style={{ width: '110px' }}>IP Address</TableHeaderCell>
            </TableRow>
          </TableHeader>
          <TableBody>
            {records.map(log => (
              <TableRow key={log.id}>
                <TableCell>
                  <Text size={200}>{new Date(log.timestamp).toLocaleString()}</Text>
                </TableCell>
                <TableCell>
                  <Text size={200} weight="semibold">{log.user || '—'}</Text>
                </TableCell>
                <TableCell>
                  <Badge
                    appearance="tint"
                    color={ACTION_COLORS[log.action] || 'subtle'}
                    size="small"
                  >
                    {log.action}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Text size={200}>{log.resource_type}</Text>
                  {log.resource_label && (
                    <Text size={100} block style={{ color: 'var(--colorNeutralForeground3)' }}>
                      {log.resource_label}
                    </Text>
                  )}
                </TableCell>
                <TableCell>
                  <Text size={200}>{log.description}</Text>
                </TableCell>
                <TableCell>
                  <Text size={200} style={{ fontFamily: 'monospace' }}>{log.ip_address || '—'}</Text>
                </TableCell>
              </TableRow>
            ))}
            {records.length === 0 && !loading && (
              <TableRow>
                <TableCell colSpan={6}>
                  <Text style={{ padding: '24px', color: 'var(--colorNeutralForeground3)' }}>
                    No audit logs found.
                  </Text>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        {/* Pagination */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '8px', padding: '12px 16px' }}>
          <Button
            size="small"
            icon={<ChevronLeftRegular />}
            disabled={page <= 1}
            onClick={() => setPage(p => p - 1)}
          />
          <Text size={200}>Page {page} of {numPages}</Text>
          <Button
            size="small"
            icon={<ChevronRightRegular />}
            disabled={page >= numPages}
            onClick={() => setPage(p => p + 1)}
          />
        </div>
      </Card>
    </div>
  )
}
