import GuideViewer from './GuideViewer'

const UNIT_MANAGER_ROLES = [
  'hr_unit_manager',
  'hr_unit_principal',
  'vipam_manager',
  'vipam_principal',
  'odu_manager',
  'senior_admin_officer',
]

export default function UnitManagerGuide() {
  return (
    <GuideViewer
      title="Unit Manager — Processing Guide"
      htmlFile="unit-manager-guide.html"
      allowedRoles={UNIT_MANAGER_ROLES}
    />
  )
}
