import { Field, Skeleton, SkeletonItem } from '@fluentui/react-components'
import clsx from 'clsx'

const VARIANTS = {
  input: () => <SkeletonItem size={32} />,
  textarea: (lines) =>
    Array.from({ length: lines }, (_, i) => (
      <SkeletonItem
        key={i}
        size={16}
        style={{ width: `${Math.max(55, 100 - i * 12)}%` }}
      />
    )),
  select: () => <SkeletonItem size={32} />,
}

/**
 * Fluent skeleton preset for async / AI-populated fields.
 * @param {'input'|'textarea'|'select'} variant
 */
export default function BaseFieldSkeleton({
  label,
  hint,
  variant = 'textarea',
  lines = 3,
  className,
  ariaLabel = 'Loading field content',
}) {
  const renderItems = VARIANTS[variant] || VARIANTS.textarea

  return (
    <Field className={clsx('w-full', className)} label={label} hint={hint}>
      <Skeleton aria-label={ariaLabel} className="flex flex-col gap-2">
        {renderItems(lines)}
      </Skeleton>
    </Field>
  )
}
