import { useState } from 'react'
import {
  Ban,
  Crown,
  MoreVertical,
  Users,
  UserX,
  Volume2,
  VolumeX,
} from 'lucide-react'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@repo/ui/components/alert-dialog'
import { Button } from '@repo/ui/components/button'
import { Card } from '@repo/ui/components/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@repo/ui/components/dropdown-menu'

interface Player {
  id: string
  name: string
  isOnline?: boolean // Whether player is connected to backend (SSE)
}

interface PlayerListProps {
  players: Player[]
  isLobbyOwner: boolean
  localPlayerName: string
  onKickPlayer: (playerId: string) => void
  onBanPlayer: (playerId: string) => void
  ownerId?: string
  mutedPlayers: Set<string>
  onToggleMutePlayer: (playerId: string) => void
}

type RemovalAction = 'kick' | 'ban'

export function PlayerList({
  players,
  isLobbyOwner,
  localPlayerName,
  onKickPlayer,
  onBanPlayer,
  ownerId,
  mutedPlayers,
  onToggleMutePlayer,
}: PlayerListProps) {
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean
    player: Player | null
    action: RemovalAction
  }>({ open: false, player: null, action: 'kick' })

  const handleConfirm = () => {
    if (!confirmDialog.player) return

    if (confirmDialog.action === 'kick') {
      onKickPlayer(confirmDialog.player.id)
    } else {
      onBanPlayer(confirmDialog.player.id)
    }

    setConfirmDialog({ open: false, player: null, action: 'kick' })
  }

  const openConfirmDialog = (player: Player, action: RemovalAction) => {
    setConfirmDialog({ open: true, player, action })
  }
  return (
    <Card className="border-surface-2 bg-surface-1 p-4">
      <div className="space-y-3">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="text-text-muted h-4 w-4" />
            <span className="text-text-muted text-sm">Players</span>
          </div>
          <span className="text-text-muted text-xs">{players.length}/4</span>
        </div>

        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, index) => {
            const player = players[index]

            // Empty slot
            if (!player) {
              return (
                <div
                  key={`empty-${index}`}
                  className="border-surface-3 bg-surface-2/20 flex items-center justify-between rounded-lg border border-dashed p-2 transition-colors"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <div className="bg-surface-3 h-2 w-2 flex-shrink-0 rounded-full" />
                    <span className="text-text-muted truncate text-sm">
                      Open slot
                    </span>
                  </div>
                </div>
              )
            }

            // Filled slot
            const isLocal = player.name === localPlayerName
            const isOwner = ownerId ? player.id === ownerId : player.id === '1' // Use provided ownerId or fallback to first player
            const isMuted = mutedPlayers.has(player.id)

            return (
              <div
                key={player.id}
                className="border-surface-2 bg-surface-2/50 flex items-center justify-between rounded-lg border p-2 transition-colors"
              >
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <div
                    className={`h-2 w-2 flex-shrink-0 rounded-full ${
                      player.isOnline !== false
                        ? 'bg-online animate-pulse'
                        : 'bg-surface-3'
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
                    <Crown className="text-warning h-3 w-3 flex-shrink-0" />
                  )}
                  {isLocal && (
                    <span className="bg-brand/30 text-brand-muted-foreground flex-shrink-0 rounded px-1.5 py-0.5 text-xs">
                      You
                    </span>
                  )}
                  {!isLocal && isMuted && (
                    <span
                      className="bg-destructive/20 text-destructive flex flex-shrink-0 items-center justify-center rounded px-1.5 py-1"
                      title="Muted"
                    >
                      <VolumeX className="h-3 w-3" />
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {!isLocal && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-text-muted hover:bg-surface-3 hover:text-text-secondary h-6 w-6 p-0"
                        >
                          <MoreVertical className="h-3 w-3" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="end"
                        className="border-surface-3 bg-surface-2"
                      >
                        <DropdownMenuItem
                          onClick={() => onToggleMutePlayer(player.id)}
                          className="text-text-secondary focus:bg-surface-3 focus:text-white"
                        >
                          {isMuted ? (
                            <>
                              <Volume2 className="mr-2 h-4 w-4" />
                              Unmute
                            </>
                          ) : (
                            <>
                              <VolumeX className="mr-2 h-4 w-4" />
                              Mute
                            </>
                          )}
                        </DropdownMenuItem>
                        {isLobbyOwner && !isOwner && (
                          <>
                            <DropdownMenuItem
                              onClick={() => openConfirmDialog(player, 'kick')}
                              className="text-warning focus:bg-warning/10 focus:text-warning"
                            >
                              <UserX className="mr-2 h-4 w-4" />
                              Kick (can rejoin)
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => openConfirmDialog(player, 'ban')}
                              className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                            >
                              <Ban className="mr-2 h-4 w-4" />
                              Ban (permanent)
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Confirmation Dialog */}
      <AlertDialog
        open={confirmDialog.open}
        onOpenChange={(open) =>
          !open &&
          setConfirmDialog({ open: false, player: null, action: 'kick' })
        }
      >
        <AlertDialogContent className="border-surface-2 bg-surface-1">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">
              {confirmDialog.action === 'kick' ? 'Kick Player' : 'Ban Player'}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-text-muted">
              {confirmDialog.action === 'kick' ? (
                <>
                  Are you sure you want to kick{' '}
                  <span className="font-medium text-white">
                    {confirmDialog.player?.name}
                  </span>
                  ? They can rejoin the game with the invite link.
                </>
              ) : (
                <>
                  Are you sure you want to ban{' '}
                  <span className="font-medium text-white">
                    {confirmDialog.player?.name}
                  </span>
                  ?{' '}
                  <span className="text-destructive font-medium">
                    This cannot be undone.
                  </span>{' '}
                  They will be permanently blocked from this room. To play
                  together again, you&apos;ll need to create a new game room.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-surface-3 bg-surface-2 text-text-secondary">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirm}
              className={
                confirmDialog.action === 'kick'
                  ? 'bg-warning hover:bg-warning text-white'
                  : 'bg-destructive hover:bg-destructive text-white'
              }
            >
              {confirmDialog.action === 'kick' ? 'Kick' : 'Ban'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}
