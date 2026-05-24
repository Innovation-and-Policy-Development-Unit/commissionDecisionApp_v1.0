import GuideViewer from './GuideViewer'

const SECRETARY_ROLES = ['psc_secretary', 'senior_admin_officer', 'psc_admin']

export default function SecretaryGuide() {
  return (
    <GuideViewer
      title="PSC Secretary — User Guide"
      htmlFile="secretary-guide.html"
      allowedRoles={SECRETARY_ROLES}
    />
  )
}
