import { ExternalLink } from 'lucide-react'
import PageHeader from '../../components/shared/PageHeader'
import { CMS_PORTAL_URL } from '../../constants/compliance'

/**
 * Compliance staff create and manage cases in the Case Management System (CMS).
 * The Commission Portal shows linked submissions for Secretary / Commission only.
 */
export default function ComplianceCmsGuidance({ modal = false }) {
  const inner = (
    <div className="space-y-4">
      <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
        <strong>Compliance submissions are created and maintained in the Case Management System (CMS).</strong>{' '}
        Senior and Principal officers create cases with a COMP-* form type; a Compliance Manager must approve
        before the case syncs to this portal.
      </p>
      <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
        After approval, the matter appears under <strong>Registered with Commission</strong> at{' '}
        <strong>Secretary Review</strong>. Secretary and Commission work stays here;{' '}
        <strong>Minutes decision tasks</strong> after a decision are completed in SCDMS only — not back in CMS.
        When the portal matter is fully complete, the linked <strong>CMS case closes automatically</strong>.
      </p>
      <a
        href={CMS_PORTAL_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="btn-primary inline-flex items-center gap-2"
      >
        Open Case Management System
        <ExternalLink size={16} />
      </a>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        After registration, open <strong>Submissions</strong> in this portal to view the linked record and progress.
      </p>
    </div>
  )

  if (modal) return inner

  return (
    <div>
      <PageHeader
        title="Compliance cases — Case Management System"
        subtitle="Create and approve in CMS; track registered matters here until CMS case closes"
      />
      <div className="card p-6 max-w-2xl">{inner}</div>
    </div>
  )
}
