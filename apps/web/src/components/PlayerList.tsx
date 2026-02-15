import { useCallback, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Ban,
  Check,
  Crown,
  Gamepad2,
  Link2,
  Minus,
  MoreVertical,
  Plus,
  RotateCcw,
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
  /** Current user's id – Commanders menu (e.g. damage taken) is shown only for this player */
  currentUserId?: string
  /** Opens the commander damage dialog for the given player (e.g. from sidebar menu) */
  onOpenCommanderDamage?: (playerId: string) => void
  /** Current seat count (1-4) */
  seatCount: number
  /** Callback to change seat count (owner only) */
  onChangeSeatCount?: (delta: number) => void
  /** Called when user wants to copy the shareable game link */
  onCopyShareLink?: () => void
  /** Called when user wants to reset game state (life, poison, commanders) */
  onResetGame?: () => void
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
  currentUserId,
  onOpenCommanderDamage,
  seatCount,
  onChangeSeatCount,
  onCopyShareLink,
  onResetGame,
}: PlayerListProps) {
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean
    player: Player | null
    action: RemovalAction
  }>({ open: false, player: null, action: 'kick' })

  const [recentlyCopiedSlot, setRecentlyCopiedSlot] = useState<number | null>(
    null,
  )
  const handleCopyLink = useCallback(
    (slotIndex: number) => {
      onCopyShareLink?.()
      setRecentlyCopiedSlot(slotIndex)
      setTimeout(() => setRecentlyCopiedSlot(null), 1800)
    },
    [onCopyShareLink],
  )

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

  // Header action: seat count controls (owner only) and reset game (icon + tooltip)
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
        {onResetGame && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={onResetGame}
                className="text-text-muted hover:text-text-secondary h-5 w-5 p-0"
                data-testid="reset-game-button"
              >
                <RotateCcw className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Reset game state</TooltipContent>
          </Tooltip>
        )}
      </div>
    ) : onResetGame ? (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            onClick={onResetGame}
            className="text-text-muted hover:text-text-secondary h-5 w-5 p-0"
            data-testid="reset-game-button"
          >
            <RotateCcw className="h-3 w-3" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Reset game state</TooltipContent>
      </Tooltip>
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

          // Empty slot – show "Open seat" by default, "Copy shareable link" on hover
          if (!player) {
            const isCopied = recentlyCopiedSlot === index
            return (
              <motion.button
                key={`empty-${index}`}
                type="button"
                onClick={() => handleCopyLink(index)}
                disabled={!onCopyShareLink}
                className="border-default bg-surface-1/50 hover:border-surface-3/80 hover:bg-surface-2/40 group flex min-h-[56px] w-full cursor-pointer items-center justify-between gap-2 rounded-lg border border-dashed p-2 text-left transition-colors active:scale-[0.98] disabled:cursor-default disabled:opacity-60"
                whileHover={
                  onCopyShareLink && !isCopied
                    ? { scale: 1.01, transition: { duration: 0.2 } }
                    : undefined
                }
                whileTap={
                  onCopyShareLink && !isCopied
                    ? { scale: 0.98, transition: { duration: 0.1 } }
                    : undefined
                }
                title={
                  isCopied
                    ? 'Copied!'
                    : onCopyShareLink
                      ? 'Copy shareable link'
                      : undefined
                }
              >
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <AnimatePresence mode="wait">
                    {isCopied ? (
                      <motion.div
                        key="copied"
                        initial={{ opacity: 0, scale: 0.92 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.96 }}
                        transition={{
                          duration: 0.22,
                          ease: [0.25, 0.46, 0.45, 0.94],
                        }}
                        className="flex min-w-0 flex-1 items-center gap-2"
                      >
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{
                            type: 'spring',
                            stiffness: 380,
                            damping: 22,
                          }}
                          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-teal-600"
                        >
                          <Check
                            className="h-4 w-4 text-white"
                            strokeWidth={2.5}
                          />
                        </motion.div>
                        <span className="min-w-0 flex-1 truncate text-sm font-medium text-teal-500">
                          Copied!
                        </span>
                      </motion.div>
                    ) : (
                      <motion.div
                        key="copy"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className="relative flex min-w-0 flex-1 items-center gap-2"
                      >
                        {/* Default: Gamepad2 + Open seat (matches VideoStreamGrid empty slot) */}
                        <div className="flex min-w-0 flex-1 items-center gap-2 transition-opacity duration-200 group-hover:opacity-0">
                          <motion.div className="bg-brand/10 relative flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full">
                            <motion.div
                              className="bg-brand/20 absolute inset-0 rounded-full"
                              animate={{
                                scale: [1, 1.4, 1],
                                opacity: [0.5, 0, 0.5],
                              }}
                              transition={{
                                duration: 2,
                                repeat: Infinity,
                                ease: 'easeInOut',
                              }}
                            />
                            <motion.div
                              animate={{ scale: [1, 1.1, 1] }}
                              transition={{
                                duration: 2,
                                repeat: Infinity,
                                ease: 'easeInOut',
                              }}
                            >
                              <Gamepad2 className="text-brand-muted-foreground h-4 w-4" />
                            </motion.div>
                          </motion.div>
                          <div className="min-w-0 flex-1 space-y-0.5">
                            <p className="text-text-muted truncate text-sm font-medium">
                              Open seat
                            </p>
                            <p className="text-text-muted/60 truncate text-xs">
                              Waiting for player...
                            </p>
                          </div>
                        </div>
                        {/* Hover: Link2 + Copy shareable link */}
                        <div className="pointer-events-none absolute inset-0 flex items-center gap-2 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                          <motion.div className="bg-brand/10 relative flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full">
                            <motion.div
                              className="bg-brand/20 absolute inset-0 rounded-full"
                              animate={{
                                scale: [1, 1.4, 1],
                                opacity: [0.5, 0, 0.5],
                              }}
                              transition={{
                                duration: 2,
                                repeat: Infinity,
                                ease: 'easeInOut',
                              }}
                            />
                            <motion.div
                              animate={{ scale: [1, 1.1, 1] }}
                              transition={{
                                duration: 2,
                                repeat: Infinity,
                                ease: 'easeInOut',
                              }}
                            >
                              <Link2 className="text-brand-muted-foreground h-4 w-4" />
                            </motion.div>
                          </motion.div>
                          <span className="text-text-muted truncate text-sm">
                            Copy shareable link
                          </span>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.button>
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
                <span
                  className="truncate text-sm text-white"
                  data-testid="player-name"
                >
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
                    {onOpenCommanderDamage && (
                      <DropdownMenuItem
                        onClick={() => onOpenCommanderDamage(player.id)}
                        className="text-text-secondary focus:bg-surface-3 flex items-center gap-2 focus:text-white"
                        title="Edit commander damage"
                        data-testid="player-commander-damage-menu-item"
                      >
                        <Swords className="mr-2 h-4 w-4" />
                        <span>Commander damage</span>
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
