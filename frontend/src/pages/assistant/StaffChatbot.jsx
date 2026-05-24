import { useTranslation } from 'react-i18next'
import PageHeader from '../../components/shared/PageHeader'
import StaffChatWidget from '../../components/assistant/StaffChatWidget'

export default function StaffChatbot() {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col h-[calc(100vh-7rem)] max-w-6xl mx-auto">
      <PageHeader title={t('staff_chat.title')} subtitle={t('staff_chat.subtitle')} />
      <div className="flex flex-1 min-h-0 mt-4">
        <StaffChatWidget variant="page" enabled showHistory />
      </div>
    </div>
  )
}
