import type { DetectorType } from '@/lib/detectors'
import { useCallback, useMemo, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import {
  CardQueryProvider,
  useCardQueryContext,
} from '@/contexts/CardQueryContext'
import { MediaStreamProvider } from '@/contexts/MediaStreamContext.js'
import { PresenceProvider, usePresence } from '@/contexts/PresenceContext'
import { toast } from 'sonner'

import { Toaster } from '@repo/ui/components/sonner'

import type { RejoinReason } from './RejoinGameDialog.js'
import { AppHeader } from './AppHeader.js'
import { DuplicateSessionDialog } from './DuplicateSessionDialog.js'
import { GameRoomSidebar } from './GameRoomSidebar.js'
import { LeaveGameDialog } from './LeaveGameDialog.js'
import { MediaSetupDialog } from './MediaSetupDialog.js'
import { RejoinGameDialog } from './RejoinGameDialog.js'
import { VideoStreamGridWithSuspense } from './VideoStreamGrid.js'

interface GameRoomProps {
  roomId: string
  playerName: string
  onLeaveGame: () => void
  detectorType?: DetectorType
  usePerspectiveWarp?: boolean
}

function GameRoomContent({
  roomId,
  onLeaveGame,
  detectorType,
  usePerspectiveWarp = true,
}: Omit<GameRoomProps, 'playerName'>) {
  // Get authenticated user from Convex Auth (Discord OAuth)
  const { user } = useAuth()

  // User should always be authenticated at this point (protected route)
  // But we provide safe defaults just in case
  const userId = user?.id ?? ''
  const username = user?.username ?? 'Unknown'

  const { query } = useCardQueryContext()

  // Get presence data and actions from context
  const {
    ownerId,
    isOwner,
    isConnected,
    disconnectReason,
    connect,
    kickPlayer,
    banPlayer,
    transferSession,
    hasDuplicateSession,
  } = usePresence()

  const [copied, setCopied] = useState(false)
  const [duplicateDialogDismissed, setDuplicateDialogDismissed] =
    useState(false)
  const [showLeaveConfirmDialog, setShowLeaveConfirmDialog] = useState(false)

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
  const handleDialogComplete = async () => {
    console.log('[GameRoom] Media dialog completed')
    // Device selections are saved by MediaSetupDialog via useSelectedMediaDevice
    // No need to save a per-room flag - we check for device settings globally
    setMediaDialogOpen(false)
    console.log('[GameRoom] Media setup complete')
  }

  const handleCopyShareLink = () => {
    navigator.clipboard.writeText(shareLink)
    setCopied(true)
    toast.success('Shareable link copied to clipboard!')
    setTimeout(() => setCopied(false), 2000)
  }

  const handleOpenSettings = () => {
    setMediaDialogOpen(true)
  }

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
  const handleCloseDuplicateTab = () => {
    setDuplicateDialogDismissed(true)
    onLeaveGame()
  }

  // Handle manual leave request - show confirmation first
  const handleManualLeave = () => {
    setShowLeaveConfirmDialog(true)
  }

  // Handle confirmed leave - navigate away directly
  // The presence cleanup happens automatically when the component unmounts
  // We don't call disconnect('left') because that would show the RejoinGameDialog
  const handleConfirmLeave = () => {
    setShowLeaveConfirmDialog(false)
    onLeaveGame()
  }

  // Handle rejoin attempt - use connect callback
  const handleRejoin = () => {
    connect()
    if (rejoinReason === 'kicked') {
      toast.success('Rejoining game...')
    }
  }

  return (
    <div className="flex h-screen flex-col bg-surface-0">
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

      {/* Header */}
      <AppHeader
        variant="game"
        roomId={roomId}
        shareLink={shareLink}
        copied={copied}
        onLeave={handleManualLeave}
        onCopyLink={handleCopyShareLink}
        onOpenSettings={handleOpenSettings}
      />

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        <div className="flex h-full gap-4 p-4">
          {/* Left Sidebar - Player List */}
          <GameRoomSidebar
            roomId={roomId}
            userId={userId}
            playerName={username}
            isLobbyOwner={isOwner}
            ownerId={ownerId}
            onKickPlayer={handleKickPlayer}
            onBanPlayer={handleBanPlayer}
          />

          {/* Main Area - Video Stream Grid */}
          <div className="flex-1 overflow-hidden">
            <VideoStreamGridWithSuspense
              roomId={roomId}
              userId={userId}
              localPlayerName={username}
              detectorType={detectorType}
              usePerspectiveWarp={usePerspectiveWarp}
              onCardCrop={(canvas: HTMLCanvasElement) => {
                query(canvas)
              }}
              enableCardDetection={false}
            />
          </div>
        </div>
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
      />
    </PresenceProvider>
  )
}

export function GameRoom(props: GameRoomProps) {
  return (
    <MediaStreamProvider>
      <CardQueryProvider>
        <GameRoomWithPresence {...props} />
      </CardQueryProvider>
    </MediaStreamProvider>
  )
}
