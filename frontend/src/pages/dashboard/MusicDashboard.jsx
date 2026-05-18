import { useState } from 'react'
import {
  AreaChart, Area, BarChart, Bar, RadialBarChart, RadialBar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts'
import useChartColors from '../../hooks/useChartColors'
import PageHeader from '../../components/shared/PageHeader'
import {
  Play, Pause, SkipBack, SkipForward, Heart, Shuffle, Repeat2,
  Music2, Headphones, Clock, ListMusic, TrendingUp, Volume2,
  Radio, Disc3, Mic2, ChevronRight, MoreHorizontal, Star,
  Users, Award, Flame, Sparkles, Share2, Bookmark, Podcast,
  Music, Globe, Zap, Calendar, ArrowUpRight, ExternalLink
} from 'lucide-react'

const weeklyPlays = [
  { day: 'Mon', plays: 42, minutes: 168 },
  { day: 'Tue', plays: 68, minutes: 272 },
  { day: 'Wed', plays: 55, minutes: 220 },
  { day: 'Thu', plays: 80, minutes: 320 },
  { day: 'Fri', plays: 95, minutes: 380 },
  { day: 'Sat', plays: 120, minutes: 480 },
  { day: 'Sun', plays: 88, minutes: 352 },
]

// genreBreakdown moved inside component for dynamic chart colors

const topArtists = [
  { name: 'The Weeknd', plays: 2410, pct: 100, color: 'bg-purple-500', genre: 'R&B' },
  { name: 'Dua Lipa', plays: 1920, pct: 80, color: 'bg-cyan-500', genre: 'Pop' },
  { name: 'Ed Sheeran', plays: 1740, pct: 72, color: 'bg-orange-500', genre: 'Pop/Folk' },
  { name: 'Billie Eilish', plays: 1530, pct: 63, color: 'bg-emerald-500', genre: 'Indie Pop' },
]

const recentTracks = [
  { title: 'Blinding Lights', artist: 'The Weeknd', album: 'After Hours', duration: '3:20', liked: true, plays: 847 },
  { title: 'Levitating', artist: 'Dua Lipa', album: 'Future Nostalgia', duration: '3:23', liked: false, plays: 623 },
  { title: 'Shape of You', artist: 'Ed Sheeran', album: 'Divide', duration: '3:53', liked: true, plays: 891 },
  { title: 'Bad Guy', artist: 'Billie Eilish', album: 'When We All Fall Asleep', duration: '3:14', liked: false, plays: 514 },
  { title: 'Watermelon Sugar', artist: 'Harry Styles', album: 'Fine Line', duration: '2:54', liked: false, plays: 432 },
  { title: 'Anti-Hero', artist: 'Taylor Swift', album: 'Midnights', duration: '3:20', liked: true, plays: 1021 },
]

const trendingNow = [
  { rank: 1, title: 'Anti-Hero', artist: 'Taylor Swift', change: 2, dir: 'up' },
  { rank: 2, title: 'As It Was', artist: 'Harry Styles', change: 1, dir: 'up' },
  { rank: 3, title: 'About Damn Time', artist: 'Lizzo', change: 0, dir: 'same' },
  { rank: 4, title: 'Running Up That Hill', artist: 'Kate Bush', change: 3, dir: 'up' },
]

const EqBar = ({ height, delay }) => (
  <div
    className="w-1 bg-primary-500 rounded-full opacity-80"
    style={{
      height: `${height}px`,
      animation: `eqBounce 0.8s ease-in-out infinite alternate`,
      animationDelay: delay,
    }}
  />
)

export default function MusicDashboard() {
  const [isPlaying, setIsPlaying] = useState(true)
  const [progress, setProgress] = useState(42)
  const [liked, setLiked] = useState(false)
  const [volume, setVolume] = useState(72)
  const [shuffle, setShuffle] = useState(false)
  const C = useChartColors()

  const genreBreakdown = [
    { name: 'Pop', value: 35, fill: C.primary },
    { name: 'Rock', value: 65, fill: C.violet },
    { name: 'Jazz', value: 48, fill: C.cyan },
    { name: 'Electronic', value: 78, fill: C.emerald },
    { name: 'Classical', value: 25, fill: C.amber },
  ]

  const statCards = [
    { label: 'Total Plays', value: '12,847', icon: Play, color: 'bg-primary-500', sub: '+324 today' },
    { label: 'Hours Listened', value: '428', icon: Clock, color: 'bg-cyan-500', sub: '6.2h today' },
    { label: 'Artists Followed', value: '142', icon: Mic2, color: 'bg-rose-500', sub: '+3 this week' },
    { label: 'Playlists', value: '32', icon: ListMusic, color: 'bg-emerald-500', sub: '8 recently' },
    { label: 'Liked Songs', value: '284', icon: Heart, color: 'bg-amber-500', sub: '+12 today' },
    { label: 'Podcasts', value: '18', icon: Radio, color: 'bg-primary-500', sub: '4 new' },
  ]

  return (
    <div className="space-y-6 bg-white dark:bg-slate-900 -m-4 sm:-m-6 p-4 sm:p-6 min-h-screen">
      <style>{`@keyframes eqBounce { from { transform: scaleY(0.3); } to { transform: scaleY(1); } }`}</style>

      <PageHeader title="Music Dashboard" subtitle="Your listening stats, favorites and activity" action={
        <button className="btn-outline btn-sm"><Headphones size={14} className="me-1.5 inline" />Open Player</button>
      } />

      {/* ── Welcome Banner + Weekly Streams Chart ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Congratulations Card */}
        <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700 p-6 relative overflow-hidden">
          <div className="relative z-10">
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Welcome back, DJ! 🎶</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">You've streamed <span className="font-semibold text-primary-600 dark:text-primary-400">38% more</span> music this week</p>
            <div className="space-y-3 mt-5">
              {[
                { icon: Music2, label: '64 new tracks', sub: 'Added to library', color: 'bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400' },
                { icon: Headphones, label: '4 playlists', sub: 'Shared this week', color: 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400' },
                { icon: Podcast, label: '12 episodes', sub: 'Fully listened', color: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400' },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl ${item.color} flex items-center justify-center shrink-0`}>
                    <item.icon size={18} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{item.label}</p>
                    <p className="text-xs text-slate-400">{item.sub}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          {/* SVG Illustration */}
          <svg className="absolute bottom-0 end-0 w-44 h-44 opacity-60 dark:opacity-30" viewBox="0 0 200 200" fill="none">
            {/* Desk */}
            <rect x="40" y="140" width="120" height="8" rx="4" fill="#c7d2fe" />
            <rect x="60" y="148" width="6" height="30" rx="2" fill="#a5b4fc" />
            <rect x="134" y="148" width="6" height="30" rx="2" fill="#a5b4fc" />
            {/* Laptop */}
            <rect x="55" y="115" width="56" height="28" rx="4" fill="#e0e7ff" stroke="#a5b4fc" strokeWidth="1.5" />
            <rect x="60" y="120" width="46" height="18" rx="2" fill="#c7d2fe" />
            {/* Music notes */}
            <circle cx="150" cy="80" r="6" fill="#6366f1" opacity="0.6" />
            <line x1="156" y1="80" x2="156" y2="55" stroke="#6366f1" strokeWidth="2" opacity="0.6" />
            <circle cx="160" cy="55" r="4" fill="#6366f1" opacity="0.4" />
            <circle cx="130" cy="100" r="5" fill="#8b5cf6" opacity="0.5" />
            <line x1="135" y1="100" x2="135" y2="78" stroke="#8b5cf6" strokeWidth="2" opacity="0.5" />
            <circle cx="170" cy="110" r="4" fill="#06b6d4" opacity="0.5" />
            {/* Headphones */}
            <path d="M80 90 Q80 65 100 65 Q120 65 120 90" stroke="#6366f1" strokeWidth="3" fill="none" opacity="0.5" strokeLinecap="round" />
            <rect x="75" y="88" width="10" height="14" rx="4" fill="#6366f1" opacity="0.5" />
            <rect x="115" y="88" width="10" height="14" rx="4" fill="#6366f1" opacity="0.5" />
            {/* Sparkles */}
            <circle cx="45" cy="75" r="2" fill="#f59e0b" opacity="0.6" />
            <circle cx="165" cy="45" r="2.5" fill="#10b981" opacity="0.5" />
            <circle cx="55" cy="55" r="1.5" fill="#f43f5e" opacity="0.5" />
          </svg>
        </div>

        {/* Total Streams Chart */}
        <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700 overflow-hidden">
          <div className="flex items-center justify-between px-5 pt-5 pb-2">
            <div>
              <h3 className="font-bold text-slate-800 dark:text-slate-200">Total Streams</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Weekly streaming activity</p>
            </div>
            <select className="text-xs border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-1.5 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 focus:outline-none">
              <option>This Week</option>
              <option>Last Week</option>
            </select>
          </div>
          <div className="px-3 pb-3">
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={weeklyPlays} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="gStreams" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={C.cyan} stopOpacity={0.15} />
                    <stop offset="100%" stopColor={C.cyan} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gMins" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={C.violet} stopOpacity={0.1} />
                    <stop offset="100%" stopColor={C.violet} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={C.grid} vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: C.axis }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: C.axis }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.08)', fontSize: '12px' }} />
                <Area type="monotone" dataKey="plays" name="Plays" stroke={C.cyan} strokeWidth={2.5} fill="url(#gStreams)" dot={{ r: 3, fill: C.cyan, strokeWidth: 0 }} />
                <Area type="monotone" dataKey="minutes" name="Minutes" stroke={C.violet} strokeWidth={2} fill="url(#gMins)" dot={false} strokeDasharray="4 4" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* ── Quick Metric Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Latest Hit */}
        <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700 p-5">
          <div className="flex items-center justify-between mb-1">
            <h4 className="font-bold text-slate-800 dark:text-slate-200 text-sm">Latest Hit</h4>
            <span className="text-xs font-bold text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded-full">86.5%</span>
          </div>
          <p className="text-xs text-slate-400 mb-3">Last 7 days</p>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-bold text-slate-800 dark:text-slate-200">98,500</span>
            <span className="text-sm font-bold text-slate-800 dark:text-slate-200">1,22,900</span>
          </div>
          <div className="h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden mb-3">
            <div className="h-full bg-primary-500 rounded-full" style={{ width: '76%' }} />
          </div>
          <p className="text-xs text-slate-400">Tracks played: 18/22</p>
          <div className="flex items-center gap-1 mt-3">
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Recent Listeners</p>
          </div>
          <div className="flex items-center mt-2">
            {['bg-purple-400', 'bg-cyan-400', 'bg-amber-400', 'bg-emerald-400'].map((c, i) => (
              <div key={i} className={`w-8 h-8 rounded-full ${c} flex items-center justify-center border-2 border-white dark:border-slate-800 text-white text-[8px] font-bold -ms-1.5 first:ms-0`}>
                {['TW', 'DL', 'ES', 'BE'][i]}
              </div>
            ))}
            <span className="text-xs font-semibold text-primary-500 ms-2">+8</span>
          </div>
        </div>

        {/* Listeners */}
        <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700 p-5">
          <div className="flex items-center justify-between mb-1">
            <h4 className="font-bold text-slate-800 dark:text-slate-200 text-sm">Listeners</h4>
            <div className="flex items-center gap-1">
              <span className="text-lg font-bold text-slate-800 dark:text-slate-100">6,380</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 mb-4">
            <p className="text-xs text-slate-400">Last 7 days</p>
            <span className="text-xs font-bold text-emerald-500">+26.5%</span>
          </div>
          <div className="h-14">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={[{ v: 20 }, { v: 28 }, { v: 22 }, { v: 35 }, { v: 30 }, { v: 42 }, { v: 38 }]} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gListen" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={C.cyan} stopOpacity={0.2} />
                    <stop offset="100%" stopColor={C.cyan} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area type="monotone" dataKey="v" stroke={C.cyan} strokeWidth={2} fill="url(#gListen)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center justify-between mt-3 text-xs text-slate-500 dark:text-slate-400">
            <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-cyan-500" /> This week <span className="font-bold text-slate-700 dark:text-slate-300">6,380</span></div>
          </div>
          <div className="flex items-center justify-between mt-1.5 text-xs text-slate-500 dark:text-slate-400">
            <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-cyan-200" /> Last week <span className="font-bold text-slate-700 dark:text-slate-300">4,298</span></div>
          </div>
        </div>

        {/* Streams */}
        <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700 p-5">
          <div className="flex items-center justify-between mb-1">
            <h4 className="font-bold text-slate-800 dark:text-slate-200 text-sm">Streams</h4>
            <div className="flex items-center gap-1">
              <span className="text-lg font-bold text-slate-800 dark:text-slate-100">12,389</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 mb-4">
            <p className="text-xs text-slate-400">Last 7 days</p>
            <span className="text-xs font-bold text-red-400">-3.8%</span>
          </div>
          <div className="h-14">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={[{ a: 30, b: 15 }, { a: 45, b: 20 }, { a: 35, b: 25 }, { a: 55, b: 18 }, { a: 40, b: 22 }, { a: 60, b: 15 }, { a: 50, b: 20 }]} barSize={7} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                <Bar dataKey="a" stackId="s" radius={[0, 0, 0, 0]} fill={C.primary} />
                <Bar dataKey="b" stackId="s" radius={[3, 3, 0, 0]} fill={C.violet} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center justify-between mt-3 text-xs text-slate-500 dark:text-slate-400">
            <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-primary-500" /> Spotify <span className="font-bold text-slate-700 dark:text-slate-300">52%</span></div>
          </div>
          <div className="flex items-center justify-between mt-1.5 text-xs text-slate-500 dark:text-slate-400">
            <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-primary-200" /> Apple Music <span className="font-bold text-slate-700 dark:text-slate-300">48%</span></div>
          </div>
        </div>

        {/* Albums */}
        <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700 p-5">
          <div className="flex items-center justify-between mb-1">
            <h4 className="font-bold text-slate-800 dark:text-slate-200 text-sm">Albums</h4>
            <div className="flex items-center gap-1">
              <span className="text-lg font-bold text-slate-800 dark:text-slate-100">432</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 mb-4">
            <p className="text-xs text-slate-400">Last 7 days</p>
            <span className="text-xs font-bold text-emerald-500">+26.5%</span>
          </div>
          <div className="flex justify-center">
            <ResponsiveContainer width={100} height={100}>
              <RadialBarChart cx="50%" cy="50%" innerRadius={25} outerRadius={48} data={[{ v: 75 }, { v: 55 }]} startAngle={90} endAngle={-270}>
                <RadialBar dataKey="v" cornerRadius={8} background={{ fill: C.grid }}>
                  <Cell fill={C.cyan} />
                  <Cell fill={C.violet} />
                </RadialBar>
              </RadialBarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs text-slate-400 text-center mt-1">Profit more than last month</p>
        </div>
      </div>

      {/* Stat Cards - dark moody look */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        {statCards.map((s, i) => (
          <div key={i} className={`relative overflow-hidden rounded-2xl ${s.color} p-4 text-white`}>
            <div className="absolute -top-3 -right-3 w-16 h-16 rounded-full bg-white/10" />
            <s.icon size={20} className="opacity-80 mb-3 relative" />
            <p className="text-xl font-bold relative">{s.value}</p>
            <p className="text-white/70 text-[11px] mt-0.5 relative">{s.label}</p>
            <p className="text-white/50 text-[10px] mt-1 relative">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Main Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">

        {/* Now Playing Card - beautiful large card */}
        <div className="lg:col-span-4 card overflow-hidden">
          <div className="p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <span className="flex gap-0.5 items-end h-4">
                  <EqBar height={8} delay="0s" />
                  <EqBar height={14} delay="0.2s" />
                  <EqBar height={10} delay="0.1s" />
                  <EqBar height={16} delay="0.3s" />
                </span>
                Now Playing
              </h3>
              <button className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"><MoreHorizontal size={16} /></button>
            </div>

            {/* Album Art */}
            <div className="relative w-full aspect-square rounded-2xl overflow-hidden mb-5 shadow-glow">
              <div className="w-full h-full bg-primary-500 flex items-center justify-center">
                <Disc3 size={72} className="text-white/70 animate-spin" style={{ animationDuration: isPlaying ? '4s' : '99999s' }} />
              </div>
              <div className="absolute inset-0 bg-black/20" />
              <div className="absolute bottom-3 left-3">
                <span className="text-[10px] text-white/80 bg-white/20 backdrop-blur-sm px-2 py-0.5 rounded-full">After Hours · 2020</span>
              </div>
            </div>

            {/* Track info */}
            <div className="flex items-center justify-between mb-3">
              <div>
                <h4 className="font-bold text-lg text-slate-800 dark:text-slate-200">Blinding Lights</h4>
                <p className="text-slate-500 dark:text-slate-400 text-sm">The Weeknd</p>
              </div>
              <button onClick={() => setLiked(l => !l)} className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${liked ? 'bg-rose-500 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-400 hover:text-rose-500'}`}>
                <Heart size={16} fill={liked ? 'currentColor' : 'none'} />
              </button>
            </div>

            {/* Progress */}
            <div className="mb-4">
              <div className="flex justify-between text-xs text-slate-400 mb-1.5">
                <span>1:24</span><span>3:20</span>
              </div>
              <div className="h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full cursor-pointer" onClick={e => {
                const rect = e.currentTarget.getBoundingClientRect()
                setProgress(Math.round(((e.clientX - rect.left) / rect.width) * 100))
              }}>
                <div className="h-full bg-primary-500 rounded-full relative" style={{ width: `${progress}%` }}>
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-md border-2 border-primary-500" />
                </div>
              </div>
            </div>

            {/* Volume */}
            <div className="flex items-center gap-2 mb-5">
              <Volume2 size={14} className="text-slate-400 shrink-0" />
              <div className="flex-1 h-1 bg-slate-200 dark:bg-slate-700 rounded-full cursor-pointer" onClick={e => {
                const rect = e.currentTarget.getBoundingClientRect()
                setVolume(Math.round(((e.clientX - rect.left) / rect.width) * 100))
              }}>
                <div className="h-full bg-primary-500 rounded-full" style={{ width: `${volume}%` }} />
              </div>
              <span className="text-xs text-slate-400 w-7 shrink-0">{volume}%</span>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-between">
              <button onClick={() => setShuffle(s => !s)} className={`transition-colors ${shuffle ? 'text-primary-500' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}>
                <Shuffle size={18} />
              </button>
              <button className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors">
                <SkipBack size={22} />
              </button>
              <button onClick={() => setIsPlaying(p => !p)}
                className="w-14 h-14 rounded-full bg-primary-500 flex items-center justify-center text-white shadow-glow hover:shadow-lg transition-all active:scale-95">
                {isPlaying ? <Pause size={22} /> : <Play size={22} />}
              </button>
              <button className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors">
                <SkipForward size={22} />
              </button>
              <button className="text-slate-400 hover:text-primary-500 transition-colors">
                <Repeat2 size={18} />
              </button>
            </div>
          </div>

        </div>

        {/* Center Column */}
        <div className="lg:col-span-5 space-y-4">
          {/* Weekly Activity */}
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-700">
              <div>
                <h3 className="font-bold text-slate-800 dark:text-slate-200">Weekly Listening</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Plays and minutes per day</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-primary-500 block" /><span className="text-xs text-slate-500">Plays</span></div>
                <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-cyan-400 block" /><span className="text-xs text-slate-500">Minutes</span></div>
              </div>
            </div>
            <div className="p-5">
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={weeklyPlays} barCategoryGap="35%" margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.bg} vertical={false} />
                  <XAxis dataKey="day" tick={{ fontSize: 11, fill: C.axis }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: C.axis }} axisLine={false} tickLine={false} />
                  <Tooltip />
                  <Bar dataKey="plays" name="Plays" fill={C.primary} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="minutes" name="Minutes" fill={C.cyan} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Top Artists with progress bars */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-slate-800 dark:text-slate-200">Top Artists</h3>
              <button className="text-xs text-primary-600 dark:text-primary-400 font-medium flex items-center gap-0.5">See All <ChevronRight size={12} /></button>
            </div>
            <div className="space-y-4">
              {topArtists.map((artist, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-xs font-bold text-slate-400 w-4 shrink-0">#{i + 1}</span>
                  <div className={`w-9 h-9 rounded-xl ${artist.color} flex items-center justify-center shrink-0`}>
                    <span className="text-white text-xs font-bold">{artist.name[0]}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 truncate">{artist.name}</p>
                      <span className="text-xs font-bold text-slate-600 dark:text-slate-400 shrink-0 ms-2">{artist.plays.toLocaleString()}</span>
                    </div>
                    <div className="h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div className={`h-full ${artist.color} rounded-full`} style={{ width: `${artist.pct}%` }} />
                    </div>
                    <p className="text-[10px] text-slate-400 mt-0.5">{artist.genre}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="lg:col-span-3 space-y-4">
          {/* Genre Radial */}
          <div className="card p-5">
            <h3 className="font-bold text-slate-800 dark:text-slate-200 mb-3">Genre Mix</h3>
            <ResponsiveContainer width="100%" height={160}>
              <RadialBarChart cx="50%" cy="50%" innerRadius={20} outerRadius={75} data={genreBreakdown} startAngle={90} endAngle={-270}>
                <RadialBar dataKey="value" cornerRadius={4} background={{ fill: C.bg }}>
                  {genreBreakdown.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                </RadialBar>
                <Tooltip formatter={(v, n) => [`${v}%`, n]} />
              </RadialBarChart>
            </ResponsiveContainer>
            <div className="grid grid-cols-1 gap-1 mt-1">
              {genreBreakdown.map(g => (
                <div key={g.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: g.fill }} />
                    <span className="text-xs text-slate-600 dark:text-slate-400">{g.name}</span>
                  </div>
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{g.value}%</span>
                </div>
              ))}
            </div>
          </div>

          {/* Trending Now */}
          <div className="card p-5">
            <h3 className="font-bold text-slate-800 dark:text-slate-200 mb-4">Trending Now</h3>
            <div className="space-y-3">
              {trendingNow.map(t => (
                <div key={t.rank} className="flex items-center gap-3 group hover:bg-slate-50 dark:hover:bg-slate-700/30 rounded-xl p-1.5 -mx-1.5 cursor-pointer transition-colors">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${t.rank <= 3 ? 'bg-primary-500 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-500'}`}>
                    {t.rank}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 truncate">{t.title}</p>
                    <p className="text-[10px] text-slate-400 truncate">{t.artist}</p>
                  </div>
                  <div className={`text-xs font-bold shrink-0 flex items-center gap-0.5 ${t.dir === 'up' ? 'text-emerald-500' : t.dir === 'down' ? 'text-red-500' : 'text-slate-400'}`}>
                    {t.dir === 'up' ? '▲' : t.dir === 'down' ? '▼' : '—'}
                    {t.change > 0 ? t.change : ''}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Featured Artists Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
        {[
          { name: 'Ariana Grande', genre: 'Pop', listeners: '58.2M', gradient: 'bg-pink-100 dark:bg-pink-900/20', accent: 'text-pink-600 dark:text-pink-400', border: 'border-pink-200 dark:border-pink-800/40', iconBg: 'bg-pink-500', ring: 'ring-pink-200 dark:ring-pink-800' },
          { name: 'Travis Scott', genre: 'Hip-Hop', listeners: '42.7M', gradient: 'bg-amber-100 dark:bg-amber-900/20', accent: 'text-amber-600 dark:text-amber-400', border: 'border-amber-200 dark:border-amber-800/40', iconBg: 'bg-amber-500', ring: 'ring-amber-200 dark:ring-amber-800' },
          { name: 'Lana Del Rey', genre: 'Indie', listeners: '35.1M', gradient: 'bg-sky-100 dark:bg-sky-900/20', accent: 'text-sky-600 dark:text-sky-400', border: 'border-sky-200 dark:border-sky-800/40', iconBg: 'bg-sky-500', ring: 'ring-sky-200 dark:ring-sky-800' },
          { name: 'Bad Bunny', genre: 'Reggaeton', listeners: '61.4M', gradient: 'bg-violet-100 dark:bg-violet-900/20', accent: 'text-violet-600 dark:text-violet-400', border: 'border-violet-200 dark:border-violet-800/40', iconBg: 'bg-violet-500', ring: 'ring-violet-200 dark:ring-violet-800' },
          { name: 'SZA', genre: 'R&B', listeners: '38.9M', gradient: 'bg-emerald-100 dark:bg-emerald-900/20', accent: 'text-emerald-600 dark:text-emerald-400', border: 'border-emerald-200 dark:border-emerald-800/40', iconBg: 'bg-emerald-500', ring: 'ring-emerald-200 dark:ring-emerald-800' },
          { name: 'Post Malone', genre: 'Pop/Rock', listeners: '44.3M', gradient: 'bg-orange-100 dark:bg-orange-900/20', accent: 'text-orange-600 dark:text-orange-400', border: 'border-orange-200 dark:border-orange-800/40', iconBg: 'bg-orange-500', ring: 'ring-orange-200 dark:ring-orange-800' },
        ].map((artist, i) => (
          <div key={i} className={`relative ${artist.gradient} border ${artist.border} rounded-2xl p-4 text-center hover:shadow-lg hover:-translate-y-1 transition-all duration-300 cursor-pointer group overflow-hidden`}>
            <svg className="absolute -top-3 -right-3 w-16 h-16 opacity-[0.07]" viewBox="0 0 100 100">
              <circle cx="70" cy="70" r="12" fill="currentColor"/>
              <line x1="82" y1="70" x2="82" y2="25" stroke="currentColor" strokeWidth="3"/>
              <circle cx="82" cy="25" r="6" fill="currentColor"/>
            </svg>
            <div className={`w-14 h-14 mx-auto rounded-full ${artist.iconBg} flex items-center justify-center ring-4 ${artist.ring} mb-3 group-hover:scale-110 transition-transform duration-300`}>
              <span className="text-white text-lg font-bold">{artist.name.charAt(0)}</span>
            </div>
            <h4 className={`text-sm font-bold ${artist.accent} truncate`}>{artist.name}</h4>
            <p className="text-[10px] text-slate-400 mt-0.5">{artist.genre}</p>
            <div className="mt-2 flex items-center justify-center gap-1">
              <Headphones className="w-3 h-3 text-slate-400" />
              <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">{artist.listeners}</span>
            </div>
            <button className={`mt-2.5 w-full py-1.5 rounded-xl text-[11px] font-semibold ${artist.accent} bg-white/60 dark:bg-white/5 border ${artist.border} hover:bg-white dark:hover:bg-white/10 transition-colors flex items-center justify-center gap-1`}>
              <Play className="w-3 h-3" /> Play
            </button>
          </div>
        ))}
      </div>

      {/* Row 1 — 3 Cards */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Live Radio Stations */}
        <div className="card p-0 overflow-hidden group">
          <div className="relative bg-rose-500 p-6">
            <svg className="absolute top-2 right-2 w-24 h-24 opacity-10" viewBox="0 0 100 100"><circle cx="50" cy="70" r="18" fill="currentColor"/><path d="M35 45 Q50 15 65 45" stroke="currentColor" strokeWidth="3" fill="none"/><path d="M25 50 Q50 5 75 50" stroke="currentColor" strokeWidth="3" fill="none"/><path d="M15 55 Q50 -5 85 55" stroke="currentColor" strokeWidth="3" fill="none"/></svg>
            <Radio className="w-8 h-8 text-white/80 mb-2" />
            <h3 className="text-lg font-bold text-white">Live Radio</h3>
            <p className="text-xs text-white/70">Streaming now</p>
          </div>
          <div className="p-4 space-y-3">
            {[
              { name: 'Chill Vibes FM', genre: 'Lo-Fi / Chill', listeners: '12.4K', color: 'bg-cyan-500' },
              { name: 'Rock Nation', genre: 'Rock / Alt', listeners: '8.7K', color: 'bg-orange-500' },
              { name: 'Jazz Lounge', genre: 'Jazz / Soul', listeners: '5.2K', color: 'bg-amber-500' },
              { name: 'EDM Central', genre: 'Electronic', listeners: '18.1K', color: 'bg-violet-500' },
            ].map((s, i) => (
              <div key={i} className="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700/30 cursor-pointer transition-colors">
                <div className={`w-10 h-10 rounded-xl ${s.color} flex items-center justify-center`}>
                  <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 truncate">{s.name}</p>
                  <p className="text-xs text-slate-400">{s.genre}</p>
                </div>
                <span className="text-[10px] text-slate-400 flex items-center gap-1"><Users className="w-3 h-3" />{s.listeners}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Music Mood Board */}
        <div className="card p-0 overflow-hidden">
          <div className="relative bg-primary-500 p-6">
            <svg className="absolute top-3 right-3 w-20 h-20 opacity-10" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" strokeWidth="2"/><circle cx="50" cy="50" r="25" fill="none" stroke="currentColor" strokeWidth="2"/><circle cx="50" cy="50" r="10" fill="currentColor"/><line x1="50" y1="10" x2="50" y2="25" stroke="currentColor" strokeWidth="2"/><line x1="50" y1="75" x2="50" y2="90" stroke="currentColor" strokeWidth="2"/><line x1="10" y1="50" x2="25" y2="50" stroke="currentColor" strokeWidth="2"/><line x1="75" y1="50" x2="90" y2="50" stroke="currentColor" strokeWidth="2"/></svg>
            <Sparkles className="w-8 h-8 text-white/80 mb-2" />
            <h3 className="text-lg font-bold text-white">Mood Board</h3>
            <p className="text-xs text-white/70">Pick your vibe</p>
          </div>
          <div className="p-4 grid grid-cols-2 gap-3">
            {[
              { mood: 'Energetic', emoji: '⚡', color: 'bg-yellow-400', songs: 342 },
              { mood: 'Relaxed', emoji: '🌊', color: 'bg-cyan-400', songs: 528 },
              { mood: 'Romantic', emoji: '💕', color: 'bg-pink-400', songs: 215 },
              { mood: 'Focus', emoji: '🎯', color: 'bg-emerald-400', songs: 189 },
              { mood: 'Melancholy', emoji: '🌧️', color: 'bg-slate-400', songs: 164 },
              { mood: 'Party', emoji: '🎉', color: 'bg-violet-400', songs: 478 },
            ].map((m, i) => (
              <div key={i} className={`${m.color} rounded-xl p-3 cursor-pointer hover:scale-105 transition-transform`}>
                <span className="text-xl">{m.emoji}</span>
                <p className="text-sm font-bold text-white mt-1">{m.mood}</p>
                <p className="text-[10px] text-white/70">{m.songs} songs</p>
              </div>
            ))}
          </div>
        </div>

        {/* Listening Milestones */}
        <div className="card p-0 overflow-hidden">
          <div className="relative bg-amber-500 p-6">
            <svg className="absolute top-3 right-3 w-20 h-20 opacity-10" viewBox="0 0 100 100"><polygon points="50,5 61,40 98,40 68,62 79,97 50,75 21,97 32,62 2,40 39,40" fill="currentColor"/></svg>
            <Award className="w-8 h-8 text-white/80 mb-2" />
            <h3 className="text-lg font-bold text-white">Milestones</h3>
            <p className="text-xs text-white/70">Your achievements</p>
          </div>
          <div className="p-4 space-y-3">
            {[
              { title: 'First 1,000 Songs', desc: 'Listened to 1,000 unique tracks', progress: 100, icon: '🏅' },
              { title: 'Genre Explorer', desc: 'Discovered 15+ genres', progress: 87, icon: '🧭' },
              { title: 'Night Owl', desc: '50 hours of late-night listening', progress: 64, icon: '🦉' },
              { title: 'Social Butterfly', desc: 'Shared 100 songs with friends', progress: 42, icon: '🦋' },
              { title: 'Vinyl Collector', desc: 'Saved 500 songs to library', progress: 76, icon: '💿' },
            ].map((m, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-xl shrink-0">{m.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 truncate">{m.title}</p>
                    <span className="text-xs font-bold text-primary-600 dark:text-primary-400 shrink-0">{m.progress}%</span>
                  </div>
                  <p className="text-[10px] text-slate-400 mb-1.5">{m.desc}</p>
                  <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div className="h-full bg-amber-400 rounded-full transition-all" style={{ width: `${m.progress}%` }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Row 2 — 2 Cards */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Artist Spotlight */}
        <div className="card p-0 overflow-hidden">
          <div className="relative">
            <div className="bg-primary-500 p-6 pb-16">
              <svg className="absolute top-0 left-0 w-full h-full opacity-5" viewBox="0 0 400 200"><circle cx="50" cy="100" r="80" fill="currentColor"/><circle cx="200" cy="50" r="60" fill="currentColor"/><circle cx="350" cy="120" r="70" fill="currentColor"/></svg>
              <div className="relative flex items-start justify-between">
                <div>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-white/20 rounded-full text-[10px] text-white font-medium mb-3"><Star className="w-3 h-3" /> Featured Artist</span>
                  <h3 className="text-2xl font-bold text-white">Aurora Waves</h3>
                  <p className="text-sm text-white/70 mt-1">Electronic / Ambient</p>
                </div>
                <div className="w-20 h-20 rounded-2xl bg-pink-400 flex items-center justify-center shadow-lg shadow-purple-500/30">
                  <Mic2 className="w-10 h-10 text-white" />
                </div>
              </div>
            </div>
            <div className="relative -mt-10 mx-5 bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-5">
              <div className="grid grid-cols-3 gap-4 text-center mb-4">
                <div>
                  <p className="text-lg font-bold text-slate-800 dark:text-white">2.4M</p>
                  <p className="text-[10px] text-slate-400">Monthly Listeners</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-slate-800 dark:text-white">186</p>
                  <p className="text-[10px] text-slate-400">Tracks</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-slate-800 dark:text-white">12</p>
                  <p className="text-[10px] text-slate-400">Albums</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button className="flex-1 py-2 bg-primary-500 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5 hover:shadow-lg hover:shadow-primary-500/30 transition-all"><Play className="w-4 h-4" /> Play All</button>
                <button className="px-4 py-2 border border-slate-200 dark:border-slate-600 rounded-xl text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex items-center gap-1.5"><Heart className="w-4 h-4" /> Follow</button>
                <button className="px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"><Share2 className="w-4 h-4 text-slate-500" /></button>
              </div>
            </div>
            <div className="p-5 pt-4">
              <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3">Popular Tracks</h4>
              <div className="space-y-2">
                {[
                  { title: 'Neon Dreams', plays: '48.2M', duration: '3:42' },
                  { title: 'Midnight Cascade', plays: '35.8M', duration: '4:15' },
                  { title: 'Electric Horizons', plays: '28.1M', duration: '3:58' },
                ].map((t, i) => (
                  <div key={i} className="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700/30 cursor-pointer transition-colors group">
                    <span className="w-5 text-xs font-bold text-slate-400 text-center">{i + 1}</span>
                    <div className="w-8 h-8 rounded-lg bg-primary-500 flex items-center justify-center">
                      <Play className="w-3 h-3 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 truncate">{t.title}</p>
                      <p className="text-[10px] text-slate-400">{t.plays} plays</p>
                    </div>
                    <span className="text-xs text-slate-400">{t.duration}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Podcast Picks & Music Events */}
        <div className="space-y-6">
          {/* Podcast Picks */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-emerald-500 flex items-center justify-center">
                  <Podcast className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 dark:text-slate-200">Podcast Picks</h3>
                  <p className="text-[10px] text-slate-400">Curated for you</p>
                </div>
              </div>
              <button className="text-xs text-primary-600 dark:text-primary-400 font-semibold flex items-center gap-0.5">See All <ChevronRight className="w-3 h-3" /></button>
            </div>
            <div className="space-y-3">
              {[
                { title: 'Sound & Vision', host: 'Maya Chen', ep: 'Ep. 142', dur: '45 min', color: 'bg-pink-500' },
                { title: 'The Producer\'s Desk', host: 'Alex Rivera', ep: 'Ep. 89', dur: '38 min', color: 'bg-primary-500' },
              ].map((p, i) => (
                <div key={i} className="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700/30 cursor-pointer transition-colors">
                  <div className={`w-12 h-12 rounded-xl ${p.color} flex items-center justify-center shrink-0`}>
                    <Mic2 className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 truncate">{p.title}</p>
                    <p className="text-xs text-slate-400">{p.host} · {p.ep}</p>
                  </div>
                  <span className="text-[10px] bg-slate-100 dark:bg-slate-700 text-slate-500 px-2 py-1 rounded-lg shrink-0">{p.dur}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Upcoming Music Events */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-rose-500 flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 dark:text-slate-200">Upcoming Events</h3>
                  <p className="text-[10px] text-slate-400">Don't miss out</p>
                </div>
              </div>
            </div>
            <div className="space-y-3">
              {[
                { name: 'Neon Fest 2026', date: 'Mar 28', loc: 'Los Angeles, CA', badge: 'Festival', badgeColor: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400' },
                { name: 'Aurora Waves Live', date: 'Apr 5', loc: 'Brooklyn, NY', badge: 'Concert', badgeColor: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400' },
              ].map((e, i) => (
                <div key={i} className="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700/30 cursor-pointer transition-colors">
                  <div className="w-12 h-14 rounded-xl bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 flex flex-col items-center justify-center shrink-0">
                    <p className="text-[10px] text-slate-400 uppercase leading-tight">{e.date.split(' ')[0]}</p>
                    <p className="text-lg font-bold text-slate-700 dark:text-slate-300 leading-tight">{e.date.split(' ')[1]}</p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 truncate">{e.name}</p>
                    <p className="text-xs text-slate-400 flex items-center gap-1"><Globe className="w-3 h-3" />{e.loc}</p>
                  </div>
                  <span className={`text-[10px] font-semibold px-2 py-1 rounded-lg shrink-0 ${e.badgeColor}`}>{e.badge}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Row 3 — 3 Cards */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Music Stats Summary */}
        <div className="card p-0 overflow-hidden">
          <div className="relative bg-cyan-500 p-6">
            <svg className="absolute top-3 right-3 w-20 h-20 opacity-10" viewBox="0 0 100 100"><rect x="10" y="60" width="12" height="30" rx="3" fill="currentColor"/><rect x="30" y="40" width="12" height="50" rx="3" fill="currentColor"/><rect x="50" y="20" width="12" height="70" rx="3" fill="currentColor"/><rect x="70" y="35" width="12" height="55" rx="3" fill="currentColor"/></svg>
            <TrendingUp className="w-8 h-8 text-white/80 mb-2" />
            <h3 className="text-lg font-bold text-white">Your Stats</h3>
            <p className="text-xs text-white/70">This month's summary</p>
          </div>
          <div className="p-4 space-y-4">
            {[
              { label: 'Hours Listened', value: '127.5', sub: '+18% from last month', color: 'text-cyan-600 dark:text-cyan-400' },
              { label: 'Songs Played', value: '1,842', sub: '+245 new discoveries', color: 'text-blue-600 dark:text-blue-400' },
              { label: 'Top Genre', value: 'Electronic', sub: '38% of total plays', color: 'text-indigo-600 dark:text-indigo-400' },
              { label: 'Avg. Per Day', value: '4.2 hrs', sub: 'Peak: Saturday 6.8 hrs', color: 'text-violet-600 dark:text-violet-400' },
            ].map((s, i) => (
              <div key={i} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-700/30">
                <div>
                  <p className="text-xs text-slate-400">{s.label}</p>
                  <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
                </div>
                <p className="text-[10px] text-slate-400 text-right max-w-[120px]">{s.sub}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Collaborative Playlists */}
        <div className="card p-0 overflow-hidden">
          <div className="relative bg-emerald-500 p-6">
            <svg className="absolute top-3 right-3 w-20 h-20 opacity-10" viewBox="0 0 100 100"><circle cx="35" cy="40" r="15" fill="currentColor"/><circle cx="65" cy="40" r="15" fill="currentColor"/><path d="M15 80 Q35 55 50 70 Q65 55 85 80" fill="currentColor"/></svg>
            <ListMusic className="w-8 h-8 text-white/80 mb-2" />
            <h3 className="text-lg font-bold text-white">Shared Playlists</h3>
            <p className="text-xs text-white/70">Collaborate with friends</p>
          </div>
          <div className="p-4 space-y-3">
            {[
              { name: 'Road Trip Anthems', members: 5, songs: 87, updated: '2h ago', colors: ['bg-blue-500', 'bg-pink-500', 'bg-amber-500'] },
              { name: 'Workout Boost', members: 3, songs: 142, updated: '1d ago', colors: ['bg-emerald-500', 'bg-violet-500', 'bg-red-500'] },
              { name: 'Late Night Coding', members: 8, songs: 234, updated: '3h ago', colors: ['bg-cyan-500', 'bg-indigo-500', 'bg-orange-500'] },
              { name: 'Sunday Chill', members: 4, songs: 65, updated: '5h ago', colors: ['bg-rose-500', 'bg-teal-500', 'bg-yellow-500'] },
            ].map((p, i) => (
              <div key={i} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700/30 cursor-pointer transition-colors">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                  <Music className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 truncate">{p.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <div className="flex -space-x-1.5">
                      {p.colors.map((c, j) => <div key={j} className={`w-4 h-4 rounded-full ${c} border-2 border-white dark:border-slate-800`} />)}
                    </div>
                    <span className="text-[10px] text-slate-400">{p.members} members · {p.songs} songs</span>
                  </div>
                </div>
                <span className="text-[10px] text-slate-400 shrink-0">{p.updated}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Sound Equalizer & Quick Controls */}
        <div className="card p-0 overflow-hidden">
          <div className="relative bg-slate-700 p-6">
            <svg className="absolute top-3 right-3 w-20 h-20 opacity-10" viewBox="0 0 100 100"><rect x="10" y="30" width="8" height="40" rx="4" fill="currentColor"><animate attributeName="height" values="40;60;30;50;40" dur="2s" repeatCount="indefinite"/><animate attributeName="y" values="30;20;35;25;30" dur="2s" repeatCount="indefinite"/></rect><rect x="25" y="20" width="8" height="60" rx="4" fill="currentColor"><animate attributeName="height" values="60;35;55;45;60" dur="2.2s" repeatCount="indefinite"/><animate attributeName="y" values="20;32;22;27;20" dur="2.2s" repeatCount="indefinite"/></rect><rect x="40" y="15" width="8" height="70" rx="4" fill="currentColor"><animate attributeName="height" values="70;40;65;50;70" dur="1.8s" repeatCount="indefinite"/><animate attributeName="y" values="15;30;17;25;15" dur="1.8s" repeatCount="indefinite"/></rect><rect x="55" y="25" width="8" height="50" rx="4" fill="currentColor"><animate attributeName="height" values="50;70;45;55;50" dur="2.5s" repeatCount="indefinite"/><animate attributeName="y" values="25;15;27;22;25" dur="2.5s" repeatCount="indefinite"/></rect><rect x="70" y="35" width="8" height="30" rx="4" fill="currentColor"><animate attributeName="height" values="30;55;40;35;30" dur="2.1s" repeatCount="indefinite"/><animate attributeName="y" values="35;22;30;32;35" dur="2.1s" repeatCount="indefinite"/></rect><rect x="85" y="28" width="8" height="44" rx="4" fill="currentColor"><animate attributeName="height" values="44;30;55;40;44" dur="1.9s" repeatCount="indefinite"/><animate attributeName="y" values="28;35;22;30;28" dur="1.9s" repeatCount="indefinite"/></rect></svg>
            <Volume2 className="w-8 h-8 text-white/80 mb-2" />
            <h3 className="text-lg font-bold text-white">Sound Lab</h3>
            <p className="text-xs text-white/70">Fine-tune your audio</p>
          </div>
          <div className="p-4">
            <div className="space-y-4 mb-4">
              {[
                { label: 'Bass', value: 72, color: 'bg-red-500' },
                { label: 'Mid', value: 55, color: 'bg-amber-500' },
                { label: 'Treble', value: 68, color: 'bg-cyan-500' },
                { label: 'Spatial', value: 45, color: 'bg-violet-500' },
              ].map((eq, i) => (
                <div key={i}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-slate-600 dark:text-slate-400">{eq.label}</span>
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{eq.value}%</span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div className={`h-full ${eq.color} rounded-full`} style={{ width: `${eq.value}%` }} />
                  </div>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Surround', icon: Headphones, active: true },
                { label: 'Bass Boost', icon: Zap, active: false },
                { label: 'Vocal', icon: Mic2, active: true },
                { label: 'Night Mode', icon: Clock, active: false },
              ].map((ctrl, i) => (
                <button key={i} className={`flex items-center gap-2 p-2.5 rounded-xl text-xs font-semibold transition-colors ${ctrl.active ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 border border-primary-200 dark:border-primary-800' : 'bg-slate-50 dark:bg-slate-700/30 text-slate-500 border border-slate-200 dark:border-slate-700'}`}>
                  <ctrl.icon className="w-4 h-4" />
                  {ctrl.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

    </div>
  )
}
