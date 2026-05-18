import { Star } from 'lucide-react'
import { img } from '../../../utils/imgPath'
import Section from './Section'

export default function ProfileCards() {
  return (
    <Section title="Profile & User Cards" subtitle="User profile, team member, and testimonial cards">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">

        {/* Profile card */}
        <div className="card">
          <div className="relative mb-8">
            <div className="h-24 relative overflow-hidden rounded-t-xl">
              <img src={img('/images/unsplash/mountain-landscape.jpg')} alt="Cover" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
            </div>
            <div className="absolute -bottom-6 left-5 z-10">
              <img src={img('/images/avatars/avatar-man-profile.jpg')} alt="John Doe" className="w-16 h-16 rounded-2xl object-cover border-4 border-white dark:border-slate-800 shadow-card-md" />
            </div>
          </div>
          <div className="px-5 pb-5">
            <div className="flex items-end justify-between mb-4">
              <div />
              <button className="btn btn-primary btn-sm">Follow</button>
            </div>
            <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">John Doe</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Senior Frontend Developer</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mb-4">San Francisco, CA · he/him</p>
            <div className="grid grid-cols-3 divide-x divide-slate-100 dark:divide-slate-700 border-t border-slate-100 dark:border-slate-700 pt-4 text-center">
              {[['Posts', '57'], ['Followers', '1.2k'], ['Following', '348']].map(([l, v]) => (
                <div key={l} className="px-2">
                  <p className="font-bold text-slate-900 dark:text-slate-100 text-base">{v}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">{l}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Team member card */}
        <div className="card p-5">
          <div className="flex items-start gap-4 mb-4">
            <div className="relative">
              <img src={img('/images/avatars/avatar-woman-sarah-chen.jpg')} alt="Sarah Chen" className="w-14 h-14 rounded-2xl object-cover shadow-sm" />
              <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-800" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-slate-900 dark:text-slate-100 leading-tight">Sarah Chen</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Full-Stack Engineer</p>
              <span className="badge badge-success mt-1">Online</span>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-400">Department</p>
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mt-0.5">Engineering</p>
            </div>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-4">
            Building scalable web applications with a passion for clean code and great developer experiences.
          </p>
          <div className="flex flex-wrap gap-1.5 mb-4">
            {['React', 'TypeScript', 'Go', 'Docker', 'AWS'].map(skill => (
              <span key={skill} className="badge badge-primary text-[11px]">{skill}</span>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-2 border-t border-slate-100 dark:border-slate-700 pt-4">
            {[['Projects', '14'], ['Commits', '428'], ['Reviews', '91']].map(([l, v]) => (
              <div key={l} className="text-center">
                <p className="font-bold text-slate-900 dark:text-slate-100">{v}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">{l}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Testimonial card */}
        <div className="card p-6 flex flex-col justify-between">
          <div>
            <div className="flex gap-0.5 mb-4">
              {[1,2,3,4,5].map(s => (
                <Star key={s} size={16} className="text-amber-400 fill-amber-400" />
              ))}
            </div>
            <blockquote className="text-slate-700 dark:text-slate-300 text-sm leading-relaxed mb-5">
              "Liner is hands-down the best admin template I've used. The component quality is outstanding, the dark mode is flawless, and the Tailwind integration saves us weeks of work on every project."
            </blockquote>
          </div>
          <div className="flex items-center gap-3 border-t border-slate-100 dark:border-slate-700 pt-4">
            <img src={img('/images/avatars/avatar-man-david.jpg')} alt="Marcus Reynolds" className="w-10 h-10 rounded-full object-cover" />
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Marcus Reynolds</p>
              <p className="text-xs text-slate-400">CTO at BuildFast Inc.</p>
            </div>
            <span className="ml-auto badge badge-warning">Verified</span>
          </div>
        </div>

      </div>
    </Section>
  )
}
