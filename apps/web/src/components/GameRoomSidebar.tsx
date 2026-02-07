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
import { Dices, History, Trash2 } from 'lucide-react'
import { useMutation, useQuery } from 'convex/react'
import { toast } from 'sonner'

import { Button } from '@repo/ui/components/button'
import { Card } from '@repo/ui/components/card'
import { Input } from '@repo/ui/components/input'
import { Skeleton } from '@repo/ui/components/skeleton'
import { cn } from '@repo/ui/lib/utils'

import { api } from '@convex/_generated/api'

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
}: {
  history: CardHistoryEntry[]
  onSelect: (entry: CardHistoryEntry) => void
  selectedCardId: string | null
  onClear: () => void
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
          <button
            key={`${entry.id}-${entry.timestamp}`}
            onClick={() => onSelect(entry)}
            className={`flex w-full items-center gap-2 px-3 py-2 text-left transition-colors ${
              isSelected
                ? 'bg-surface-2 border-brand border-l-2'
                : 'hover:bg-surface-2'
            }`}
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
const DICE_PRESETS = [4, 6, 8, 10, 12, 20, 100]
const DEFAULT_SIDES = 20
const DEFAULT_COUNT = 1

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
  const { state, history, setResultWithoutHistory, clearResult, clearHistory } =
    useCardQueryContext()
  const diceHistory = useQuery(api.dice.listRoomDiceRolls, { roomId })
  const rollDice = useMutation(api.dice.rollDice)

  const [sides, setSides] = useState(DEFAULT_SIDES)
  const [count, setCount] = useState(DEFAULT_COUNT)

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

  // State for commanders panel
  const [panelOpen, setPanelOpen] = useState(false)
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null)

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

  const handleRollDice = useCallback(async () => {
    const safeSides = Math.max(2, Math.min(1000, Math.floor(sides)))
    const safeCount = Math.max(1, Math.min(20, Math.floor(count)))

    setSides(safeSides)
    setCount(safeCount)

    try {
      await rollDice({ roomId, sides: safeSides, count: safeCount })
    } catch (error) {
      console.error('[GameRoomSidebar] Failed to roll dice:', error)
      toast.error('Failed to roll dice')
    }
  }, [count, roomId, rollDice, sides])

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
          seatCount={roomSeatCount}
          onChangeSeatCount={isLobbyOwner ? handleChangeSeatCount : undefined}
        />
        <CardPreview onClose={clearResult} />
        <CardHistoryList
          history={history}
          onSelect={handleHistorySelect}
          selectedCardId={selectedCardIdForHighlight}
          onClear={clearHistory}
        />
        <SidebarCard
          icon={Dices}
          title="Dice Roller"
          count={`(${diceHistory?.length ?? 0})`}
        >
          <div className="space-y-3 p-3">
            <div className="grid grid-cols-3 gap-2">
              {DICE_PRESETS.map((preset) => (
                <Button
                  key={preset}
                  variant="outline"
                  size="sm"
                  type="button"
                  className={cn(
                    'h-8 px-2 text-xs',
                    preset === sides && 'border-brand text-brand',
                  )}
                  onClick={() => setSides(preset)}
                >
                  d{preset}
                </Button>
              ))}
            </div>
            <div className="flex gap-2">
              <div className="flex-1 space-y-1">
                <label className="text-text-muted text-xs">Sides</label>
                <Input
                  type="number"
                  min={2}
                  max={1000}
                  value={sides}
                  onChange={(event) =>
                    setSides(Number(event.target.value) || DEFAULT_SIDES)
                  }
                />
              </div>
              <div className="flex-1 space-y-1">
                <label className="text-text-muted text-xs">Count</label>
                <Input
                  type="number"
                  min={1}
                  max={20}
                  value={count}
                  onChange={(event) =>
                    setCount(Number(event.target.value) || DEFAULT_COUNT)
                  }
                />
              </div>
            </div>
            <Button className="w-full" onClick={handleRollDice}>
              Roll Dice
            </Button>
          </div>
          <div className="border-surface-2 max-h-44 overflow-y-auto border-t">
            {diceHistory?.length ? (
              diceHistory.map((roll) => (
                <div
                  key={roll._id}
                  className="border-surface-2 space-y-1 border-b px-3 py-2 text-xs last:border-b-0"
                >
                  <div className="text-text-secondary">
                    <span className="font-medium">{roll.username}</span> rolled{' '}
                    {roll.count}d{roll.sides}
                  </div>
                  <div className="text-text-muted">
                    [{roll.results.join(', ')}] = {roll.total}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-text-muted px-3 py-4 text-xs">
                No rolls yet.
              </div>
            )}
          </div>
        </SidebarCard>
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
