import { Suspense } from 'react'
import { usePresence } from '@/contexts/PresenceContext'

import { Card } from '@repo/ui/components/card'
import { Skeleton } from '@repo/ui/components/skeleton'

import { CardPreview } from './CardPreview'
import { PlayerList } from './PlayerList'

interface GameRoomSidebarProps {
  roomId: string
  userId: string
  playerName: string
  isLobbyOwner: boolean
  ownerId: string | null
  onKickPlayer: (playerId: string) => void
  onBanPlayer: (playerId: string) => void
  mutedPlayers: Set<string>
  onToggleMutePlayer: (playerId: string) => void
}

function SidebarContent({
  playerName,
  isLobbyOwner,
  ownerId,
  onKickPlayer,
  onBanPlayer,
  mutedPlayers,
  onToggleMutePlayer,
}: GameRoomSidebarProps) {
  // Get game room participants from context (already deduplicated)
  const { uniqueParticipants } = usePresence()

  return (
    <div className="w-64 flex-shrink-0 space-y-4 overflow-y-auto">
      <PlayerList
        players={uniqueParticipants.map((participant) => ({
          id: participant.id,
          name: participant.username,
          isOnline: true, // Game room participants are always online
        }))}
        isLobbyOwner={isLobbyOwner}
        localPlayerName={playerName}
        onKickPlayer={onKickPlayer}
        onBanPlayer={onBanPlayer}
        ownerId={ownerId ?? undefined}
        mutedPlayers={mutedPlayers}
        onToggleMutePlayer={onToggleMutePlayer}
      />
      <CardPreview playerName={playerName} onClose={() => {}} />
    </div>
  )
}

function SidebarLoading() {
  return (
    <div className="w-64 flex-shrink-0 space-y-4">
      {/* Player List Skeleton */}
      <Card className="border-surface-2 bg-surface-1 p-4">
        <div className="space-y-3">
          {/* Header with "Players" and count */}
          <div className="mb-2 flex items-center justify-between">
            <Skeleton className="bg-surface-3/50 h-4 w-16" />
            <Skeleton className="bg-surface-3/50 h-3 w-8" />
          </div>

          {/* Player items - show generic loading state */}
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <div
                key={i}
                className="border-surface-2 bg-surface-2/50 flex items-center justify-between rounded-lg border p-2"
              >
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <Skeleton className="bg-surface-3/50 h-2 w-2 rounded-full" />
                  <Skeleton className="bg-surface-3/50 h-4 w-24" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>
    </div>
  )
}

export function GameRoomSidebar(props: GameRoomSidebarProps) {
  return (
    <Suspense fallback={<SidebarLoading />}>
      <SidebarContent {...props} />
    </Suspense>
  )
}
