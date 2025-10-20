import type { DetectorType } from '@/lib/detectors'
import { useEffect, useState } from 'react'
import {
  CardQueryProvider,
  useCardQueryContext,
} from '@/contexts/CardQueryContext'
import { loadEmbeddingsAndMetaFromPackage, loadModel } from '@/lib/clip-search'
import { loadingEvents } from '@/lib/loading-events'
import { loadOpenCV } from '@/lib/opencv-loader'
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
import { PlayerList } from './PlayerList'
import { TurnTracker } from './TurnTracker'
import { VideoStreamGrid } from './VideoStreamGrid'

interface GameRoomProps {
  gameId: string
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
  playerName,
  onLeaveGame,
  isLobbyOwner = true,
  detectorType,
  usePerspectiveWarp = true,
}: GameRoomProps) {
  const { query } = useCardQueryContext()
  const [copied, setCopied] = useState(false)
  const [players, setPlayers] = useState<Player[]>([
    { id: '1', name: playerName, life: 20, isActive: true },
    { id: '2', name: 'Alex', life: 20, isActive: false },
    { id: '3', name: 'Jordan', life: 20, isActive: false },
    { id: '4', name: 'Sam', life: 20, isActive: false },
  ])

  const [isLoading, setIsLoading] = useState(true)

  const handleLoadingComplete = () => {
    setIsLoading(false)
  }

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

        // Step 1: Load embeddings (0-20%)
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
          progress: 20,
          message: 'Card embeddings loaded',
        })

        // Step 2: Load CLIP model (20-40%)
        loadingEvents.emit({
          step: 'clip-model',
          progress: 25,
          message: 'Downloading CLIP model...',
        })

        await loadModel({
          onProgress: (msg) => {
            if (mounted) {
              console.log('[GameRoom] CLIP model loading:', msg)
              // Parse progress from message (e.g., "progress onnx/model.onnx 45.5%")
              const percentMatch = msg.match(/(\d+(?:\.\d+)?)\s*%/)
              let progress = 25 // Default start
              
              if (percentMatch) {
                const downloadPercent = parseFloat(percentMatch[1])
                // Map download progress (0-100%) to loading range (25-40%)
                progress = 25 + (downloadPercent / 100) * 15
              }
              
              loadingEvents.emit({
                step: 'clip-model',
                progress: Math.min(progress, 40),
                message: msg,
              })
            }
          },
        })

        if (!mounted) return

        console.log('[GameRoom] CLIP model loaded successfully')
        loadingEvents.emit({
          step: 'clip-model',
          progress: 40,
          message: 'CLIP model ready',
        })

        if (!mounted) return

        // Step 3: Load OpenCV (40-60%)
        loadingEvents.emit({
          step: 'opencv',
          progress: 45,
          message: 'Loading OpenCV.js...',
        })

        try {
          await loadOpenCV()
          console.log('[GameRoom] OpenCV loaded successfully during initialization')
        } catch (err) {
          console.error('[GameRoom] Failed to load OpenCV during initialization:', err)
          // Continue anyway - OpenCV will be lazy-loaded when needed
        }

        if (!mounted) return

        loadingEvents.emit({
          step: 'opencv',
          progress: 60,
          message: 'OpenCV.js ready',
        })

        if (!mounted) return

        // Note: Detector initialization happens in VideoStreamGrid/useWebcam
        // It will emit its own loading events (60-100%) when it initializes
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
