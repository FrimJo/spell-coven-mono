import type { ScryfallCard } from '@/lib/scryfall'
import type { CardQueryResult } from '@/types/card-query'
import type { Participant } from '@/types/participant'
import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { useCardQueryContext } from '@/contexts/CardQueryContext'
import { usePresence } from '@/contexts/PresenceContext'
import {
  detectDualCommanderKeywords,
  getCardByName,
  getCommanderImageUrl,
} from '@/lib/scryfall'
import { commanderPanelMachine } from '@/state/commanderPanelMachine'
import { api } from '@convex/_generated/api'
import { useMutation } from '@tanstack/react-query'
import { useMachine } from '@xstate/react'
import { useMutation as useConvexMutation } from 'convex/react'
import {
  AlertCircle,
  Check,
  Loader2,
  Pencil,
  Plus,
  Trash2,
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

import { CommanderSearchInput } from './CommanderSearchInput'

function scryfallToQueryResult(card: ScryfallCard): CardQueryResult {
  return {
    name: card.name,
    set: card.set,
    score: 1.0,
    image_url:
      card.image_uris?.art_crop ?? getCommanderImageUrl(card.id) ?? undefined,
    scryfall_uri: card.scryfall_uri,
    card_url: card.image_uris?.normal,
  }
}

interface GameStatsPanelProps {
  isOpen: boolean
  onClose: () => void
  roomId: string
  currentUser: Participant
  participants: Participant[]
}

export function GameStatsPanel({
  isOpen,
  onClose,
  roomId,
  currentUser,
  participants,
}: GameStatsPanelProps) {
  // Use roomId as-is - roomPlayers table stores bare roomId (e.g., "ABC123")
  const convexRoomId = roomId
  // Get seat count from presence context
  const { roomSeatCount } = usePresence()
  // Add selected commanders to Recent Cards in the sidebar
  const { setResult } = useCardQueryContext()

  // XState machine for commander panel state
  const [state, send] = useMachine(commanderPanelMachine)

  // Derive state from machine context (multi-player: editingPlayerIds + editStateByPlayerId)
  const editingPlayerIds = state.context.editingPlayerIds
  const editStateByPlayerId = state.context.editStateByPlayerId

  // Helper to get edit state for a player (used when rendering each card)
  const getEditStateForPlayer = (playerId: string) => {
    const editState = editStateByPlayerId[playerId]
    if (!editState) {
      return {
        commander1Name: '',
        commander2Name: '',
        commander1Card: null,
        commander2Card: null,
        dualKeywords: [],
        specificPartner: null,
        allowsSecondCommander: false,
        commander2Suggestions: [],
        suggestionsLabel: 'Suggested',
      }
    }
    return {
      commander1Name: editState.commander1Name,
      commander2Name: editState.commander2Name,
      commander1Card: editState.commander1Card,
      commander2Card: editState.commander2Card,
      dualKeywords: editState.dualKeywords,
      specificPartner: editState.specificPartner,
      allowsSecondCommander: editState.allowsSecondCommander,
      commander2Suggestions: editState.commander2Suggestions,
      suggestionsLabel: editState.suggestionsLabel,
    }
  }

  const isClosed = state.matches('closed')

  // When panel just opened, default to edit mode for current user if they have no commanders
  const didAutoEditThisOpenRef = useRef(false)
  useEffect(() => {
    if (!isOpen) {
      didAutoEditThisOpenRef.current = false
      return
    }
    if (isClosed || editingPlayerIds.length > 0) return
    const player = participants.find((p) => p.id === currentUser.id)
    if (!player) return
    const hasNoCommanders =
      !player.commanders[0]?.name && !player.commanders[1]?.name
    if (!hasNoCommanders || didAutoEditThisOpenRef.current) return
    didAutoEditThisOpenRef.current = true
    send({
      type: 'START_EDIT',
      playerId: currentUser.id,
      commander1Name: '',
      commander2Name: '',
    })
  }, [
    isOpen,
    isClosed,
    editingPlayerIds.length,
    participants,
    currentUser.id,
    send,
  ])

  // When entering edit mode with an existing commander 1, load its card so helper text (Partner/Background) shows immediately
  const firstEditingPlayerId = editingPlayerIds[0] ?? null
  useEffect(() => {
    const player = participants.find((p) => p.id === firstEditingPlayerId)
    const editState = firstEditingPlayerId
      ? editStateByPlayerId[firstEditingPlayerId]
      : null
    if (
      !firstEditingPlayerId ||
      !player?.commanders[0]?.name ||
      editState?.commander1Card != null
    )
      return
    if (editState?.commander1Name.trim() !== player.commanders[0].name) return
    getCardByName(player.commanders[0].name, false).then((card) => {
      if (card)
        send({ type: 'CMD1_RESOLVED', playerId: firstEditingPlayerId, card })
    })
  }, [firstEditingPlayerId, participants, editStateByPlayerId, send])

  // Effect Events - stable handlers that always see latest props/state
  const syncPanelOpenState = useEffectEvent(() => {
    if (isOpen && isClosed) {
      send({ type: 'OPEN_PANEL' })
    } else if (!isOpen && !isClosed) {
      send({ type: 'CLOSE_PANEL' })
    }
  })

  // Sync panel open state with machine
  useEffect(() => {
    syncPanelOpenState()
  }, [isOpen])

  // Convex mutation for setting commanders
  const setCommandersMutation = useConvexMutation(api.rooms.setPlayerCommanders)

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

  // Commander name setters via machine events (require playerId for multi-player context)
  const setCommander1Name = (playerId: string, name: string) => {
    send({ type: 'SET_CMD1_NAME', playerId, name })
  }
  const setCommander2Name = (playerId: string, name: string) => {
    send({ type: 'SET_CMD2_NAME', playerId, name })
  }
  const baseOnCommander1Resolved = (
    playerId: string,
    card: ScryfallCard | null,
  ) => {
    send({ type: 'CMD1_RESOLVED', playerId, card })
  }
  const baseOnCommander2Resolved = (
    playerId: string,
    card: ScryfallCard | null,
  ) => {
    send({ type: 'CMD2_RESOLVED', playerId, card })
  }

  // Helper to build commanders array and save
  const saveCommanders = (
    playerId: string,
    commander1: string,
    commander2: string,
    triggeredBy: 1 | 2,
    newIds?: { c1?: string; c2?: string },
  ) => {
    const player = participants.find((p) => p.id === playerId)
    if (!player) return
    const editState = editStateByPlayerId[playerId]

    const commanders = []

    let c1Id = newIds?.c1
    if (!c1Id) {
      if (commander1.trim() === player.commanders[0]?.name) {
        c1Id = player.commanders[0]?.id
      } else if (
        editState &&
        commander1.trim() === editState.commander1Card?.name
      ) {
        c1Id = editState.commander1Card?.id
      }
    }
    c1Id = c1Id ?? player.commanders[0]?.id ?? 'c1'

    let c2Id = newIds?.c2
    if (!c2Id) {
      if (commander2.trim() === player.commanders[1]?.name) {
        c2Id = player.commanders[1]?.id
      } else if (
        editState &&
        commander2.trim() === editState.commander2Card?.name
      ) {
        c2Id = editState.commander2Card?.id
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

  // Wrapper to auto-save when Commander 1 is selected or cleared (empty input / deselect)
  const onCommander1Resolved = async (
    playerId: string,
    card: Parameters<typeof baseOnCommander1Resolved>[1],
  ) => {
    const editState = editStateByPlayerId[playerId]
    baseOnCommander1Resolved(playerId, card)
    if (!card) {
      saveCommanders(playerId, '', editState?.commander2Name ?? '', 1)
      return
    }
    setResult(scryfallToQueryResult(card))
    const newKeywords = detectDualCommanderKeywords(card)
    const newAllowsSecond = newKeywords.length > 0
    let commander2ForSave = ''
    if (newAllowsSecond) {
      const player = participants.find((p) => p.id === playerId)
      const oldCommander1Name = player?.commanders[0]?.name
      const isSwitching =
        oldCommander1Name != null && oldCommander1Name !== card.name
      if (!isSwitching) {
        commander2ForSave = editState?.commander2Name ?? ''
      } else {
        const oldCard = await getCardByName(oldCommander1Name, false)
        const oldKeywords = oldCard ? detectDualCommanderKeywords(oldCard) : []
        const sameDualType =
          oldKeywords.length === newKeywords.length &&
          oldKeywords.every((k) => newKeywords.includes(k))
        commander2ForSave = sameDualType
          ? (editState?.commander2Name ?? '')
          : ''
      }
    }
    saveCommanders(playerId, card.name, commander2ForSave, 1, { c1: card.id })
  }

  // Wrapper to auto-save when Commander 2 is selected or cleared (empty input / deselect)
  const onCommander2Resolved = (
    playerId: string,
    card: Parameters<typeof baseOnCommander2Resolved>[1],
  ) => {
    const editState = editStateByPlayerId[playerId]
    baseOnCommander2Resolved(playerId, card)
    if (card) {
      setResult(scryfallToQueryResult(card))
      saveCommanders(playerId, editState?.commander1Name ?? '', card.name, 2, {
        c2: card.id,
      })
    } else {
      saveCommanders(playerId, editState?.commander1Name ?? '', '', 2)
    }
  }

  // Quick-fill Commander 2 from a suggestion link
  const handleQuickFillCommander2 = async (playerId: string, name: string) => {
    const editState = editStateByPlayerId[playerId]
    setCommander2Name(playerId, name)
    const card = await getCardByName(name, false)
    if (card) {
      setResult(scryfallToQueryResult(card))
      baseOnCommander2Resolved(playerId, card)
      saveCommanders(playerId, editState?.commander1Name ?? '', name, 2, {
        c2: card.id,
      })
    } else {
      saveCommanders(playerId, editState?.commander1Name ?? '', name, 2)
    }
  }

  // Clear a specific commander slot for a player
  const handleClearCommander = (player: Participant, slotNumber: 1 | 2) => {
    // When clearing commander 1, clear both (commander 2 only exists as partner to commander 1).
    // When clearing commander 2, keep commander 1.
    const commanders =
      slotNumber === 1
        ? []
        : player.commanders[0]?.name
          ? [{ id: player.commanders[0].id, name: player.commanders[0].name }]
          : []

    // If clearing from currently edited player, also clear local state via machine
    if (editingPlayerIds.includes(player.id)) {
      send({ type: 'CLEAR_CMD', playerId: player.id, slot: slotNumber })
    }

    setCommandersMutation({
      roomId: convexRoomId,
      userId: player.id,
      commanders,
    })
    toast.success(`Commander ${slotNumber} cleared`)
  }

  const handleStartEditing = (player: Participant, slot?: 1 | 2) => {
    const alreadyEditingThisPlayer = editingPlayerIds.includes(player.id)
    if (alreadyEditingThisPlayer && slot !== undefined) {
      send({ type: 'ENTER_SLOT_EDIT', playerId: player.id, slot })
    } else {
      send({
        type: 'START_EDIT',
        playerId: player.id,
        commander1Name: player.commanders[0]?.name ?? '',
        commander2Name: player.commanders[1]?.name ?? '',
        slot,
      })
    }
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

  // Build the slots: joined players first, then vacant slots
  const vacantSlotsCount = Math.max(0, roomSeatCount - participants.length)
  const vacantSlots = Array.from({ length: vacantSlotsCount }, (_, i) => ({
    type: 'vacant' as const,
    index: i,
  }))

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      send({ type: 'CLOSE_PANEL' })
      onClose()
    }
  }

  return (
    <Sheet open={isOpen} onOpenChange={handleOpenChange}>
      <SheetContent
        side="right"
        forceMount
        className="border-l-border-default bg-surface-0 w-[400px] text-white sm:w-[540px]"
      >
        <SheetHeader className="pb-4">
          <SheetTitle className="flex items-center gap-2 text-white">
            <UserCircle className="text-brand-muted-foreground h-5 w-5" />
            Commanders
          </SheetTitle>
          <SheetDescription className="text-text-muted">
            Set or edit each player&apos;s commanders.
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-140px)] pr-4">
          <div className="flex h-full min-h-0 flex-col gap-4 overflow-hidden px-4 pb-8">
            {/* Joined players - flex so cards share space and shrink when all have two commanders */}
            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
              {participants.map((player) => {
                const isEditingThisPlayer = editingPlayerIds.includes(player.id)
                const editState = editStateByPlayerId[player.id]
                const isEditingSlot1 =
                  isEditingThisPlayer && (editState?.editingSlot1 ?? true)
                const isEditingSlot2 =
                  isEditingThisPlayer && (editState?.editingSlot2 ?? true)
                const singleSlotEdit =
                  (isEditingSlot1 && !isEditingSlot2) ||
                  (!isEditingSlot1 && isEditingSlot2)
                const cmdState = getEditStateForPlayer(player.id)
                const playerCommander1Status = isEditingThisPlayer
                  ? getCommanderStatus(
                      1,
                      Boolean(
                        cmdState.commander1Name || cmdState.commander1Card,
                      ),
                    )
                  : 'saved'
                const playerCommander2Status = isEditingThisPlayer
                  ? getCommanderStatus(
                      2,
                      Boolean(
                        cmdState.commander2Name || cmdState.commander2Card,
                      ),
                    )
                  : 'saved'

                return (
                  <PlayerCommanderCard
                    key={player.id}
                    player={player}
                    isCurrentUser={player.id === currentUser.id}
                    isEditingThisPlayer={isEditingThisPlayer}
                    editingSlot1={isEditingSlot1}
                    editingSlot2={isEditingSlot2}
                    singleSlotEdit={singleSlotEdit}
                    cmdState={cmdState}
                    commander2Suggestions={cmdState.commander2Suggestions}
                    suggestionsLabel={cmdState.suggestionsLabel}
                    commander1Status={playerCommander1Status}
                    commander2Status={playerCommander2Status}
                    onStartEditing={handleStartEditing}
                    onClearCommander={handleClearCommander}
                    onDoneEdit={() =>
                      send({ type: 'DONE_EDIT', playerId: player.id })
                    }
                    setCommander1Name={(name) =>
                      setCommander1Name(player.id, name)
                    }
                    setCommander2Name={(name) =>
                      setCommander2Name(player.id, name)
                    }
                    onCommander1Resolved={(card) =>
                      onCommander1Resolved(player.id, card)
                    }
                    onCommander2Resolved={(card) =>
                      onCommander2Resolved(player.id, card)
                    }
                    onQuickFillCommander2={(name) =>
                      handleQuickFillCommander2(player.id, name)
                    }
                    getCommanderImageUrl={getCommanderImageUrl}
                  />
                )
              })}
            </div>

            {/* Vacant slots - fixed size at bottom */}
            <div className="flex flex-shrink-0 flex-col gap-4">
              {vacantSlots.map((slot) => (
                <div
                  key={`vacant-${slot.index}`}
                  className="border-border-default bg-surface-1/30 rounded-lg border border-dashed p-4"
                >
                  <div className="text-text-muted flex items-center gap-2">
                    <User className="h-5 w-5" />
                    <span className="font-medium">Open seat</span>
                  </div>
                  <p className="text-text-muted mt-2 text-sm">
                    Waiting for player to join...
                  </p>
                </div>
              ))}
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}

// =============================================================================
// PlayerCommanderCard – single player block (header + commander slots)
// =============================================================================

interface PlayerCommanderCardProps {
  player: Participant
  isCurrentUser: boolean
  isEditingThisPlayer: boolean
  editingSlot1: boolean
  editingSlot2: boolean
  singleSlotEdit: boolean
  cmdState: {
    commander1Name: string
    commander2Name: string
    commander1Card: ScryfallCard | null
    commander2Card: ScryfallCard | null
    dualKeywords: string[]
    specificPartner: string | null
    allowsSecondCommander: boolean
  }
  commander2Suggestions: string[]
  suggestionsLabel: string
  commander1Status: 'idle' | 'saving' | 'saved' | 'error'
  commander2Status: 'idle' | 'saving' | 'saved' | 'error'
  onStartEditing: (player: Participant, slot?: 1 | 2) => void
  onClearCommander: (player: Participant, slot: 1 | 2) => void
  onDoneEdit: () => void
  setCommander1Name: (name: string) => void
  setCommander2Name: (name: string) => void
  onCommander1Resolved: (card: ScryfallCard | null) => void
  onCommander2Resolved: (card: ScryfallCard | null) => void
  onQuickFillCommander2: (name: string) => void
  getCommanderImageUrl: (id: string) => string | null
}

function PlayerCommanderCard({
  player,
  isCurrentUser,
  isEditingThisPlayer,
  editingSlot1,
  editingSlot2,
  singleSlotEdit,
  cmdState,
  commander2Suggestions,
  suggestionsLabel,
  commander1Status,
  commander2Status,
  onStartEditing,
  onClearCommander,
  onDoneEdit,
  setCommander1Name,
  setCommander2Name,
  onCommander1Resolved,
  onCommander2Resolved,
  onQuickFillCommander2,
  getCommanderImageUrl,
}: PlayerCommanderCardProps) {
  const slotPadding = singleSlotEdit ? 'p-3' : 'p-4'
  const headerSpacing = singleSlotEdit ? 'mb-2 pb-1.5' : 'mb-3 pb-2'
  const slotsLayout = singleSlotEdit
    ? 'min-h-0 space-y-2'
    : 'flex min-h-0 flex-1 flex-col gap-3'

  return (
    <div
      className={`border-border-default bg-surface-1/50 flex min-h-0 flex-1 flex-col rounded-lg border ${slotPadding}`}
    >
      <div
        className={`border-border-default flex flex-shrink-0 items-center gap-2 border-b ${headerSpacing}`}
      >
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
        <div className="ml-auto flex min-h-7 flex-shrink-0 items-center justify-end">
          {isEditingThisPlayer ? (
            <Button
              size="sm"
              variant="outline"
              className="border-border-default bg-surface-2 text-text-secondary hover:bg-surface-3 h-7 hover:text-white"
              onClick={onDoneEdit}
            >
              Done
            </Button>
          ) : (
            <Button
              size="icon"
              variant="ghost"
              className="text-text-muted hover:bg-surface-2 hover:text-brand-muted-foreground h-7 w-7"
              onClick={() => onStartEditing(player)}
              title="Edit commanders"
              aria-label="Edit commanders"
            >
              <Pencil className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      <div className={slotsLayout}>
        {!isEditingThisPlayer &&
          !player.commanders[0]?.name &&
          !player.commanders[1]?.name && (
            <button
              type="button"
              onClick={() => onStartEditing(player)}
              className="border-border-default bg-surface-1/30 text-text-muted hover:border-border-default hover:bg-surface-1/50 hover:text-text-muted flex w-full flex-shrink-0 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-6 transition-colors"
            >
              <Plus className="h-5 w-5" />
              <span className="text-sm font-medium">
                {isCurrentUser ? 'Add your Commander' : 'Add commander'}
              </span>
            </button>
          )}
        <CommanderSlot
          slotNumber={1}
          commander={player.commanders[0]}
          isEditing={editingSlot1}
          getCommanderImageUrl={getCommanderImageUrl}
          onClear={() => onClearCommander(player, 1)}
          inputValue={isEditingThisPlayer ? cmdState.commander1Name : ''}
          onInputChange={setCommander1Name}
          onCardResolved={onCommander1Resolved}
          status={commander1Status}
          dualKeywords={cmdState.dualKeywords}
          specificPartner={cmdState.specificPartner}
          suggestions={commander2Suggestions}
          suggestionsLabel={suggestionsLabel}
          onQuickFillCommander2={onQuickFillCommander2}
        />
        {(player.commanders[1]?.name ||
          (isEditingThisPlayer && cmdState.allowsSecondCommander)) && (
          <CommanderSlot
            slotNumber={2}
            commander={player.commanders[1]}
            isEditing={
              editingSlot2 ||
              (isEditingThisPlayer &&
                cmdState.allowsSecondCommander &&
                !player.commanders[1]?.name)
            }
            getCommanderImageUrl={getCommanderImageUrl}
            onClear={() => onClearCommander(player, 2)}
            inputValue={isEditingThisPlayer ? cmdState.commander2Name : ''}
            onInputChange={setCommander2Name}
            onCardResolved={onCommander2Resolved}
            status={commander2Status}
            allowsSecondCommander={cmdState.allowsSecondCommander}
            suggestions={commander2Suggestions}
            suggestionsLabel={suggestionsLabel}
          />
        )}
      </div>
    </div>
  )
}

// =============================================================================
// CommanderSlot Component (delegates to View or Edit)
// =============================================================================

interface CommanderSlotProps {
  slotNumber: 1 | 2
  commander?: { id: string; name: string }
  isEditing: boolean
  getCommanderImageUrl: (id: string) => string | null
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

/** View-only commander card (image, name) – edit via header button */
function CommanderSlotView({
  commander,
  getCommanderImageUrl,
}: {
  commander: { id: string; name: string }
  getCommanderImageUrl: (id: string) => string | null
}) {
  const imageUrl = getCommanderImageUrl(commander.id)
  return (
    <div className="border-border-default bg-surface-0/50 group relative flex min-h-[76px] min-w-0 flex-1 rounded-md border">
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
      <div className="relative z-10 flex min-h-[76px] flex-1 items-center px-3">
        <span className="text-shadow-sm text-text-secondary text-sm font-medium shadow-black">
          {commander.name}
        </span>
      </div>
    </div>
  )
}

/** Edit mode: search input + status + partner/background suggestions */
function CommanderSlotEdit({
  slotNumber,
  inputValue,
  onInputChange,
  onCardResolved,
  onClear,
  status,
  allowsSecondCommander,
  suggestionsLabel,
  suggestions,
  dualKeywords,
  specificPartner,
  onQuickFillCommander2,
}: {
  slotNumber: 1 | 2
  inputValue: string
  onInputChange: (value: string) => void
  onCardResolved: (card: ScryfallCard | null) => void
  onClear: () => void
  status: 'idle' | 'saving' | 'saved' | 'error'
  allowsSecondCommander?: boolean
  suggestionsLabel?: string
  suggestions?: string[]
  dualKeywords?: string[]
  specificPartner?: string | null
  onQuickFillCommander2?: (name: string) => void
}) {
  const [isSearching, setIsSearching] = useState(false)
  return (
    <>
      <div className="relative flex h-[38px] w-full items-center">
        <div className="relative h-9 min-w-0 flex-1">
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
            className="border-border-default bg-surface-1 placeholder:text-text-muted hover:border-border-default focus-visible:ring-brand h-9 w-full min-w-0 pr-10 text-sm text-white transition-colors"
            suggestions={slotNumber === 2 ? suggestions : undefined}
            suggestionsLabel={slotNumber === 2 ? suggestionsLabel : undefined}
            hideLoadingIndicator
            onLoadingChange={setIsSearching}
          />
          <div className="pointer-events-none absolute right-3 top-1/2 flex -translate-y-1/2 items-center">
            {isSearching ? (
              <Loader2 className="text-text-muted h-4 w-4 animate-spin" />
            ) : status === 'saving' ? (
              <Loader2 className="text-brand-muted-foreground h-4 w-4 animate-spin" />
            ) : status === 'saved' ? (
              <button
                type="button"
                className="text-success hover:text-destructive pointer-events-auto rounded p-0.5 [&:hover_.icon-check]:hidden [&:hover_.icon-remove]:block"
                onClick={onClear}
                title="Clear"
                aria-label="Clear commander"
              >
                <Check className="icon-check h-4 w-4" />
                <Trash2 className="icon-remove hidden h-4 w-4" />
              </button>
            ) : status === 'error' ? (
              <AlertCircle className="text-destructive h-4 w-4" />
            ) : null}
          </div>
        </div>
      </div>
      {slotNumber === 1 && dualKeywords && dualKeywords.length > 0 && (
        <div className="text-brand-muted-foreground mt-2 text-xs">
          {specificPartner ? (
            <p className="text-xs">
              Partner with{' '}
              <button
                type="button"
                onClick={() => onQuickFillCommander2?.(specificPartner)}
                className="text-brand-muted-foreground decoration-brand/50 hover:text-brand-muted-foreground hover:decoration-brand-muted-foreground cursor-pointer text-xs font-medium underline underline-offset-2"
              >
                {specificPartner}
              </button>
            </p>
          ) : suggestions &&
            suggestions.length > 0 &&
            suggestions.length <= 5 ? (
            <div className="flex flex-wrap items-center gap-1 text-xs">
              <span>{suggestionsLabel}:</span>
              {suggestions.map((name, idx) => (
                <span key={name}>
                  <button
                    type="button"
                    onClick={() => onQuickFillCommander2?.(name)}
                    className="text-brand-muted-foreground decoration-brand/50 hover:text-brand-muted-foreground hover:decoration-brand-muted-foreground cursor-pointer text-xs font-medium underline underline-offset-2"
                  >
                    {name}
                  </button>
                  {idx < suggestions.length - 1 && ', '}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs">{dualKeywords.join(', ')} detected</p>
          )}
        </div>
      )}
    </>
  )
}

function CommanderSlot({
  slotNumber,
  commander,
  isEditing,
  getCommanderImageUrl,
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
  if (!commander && !isEditing) return null

  if (isEditing) {
    return (
      <CommanderSlotEdit
        slotNumber={slotNumber}
        inputValue={inputValue}
        onInputChange={onInputChange}
        onCardResolved={onCardResolved}
        onClear={onClear}
        status={status}
        allowsSecondCommander={allowsSecondCommander}
        suggestionsLabel={suggestionsLabel}
        suggestions={suggestions}
        dualKeywords={dualKeywords}
        specificPartner={specificPartner}
        onQuickFillCommander2={onQuickFillCommander2}
      />
    )
  }

  if (!commander) return null
  return (
    <CommanderSlotView
      commander={commander}
      getCommanderImageUrl={getCommanderImageUrl}
    />
  )
}
