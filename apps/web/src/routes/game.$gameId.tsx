import type { DetectorType } from '@/lib/detectors'
import { Suspense } from 'react'
import { ErrorFallback } from '@/components/ErrorFallback'
import { GameRoom } from '@/components/GameRoom'
import { useAuth } from '@/contexts/AuthContext'
import { sessionStorage } from '@/lib/session-storage'
import {
  createFileRoute,
  Navigate,
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
      /^game-[A-Z0-9]{6}$/,
      'Game ID must follow format: game-XXXXXX (6 alphanumeric characters)',
    ),
})

export const Route = createFileRoute('/game/$gameId')({
  component: GameRoomRoute,
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

  const handleLeaveGame = () => {
    sessionStorage.clearGameState()
    navigate({ to: '/' })
  }

  // Show loading while checking auth
  if (isLoading) {
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

  // Redirect to home if not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/" />
  }

  return (
    <ErrorBoundary
      fallbackRender={({ error, resetErrorBoundary }) => (
        <ErrorFallback error={error} resetErrorBoundary={resetErrorBoundary} />
      )}
      onReset={() => window.location.reload()}
    >
      <Suspense
        fallback={
          <div className="flex h-screen items-center justify-center">
            Loading game room...
          </div>
        }
      >
        <GameRoom
          roomId={gameId}
          playerName={user?.username ?? 'Player'}
          onLeaveGame={handleLeaveGame}
          detectorType={detector as DetectorType | undefined}
          usePerspectiveWarp={usePerspectiveWarp}
        />
      </Suspense>
    </ErrorBoundary>
  )
}
