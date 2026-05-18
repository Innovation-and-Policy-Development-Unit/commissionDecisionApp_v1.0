import { useState, useMemo, useEffect, useCallback } from 'react'
import api from '../../../../api/client'
import { startOfDay, endOfDay, isWithinInterval, parseISO } from 'date-fns'

export function useSittingOperations() {
  const [meetings, setMeetings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchMeetings = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await api.get('/meetings/')
      setMeetings(res.data.results ?? res.data)
    } catch (err) {
      setError('Failed to load commission sittings.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchMeetings()
  }, [fetchMeetings])

  // Conflict Detection
  const conflicts = useMemo(() => {
    const detected = []
    
    for (let i = 0; i < meetings.length; i++) {
      for (let j = i + 1; j < meetings.length; j++) {
        const m1 = meetings[i]
        const m2 = meetings[j]
        
        // Skip cancelled meetings
        if (m1.status === 'cancelled' || m2.status === 'cancelled') continue

        // Overlap detection
        const start1 = parseISO(`${m1.date}T${m1.time}`)
        // Assume 2 hour duration if not specified
        const end1 = new Date(start1.getTime() + 2 * 60 * 60 * 1000)
        
        const start2 = parseISO(`${m2.date}T${m2.time}`)
        const end2 = new Date(start2.getTime() + 2 * 60 * 60 * 1000)

        const isOverlapping = (start1 < end2 && end1 > start2)

        if (isOverlapping) {
          if (m1.venue === m2.venue) {
            detected.push({
              type: 'venue',
              meetings: [m1, m2],
              message: `Venue Conflict: ${m1.venue} is double-booked.`
            })
          } else {
            detected.push({
              type: 'schedule',
              meetings: [m1, m2],
              message: `Schedule Overlap: Multiple sittings scheduled simultaneously.`
            })
          }
        }
      }
    }
    return detected
  }, [meetings])

  // Capacity Scoring
  const getCapacity = useCallback((agendaCount) => {
    if (agendaCount >= 15) return { label: 'Heavy', color: 'red', level: 3 }
    if (agendaCount >= 8) return { label: 'Medium', color: 'amber', level: 2 }
    return { label: 'Light', color: 'emerald', level: 1 }
  }, [])

  const kpis = useMemo(() => {
    const total = meetings.length
    const scheduled = meetings.filter(m => m.status === 'scheduled').length
    const completed = meetings.filter(m => m.status === 'completed').length
    const totalAgenda = meetings.reduce((s, m) => s + (m.agenda_count || 0), 0)
    const totalDecisions = meetings.reduce((s, m) => s + (m.decisions_count || 0), 0)

    return { total, scheduled, completed, totalAgenda, totalDecisions }
  }, [meetings])

  return {
    meetings,
    loading,
    error,
    conflicts,
    kpis,
    getCapacity,
    refresh: fetchMeetings
  }
}
