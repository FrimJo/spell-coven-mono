import { useState } from 'react'
import { ArrowLeft, Check, Copy, Settings, Users } from 'lucide-react'
import { toast } from 'sonner'

import { PlayerList } from './PlayerList'
import { TurnTracker } from './TurnTracker'
import { Button } from './ui/button'
import { Toaster } from './ui/sonner'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './ui/tooltip'
import { VideoStreamGrid } from './VideoStreamGrid'

interface GameRoomProps {
  gameId: string
  playerName: string
  onLeaveGame: () => void
  isLobbyOwner?: boolean
}

interface Player {
  id: string
  name: string
  life: number
  isActive: boolean
}

export function GameRoom({
  gameId,
  playerName,
  onLeaveGame,
  isLobbyOwner = true,
}: GameRoomProps) {
  const [copied, setCopied] = useState(false)
  const [players, setPlayers] = useState<Player[]>([
    { id: '1', name: playerName, life: 20, isActive: true },
    { id: '2', name: 'Alex', life: 20, isActive: false },
    { id: '3', name: 'Jordan', life: 20, isActive: false },
    { id: '4', name: 'Sam', life: 20, isActive: false },
  ])

  const handleCopyGameId = () => {
    navigator.clipboard.writeText(gameId)
    setCopied(true)
    toast.success('Game ID copied to clipboard!')
    setTimeout(() => setCopied(false), 2000)
  }

  const handleLifeChange = (playerId: string, newLife: number) => {
    setPlayers(
      players.map((p) => (p.id === playerId ? { ...p, life: newLife } : p)),
    )
  }

  const handleNextTurn = () => {
    const currentIndex = players.findIndex((p) => p.isActive)
    const nextIndex = (currentIndex + 1) % players.length
    setPlayers(
      players.map((p, i) => ({
        ...p,
        isActive: i === nextIndex,
      })),
    )
  }

  const handleRemovePlayer = (playerId: string) => {
    setPlayers(players.filter((p) => p.id !== playerId))
    toast.success('Player removed from game')
  }

  return (
    <div className="flex h-screen flex-col bg-slate-950">
      <Toaster />

      {/* Header */}
      <header className="flex-shrink-0 border-b border-slate-800 bg-slate-900/50 backdrop-blur-sm">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-4">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onLeaveGame}
                    className="text-slate-400 hover:text-white"
                  >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Leave
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Leave game room</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <div className="h-6 w-px bg-slate-700" />

            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-400">Game ID:</span>
              <code className="rounded bg-slate-800 px-2 py-1 text-sm text-purple-400">
                {gameId}
              </code>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopyGameId}
                className="text-slate-400 hover:text-white"
              >
                {copied ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-slate-400">
              <Users className="h-4 w-4" />
              <span className="text-sm">{players.length}/4 Players</span>
            </div>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-slate-400 hover:text-white"
                  >
                    <Settings className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Game settings</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        <div className="flex h-full gap-4 p-4">
          {/* Left Sidebar - Turn Tracker & Player List */}
          <div className="w-64 flex-shrink-0 space-y-4 overflow-y-auto">
            <TurnTracker players={players} onNextTurn={handleNextTurn} />
            <PlayerList
              players={players}
              isLobbyOwner={isLobbyOwner}
              localPlayerName={playerName}
              onRemovePlayer={handleRemovePlayer}
            />
          </div>

          {/* Main Area - Video Stream Grid */}
          <div className="flex-1 overflow-hidden">
            <VideoStreamGrid
              players={players}
              localPlayerName={playerName}
              onLifeChange={handleLifeChange}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
