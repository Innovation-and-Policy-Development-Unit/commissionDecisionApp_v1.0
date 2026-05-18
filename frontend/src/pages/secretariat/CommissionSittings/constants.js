import { Calendar, CalendarDays, CheckCircle2, ListChecks, AlertCircle, RefreshCw, XCircle } from 'lucide-react'

export const SITTING_STATUSES = {
  scheduled: {
    label: 'Scheduled',
    color: 'sky',
    icon: Calendar,
    bg: 'bg-sky-50 dark:bg-sky-900/20',
    text: 'text-sky-700 dark:text-sky-300',
    border: 'border-sky-200 dark:border-sky-800',
    calendarColor: '#0ea5e9', // Tailwind sky-500
  },
  in_progress: {
    label: 'In Progress',
    color: 'amber',
    icon: RefreshCw, // Will be imported in component
    bg: 'bg-amber-50 dark:bg-amber-900/20',
    text: 'text-amber-700 dark:text-amber-300',
    border: 'border-amber-200 dark:border-amber-800',
    calendarColor: '#f59e0b', // Tailwind amber-500
  },
  completed: {
    label: 'Completed',
    color: 'emerald',
    icon: CheckCircle2,
    bg: 'bg-emerald-50 dark:bg-emerald-900/20',
    text: 'text-emerald-700 dark:text-emerald-300',
    border: 'border-emerald-200 dark:border-emerald-800',
    calendarColor: '#10b981', // Tailwind emerald-500
  },
  cancelled: {
    label: 'Cancelled',
    color: 'red',
    icon: XCircle, // Will be imported in component
    bg: 'bg-red-50 dark:bg-red-900/20',
    text: 'text-red-700 dark:text-red-300',
    border: 'border-red-200 dark:border-red-800',
    calendarColor: '#ef4444', // Tailwind red-500
  },
  emergency: {
    label: 'Emergency',
    color: 'purple',
    icon: AlertCircle,
    bg: 'bg-purple-50 dark:bg-purple-900/20',
    text: 'text-purple-700 dark:text-purple-300',
    border: 'border-purple-200 dark:border-purple-800',
    calendarColor: '#a855f7', // Tailwind purple-500
  },
}

export const SITTING_TYPES = [
  { value: 'ordinary', label: 'Ordinary Sitting', color: 'slate' },
  { value: 'special',  label: 'Special Sitting',  color: 'violet' },
  { value: 'emergency', label: 'Emergency Sitting', color: 'purple' },
]

export const VENUES = [
  'PSC Boardroom, Kumul Highway, Port Vila',
  'PSC Boardroom, Luganville, Santo',
  'Government House Conference Room, Port Vila',
  'Other',
]
