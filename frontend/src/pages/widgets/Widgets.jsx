import PageHeader from '../../components/shared/PageHeader'
import { GradientStats, LightStats } from './parts/StatWidgets'
import ProfileCards from './parts/ProfileCards'
import ProgressWidgets from './parts/ProgressWidgets'
import InteractiveWidgets from './parts/InteractiveWidgets'
import ActivityWidgets from './parts/ActivityWidgets'
import SocialWidgets from './parts/SocialWidgets'
import CalendarWidgets from './parts/CalendarWidgets'
import MediaCards from './parts/MediaCards'
import CountdownWidgets from './parts/CountdownWidgets'

export default function Widgets() {
  return (
    <div className="space-y-10 pb-12">
      <PageHeader title="Widgets" subtitle="A premium showcase of reusable UI widgets for your dashboard" />
      <GradientStats />
      <LightStats />
      <ProfileCards />
      <ProgressWidgets />
      <InteractiveWidgets />
      <ActivityWidgets />
      <SocialWidgets />
      <CalendarWidgets />
      <MediaCards />
      <CountdownWidgets />
    </div>
  )
}
