import type { DetectorType } from '@/lib/detectors'
import type { LoadingEvent } from '@/lib/loading-events'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import {
  CardQueryProvider,
  useCardQueryContext,
} from '@/contexts/CardQueryContext'
import { useSupabasePresence } from '@/hooks/useSupabasePresence'
import { loadEmbeddingsAndMetaFromPackage, loadModel } from '@/lib/clip-search'
import { loadingEvents } from '@/lib/loading-events'
import { loadOpenCV } from '@/lib/opencv-loader'
import { ArrowLeft, Check, Copy, Settings } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@repo/ui/components/button'
import { Toaster } from '@repo/ui/components/sonner'

import { DuplicateSessionDialog } from './DuplicateSessionDialog.js'
import { GameRoomLoader } from './GameRoomLoader.js'
import { GameRoomPlayerCount } from './GameRoomPlayerCount.js'
import { GameRoomSidebar } from './GameRoomSidebar.js'
import { MediaSetupDialog } from './MediaSetupDialog.js'
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
  playerName: _playerName,
  onLeaveGame,
  detectorType,
  usePerspectiveWarp = true,
}: GameRoomProps) {
  // Get authenticated user from Supabase Auth (Discord OAuth)
  const { user } = useAuth()

  // User should always be authenticated at this point (protected route)
  // But we provide safe defaults just in case
  const userId = user?.id ?? ''
  const username = user?.username ?? 'Unknown'

  const { query } = useCardQueryContext()
  const [copied, setCopied] = useState(false)
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false)

  // Handle being kicked from the room
  const handleKicked = useCallback(() => {
    toast.error('You have been removed from the game')
    onLeaveGame()
  }, [onLeaveGame])

  // Handle duplicate session detection
  const handleDuplicateSession = useCallback(() => {
    console.log('[GameRoom] Duplicate session detected, showing dialog')
    setShowDuplicateDialog(true)
  }, [])

  // Handle session being transferred to another tab
  const handleSessionTransferred = useCallback(() => {
    console.log(
      '[GameRoom] Session transferred to another tab, closing this one',
    )
    toast.info('Session transferred to another tab')
    // Give user a moment to see the toast, then leave
    setTimeout(() => {
      onLeaveGame()
    }, 1500)
  }, [onLeaveGame])

  // Track room presence (shares store with GameRoomSidebar and GameRoomPlayerCount)
  const {
    error: presenceError,
    isLoading: isPresenceLoading,
    ownerId,
    isOwner,
    kickPlayer,
    banPlayer,
    transferSession,
  } = useSupabasePresence({
    roomId,
    userId,
    username,
    avatar: user?.avatar,
    onKicked: handleKicked,
    onDuplicateSession: handleDuplicateSession,
    onSessionTransferred: handleSessionTransferred,
  })

  useEffect(() => {
    if (presenceError) {
      toast.error(`Room error: ${presenceError.message}`)
    }
  }, [presenceError])

  // Compute shareable link (only on client)
  const shareLink = useMemo(() => {
    if (typeof window === 'undefined') return ''
    return `${window.location.origin}/game/${roomId}`
  }, [roomId])

  const [isEventLoading, setIsEventLoading] = useState(true)

  // Consider loaded once we have participants (even if 0 initially triggers sync)
  const isLoading = isEventLoading || isPresenceLoading

  // HOOK: Dialog open state - only show on first visit to this room
  // Note: Permissions are handled locally in VideoStreamGrid and MediaSetupDialog
  const [mediaDialogOpen, setMediaDialogOpen] = useState<boolean>(() => {
    // Check if user has already completed setup for this room
    if (typeof window === 'undefined') return false
    const setupCompleted = localStorage.getItem(`media-setup-${roomId}`)
    return !setupCompleted
  })

  const handleLoadingComplete = () => {
    setIsEventLoading(false)
  }

  // Listen to loading events and complete when voice-channel step reaches 95%
  useEffect(() => {
    const handleLoadingEvent = (event: LoadingEvent) => {
      if (event.step === 'voice-channel' && event.progress >= 95) {
        handleLoadingComplete()
      }
    }

    const unsubscribe = loadingEvents.subscribe(handleLoadingEvent)
    return unsubscribe
  }, [])

  // Voice channel validation is now done in the route's beforeLoad hook
  // If user is not in voice channel, they won't reach this component
  useEffect(() => {
    // Emit loading events to complete the loading sequence
    loadingEvents.emit({
      step: 'voice-channel',
      progress: 88,
      message: 'Connecting to voice channel...',
    })

    loadingEvents.emit({
      step: 'voice-channel',
      progress: 95,
      message: 'Voice channel ready',
    })
  }, [])

  // Initialize CLIP model and embeddings on mount
  useEffect(() => {
    console.log('[GameRoom] Component mounted, starting initialization...')

    let mounted = true

    async function initModel() {
      console.log('[GameRoom] initModel() called')
      try {
        if (!mounted) {
          console.log('[GameRoom] Component unmounted, aborting initialization')
          return
        }

        // Step 1: Load embeddings (0-16.67%)
        console.log('[GameRoom] Step 1: Loading embeddings...')
        loadingEvents.emit({
          step: 'embeddings',
          progress: 10,
          message: 'Loading card embeddings...',
        })

        await loadEmbeddingsAndMetaFromPackage()
        console.log('[GameRoom] Embeddings loaded successfully')

        if (!mounted) return

        loadingEvents.emit({
          step: 'embeddings',
          progress: 16.67,
          message: 'Card embeddings loaded',
        })

        // Step 2: Load CLIP model (16.67-33.33%)
        loadingEvents.emit({
          step: 'clip-model',
          progress: 20,
          message: 'Downloading CLIP model...',
        })

        await loadModel({
          onProgress: (msg) => {
            if (mounted) {
              console.log('[GameRoom] CLIP model loading:', msg)
              // Parse progress from message (e.g., "progress onnx/model.onnx 45.5%")
              const percentMatch = msg.match(/(\d+(?:\.\d+)?)\s*%/)
              let progress = 20 // Default start

              if (percentMatch && percentMatch[1]) {
                const downloadPercent = parseFloat(percentMatch[1])
                // Map download progress (0-100%) to loading range (20-33.33%)
                progress = 20 + (downloadPercent / 100) * 13.33
              }

              loadingEvents.emit({
                step: 'clip-model',
                progress: Math.min(progress, 33.33),
                message: msg,
              })
            }
          },
        })

        if (!mounted) return

        console.log('[GameRoom] CLIP model loaded successfully')
        loadingEvents.emit({
          step: 'clip-model',
          progress: 33.33,
          message: 'CLIP model ready',
        })

        if (!mounted) return

        // Step 3: Load OpenCV (33.33-50%)
        loadingEvents.emit({
          step: 'opencv',
          progress: 38,
          message: 'Loading OpenCV.js...',
        })

        try {
          // Add timeout to prevent hanging
          const openCVPromise = loadOpenCV()
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(
              () => reject(new Error('OpenCV loading timeout')),
              30000,
            ),
          )
          await Promise.race([openCVPromise, timeoutPromise])
          console.log(
            '[GameRoom] OpenCV loaded successfully during initialization',
          )
        } catch (err) {
          console.error(
            '[GameRoom] Failed to load OpenCV during initialization:',
            err,
          )
          // Continue anyway - OpenCV will be lazy-loaded when needed
        }

        if (!mounted) return

        loadingEvents.emit({
          step: 'opencv',
          progress: 50,
          message: 'OpenCV.js ready',
        })

        if (!mounted) return

        // Note: Detector initialization happens in VideoStreamGrid/useWebcam
        // It will emit its own loading events (50-83.33%) when it initializes
        // Voice channel validation happens in a separate effect after auth is available
      } catch (err) {
        console.error('[GameRoom] Model initialization error:', err)
        console.error('[GameRoom] Error details:', {
          message: err instanceof Error ? err.message : String(err),
          stack: err instanceof Error ? err.stack : undefined,
        })
        if (mounted) {
          toast.error('Failed to load card recognition model')
        }
      }
    }

    initModel()

    return () => {
      mounted = false
    }
  }, [])

  // Show dialog until user completes media setup
  const handleDialogComplete = async () => {
    console.log('[GameRoom] Media dialog completed')

    // Save to localStorage that setup has been completed for this room and the selected device
    localStorage.setItem(`media-setup-${roomId}`, 'true')

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
      setShowDuplicateDialog(false)
      toast.success('Session transferred to this tab')
    } catch (error) {
      console.error('[GameRoom] Failed to transfer session:', error)
      toast.error('Failed to transfer session')
    }
  }

  // Handle closing this tab (user wants to keep other session)
  const handleCloseDuplicateTab = () => {
    setShowDuplicateDialog(false)
    onLeaveGame()
  }

  return (
    <div className="flex h-screen flex-col bg-slate-950">
      {/* Duplicate Session Dialog - shown when user is already connected from another tab */}
      <DuplicateSessionDialog
        open={showDuplicateDialog}
        onTransfer={handleTransferSession}
        onClose={handleCloseDuplicateTab}
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
      <header className="shrink-0 border-b border-slate-800 bg-slate-900/50 backdrop-blur-sm">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={onLeaveGame}
              className="text-slate-400 hover:text-white"
              title="Leave game room"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Leave
            </Button>

            <div className="h-6 w-px bg-slate-700" />

            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-400">Share Link:</span>
              <code className="max-w-xs truncate rounded bg-slate-800 px-2 py-1 text-sm text-purple-400">
                {shareLink}
              </code>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopyShareLink}
                className="text-slate-400 hover:text-white"
                title="Copy shareable link"
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
            <GameRoomPlayerCount roomId={roomId} maxPlayers={4} />
            <Button
              variant="ghost"
              size="sm"
              onClick={handleOpenSettings}
              className="text-slate-400 hover:text-white"
              title="Audio & video settings"
            >
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

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
            />
          </div>
        </div>
      </div>

      {/* Loading Overlay */}
      {isLoading && (
        <GameRoomLoader onLoadingComplete={handleLoadingComplete} />
      )}
    </div>
  )
}

export function GameRoom(props: GameRoomProps) {
  return (
    <CardQueryProvider>
      <GameRoomContent {...props} />
    </CardQueryProvider>
  )
}
