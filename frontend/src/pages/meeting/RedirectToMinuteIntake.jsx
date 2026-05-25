import { Navigate, useSearchParams } from 'react-router-dom'

/** Legacy recording / pipeline URLs → Minute intake. */
export default function RedirectToMinuteIntake() {
  const [searchParams] = useSearchParams()
  const meetingId = searchParams.get('meetingId')
  const to = meetingId
    ? `/secretariat/minute-intake/${meetingId}`
    : '/secretariat/minute-intake'
  return <Navigate to={to} replace />
}
