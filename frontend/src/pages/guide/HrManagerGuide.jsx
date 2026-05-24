import GuideViewer from './GuideViewer'

const HR_MANAGER_ROLES = ['ministry_hr', 'dept_admin', 'head_of_agency']

export default function HrManagerGuide() {
  return (
    <GuideViewer
      title="HR Manager — User Guide"
      htmlFile="hr-manager-guide.html"
      allowedRoles={HR_MANAGER_ROLES}
    />
  )
}
