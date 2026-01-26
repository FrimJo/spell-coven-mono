import type { Participant } from '@/types/participant'
import { useEffect, useState } from 'react'
import { searchBackgrounds, searchByKeyword } from '@/lib/scryfall'
import { useMutation } from '@tanstack/react-query'
import { useMutation as useConvexMutation } from 'convex/react'
import {
  AlertCircle,
  Check,
  Loader2,
  Shield,
  Swords,
  UserCog,
} from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@repo/ui/components/button'
import { Label } from '@repo/ui/components/label'
import { ScrollArea } from '@repo/ui/components/scroll-area'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@repo/ui/components/sheet'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@repo/ui/components/tabs'

import { api } from '../../../../convex/_generated/api'
import { CommanderSearchInput, useCommanderPair } from './CommanderSearchInput'

interface GameStatsPanelProps {
  isOpen: boolean
  onClose: () => void
  roomId: string
  currentUser: Participant
  participants: Participant[]
  defaultTab?: 'damage' | 'setup'
  /** The player whose setup tab is being viewed/edited (defaults to currentUser) */
  selectedPlayer?: Participant
}

export function GameStatsPanel({
  isOpen,
  onClose,
  roomId,
  currentUser,
  participants,
  defaultTab = 'damage',
  selectedPlayer,
}: GameStatsPanelProps) {
  // The player whose setup we're viewing/editing (defaults to current user)
  const setupPlayer = selectedPlayer ?? currentUser
  const isViewingOwnSetup = setupPlayer.id === currentUser.id
  // Strip "game-" prefix to match Convex database format
  const convexRoomId = roomId.replace(/^game-/, '')

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
    // Check if ID looks like a UUID (Scryfall IDs are UUIDs)
    if (
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
    ) {
      return `https://api.scryfall.com/cards/${id}?format=image&version=art_crop`
    }
    return null
  }

  // React Query mutation for saving commanders - handles all async state
  const saveCommandersMutation = useMutation({
    mutationFn: async ({ commanders }: SaveCommandersInput) => {
      console.log('[GameStatsPanel] Saving commanders:', {
        roomId: convexRoomId,
        userId: setupPlayer.id,
        commanders,
      })
      return setCommandersMutation({
        roomId: convexRoomId,
        userId: setupPlayer.id,
        commanders,
      })
    },
    onSuccess: () => {
      console.log('[GameStatsPanel] Commanders saved successfully')
      toast.success('Commanders saved!')
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
    setupPlayer.commanders[0]?.name ?? '',
    setupPlayer.commanders[1]?.name ?? '',
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

    // Determine IDs
    // If a new ID is provided (from resolution), use it.
    // Otherwise try to keep existing ID if name matches, or default to placeholder.

    // Logic for Commander 1 ID:
    let c1Id = newIds?.c1
    if (!c1Id) {
      // If we didn't just resolve it, check if name matches existing
      if (commander1.trim() === setupPlayer.commanders[0]?.name) {
        c1Id = setupPlayer.commanders[0]?.id
      } else if (commander1.trim() === cmdState.commander1Card?.name) {
        // If it matches local state card
        c1Id = cmdState.commander1Card?.id
      }
    }
    c1Id = c1Id ?? setupPlayer.commanders[0]?.id ?? 'c1'

    // Logic for Commander 2 ID:
    let c2Id = newIds?.c2
    if (!c2Id) {
      if (commander2.trim() === setupPlayer.commanders[1]?.name) {
        c2Id = setupPlayer.commanders[1]?.id
      } else if (commander2.trim() === cmdState.commander2Card?.name) {
        c2Id = cmdState.commander2Card?.id
      }
    }
    c2Id = c2Id ?? setupPlayer.commanders[1]?.id ?? 'c2'

    if (commander1.trim()) {
      commanders.push({
        id: c1Id,
        name: commander1.trim(),
      })
    }
    if (commander2.trim()) {
      commanders.push({
        id: c2Id,
        name: commander2.trim(),
      })
    }
    saveCommandersMutation.mutate({ commanders, triggeredBy })
  }

  // Wrapper to auto-save when Commander 1 is selected
  const onCommander1Resolved = (
    card: Parameters<typeof baseOnCommander1Resolved>[0],
  ) => {
    baseOnCommander1Resolved(card)
    if (card) {
      // Save with the new commander 1 name and ID, and current commander 2
      saveCommanders(card.name, cmdState.commander2Name, 1, { c1: card.id })
    }
  }

  // Wrapper to auto-save when Commander 2 is selected
  const onCommander2Resolved = (
    card: Parameters<typeof baseOnCommander2Resolved>[0],
  ) => {
    baseOnCommander2Resolved(card)
    if (card) {
      // Save with current commander 1 and the new commander 2 name and ID
      saveCommanders(cmdState.commander1Name, card.name, 2, { c2: card.id })
    }
  }

  // Quick-fill Commander 2 from a suggestion link
  const handleQuickFillCommander2 = async (name: string) => {
    setCommander2Name(name)
    // Resolve the card to get full data
    const { getCardByName } = await import('@/lib/scryfall')
    const card = await getCardByName(name, false)
    if (card) {
      baseOnCommander2Resolved(card)
      // Save with resolved ID
      saveCommanders(cmdState.commander1Name, name, 2, { c2: card.id })
    } else {
      // Fallback save without ID update if resolution fails
      saveCommanders(cmdState.commander1Name, name, 2)
    }
  }

  // Derive status for each commander input using React Query state
  const lastTriggeredBy = saveCommandersMutation.variables?.triggeredBy

  const getCommanderStatus = (
    commanderNum: 1 | 2,
    hasExistingCommander: boolean,
  ): 'idle' | 'saving' | 'saved' | 'error' => {
    // If this commander triggered the current/last mutation
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
    // Show saved if commander already exists from database
    if (hasExistingCommander) {
      return 'saved'
    }
    return 'idle'
  }

  const commander1Status = getCommanderStatus(
    1,
    Boolean(setupPlayer.commanders[0]?.name),
  )
  const commander2Status = getCommanderStatus(
    2,
    Boolean(setupPlayer.commanders[1]?.name),
  )

  // Fetch Commander 2 suggestions when Commander 1 is resolved
  useEffect(() => {
    const { dualKeywords, specificPartner, commander1Name, commander1Card } =
      cmdState

    // Only run when we have a resolved card
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
      // Partner with: show specific partner
      if (dualKeywords.includes('Partner with') && specificPartner) {
        if (!cancelled) {
          setCommander2Suggestions([specificPartner])
          setSuggestionsLabel('Partner')
        }
        return
      }

      // Choose a background: search for backgrounds
      if (dualKeywords.includes('Choose a background')) {
        const backgrounds = await searchBackgrounds()
        if (!cancelled) {
          setCommander2Suggestions(backgrounds.map((c) => c.name).slice(0, 20))
          setSuggestionsLabel('Backgrounds')
        }
        return
      }

      // Partner (generic): search for other partners
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

      // Friends forever
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

      // Doctor's companion
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
    // Use commander1Card's id as stable dependency instead of the object
  }, [cmdState.commander1Card?.id])

  const handleUpdateDamage = (
    ownerUserId: string,
    commanderId: string,
    delta: number,
  ) => {
    updateCommanderDamage({
      roomId: convexRoomId,
      userId: currentUser.id, // I am taking damage
      ownerUserId, // From this owner
      commanderId, // From this commander
      delta,
    })
  }

  // Filter out self from opponents
  const opponents = participants.filter((p) => p.id !== currentUser.id)

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        className="w-[400px] border-l-slate-800 bg-slate-950 text-slate-100 sm:w-[540px]"
      >
        <SheetHeader>
          <SheetTitle className="text-slate-100">
            Game Stats & Commanders
          </SheetTitle>
          <SheetDescription className="text-slate-400">
            Track commander damage and manage your commander details.
          </SheetDescription>
        </SheetHeader>

        <Tabs defaultValue={defaultTab} className="flex h-full flex-col px-4">
          <TabsList className="grid w-full grid-cols-2 bg-slate-900">
            <TabsTrigger
              value="damage"
              className="transition-colors hover:bg-slate-800/60 hover:text-slate-200 data-[state=active]:bg-slate-800 data-[state=active]:text-slate-100"
            >
              <Shield className="mr-2 h-4 w-4" />
              Damage Tracker
            </TabsTrigger>
            <TabsTrigger
              value="setup"
              className="transition-colors hover:bg-slate-800/60 hover:text-slate-200 data-[state=active]:bg-slate-800 data-[state=active]:text-slate-100"
            >
              <UserCog className="mr-2 h-4 w-4" />
              {isViewingOwnSetup ? 'My Setup' : `${setupPlayer.username}'s Setup`}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="damage" className="flex-1 overflow-hidden pt-4">
            <ScrollArea className="h-[calc(100vh-200px)] pr-4">
              <div className="space-y-6">
                {/* My own commanders section */}
                {currentUser.commanders.length > 0 && (
                  <div className="rounded-lg border border-purple-800/50 bg-purple-900/20 p-4">
                    <div className="mb-3 flex items-center gap-2 border-b border-purple-800/50 pb-2">
                      <span className="font-semibold text-purple-200">
                        My Commanders
                      </span>
                    </div>
                    <div className="space-y-4">
                      {currentUser.commanders.map((cmd) => {
                        const damageKey = `${currentUser.id}:${cmd.id}`
                        const currentDamage =
                          currentUser.commanderDamage[damageKey] ?? 0
                        const isLethal = currentDamage >= 21

                        return (
                          <div
                            key={cmd.id}
                            className="group relative overflow-hidden rounded-md border border-purple-500/30 bg-purple-950/20"
                          >
                            {/* Commander Background Image */}
                            {getCommanderImageUrl(cmd.id) && (
                              <div className="absolute inset-0 z-0">
                                <img
                                  src={getCommanderImageUrl(cmd.id)!}
                                  alt={cmd.name}
                                  className="absolute inset-0 h-full w-full object-cover opacity-40 transition-opacity duration-500 group-hover:opacity-60"
                                />
                                <div className="absolute inset-0 bg-gradient-to-r from-purple-950/80 via-purple-950/40 to-transparent" />
                              </div>
                            )}

                            <div className="relative z-10 flex items-center justify-between p-3">
                              <div className="flex flex-col gap-1">
                                <span className="text-shadow-sm text-sm font-medium text-purple-100 shadow-black">
                                  {cmd.name}
                                </span>
                                {isLethal && (
                                  <span className="flex items-center gap-1.5 rounded-full bg-red-500/10 px-2 py-0.5 text-xs font-bold text-red-400 backdrop-blur-sm">
                                    <Swords className="h-3 w-3" /> Lethal
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <Button
                                  size="icon"
                                  variant="outline"
                                  className="h-8 w-8 border-purple-500/30 bg-purple-900/60 text-purple-100 backdrop-blur-sm hover:bg-purple-800/80 hover:text-white"
                                  onClick={() =>
                                    handleUpdateDamage(
                                      currentUser.id,
                                      cmd.id,
                                      -1,
                                    )
                                  }
                                >
                                  -
                                </Button>
                                <span
                                  className={`text-shadow-sm min-w-[2rem] text-center font-mono text-lg font-bold shadow-black ${isLethal ? 'text-red-400' : 'text-purple-100'}`}
                                >
                                  {currentDamage}
                                </span>
                                <Button
                                  size="icon"
                                  variant="outline"
                                  className="h-8 w-8 border-purple-500/30 bg-purple-900/60 text-purple-100 backdrop-blur-sm hover:bg-purple-800/80 hover:text-white"
                                  onClick={() =>
                                    handleUpdateDamage(
                                      currentUser.id,
                                      cmd.id,
                                      1,
                                    )
                                  }
                                >
                                  +
                                </Button>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Opponents section */}
                {opponents.length === 0 &&
                currentUser.commanders.length === 0 ? (
                  <div className="py-8 text-center text-slate-500">
                    <p>No commanders to track.</p>
                  </div>
                ) : (
                  opponents.map((opponent) => (
                    <div
                      key={opponent.id}
                      className="rounded-lg border border-slate-800 bg-slate-900/50 p-4"
                    >
                      <div className="mb-3 flex items-center gap-2 border-b border-slate-800 pb-2">
                        <span className="font-semibold text-slate-200">
                          {opponent.username}
                        </span>
                        <span className="text-xs text-slate-500">
                          Commanders
                        </span>
                      </div>

                      {opponent.commanders.length === 0 ? (
                        <p className="text-sm italic text-slate-500">
                          No commanders set
                        </p>
                      ) : (
                        <div className="space-y-4">
                          {opponent.commanders.map((cmd) => {
                            const damageKey = `${opponent.id}:${cmd.id}`
                            const currentDamage =
                              currentUser.commanderDamage[damageKey] ?? 0
                            const isLethal = currentDamage >= 21

                            return (
                              <div
                                key={cmd.id}
                                className="group relative overflow-hidden rounded-md border border-slate-800 bg-slate-950/50"
                              >
                                {/* Commander Background Image */}
                                {getCommanderImageUrl(cmd.id) && (
                                  <div className="absolute inset-0 z-0">
                                    <img
                                      src={getCommanderImageUrl(cmd.id)!}
                                      alt={cmd.name}
                                      className="absolute inset-0 h-full w-full object-cover opacity-40 transition-opacity duration-500 group-hover:opacity-60"
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-r from-slate-950/80 via-slate-950/40 to-transparent" />
                                  </div>
                                )}

                                <div className="relative z-10 flex items-center justify-between p-3">
                                  <div className="flex flex-col gap-1">
                                    <span className="text-shadow-sm text-sm font-medium text-slate-200 shadow-black">
                                      {cmd.name}
                                    </span>
                                    {isLethal && (
                                      <span className="flex items-center gap-1.5 rounded-full bg-red-500/10 px-2 py-0.5 text-xs font-bold text-red-400 backdrop-blur-sm">
                                        <Swords className="h-3 w-3" /> Lethal
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Button
                                      size="icon"
                                      variant="outline"
                                      className="h-8 w-8 border-slate-700 bg-slate-900/80 text-slate-200 backdrop-blur-sm hover:bg-slate-800 hover:text-white"
                                      onClick={() =>
                                        handleUpdateDamage(
                                          opponent.id,
                                          cmd.id,
                                          -1,
                                        )
                                      }
                                    >
                                      -
                                    </Button>
                                    <span
                                      className={`text-shadow-sm min-w-[2rem] text-center font-mono text-lg font-bold shadow-black ${isLethal ? 'text-red-500' : 'text-slate-200'}`}
                                    >
                                      {currentDamage}
                                    </span>
                                    <Button
                                      size="icon"
                                      variant="outline"
                                      className="h-8 w-8 border-slate-700 bg-slate-900/80 text-slate-200 backdrop-blur-sm hover:bg-slate-800 hover:text-white"
                                      onClick={() =>
                                        handleUpdateDamage(
                                          opponent.id,
                                          cmd.id,
                                          1,
                                        )
                                      }
                                    >
                                      +
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="setup" className="pt-6">
            <div className="space-y-6">
              <div className="space-y-3">
                <Label htmlFor="c1" className="text-base text-slate-200">
                  Commander 1
                </Label>
                <div className="relative">
                  <CommanderSearchInput
                    id="c1"
                    value={cmdState.commander1Name}
                    onChange={setCommander1Name}
                    onCardResolved={onCommander1Resolved}
                    placeholder="Search for a commander..."
                    className="h-10 border-slate-700 bg-slate-900 pr-10 text-slate-100 transition-colors placeholder:text-slate-500 hover:border-slate-500 focus-visible:ring-purple-500"
                  />
                  {commander1Status !== 'idle' && (
                    <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
                      {commander1Status === 'saving' && (
                        <Loader2 className="h-4 w-4 animate-spin text-purple-400" />
                      )}
                      {commander1Status === 'saved' && (
                        <Check className="h-4 w-4 text-green-400" />
                      )}
                      {commander1Status === 'error' && (
                        <AlertCircle className="h-4 w-4 text-red-400" />
                      )}
                    </div>
                  )}
                </div>
                {cmdState.dualKeywords.length > 0 && (
                  <div className="text-xs text-purple-400">
                    {/* Show specific partner as clickable link */}
                    {cmdState.specificPartner ? (
                      <p>
                        Partner with{' '}
                        <button
                          type="button"
                          onClick={() => {
                            if (cmdState.specificPartner) {
                              handleQuickFillCommander2(
                                cmdState.specificPartner,
                              )
                            }
                          }}
                          className="cursor-pointer font-medium text-purple-300 underline decoration-purple-500/50 underline-offset-2 hover:text-purple-200 hover:decoration-purple-400"
                        >
                          {cmdState.specificPartner}
                        </button>
                      </p>
                    ) : commander2Suggestions.length > 0 &&
                      commander2Suggestions.length <= 5 ? (
                      /* Show few suggestions as clickable links */
                      <div className="flex flex-wrap items-center gap-1">
                        <span>{suggestionsLabel}:</span>
                        {commander2Suggestions.map((name, idx) => (
                          <span key={name}>
                            <button
                              type="button"
                              onClick={() => handleQuickFillCommander2(name)}
                              className="cursor-pointer font-medium text-purple-300 underline decoration-purple-500/50 underline-offset-2 hover:text-purple-200 hover:decoration-purple-400"
                            >
                              {name}
                            </button>
                            {idx < commander2Suggestions.length - 1 && ', '}
                          </span>
                        ))}
                      </div>
                    ) : (
                      /* Just show the keywords */
                      <p>{cmdState.dualKeywords.join(', ')} detected</p>
                    )}
                  </div>
                )}
              </div>
              <div className="space-y-3">
                <Label htmlFor="c2" className="text-base text-slate-200">
                  Commander 2{' '}
                  {cmdState.allowsSecondCommander
                    ? `(${suggestionsLabel})`
                    : '(Partner)'}
                </Label>
                <div className="relative">
                  <CommanderSearchInput
                    id="c2"
                    value={cmdState.commander2Name}
                    onChange={setCommander2Name}
                    onCardResolved={onCommander2Resolved}
                    placeholder={
                      cmdState.allowsSecondCommander
                        ? `Search ${suggestionsLabel.toLowerCase()}...`
                        : 'Optional partner name'
                    }
                    className="h-10 border-slate-700 bg-slate-900 pr-10 text-slate-100 transition-colors placeholder:text-slate-500 hover:border-slate-500 focus-visible:ring-purple-500"
                    suggestions={commander2Suggestions}
                    suggestionsLabel={suggestionsLabel}
                  />
                  {commander2Status !== 'idle' && (
                    <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
                      {commander2Status === 'saving' && (
                        <Loader2 className="h-4 w-4 animate-spin text-purple-400" />
                      )}
                      {commander2Status === 'saved' && (
                        <Check className="h-4 w-4 text-green-400" />
                      )}
                      {commander2Status === 'error' && (
                        <AlertCircle className="h-4 w-4 text-red-400" />
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  )
}
