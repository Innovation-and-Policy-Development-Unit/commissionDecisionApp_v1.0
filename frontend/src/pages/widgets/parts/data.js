import {
  Users, DollarSign, ShoppingCart, Activity, TrendingUp,
  Twitter, Youtube, Linkedin, Instagram,
  LayoutDashboard, FileBarChart, Settings, HelpCircle, CreditCard,
} from 'lucide-react'
import { img } from '../../../utils/imgPath'

export const sparkData = [
  [{ v: 10 }, { v: 25 }, { v: 18 }, { v: 35 }, { v: 28 }, { v: 42 }, { v: 38 }],
  [{ v: 45 }, { v: 30 }, { v: 55 }, { v: 40 }, { v: 65 }, { v: 50 }, { v: 70 }],
  [{ v: 80 }, { v: 60 }, { v: 75 }, { v: 55 }, { v: 70 }, { v: 85 }, { v: 90 }],
  [{ v: 20 }, { v: 35 }, { v: 25 }, { v: 45 }, { v: 38 }, { v: 55 }, { v: 48 }],
]

export const socialBarData = [
  [{ v: 30 }, { v: 45 }, { v: 38 }, { v: 55 }, { v: 48 }, { v: 60 }, { v: 52 }],
  [{ v: 50 }, { v: 65 }, { v: 58 }, { v: 72 }, { v: 66 }, { v: 80 }, { v: 74 }],
  [{ v: 20 }, { v: 35 }, { v: 28 }, { v: 42 }, { v: 38 }, { v: 50 }, { v: 45 }],
  [{ v: 15 }, { v: 28 }, { v: 22 }, { v: 35 }, { v: 30 }, { v: 42 }, { v: 38 }],
]

export const LAUNCH_DATE = new Date('2026-06-01T00:00:00')

export const gradientStats = [
  { label: 'Total Users',     value: '24,521', change: '+12%', up: true,  icon: Users,        color: 'bg-primary-500',  spark: sparkData[0] },
  { label: 'Revenue',         value: '$48,295', change: '+18%', up: true,  icon: DollarSign,   color: 'bg-emerald-500',  spark: sparkData[1] },
  { label: 'Orders',          value: '1,842',  change: '-3%',  up: false, icon: ShoppingCart, color: 'bg-amber-500',    spark: sparkData[2] },
  { label: 'Active Sessions', value: '328',    change: '+7%',  up: true,  icon: Activity,     color: 'bg-cyan-500',     spark: sparkData[3] },
]

export const lightStats = [
  { label: 'Page Views',     value: '128,430', change: '+9.4%', up: true,  icon: Activity,   bg: 'bg-primary-50 dark:bg-primary-900/20', iconBg: 'bg-primary-500', iconText: 'text-white', spark: sparkData[0], changeColor: 'text-emerald-600 dark:text-emerald-400' },
  { label: 'New Signups',    value: '3,210',   change: '+5.1%', up: true,  icon: Users,      bg: 'bg-cyan-50 dark:bg-cyan-900/20',       iconBg: 'bg-cyan-500',    iconText: 'text-white', spark: sparkData[1], changeColor: 'text-emerald-600 dark:text-emerald-400' },
  { label: 'Conversions',    value: '8.42%',   change: '+1.2%', up: true,  icon: TrendingUp, bg: 'bg-emerald-50 dark:bg-emerald-900/20', iconBg: 'bg-emerald-500', iconText: 'text-white', spark: sparkData[2], changeColor: 'text-emerald-600 dark:text-emerald-400' },
  { label: 'Avg. Order Val', value: '$94.30',  change: '-2.5%', up: false, icon: DollarSign, bg: 'bg-amber-50 dark:bg-amber-900/20',     iconBg: 'bg-amber-500',   iconText: 'text-white', spark: sparkData[3], changeColor: 'text-red-500 dark:text-red-400' },
]

export const socialStats = [
  { platform: 'Twitter',   handle: '@linerapp',  followers: '48.2k', today: '+142 today', color: 'bg-sky-500',  icon: Twitter,   textColor: 'text-sky-500',  bars: socialBarData[0] },
  { platform: 'Instagram', handle: '@liner.ui',  followers: '92.1k', today: '+380 today', color: 'bg-pink-500', icon: Instagram, textColor: 'text-pink-500', bars: socialBarData[1] },
  { platform: 'LinkedIn',  handle: 'Liner Inc.', followers: '12.4k', today: '+58 today',  color: 'bg-blue-700', icon: Linkedin,  textColor: 'text-blue-700', bars: socialBarData[2] },
  { platform: 'YouTube',   handle: 'LinerTV',    followers: '8.9k',  today: '+23 today',  color: 'bg-red-500',  icon: Youtube,   textColor: 'text-red-500',  bars: socialBarData[3] },
]

export const quickLinks = [
  { label: 'Dashboard', icon: LayoutDashboard, bg: 'bg-primary-100 dark:bg-primary-900/30', iconColor: 'text-primary-600 dark:text-primary-400' },
  { label: 'Reports',   icon: FileBarChart,    bg: 'bg-cyan-100 dark:bg-cyan-900/30',       iconColor: 'text-cyan-600 dark:text-cyan-400'       },
  { label: 'Users',     icon: Users,           bg: 'bg-violet-100 dark:bg-violet-900/30',   iconColor: 'text-violet-600 dark:text-violet-400'   },
  { label: 'Settings',  icon: Settings,        bg: 'bg-slate-100 dark:bg-slate-700',        iconColor: 'text-slate-600 dark:text-slate-400'     },
  { label: 'Support',   icon: HelpCircle,      bg: 'bg-emerald-100 dark:bg-emerald-900/30', iconColor: 'text-emerald-600 dark:text-emerald-400' },
  { label: 'Billing',   icon: CreditCard,      bg: 'bg-amber-100 dark:bg-amber-900/30',     iconColor: 'text-amber-600 dark:text-amber-400'     },
]

export const activities = [
  { dot: 'bg-primary-500', text: 'Jessica Lee signed up for the Pro plan',         time: '2 min ago',  img: img('/images/avatars/avatar-woman-jessica.jpg') },
  { dot: 'bg-emerald-500', text: 'Order #10482 was marked as delivered',           time: '14 min ago', img: img('/images/avatars/avatar-man-henry.jpg') },
  { dot: 'bg-amber-500',   text: 'Payment of $320.00 received from Marcus Webb',   time: '38 min ago', img: img('/images/avatars/avatar-man-marcus.jpg') },
  { dot: 'bg-cyan-500',    text: 'New support ticket #4921 opened by Sarah Kim',   time: '1 hr ago',   img: img('/images/avatars/avatar-woman-sarah-kim.jpg') },
  { dot: 'bg-rose-500',    text: 'Server latency alert triggered on eu-west-2',    time: '2 hr ago',   img: null },
  { dot: 'bg-violet-500',  text: 'Deployment to production completed successfully',time: '3 hr ago',   img: img('/images/avatars/avatar-man-daniel.jpg') },
]

export const forecast = [
  { day: 'Mon', icon: '☀️', hi: 74, lo: 63 },
  { day: 'Tue', icon: '⛅', hi: 71, lo: 61 },
  { day: 'Wed', icon: '🌧️', hi: 65, lo: 57 },
  { day: 'Thu', icon: '⛅', hi: 68, lo: 59 },
  { day: 'Fri', icon: '☀️', hi: 76, lo: 64 },
]

export const goals = [
  { name: 'Annual Revenue Target', current: 68, color: 'bg-primary-500' },
  { name: 'New User Acquisition',  current: 84, color: 'bg-cyan-500'    },
  { name: 'Support Ticket SLA',    current: 93, color: 'bg-emerald-500' },
  { name: 'Product Roadmap Items', current: 45, color: 'bg-amber-500'   },
]

export const skills = [
  { name: 'React & TypeScript', pct: 92, color: 'bg-primary-500'  },
  { name: 'Node.js / Express',  pct: 78, color: 'bg-cyan-500'     },
  { name: 'PostgreSQL',         pct: 65, color: 'bg-emerald-500'  },
  { name: 'DevOps / CI-CD',     pct: 55, color: 'bg-amber-500'    },
  { name: 'UI / UX Design',     pct: 80, color: 'bg-violet-500'   },
]

export const initialTodos = [
  { text: 'Review pull requests', done: true  },
  { text: 'Update dependencies',  done: true  },
  { text: 'Write unit tests',     done: false },
  { text: 'Deploy to staging',    done: false },
  { text: 'Update documentation', done: false },
  { text: 'Notify QA team',       done: false },
]

export function getTimeLeft() {
  const diff = LAUNCH_DATE - Date.now()
  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0 }
  return {
    days:    Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours:   Math.floor((diff / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((diff / (1000 * 60)) % 60),
    seconds: Math.floor((diff / 1000) % 60),
  }
}
