import { Crown, Heart, UserX } from 'lucide-react'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@repo/ui/components/alert-dialog'
import { Button } from '@repo/ui/components/button'
import { Card } from '@repo/ui/components/card'

interface Player {
  id: string
  name: string
  isOnline?: boolean // Whether player is connected to backend (SSE)
}

interface PlayerListProps {
  players: Player[]
  isLobbyOwner: boolean
  localPlayerName: string
  onRemovePlayer: (playerId: string) => void
  ownerId?: string
}

export function PlayerList({
  players,
  isLobbyOwner,
  localPlayerName,
  onRemovePlayer,
  ownerId,
}: PlayerListProps) {
  return (
    <Card className="border-slate-800 bg-slate-900 p-4">
      <div className="space-y-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm text-slate-400">Players</span>
          <span className="text-xs text-slate-500">{players.length}/4</span>
        </div>

        <div className="space-y-2">
          {players.map((player) => {
            const isLocal = player.name === localPlayerName
            const isOwner = ownerId ? player.id === ownerId : player.id === '1' // Use provided ownerId or fallback to first player

            return (
              <div
                key={player.id}
                className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-800/50 p-2 transition-colors"
              >
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <div
                    className={`h-2 w-2 flex-shrink-0 rounded-full ${
                      player.isOnline !== false
                        ? 'animate-pulse bg-green-400'
                        : 'bg-slate-600'
                    }`}
                    title={
                      player.isOnline !== false
                        ? 'Online'
                        : 'Offline (not connected to backend)'
                    }
                  />
                  <span className="truncate text-sm text-white">
                    {player.name}
                  </span>
                  {isOwner && (
                    <Crown className="h-3 w-3 flex-shrink-0 text-yellow-500" />
                  )}
                  {isLocal && (
                    <span className="flex-shrink-0 rounded bg-purple-500/30 px-1.5 py-0.5 text-xs text-purple-300">
                      You
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {isLobbyOwner && !isLocal && !isOwner && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-slate-500 hover:bg-red-500/10 hover:text-red-400"
                        >
                          <UserX className="h-3 w-3" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="border-slate-800 bg-slate-900">
                        <AlertDialogHeader>
                          <AlertDialogTitle className="text-white">
                            Remove Player
                          </AlertDialogTitle>
                          <AlertDialogDescription className="text-slate-400">
                            Are you sure you want to remove {player.name} from
                            the game? They will need a new invite to rejoin.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel className="border-slate-700 bg-slate-800 text-slate-300">
                            Cancel
                          </AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => onRemovePlayer(player.id)}
                            className="bg-red-600 text-white hover:bg-red-700"
                          >
                            Remove
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </Card>
  )
}
