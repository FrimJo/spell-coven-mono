import type { DetectorType } from '@/lib/detectors'
import { Suspense } from 'react'
import { ErrorFallback } from '@/components/ErrorFallback'
import { GameRoom } from '@/components/GameRoom'
import { useAuth } from '@/contexts/AuthContext'
import { MediaStreamProvider } from '@/contexts/MediaStreamContext'
import { sessionStorage } from '@/lib/session-storage'
import {
  createFileRoute,
  Navigate,
  redirect,
  stripSearchParams,
  useNavigate,
} from '@tanstack/react-router'
import { zodValidator } from '@tanstack/zod-adapter'
import { Loader2 } from 'lucide-react'
import { ErrorBoundary } from 'react-error-boundary'
import { z } from 'zod'

const defaultValues = {
  detector: 'opencv' as const,
  usePerspectiveWarp: true, // SlimSAM provides quads
}

const gameSearchSchema = z.object({
  detector: z
    .enum(['opencv', 'detr', 'owl-vit', 'slimsam', 'yolov8'])
    .default(defaultValues.detector),
  usePerspectiveWarp: z
    .boolean()
    .default(defaultValues.usePerspectiveWarp)
    .describe('Enable perspective correction (corner refinement + warp)'),
})

// Zod schema for validating the gameId path parameter
const gameParamsSchema = z.object({
  gameId: z
    .string()
    .min(1, 'Game ID is required')
    .regex(
      /^game-([A-Z0-9]{6}|TEST[A-Za-z0-9]+)$/,
      'Game ID must follow format: game-XXXXXX or game-TEST* for tests',
    ),
})

// Key for localStorage where media device preferences are stored
const MEDIA_DEVICES_KEY = 'mtg-selected-media-devices'

/**
 * Check if this is a test game ID (used for e2e tests).
 * Test game IDs start with "game-TEST" to bypass authentication.
 */
function isTestGameId(gameId: string): boolean {
  return gameId.startsWith('game-TEST')
}

/**
 * Check if user has configured media devices (camera and microphone).
 * Returns true if the user has completed setup, which means:
 * - Video is explicitly disabled, OR a video device is selected
 * - Audio is explicitly disabled, OR an audio device is selected
 */
function isMediaConfigured(): boolean {
  if (typeof window === 'undefined') return true // Skip check on server

  try {
    const stored = localStorage.getItem(MEDIA_DEVICES_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      // Check if video is configured (disabled or device selected)
      // Default to true for videoEnabled/audioEnabled for backwards compatibility
      const videoConfigured =
        parsed.videoEnabled === false || !!parsed.videoinput
      const audioConfigured =
        parsed.audioEnabled === false || !!parsed.audioinput
      return videoConfigured && audioConfigured
    }
  } catch {
    // If parsing fails, treat as not configured
  }
  return false
}

export const Route = createFileRoute('/game/$gameId')({
  component: GameRoomRoute,
  beforeLoad: ({ location }) => {
    // Check if media devices are configured before entering game room
    if (!isMediaConfigured()) {
      // Redirect to setup page with return URL
      throw redirect({
        to: '/setup',
        search: { returnTo: location.pathname },
      })
    }
  },
  pendingComponent: () => (
    <div className="flex h-screen items-center justify-center bg-slate-950">
      <div className="flex flex-col items-center space-y-4">
        <div className="relative">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-purple-500/20">
            <Loader2 className="h-8 w-8 animate-spin text-purple-400" />
          </div>
          <div className="absolute inset-0 animate-ping rounded-full bg-purple-500/10" />
        </div>
        <div className="space-y-1 text-center">
          <h2 className="text-lg font-medium text-slate-200">
            Loading in Game Room
          </h2>
          <p className="text-sm text-slate-400">Setting up your session...</p>
        </div>
      </div>
    </div>
  ),
  validateSearch: zodValidator(gameSearchSchema),
  search: {
    middlewares: [stripSearchParams(defaultValues)],
  },
  params: {
    parse: (params) => gameParamsSchema.parse(params),
  },
})

function GameRoomRoute() {
  const { gameId } = Route.useParams()
  const { detector, usePerspectiveWarp } = Route.useSearch()
  const navigate = useNavigate()
  const { user, isLoading, isAuthenticated } = useAuth()

  // Allow test game IDs to bypass authentication (for e2e tests)
  const isTestMode = isTestGameId(gameId)

  const handleLeaveGame = () => {
    sessionStorage.clearGameState()
    navigate({ to: '/' })
  }

  // Show loading while checking auth (skip for test mode)
  if (isLoading && !isTestMode) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950">
        <div className="flex flex-col items-center space-y-4">
          <div className="relative">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-purple-500/20">
              <Loader2 className="h-8 w-8 animate-spin text-purple-400" />
            </div>
          </div>
          <p className="text-sm text-slate-400">Checking authentication...</p>
        </div>
      </div>
    )
  }

  // Redirect to home if not authenticated (skip for test mode)
  if (!isAuthenticated && !isTestMode) {
    return <Navigate to="/" />
  }

  return (
    <ErrorBoundary
      fallbackRender={({ error, resetErrorBoundary }) => (
        <ErrorFallback error={error} resetErrorBoundary={resetErrorBoundary} />
      )}
      onReset={() => window.location.reload()}
    >
      {/* MediaStreamProvider manages video/audio streams at page level.
          Streams are cleaned up when user navigates away from the game page. */}
      <MediaStreamProvider>
        <Suspense
          fallback={
            <div className="flex h-screen items-center justify-center">
              Loading game room...
            </div>
          }
        >
          <GameRoom
            roomId={gameId}
            playerName={
              user?.username ?? (isTestMode ? 'TestPlayer' : 'Player')
            }
            onLeaveGame={handleLeaveGame}
            detectorType={detector as DetectorType | undefined}
            usePerspectiveWarp={usePerspectiveWarp}
          />
        </Suspense>
      </MediaStreamProvider>
    </ErrorBoundary>
  )
}
