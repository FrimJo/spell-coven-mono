import { Suspense } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useSupabasePresence } from '@/hooks/useSupabasePresence'

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
}

function SidebarContent({
  roomId,
  userId,
  playerName,
  isLobbyOwner,
  ownerId,
  onKickPlayer,
  onBanPlayer,
}: GameRoomSidebarProps) {
  // Get current user info from auth context
  const { user } = useAuth()
  const username = user?.username ?? playerName

  // Get game room participants (use uniqueParticipants to avoid showing same user twice)
  const { uniqueParticipants } = useSupabasePresence({
    roomId,
    userId,
    username,
    avatar: user?.avatar,
    enabled: true,
  })

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
      />
      <CardPreview playerName={playerName} onClose={() => {}} />
    </div>
  )
}

function SidebarLoading({ roomId, userId }: GameRoomSidebarProps) {
  // Get current user info from auth context
  const { user } = useAuth()
  const username = user?.username ?? 'Unknown'

  // Get game room participants (use uniqueParticipants to avoid showing same user twice)
  const { uniqueParticipants } = useSupabasePresence({
    roomId,
    userId,
    username,
    avatar: user?.avatar,
    enabled: true,
  })

  // Create a user object for the skeleton
  const currentUser = user
    ? { id: user.id, username: user.username }
    : { id: 'loading', username: 'Loading...' }

  return (
    <div className="w-64 flex-shrink-0 space-y-4">
      {/* Player List Skeleton */}
      <Card className="border-slate-800 bg-slate-900 p-4">
        <div className="space-y-3">
          {/* Header with "Players" and count */}
          <div className="mb-2 flex items-center justify-between">
            <Skeleton className="h-4 w-16 bg-slate-700/50" />
            <Skeleton className="h-3 w-8 bg-slate-700/50" />
          </div>

          {/* Player items - show generic loading state */}
          <div className="space-y-2">
            {[currentUser, ...uniqueParticipants].map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-800/50 p-2"
              >
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <Skeleton className="h-2 w-2 rounded-full bg-slate-700/50" />
                  <Skeleton className="h-4 w-24 bg-slate-700/50" />
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
    <Suspense fallback={<SidebarLoading {...props} />}>
      <SidebarContent {...props} />
    </Suspense>
  )
}
