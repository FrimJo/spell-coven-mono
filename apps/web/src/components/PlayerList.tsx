import { useCallback, useState } from 'react'
import { AnimatePresence, domAnimation, LazyMotion, m } from 'framer-motion'
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
  currentUserId: _currentUserId,
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
      <div className="gap-1 flex items-center">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onChangeSeatCount(-1)}
          disabled={!canDecrease}
          className="h-5 w-5 p-0 text-text-muted hover:text-text-secondary disabled:text-text-muted/30"
          title="Remove seat"
        >
          <Minus className="h-3 w-3" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onChangeSeatCount(1)}
          disabled={!canIncrease}
          className="h-5 w-5 p-0 text-text-muted hover:text-text-secondary disabled:text-text-muted/30"
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
                className="h-5 w-5 p-0 text-text-muted hover:text-text-secondary"
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
            className="h-5 w-5 p-0 text-text-muted hover:text-text-secondary"
            data-testid="reset-game-button"
          >
            <RotateCcw className="h-3 w-3" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Reset game state</TooltipContent>
      </Tooltip>
    ) : undefined

  return (
    <LazyMotion features={domAnimation}>
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
                <m.button
                  key={`empty-${index}`}
                  type="button"
                  onClick={() => handleCopyLink(index)}
                  disabled={!onCopyShareLink}
                  className="border-default group gap-2 p-2 flex min-h-[56px] w-full cursor-pointer items-center justify-between rounded-lg border border-dashed bg-surface-1/50 text-left transition-colors hover:border-surface-3/80 hover:bg-surface-2/40 active:scale-[0.98] disabled:cursor-default disabled:opacity-60"
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
                  <div className="min-w-0 gap-2 flex flex-1 items-center">
                    <AnimatePresence mode="wait">
                      {isCopied ? (
                        <m.div
                          key="copied"
                          initial={{ opacity: 0, scale: 0.92 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.96 }}
                          transition={{
                            duration: 0.22,
                            ease: [0.25, 0.46, 0.45, 0.94],
                          }}
                          className="min-w-0 gap-2 flex flex-1 items-center"
                        >
                          <m.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{
                              type: 'spring',
                              stiffness: 380,
                              damping: 22,
                            }}
                            className="h-8 w-8 bg-teal-600 flex flex-shrink-0 items-center justify-center rounded-full"
                          >
                            <Check
                              className="h-4 w-4 text-white"
                              strokeWidth={2.5}
                            />
                          </m.div>
                          <span className="min-w-0 text-sm font-medium text-teal-500 flex-1 truncate">
                            Copied!
                          </span>
                        </m.div>
                      ) : (
                        <m.div
                          key="copy"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.15 }}
                          className="min-w-0 gap-2 relative flex flex-1 items-center"
                        >
                          {/* Default: Gamepad2 + Open seat (matches VideoStreamGrid empty slot) */}
                          <div className="min-w-0 gap-2 flex flex-1 items-center transition-opacity duration-200 group-hover:opacity-0">
                            <m.div className="h-8 w-8 relative flex flex-shrink-0 items-center justify-center rounded-full bg-brand/10">
                              <m.div
                                className="inset-0 absolute rounded-full bg-brand/20"
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
                              <m.div
                                animate={{ scale: [1, 1.1, 1] }}
                                transition={{
                                  duration: 2,
                                  repeat: Infinity,
                                  ease: 'easeInOut',
                                }}
                              >
                                <Gamepad2 className="h-4 w-4 text-brand-muted-foreground" />
                              </m.div>
                            </m.div>
                            <div className="min-w-0 space-y-0.5 flex-1">
                              <p className="text-sm font-medium truncate text-text-muted">
                                Open seat
                              </p>
                              <p className="text-xs truncate text-text-muted/60">
                                Waiting for player...
                              </p>
                            </div>
                          </div>
                          {/* Hover: Link2 + Copy shareable link */}
                          <div className="inset-0 gap-2 pointer-events-none absolute flex items-center opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                            <m.div className="h-8 w-8 relative flex flex-shrink-0 items-center justify-center rounded-full bg-brand/10">
                              <m.div
                                className="inset-0 absolute rounded-full bg-brand/20"
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
                              <m.div
                                animate={{ scale: [1, 1.1, 1] }}
                                transition={{
                                  duration: 2,
                                  repeat: Infinity,
                                  ease: 'easeInOut',
                                }}
                              >
                                <Link2 className="h-4 w-4 text-brand-muted-foreground" />
                              </m.div>
                            </m.div>
                            <span className="text-sm truncate text-text-muted">
                              Copy shareable link
                            </span>
                          </div>
                        </m.div>
                      )}
                    </AnimatePresence>
                  </div>
                </m.button>
              )
            }

            // Filled slot
            const isLocal = player.name === localPlayerName
            const isOwner = ownerId ? player.id === ownerId : player.id === '1' // Use provided ownerId or fallback to first player
            const isMuted = mutedPlayers.has(player.id)

            return (
              <div
                key={player.id}
                className="p-2 flex items-center justify-between rounded-lg border border-surface-2 bg-surface-2/50 transition-colors"
              >
                <div className="min-w-0 gap-2 flex flex-1 items-center">
                  <div
                    className={`h-2 w-2 flex-shrink-0 rounded-full ${
                      player.isOnline !== false
                        ? 'animate-pulse bg-online'
                        : 'bg-warning'
                    }`}
                    title={
                      player.isOnline !== false ? 'Online' : 'Disconnected'
                    }
                  />
                  <span
                    className="text-sm text-white truncate"
                    data-testid="player-name"
                  >
                    {player.name}
                  </span>
                  {isOwner && (
                    <Crown className="h-3 w-3 flex-shrink-0 text-warning" />
                  )}
                  {player.isOnline === false && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="gap-1 rounded px-1.5 py-0.5 text-xs flex flex-shrink-0 items-center bg-warning/20 text-warning">
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
                      className="rounded px-1.5 py-1 flex flex-shrink-0 items-center justify-center bg-destructive/20 text-destructive"
                      title="Muted"
                    >
                      <VolumeX className="h-3 w-3" />
                    </span>
                  )}
                </div>

                <div className="gap-2 flex items-center">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-text-muted hover:bg-surface-3 hover:text-text-secondary"
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
                          className="gap-2 focus:text-white flex items-center text-text-secondary focus:bg-surface-3"
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
                          className="focus:text-white text-text-secondary focus:bg-surface-3"
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
                    <span className="font-medium text-destructive">
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
                    ? 'text-white bg-warning hover:bg-warning'
                    : 'text-white bg-destructive hover:bg-destructive'
                }
              >
                {confirmDialog.action === 'kick' ? 'Kick' : 'Ban'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </SidebarCard>
    </LazyMotion>
  )
}
