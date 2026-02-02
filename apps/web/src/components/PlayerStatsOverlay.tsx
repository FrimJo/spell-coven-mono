import type { Participant } from '@/types/participant'
import type { Doc } from '@convex/_generated/dataModel'
import { memo, useCallback, useMemo } from 'react'
import { useDeltaDisplay } from '@/hooks/useDeltaDisplay'
import { useHoldToRepeat } from '@/hooks/useHoldToRepeat'
import { api } from '@convex/_generated/api'
import { useMutation } from 'convex/react'
import { Heart, Minus, Plus, Skull, Swords } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@repo/ui/components/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@repo/ui/components/tooltip'

import { DeltaBubble } from './DeltaBubble'

interface PlayerStatsOverlayProps {
  roomId: string
  participant: Participant
  participants: Participant[]
}

export const PlayerStatsOverlay = memo(function PlayerStatsOverlay({
  roomId,
  participant,
  participants,
}: PlayerStatsOverlayProps) {
  // Use roomId as-is - roomPlayers table stores bare roomId (e.g., "ABC123")
  const convexRoomId = roomId

  // Helper function for optimistic updates on player queries
  type RoomPlayer = Doc<'roomPlayers'>

  const updatePlayerQueriesOptimistically = (
    localStore: Parameters<
      Parameters<
        ReturnType<
          typeof useMutation<typeof api.rooms.updatePlayerHealth>
        >['withOptimisticUpdate']
      >[0]
    >[0],
    roomId: string,
    userId: string,
    updater: (player: RoomPlayer) => RoomPlayer,
  ) => {
    const existingSessions = localStore.getQuery(
      api.players.listAllPlayerSessions,
      { roomId },
    )
    if (existingSessions !== undefined) {
      const nextSessions = existingSessions.map((session: RoomPlayer) =>
        session.userId === userId ? updater(session) : session,
      )
      localStore.setQuery(
        api.players.listAllPlayerSessions,
        { roomId },
        nextSessions,
      )
    }

    const activePlayers = localStore.getQuery(api.players.listActivePlayers, {
      roomId,
    })
    if (activePlayers !== undefined) {
      const nextActive = activePlayers.map((player: RoomPlayer) =>
        player.userId === userId ? updater(player) : player,
      )
      localStore.setQuery(api.players.listActivePlayers, { roomId }, nextActive)
    }
  }

  // Convex mutations with optimistic updates
  const updateHealth = useMutation(
    api.rooms.updatePlayerHealth,
  ).withOptimisticUpdate((localStore, args) => {
    updatePlayerQueriesOptimistically(
      localStore,
      args.roomId,
      args.userId,
      (player) => ({
        ...player,
        health: Math.max(0, (player.health ?? 0) + args.delta),
      }),
    )
  })

  const updatePoison = useMutation(
    api.rooms.updatePlayerPoison,
  ).withOptimisticUpdate((localStore, args) => {
    updatePlayerQueriesOptimistically(
      localStore,
      args.roomId,
      args.userId,
      (player) => ({
        ...player,
        poison: Math.max(0, (player.poison ?? 0) + args.delta),
      }),
    )
  })

  // Delta display hooks for health and poison
  const healthDelta = useDeltaDisplay()
  const poisonDelta = useDeltaDisplay()

  const handleHealthChange = useCallback(
    (delta: number) => {
      healthDelta.addDelta(delta)
      updateHealth({
        roomId: convexRoomId,
        userId: participant.id,
        delta,
      }).catch(() => {
        toast.error('Failed to update health')
      })
    },
    [updateHealth, convexRoomId, participant.id, healthDelta],
  )

  const handlePoisonChange = useCallback(
    (delta: number) => {
      poisonDelta.addDelta(delta)
      updatePoison({
        roomId: convexRoomId,
        userId: participant.id,
        delta,
      }).catch(() => {
        toast.error('Failed to update poison')
      })
    },
    [updatePoison, convexRoomId, participant.id, poisonDelta],
  )

  // Hold-to-repeat hooks for each button
  const healthMinus = useHoldToRepeat({
    onChange: handleHealthChange,
    immediateDelta: -1,
    repeatDelta: -10,
  })

  const healthPlus = useHoldToRepeat({
    onChange: handleHealthChange,
    immediateDelta: 1,
    repeatDelta: 10,
  })

  const poisonMinus = useHoldToRepeat({
    onChange: handlePoisonChange,
    immediateDelta: -1,
    repeatDelta: -10,
  })

  const poisonPlus = useHoldToRepeat({
    onChange: handlePoisonChange,
    immediateDelta: 1,
    repeatDelta: 10,
  })

  // Calculate total commander damage and breakdown - memoized to avoid recalculation
  const { totalCommanderDamage, commanderDamageBreakdown } = useMemo(() => {
    const damageMap = participant.commanderDamage ?? {}
    const total = Object.values(damageMap).reduce(
      (sum, damage) => sum + damage,
      0,
    )

    // Build breakdown: find commander names from participants
    const breakdown: Array<{
      commanderName: string
      ownerName: string
      damage: number
    }> = []

    for (const [key, damage] of Object.entries(damageMap)) {
      if (damage <= 0) continue

      // Key format: "ownerUserId:commanderId"
      const [ownerUserId, commanderId] = key.split(':')
      const owner = participants.find((p) => p.id === ownerUserId)
      const commander = owner?.commanders.find((c) => c.id === commanderId)

      breakdown.push({
        commanderName: commander?.name ?? 'Unknown Commander',
        ownerName: owner?.username ?? 'Unknown Player',
        damage,
      })
    }

    // Sort by damage descending
    breakdown.sort((a, b) => b.damage - a.damage)

    return { totalCommanderDamage: total, commanderDamageBreakdown: breakdown }
  }, [participant.commanderDamage, participants])

  // Clamp health and poison to 0 minimum for display
  const displayHealth = Math.max(0, participant.health ?? 0)
  const displayPoison = Math.max(0, participant.poison ?? 0)

  return (
    <>
      <div className="hover:border-surface-2 hover:bg-surface-0/90 group absolute left-3 top-3 z-10 flex flex-col gap-1.5 rounded-lg border border-transparent bg-transparent p-2 transition-all hover:backdrop-blur-sm">
        {/* Life */}
        <div className="flex items-center justify-between gap-3">
          <div className="text-destructive flex items-center gap-1.5">
            <Heart className="h-4 w-4" />
            <span className="min-w-[2ch] text-center font-mono font-bold text-white">
              {displayHealth}
            </span>
          </div>

          <div className="relative flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
            {healthDelta.delta < 0 && (
              <DeltaBubble
                delta={healthDelta.delta}
                visible={healthDelta.visible}
                side="left"
              />
            )}
            <Button
              size="icon"
              variant="ghost"
              className="text-text-muted hover:bg-destructive/20 hover:text-destructive h-6 w-6 rounded-md"
              onMouseDown={healthMinus.handleStart}
              onMouseUp={healthMinus.handleStop}
              onMouseLeave={healthMinus.handleStop}
              onTouchStart={healthMinus.handleStart}
              onTouchEnd={healthMinus.handleStop}
              disabled={displayHealth <= 0}
            >
              <Minus className="h-3 w-3" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="text-text-muted hover:bg-success/20 hover:text-success h-6 w-6 rounded-md"
              onMouseDown={healthPlus.handleStart}
              onMouseUp={healthPlus.handleStop}
              onMouseLeave={healthPlus.handleStop}
              onTouchStart={healthPlus.handleStart}
              onTouchEnd={healthPlus.handleStop}
            >
              <Plus className="h-3 w-3" />
            </Button>
            {healthDelta.delta > 0 && (
              <DeltaBubble
                delta={healthDelta.delta}
                visible={healthDelta.visible}
                side="right"
              />
            )}
          </div>
        </div>

        {/* Poison */}
        <div className="flex items-center justify-between gap-3">
          <div className="text-success flex items-center gap-1.5">
            <Skull className="h-4 w-4" />
            <span className="min-w-[2ch] text-center font-mono font-bold text-white">
              {displayPoison}
            </span>
          </div>

          <div className="relative flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
            {poisonDelta.delta < 0 && (
              <DeltaBubble
                delta={poisonDelta.delta}
                visible={poisonDelta.visible}
                side="left"
              />
            )}
            <Button
              size="icon"
              variant="ghost"
              className="text-text-muted hover:bg-destructive/20 hover:text-destructive h-6 w-6 rounded-md"
              onMouseDown={poisonMinus.handleStart}
              onMouseUp={poisonMinus.handleStop}
              onMouseLeave={poisonMinus.handleStop}
              onTouchStart={poisonMinus.handleStart}
              onTouchEnd={poisonMinus.handleStop}
              disabled={displayPoison <= 0}
            >
              <Minus className="h-3 w-3" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="text-text-muted hover:bg-success/20 hover:text-success h-6 w-6 rounded-md"
              onMouseDown={poisonPlus.handleStart}
              onMouseUp={poisonPlus.handleStop}
              onMouseLeave={poisonPlus.handleStop}
              onTouchStart={poisonPlus.handleStart}
              onTouchEnd={poisonPlus.handleStop}
            >
              <Plus className="h-3 w-3" />
            </Button>
            {poisonDelta.delta > 0 && (
              <DeltaBubble
                delta={poisonDelta.delta}
                visible={poisonDelta.visible}
                side="right"
              />
            )}
          </div>
        </div>

        {/* Commander Damage */}
        <div className="flex items-center justify-between gap-3">
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="text-brand-muted-foreground flex cursor-default items-center gap-1.5">
                <Swords className="h-4 w-4" />
                <span className="min-w-[2ch] text-center font-mono font-bold text-white">
                  {totalCommanderDamage}
                </span>
              </div>
            </TooltipTrigger>
            <TooltipContent
              side="right"
              className="border-surface-2 bg-surface-1 text-text-secondary max-w-[280px] border p-0 shadow-xl"
            >
              {commanderDamageBreakdown.length > 0 ? (
                <div className="flex flex-col gap-1 p-2">
                  {commanderDamageBreakdown.map((entry, idx) => (
                    <div
                      key={idx}
                      className="hover:bg-surface-2/50 flex items-center justify-between gap-3 rounded px-2 py-1.5"
                    >
                      <div className="flex flex-col">
                        <span className="text-text-secondary text-xs font-medium">
                          {entry.commanderName}
                        </span>
                        <span className="text-text-muted text-[10px]">
                          {entry.ownerName}
                        </span>
                      </div>
                      <span className="text-brand-muted-foreground font-mono text-sm font-bold">
                        {entry.damage}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="px-3 py-4 text-center">
                  <p className="text-text-muted text-xs">
                    No commander damage taken yet
                  </p>
                </div>
              )}
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </>
  )
})
