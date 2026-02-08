import { forwardRef, memo } from 'react'

import { Card } from '@repo/ui/components/card'

interface PlayerVideoCardProps {
  children?: React.ReactNode
}

/**
 * PlayerVideoCard - A composable layout component for video player cards
 *
 * This is a pure layout component that provides the card structure and styling.
 * The parent component is responsible for managing all state and passing children
 * for video elements, overlays, badges, and controls.
 *
 * The ref is forwarded to the video container div (relative min-h-0 flex-1 bg-black).
 *
 * Example usage:
 * ```tsx
 * <PlayerVideoCard ref={containerRef}>
 *   <video ref={videoRef} style={{...}} />
 *   <canvas ref={overlayRef} style={{...}} />
 *   <div className="absolute left-3 top-3">Player Name</div>
 *   <div className="absolute bottom-4 left-1/2">Controls</div>
 * </PlayerVideoCard>
 * ```
 */
export const PlayerVideoCard = memo(
  forwardRef<HTMLDivElement, PlayerVideoCardProps>(function PlayerVideoCard(
    { children },
    ref,
  ) {
    return (
      <Card className="border-surface-2 bg-surface-1 flex h-full flex-col overflow-hidden">
        <div ref={ref} className="relative min-h-0 flex-1 bg-black">
          {children}
        </div>
      </Card>
    )
  }),
)
