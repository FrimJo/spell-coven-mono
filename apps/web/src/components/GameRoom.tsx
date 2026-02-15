import type { DetectorType } from '@/lib/detectors'
import { useCallback, useMemo, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import {
  CardQueryProvider,
  useCardQueryContext,
} from '@/contexts/CardQueryContext'
import {
  CommanderDamageDialogProvider,
  useCommanderDamageDialog,
} from '@/contexts/CommanderDamageDialogContext'
import { CommandersPanelProvider } from '@/contexts/CommandersPanelContext'
import { MediaStreamProvider } from '@/contexts/MediaStreamContext.js'
import { PresenceProvider, usePresence } from '@/contexts/PresenceContext'
import {
  useGameRoomKeyboardShortcuts,
  useGameRoomShortcutDisplayParts,
} from '@/hooks/useGameRoomKeybindings'
import { api } from '@convex/_generated/api'
import { useMutation } from 'convex/react'
import { toast } from 'sonner'

import { Toaster } from '@repo/ui/components/sonner'

import type { RejoinReason } from './RejoinGameDialog.js'
import { AppHeader } from './AppHeader.js'
import { CardSearchCommand } from './CardSearchCommand.js'
import { DuplicateSessionDialog } from './DuplicateSessionDialog.js'
import { GameRoomSidebar } from './GameRoomSidebar.js'
import { LeaveGameDialog } from './LeaveGameDialog.js'
import { MediaSetupDialog } from './MediaSetupDialog.js'
import { RejoinGameDialog } from './RejoinGameDialog.js'
import { ResetGameDialog } from './ResetGameDialog.js'
import { VideoStreamGridWithSuspense } from './VideoStreamGrid.js'

interface GameRoomProps {
  roomId: string
  playerName: string
  onLeaveGame: () => void
  detectorType?: DetectorType
  usePerspectiveWarp?: boolean
  showTestStream?: boolean
}

function GameRoomContent({
  roomId,
  onLeaveGame,
  detectorType,
  usePerspectiveWarp = true,
  showTestStream = false,
}: Omit<GameRoomProps, 'playerName'>) {
  // Get authenticated user from Convex Auth (Discord OAuth)
  const { user } = useAuth()

  // User should always be authenticated at this point (protected route)
  // But we provide safe defaults just in case
  const userId = user?.id ?? ''
  const username = user?.username ?? 'Unknown'

  const { query, clearHistory } = useCardQueryContext()

  // Get presence data and actions from context
  const {
    ownerId,
    isOwner,
    isConnected,
    disconnectReason,
    connect,
    leaveRoom,
    kickPlayer,
    banPlayer,
    transferSession,
    hasDuplicateSession,
  } = usePresence()

  const [copied, setCopied] = useState(false)
  const [duplicateDialogDismissed, setDuplicateDialogDismissed] =
    useState(false)
  const [showLeaveConfirmDialog, setShowLeaveConfirmDialog] = useState(false)
  const [showResetConfirmDialog, setShowResetConfirmDialog] = useState(false)
  const [isResetting, setIsResetting] = useState(false)
  const [showCardSearch, setShowCardSearch] = useState(false)
  const [commandersPanelOpen, setCommandersPanelOpen] = useState(false)
  const openCommandersPanel = useCallback(
    () => setCommandersPanelOpen(true),
    [],
  )

  const resetRoomGameStateMutation = useMutation(api.rooms.resetRoomGameState)

  // Muted players state - tracks which remote players are muted by the local user
  const [mutedPlayers, setMutedPlayers] = useState<Set<string>>(new Set())

  const handleToggleMutePlayer = useCallback((playerId: string) => {
    setMutedPlayers((prev) => {
      const next = new Set(prev)
      if (next.has(playerId)) {
        next.delete(playerId)
      } else {
        next.add(playerId)
      }
      return next
    })
  }, [])

  // Show duplicate session dialog when detected, unless user has dismissed it
  // Reset dismissed state when duplicate session is resolved (so dialog can show again if new duplicate appears)
  const showDuplicateDialog = hasDuplicateSession && !duplicateDialogDismissed

  // Show rejoin dialog when disconnected (for any reason)
  const showRejoinDialog = !isConnected && disconnectReason !== null

  // Map disconnect reason to RejoinReason type
  const rejoinReason: RejoinReason = disconnectReason ?? 'left'

  // Compute shareable link (only on client)
  const shareLink = useMemo(() => {
    if (typeof window === 'undefined') return ''
    return `${window.location.origin}/game/${roomId}`
  }, [roomId])

  // HOOK: Dialog open state - only opens when user clicks settings button
  // Initial media setup is now handled by the route guard (redirects to /setup if not configured)
  const [mediaDialogOpen, setMediaDialogOpen] = useState(false)

  // Show dialog until user completes media setup
  const handleDialogComplete = useCallback(async () => {
    console.log('[GameRoom] Media dialog completed')
    // Device selections are saved by MediaSetupDialog via useSelectedMediaDevice
    // No need to save a per-room flag - we check for device settings globally
    setMediaDialogOpen(false)
    console.log('[GameRoom] Media setup complete')
  }, [])

  const handleCopyShareLink = useCallback(() => {
    navigator.clipboard.writeText(shareLink)
    setCopied(true)
    toast.success('Shareable link copied to clipboard!')
    setTimeout(() => setCopied(false), 2000)
  }, [shareLink])

  const handleOpenSettings = useCallback(() => {
    setMediaDialogOpen(true)
  }, [])

  const handleSearchClick = useCallback(() => {
    setShowCardSearch(true)
  }, [])

  const toggleSearchDialog = useCallback(() => {
    setShowCardSearch((previous) => !previous)
  }, [])

  const shortcutParts = useGameRoomShortcutDisplayParts()

  const handleKickPlayer = async (playerId: string) => {
    try {
      await kickPlayer(playerId)
      toast.success('Player kicked from game')
    } catch (error) {
      console.error('[GameRoom] Failed to kick player:', error)
      toast.error('Failed to kick player')
    }
  }

  const handleBanPlayer = async (playerId: string) => {
    try {
      await banPlayer(playerId)
      toast.success('Player banned from game')
    } catch (error) {
      console.error('[GameRoom] Failed to ban player:', error)
      toast.error('Failed to ban player')
    }
  }

  // Handle transfer session to this tab
  const handleTransferSession = async () => {
    try {
      await transferSession()
      setDuplicateDialogDismissed(true)
      toast.success('Session transferred to this tab')
    } catch (error) {
      console.error('[GameRoom] Failed to transfer session:', error)
      toast.error('Failed to transfer session')
    }
  }

  // Handle closing this tab (user wants to keep other session)
  const handleCloseDuplicateTab = async () => {
    setDuplicateDialogDismissed(true)
    // Explicitly leave the room before navigating
    try {
      await leaveRoom()
      console.log(
        '[GameRoom] Successfully left room (duplicate tab), navigating away',
      )
    } catch (error) {
      console.error('[GameRoom] Failed to leave room (duplicate tab):', error)
      // Still navigate away even if leave fails
    }
    onLeaveGame()
  }

  // Handle manual leave request - show confirmation first
  const handleManualLeave = useCallback(() => {
    setShowLeaveConfirmDialog(true)
  }, [])

  // Handle confirmed leave - explicitly leave room before navigating away
  // We call leaveRoom explicitly to ensure the backend is notified before navigation
  // We don't call disconnect('left') because that would show the RejoinGameDialog
  const handleConfirmLeave = useCallback(async () => {
    setShowLeaveConfirmDialog(false)
    // Clear card history for this room on explicit manual leave
    clearHistory()

    // Explicitly leave the room before navigating to ensure backend is updated
    try {
      await leaveRoom()
      console.log('[GameRoom] Successfully left room, navigating away')
    } catch (error) {
      console.error('[GameRoom] Failed to leave room:', error)
      // Still navigate away even if leave fails (cleanup will happen on unmount)
    }

    // Navigate away after leaving (or if leave failed)
    onLeaveGame()
  }, [onLeaveGame, clearHistory, leaveRoom])

  // Handle rejoin attempt - use connect callback
  const handleRejoin = useCallback(() => {
    connect()
    if (rejoinReason === 'kicked') {
      toast.success('Rejoining game...')
    }
  }, [connect, rejoinReason])

  const handleResetClick = useCallback(() => {
    setShowResetConfirmDialog(true)
  }, [])

  const handleConfirmReset = useCallback(async () => {
    setIsResetting(true)
    try {
      await resetRoomGameStateMutation({ roomId })
      setShowResetConfirmDialog(false)
      toast.success('Game state reset')
      clearHistory()
    } catch (error) {
      console.error('[GameRoom] Failed to reset game state:', error)
      toast.error('Failed to reset game state')
    } finally {
      setIsResetting(false)
    }
  }, [roomId, resetRoomGameStateMutation, clearHistory])

  return (
    <div className="bg-surface-0 flex h-screen flex-col">
      {/* Duplicate Session Dialog - shown when user is already connected from another tab */}
      <DuplicateSessionDialog
        open={showDuplicateDialog}
        onTransfer={handleTransferSession}
        onClose={handleCloseDuplicateTab}
      />

      {/* Leave Confirmation Dialog */}
      <LeaveGameDialog
        open={showLeaveConfirmDialog}
        onConfirm={handleConfirmLeave}
        onCancel={() => setShowLeaveConfirmDialog(false)}
      />

      {/* Reset Game Confirmation Dialog */}
      <ResetGameDialog
        open={showResetConfirmDialog}
        onConfirm={handleConfirmReset}
        onCancel={() => setShowResetConfirmDialog(false)}
        isResetting={isResetting}
      />

      {/* Rejoin/Leave Dialog */}
      <RejoinGameDialog
        open={showRejoinDialog}
        reason={rejoinReason}
        onRejoin={handleRejoin}
        onLeave={onLeaveGame}
      />

      {/* Media Setup Dialog - modal - only render when open to avoid Select component issues */}
      {/* Note: MediaSetupDialog handles permissions internally */}
      {mediaDialogOpen && (
        <MediaSetupDialog
          open={mediaDialogOpen}
          onComplete={handleDialogComplete}
        />
      )}

      <Toaster />

      {/* Card Search Command Dialog */}
      <CardSearchCommand
        open={showCardSearch}
        onOpenChange={setShowCardSearch}
      />

      {/* Header */}
      <AppHeader
        variant="game"
        shareLink={shareLink}
        copied={copied}
        onLeave={handleManualLeave}
        onCopyLink={handleCopyShareLink}
        onOpenSettings={handleOpenSettings}
        onSearchClick={handleSearchClick}
        commandersPanelOpen={commandersPanelOpen}
        onCommandersPanelToggle={() => setCommandersPanelOpen((prev) => !prev)}
        commanderShortcutParts={shortcutParts.toggleCommandersPanel}
      />

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        <CommandersPanelProvider onOpenPanel={openCommandersPanel}>
          <CommanderDamageDialogProvider>
            <GameRoomMainLayout
              roomId={roomId}
              userId={userId}
              username={username}
              ownerId={ownerId}
              isOwner={isOwner}
              onKickPlayer={handleKickPlayer}
              onBanPlayer={handleBanPlayer}
              mutedPlayers={mutedPlayers}
              onToggleMutePlayer={handleToggleMutePlayer}
              commandersPanelOpen={commandersPanelOpen}
              onCommandersPanelOpenChange={setCommandersPanelOpen}
              onCopyShareLink={handleCopyShareLink}
              onResetGame={handleResetClick}
              detectorType={detectorType}
              usePerspectiveWarp={usePerspectiveWarp}
              onCardCrop={query}
              showTestStream={showTestStream}
              onToggleSearchCards={toggleSearchDialog}
              shortcutParts={shortcutParts}
            />
          </CommanderDamageDialogProvider>
        </CommandersPanelProvider>
      </div>
    </div>
  )
}

interface GameRoomMainLayoutProps {
  roomId: string
  userId: string
  username: string
  ownerId: string | null
  isOwner: boolean
  onKickPlayer: (playerId: string) => void
  onBanPlayer: (playerId: string) => void
  mutedPlayers: Set<string>
  onToggleMutePlayer: (playerId: string) => void
  commandersPanelOpen: boolean
  onCommandersPanelOpenChange: (open: boolean) => void
  onCopyShareLink: () => void
  onResetGame?: () => void
  detectorType?: DetectorType
  usePerspectiveWarp: boolean
  onCardCrop: ReturnType<typeof useCardQueryContext>['query']
  showTestStream: boolean
  onToggleSearchCards: () => void
  shortcutParts: {
    toggleCommandersPanel: string[]
    openCommanderDamage: string[]
  }
}

function GameRoomMainLayout({
  roomId,
  userId,
  username,
  ownerId,
  isOwner,
  onKickPlayer,
  onBanPlayer,
  mutedPlayers,
  onToggleMutePlayer,
  commandersPanelOpen,
  onCommandersPanelOpenChange,
  onCopyShareLink,
  onResetGame,
  detectorType,
  usePerspectiveWarp,
  onCardCrop,
  showTestStream,
  onToggleSearchCards,
  shortcutParts,
}: GameRoomMainLayoutProps) {
  const commanderDamageDialog = useCommanderDamageDialog()

  const shortcutHandlers = useMemo(
    () => ({
      searchCards: onToggleSearchCards,
      toggleCommandersPanel: () => {
        onCommandersPanelOpenChange(!commandersPanelOpen)
      },
      openCommanderDamage: () => {
        commanderDamageDialog?.setOpenForPlayerId(userId)
      },
    }),
    [
      commandersPanelOpen,
      commanderDamageDialog,
      onCommandersPanelOpenChange,
      onToggleSearchCards,
      userId,
    ],
  )

  useGameRoomKeyboardShortcuts(shortcutHandlers)

  return (
    <div className="flex h-full gap-4 p-4">
      {/* Left Sidebar - Player List */}
      <GameRoomSidebar
        roomId={roomId}
        userId={userId}
        playerName={username}
        isLobbyOwner={isOwner}
        ownerId={ownerId}
        onKickPlayer={onKickPlayer}
        onBanPlayer={onBanPlayer}
        mutedPlayers={mutedPlayers}
        onToggleMutePlayer={onToggleMutePlayer}
        commandersPanelOpen={commandersPanelOpen}
        onCommandersPanelOpenChange={onCommandersPanelOpenChange}
        onCopyShareLink={onCopyShareLink}
        onResetGame={onResetGame}
      />

      {/* Main Area - Video Stream Grid */}
      <div className="flex-1 overflow-hidden">
        <VideoStreamGridWithSuspense
          roomId={roomId}
          userId={userId}
          localPlayerName={username}
          detectorType={detectorType}
          usePerspectiveWarp={usePerspectiveWarp}
          onCardCrop={onCardCrop}
          mutedPlayers={mutedPlayers}
          showTestStream={showTestStream}
        />
      </div>
    </div>
  )
}

// Inner component that has access to PresenceProvider
function GameRoomWithPresence({
  roomId,
  onLeaveGame,
  detectorType,
  usePerspectiveWarp,
  showTestStream,
}: Omit<GameRoomProps, 'playerName'>) {
  const handleDuplicateSession = useCallback(() => {
    console.log('[GameRoom] Duplicate session detected, showing dialog')
    // This will be handled by the content component
  }, [])

  const handleSessionTransferred = useCallback(() => {
    console.log(
      '[GameRoom] Session transferred to another tab, navigating away',
    )
    toast.info('Session moved to another tab. Returning to home...')
    // Give user a moment to see the toast, then leave
    setTimeout(() => {
      onLeaveGame()
    }, 1500)
  }, [onLeaveGame])

  return (
    <PresenceProvider
      roomId={roomId}
      onDuplicateSession={handleDuplicateSession}
      onSessionTransferred={handleSessionTransferred}
    >
      <GameRoomContent
        roomId={roomId}
        onLeaveGame={onLeaveGame}
        detectorType={detectorType}
        usePerspectiveWarp={usePerspectiveWarp}
        showTestStream={showTestStream}
      />
    </PresenceProvider>
  )
}

export function GameRoom(props: GameRoomProps) {
  return (
    <MediaStreamProvider>
      <CardQueryProvider roomId={props.roomId}>
        <GameRoomWithPresence {...props} />
      </CardQueryProvider>
    </MediaStreamProvider>
  )
}
