import type { DetectorType } from '@/lib/detectors'
import type { LoadingEvent } from '@/lib/loading-events'
import { useEffect, useMemo, useState } from 'react'
import {
  CardQueryProvider,
  useCardQueryContext,
} from '@/contexts/CardQueryContext'
import { useVoiceChannelEvents } from '@/hooks/useVoiceChannelEvents'
import { useWebRTC } from '@/hooks/useWebRTC'
import { useWebSocketAuthToken } from '@/hooks/useWebSocketAuthToken.js'
import { loadEmbeddingsAndMetaFromPackage, loadModel } from '@/lib/clip-search'
import { loadingEvents } from '@/lib/loading-events'
import { loadOpenCV } from '@/lib/opencv-loader'
import { getRouteApi } from '@tanstack/react-router'
import { ArrowLeft, Check, Copy, Settings } from 'lucide-react'
import { toast } from 'sonner'

import type { APIVoiceState } from '@repo/discord-integration/types'
import { Button } from '@repo/ui/components/button'
import { Toaster } from '@repo/ui/components/sonner'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@repo/ui/components/tooltip'

import { GameRoomLoader } from './GameRoomLoader.js'
import { GameRoomPlayerCount } from './GameRoomPlayerCount.js'
import { GameRoomSidebar } from './GameRoomSidebar.js'
import { GameRoomVideoGrid } from './GameRoomVideoGrid.js'
import { MediaSetupDialog } from './MediaSetupDialog.js'
import { VoiceDropoutModal } from './VoiceDropoutModal.js'

const GameRoomRoute = getRouteApi('/game/$gameId')

export function useGameRoomLoaderData() {
  const loaderData = GameRoomRoute.useLoaderData()
  if (!loaderData.isAuthenticated) {
    throw new Error('User is not authenticated')
  }
  if (!loaderData.voiceChannelStatus.inChannel) {
    throw new Error('User is not in voice channel')
  }
  return loaderData
}

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
  playerName,
  onLeaveGame,
  isLobbyOwner = true,
  detectorType,
  usePerspectiveWarp = true,
}: GameRoomProps) {
  const { userId } = useGameRoomLoaderData()
  const { query } = useCardQueryContext()
  const [copied, setCopied] = useState(false)

  // Compute shareable link (only on client)
  const shareLink = useMemo(() => {
    if (typeof window === 'undefined') return ''
    return `${window.location.origin}/game/${roomId}`
  }, [roomId])

  const [isLoading, setIsLoading] = useState(true)
  // HOOK: Dialog open state
  const [mediaDialogOpen, setMediaDialogOpen] = useState<boolean>(true)

  // Voice dropout modal state
  const [voiceDropoutOpen, setVoiceDropoutOpen] = useState(false)

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

  const { data: wsTokenData } = useWebSocketAuthToken({ userId })

  // WebRTC hook for peer-to-peer video streaming
  const {
    localStream,
    remoteStreams,
    connectionStates,
    startVideo,
    stopVideo,
    toggleVideo: toggleWebRTCVideo,
    toggleAudio: toggleWebRTCAudio,
    switchCamera,
    isVideoActive: isWebRTCVideoActive,
    isAudioMuted: isWebRTCAudioMuted,
  } = useWebRTC({
    roomId: roomId,
    localPlayerId: userId,
  })

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

  // Listen for voice channel events (for dropout detection)
  // Only enabled when wsAuthToken is available
  useVoiceChannelEvents({
    jwtToken: wsTokenData,
    userId: userId,
    channelId: roomId,
    onVoiceStateUpdate: (voiceState: APIVoiceState) => {
      console.log('[GameRoom] VOICE_STATE_UPDATE received:', {
        userId: voiceState.user_id,
        channelId: voiceState.channel_id,
        currentUserId: userId,
      })

      // Only handle events for the current user
      if (voiceState.user_id === userId && voiceState.channel_id === null) {
        console.log('[GameRoom] Current user left voice channel')
        setVoiceDropoutOpen(true)
        toast.warning('You have been removed from the voice channel')
      }
    },
    onError: (error: Error) => {
      console.error('[GameRoom] Voice channel event error:', error)
      // Don't show error toast for connection issues - they're expected
    },
  })

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
  const handleDialogComplete = () => {
    setMediaDialogOpen(false)
  }

  const handleCopyShareLink = () => {
    navigator.clipboard.writeText(shareLink)
    setCopied(true)
    toast.success('Shareable link copied to clipboard!')
    setTimeout(() => setCopied(false), 2000)
  }

  const handleNextTurn = () => {
    // TODO: Implement turn advancement with peer-to-peer game state
    // This will broadcast to other players via SSE
  }

  const handleRemovePlayer = (playerId: string) => {
    throw new Error('Not implemented')
    toast.success('Player removed from game')
  }

  return (
    <div className="flex h-screen flex-col bg-slate-950">
      {/* Media Setup Dialog - modal */}
      <MediaSetupDialog
        open={mediaDialogOpen}
        onComplete={handleDialogComplete}
      />

      {/* Voice Dropout Modal */}
      <VoiceDropoutModal
        open={voiceDropoutOpen}
        onRejoin={() => setVoiceDropoutOpen(false)}
        onLeaveGame={onLeaveGame}
      />

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
              <span className="text-sm text-slate-400">Share Link:</span>
              <code className="max-w-xs truncate rounded bg-slate-800 px-2 py-1 text-sm text-purple-400">
                {shareLink}
              </code>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleCopyShareLink}
                      className="text-slate-400 hover:text-white"
                    >
                      {copied ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Copy shareable link</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <GameRoomPlayerCount roomId={roomId} userId={userId} />

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
          <GameRoomSidebar
            roomId={roomId}
            userId={userId}
            playerName={playerName}
            isLobbyOwner={isLobbyOwner}
            onNextTurn={handleNextTurn}
            onRemovePlayer={handleRemovePlayer}
          />

          {/* Main Area - Video Stream Grid */}
          <div className="flex-1 overflow-hidden">
            <GameRoomVideoGrid
              roomId={roomId}
              userId={userId}
              playerName={playerName}
              detectorType={detectorType}
              usePerspectiveWarp={usePerspectiveWarp}
              onCardCrop={(canvas: HTMLCanvasElement) => {
                query(canvas)
              }}
              remoteStreams={remoteStreams}
              connectionStates={connectionStates}
              onLocalVideoStart={startVideo}
              onLocalVideoStop={stopVideo}
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
