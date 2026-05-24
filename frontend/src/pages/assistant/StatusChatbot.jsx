import { useTranslation } from 'react-i18next'
import PageHeader from '../../components/shared/PageHeader'
import StatusChatWidget from '../../components/assistant/StatusChatWidget'

export default function StatusChatbot() {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col h-[calc(100vh-7rem)] max-w-6xl mx-auto">
      <PageHeader title={t('status_chat.title')} subtitle={t('status_chat.subtitle')} />
      <p className="text-xs text-slate-500 dark:text-slate-400 -mt-2 mb-2">
        {t('status_chat.disclaimer')}
      </p>
      <div className="flex flex-1 min-h-0 mt-2">
        <StatusChatWidget variant="page" enabled showHistory />
      </div>
    </div>
  )
}
