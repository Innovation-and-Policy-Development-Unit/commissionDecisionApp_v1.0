import { useState, useEffect } from 'react'
import { Link, useSearchParams, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  Mic, Upload, CalendarDays, Headphones, Workflow,
} from 'lucide-react'
import PageHeader from '../../components/shared/PageHeader'
import LogitechGroupGuideDialog from '../../components/meeting/LogitechGroupGuideDialog'

const CARDS = [
  {
    key: 'logitech',
    icon: Headphones,
    color: 'from-blue-500 to-cyan-600',
    opensGuide: true,
  },
  {
    key: 'pipeline',
    icon: Workflow,
    path: '/secretariat/meeting-room/minutes-pipeline',
    color: 'from-purple-500 to-violet-600',
    queryMeeting: true,
  },
  {
    key: 'capture',
    icon: Upload,
    path: '/meetings/capture',
    color: 'from-primary-500 to-blue-700',
    queryMeeting: true,
  },
  {
    key: 'meetings',
    icon: CalendarDays,
    path: '/secretariat/meetings',
    color: 'from-emerald-500 to-teal-600',
  },
]

export default function MeetingRoomHub() {
  const { t } = useTranslation()
  const [searchParams] = useSearchParams()
  const location = useLocation()
  const meetingId = searchParams.get('meetingId')
  const q = meetingId ? `?meetingId=${meetingId}` : ''
  const [logitechOpen, setLogitechOpen] = useState(false)

  useEffect(() => {
    if (location.state?.openLogitechGuide) setLogitechOpen(true)
  }, [location.state])

  return (
    <div>
      <PageHeader
        title={t('meeting_room.hub_title')}
        subtitle={t('meeting_room.hub_subtitle')}
      />

      <p className="text-sm text-slate-600 dark:text-slate-400 mb-4 max-w-2xl">
        {t('meeting_room.hub_intro')}
      </p>
      <div className="mb-6 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 px-4 py-3 text-sm text-slate-700 dark:text-slate-300 max-w-3xl">
        <p className="font-semibold text-slate-900 dark:text-slate-100 mb-1">
          {t('meeting_room.hub_delegate_title')}
        </p>
        <p>{t('meeting_room.hub_delegate_body')}</p>
      </div>

      {meetingId && (
        <div className="mb-6 rounded-lg border border-primary-200 bg-primary-50 px-4 py-3 text-sm text-primary-800 dark:border-primary-800 dark:bg-primary-900/20 dark:text-primary-200">
          {t('meeting_room.hub_linked_meeting', { id: meetingId })}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {CARDS.map(card => {
          const Icon = card.icon
          const inner = (
            <>
              <div
                className={`w-12 h-12 rounded-xl bg-gradient-to-br ${card.color} flex items-center justify-center text-white mb-4 group-hover:scale-105 transition-transform`}
              >
                <Icon size={24} />
              </div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-1">
                {t(`meeting_room.hub_card_${card.key}_title`)}
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {t(`meeting_room.hub_card_${card.key}_desc`)}
              </p>
            </>
          )

          if (card.opensGuide) {
            return (
              <button
                key={card.key}
                type="button"
                onClick={() => setLogitechOpen(true)}
                className="card p-6 hover:shadow-lg transition-shadow group text-left w-full"
              >
                {inner}
              </button>
            )
          }

          const href = card.queryMeeting ? `${card.path}${q}` : card.path
          return (
            <Link
              key={card.key}
              to={href}
              className="card p-6 hover:shadow-lg transition-shadow group"
            >
              {inner}
            </Link>
          )
        })}
      </div>

      <div className="mt-8 card p-5 border-dashed">
        <div className="flex items-start gap-3">
          <Mic size={20} className="text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
              {t('meeting_room.hub_test_note_title')}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {t('meeting_room.hub_test_note_body')}
            </p>
          </div>
        </div>
      </div>

      <LogitechGroupGuideDialog open={logitechOpen} onClose={() => setLogitechOpen(false)} />
    </div>
  )
}
