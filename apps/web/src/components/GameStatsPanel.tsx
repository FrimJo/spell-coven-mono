import type { ScryfallCard } from '@/lib/scryfall'
import type { Participant } from '@/types/participant'
import { useEffect, useEffectEvent, useState } from 'react'
import { useHoldToRepeat } from '@/hooks/useHoldToRepeat'
import { getCommanderImageUrl } from '@/lib/scryfall'
import { commanderPanelMachine } from '@/state/commanderPanelMachine'
import { useMutation } from '@tanstack/react-query'
import { useMachine } from '@xstate/react'
import { useMutation as useConvexMutation } from 'convex/react'
import {
  AlertCircle,
  Check,
  ChevronDown,
  ChevronUp,
  Loader2,
  Pencil,
  Plus,
  Swords,
  User,
  UserCircle,
} from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@repo/ui/components/button'
import { ScrollArea } from '@repo/ui/components/scroll-area'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@repo/ui/components/sheet'

import type { Doc } from '../../../convex/_generated/dataModel'
import { api } from '../../../convex/_generated/api'
import { CommanderSearchInput } from './CommanderSearchInput'

/** Maximum players in a Commander game */
const MAX_PLAYERS = 4

interface GameStatsPanelProps {
  isOpen: boolean
  onClose: () => void
  roomId: string
  currentUser: Participant
  participants: Participant[]
  /** @deprecated - no longer used in slot-based design */
  defaultTab?: 'damage' | 'setup'
  /** The player whose stats are being viewed (defaults to currentUser) */
  selectedPlayer?: Participant
}

export function GameStatsPanel({
  isOpen,
  onClose,
  roomId,
  currentUser,
  participants,
  selectedPlayer,
}: GameStatsPanelProps) {
  // The player whose stats we're viewing (defaults to current user)
  const viewedPlayer = selectedPlayer ?? currentUser
  const isViewingOwnStats = viewedPlayer.id === currentUser.id
  // Use roomId as-is - roomPlayers table stores bare roomId (e.g., "ABC123")
  const convexRoomId = roomId

  // Determine if viewed player has any commanders set
  const viewedPlayerHasCommanders =
    viewedPlayer.commanders.length > 0 &&
    viewedPlayer.commanders.some((c) => c?.name)

  // XState machine for commander panel state
  const [state, send] = useMachine(commanderPanelMachine)

  // Derive state from machine context
  const editingPlayerId = state.context.editingPlayerId
  const viewedPlayerSlotCollapsed = state.context.viewedPlayerSlotCollapsed
  const cmdState = {
    commander1Name: state.context.commander1Name,
    commander2Name: state.context.commander2Name,
    commander1Card: state.context.commander1Card,
    commander2Card: state.context.commander2Card,
    dualKeywords: state.context.dualKeywords,
    specificPartner: state.context.specificPartner,
    allowsSecondCommander: state.context.allowsSecondCommander,
  }
  const commander2Suggestions = state.context.commander2Suggestions
  const suggestionsLabel = state.context.suggestionsLabel

  const isClosed = state.matches('closed')

  // Effect Events - stable handlers that always see latest props/state
  const syncPanelOpenState = useEffectEvent(() => {
    if (isOpen && isClosed) {
      send({ type: 'OPEN_PANEL', viewedPlayerHasCommanders })
    } else if (!isOpen && !isClosed) {
      send({ type: 'CLOSE_PANEL' })
    }
  })

  const syncCollapsedState = useEffectEvent(() => {
    if (isOpen) {
      const hasCommanders = viewedPlayer.commanders.some((c) => c?.name)
      send({ type: 'SET_COLLAPSED', collapsed: hasCommanders })
    }
  })

  // Sync panel open state with machine
  useEffect(() => {
    syncPanelOpenState()
  }, [isOpen])

  // Reset collapsed state when viewed player changes
  useEffect(() => {
    syncCollapsedState()
  }, [viewedPlayer.id])

  // Convex mutation functions
  const setCommandersMutation = useConvexMutation(api.rooms.setPlayerCommanders)

  // Helper function for optimistic updates on player queries
  type RoomPlayer = Doc<'roomPlayers'>

  const updatePlayerQueriesOptimistically = (
    localStore: Parameters<
      Parameters<
        ReturnType<
          typeof useConvexMutation<typeof api.rooms.updateCommanderDamage>
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

  const updateCommanderDamage = useConvexMutation(
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

  // Mutation variables type includes which commander triggered the save
  type SaveCommandersInput = {
    userId: string
    commanders: { id: string; name: string }[]
    triggeredBy: 1 | 2
  }

  // React Query mutation for saving commanders
  const saveCommandersMutation = useMutation({
    mutationFn: async ({ userId, commanders }: SaveCommandersInput) => {
      console.log('[GameStatsPanel] Saving commanders:', {
        roomId: convexRoomId,
        userId,
        commanders,
      })
      return setCommandersMutation({
        roomId: convexRoomId,
        userId,
        commanders,
      })
    },
    onSuccess: () => {
      console.log('[GameStatsPanel] Commanders saved successfully')
      // Don't exit edit mode or show toast - user stays in edit mode until they click "Done"
    },
    onError: (error) => {
      console.error('[GameStatsPanel] Failed to save commanders:', error)
      toast.error(
        error instanceof Error ? error.message : 'Failed to save commanders',
      )
    },
  })

  // Commander name setters via machine events
  const setCommander1Name = (name: string) => {
    send({ type: 'SET_CMD1_NAME', name })
  }
  const setCommander2Name = (name: string) => {
    send({ type: 'SET_CMD2_NAME', name })
  }
  const baseOnCommander1Resolved = (card: ScryfallCard | null) => {
    send({ type: 'CMD1_RESOLVED', card })
  }
  const baseOnCommander2Resolved = (card: ScryfallCard | null) => {
    send({ type: 'CMD2_RESOLVED', card })
  }

  // Helper to build commanders array and save
  const saveCommanders = (
    commander1: string,
    commander2: string,
    triggeredBy: 1 | 2,
    newIds?: { c1?: string; c2?: string },
  ) => {
    if (!editingPlayerId) return

    // Find the player being edited
    const player = participants.find((p) => p.id === editingPlayerId)
    if (!player) return

    const commanders = []

    let c1Id = newIds?.c1
    if (!c1Id) {
      if (commander1.trim() === player.commanders[0]?.name) {
        c1Id = player.commanders[0]?.id
      } else if (commander1.trim() === cmdState.commander1Card?.name) {
        c1Id = cmdState.commander1Card?.id
      }
    }
    c1Id = c1Id ?? player.commanders[0]?.id ?? 'c1'

    let c2Id = newIds?.c2
    if (!c2Id) {
      if (commander2.trim() === player.commanders[1]?.name) {
        c2Id = player.commanders[1]?.id
      } else if (commander2.trim() === cmdState.commander2Card?.name) {
        c2Id = cmdState.commander2Card?.id
      }
    }
    c2Id = c2Id ?? player.commanders[1]?.id ?? 'c2'

    if (commander1.trim()) {
      commanders.push({ id: c1Id, name: commander1.trim() })
    }
    if (commander2.trim()) {
      commanders.push({ id: c2Id, name: commander2.trim() })
    }
    saveCommandersMutation.mutate({
      userId: player.id,
      commanders,
      triggeredBy,
    })
  }

  // Wrapper to auto-save when Commander 1 is selected
  const onCommander1Resolved = (
    card: Parameters<typeof baseOnCommander1Resolved>[0],
  ) => {
    baseOnCommander1Resolved(card)
    if (card) {
      saveCommanders(card.name, cmdState.commander2Name, 1, { c1: card.id })
    }
  }

  // Wrapper to auto-save when Commander 2 is selected
  const onCommander2Resolved = (
    card: Parameters<typeof baseOnCommander2Resolved>[0],
  ) => {
    baseOnCommander2Resolved(card)
    if (card) {
      saveCommanders(cmdState.commander1Name, card.name, 2, { c2: card.id })
    }
  }

  // Quick-fill Commander 2 from a suggestion link
  const handleQuickFillCommander2 = async (name: string) => {
    setCommander2Name(name)
    const { getCardByName } = await import('@/lib/scryfall')
    const card = await getCardByName(name, false)
    if (card) {
      baseOnCommander2Resolved(card)
      saveCommanders(cmdState.commander1Name, name, 2, { c2: card.id })
    } else {
      saveCommanders(cmdState.commander1Name, name, 2)
    }
  }

  // Clear a specific commander slot for a player
  const handleClearCommander = (player: Participant, slotNumber: 1 | 2) => {
    // Keep the other commander if it exists
    const keepSlot = slotNumber === 1 ? 1 : 0
    const keepCommander = player.commanders[keepSlot]
    const commanders = keepCommander?.name
      ? [{ id: keepCommander.id, name: keepCommander.name }]
      : []

    // If clearing from currently edited player, also clear local state via machine
    if (player.id === editingPlayerId) {
      send({ type: 'CLEAR_CMD', slot: slotNumber })
    }

    setCommandersMutation({
      roomId: convexRoomId,
      userId: player.id,
      commanders,
    })
    toast.success(`Commander ${slotNumber} cleared`)
  }

  const handleStartEditing = (player: Participant) => {
    send({
      type: 'START_EDIT',
      playerId: player.id,
      commander1Name: player.commanders[0]?.name ?? '',
      commander2Name: player.commanders[1]?.name ?? '',
    })
  }

  // Derive status for each commander input using React Query state
  const lastTriggeredBy = saveCommandersMutation.variables?.triggeredBy

  const getCommanderStatus = (
    commanderNum: 1 | 2,
    hasExistingCommander: boolean,
  ): 'idle' | 'saving' | 'saved' | 'error' => {
    const isTriggered = lastTriggeredBy === commanderNum

    if (saveCommandersMutation.isPending && isTriggered) {
      return 'saving'
    }
    if (saveCommandersMutation.isError && isTriggered) {
      return 'error'
    }
    // Only return 'saved' from mutation success if the commander still exists
    // This prevents showing 'saved' status after clearing
    if (
      saveCommandersMutation.isSuccess &&
      isTriggered &&
      hasExistingCommander
    ) {
      return 'saved'
    }
    if (hasExistingCommander) {
      return 'saved'
    }
    return 'idle'
  }

  // Suggestions are now fetched by the machine when CMD1_RESOLVED is dispatched

  const handleUpdateDamage = (
    ownerUserId: string,
    commanderId: string,
    delta: number,
  ) => {
    updateCommanderDamage({
      roomId: convexRoomId,
      userId: viewedPlayer.id, // The viewed player is taking damage
      ownerUserId, // From this owner
      commanderId, // From this commander
      delta,
    }).catch(() => {
      toast.error('Failed to update commander damage')
    })
  }

  // Build the slots: joined players first, then vacant slots
  const vacantSlotsCount = Math.max(0, MAX_PLAYERS - participants.length)
  const vacantSlots = Array.from({ length: vacantSlotsCount }, (_, i) => ({
    type: 'vacant' as const,
    index: i,
  }))

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        className="border-l-border-default bg-surface-0 w-[400px] text-white sm:w-[540px]"
      >
        <SheetHeader className="pb-4">
          <SheetTitle className="flex items-center gap-2 text-white">
            <UserCircle className="text-brand-muted-foreground h-5 w-5" />
            {isViewingOwnStats
              ? 'Your Commander Damage'
              : `${viewedPlayer.username}'s Commander Damage`}
          </SheetTitle>
          <SheetDescription className="text-text-muted">
            {isViewingOwnStats
              ? 'Track damage dealt to you by each commander.'
              : `Viewing damage dealt to ${viewedPlayer.username} by each commander.`}
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-140px)] pr-4">
          <div className="space-y-4 px-4 pb-8">
            {/* Joined players */}
            {participants.map((player) => {
              const isCurrentUser = player.id === currentUser.id
              const isViewedPlayer = player.id === viewedPlayer.id
              const isCollapsed = isViewedPlayer && viewedPlayerSlotCollapsed

              // Minimized view for viewed player's own slot (self-damage is rare)
              if (isCollapsed) {
                const commander1 = player.commanders[0]
                const commander2 = player.commanders[1]
                const cmd1ImageUrl = commander1
                  ? getCommanderImageUrl(commander1.id)
                  : null
                const cmd2ImageUrl = commander2
                  ? getCommanderImageUrl(commander2.id)
                  : null

                return (
                  <div
                    key={player.id}
                    className="border-border-default bg-surface-1/50 rounded-lg border p-3"
                  >
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() =>
                        send({ type: 'SET_COLLAPSED', collapsed: false })
                      }
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          send({ type: 'SET_COLLAPSED', collapsed: false })
                        }
                      }}
                      className="flex w-full cursor-pointer items-center gap-2 text-left"
                    >
                      {player.avatar ? (
                        <img
                          src={player.avatar}
                          alt={player.username}
                          className="h-5 w-5 rounded-full"
                        />
                      ) : (
                        <User className="text-text-muted h-4 w-4" />
                      )}
                      <span className="text-text-secondary font-semibold">
                        {player.username}
                        {isCurrentUser && (
                          <span className="text-text-muted ml-1.5 text-xs font-normal">
                            (You)
                          </span>
                        )}
                      </span>
                      <span className="bg-brand/20 text-brand-muted-foreground rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide">
                        Viewing
                      </span>
                      <span className="ml-auto flex items-center gap-1.5">
                        {/* Commander thumbnails */}
                        <span className="flex -space-x-1">
                          {cmd1ImageUrl ? (
                            <img
                              src={cmd1ImageUrl}
                              alt={commander1?.name}
                              title={commander1?.name}
                              className="border-border-default h-6 w-6 rounded-full border object-cover"
                            />
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                send({
                                  type: 'SET_COLLAPSED',
                                  collapsed: false,
                                })
                                handleStartEditing(player)
                              }}
                              className="border-border-default bg-surface-1/50 text-text-muted hover:border-brand hover:bg-brand/10 hover:text-brand-muted-foreground flex h-6 w-6 cursor-pointer items-center justify-center rounded-full border border-dashed transition-colors"
                              title="Add Commander 1"
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                          )}
                          {/* Only show commander 2 thumbnail if it exists - don't show add button since we need to check if commander 1 supports a partner */}
                          {cmd2ImageUrl && (
                            <img
                              src={cmd2ImageUrl}
                              alt={commander2?.name}
                              title={commander2?.name}
                              className="border-border-default h-6 w-6 rounded-full border object-cover"
                            />
                          )}
                        </span>
                        <ChevronDown className="text-text-muted h-4 w-4" />
                      </span>
                    </div>
                  </div>
                )
              }

              const isEditingThisPlayer = editingPlayerId === player.id
              // Get status only if this player is being edited
              // Use local state (cmdState) for hasExistingCommander when editing, not props (player.commanders)
              // This ensures that when clearing, the status updates immediately based on local state
              const playerCommander1Status = isEditingThisPlayer
                ? getCommanderStatus(
                    1,
                    Boolean(cmdState.commander1Name || cmdState.commander1Card),
                  )
                : 'saved'
              const playerCommander2Status = isEditingThisPlayer
                ? getCommanderStatus(
                    2,
                    Boolean(cmdState.commander2Name || cmdState.commander2Card),
                  )
                : 'saved'

              return (
                <div
                  key={player.id}
                  className="border-border-default bg-surface-1/50 rounded-lg border p-4"
                >
                  {/* Player header */}
                  <div className="border-border-default mb-3 flex items-center gap-2 border-b pb-2">
                    {player.avatar ? (
                      <img
                        src={player.avatar}
                        alt={player.username}
                        className="h-6 w-6 rounded-full"
                      />
                    ) : (
                      <User className="text-text-muted h-5 w-5" />
                    )}
                    <span className="text-text-secondary font-semibold">
                      {player.username}
                      {isCurrentUser && (
                        <span className="text-text-muted ml-1.5 text-xs font-normal">
                          (You)
                        </span>
                      )}
                    </span>

                    {/* Controls: Viewing Badge, Edit Button, Minimize Button */}
                    <div className="ml-auto flex items-center gap-1">
                      {isViewedPlayer && (
                        <span className="bg-brand/20 text-brand-muted-foreground rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide">
                          Viewing
                        </span>
                      )}

                      <div className="w-[3rem]">
                        {isEditingThisPlayer ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-border-default bg-surface-2 text-text-secondary hover:bg-surface-3 h-7 w-full hover:text-white"
                            onClick={() => send({ type: 'DONE_EDIT' })}
                          >
                            Done
                          </Button>
                        ) : player.commanders[0]?.name ||
                          player.commanders[1]?.name ? (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="text-text-muted hover:bg-surface-2 hover:text-brand-muted-foreground h-7 w-7"
                            onClick={() => handleStartEditing(player)}
                            title="Edit commanders"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        ) : null}
                      </div>

                      {isViewedPlayer &&
                        viewedPlayerHasCommanders &&
                        !isEditingThisPlayer && (
                          <button
                            type="button"
                            onClick={() =>
                              send({ type: 'SET_COLLAPSED', collapsed: true })
                            }
                            className="text-text-muted hover:bg-surface-2 hover:text-text-secondary rounded p-1"
                            title="Minimize"
                          >
                            <ChevronUp className="h-4 w-4" />
                          </button>
                        )}
                    </div>
                  </div>

                  {/* Commander slots */}
                  <div className="space-y-3">
                    {!isEditingThisPlayer &&
                      !player.commanders[0]?.name &&
                      !player.commanders[1]?.name && (
                        <button
                          type="button"
                          onClick={() => handleStartEditing(player)}
                          className="border-border-default bg-surface-1/30 text-text-muted hover:border-border-default hover:bg-surface-1/50 hover:text-text-muted flex w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-6 transition-colors"
                        >
                          <Plus className="h-5 w-5" />
                          <span className="text-sm font-medium">
                            {isCurrentUser
                              ? 'Add your Commander'
                              : 'Add commander'}
                          </span>
                        </button>
                      )}
                    {/* Commander 1 */}
                    <CommanderSlot
                      slotNumber={1}
                      commander={player.commanders[0]}
                      damage={
                        player.commanders[0]
                          ? (viewedPlayer.commanderDamage[
                              `${player.id}:${player.commanders[0].id}`
                            ] ?? 0)
                          : 0
                      }
                      isEditing={isEditingThisPlayer}
                      isViewedPlayer={isViewedPlayer}
                      getCommanderImageUrl={getCommanderImageUrl}
                      onDamageChange={(delta) =>
                        player.commanders[0] &&
                        handleUpdateDamage(
                          player.id,
                          player.commanders[0].id,
                          delta,
                        )
                      }
                      onStartEdit={() => handleStartEditing(player)}
                      onClear={() => handleClearCommander(player, 1)}
                      // Edit props - pass shared state if editing this player
                      inputValue={
                        isEditingThisPlayer ? cmdState.commander1Name : ''
                      }
                      onInputChange={setCommander1Name}
                      onCardResolved={onCommander1Resolved}
                      status={playerCommander1Status}
                      dualKeywords={cmdState.dualKeywords}
                      specificPartner={cmdState.specificPartner}
                      suggestions={commander2Suggestions}
                      suggestionsLabel={suggestionsLabel}
                      onQuickFillCommander2={handleQuickFillCommander2}
                    />

                    {/* Commander 2 - only show if commander 1 allows a second commander (Partner, Background, etc.) */}
                    {(player.commanders[1]?.name ||
                      (isEditingThisPlayer &&
                        cmdState.allowsSecondCommander)) && (
                      <CommanderSlot
                        slotNumber={2}
                        commander={player.commanders[1]}
                        damage={
                          player.commanders[1]
                            ? (viewedPlayer.commanderDamage[
                                `${player.id}:${player.commanders[1].id}`
                              ] ?? 0)
                            : 0
                        }
                        isEditing={isEditingThisPlayer}
                        isViewedPlayer={isViewedPlayer}
                        getCommanderImageUrl={getCommanderImageUrl}
                        onDamageChange={(delta) =>
                          player.commanders[1] &&
                          handleUpdateDamage(
                            player.id,
                            player.commanders[1].id,
                            delta,
                          )
                        }
                        onStartEdit={() => handleStartEditing(player)}
                        onClear={() => handleClearCommander(player, 2)}
                        // Edit props
                        inputValue={
                          isEditingThisPlayer ? cmdState.commander2Name : ''
                        }
                        onInputChange={setCommander2Name}
                        onCardResolved={onCommander2Resolved}
                        status={playerCommander2Status}
                        allowsSecondCommander={cmdState.allowsSecondCommander}
                        suggestions={commander2Suggestions}
                        suggestionsLabel={suggestionsLabel}
                      />
                    )}
                  </div>
                </div>
              )
            })}

            {/* Vacant slots */}
            {vacantSlots.map((slot) => (
              <div
                key={`vacant-${slot.index}`}
                className="border-border-default bg-surface-1/30 rounded-lg border border-dashed p-4"
              >
                <div className="text-text-muted flex items-center gap-2">
                  <User className="h-5 w-5" />
                  <span className="font-medium">Empty Seat</span>
                </div>
                <p className="text-text-muted mt-2 text-sm">
                  Waiting for player to join...
                </p>
              </div>
            ))}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}

// =============================================================================
// CommanderSlot Component
// =============================================================================

interface CommanderSlotProps {
  slotNumber: 1 | 2
  commander?: { id: string; name: string }
  damage: number
  isEditing: boolean
  isViewedPlayer: boolean
  getCommanderImageUrl: (id: string) => string | null
  onDamageChange: (delta: number) => void
  onStartEdit: () => void
  onClear: () => void
  // Edit mode props
  inputValue: string
  onInputChange: (value: string) => void
  onCardResolved: (card: ScryfallCard | null) => void
  status: 'idle' | 'saving' | 'saved' | 'error'
  // Slot 1 specific
  dualKeywords?: string[]
  specificPartner?: string | null
  onQuickFillCommander2?: (name: string) => void
  // Slot 2 specific
  allowsSecondCommander?: boolean
  suggestions?: string[]
  suggestionsLabel?: string
}

function CommanderSlot({
  slotNumber,
  commander,
  damage,
  isEditing,
  isViewedPlayer: _isViewedPlayer,
  getCommanderImageUrl,
  onDamageChange,
  onStartEdit: _onStartEdit,
  onClear,
  inputValue,
  onInputChange,
  onCardResolved,
  status,
  dualKeywords,
  specificPartner,
  onQuickFillCommander2,
  allowsSecondCommander,
  suggestions,
  suggestionsLabel,
}: CommanderSlotProps) {
  const [isSearching, setIsSearching] = useState(false)
  const isLethal = damage >= 21
  const imageUrl = commander ? getCommanderImageUrl(commander.id) : null

  // Hold-to-repeat hooks for damage buttons
  const damageMinus = useHoldToRepeat({
    onChange: onDamageChange,
    immediateDelta: -1,
    repeatDelta: -10,
  })

  const damagePlus = useHoldToRepeat({
    onChange: onDamageChange,
    immediateDelta: 1,
    repeatDelta: 10,
  })

  // Empty slot - hide if not set and not editing
  if (!commander && !isEditing) {
    return null
  }

  // Edit mode - show search input
  if (isEditing) {
    return (
      <div className="border-border-default bg-surface-0/50 rounded-md border p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-text-muted text-xs font-medium">
            Commander {slotNumber}
            {slotNumber === 2 &&
              allowsSecondCommander &&
              ` (${suggestionsLabel})`}
          </span>
          <Button
            size="sm"
            variant="ghost"
            className="text-destructive hover:bg-destructive/20 hover:text-destructive h-6 px-2 text-xs disabled:opacity-50"
            onClick={onClear}
            disabled={!commander && !inputValue.trim()}
          >
            Clear
          </Button>
        </div>
        <div className="relative">
          <CommanderSearchInput
            id={`c${slotNumber}`}
            value={inputValue}
            onChange={onInputChange}
            onCardResolved={onCardResolved}
            placeholder={
              slotNumber === 2 && allowsSecondCommander
                ? `Search ${suggestionsLabel?.toLowerCase()}...`
                : 'Search for a commander...'
            }
            className="border-border-default bg-surface-1 placeholder:text-text-muted hover:border-border-default focus-visible:ring-brand h-9 pr-10 text-sm text-white transition-colors"
            suggestions={slotNumber === 2 ? suggestions : undefined}
            suggestionsLabel={slotNumber === 2 ? suggestionsLabel : undefined}
            hideLoadingIndicator
            onLoadingChange={setIsSearching}
          />
          <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
            {isSearching ? (
              <Loader2 className="text-text-muted h-4 w-4 animate-spin" />
            ) : status === 'saving' ? (
              <Loader2 className="text-brand-muted-foreground h-4 w-4 animate-spin" />
            ) : status === 'saved' ? (
              <Check className="text-success h-4 w-4" />
            ) : status === 'error' ? (
              <AlertCircle className="text-destructive h-4 w-4" />
            ) : null}
          </div>
        </div>
        {/* Show partner suggestions for slot 1 */}
        {slotNumber === 1 && dualKeywords && dualKeywords.length > 0 && (
          <div className="text-brand-muted-foreground mt-2 text-xs">
            {specificPartner ? (
              <p>
                Partner with{' '}
                <button
                  type="button"
                  onClick={() => onQuickFillCommander2?.(specificPartner)}
                  className="text-brand-muted-foreground decoration-brand/50 hover:text-brand-muted-foreground hover:decoration-brand-muted-foreground cursor-pointer font-medium underline underline-offset-2"
                >
                  {specificPartner}
                </button>
              </p>
            ) : suggestions &&
              suggestions.length > 0 &&
              suggestions.length <= 5 ? (
              <div className="flex flex-wrap items-center gap-1">
                <span>{suggestionsLabel}:</span>
                {suggestions.map((name, idx) => (
                  <span key={name}>
                    <button
                      type="button"
                      onClick={() => onQuickFillCommander2?.(name)}
                      className="text-brand-muted-foreground decoration-brand/50 hover:text-brand-muted-foreground hover:decoration-brand-muted-foreground cursor-pointer font-medium underline underline-offset-2"
                    >
                      {name}
                    </button>
                    {idx < suggestions.length - 1 && ', '}
                  </span>
                ))}
              </div>
            ) : (
              <p>{dualKeywords.join(', ')} detected</p>
            )}
          </div>
        )}
      </div>
    )
  }

  // Display mode - show commander with damage counter
  // Guard: at this point commander must exist (we returned early if !commander && !isEditing)
  if (!commander) return null

  return (
    <div className="border-border-default bg-surface-0/50 group relative rounded-md border">
      {/* Commander Background Image */}
      {imageUrl && (
        <div className="absolute inset-0 z-0 overflow-hidden rounded-md">
          <img
            src={imageUrl}
            alt={commander.name}
            className="absolute inset-0 h-full w-full object-cover opacity-40 transition-opacity duration-500 group-hover:opacity-60"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950/80 via-slate-950/40 to-transparent" />
        </div>
      )}

      <div className="relative z-10 flex items-center justify-between p-3">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="text-shadow-sm text-text-secondary text-sm font-medium shadow-black">
              {commander.name}
            </span>
          </div>
          {isLethal && (
            <span className="bg-destructive/10 text-destructive flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-bold backdrop-blur-sm">
              <Swords className="h-3 w-3" /> Lethal
            </span>
          )}
        </div>

        {/* Damage counter */}
        <div className="flex items-center gap-2">
          <Button
            size="icon"
            variant="outline"
            className="border-border-default bg-surface-1/80 text-text-secondary hover:bg-surface-2 h-8 w-8 backdrop-blur-sm hover:text-white"
            onMouseDown={damageMinus.handleStart}
            onMouseUp={damageMinus.handleStop}
            onMouseLeave={damageMinus.handleStop}
            onTouchStart={damageMinus.handleStart}
            onTouchEnd={damageMinus.handleStop}
            disabled={damage <= 0}
          >
            -
          </Button>
          <span
            className={`text-shadow-sm min-w-[2rem] text-center font-mono text-lg font-bold shadow-black ${
              isLethal ? 'text-destructive' : 'text-text-secondary'
            }`}
          >
            {damage}
          </span>
          <Button
            size="icon"
            variant="outline"
            className="border-border-default bg-surface-1/80 text-text-secondary hover:bg-surface-2 h-8 w-8 backdrop-blur-sm hover:text-white"
            onMouseDown={damagePlus.handleStart}
            onMouseUp={damagePlus.handleStop}
            onMouseLeave={damagePlus.handleStop}
            onTouchStart={damagePlus.handleStart}
            onTouchEnd={damagePlus.handleStop}
          >
            +
          </Button>
        </div>
      </div>
    </div>
  )
}
