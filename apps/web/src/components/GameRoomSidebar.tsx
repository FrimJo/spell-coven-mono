import type { CardSearchHistoryEntry } from '@/types/card-search'
import type { Participant } from '@/types/participant'
import {
  Activity,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useCardSearchContext } from '@/contexts/CardSearchContext'
import { useCommanderDamageDialog } from '@/contexts/CommanderDamageDialogContext'
import { usePresence } from '@/contexts/PresenceContext'
import { History, Trash2 } from 'lucide-react'

import { Button } from '@repo/ui/components/button'
import { Card } from '@repo/ui/components/card'
import { Skeleton } from '@repo/ui/components/skeleton'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@repo/ui/components/tooltip'

import { CardPreview } from './CardPreview'
import { GameStatsPanel } from './GameStatsPanel'
import { PlayerList } from './PlayerList'
import { SidebarCard } from './SidebarCard'

/**
 * Compact card history list component
 */
function CardHistoryList({
  history,
  onSelect,
  selectedCardId,
  onClear,
  onRemove,
}: {
  history: CardSearchHistoryEntry[]
  onSelect: (entry: CardSearchHistoryEntry) => void
  selectedCardId: string | null
  onClear: () => void
  onRemove: (entry: CardSearchHistoryEntry) => void
}) {
  const hasHistory = history.length > 0

  return (
    <SidebarCard
      icon={History}
      title="Recent Cards"
      count={`(${history.length})`}
      fillRemaining
      onScrollToTop
      scrollTrigger={history.length}
      headerAction={
        <Button
          variant="ghost"
          size="sm"
          onClick={onClear}
          disabled={!hasHistory}
          className="text-text-muted hover:text-destructive disabled:text-text-muted/50 size-5 p-0 disabled:cursor-not-allowed"
          title="Clear history"
        >
          <Trash2 className="size-3" />
        </Button>
      }
    >
      {history.map((entry) => {
        const isSelected = selectedCardId === entry.id
        return (
          <div
            key={`${entry.id}-${entry.timestamp}`}
            className={`group flex w-full items-center gap-2 border-l-2 transition-colors ${
              isSelected
                ? 'border-brand bg-surface-2 cursor-default'
                : `hover:bg-surface-2 cursor-pointer border-transparent`
            } `}
          >
            <button
              type="button"
              onClick={() => onSelect(entry)}
              className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2 text-left"
              aria-pressed={isSelected}
            >
              {entry.image_url && (
                <img
                  src={entry.image_url}
                  alt=""
                  className="h-8 w-6 shrink-0 rounded-sm object-cover"
                />
              )}
              <div className="min-w-0 flex-1">
                <Tooltip delayDuration={700}>
                  <TooltipTrigger asChild>
                    <span className="text-text-primary block truncate text-sm">
                      {entry.name}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    <p>{entry.name}</p>
                  </TooltipContent>
                </Tooltip>
                <div className="text-text-muted text-xs uppercase">
                  {entry.set}
                </div>
              </div>
            </button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation()
                e.preventDefault()
                onRemove(entry)
              }}
              onKeyDown={(e) => e.stopPropagation()}
              className="text-text-muted hover:text-destructive size-8 shrink-0 p-0 opacity-0 transition-opacity group-hover:opacity-100"
              title="Remove from list"
              aria-label={`Remove ${entry.name} from list`}
              data-testid={`recent-card-remove-${entry.id}`}
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        )
      })}
    </SidebarCard>
  )
}

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
  /** Controlled open state for the commanders panel */
  commandersPanelOpen: boolean
  /** Called when the commanders panel should open or close */
  onCommandersPanelOpenChange: (open: boolean) => void
  /** Called when user wants to copy the shareable game link */
  onCopyShareLink: () => void
  /** Called when user wants to reset game state (life, poison, commanders) */
  onResetGame?: () => void
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
  commandersPanelOpen: panelOpen,
  onCommandersPanelOpenChange: setPanelOpen,
  onCopyShareLink,
  onResetGame,
}: GameRoomSidebarProps) {
  // Get game room participants from context (already deduplicated)
  const { uniqueParticipants, roomSeatCount, setRoomSeatCount } = usePresence()
  const { user } = useAuth()
  const commanderDamageDialog = useCommanderDamageDialog()
  const {
    currentResult,
    history,
    setResultWithoutHistory,
    clearResult,
    clearHistory,
    removeFromHistory,
  } = useCardSearchContext()

  // Determine the currently selected card ID for highlighting
  const selectedCardIdForHighlight = useMemo(() => {
    if (!currentResult) return null

    // Match by name:set (same format as history entry id)
    return `${currentResult.name}:${currentResult.set}`
  }, [currentResult])

  // Handler to re-select a history entry (doesn't add to history)
  const handleHistorySelect = useCallback(
    (entry: CardSearchHistoryEntry) => {
      setResultWithoutHistory({
        name: entry.name,
        set: entry.set,
        scryfall_uri: entry.scryfall_uri,
        image_url: entry.image_url,
        card_url: entry.card_url,
      })
    },
    [setResultWithoutHistory],
  )

  // Current time state for computing online status (updates every 5 seconds)
  const [now, setNow] = useState(() => Date.now())

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

  // Handler to close panel
  const handleClosePanel = useCallback(() => {
    setPanelOpen(false)
  }, [setPanelOpen])

  // Handler to change seat count
  const handleChangeSeatCount = useCallback(
    (delta: number) => {
      const newCount = Math.max(
        uniqueParticipants.length,
        Math.min(4, roomSeatCount + delta),
      )
      if (newCount !== roomSeatCount) {
        setRoomSeatCount(newCount).catch((err) => {
          console.error('[GameRoomSidebar] Failed to set seat count:', err)
        })
      }
    },
    [roomSeatCount, uniqueParticipants.length, setRoomSeatCount],
  )

  return (
    <>
      <div className="flex h-full w-64 shrink-0 flex-col gap-4">
        <div className="shrink-0">
          <PlayerList
            players={playersWithStatus}
            isLobbyOwner={isLobbyOwner}
            localPlayerName={playerName}
            onKickPlayer={onKickPlayer}
            onBanPlayer={onBanPlayer}
            ownerId={ownerId ?? undefined}
            mutedPlayers={mutedPlayers}
            onToggleMutePlayer={onToggleMutePlayer}
            currentUserId={user?.id ?? undefined}
            onOpenCommanderDamage={commanderDamageDialog?.setOpenForPlayerId}
            seatCount={roomSeatCount}
            onChangeSeatCount={isLobbyOwner ? handleChangeSeatCount : undefined}
            onCopyShareLink={onCopyShareLink}
            onResetGame={onResetGame}
          />
        </div>
        <div className="shrink-0">
          <CardPreview onClose={clearResult} />
        </div>
        <div className="flex min-h-0 flex-1 flex-col">
          <CardHistoryList
            history={history}
            onSelect={handleHistorySelect}
            selectedCardId={selectedCardIdForHighlight}
            onClear={clearHistory}
            onRemove={removeFromHistory}
          />
        </div>
      </div>

      {/* Commanders Panel – kept mounted via Activity for smooth slide animation */}
      {currentUser && (
        <Activity mode={panelOpen ? 'visible' : 'hidden'}>
          <GameStatsPanel
            isOpen={panelOpen}
            onClose={handleClosePanel}
            roomId={roomId}
            currentUser={currentUser}
            participants={uniqueParticipants}
          />
        </Activity>
      )}
    </>
  )
}

function SidebarLoading() {
  return (
    <div className="w-64 shrink-0 space-y-4">
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
                  <Skeleton className="bg-surface-3/50 size-2 rounded-full" />
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
