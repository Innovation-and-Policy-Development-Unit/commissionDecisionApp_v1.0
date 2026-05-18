import { useState, useMemo } from 'react'
import { Plus } from 'lucide-react'
import PageHeader from '../../components/shared/PageHeader'
import { initialKeys } from './apikeys/data'
import StatsRow from './apikeys/StatsRow'
import SecurityBanner from './apikeys/SecurityBanner'
import CreateKeyModal from './apikeys/CreateKeyModal'
import ApiKeysTable from './apikeys/ApiKeysTable'
import UsageStats from './apikeys/UsageStats'
import WebhooksSection from './apikeys/WebhooksSection'
import SdkQuickStart from './apikeys/SdkQuickStart'

export default function ApiKeys() {
  const [keys, setKeys] = useState(initialKeys)
  const [showCreate, setShowCreate] = useState(false)

  const { activeCount, totalCalls, mostActive } = useMemo(() => ({
    activeCount: keys.filter(k => k.status === 'Active').length,
    totalCalls:  keys.reduce((sum, k) => sum + k.calls, 0),
    mostActive:  [...keys].sort((a, b) => b.calls - a.calls)[0],
  }), [keys])

  const revokeKey = (id) =>
    setKeys(prev => prev.map(k => k.id === id ? { ...k, status: 'Revoked' } : k))

  const deleteKey = (id) =>
    setKeys(prev => prev.filter(k => k.id !== id))

  const createKey = ({ name, expiry, scopes }) => {
    const id = Date.now()
    const raw = `DEMO-KEY-${String(id).slice(-4)}-${'X'.repeat(24)}`
    setKeys(prev => [...prev, {
      id,
      name,
      key: raw,
      masked: `DEMO-KEY-${String(id).slice(-4)}-XXXX…XXXX`,
      lastUsed: 'Never',
      created: 'Mar 11, 2026',
      expires: expiry || 'Never',
      status: 'Active',
      scopes,
      calls: 0,
    }])
    setShowCreate(false)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="API Keys"
        subtitle="Manage API keys, monitor usage, and configure webhooks"
        action={
          <button onClick={() => setShowCreate(true)} className="btn-primary">
            <Plus size={16} />
            Create API Key
          </button>
        }
      />

      <StatsRow totalKeys={keys.length} activeCount={activeCount} totalCalls={totalCalls} />

      <SecurityBanner />

      <CreateKeyModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreate={createKey}
      />

      <ApiKeysTable
        keys={keys}
        activeCount={activeCount}
        onCreate={() => setShowCreate(true)}
        onRevoke={revokeKey}
        onDelete={deleteKey}
      />

      <UsageStats keys={keys} mostActive={mostActive} totalCalls={totalCalls} />

      <WebhooksSection />

      <SdkQuickStart />
    </div>
  )
}
