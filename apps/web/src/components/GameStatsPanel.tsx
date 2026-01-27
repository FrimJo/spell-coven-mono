import type { Participant } from '@/types/participant'
import type { ScryfallCard } from '@/lib/scryfall'
import { useEffect, useState } from 'react'
import { searchBackgrounds, searchByKeyword } from '@/lib/scryfall'
import { useMutation } from '@tanstack/react-query'
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
  X,
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

import { api } from '../../../../convex/_generated/api'
import { CommanderSearchInput, useCommanderPair } from './CommanderSearchInput'

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
  // Strip "game-" prefix to match Convex database format
  const convexRoomId = roomId.replace(/^game-/, '')

  // Track which commander slot is being edited (null = none, 1 or 2 = editing that slot)
  const [editingCommanderSlot, setEditingCommanderSlot] = useState<
    null | 1 | 2
  >(null)

  // Determine if viewed player has any commanders set
  const viewedPlayerHasCommanders =
    viewedPlayer.commanders.length > 0 &&
    viewedPlayer.commanders.some((c) => c?.name)

  // Collapse viewed player's own slot by default (self-damage is rare)
  // Expanded if no commanders are set (to encourage setup)
  const [viewedPlayerSlotCollapsed, setViewedPlayerSlotCollapsed] = useState(
    viewedPlayerHasCommanders,
  )

  // Reset collapsed state when panel opens or viewed player changes
  useEffect(() => {
    if (isOpen) {
      const hasCommanders = viewedPlayer.commanders.some((c) => c?.name)
      setViewedPlayerSlotCollapsed(hasCommanders)
    }
  }, [isOpen, viewedPlayer.id])

  // Convex mutation functions
  const setCommandersMutation = useConvexMutation(api.rooms.setPlayerCommanders)
  const updateCommanderDamage = useConvexMutation(
    api.rooms.updateCommanderDamage,
  )

  // Mutation variables type includes which commander triggered the save
  type SaveCommandersInput = {
    commanders: { id: string; name: string }[]
    triggeredBy: 1 | 2
  }

  // Helper to get Scryfall image URL from ID
  const getCommanderImageUrl = (id: string) => {
    if (
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
    ) {
      return `https://api.scryfall.com/cards/${id}?format=image&version=art_crop`
    }
    return null
  }

  // React Query mutation for saving commanders
  const saveCommandersMutation = useMutation({
    mutationFn: async ({ commanders }: SaveCommandersInput) => {
      console.log('[GameStatsPanel] Saving commanders:', {
        roomId: convexRoomId,
        userId: viewedPlayer.id,
        commanders,
      })
      return setCommandersMutation({
        roomId: convexRoomId,
        userId: viewedPlayer.id,
        commanders,
      })
    },
    onSuccess: () => {
      console.log('[GameStatsPanel] Commanders saved successfully')
      toast.success('Commanders saved!')
      setEditingCommanderSlot(null)
    },
    onError: (error) => {
      console.error('[GameStatsPanel] Failed to save commanders:', error)
      toast.error(
        error instanceof Error ? error.message : 'Failed to save commanders',
      )
    },
  })

  // Commander pair state with Scryfall integration
  const {
    state: cmdState,
    setCommander1Name,
    setCommander2Name,
    onCommander1Resolved: baseOnCommander1Resolved,
    onCommander2Resolved: baseOnCommander2Resolved,
  } = useCommanderPair(
    viewedPlayer.commanders[0]?.name ?? '',
    viewedPlayer.commanders[1]?.name ?? '',
  )

  // Suggestions for Commander 2 based on Commander 1's keywords
  const [commander2Suggestions, setCommander2Suggestions] = useState<string[]>(
    [],
  )
  const [suggestionsLabel, setSuggestionsLabel] = useState('Suggested')

  // Helper to build commanders array and save
  const saveCommanders = (
    commander1: string,
    commander2: string,
    triggeredBy: 1 | 2,
    newIds?: { c1?: string; c2?: string },
  ) => {
    const commanders = []

    let c1Id = newIds?.c1
    if (!c1Id) {
      if (commander1.trim() === viewedPlayer.commanders[0]?.name) {
        c1Id = viewedPlayer.commanders[0]?.id
      } else if (commander1.trim() === cmdState.commander1Card?.name) {
        c1Id = cmdState.commander1Card?.id
      }
    }
    c1Id = c1Id ?? viewedPlayer.commanders[0]?.id ?? 'c1'

    let c2Id = newIds?.c2
    if (!c2Id) {
      if (commander2.trim() === viewedPlayer.commanders[1]?.name) {
        c2Id = viewedPlayer.commanders[1]?.id
      } else if (commander2.trim() === cmdState.commander2Card?.name) {
        c2Id = cmdState.commander2Card?.id
      }
    }
    c2Id = c2Id ?? viewedPlayer.commanders[1]?.id ?? 'c2'

    if (commander1.trim()) {
      commanders.push({ id: c1Id, name: commander1.trim() })
    }
    if (commander2.trim()) {
      commanders.push({ id: c2Id, name: commander2.trim() })
    }
    saveCommandersMutation.mutate({ commanders, triggeredBy })
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

  // Remove a commander from any player
  const handleRemoveCommander = (player: Participant, slotNumber: 1 | 2) => {
    // Keep the other commander if it exists
    const keepSlot = slotNumber === 1 ? 1 : 0
    const keepCommander = player.commanders[keepSlot]
    const commanders = keepCommander?.name
      ? [{ id: keepCommander.id, name: keepCommander.name }]
      : []

    // If removing from viewed player, also clear local state
    if (player.id === viewedPlayer.id) {
      if (slotNumber === 1) {
        setCommander1Name('')
        baseOnCommander1Resolved(null)
      } else {
        setCommander2Name('')
        baseOnCommander2Resolved(null)
      }
    }

    setCommandersMutation({
      roomId: convexRoomId,
      userId: player.id,
      commanders,
    })
    toast.success('Commander removed')
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
    if (saveCommandersMutation.isSuccess && isTriggered) {
      return 'saved'
    }
    if (hasExistingCommander) {
      return 'saved'
    }
    return 'idle'
  }

  const commander1Status = getCommanderStatus(
    1,
    Boolean(viewedPlayer.commanders[0]?.name),
  )
  const commander2Status = getCommanderStatus(
    2,
    Boolean(viewedPlayer.commanders[1]?.name),
  )

  // Fetch Commander 2 suggestions when Commander 1 is resolved
  useEffect(() => {
    const { dualKeywords, specificPartner, commander1Name, commander1Card } =
      cmdState

    if (!commander1Card) {
      setCommander2Suggestions([])
      return
    }

    if (dualKeywords.length === 0) {
      setCommander2Suggestions([])
      return
    }

    let cancelled = false

    const fetchSuggestions = async () => {
      if (dualKeywords.includes('Partner with') && specificPartner) {
        if (!cancelled) {
          setCommander2Suggestions([specificPartner])
          setSuggestionsLabel('Partner')
        }
        return
      }

      if (dualKeywords.includes('Choose a background')) {
        const backgrounds = await searchBackgrounds()
        if (!cancelled) {
          setCommander2Suggestions(backgrounds.map((c) => c.name).slice(0, 20))
          setSuggestionsLabel('Backgrounds')
        }
        return
      }

      if (dualKeywords.includes('Partner')) {
        const partners = await searchByKeyword('Partner')
        if (!cancelled) {
          const filtered = partners
            .filter((c) => c.name !== commander1Name)
            .map((c) => c.name)
            .slice(0, 20)
          setCommander2Suggestions(filtered)
          setSuggestionsLabel('Partners')
        }
        return
      }

      if (dualKeywords.includes('Friends forever')) {
        const friends = await searchByKeyword('Friends forever')
        if (!cancelled) {
          const filtered = friends
            .filter((c) => c.name !== commander1Name)
            .map((c) => c.name)
            .slice(0, 20)
          setCommander2Suggestions(filtered)
          setSuggestionsLabel('Friends Forever')
        }
        return
      }

      if (dualKeywords.includes("Doctor's companion")) {
        const companions = await searchByKeyword("Doctor's companion")
        if (!cancelled) {
          const filtered = companions
            .filter((c) => c.name !== commander1Name)
            .map((c) => c.name)
            .slice(0, 20)
          setCommander2Suggestions(filtered)
          setSuggestionsLabel("Doctor's Companions")
        }
        return
      }

      if (!cancelled) {
        setCommander2Suggestions([])
      }
    }

    fetchSuggestions()

    return () => {
      cancelled = true
    }
  }, [cmdState.commander1Card?.id])

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
        className="w-[400px] border-l-slate-800 bg-slate-950 text-slate-100 sm:w-[540px]"
      >
        <SheetHeader className="pb-4">
          <SheetTitle className="flex items-center gap-2 text-slate-100">
            <UserCircle className="h-5 w-5 text-purple-400" />
            {isViewingOwnStats
              ? 'Your Commander Damage'
              : `${viewedPlayer.username}'s Commander Damage`}
          </SheetTitle>
          <SheetDescription className="text-slate-400">
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
              // Anyone can edit anyone's commanders
              const canEditCommanders = true
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
                    className="rounded-lg border border-slate-800 bg-slate-900/50 p-3"
                  >
                    <button
                      type="button"
                      onClick={() => setViewedPlayerSlotCollapsed(false)}
                      className="flex w-full items-center gap-2 text-left"
                    >
                      {player.avatar ? (
                        <img
                          src={player.avatar}
                          alt={player.username}
                          className="h-5 w-5 rounded-full"
                        />
                      ) : (
                        <User className="h-4 w-4 text-slate-400" />
                      )}
                      <span className="font-semibold text-slate-200">
                        {player.username}
                        {isCurrentUser && (
                          <span className="ml-1.5 text-xs font-normal text-slate-500">
                            (You)
                          </span>
                        )}
                      </span>
                      <span className="rounded-full bg-purple-500/20 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-purple-300">
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
                              className="h-6 w-6 rounded-full border border-slate-600 object-cover"
                            />
                          ) : (
                            <span
                              className="flex h-6 w-6 items-center justify-center rounded-full border border-dashed border-slate-600 bg-slate-900/50"
                              title="Commander 1 not set"
                            >
                              <Plus className="h-3 w-3 text-slate-500" />
                            </span>
                          )}
                          {cmd2ImageUrl ? (
                            <img
                              src={cmd2ImageUrl}
                              alt={commander2?.name}
                              title={commander2?.name}
                              className="h-6 w-6 rounded-full border border-slate-600 object-cover"
                            />
                          ) : (
                            <span
                              className="flex h-6 w-6 items-center justify-center rounded-full border border-dashed border-slate-600 bg-slate-900/50"
                              title="Commander 2 not set"
                            >
                              <Plus className="h-3 w-3 text-slate-500" />
                            </span>
                          )}
                        </span>
                        <ChevronDown className="h-4 w-4 text-slate-400" />
                      </span>
                    </button>
                  </div>
                )
              }

              return (
                <div
                  key={player.id}
                  className="rounded-lg border border-slate-800 bg-slate-900/50 p-4"
                >
                  {/* Player header */}
                  <div className="mb-3 flex items-center gap-2 border-b border-slate-800 pb-2">
                    {player.avatar ? (
                      <img
                        src={player.avatar}
                        alt={player.username}
                        className="h-6 w-6 rounded-full"
                      />
                    ) : (
                      <User className="h-5 w-5 text-slate-400" />
                    )}
                    <span className="font-semibold text-slate-200">
                      {player.username}
                      {isCurrentUser && (
                        <span className="ml-1.5 text-xs font-normal text-slate-500">
                          (You)
                        </span>
                      )}
                    </span>
                    {isViewedPlayer && (
                      <>
                        <span className="rounded-full bg-purple-500/20 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-purple-300">
                          Viewing
                        </span>
                        {viewedPlayerHasCommanders && (
                          <button
                            type="button"
                            onClick={() => setViewedPlayerSlotCollapsed(true)}
                            className="ml-auto rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                            title="Minimize"
                          >
                            <ChevronUp className="h-4 w-4" />
                          </button>
                        )}
                      </>
                    )}
                  </div>

                  {/* Commander slots */}
                  <div className="space-y-3">
                    {/* Commander 1 */}
                    <CommanderSlot
                      slotNumber={1}
                      commander={player.commanders[0]}
                      damage={
                        player.commanders[0]
                          ? viewedPlayer.commanderDamage[
                              `${player.id}:${player.commanders[0].id}`
                            ] ?? 0
                          : 0
                      }
                      isEditing={canEditCommanders && editingCommanderSlot === 1}
                      canEdit={canEditCommanders}
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
                      onStartEdit={() => setEditingCommanderSlot(1)}
                      onCancelEdit={() => setEditingCommanderSlot(null)}
                      onRemove={() => handleRemoveCommander(player, 1)}
                      // Edit props
                      inputValue={cmdState.commander1Name}
                      onInputChange={setCommander1Name}
                      onCardResolved={onCommander1Resolved}
                      status={commander1Status}
                      dualKeywords={cmdState.dualKeywords}
                      specificPartner={cmdState.specificPartner}
                      suggestions={commander2Suggestions}
                      suggestionsLabel={suggestionsLabel}
                      onQuickFillCommander2={handleQuickFillCommander2}
                    />

                    {/* Commander 2 */}
                    <CommanderSlot
                      slotNumber={2}
                      commander={player.commanders[1]}
                      damage={
                        player.commanders[1]
                          ? viewedPlayer.commanderDamage[
                              `${player.id}:${player.commanders[1].id}`
                            ] ?? 0
                          : 0
                      }
                      isEditing={canEditCommanders && editingCommanderSlot === 2}
                      canEdit={canEditCommanders}
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
                      onStartEdit={() => setEditingCommanderSlot(2)}
                      onCancelEdit={() => setEditingCommanderSlot(null)}
                      onRemove={() => handleRemoveCommander(player, 2)}
                      // Edit props
                      inputValue={cmdState.commander2Name}
                      onInputChange={setCommander2Name}
                      onCardResolved={onCommander2Resolved}
                      status={commander2Status}
                      allowsSecondCommander={cmdState.allowsSecondCommander}
                      suggestions={commander2Suggestions}
                      suggestionsLabel={suggestionsLabel}
                    />
                  </div>
                </div>
              )
            })}

            {/* Vacant slots */}
            {vacantSlots.map((slot) => (
              <div
                key={`vacant-${slot.index}`}
                className="rounded-lg border border-dashed border-slate-700 bg-slate-900/30 p-4"
              >
                <div className="flex items-center gap-2 text-slate-500">
                  <User className="h-5 w-5" />
                  <span className="font-medium">Empty Seat</span>
                </div>
                <p className="mt-2 text-sm text-slate-600">
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
  canEdit: boolean
  isViewedPlayer: boolean
  getCommanderImageUrl: (id: string) => string | null
  onDamageChange: (delta: number) => void
  onStartEdit: () => void
  onCancelEdit: () => void
  onRemove?: () => void
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
  canEdit,
  isViewedPlayer,
  getCommanderImageUrl,
  onDamageChange,
  onStartEdit,
  onCancelEdit,
  onRemove,
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
  const isLethal = damage >= 21
  const imageUrl = commander ? getCommanderImageUrl(commander.id) : null

  // Empty slot - show placeholder with Set action
  if (!commander && !isEditing) {
    return (
      <div className="flex items-center justify-between rounded-md border border-dashed border-slate-700 bg-slate-950/30 p-3">
        <span className="text-sm text-slate-500">
          Commander {slotNumber} not set
        </span>
        {canEdit && (
          <Button
            size="sm"
            variant="outline"
            className="h-7 border-slate-600 bg-slate-800/50 text-slate-300 hover:bg-slate-700 hover:text-slate-100"
            onClick={onStartEdit}
          >
            <Plus className="mr-1 h-3 w-3" />
            Set
          </Button>
        )}
      </div>
    )
  }

  // Edit mode - show search input
  if (isEditing) {
    return (
      <div className="rounded-md border border-slate-700 bg-slate-950/50 p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-medium text-slate-400">
            Commander {slotNumber}
            {slotNumber === 2 &&
              (allowsSecondCommander
                ? ` (${suggestionsLabel})`
                : ' (Partner)')}
          </span>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-xs text-slate-400 hover:text-slate-200"
            onClick={onCancelEdit}
          >
            Cancel
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
            className="h-9 border-slate-700 bg-slate-900 pr-10 text-sm text-slate-100 transition-colors placeholder:text-slate-500 hover:border-slate-500 focus-visible:ring-purple-500"
            suggestions={slotNumber === 2 ? suggestions : undefined}
            suggestionsLabel={slotNumber === 2 ? suggestionsLabel : undefined}
          />
          {status !== 'idle' && (
            <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
              {status === 'saving' && (
                <Loader2 className="h-4 w-4 animate-spin text-purple-400" />
              )}
              {status === 'saved' && (
                <Check className="h-4 w-4 text-green-400" />
              )}
              {status === 'error' && (
                <AlertCircle className="h-4 w-4 text-red-400" />
              )}
            </div>
          )}
        </div>
        {/* Show partner suggestions for slot 1 */}
        {slotNumber === 1 && dualKeywords && dualKeywords.length > 0 && (
          <div className="mt-2 text-xs text-purple-400">
            {specificPartner ? (
              <p>
                Partner with{' '}
                <button
                  type="button"
                  onClick={() => onQuickFillCommander2?.(specificPartner)}
                  className="cursor-pointer font-medium text-purple-300 underline decoration-purple-500/50 underline-offset-2 hover:text-purple-200 hover:decoration-purple-400"
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
                      className="cursor-pointer font-medium text-purple-300 underline decoration-purple-500/50 underline-offset-2 hover:text-purple-200 hover:decoration-purple-400"
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
    <div className="group relative overflow-hidden rounded-md border border-slate-800 bg-slate-950/50">
      {/* Commander Background Image */}
      {imageUrl && (
        <div className="absolute inset-0 z-0">
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
            <span className="text-shadow-sm text-sm font-medium text-slate-200 shadow-black">
              {commander.name}
            </span>
            {canEdit && (
              <div className="flex items-center gap-0.5">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-5 w-5 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                  onClick={onStartEdit}
                  title="Edit commander"
                >
                  <Pencil className="h-3 w-3" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-5 w-5 text-slate-400 hover:bg-red-900/50 hover:text-red-400"
                  onClick={onRemove}
                  title="Remove commander"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            )}
          </div>
          {isLethal && (
            <span className="flex items-center gap-1.5 rounded-full bg-red-500/10 px-2 py-0.5 text-xs font-bold text-red-400 backdrop-blur-sm">
              <Swords className="h-3 w-3" /> Lethal
            </span>
          )}
        </div>

        {/* Damage counter */}
        <div className="flex items-center gap-2">
          <Button
            size="icon"
            variant="outline"
            className="h-8 w-8 border-slate-700 bg-slate-900/80 text-slate-200 backdrop-blur-sm hover:bg-slate-800 hover:text-white"
            onClick={() => onDamageChange(-1)}
          >
            -
          </Button>
          <span
            className={`text-shadow-sm min-w-[2rem] text-center font-mono text-lg font-bold shadow-black ${
              isLethal ? 'text-red-400' : 'text-slate-200'
            }`}
          >
            {damage}
          </span>
          <Button
            size="icon"
            variant="outline"
            className="h-8 w-8 border-slate-700 bg-slate-900/80 text-slate-200 backdrop-blur-sm hover:bg-slate-800 hover:text-white"
            onClick={() => onDamageChange(1)}
          >
            +
          </Button>
        </div>
      </div>
    </div>
  )
}
