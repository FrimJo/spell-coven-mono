import type { DetectorType } from '@/lib/detectors'
import type { LoadingEvent } from '@/lib/loading-events'
import { useEffect, useState } from 'react'
import {
  CardQueryProvider,
  useCardQueryContext,
} from '@/contexts/CardQueryContext'
import { useDiscordUser } from '@/hooks/useDiscordUser'
import { useVoiceChannelEvents } from '@/hooks/useVoiceChannelEvents'
import { useVoiceChannelMembersFromEvents } from '@/hooks/useVoiceChannelMembersFromEvents'
import { useWebSocketAuthToken } from '@/hooks/useWebSocketAuthToken.js'
import { loadEmbeddingsAndMetaFromPackage, loadModel } from '@/lib/clip-search'
import { loadingEvents } from '@/lib/loading-events'
import { loadOpenCV } from '@/lib/opencv-loader'
import { ArrowLeft, Check, Copy, Settings, Users } from 'lucide-react'
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

import { CardPreview } from './CardPreview.js'
import { GameRoomLoader } from './GameRoomLoader.js'
import { MediaSetupDialog } from './MediaSetupDialog.js'
import { PlayerList } from './PlayerList.js'
import { TurnTracker } from './TurnTracker.js'
import { VideoStreamGrid } from './VideoStreamGrid.js'
import { VoiceDropoutModal } from './VoiceDropoutModal.js'

interface GameRoomProps {
  gameId: string
  playerName: string
  onLeaveGame: () => void
  isLobbyOwner?: boolean
  detectorType?: DetectorType
  usePerspectiveWarp?: boolean
  initialMembers?: Array<{
    id: string
    username: string
    avatar: string | null
  }>
}

interface Player {
  id: string
  name: string
  life: number
  isActive: boolean
}

function GameRoomContent({
  gameId,
  playerName,
  onLeaveGame,
  isLobbyOwner = true,
  detectorType,
  usePerspectiveWarp = true,
  initialMembers = [],
}: GameRoomProps) {
  const { query } = useCardQueryContext()
  const [copied, setCopied] = useState(false)

  // Initialize players from initial members (from loader)
  const [players, setPlayers] = useState<Player[]>(
    initialMembers.map((member, index) => ({
      id: member.id,
      name: member.username,
      life: 20,
      isActive: index === 0,
    })),
  )

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

  const { user: discordUser } = useDiscordUser()

  const { data: wsTokenData } = useWebSocketAuthToken({
    userId: discordUser?.id,
  })

  const [hasConnectedToVoice, setHasConnectedToVoice] = useState(false)

  // Auto-connect to voice channel AFTER SSE is established
  useEffect(() => {
    const connectToVoice = async () => {
      if (!discordUser?.id || !wsTokenData || hasConnectedToVoice) {
        return
      }

      console.log(
        '[GameRoom] SSE connected, auto-connecting to voice channel...',
      )
      setHasConnectedToVoice(true)

      // Import the server function dynamically
      const { connectUserToVoiceChannel } = await import(
        '@/server/handlers/discord-rooms.server'
      )

      const result = await connectUserToVoiceChannel({
        data: { userId: discordUser.id, channelId: gameId },
      })

      if (result.success) {
        console.log('[GameRoom] Successfully connected to voice channel')
      } else {
        console.warn(
          '[GameRoom] Failed to connect to voice channel:',
          result.error,
        )
      }
    }

    connectToVoice()
  }, [discordUser?.id, wsTokenData, gameId, hasConnectedToVoice])

  // Fetch voice channel members via real-time events
  // Only enabled when both userId and wsAuthToken are available
  // This will update the list when new members join or leave
  const { members: voiceChannelMembers } = useVoiceChannelMembersFromEvents({
    gameId,
    userId: discordUser?.id,
    jwtToken: wsTokenData,
    enabled: !!wsTokenData && !!discordUser,
  })

  useEffect(() => {
    // Update players when voice channel members change
    // This handles real-time joins/leaves after initial load

    setPlayers((prevPlayers) => {
      const newPlayers = voiceChannelMembers.map((member) => {
        // Preserve life total for existing players
        const existing = prevPlayers.find((p) => p.id === member.id)
        return {
          id: member.id,
          name: member.username,
          life: existing?.life ?? 20,
          isActive: member.isActive,
        }
      })
      return newPlayers
    })
  }, [voiceChannelMembers])

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
    onVoiceStateUpdate: (voiceState: APIVoiceState) => {
      console.log('[GameRoom] VOICE_STATE_UPDATE received:', {
        userId: voiceState.user_id,
        channelId: voiceState.channel_id,
        currentUserId: discordUser?.id,
      })

      // Only handle events for the current user
      if (
        voiceState.user_id === discordUser?.id &&
        voiceState.channel_id === null
      ) {
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
              ownerId={discordUser?.id || undefined}
            />
            <CardPreview playerName={playerName} onClose={() => {}} />
          </div>

          {/* Main Area - Video Stream Grid */}
          <div className="flex-1 overflow-hidden">
            <VideoStreamGrid
              players={players}
              localPlayerName={playerName}
              localPlayerId={discordUser?.id}
              gameId={gameId}
              onLifeChange={handleLifeChange}
              enableCardDetection={true}
              detectorType={detectorType}
              usePerspectiveWarp={usePerspectiveWarp}
              onCardCrop={(canvas: HTMLCanvasElement) => {
                query(canvas)
              }}
              voiceJwtToken={wsTokenData}
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
