import type { Participant } from '@/types/participant'
import { useState } from 'react'
import { useMutation } from 'convex/react'
import { Heart, Minus, Plus, Skull } from 'lucide-react'
import { toast } from 'sonner'
import type { Doc } from '../../../../convex/_generated/dataModel'

import { Button } from '@repo/ui/components/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@repo/ui/components/tooltip'

import { api } from '../../../../convex/_generated/api'
import { GameStatsPanel } from './GameStatsPanel'

interface PlayerStatsOverlayProps {
  roomId: string
  participant: Participant
  currentUser: Participant
  participants: Participant[]
}

export function PlayerStatsOverlay({
  roomId,
  participant,
  currentUser,
  participants,
}: PlayerStatsOverlayProps) {
  // Use roomId as-is - roomPlayers table stores full roomId including "game-" prefix
  const convexRoomId = roomId
  const [panelOpen, setPanelOpen] = useState(false)

  // Helper function for optimistic updates on player queries
  type RoomPlayer = Doc<'roomPlayers'>
  
  const updatePlayerQueriesOptimistically = (
    localStore: Parameters<
      Parameters<
        ReturnType<typeof useMutation<typeof api.rooms.updatePlayerHealth>>['withOptimisticUpdate']
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

    const activePlayers = localStore.getQuery(
      api.players.listActivePlayers,
      { roomId },
    )
    if (activePlayers !== undefined) {
      const nextActive = activePlayers.map((player: RoomPlayer) =>
        player.userId === userId ? updater(player) : player,
      )
      localStore.setQuery(
        api.players.listActivePlayers,
        { roomId },
        nextActive,
      )
    }
  }

  // Convex mutations with optimistic updates
  const updateHealth = useMutation(api.rooms.updatePlayerHealth)
    .withOptimisticUpdate((localStore, args) => {
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

  const updatePoison = useMutation(api.rooms.updatePlayerPoison)
    .withOptimisticUpdate((localStore, args) => {
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

  const handleHealthChange = (delta: number) => {
    updateHealth({
      roomId: convexRoomId,
      userId: participant.id,
      delta,
    }).catch(() => {
      toast.error('Failed to update health')
    })
  }

  const handlePoisonChange = (delta: number) => {
    updatePoison({
      roomId: convexRoomId,
      userId: participant.id,
      delta,
    }).catch(() => {
      toast.error('Failed to update poison')
    })
  }

  // Determine if this is the current user (affects UI emphasis or layout, though controls are available for all)
  const isMe = participant.id === currentUser.id

  // Calculate total commander damage
  const totalCommanderDamage = Object.values(participant.commanderDamage ?? {}).reduce(
    (sum, damage) => sum + damage,
    0,
  )

  // Clamp health and poison to 0 minimum for display
  const displayHealth = Math.max(0, participant.health ?? 0)
  const displayPoison = Math.max(0, participant.poison ?? 0)

  return (
    <>
      <div className="absolute left-3 top-16 z-10 flex flex-col gap-1.5 rounded-lg border border-slate-800 bg-slate-950/90 p-2 opacity-80 backdrop-blur-sm transition-opacity hover:bg-slate-950 hover:opacity-100">
        {/* Life */}
        <div className="flex items-center justify-between gap-3">
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex cursor-help items-center gap-1.5 text-red-400">
                <Heart className="h-4 w-4" />
                <span className="min-w-[2ch] text-center font-mono font-bold text-white">
                  {displayHealth}
                </span>
              </div>
            </TooltipTrigger>
            <TooltipContent side="right">Life Total</TooltipContent>
          </Tooltip>

          <div className="flex gap-0.5">
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6 rounded-md text-slate-400 hover:bg-red-900/20 hover:text-red-400"
              onClick={() => handleHealthChange(-1)}
              disabled={displayHealth <= 0}
            >
              <Minus className="h-3 w-3" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6 rounded-md text-slate-400 hover:bg-green-900/20 hover:text-green-400"
              onClick={() => handleHealthChange(1)}
            >
              <Plus className="h-3 w-3" />
            </Button>
          </div>
        </div>

        {/* Poison */}
        <div className="flex items-center justify-between gap-3">
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex cursor-help items-center gap-1.5 text-green-400">
                <Skull className="h-4 w-4" />
                <span className="min-w-[2ch] text-center font-mono font-bold text-white">
                  {displayPoison}
                </span>
              </div>
            </TooltipTrigger>
            <TooltipContent side="right">Poison Counters</TooltipContent>
          </Tooltip>

          <div className="flex gap-0.5">
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6 rounded-md text-slate-400 hover:bg-red-900/20 hover:text-red-400"
              onClick={() => handlePoisonChange(-1)}
              disabled={displayPoison <= 0}
            >
              <Minus className="h-3 w-3" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6 rounded-md text-slate-400 hover:bg-green-900/20 hover:text-green-400"
              onClick={() => handlePoisonChange(1)}
            >
              <Plus className="h-3 w-3" />
            </Button>
          </div>
        </div>

        {/* Commander Damage */}
        {totalCommanderDamage > 0 && (
          <div className="flex items-center justify-between gap-3 border-t border-slate-800 pt-1.5">
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex cursor-help items-center gap-1.5 text-purple-400">
                  <span className="text-[10px] font-medium uppercase tracking-wide">
                    CMD
                  </span>
                  <span className="min-w-[2ch] text-center font-mono text-xs font-bold text-white">
                    {totalCommanderDamage}
                  </span>
                </div>
              </TooltipTrigger>
              <TooltipContent side="right">
                Total Commander Damage ({totalCommanderDamage >= 21 ? 'Lethal' : `${21 - totalCommanderDamage} to lethal`})
              </TooltipContent>
            </Tooltip>
          </div>
        )}

        {/* Commander Damage Panel Toggle */}
        <Button
          variant="ghost"
          size="sm"
          className="mt-1 h-6 w-full text-[10px] text-slate-400 hover:bg-purple-900/20 hover:text-purple-300"
          onClick={() => setPanelOpen(true)}
        >
          COMMANDERS
        </Button>
      </div>

      <GameStatsPanel
        isOpen={panelOpen}
        onClose={() => setPanelOpen(false)}
        roomId={roomId}
        currentUser={currentUser}
        participants={participants}
        defaultTab={isMe ? 'setup' : 'damage'}
        selectedPlayer={participant}
      />
    </>
  )
}
