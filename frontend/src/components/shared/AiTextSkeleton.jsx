import { Skeleton, SkeletonItem, Text } from '@fluentui/react-components'
import clsx from 'clsx'

/**
 * Inline text skeleton for AI-generated copy (agenda blurbs, drafts, etc.).
 */
export default function AiTextSkeleton({
  lines = 3,
  statusLabel = 'Generating…',
  className,
}) {
  return (
    <div
      className={clsx('space-y-2', className)}
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={statusLabel}
    >
      <Skeleton className="flex flex-col gap-1.5">
        {Array.from({ length: lines }, (_, i) => (
          <SkeletonItem
            key={i}
            size={12}
            style={{ width: `${Math.max(50, 100 - i * 10)}%` }}
          />
        ))}
      </Skeleton>
      {statusLabel && (
        <Text className="text-[10px] text-violet-600 dark:text-violet-400">
          {statusLabel}
        </Text>
      )}
    </div>
  )
}
