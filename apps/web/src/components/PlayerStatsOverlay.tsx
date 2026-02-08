import type { Participant } from '@/types/participant'
import type { Doc } from '@convex/_generated/dataModel'
import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import { useCommanderDamageDialog } from '@/contexts/CommanderDamageDialogContext'
import { useCommandersPanel } from '@/contexts/CommandersPanelContext'
import { useDeltaDisplay } from '@/hooks/useDeltaDisplay'
import { useHoldToRepeat } from '@/hooks/useHoldToRepeat'
import { getCommanderImageUrl } from '@/lib/scryfall'
import { api } from '@convex/_generated/api'
import { useMutation } from 'convex/react'
import { Heart, Minus, Plus, Skull, Swords, Users } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@repo/ui/components/button'
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from '@repo/ui/components/dialog'

import { DeltaBubble } from './DeltaBubble'

/** One row in the commander damage tooltip: image, name, owner, damage, +/- */
type CommanderDamageEntry = {
  ownerUserId: string
  commanderId: string
  commanderName: string
  ownerName: string
  isOwn: boolean
  damage: number
}

function CommanderDamageTooltipRow({
  entry,
  onDamageChange,
}: {
  entry: CommanderDamageEntry
  onDamageChange: (
    ownerUserId: string,
    commanderId: string,
    delta: number,
  ) => void
}) {
  const damageDelta = useDeltaDisplay()
  const handleChange = useCallback(
    (delta: number) => {
      damageDelta.addDelta(delta)
      onDamageChange(entry.ownerUserId, entry.commanderId, delta)
    },
    [entry.ownerUserId, entry.commanderId, onDamageChange, damageDelta],
  )
  const minus = useHoldToRepeat({
    onChange: handleChange,
    immediateDelta: -1,
    repeatDelta: -10,
  })
  const plus = useHoldToRepeat({
    onChange: handleChange,
    immediateDelta: 1,
    repeatDelta: 10,
  })
  const imageUrl = getCommanderImageUrl(entry.commanderId)

  return (
    <div className="hover:bg-surface-2/50 flex items-center gap-2 rounded px-2 py-1.5">
      <div className="border-border-muted relative h-8 w-8 shrink-0 overflow-hidden rounded border">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={entry.commanderName}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="bg-surface-2 text-text-muted flex h-full w-full items-center justify-center text-[10px] font-bold">
            {entry.commanderName.substring(0, 2)}
          </div>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="text-text-secondary block truncate text-xs font-medium">
          {entry.commanderName}
        </span>
        <span className="text-text-muted block truncate text-[10px]">
          {entry.ownerName}
          {entry.isOwn ? ' (you)' : ''}
        </span>
      </div>
      <div className="relative flex items-center gap-0.5">
        {damageDelta.delta < 0 && (
          <DeltaBubble
            delta={damageDelta.delta}
            visible={damageDelta.visible}
            side="left"
          />
        )}
        <Button
          size="icon"
          variant="ghost"
          className="text-text-muted hover:bg-destructive/20 hover:text-destructive h-6 w-6 shrink-0 rounded-md"
          onMouseDown={minus.handleStart}
          onMouseUp={minus.handleStop}
          onMouseLeave={minus.handleStop}
          onTouchStart={minus.handleStart}
          onTouchEnd={minus.handleStop}
          disabled={entry.damage <= 0}
        >
          <Minus className="h-3 w-3" />
        </Button>
        <span className="min-w-[2ch] text-center font-mono text-sm font-bold text-white">
          {entry.damage}
        </span>
        <Button
          size="icon"
          variant="ghost"
          className="text-text-muted hover:bg-success/20 hover:text-success h-6 w-6 shrink-0 rounded-md"
          onMouseDown={plus.handleStart}
          onMouseUp={plus.handleStop}
          onMouseLeave={plus.handleStop}
          onTouchStart={plus.handleStart}
          onTouchEnd={plus.handleStop}
        >
          <Plus className="h-3 w-3" />
        </Button>
        {damageDelta.delta > 0 && (
          <DeltaBubble
            delta={damageDelta.delta}
            visible={damageDelta.visible}
            side="right"
          />
        )}
      </div>
    </div>
  )
}

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

  const updateCommanderDamage = useMutation(
    api.rooms.updateCommanderDamage,
  ).withOptimisticUpdate((localStore, args) => {
    const damageKey = `${args.ownerUserId}:${args.commanderId}`
    updatePlayerQueriesOptimistically(
      localStore,
      args.roomId,
      args.userId,
      (player) => {
        const currentDamage = player.commanderDamage?.[damageKey] ?? 0
        const nextDamage = Math.max(0, currentDamage + args.delta)
        const actualDamageChange = nextDamage - currentDamage
        const nextHealth = (player.health ?? 0) - actualDamageChange
        return {
          ...player,
          health: nextHealth,
          commanderDamage: {
            ...(player.commanderDamage ?? {}),
            [damageKey]: nextDamage,
          },
        }
      },
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

  const handleCommanderDamageChange = useCallback(
    (ownerUserId: string, commanderId: string, delta: number) => {
      updateCommanderDamage({
        roomId: convexRoomId,
        userId: participant.id,
        ownerUserId,
        commanderId,
        delta,
      }).catch(() => {
        toast.error('Failed to update commander damage')
      })
    },
    [updateCommanderDamage, convexRoomId, participant.id],
  )

  // Commander damage shown is the highest from any single commander (21 from one = loss)
  const { displayedCommanderDamage, allCommandersList } = useMemo(() => {
    const damageMap = participant.commanderDamage ?? {}
    const values = Object.values(damageMap)
    const maxDamage = values.length > 0 ? Math.max(...values) : 0

    // Build list of all commanders that can deal damage to this player
    const list: CommanderDamageEntry[] = []
    for (const p of participants) {
      for (const commander of p.commanders ?? []) {
        if (!commander?.id || !commander?.name) continue
        const key = `${p.id}:${commander.id}`
        const damage = damageMap[key] ?? 0
        list.push({
          ownerUserId: p.id,
          commanderId: commander.id,
          commanderName: commander.name,
          ownerName: p.username ?? 'Unknown Player',
          isOwn: p.id === participant.id,
          damage,
        })
      }
    }
    // Sort by damage descending, then by owner name
    list.sort(
      (a, b) => b.damage - a.damage || a.ownerName.localeCompare(b.ownerName),
    )

    return { displayedCommanderDamage: maxDamage, allCommandersList: list }
  }, [participant.id, participant.commanderDamage, participants])

  // Clamp health and poison to 0 minimum for display
  const displayHealth = Math.max(0, participant.health ?? 0)
  const displayPoison = Math.max(0, participant.poison ?? 0)

  const commandersPanel = useCommandersPanel()
  const commanderDamageDialog = useCommanderDamageDialog()
  const [commanderDialogOpen, setCommanderDialogOpen] = useState(false)

  // Open dialog when requested from sidebar menu (e.g. "Damage taken")
  useEffect(() => {
    if (
      commanderDamageDialog &&
      commanderDamageDialog.openForPlayerId === participant.id
    ) {
      setCommanderDialogOpen(true)
      commanderDamageDialog.setOpenForPlayerId(null)
    }
  }, [commanderDamageDialog, participant.id])

  return (
    <>
      <div
        className="hover:border-surface-2 hover:bg-surface-0/90 group absolute left-3 top-3 z-10 flex flex-col gap-1.5 rounded-lg border border-transparent bg-transparent p-2 transition-all hover:backdrop-blur-sm"
        data-testid="player-stats-overlay"
      >
        {/* Life */}
        <div className="flex items-center justify-between gap-3">
          <div className="text-destructive flex min-w-[2.5rem] items-center gap-1.5">
            <Heart className="h-4 w-4 shrink-0" />
            <span className="min-w-[2ch] text-center font-mono font-bold text-white">
              {displayHealth}
            </span>
          </div>

          <div className="relative flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
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
            {healthDelta.delta !== 0 && (
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
          <div className="text-success flex min-w-[2.5rem] items-center gap-1.5">
            <Skull className="h-4 w-4 shrink-0" />
            <span className="min-w-[2ch] text-center font-mono font-bold text-white">
              {displayPoison}
            </span>
          </div>

          <div className="relative flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
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
            {poisonDelta.delta !== 0 && (
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
          <Dialog
            open={commanderDialogOpen}
            onOpenChange={(open) => {
              setCommanderDialogOpen(open)
              if (!open && commanderDamageDialog) {
                commanderDamageDialog.setOpenForPlayerId(null)
              }
            }}
          >
            <div className="text-brand-muted-foreground flex min-w-[2.5rem] items-center gap-1.5">
              <Swords className="h-4 w-4 shrink-0" />
              <span className="min-w-[2ch] text-center font-mono font-bold text-white">
                {displayedCommanderDamage}
              </span>
            </div>
            <div className="relative flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
              <DialogTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-text-muted hover:bg-brand/20 hover:text-brand h-6 gap-1 rounded-md px-2 text-xs"
                  aria-label="Edit commander damage"
                >
                  <span>DMG</span>
                </Button>
              </DialogTrigger>
            </div>
            <DialogContent className="border-surface-2 bg-surface-1 text-text-secondary w-[300px] max-w-[calc(100vw-2rem)] p-0">
              <DialogTitle className="sr-only">Commander damage</DialogTitle>
              <div className="flex flex-col">
                {/* Header */}
                <div className="border-surface-2/80 flex items-center gap-2 border-b px-3 py-2.5">
                  <div className="bg-brand/15 text-brand flex h-7 w-7 shrink-0 items-center justify-center rounded-md">
                    <Swords className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <p className="text-text-primary text-sm font-semibold">
                      Commander damage
                    </p>
                    <p className="text-text-muted text-[11px]">
                      Track combat damage dealt by commanders
                    </p>
                  </div>
                </div>

                {/* Commander list or empty state */}
                <div className="flex min-h-[44px] flex-col">
                  {allCommandersList.length > 0 ? (
                    <div className="flex max-h-[240px] flex-col gap-0.5 overflow-y-auto p-2 px-3">
                      {allCommandersList.map((entry) => (
                        <CommanderDamageTooltipRow
                          key={`${entry.ownerUserId}:${entry.commanderId}`}
                          entry={entry}
                          onDamageChange={handleCommanderDamageChange}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="text-text-muted flex min-h-[52px] flex-col items-center justify-center gap-3 px-4 py-4 text-center">
                      <div className="bg-surface-2/50 flex h-9 w-9 shrink-0 items-center justify-center rounded-full">
                        <Users className="h-4 w-4 opacity-60" />
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-text-secondary text-xs font-medium">
                          No commanders in this game yet
                        </p>
                        <p className="text-[11px] leading-relaxed">
                          Add commanders in the panel to start tracking damage.
                        </p>
                      </div>
                      {commandersPanel && (
                        <Button
                          variant="secondary"
                          size="sm"
                          className="h-8 gap-2 text-xs font-medium shadow-sm transition-all hover:shadow"
                          onClick={() => commandersPanel.openCommandersPanel()}
                        >
                          <Users className="h-3.5 w-3.5" />
                          Open commanders panel
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </>
  )
})
