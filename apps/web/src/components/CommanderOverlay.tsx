import type { Participant } from '@/types/participant'
import { memo, useMemo } from 'react'
import { useHoldToRepeat } from '@/hooks/useHoldToRepeat'
import { getCommanderImageUrl } from '@/lib/scryfall'
import { useMutation } from 'convex/react'
import { Minus, Plus } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@repo/ui/components/button'

import type { Doc } from '../../../convex/_generated/dataModel'
import { api } from '../../../convex/_generated/api'

interface CommanderOverlayProps {
  participant: Participant
  currentUser: Participant
  roomId: string
  gridIndex: number
}

export const CommanderOverlay = memo(function CommanderOverlay({
  participant,
  currentUser,
  roomId,
  gridIndex,
}: CommanderOverlayProps) {
  // Only show if the participant has commanders
  const hasCommanders =
    participant.commanders.length > 0 &&
    participant.commanders.some((c) => c?.name)

  if (!hasCommanders) return null

  // Determine position based on grid index to center the overlay in the grid
  // 0: TL -> Bottom Right
  // 1: TR -> Bottom Left
  // 2: BL -> Top Right
  // 3: BR -> Top Left
  const positionClasses = useMemo(() => {
    switch (gridIndex) {
      case 0: // Top Left
        return 'bottom-4 right-4 items-end'
      case 1: // Top Right
        return 'bottom-4 left-4 items-start'
      case 2: // Bottom Left
        return 'top-16 right-4 items-end'
      case 3: // Bottom Right
        return 'top-16 left-4 items-start'
      default:
        return 'bottom-4 right-4 items-end'
    }
  }, [gridIndex])

  // Convex mutation for updating commander damage
  // Replicating optimistic update logic from GameStatsPanel/PlayerStatsOverlay
  type RoomPlayer = Doc<'roomPlayers'>

  const updatePlayerQueriesOptimistically = (
    localStore: Parameters<
      Parameters<
        ReturnType<
          typeof useMutation<typeof api.rooms.updateCommanderDamage>
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

  const handleUpdateDamage = (
    ownerUserId: string,
    commanderId: string,
    delta: number,
  ) => {
    // We are updating the CURRENT USER's damage taken from the PARTICIPANT's commander
    // userId: currentUser.id (The one taking damage)
    // ownerUserId: participant.id (The one dealing damage via commander)
    // commanderId: commander.id
    updateCommanderDamage({
      roomId,
      userId: currentUser.id,
      ownerUserId,
      commanderId,
      delta,
    }).catch(() => {
      toast.error('Failed to update commander damage')
    })
  }

  return (
    <div className={`absolute z-10 flex flex-col gap-2 ${positionClasses}`}>
      {participant.commanders.map((commander, index) => {
        if (!commander?.name) return null
        return (
          <CommanderTile
            key={`${commander.id}-${index}`}
            commander={commander}
            participantId={participant.id}
            currentUser={currentUser}
            onUpdateDamage={handleUpdateDamage}
          />
        )
      })}
    </div>
  )
})

interface CommanderTileProps {
  commander: { id: string; name: string }
  participantId: string
  currentUser: Participant
  onUpdateDamage: (
    ownerUserId: string,
    commanderId: string,
    delta: number,
  ) => void
}

const CommanderTile = memo(function CommanderTile({
  commander,
  participantId,
  currentUser,
  onUpdateDamage,
}: CommanderTileProps) {
  const imageUrl = getCommanderImageUrl(commander.id)

  // Calculate damage this commander has dealt to the current user
  const damageKey = `${participantId}:${commander.id}`
  const damage = currentUser.commanderDamage?.[damageKey] ?? 0

  const damageMinus = useHoldToRepeat({
    onChange: (delta) => onUpdateDamage(participantId, commander.id, delta),
    immediateDelta: -1,
    repeatDelta: -10,
  })

  const damagePlus = useHoldToRepeat({
    onChange: (delta) => onUpdateDamage(participantId, commander.id, delta),
    immediateDelta: 1,
    repeatDelta: 10,
  })

  return (
    <div className="group relative h-12 w-12">
      {/* Commander Image/Card - Square */}
      <div className="border-border-muted group-hover:border-brand/50 relative h-12 w-12 overflow-hidden rounded-lg border-2 shadow-lg ring-1 ring-black/20 transition-transform group-hover:scale-105">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={commander.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="bg-surface-2 text-text-muted flex h-full w-full items-center justify-center text-xs font-bold">
            {commander.name.substring(0, 2)}
          </div>
        )}

        {/* Damage Number - Centered */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="font-mono text-sm font-bold text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
            {damage}
          </span>
        </div>

        {/* Minus Button - Left Half */}
        <Button
          size="icon"
          variant="ghost"
          className="absolute left-0 top-0 flex h-full w-1/2 items-center justify-center text-white opacity-0 transition-opacity group-hover:opacity-100"
          onMouseDown={damageMinus.handleStart}
          onMouseUp={damageMinus.handleStop}
          onMouseLeave={damageMinus.handleStop}
          onTouchStart={damageMinus.handleStart}
          onTouchEnd={damageMinus.handleStop}
          disabled={damage <= 0}
        >
          <Minus className="h-4 w-4 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]" />
        </Button>

        {/* Plus Button - Right Half */}
        <Button
          size="icon"
          variant="ghost"
          className="absolute right-0 top-0 flex h-full w-1/2 items-center justify-center text-white opacity-0 transition-opacity group-hover:opacity-100"
          onMouseDown={damagePlus.handleStart}
          onMouseUp={damagePlus.handleStop}
          onMouseLeave={damagePlus.handleStop}
          onTouchStart={damagePlus.handleStart}
          onTouchEnd={damagePlus.handleStop}
        >
          <Plus className="h-4 w-4 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]" />
        </Button>
      </div>
    </div>
  )
})
