import type { CardHistoryEntry } from '@/types/card-query'
import type { Participant } from '@/types/participant'
import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useCardQueryContext } from '@/contexts/CardQueryContext'
import { usePresence } from '@/contexts/PresenceContext'
import { History, Trash2 } from 'lucide-react'

import { Button } from '@repo/ui/components/button'
import { Card } from '@repo/ui/components/card'
import { Skeleton } from '@repo/ui/components/skeleton'

import { CardPreview } from './CardPreview'
import { GameStatsPanel } from './GameStatsPanel'
import { PlayerList } from './PlayerList'

/**
 * Shared sidebar card component with header and content
 */
export function SidebarCard({
  icon: Icon,
  title,
  count,
  children,
  maxHeight,
  onScrollToTop,
  scrollTrigger,
  headerAction,
  countTestId,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  count: string | number
  children: React.ReactNode
  maxHeight?: string
  onScrollToTop?: boolean
  scrollTrigger?: number
  headerAction?: React.ReactNode
  countTestId?: string
}) {
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const prevScrollTriggerRef = useRef(scrollTrigger ?? 0)

  // Scroll to top when trigger changes (e.g., new item added)
  useEffect(() => {
    if (
      onScrollToTop &&
      scrollTrigger !== undefined &&
      scrollTrigger > prevScrollTriggerRef.current &&
      scrollContainerRef.current
    ) {
      scrollContainerRef.current.scrollTo({
        top: 0,
        behavior: 'smooth',
      })
    }
    if (scrollTrigger !== undefined) {
      prevScrollTriggerRef.current = scrollTrigger
    }
  }, [scrollTrigger, onScrollToTop])

  return (
    <Card className="border-surface-2 bg-surface-1 gap-0 overflow-hidden">
      <div className="border-surface-2 bg-surface-0/50 flex items-center justify-between border-b px-3 py-2">
        <div className="flex items-center gap-2">
          <Icon className="text-text-muted h-4 w-4" />
          <span className="text-text-secondary text-sm font-medium">
            {title}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-text-muted text-xs" data-testid={countTestId}>
            {count}
          </span>
          {headerAction}
        </div>
      </div>
      <div
        ref={scrollContainerRef}
        className={maxHeight ? `${maxHeight} overflow-y-auto` : ''}
      >
        {children}
      </div>
    </Card>
  )
}

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
  history: CardHistoryEntry[]
  onSelect: (entry: CardHistoryEntry) => void
  selectedCardId: string | null
  onClear: () => void
  onRemove: (entry: CardHistoryEntry) => void
}) {
  const hasHistory = history.length > 0

  return (
    <SidebarCard
      icon={History}
      title="Recent Cards"
      count={`(${history.length})`}
      maxHeight="max-h-[300px]"
      onScrollToTop
      scrollTrigger={history.length}
      headerAction={
        <Button
          variant="ghost"
          size="sm"
          onClick={onClear}
          disabled={!hasHistory}
          className="text-text-muted hover:text-destructive disabled:text-text-muted/50 h-5 w-5 p-0 disabled:cursor-not-allowed"
          title="Clear history"
        >
          <Trash2 className="h-3 w-3" />
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
                ? 'bg-surface-2 border-brand'
                : 'hover:bg-surface-2 border-transparent'
            }`}
          >
            <button
              type="button"
              onClick={() => onSelect(entry)}
              className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2 text-left"
            >
              {entry.image_url && (
                <img
                  src={entry.image_url}
                  alt=""
                  className="h-8 w-6 flex-shrink-0 rounded object-cover"
                />
              )}
              <div className="min-w-0 flex-1">
                <div className="text-text-primary truncate text-sm">
                  {entry.name}
                </div>
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
                onRemove(entry)
              }}
              className="text-text-muted hover:text-destructive h-8 w-8 flex-shrink-0 p-0 opacity-0 transition-opacity group-hover:opacity-100"
              title="Remove from list"
              aria-label={`Remove ${entry.name} from list`}
              data-testid={`recent-card-remove-${entry.id}`}
            >
              <Trash2 className="h-3.5 w-3.5" />
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
  const { uniqueParticipants, roomSeatCount, setRoomSeatCount } = usePresence()
  const { user } = useAuth()
  const {
    state,
    history,
    setResultWithoutHistory,
    clearResult,
    clearHistory,
    removeFromHistory,
  } = useCardQueryContext()

  // Determine the currently selected card ID for highlighting
  const selectedCardIdForHighlight = useMemo(() => {
    // Prefer state.result, fallback to history[0]
    const firstHistoryEntry = history[0]
    const displayResult =
      state.result ??
      (firstHistoryEntry && (state.status !== 'idle' || state.result != null)
        ? {
            name: firstHistoryEntry.name,
            set: firstHistoryEntry.set,
          }
        : null)

    if (!displayResult) return null

    // Match by name:set (same format as history entry id)
    return `${displayResult.name}:${displayResult.set}`
  }, [state.result, state.status, history])

  // State for commanders panel (same content for everyone; no selected player)
  const [panelOpen, setPanelOpen] = useState(false)

  // Handler to re-select a history entry (doesn't add to history)
  const handleHistorySelect = useCallback(
    (entry: CardHistoryEntry) => {
      setResultWithoutHistory({
        name: entry.name,
        set: entry.set,
        score: 1.0, // Re-selection = full confidence
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

  // Handler to open commanders panel (panel shows same list for everyone)
  const handleOpenCommanders = useCallback(() => {
    setPanelOpen(true)
  }, [])

  // Handler to close panel
  const handleClosePanel = useCallback(() => {
    setPanelOpen(false)
  }, [])

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
          currentUserId={user?.id ?? undefined}
          onViewCommanders={handleOpenCommanders}
          seatCount={roomSeatCount}
          onChangeSeatCount={isLobbyOwner ? handleChangeSeatCount : undefined}
        />
        <CardPreview onClose={clearResult} />
        <CardHistoryList
          history={history}
          onSelect={handleHistorySelect}
          selectedCardId={selectedCardIdForHighlight}
          onClear={clearHistory}
          onRemove={removeFromHistory}
        />
      </div>

      {/* Commanders Panel – same content for everyone; mount when open */}
      {currentUser && panelOpen && (
        <GameStatsPanel
          isOpen={panelOpen}
          onClose={handleClosePanel}
          roomId={roomId}
          currentUser={currentUser}
          participants={uniqueParticipants}
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
