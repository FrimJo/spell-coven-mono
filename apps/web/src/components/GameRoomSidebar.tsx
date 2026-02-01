import type { Participant } from '@/types/participant'
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { usePresence } from '@/contexts/PresenceContext'

import { Card } from '@repo/ui/components/card'
import { Skeleton } from '@repo/ui/components/skeleton'

import { CardPreview } from './CardPreview'
import { GameStatsPanel } from './GameStatsPanel'
import { PlayerList } from './PlayerList'

/**
 * Threshold for considering a player "online" (15 seconds)
 * If lastSeenAt is older than this, they're shown as disconnected.
 * This is shorter than the 30-second presence threshold that removes them from the list entirely.
 */
const ONLINE_THRESHOLD_MS = 15_000

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
  roomId,
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
  const { user } = useAuth()

  // State for commanders panel
  const [panelOpen, setPanelOpen] = useState(false)
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null)

  // Current time state for computing online status (updates every 5 seconds)
  const [now, setNow] = useState(Date.now())

  // Update current time periodically to re-evaluate online status
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now())
    }, 5_000) // Check every 5 seconds

    return () => clearInterval(interval)
  }, [])

  // Compute players with online status based on lastSeenAt
  const playersWithStatus = useMemo(() => {
    return uniqueParticipants.map((participant) => ({
      id: participant.id,
      name: participant.username,
      isOnline: now - participant.lastSeenAt < ONLINE_THRESHOLD_MS,
    }))
  }, [uniqueParticipants, now])

  // Find current user participant
  const currentUser = useMemo<Participant | null>(() => {
    if (!user) return null
    return uniqueParticipants.find((p) => p.id === user.id) ?? null
  }, [uniqueParticipants, user])

  // Find selected player participant
  const selectedPlayer = useMemo<Participant | undefined>(() => {
    if (!selectedPlayerId) return undefined
    return uniqueParticipants.find((p) => p.id === selectedPlayerId)
  }, [uniqueParticipants, selectedPlayerId])

  // Handler to open commanders panel for a player
  const handleViewCommanders = useCallback((playerId: string) => {
    setSelectedPlayerId(playerId)
    setPanelOpen(true)
  }, [])

  // Handler to close panel
  const handleClosePanel = useCallback(() => {
    setPanelOpen(false)
    setSelectedPlayerId(null)
  }, [])

  return (
    <>
      <div className="w-64 flex-shrink-0 space-y-4 overflow-y-auto">
        <PlayerList
          players={playersWithStatus}
          isLobbyOwner={isLobbyOwner}
          localPlayerName={playerName}
          onKickPlayer={onKickPlayer}
          onBanPlayer={onBanPlayer}
          ownerId={ownerId ?? undefined}
          mutedPlayers={mutedPlayers}
          onToggleMutePlayer={onToggleMutePlayer}
          onViewCommanders={handleViewCommanders}
        />
        <CardPreview playerName={playerName} onClose={() => {}} />
      </div>

      {/* Commanders Panel */}
      {currentUser && selectedPlayer && (
        <GameStatsPanel
          isOpen={panelOpen}
          onClose={handleClosePanel}
          roomId={roomId}
          currentUser={currentUser}
          participants={uniqueParticipants}
          selectedPlayer={selectedPlayer}
        />
      )}
    </>
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
