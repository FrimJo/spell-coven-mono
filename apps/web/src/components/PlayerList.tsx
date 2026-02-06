import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  Ban,
  Crown,
  Minus,
  MoreVertical,
  Plus,
  Swords,
  Unplug,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@repo/ui/components/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@repo/ui/components/tooltip'

import { SidebarCard } from './GameRoomSidebar'

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
  onViewCommanders?: (playerId: string) => void
  /** Current seat count (1-4) */
  seatCount: number
  /** Callback to change seat count (owner only) */
  onChangeSeatCount?: (delta: number) => void
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
  onViewCommanders,
  seatCount,
  onChangeSeatCount,
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

  // Compute bounds for seat count controls
  const canDecrease =
    isLobbyOwner && seatCount > players.length && seatCount > 1
  const canIncrease = isLobbyOwner && seatCount < 4

  // Header action for seat count controls (owner only)
  const headerAction =
    isLobbyOwner && onChangeSeatCount ? (
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onChangeSeatCount(-1)}
          disabled={!canDecrease}
          className="text-text-muted hover:text-text-secondary disabled:text-text-muted/30 h-5 w-5 p-0"
          title="Remove seat"
        >
          <Minus className="h-3 w-3" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onChangeSeatCount(1)}
          disabled={!canIncrease}
          className="text-text-muted hover:text-text-secondary disabled:text-text-muted/30 h-5 w-5 p-0"
          title="Add seat"
        >
          <Plus className="h-3 w-3" />
        </Button>
      </div>
    ) : undefined

  return (
    <SidebarCard
      icon={Users}
      title="Players"
      count={`${players.length}/${seatCount}`}
      countTestId="players-count"
      headerAction={headerAction}
    >
      <div className="space-y-2 p-2">
        {Array.from({ length: seatCount }).map((_, index) => {
          const player = players[index]

          // Empty slot
          if (!player) {
            return (
              <motion.div
                key={`empty-${index}`}
                className="border-surface-3 bg-surface-2/20 flex min-h-[42px] items-center justify-between rounded-lg border border-dashed p-2"
                animate={{
                  opacity: [0.6, 0.85, 0.6],
                  borderColor: [
                    'rgba(255, 255, 255, 0.1)',
                    'rgba(255, 255, 255, 0.2)',
                    'rgba(255, 255, 255, 0.1)',
                  ],
                }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
              >
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <motion.div
                    className="bg-surface-3 h-2 w-2 flex-shrink-0 rounded-full"
                    animate={{
                      scale: [1, 1.2, 1],
                      opacity: [0.5, 0.8, 0.5],
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: 'easeInOut',
                    }}
                  />
                  <span className="text-text-muted truncate text-sm">
                    Open seat
                  </span>
                </div>
              </motion.div>
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
                      : 'bg-warning'
                  }`}
                  title={player.isOnline !== false ? 'Online' : 'Disconnected'}
                />
                <span className="truncate text-sm text-white">
                  {player.name}
                </span>
                {isOwner && (
                  <Crown className="text-warning h-3 w-3 flex-shrink-0" />
                )}
                {player.isOnline === false && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="bg-warning/20 text-warning flex flex-shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-xs">
                        <Unplug className="h-3 w-3" />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Disconnected</p>
                    </TooltipContent>
                  </Tooltip>
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
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-text-muted hover:bg-surface-3 hover:text-text-secondary h-6 w-6 p-0"
                      aria-label="Player actions"
                      data-testid="player-actions-button"
                    >
                      <MoreVertical className="h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    className="border-surface-3 bg-surface-2"
                  >
                    {onViewCommanders && (
                      <DropdownMenuItem
                        onClick={() => onViewCommanders(player.id)}
                        className="text-text-secondary focus:bg-surface-3 focus:text-white"
                        title="View and edit commanders"
                        data-testid="player-commanders-menu-item"
                      >
                        <Swords className="mr-2 h-4 w-4" />
                        Commanders
                      </DropdownMenuItem>
                    )}
                    {!isLocal && (
                      <DropdownMenuItem
                        onClick={() => onToggleMutePlayer(player.id)}
                        className="text-text-secondary focus:bg-surface-3 focus:text-white"
                        title={
                          isMuted ? 'Unmute this player' : 'Mute this player'
                        }
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
                    )}
                    {isLobbyOwner && !isOwner && (
                      <>
                        <DropdownMenuItem
                          onClick={() => openConfirmDialog(player, 'kick')}
                          className="text-warning focus:bg-warning/10 focus:text-warning"
                          title="Can rejoin"
                        >
                          <UserX className="mr-2 h-4 w-4" />
                          Kick
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => openConfirmDialog(player, 'ban')}
                          className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                          title="Permanent"
                        >
                          <Ban className="mr-2 h-4 w-4" />
                          Ban
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          )
        })}
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
    </SidebarCard>
  )
}
