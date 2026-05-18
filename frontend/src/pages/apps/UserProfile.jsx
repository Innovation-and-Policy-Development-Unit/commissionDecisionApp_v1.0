import { useState } from 'react'
import PageHeader from '../../components/shared/PageHeader'
import {
  MapPin, Link2, Twitter, Github, Linkedin, Edit, Camera, Star, Heart, Eye,
  MessageSquare, UserPlus, Briefcase, GraduationCap, Calendar, Award, TrendingUp,
  Globe, Mail, Phone, Clock, CheckCircle2, Bookmark, Share2, MoreHorizontal,
  ThumbsUp, MessageCircle, Repeat2, Code2, Palette, Zap, Shield, Crown,
  ArrowUpRight, Users, FileText, FolderOpen, GitBranch, Coffee
} from 'lucide-react'
import { img } from '../../utils/imgPath'

const tabs = ['Profile', 'Followers', 'Friends', 'Gallery']

const skills = [
  { name: 'React', level: 95 },
  { name: 'TypeScript', level: 90 },
  { name: 'Node.js', level: 85 },
  { name: 'Tailwind CSS', level: 92 },
  { name: 'PostgreSQL', level: 78 },
  { name: 'Docker', level: 72 },
  { name: 'GraphQL', level: 80 },
  { name: 'AWS', level: 75 },
  { name: 'Python', level: 68 },
  { name: 'Figma', level: 70 },
]

const activity = [
  { action: 'Completed project', detail: 'Dashboard redesign for Acme Corp', time: '2 hours ago', color: 'bg-emerald-500', icon: CheckCircle2 },
  { action: 'Published article', detail: 'Building Scalable React Applications', time: '5 hours ago', color: 'bg-primary-500', icon: FileText },
  { action: 'Merged pull request', detail: '#142 — Dark mode improvements', time: '1 day ago', color: 'bg-cyan-500', icon: GitBranch },
  { action: 'Created milestone', detail: 'Q2 Product Launch — 12 tasks added', time: '2 days ago', color: 'bg-amber-500', icon: Award },
  { action: 'Reviewed code for', detail: 'Feature: real-time notifications', time: '3 days ago', color: 'bg-violet-500', icon: Code2 },
  { action: 'Joined team', detail: 'Design Systems Working Group', time: '4 days ago', color: 'bg-rose-500', icon: Users },
  { action: 'Deployed to production', detail: 'v2.4.0 — Performance optimizations', time: '5 days ago', color: 'bg-teal-500', icon: Zap },
]

const followers = [
  { name: 'Alice Chen', role: 'Frontend Developer', avatar: img('/images/avatars/avatar-woman-alice.jpg'), following: true, mutuals: 12 },
  { name: 'Bob Martinez', role: 'Backend Developer', avatar: img('/images/avatars/avatar-man-bob.jpg'), following: false, mutuals: 8 },
  { name: 'Carol Johnson', role: 'UX Designer', avatar: img('/images/avatars/avatar-woman-carol-white.jpg'), following: true, mutuals: 15 },
  { name: 'David Kim', role: 'DevOps Engineer', avatar: img('/images/avatars/avatar-man-david.jpg'), following: true, mutuals: 6 },
  { name: 'Eva Williams', role: 'Product Manager', avatar: img('/images/avatars/avatar-woman-eva.jpg'), following: false, mutuals: 22 },
  { name: 'Frank Brown', role: 'QA Engineer', avatar: img('/images/avatars/avatar-man-frank.jpg'), following: false, mutuals: 4 },
  { name: 'Grace Lee', role: 'Data Scientist', avatar: img('/images/avatars/avatar-woman-grace.jpg'), following: true, mutuals: 18 },
  { name: 'Henry Davis', role: 'Marketing Lead', avatar: img('/images/avatars/avatar-man-henry.jpg'), following: false, mutuals: 9 },
  { name: 'Irene Scott', role: 'Mobile Developer', avatar: img('/images/avatars/avatar-woman-sarah-kim.jpg'), following: true, mutuals: 11 },
  { name: 'James Wilson', role: 'Tech Lead', avatar: img('/images/avatars/avatar-man-ryan.jpg'), following: true, mutuals: 25 },
  { name: 'Karen White', role: 'UI Designer', avatar: img('/images/avatars/avatar-woman-rachel.jpg'), following: false, mutuals: 7 },
  { name: 'Leo Turner', role: 'Full Stack Dev', avatar: img('/images/avatars/avatar-man-oliver.jpg'), following: false, mutuals: 14 },
]

const gallery = [
  { image: img('/images/unsplash/analytics-dashboard.jpg'), label: 'Project Dashboard', likes: 142, comments: 28 },
  { image: img('/images/unsplash/mobile-app-ui.jpg'), label: 'Mobile App UI', likes: 98, comments: 15 },
  { image: img('/images/unsplash/brand-identity-design.jpg'), label: 'Brand Identity', likes: 234, comments: 42 },
  { image: img('/images/unsplash/marketing-mobile-app.jpg'), label: 'Marketing Campaign', likes: 176, comments: 31 },
  { image: img('/images/unsplash/website-redesign.jpg'), label: 'Website Redesign', likes: 312, comments: 56 },
  { image: img('/images/unsplash/design-system-ui.jpg'), label: 'Design System', likes: 89, comments: 12 },
  { image: img('/images/unsplash/app-wireframes.jpg'), label: 'App Wireframes', likes: 156, comments: 23 },
  { image: img('/images/unsplash/tech-company-logo.jpg'), label: 'Icon Collection', likes: 201, comments: 38 },
  { image: img('/images/unsplash/annual-report-design.jpg'), label: 'Annual Report', likes: 67, comments: 8 },
  { image: img('/images/unsplash/coding-laptop.jpg'), label: 'Code Workshop', likes: 445, comments: 72 },
  { image: img('/images/unsplash/ui-components-screen.jpg'), label: 'UI Components', likes: 128, comments: 19 },
  { image: img('/images/unsplash/color-palette-art.jpg'), label: 'Color Palette', likes: 93, comments: 11 },
]

const posts = [
  {
    title: 'Building Scalable React Applications in 2024',
    excerpt: 'A deep dive into modern React patterns, performance optimization techniques, and architectural decisions that make your apps scale effortlessly.',
    image: img('/images/unsplash/react-code.jpg'),
    date: 'Mar 8, 2026',
    readTime: '8 min read',
    likes: 342,
    comments: 56,
    shares: 128,
    tags: ['React', 'Architecture', 'Performance'],
  },
  {
    title: 'The Complete Guide to Design Tokens',
    excerpt: 'How design tokens bridge the gap between design and development, creating a single source of truth for your entire design system.',
    image: img('/images/unsplash/brand-identity-design.jpg'),
    date: 'Feb 22, 2026',
    readTime: '12 min read',
    likes: 218,
    comments: 34,
    shares: 87,
    tags: ['Design Systems', 'CSS', 'Tokens'],
  },
  {
    title: 'From Monolith to Micro-Frontends',
    excerpt: 'Our journey migrating a large-scale application to micro-frontends, the challenges we faced, and lessons learned along the way.',
    image: img('/images/unsplash/developer-coding.jpg'),
    date: 'Feb 10, 2026',
    readTime: '15 min read',
    likes: 567,
    comments: 89,
    shares: 234,
    tags: ['Micro-Frontends', 'Architecture', 'Migration'],
  },
]

const experience = [
  { company: 'TechCorp Inc.', role: 'Senior Frontend Developer', period: 'Jan 2023 — Present', logo: img('/images/unsplash/tech-company-logo.jpg'), current: true },
  { company: 'DesignStudio', role: 'Frontend Developer', period: 'Jun 2020 — Dec 2022', logo: img('/images/unsplash/design-studio-office.jpg'), current: false },
  { company: 'WebAgency', role: 'Junior Developer', period: 'Mar 2018 — May 2020', logo: img('/images/unsplash/office-building.jpg'), current: false },
]

const education = [
  { school: 'Stanford University', degree: 'M.S. Computer Science', period: '2016 — 2018', logo: img('/images/unsplash/stanford-university.jpg') },
  { school: 'UC Berkeley', degree: 'B.S. Computer Science', period: '2012 — 2016', logo: img('/images/unsplash/university-campus.jpg') },
]

const projects = [
  { name: 'Liner Dashboard', description: 'Premium admin template with 40+ pages', stars: 1240, forks: 328, lang: 'React', color: 'bg-cyan-400' },
  { name: 'FormKit Pro', description: 'Advanced form validation library', stars: 876, forks: 145, lang: 'TypeScript', color: 'bg-blue-500' },
  { name: 'StyleForge', description: 'CSS-in-JS solution for design systems', stars: 2100, forks: 512, lang: 'JavaScript', color: 'bg-amber-400' },
  { name: 'DataViz', description: 'Interactive chart components for React', stars: 634, forks: 98, lang: 'React', color: 'bg-emerald-400' },
]

export default function UserProfile() {
  const [activeTab, setActiveTab] = useState('Profile')
  const [followStates, setFollowStates] = useState(followers.map(f => f.following))

  return (
    <div className="space-y-6">
      <PageHeader title="User Profile" subtitle="Manage your profile and settings" />

      {/* Cover & Avatar */}
      <div className="card overflow-hidden">
        <div className="h-56 sm:h-64 relative group">
          <img
            src={img('/images/unsplash/beach-ocean.jpg')}
            alt="Cover"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
          <button className="absolute bottom-3 end-3 px-3 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 backdrop-blur-sm flex items-center gap-1.5 text-white text-xs font-medium transition-colors opacity-0 group-hover:opacity-100">
            <Camera size={14} /> Change Cover
          </button>
          {/* Premium Badge */}
          <div className="absolute top-4 end-4 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/90 backdrop-blur-sm text-white text-xs font-semibold">
            <Crown size={14} /> PRO Member
          </div>
        </div>
        <div className="px-6 pb-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4 -mt-16">
            <div className="relative group">
              <img
                src={img('/images/avatars/avatar-man-john.jpg')}
                alt="John Doe"
                className="w-28 h-28 rounded-2xl object-cover border-4 border-white dark:border-slate-800 shadow-lg"
              />
              <button className="absolute bottom-1 end-1 w-8 h-8 rounded-full bg-primary-500 flex items-center justify-center text-white border-2 border-white dark:border-slate-800 opacity-0 group-hover:opacity-100 transition-opacity">
                <Camera size={14} />
              </button>
              <span className="absolute top-1 end-1 w-4 h-4 bg-emerald-500 border-2 border-white dark:border-slate-800 rounded-full" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">John Doe</h2>
                <CheckCircle2 size={18} className="text-primary-500" />
              </div>
              <p className="text-slate-500 dark:text-slate-400 text-sm">Senior Frontend Developer at TechCorp Inc.</p>
              <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-slate-500">
                <span className="flex items-center gap-1"><MapPin size={12} /> San Francisco, CA</span>
                <span className="flex items-center gap-1"><Globe size={12} /> johndoe.dev</span>
                <span className="flex items-center gap-1"><Calendar size={12} /> Joined Jan 2020</span>
                <span className="flex items-center gap-1"><Coffee size={12} /> Open for freelance</span>
              </div>
            </div>
            <div className="flex gap-2 sm:mb-2">
              <button className="btn btn-sm btn-outline"><Share2 size={14} /></button>
              <button className="btn btn-sm btn-outline"><MessageSquare size={14} /> Message</button>
              <button className="btn btn-sm btn-primary"><Edit size={14} /> Edit Profile</button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-200 dark:border-slate-700">
            {[
              { label: 'Following', value: '248', icon: Users, change: '+12 this month' },
              { label: 'Followers', value: '12.4k', icon: Heart, change: '+340 this month' },
              { label: 'Projects', value: '32', icon: FolderOpen, change: '4 active' },
              { label: 'Articles', value: '57', icon: FileText, change: '3 this month' },
            ].map((s, i) => (
              <div key={i} className="text-center p-3 rounded-xl bg-slate-50 dark:bg-slate-700/50">
                <s.icon size={18} className="mx-auto text-primary-500 dark:text-primary-400 mb-1" />
                <p className="font-bold text-lg text-slate-800 dark:text-slate-200">{s.value}</p>
                <p className="text-xs text-slate-500">{s.label}</p>
                <p className="text-[10px] text-emerald-500 mt-0.5">{s.change}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 rounded-xl p-1">
        {tabs.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all ${
              activeTab === tab
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'Profile' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* About */}
            <div className="card p-6">
              <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-3">About</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed mb-3">
                Passionate frontend developer with 8+ years of experience building scalable web applications
                and design systems. Specializing in React, TypeScript, and modern CSS. I love creating intuitive
                user interfaces that delight users and contributing to open source projects.
              </p>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Currently leading the frontend architecture at TechCorp, where I mentor a team of 6 developers
                and drive our migration to a micro-frontend architecture. When I'm not coding, you'll find me
                hiking trails in the Bay Area, experimenting with film photography, or speaking at tech conferences.
              </p>
              <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-slate-100 dark:border-slate-700">
                <div className="flex items-center gap-2 text-sm">
                  <Mail size={14} className="text-slate-400" />
                  <span className="text-slate-600 dark:text-slate-400">john@techcorp.com</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Phone size={14} className="text-slate-400" />
                  <span className="text-slate-600 dark:text-slate-400">+1 (555) 123-4567</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Globe size={14} className="text-slate-400" />
                  <span className="text-slate-600 dark:text-slate-400">johndoe.dev</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Clock size={14} className="text-slate-400" />
                  <span className="text-slate-600 dark:text-slate-400">UTC-8 (PST)</span>
                </div>
              </div>
            </div>

            {/* Blog Posts */}
            <div className="card p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-slate-800 dark:text-slate-200">Recent Articles</h3>
                <button className="text-xs text-primary-600 dark:text-primary-400 font-medium hover:underline">View All</button>
              </div>
              <div className="space-y-5">
                {posts.map((post, i) => (
                  <div key={i} className="group cursor-pointer">
                    <div className="flex gap-4">
                      <img src={post.image} alt={post.title} className="w-32 h-24 sm:w-40 sm:h-28 rounded-xl object-cover shrink-0" />
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-slate-800 dark:text-slate-200 text-sm group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors line-clamp-2">{post.title}</h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2 hidden sm:block">{post.excerpt}</p>
                        <div className="flex flex-wrap items-center gap-2 mt-2">
                          <span className="text-[10px] text-slate-400">{post.date}</span>
                          <span className="text-[10px] text-slate-300 dark:text-slate-600">·</span>
                          <span className="text-[10px] text-slate-400">{post.readTime}</span>
                        </div>
                        <div className="flex items-center gap-3 mt-2">
                          <span className="flex items-center gap-1 text-[11px] text-slate-400"><ThumbsUp size={11} /> {post.likes}</span>
                          <span className="flex items-center gap-1 text-[11px] text-slate-400"><MessageCircle size={11} /> {post.comments}</span>
                          <span className="flex items-center gap-1 text-[11px] text-slate-400"><Repeat2 size={11} /> {post.shares}</span>
                        </div>
                      </div>
                    </div>
                    {i < posts.length - 1 && <hr className="mt-5 border-slate-100 dark:border-slate-700" />}
                  </div>
                ))}
              </div>
            </div>

            {/* Skills */}
            <div className="card p-6">
              <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-4">Skills & Expertise</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                {skills.map(skill => (
                  <div key={skill.name}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-slate-700 dark:text-slate-300 font-medium">{skill.name}</span>
                      <span className="text-xs text-slate-400">{skill.level}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary-500 rounded-full transition-all duration-500"
                        style={{ width: `${skill.level}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Open Source Projects */}
            <div className="card p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-slate-800 dark:text-slate-200">Open Source Projects</h3>
                <button className="text-xs text-primary-600 dark:text-primary-400 font-medium hover:underline flex items-center gap-1">
                  View on GitHub <ArrowUpRight size={12} />
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {projects.map((p, i) => (
                  <div key={i} className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-primary-300 dark:hover:border-primary-700 transition-colors cursor-pointer group">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${p.color}`} />
                        <h4 className="font-semibold text-sm text-slate-800 dark:text-slate-200 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">{p.name}</h4>
                      </div>
                      <Bookmark size={14} className="text-slate-300 dark:text-slate-600" />
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">{p.description}</p>
                    <div className="flex items-center gap-4 text-xs text-slate-400">
                      <span className="flex items-center gap-1"><Star size={12} className="text-amber-400" /> {p.stars.toLocaleString()}</span>
                      <span className="flex items-center gap-1"><GitBranch size={12} /> {p.forks}</span>
                      <span className="flex items-center gap-1"><span className={`w-2 h-2 rounded-full ${p.color}`} /> {p.lang}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Activity */}
            <div className="card p-6">
              <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-4">Recent Activity</h3>
              <div className="space-y-0">
                {activity.map((a, i) => (
                  <div key={i} className="flex gap-3">
                    <div className="relative flex flex-col items-center">
                      <div className={`w-8 h-8 rounded-lg ${a.color} flex items-center justify-center shrink-0`}>
                        <a.icon size={14} className="text-white" />
                      </div>
                      {i < activity.length - 1 && <div className="w-px flex-1 bg-slate-200 dark:bg-slate-700 my-1" />}
                    </div>
                    <div className="pb-5">
                      <p className="text-sm text-slate-700 dark:text-slate-300">
                        {a.action}{' '}
                        <span className="font-semibold text-slate-800 dark:text-slate-200">{a.detail}</span>
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">{a.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Social Links */}
            <div className="card p-6">
              <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-4">Social Links</h3>
              <div className="space-y-3">
                {[
                  { icon: Twitter, label: '@johndoe', value: '4.2k followers', color: 'text-sky-500 bg-sky-50 dark:bg-sky-900/20' },
                  { icon: Github, label: 'johndoe', value: '1.8k stars', color: 'text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700' },
                  { icon: Linkedin, label: 'John Doe', value: '500+ connections', color: 'text-blue-600 bg-blue-50 dark:bg-blue-900/20' },
                  { icon: Globe, label: 'johndoe.dev', value: '10k monthly visitors', color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20' },
                ].map((s, i) => (
                  <div key={i} className="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer group">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${s.color}`}>
                      <s.icon size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm text-slate-700 dark:text-slate-300 font-medium">{s.label}</span>
                      <p className="text-[11px] text-slate-400">{s.value}</p>
                    </div>
                    <ArrowUpRight size={14} className="text-slate-300 dark:text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                ))}
              </div>
            </div>

            {/* Experience */}
            <div className="card p-6">
              <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2"><Briefcase size={16} /> Experience</h3>
              <div className="space-y-4">
                {experience.map((e, i) => (
                  <div key={i} className="flex gap-3">
                    <img src={e.logo} alt={e.company} className="w-10 h-10 rounded-lg object-cover shrink-0" />
                    <div>
                      <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200">{e.role}</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{e.company}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1">
                        {e.period}
                        {e.current && <span className="ml-1 px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-[10px] font-medium">Current</span>}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Education */}
            <div className="card p-6">
              <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2"><GraduationCap size={16} /> Education</h3>
              <div className="space-y-4">
                {education.map((e, i) => (
                  <div key={i} className="flex gap-3">
                    <img src={e.logo} alt={e.school} className="w-10 h-10 rounded-lg object-cover shrink-0" />
                    <div>
                      <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200">{e.degree}</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{e.school}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">{e.period}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Stats */}
            <div className="card p-6">
              <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2"><TrendingUp size={16} /> Stats</h3>
              <div className="space-y-3">
                {[
                  { label: 'Profile Views', value: '42,850', icon: Eye, color: 'text-primary-500', change: '+18%' },
                  { label: 'Post Likes', value: '9,824', icon: Heart, color: 'text-rose-500', change: '+24%' },
                  { label: 'Star Rating', value: '4.9 / 5.0', icon: Star, color: 'text-amber-500', change: '' },
                  { label: 'Reputation', value: 'Top 2%', icon: Shield, color: 'text-emerald-500', change: '' },
                ].map((s, i) => (
                  <div key={i} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-700/30">
                    <div className="flex items-center gap-2.5">
                      <s.icon size={16} className={s.color} />
                      <span className="text-sm text-slate-600 dark:text-slate-400">{s.label}</span>
                    </div>
                    <div className="text-end">
                      <span className="font-semibold text-sm text-slate-800 dark:text-slate-200">{s.value}</span>
                      {s.change && <p className="text-[10px] text-emerald-500">{s.change}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Achievements */}
            <div className="card p-6">
              <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2"><Award size={16} /> Achievements</h3>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { icon: '🏆', label: 'Top Dev', desc: '2025' },
                  { icon: '🔥', label: '100 Streak', desc: 'Commits' },
                  { icon: '⭐', label: '1k Stars', desc: 'GitHub' },
                  { icon: '🎯', label: 'Mentor', desc: 'Level 3' },
                  { icon: '💎', label: 'Diamond', desc: 'Member' },
                  { icon: '🚀', label: 'Pioneer', desc: 'Early' },
                ].map((a, i) => (
                  <div key={i} className="text-center p-2.5 rounded-xl bg-slate-50 dark:bg-slate-700/30 hover:bg-primary-50 dark:hover:bg-primary-900/10 transition-colors cursor-pointer">
                    <span className="text-xl">{a.icon}</span>
                    <p className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 mt-1">{a.label}</p>
                    <p className="text-[10px] text-slate-400">{a.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'Followers' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {followers.map((f, i) => (
            <div key={i} className="card p-5 text-center group hover:shadow-card-lg transition-shadow">
              <div className="relative inline-block mb-3">
                <img src={f.avatar} alt={f.name} className="w-20 h-20 rounded-full object-cover mx-auto" />
                <span className="absolute bottom-0 end-0 w-4 h-4 bg-emerald-500 border-2 border-white dark:border-slate-800 rounded-full" />
              </div>
              <h4 className="font-semibold text-slate-800 dark:text-slate-200 text-sm">{f.name}</h4>
              <p className="text-xs text-slate-500 mt-0.5">{f.role}</p>
              <p className="text-[11px] text-slate-400 mt-1">{f.mutuals} mutual connections</p>
              <button
                onClick={() => setFollowStates(s => s.map((v, j) => j === i ? !v : v))}
                className={`btn btn-sm w-full mt-3 ${followStates[i] ? 'btn-secondary' : 'btn-primary'}`}
              >
                {followStates[i] ? 'Following' : <><UserPlus size={12} /> Follow</>}
              </button>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'Friends' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {followers.filter((_, i) => followStates[i]).map((f, i) => (
            <div key={i} className="card p-4 flex items-center gap-4 hover:shadow-card-lg transition-shadow">
              <img src={f.avatar} alt={f.name} className="w-14 h-14 rounded-full object-cover shrink-0" />
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-slate-800 dark:text-slate-200 text-sm truncate">{f.name}</h4>
                <p className="text-xs text-slate-500">{f.role}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">{f.mutuals} mutual connections</p>
              </div>
              <div className="flex flex-col gap-1.5">
                <button className="btn btn-sm btn-outline"><MessageSquare size={12} /></button>
                <button className="btn btn-sm btn-outline text-slate-400"><MoreHorizontal size={12} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'Gallery' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {gallery.map((item, i) => (
            <div key={i} className="group relative rounded-2xl overflow-hidden cursor-pointer">
              <img src={item.image} alt={item.label} className="w-full aspect-square object-cover group-hover:scale-110 transition-transform duration-300" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="absolute inset-x-0 bottom-0 p-3 translate-y-full group-hover:translate-y-0 transition-transform duration-300">
                <p className="text-white text-xs font-semibold">{item.label}</p>
                <div className="flex items-center gap-3 mt-1">
                  <span className="flex items-center gap-1 text-[11px] text-white/80"><Heart size={11} /> {item.likes}</span>
                  <span className="flex items-center gap-1 text-[11px] text-white/80"><MessageCircle size={11} /> {item.comments}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
