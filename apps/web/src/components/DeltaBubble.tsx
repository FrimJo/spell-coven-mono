import { memo } from 'react'

import { cn } from '@repo/ui/lib/utils'

interface DeltaBubbleProps {
  /**
   * The delta value to display (e.g. +3 or -5)
   */
  delta: number
  /**
   * Whether the bubble is visible
   */
  visible: boolean
  /**
   * Placement side of the bubble: 'left' (for minus) or 'right' (for plus)
   */
  side: 'left' | 'right'
  /**
   * Optional additional className
   */
  className?: string
}

/**
 * Small popover-style bubble that shows the cumulative delta (+/-) next to
 * increment/decrement buttons. Fades out when not visible.
 */
export const DeltaBubble = memo(function DeltaBubble({
  delta,
  visible,
  side,
  className,
}: DeltaBubbleProps) {
  // Don't show if delta is 0 or not visible
  if (delta === 0 || !visible) return null

  // Only show - prefix for negative numbers, no + prefix for positive
  const label = delta < 0 ? `${delta}` : `${delta}`

  return (
    <span
      className={cn(
        'rounded bg-black/70 px-1 py-0.5 font-mono text-xs font-bold text-white pointer-events-none absolute z-20 transition-opacity duration-200 select-none',
        side === 'left' ? 'mr-1 right-full' : 'ml-1 left-full',
        className,
      )}
    >
      {label}
    </span>
  )
})
