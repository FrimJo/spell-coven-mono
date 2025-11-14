import type { DetectorType } from '@/lib/detectors'
import type { LoadingEvent } from '@/lib/loading-events'
import { useEffect, useMemo, useState } from 'react'
import {
  CardQueryProvider,
  useCardQueryContext,
} from '@/contexts/CardQueryContext'
import { useGameRoomParticipants } from '@/hooks/useGameRoomParticipants'
import { usePeerJS } from '@/hooks/usePeerJS'
import { loadEmbeddingsAndMetaFromPackage, loadModel } from '@/lib/clip-search'
import { loadingEvents } from '@/lib/loading-events'
import { loadOpenCV } from '@/lib/opencv-loader'
import { getTempUser } from '@/lib/temp-user'
import { ArrowLeft, Check, Copy, Settings } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@repo/ui/components/button'
import { Toaster } from '@repo/ui/components/sonner'

import { GameRoomLoader } from './GameRoomLoader.js'
import { GameRoomPlayerCount } from './GameRoomPlayerCount.js'
import { GameRoomSidebar } from './GameRoomSidebar.js'
import { GameRoomVideoGrid } from './GameRoomVideoGrid.js'
import { MediaSetupDialog } from './MediaSetupDialog.js'

interface GameRoomProps {
  roomId: string
  playerName: string
  onLeaveGame: () => void
  isLobbyOwner?: boolean
  detectorType?: DetectorType
  usePerspectiveWarp?: boolean
}

function GameRoomContent({
  roomId,
  playerName: _playerName,
  onLeaveGame,
  isLobbyOwner = true,
  detectorType,
  usePerspectiveWarp = true,
}: GameRoomProps) {
  // Get or create temporary user identity (replaces Discord auth)
  const tempUser = getTempUser()
  const userId = tempUser.id
  const username = tempUser.username

  const { query } = useCardQueryContext()
  const [copied, setCopied] = useState(false)

  // Compute shareable link (only on client)
  const shareLink = useMemo(() => {
    if (typeof window === 'undefined') return ''
    return `${window.location.origin}/game/${roomId}`
  }, [roomId])

  const [isLoading, setIsLoading] = useState(true)
  // HOOK: Dialog open state - only show on first visit to this room
  const [mediaDialogOpen, setMediaDialogOpen] = useState<boolean>(() => {
    // Check if user has already completed setup for this room
    if (typeof window === 'undefined') return false
    const setupCompleted = localStorage.getItem(`media-setup-${roomId}`)
    return !setupCompleted
  })

  const handleLoadingComplete = () => {
    setIsLoading(false)
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

  // Get remote player IDs from GAME ROOM participants (not voice channel!)
  // Game room participation is independent of Discord voice channels
  const { participants: gameRoomParticipants } = useGameRoomParticipants({
    roomId,
    userId,
    username, // Use generated username from temp user
    enabled: true,
  })

  const remotePlayerIds = useMemo(() => {
    const filtered = gameRoomParticipants
      .filter((p) => p.id !== userId)
      .map((p) => p.id)
    console.log('[GameRoom] remotePlayerIds calculated:', {
      allParticipants: gameRoomParticipants.length,
      localUserId: userId,
      remotePlayerIds: filtered,
    })
    return filtered
  }, [gameRoomParticipants, userId])

  // PeerJS hook for peer-to-peer video streaming
  const {
    localStream,
    localTrackState,
    remoteStreams,
    connectionStates,
    peerTrackStates,
    toggleVideo: togglePeerJSVideo,
    toggleAudio: togglePeerJSAudio,
    switchCamera,
    initializeLocalMedia,
    error: _peerError,
    isInitialized: _isInitialized,
  } = usePeerJS({
    localPlayerId: userId,
    remotePlayerIds: remotePlayerIds,
    onError: (error) => {
      console.error('[GameRoom] PeerJS error:', error)
      toast.error(error.message)
    },
  })

  // Debug: Log remote streams state
  useEffect(() => {
    console.log('[GameRoom] 🎥 Remote streams update:', {
      size: remoteStreams.size,
      keys: Array.from(remoteStreams.keys()),
      gameRoomParticipants: gameRoomParticipants.map((p) => p.id),
      remotePlayerIds,
    })
  }, [remoteStreams, gameRoomParticipants, remotePlayerIds])

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

  // Auto-initialize camera stream if setup was already completed
  useEffect(() => {
    const setupCompleted = localStorage.getItem(`media-setup-${roomId}`)
    const savedDeviceId = localStorage.getItem(`media-device-${roomId}`)

    console.log('[GameRoom] Media setup check:', {
      setupCompleted: !!setupCompleted,
      hasSavedDeviceId: !!savedDeviceId,
      mediaDialogOpen,
      willAutoInitialize: !!(
        setupCompleted &&
        savedDeviceId &&
        !mediaDialogOpen
      ),
    })

    if (setupCompleted && savedDeviceId && !mediaDialogOpen) {
      console.log(
        '[GameRoom] Setup already completed, initializing camera with saved device:',
        savedDeviceId,
      )
      initializeLocalMedia(savedDeviceId)
    } else if (!setupCompleted) {
      console.log('[GameRoom] No setup completed yet, waiting for media dialog')
    }
  }, [roomId, mediaDialogOpen, initializeLocalMedia])

  // Show dialog until user completes media setup
  const handleDialogComplete = async (config: {
    videoDeviceId: string
    audioInputDeviceId: string
    audioOutputDeviceId: string
  }) => {
    console.log('[GameRoom] Media dialog completed with config:', config)

    // Save to localStorage that setup has been completed for this room and the selected device
    localStorage.setItem(`media-setup-${roomId}`, 'true')
    localStorage.setItem(`media-device-${roomId}`, config.videoDeviceId)
    setMediaDialogOpen(false)

    console.log(
      '[GameRoom] Initializing local media with device:',
      config.videoDeviceId,
    )
    // Initialize local media stream after user selects their camera
    await initializeLocalMedia(config.videoDeviceId)
    console.log('[GameRoom] Local media initialization complete')
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

  const handleNextTurn = () => {
    // TODO: Implement turn advancement with peer-to-peer game state
    // This will broadcast to other players via SSE
  }

  const handleRemovePlayer = (_playerId: string) => {
    throw new Error('Not implemented')
    toast.success('Player removed from game')
  }

  return (
    <div className="flex h-screen flex-col bg-slate-950">
      {/* Media Setup Dialog - modal - only render when open to avoid Select component issues */}
      {mediaDialogOpen && (
        <MediaSetupDialog
          open={mediaDialogOpen}
          onComplete={handleDialogComplete}
        />
      )}

      <Toaster />

      {/* Header */}
      <header className="flex-shrink-0 border-b border-slate-800 bg-slate-900/50 backdrop-blur-sm">
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
            <GameRoomPlayerCount roomId={roomId} userId={userId} />

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
          {/* Left Sidebar - Turn Tracker & Player List */}
          <GameRoomSidebar
            roomId={roomId}
            userId={userId}
            playerName={username}
            isLobbyOwner={isLobbyOwner}
            onNextTurn={handleNextTurn}
            onRemovePlayer={handleRemovePlayer}
          />

          {/* Main Area - Video Stream Grid */}
          <div className="flex-1 overflow-hidden">
            <GameRoomVideoGrid
              roomId={roomId}
              userId={userId}
              playerName={username}
              detectorType={detectorType}
              usePerspectiveWarp={usePerspectiveWarp}
              onCardCrop={(canvas: HTMLCanvasElement) => {
                query(canvas)
              }}
              localStream={localStream}
              localTrackState={localTrackState}
              remoteStreams={remoteStreams}
              connectionStates={connectionStates}
              peerTrackStates={peerTrackStates}
              onToggleVideo={togglePeerJSVideo}
              onToggleAudio={togglePeerJSAudio}
              onSwitchCamera={switchCamera}
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
