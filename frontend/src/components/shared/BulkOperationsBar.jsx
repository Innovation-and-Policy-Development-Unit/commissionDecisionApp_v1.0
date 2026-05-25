import React, { useState } from 'react'
import {
  Button,
  Text,
  Menu,
  MenuTrigger,
  MenuPopover,
  MenuList,
  MenuItem,
  Spinner,
} from '@fluentui/react-components'
import {
  DismissRegular,
  ChevronDownRegular,
  PersonAssignRegular,
  AlertUrgentRegular,
  ArrowExportRegular,
  BrainCircuitRegular,
} from '@fluentui/react-icons'

/**
 * BulkOperationsBar — appears when submissions are selected.
 * Props:
 *   selectedIds: number[]
 *   onClear: () => void
 *   onBulkAction: (action, extraData?) => Promise<void>
 */
export default function BulkOperationsBar({ selectedIds = [], onClear, onBulkAction }) {
  const [loading, setLoading] = useState(false)

  if (selectedIds.length === 0) return null

  const handle = async (action, extra = {}) => {
    setLoading(true)
    try {
      await onBulkAction(action, extra)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '10px 16px',
        background: 'var(--colorBrandBackground2)',
        borderRadius: '8px',
        border: '1px solid var(--colorBrandStroke1)',
        flexWrap: 'wrap',
      }}
    >
      <Text weight="semibold" size={300}>
        {selectedIds.length} selected
      </Text>

      {loading && <Spinner size="tiny" />}

      <Button
        size="small"
        icon={<AlertUrgentRegular />}
        appearance="subtle"
        onClick={() => handle('mark_urgent')}
        disabled={loading}
      >
        Mark Urgent
      </Button>

      <Button
        size="small"
        icon={<BrainCircuitRegular />}
        appearance="subtle"
        onClick={() => handle('run_ai_risk')}
        disabled={loading}
      >
        AI Risk Scan
      </Button>

      <Button
        size="small"
        icon={<ArrowExportRegular />}
        appearance="subtle"
        onClick={() => handle('export_list')}
        disabled={loading}
      >
        Export List
      </Button>

      <Button
        size="small"
        icon={<DismissRegular />}
        appearance="subtle"
        onClick={onClear}
        disabled={loading}
      >
        Clear
      </Button>
    </div>
  )
}
