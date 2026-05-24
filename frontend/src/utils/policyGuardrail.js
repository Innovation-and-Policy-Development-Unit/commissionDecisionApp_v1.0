/** Category codes that trigger pre-submit policy guardrail (match backend). */
export const POLICY_GUARDRAIL_CATEGORY_CODES = new Set([
  'salary_adjustment',
  'appointment',
  'direct_appointment',
  'contract',
  'temporary_salaried',
  'extra_responsibility',
])

export function policyGuardrailApplies(submission) {
  if (!submission || submission.is_internal || submission.is_attachment) return false
  if (submission.current_stage !== 'draft') return false
  const code = submission.form_category?.code?.toLowerCase()
    || submission.category_code?.toLowerCase()
  if (code && POLICY_GUARDRAIL_CATEGORY_CODES.has(code)) return true
  const name = (submission.form_category?.name || submission.category_name || '').toLowerCase()
  return ['salary', 'appointment', 'recruit', 'contract'].some(k => name.includes(k))
}

export function confidenceTone(score) {
  if (score == null) return 'neutral'
  if (score >= 75) return 'success'
  if (score >= 50) return 'warning'
  return 'danger'
}
