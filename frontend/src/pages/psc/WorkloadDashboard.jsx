import React, { useState, useEffect, useCallback } from 'react'
import {
  Text, Card, CardHeader, Button, Spinner, Badge, Table, TableHeader,
  TableRow, TableHeaderCell, TableBody, TableCell,
  Dialog, DialogSurface, DialogBody, DialogTitle, DialogContent, DialogActions, DialogTrigger,
  Field, Select,
  makeStyles, shorthands, tokens,
} from '@fluentui/react-components'
import { PeopleRegular, BrainCircuitRegular, PersonAssignRegular } from '@fluentui/react-icons'
import api from '../../api/client'
import PageHeader from '../../components/shared/PageHeader'
import { useToast } from '../../context/ToastContext'

const useStyles = makeStyles({
  container: {
    display: 'flex', flexDirection: 'column', rowGap: '24px',
    maxWidth: '1200px', ...shorthands.margin('0', 'auto'), paddingBottom: '40px',
  },
})

export default function WorkloadDashboard() {
  const styles = useStyles()
  const toast = useToast()
  const [officers, setOfficers] = useState([])
  const [loading, setLoading] = useState(true)
  const [assignDialogOpen, setAssignDialogOpen] = useState(false)
  const [suggestionLoading, setSuggestionLoading] = useState(false)
  const [suggestion, setSuggestion] = useState(null)
  const [submissionId, setSubmissionId] = useState('')

  const load = useCallback(async () => {
    try {
      const res = await api.get('/workload/officers/')
      setOfficers(res.data.officers || [])
    } catch (e) {
      console.error('Workload error', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const handleSuggest = async () => {
    if (!submissionId) { toast.error('Enter a submission ID.'); return }
    setSuggestionLoading(true)
    setSuggestion(null)
    try {
      const res = await api.post('/workload/suggest-assignment/', { submission_id: parseInt(submissionId) })
      setSuggestion(res.data)
    } catch (e) {
      toast.error('AI suggestion failed: ' + (e?.response?.data?.detail || e.message))
    } finally {
      setSuggestionLoading(false)
    }
  }

  const getLoadColor = (count) => {
    if (count >= 10) return 'danger'
    if (count >= 6) return 'warning'
    return 'success'
  }

  return (
    <div className={styles.container}>
      <PageHeader
        title="Workload Dashboard"
        subtitle="Monitor officer workload and get AI-powered assignment suggestions"
      />

      <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
        <Button
          icon={<BrainCircuitRegular />}
          appearance="primary"
          onClick={() => setAssignDialogOpen(true)}
        >
          AI Smart Assignment
        </Button>
      </div>

      <Card>
        <CardHeader header={
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <PeopleRegular fontSize={20} />
            <Text weight="bold" size={400}>PSC Officer Workload</Text>
          </div>
        } />
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px' }}><Spinner /></div>
        ) : (
          <Table aria-label="Officer workload table">
            <TableHeader>
              <TableRow>
                <TableHeaderCell>Officer</TableHeaderCell>
                <TableHeaderCell>Role</TableHeaderCell>
                <TableHeaderCell>Active Submissions</TableHeaderCell>
                <TableHeaderCell>Load Level</TableHeaderCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {officers.map(o => (
                <TableRow key={o.id}>
                  <TableCell>
                    <Text weight="semibold">{o.full_name}</Text>
                    <Text size={100} block style={{ color: 'var(--colorNeutralForeground3)' }}>@{o.username}</Text>
                  </TableCell>
                  <TableCell>
                    <Text size={200}>{o.role}</Text>
                  </TableCell>
                  <TableCell>
                    <Text weight="bold" size={400}>{o.active_submission_count}</Text>
                  </TableCell>
                  <TableCell>
                    <Badge
                      appearance="tint"
                      color={getLoadColor(o.active_submission_count)}
                      size="small"
                    >
                      {o.active_submission_count >= 10 ? 'Overloaded'
                        : o.active_submission_count >= 6 ? 'Heavy' : 'Available'}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              {officers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4}>
                    <Text style={{ color: 'var(--colorNeutralForeground3)' }}>No officers found.</Text>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* AI Assignment Dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={(e, d) => setAssignDialogOpen(d.open)}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>AI Smart Assignment</DialogTitle>
            <DialogContent>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <Text size={200} style={{ color: 'var(--colorNeutralForeground2)' }}>
                  Enter a submission ID to get an AI-powered assignment recommendation based on form type, ministry, and officer workload.
                </Text>
                <Field label="Submission ID" required>
                  <input
                    type="number"
                    value={submissionId}
                    onChange={e => setSubmissionId(e.target.value)}
                    placeholder="Enter submission ID"
                    style={{
                      width: '100%', padding: '8px', borderRadius: '4px',
                      border: '1px solid var(--colorNeutralStroke1)',
                      background: 'var(--colorNeutralBackground1)',
                      color: 'var(--colorNeutralForeground1)',
                    }}
                  />
                </Field>
                <Button
                  icon={suggestionLoading ? <Spinner size="tiny" /> : <BrainCircuitRegular />}
                  appearance="primary"
                  onClick={handleSuggest}
                  disabled={suggestionLoading}
                >
                  {suggestionLoading ? 'Analysing…' : 'Get Suggestion'}
                </Button>
                {suggestion && (
                  <Card appearance="subtle">
                    <Text weight="bold" size={400}>Recommended Officer</Text>
                    <Text size={300} weight="semibold" style={{ marginTop: '8px' }}>
                      {suggestion.recommended_officer || suggestion.officer_username || '—'}
                    </Text>
                    {suggestion.reasoning && (
                      <Text size={200} style={{ marginTop: '8px', color: 'var(--colorNeutralForeground2)' }}>
                        {suggestion.reasoning}
                      </Text>
                    )}
                    {suggestion.confidence_score != null && (
                      <Badge appearance="tint" color="success" size="small" style={{ marginTop: '8px' }}>
                        {suggestion.confidence_score}% confidence
                      </Badge>
                    )}
                  </Card>
                )}
              </div>
            </DialogContent>
            <DialogActions>
              <DialogTrigger disableButtonEnhancement>
                <Button appearance="secondary">Close</Button>
              </DialogTrigger>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </div>
  )
}
