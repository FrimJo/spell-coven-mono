import type { VoiceLeftEvent } from '@/hooks/useVoiceChannelEvents'
import type { DetectorType } from '@/lib/detectors'
import type { LoadingEvent } from '@/lib/loading-events'
import { useEffect, useState } from 'react'
import {
  CardQueryProvider,
  useCardQueryContext,
} from '@/contexts/CardQueryContext'
import { useAuth } from '@/hooks/useAuth'
import { useVoiceChannelEvents } from '@/hooks/useVoiceChannelEvents'
import { useVoiceChannelMembersFromEvents } from '@/hooks/useVoiceChannelMembersFromEvents'
import { loadEmbeddingsAndMetaFromPackage, loadModel } from '@/lib/clip-search'
import { loadingEvents } from '@/lib/loading-events'
import { loadOpenCV } from '@/lib/opencv-loader'
import { connectUserToVoiceChannel } from '@/server/discord-rooms'
import { generateWebSocketAuthToken } from '@/server/ws-auth'
import { useQuery } from '@tanstack/react-query'
import { useServerFn } from '@tanstack/react-start'
import { ArrowLeft, Check, Copy, Settings, Users } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@repo/ui/components/button'
import { Toaster } from '@repo/ui/components/sonner'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@repo/ui/components/tooltip'

import { CardPreview } from './CardPreview'
import { GameRoomLoader } from './GameRoomLoader'
import { MediaSetupDialog } from './MediaSetupDialog'
import { PlayerList } from './PlayerList'
import { TurnTracker } from './TurnTracker'
import { VideoStreamGrid } from './VideoStreamGrid'
import { VoiceDropoutModal } from './VoiceDropoutModal'

interface GameRoomProps {
  gameId: string
  guildId: string
  playerName: string
  onLeaveGame: () => void
  isLobbyOwner?: boolean
  detectorType?: DetectorType
  usePerspectiveWarp?: boolean
}

interface Player {
  id: string
  name: string
  life: number
  isActive: boolean
}

function GameRoomContent({
  gameId,
  guildId,
  playerName,
  onLeaveGame,
  isLobbyOwner = true,
  detectorType,
  usePerspectiveWarp = true,
}: GameRoomProps) {
  const { query } = useCardQueryContext()
  const [copied, setCopied] = useState(false)
  const [players, setPlayers] = useState<Player[]>([])

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

  const auth = useAuth()

  const generateWsTokenFn = useServerFn(generateWebSocketAuthToken)

  // Generate WebSocket auth token using useQuery (not suspense - we handle loading separately)
  const { data: wsTokenData } = useQuery({
    queryKey: ['ws-auth-token', auth.userId],
    queryFn: async () => {
      return generateWsTokenFn({ data: { userId: auth.userId } })
    },
    staleTime: 50 * 60 * 1000, // 50 minutes (token expires in 1 hour)
  })

  // Fetch voice channel members via real-time events
  // Only enabled when both userId and wsAuthToken are available
  const { members: voiceChannelMembers } = useVoiceChannelMembersFromEvents({
    gameId,
    userId: auth.userId,
    jwtToken: wsTokenData?.token,
    enabled: !!wsTokenData?.token,
  })

  useEffect(() => {
    if (voiceChannelMembers.length > 0) {
      // Convert voice channel members to player objects with life tracking
      const updatedPlayers = voiceChannelMembers.map((member, index) => ({
        id: member.id,
        name: member.username,
        life: 20, // Default life total
        isActive: index === 0, // First member is active
      }))
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPlayers(updatedPlayers)
    }
  }, [voiceChannelMembers])

  // Connect user to voice channel (required for loading to complete)
  const connectToVoiceChannelFn = useServerFn(connectUserToVoiceChannel)

  useEffect(() => {
    if (!auth?.userId) return

    const connectToVoiceChannel = async () => {
      try {
        console.log('[GameRoom] Connecting to voice channel...')
        loadingEvents.emit({
          step: 'voice-channel',
          progress: 88,
          message: 'Connecting to voice channel...',
        })

        if (!guildId) {
          console.error('[GameRoom] Guild ID not configured')
          loadingEvents.emit({
            step: 'voice-channel',
            progress: 95,
            message: 'Voice channel ready',
          })
          return
        }

        const result = await connectToVoiceChannelFn({
          data: {
            guildId,
            channelId: gameId,
            userId: auth.userId,
          },
        })

        if (result.success) {
          console.log('[GameRoom] Successfully connected to voice channel')
        } else {
          console.error(
            '[GameRoom] Failed to connect to voice channel:',
            result.error,
          )
          toast.error('Failed to connect to voice channel: ' + result.error)
        }

        loadingEvents.emit({
          step: 'voice-channel',
          progress: 95,
          message: 'Voice channel ready',
        })
      } catch (error) {
        console.error('[GameRoom] Error connecting to voice channel:', error)
        toast.error('Error connecting to voice channel')
        loadingEvents.emit({
          step: 'voice-channel',
          progress: 95,
          message: 'Voice channel ready',
        })
      }
    }

    connectToVoiceChannel()
  }, [auth?.userId, gameId, guildId, connectToVoiceChannelFn])

  // Listen for voice channel events (for dropout detection)
  // Only enabled when wsAuthToken is available
  useVoiceChannelEvents({
    jwtToken: wsTokenData?.token,
    onVoiceLeft: wsTokenData?.token
      ? (event: VoiceLeftEvent) => {
          console.log('[GameRoom] User left voice channel:', event)
          setVoiceDropoutOpen(true)
          toast.warning('You have been removed from the voice channel')
        }
      : undefined,
    onError: wsTokenData?.token
      ? (error: Error) => {
          console.error('[GameRoom] Voice channel event error:', error)
          // Don't show error toast for connection issues - they're expected
        }
      : undefined,
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

              if (percentMatch) {
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

  const handleCopyGameId = () => {
    navigator.clipboard.writeText(gameId)
    setCopied(true)
    toast.success('Game ID copied to clipboard!')
    setTimeout(() => setCopied(false), 2000)
  }

  const handleLifeChange = (playerId: string, newLife: number) => {
    setPlayers(
      players.map((p) => (p.id === playerId ? { ...p, life: newLife } : p)),
    )
  }

  const handleNextTurn = () => {
    const currentIndex = players.findIndex((p) => p.isActive)
    const nextIndex = (currentIndex + 1) % players.length
    setPlayers(
      players.map((p, i) => ({
        ...p,
        isActive: i === nextIndex,
      })),
    )
  }

  const handleRemovePlayer = (playerId: string) => {
    setPlayers(players.filter((p) => p.id !== playerId))
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
              <span className="text-sm text-slate-400">Game ID:</span>
              <code className="rounded bg-slate-800 px-2 py-1 text-sm text-purple-400">
                {gameId}
              </code>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopyGameId}
                className="text-slate-400 hover:text-white"
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
            <div className="flex items-center gap-2 text-slate-400">
              <Users className="h-4 w-4" />
              <span className="text-sm">{players.length}/4 Players</span>
            </div>

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
          <div className="w-64 flex-shrink-0 space-y-4 overflow-y-auto">
            <TurnTracker players={players} onNextTurn={handleNextTurn} />
            <PlayerList
              players={players}
              isLobbyOwner={isLobbyOwner}
              localPlayerName={playerName}
              onRemovePlayer={handleRemovePlayer}
              ownerId={auth?.userId}
            />
            <CardPreview playerName={playerName} onClose={() => {}} />
          </div>

          {/* Main Area - Video Stream Grid */}
          <div className="flex-1 overflow-hidden">
            <VideoStreamGrid
              players={players}
              localPlayerName={playerName}
              onLifeChange={handleLifeChange}
              enableCardDetection={true}
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
