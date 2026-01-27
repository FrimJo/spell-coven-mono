import type { Participant } from '@/types/participant'
import { useState } from 'react'
import { useMutation } from 'convex/react'
import { Heart, Minus, Plus, Skull } from 'lucide-react'

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
  // Strip "game-" prefix to match Convex database format
  const convexRoomId = roomId.replace(/^game-/, '')
  const [panelOpen, setPanelOpen] = useState(false)
  const updateHealth = useMutation(api.rooms.updatePlayerHealth)
  const updatePoison = useMutation(api.rooms.updatePlayerPoison)

  const handleHealthChange = (delta: number) => {
    updateHealth({ roomId: convexRoomId, userId: participant.id, delta })
  }

  const handlePoisonChange = (delta: number) => {
    updatePoison({ roomId: convexRoomId, userId: participant.id, delta })
  }

  // Determine if this is the current user (affects UI emphasis or layout, though controls are available for all)
  const isMe = participant.id === currentUser.id

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
                  {participant.health}
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
                  {participant.poison}
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
