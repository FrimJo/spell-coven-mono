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
 * Example usage:
 * ```tsx
 * <PlayerVideoCard>
 *   <video ref={videoRef} style={{...}} />
 *   <canvas ref={overlayRef} style={{...}} />
 *   <div className="absolute left-3 top-3">Player Name</div>
 *   <div className="absolute bottom-4 left-1/2">Controls</div>
 * </PlayerVideoCard>
 * ```
 */
export function PlayerVideoCard({ children }: PlayerVideoCardProps) {
  return (
    <Card className="flex flex-col overflow-hidden border-slate-800 bg-slate-900">
      <div className="relative flex-1 bg-black">{children}</div>
    </Card>
  )
}
