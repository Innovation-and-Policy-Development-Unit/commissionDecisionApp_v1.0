import PageHeader from '../../components/shared/PageHeader'
import { User, Camera } from 'lucide-react'
import { img } from '../../utils/imgPath'

const avatarImages = [
  img('/images/avatars/avatar-man-bob.jpg'),
  img('/images/avatars/avatar-woman-alice.jpg'),
  img('/images/avatars/avatar-man-david.jpg'),
  img('/images/avatars/avatar-woman-carol.jpg'),
  img('/images/avatars/avatar-man-mike.jpg'),
]

function Avatar({ size = 'md', shape = 'circle', initials, src, status, badge, gradient = 'bg-primary-500' }) {
  const sizes = { xs: 'w-7 h-7 text-[10px]', sm: 'w-9 h-9 text-xs', md: 'w-11 h-11 text-sm', lg: 'w-14 h-14 text-base', xl: 'w-20 h-20 text-xl' }
  const shapes = { circle: 'rounded-full', rounded: 'rounded-xl', square: 'rounded-lg' }
  const statusColors = { online: 'bg-emerald-500', away: 'bg-amber-500', busy: 'bg-red-500', offline: 'bg-slate-400' }
  const statusSizes = { xs: 'w-2 h-2', sm: 'w-2.5 h-2.5', md: 'w-3 h-3', lg: 'w-3.5 h-3.5', xl: 'w-4 h-4' }

  return (
    <div className="relative inline-flex">
      {src ? (
        <img src={src} alt={initials || 'Avatar'} className={`${sizes[size]} ${shapes[shape]} object-cover`} />
      ) : initials ? (
        <div className={`${sizes[size]} ${shapes[shape]} ${gradient} flex items-center justify-center`}>
          <span className="text-white font-bold">{initials}</span>
        </div>
      ) : (
        <div className={`${sizes[size]} ${shapes[shape]} bg-slate-200 dark:bg-slate-700 flex items-center justify-center`}>
          <User size={parseInt(sizes[size].match(/\d+/)[0]) / 2.5} className="text-slate-400" />
        </div>
      )}
      {status && (
        <div className={`absolute bottom-0 end-0 ${statusSizes[size]} rounded-full border-2 border-white dark:border-slate-800 ${statusColors[status]}`} />
      )}
      {badge && (
        <div className="absolute -top-1 -end-1 w-4 h-4 rounded-full bg-red-500 border-2 border-white dark:border-slate-800 flex items-center justify-center">
          <span className="text-white text-[8px] font-bold">{badge}</span>
        </div>
      )}
    </div>
  )
}

export default function AvatarPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Avatar" subtitle="Visual representations for users and identities" />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sizes */}
        <div className="card p-6">
          <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-5">Sizes</h3>
          <div className="flex items-end gap-5">
            <div className="flex flex-col items-center gap-2"><Avatar size="xs" src={img('/images/avatars/avatar-man-bob.jpg')} /><span className="text-xs text-slate-400">XS</span></div>
            <div className="flex flex-col items-center gap-2"><Avatar size="sm" src={img('/images/avatars/avatar-woman-alice.jpg')} /><span className="text-xs text-slate-400">SM</span></div>
            <div className="flex flex-col items-center gap-2"><Avatar size="md" src={img('/images/avatars/avatar-man-david.jpg')} /><span className="text-xs text-slate-400">MD</span></div>
            <div className="flex flex-col items-center gap-2"><Avatar size="lg" src={img('/images/avatars/avatar-woman-carol.jpg')} /><span className="text-xs text-slate-400">LG</span></div>
            <div className="flex flex-col items-center gap-2"><Avatar size="xl" src={img('/images/avatars/avatar-man-mike.jpg')} /><span className="text-xs text-slate-400">XL</span></div>
          </div>
        </div>

        {/* Shapes */}
        <div className="card p-6">
          <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-5">Shapes</h3>
          <div className="flex items-center gap-6">
            <div className="flex flex-col items-center gap-2"><Avatar size="lg" src={img('/images/avatars/avatar-woman-grace.jpg')} shape="circle" /><span className="text-xs text-slate-400">Circle</span></div>
            <div className="flex flex-col items-center gap-2"><Avatar size="lg" src={img('/images/avatars/avatar-man-henry.jpg')} shape="rounded" /><span className="text-xs text-slate-400">Rounded</span></div>
            <div className="flex flex-col items-center gap-2"><Avatar size="lg" src={img('/images/avatars/avatar-woman-sarah-kim.jpg')} shape="square" /><span className="text-xs text-slate-400">Square</span></div>
          </div>
        </div>

        {/* Status Indicators */}
        <div className="card p-6">
          <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-5">Status Indicators</h3>
          <div className="flex items-center gap-6">
            <div className="flex flex-col items-center gap-2"><Avatar size="lg" src={img('/images/avatars/avatar-man-frank.jpg')} status="online" /><span className="text-xs text-slate-400">Online</span></div>
            <div className="flex flex-col items-center gap-2"><Avatar size="lg" src={img('/images/avatars/avatar-woman-rachel.jpg')} status="away" /><span className="text-xs text-slate-400">Away</span></div>
            <div className="flex flex-col items-center gap-2"><Avatar size="lg" src={img('/images/avatars/avatar-man-alex.jpg')} status="busy" /><span className="text-xs text-slate-400">Busy</span></div>
            <div className="flex flex-col items-center gap-2"><Avatar size="lg" src={img('/images/avatars/avatar-woman-sophie.jpg')} status="offline" /><span className="text-xs text-slate-400">Offline</span></div>
          </div>
        </div>

        {/* With Badge */}
        <div className="card p-6">
          <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-5">With Notification Badge</h3>
          <div className="flex items-center gap-6">
            <div className="flex flex-col items-center gap-2"><Avatar size="lg" src={img('/images/avatars/avatar-man-john.jpg')} badge="3" /><span className="text-xs text-slate-400">Badge</span></div>
            <div className="flex flex-col items-center gap-2"><Avatar size="lg" src={img('/images/avatars/avatar-woman-jane.jpg')} badge="9" status="online" /><span className="text-xs text-slate-400">Badge + Status</span></div>
            <div className="flex flex-col items-center gap-2"><Avatar size="xl" src={img('/images/avatars/avatar-man-oliver.jpg')} badge="12" /><span className="text-xs text-slate-400">Large</span></div>
          </div>
        </div>

        {/* Stacked / Group */}
        <div className="card p-6">
          <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-5">Stacked Group</h3>
          <div className="space-y-4">
            <div>
              <p className="text-xs text-slate-500 mb-2">Stacked avatars</p>
              <div className="flex items-center">
                {avatarImages.map((img, i) => (
                  <img key={i} src={img} alt="" className="-ms-2 first:ms-0 w-10 h-10 rounded-full object-cover border-2 border-white dark:border-slate-800" />
                ))}
                <div className="-ms-2 w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center border-2 border-white dark:border-slate-800">
                  <span className="text-slate-600 dark:text-slate-400 font-bold text-xs">+5</span>
                </div>
              </div>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-2">Team members</p>
              <div className="flex items-center gap-3">
                {[
                  { img: img('/images/avatars/avatar-man-john.jpg'), name: 'John D.' },
                  { img: img('/images/avatars/avatar-woman-alice.jpg'), name: 'Alice C.' },
                  { img: img('/images/avatars/avatar-man-henry.jpg'), name: 'Bob S.' },
                  { img: img('/images/avatars/avatar-woman-carol-white.jpg'), name: 'Carol W.' },
                ].map((user, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <img src={user.img} alt={user.name} className="w-8 h-8 rounded-full object-cover" />
                    <div className="hidden sm:block">
                      <p className="text-xs font-medium text-slate-700 dark:text-slate-300">{user.name}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* With Edit */}
        <div className="card p-6">
          <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-5">Editable Avatar</h3>
          <div className="flex items-center gap-6">
            {[
              { size: 'w-20 h-20', img: img('/images/avatars/avatar-man-john.jpg'), iconSize: 18 },
              { size: 'w-14 h-14', img: img('/images/avatars/avatar-woman-grace.jpg'), iconSize: 14 },
              { size: 'w-11 h-11', img: img('/images/avatars/avatar-man-david.jpg'), iconSize: 12 },
            ].map((item, i) => (
              <div key={i} className="relative cursor-pointer group">
                <img src={item.img} alt="" className={`${item.size} rounded-full object-cover`} />
                <div className={`absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity`}>
                  <Camera size={item.iconSize} className="text-white" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Photo Avatars Grid */}
        <div className="card p-6">
          <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-5">Photo Avatars</h3>
          <p className="text-sm text-slate-500 mb-4">Avatars with actual profile photos</p>
          <div className="grid grid-cols-5 gap-4">
            {[
              { img: img('/images/avatars/avatar-man-bob.jpg'), name: 'Mike K.' },
              { img: img('/images/avatars/avatar-woman-sarah-chen.jpg'), name: 'Sara R.' },
              { img: img('/images/avatars/avatar-man-profile.jpg'), name: 'James W.' },
              { img: img('/images/avatars/avatar-woman-jessica.jpg'), name: 'Lisa P.' },
              { img: img('/images/avatars/avatar-man-daniel.jpg'), name: 'Dan H.' },
              { img: img('/images/avatars/avatar-woman-eva.jpg'), name: 'Nina K.' },
              { img: img('/images/avatars/avatar-man-marcus.jpg'), name: 'Tom P.' },
              { img: img('/images/avatars/avatar-woman-anna.jpg'), name: 'Ana V.' },
              { img: img('/images/avatars/avatar-man-james.jpg'), name: 'Rob G.' },
              { img: img('/images/avatars/avatar-woman-kate.jpg'), name: 'Eva L.' },
            ].map((user, i) => (
              <div key={i} className="flex flex-col items-center gap-1.5">
                <img src={user.img} alt={user.name} className="w-11 h-11 rounded-full object-cover shadow-lg" />
                <span className="text-xs text-slate-500 dark:text-slate-400 truncate">{user.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Avatar Cards */}
        <div className="card p-6">
          <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-5">Avatar Cards</h3>
          <p className="text-sm text-slate-500 mb-4">Mini user cards combining avatars with user details</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { name: 'Sarah Chen', role: 'Product Designer', img: img('/images/avatars/avatar-woman-alice.jpg'), status: 'online', projects: 12 },
              { name: 'Marcus Rivera', role: 'Lead Developer', img: img('/images/avatars/avatar-man-bob.jpg'), status: 'online', projects: 24 },
              { name: 'Emily Watson', role: 'Marketing Lead', img: img('/images/avatars/avatar-woman-carol.jpg'), status: 'away', projects: 8 },
              { name: 'Alex Nakamura', role: 'Data Scientist', img: img('/images/avatars/avatar-man-david.jpg'), status: 'busy', projects: 15 },
            ].map((user, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-700/30 hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors">
                <div className="relative shrink-0">
                  <img src={user.img} alt={user.name} className="w-12 h-12 rounded-full object-cover" />
                  <div className={`absolute bottom-0 end-0 w-3 h-3 rounded-full border-2 border-slate-50 dark:border-slate-700 ${user.status === 'online' ? 'bg-emerald-500' : user.status === 'away' ? 'bg-amber-500' : 'bg-red-500'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">{user.name}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{user.role}</p>
                  <p className="text-xs text-primary-600 dark:text-primary-400 mt-0.5">{user.projects} projects</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
