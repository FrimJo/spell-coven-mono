import { Suspense } from 'react'
import { AuthRequiredDialog } from '@/components/AuthRequiredDialog'
import { ErrorFallback } from '@/components/ErrorFallback'
import { GameRoom } from '@/components/GameRoom'
import { useAuth } from '@/contexts/AuthContext'
import { convex } from '@/integrations/convex/provider'
import { sessionStorage } from '@/lib/session-storage'
import { api } from '@convex/_generated/api'
import {
  createFileRoute,
  notFound,
  redirect,
  stripSearchParams,
  useNavigate,
} from '@tanstack/react-router'
import { zodValidator } from '@tanstack/zod-adapter'
import { Loader2 } from 'lucide-react'
import { ErrorBoundary } from 'react-error-boundary'
import { z } from 'zod'

const defaultValues = {
  usePerspectiveWarp: true, // Use OpenCV quad for precise perspective correction
  testStream: false, // Show a synthetic test stream in an empty slot
}

const gameSearchSchema = z.object({
  detector: z
    .enum(['opencv', 'detr', 'owl-vit', 'slimsam', 'yolov8'])
    .optional(),
  usePerspectiveWarp: z
    .boolean()
    .default(defaultValues.usePerspectiveWarp)
    .describe('Enable perspective correction (corner refinement + warp)'),
  testStream: z
    .boolean()
    .default(defaultValues.testStream)
    .describe('Show a synthetic test stream in an empty slot for development'),
})

// Zod schema for validating the gameId path parameter
const gameParamsSchema = z.object({
  gameId: z
    .string()
    .min(1, 'Game ID is required')
    .regex(
      /^[A-Z0-9]{6}$/,
      'Game ID must be a 6-character uppercase alphanumeric code',
    ),
})

// Key for localStorage where media device preferences are stored
const MEDIA_DEVICES_KEY = 'mtg-selected-media-devices'

/**
 * Check if the user can access the room.
 * Returns the access status: 'ok', 'not_found', or 'banned'.
 */
async function checkRoomAccess(
  roomId: string,
): Promise<{ status: 'ok' | 'not_found' | 'banned' }> {
  return await convex.query(api.rooms.checkRoomAccess, { roomId })
}

/**
 * Check if user has completed media setup.
 * Returns true if the user has clicked "Complete Setup" at least once.
 * Users can complete setup without granting permissions - they'll see
 * the permission prompt in the game room via MediaPermissionInline.
 */
function isMediaConfigured(): boolean {
  if (typeof window === 'undefined') return true // Skip check on server

  try {
    const stored = localStorage.getItem(MEDIA_DEVICES_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      // Check if setup was completed (has timestamp from commitToStorage)
      return !!parsed.timestamp
    }
  } catch {
    // If parsing fails, treat as not configured
  }
  return false
}

export const Route = createFileRoute('/game/$gameId')({
  component: GameRoomRoute,
  beforeLoad: async ({ location, params }) => {
    // Check if media devices are configured before entering game room
    const mediaConfigured = isMediaConfigured()
    if (!mediaConfigured) {
      // Redirect to setup page with return URL
      throw redirect({
        to: '/setup',
        search: { returnTo: location.pathname },
      })
    }

    // Check if room exists and user is not banned
    const roomAccess = await checkRoomAccess(params.gameId)
    if (roomAccess.status !== 'ok') {
      // Show same error for both 'not_found' and 'banned' (security - don't reveal ban status)
      throw notFound()
    }
  },
  loader: async () => {
    // // Load embeddings
    // await loadEmbeddingsAndMetaFromPackage()

    // // Load CLIP model
    // await loadModel()

    // // Load OpenCV with timeout (continue if fails - will lazy-load later)
    // try {
    //   await Promise.race([
    //     loadOpenCV(),
    //     new Promise((_, reject) =>
    //       setTimeout(() => reject(new Error('OpenCV loading timeout')), 30000),
    //     ),
    //   ])
    // } catch (err) {
    //   console.error('Failed to load OpenCV:', err)
    // }

    return {}
  },
  pendingComponent: () => (
    <div className="bg-surface-0 flex h-screen items-center justify-center">
      <div className="flex flex-col items-center space-y-4">
        <div className="relative">
          <div className="bg-brand/20 flex h-16 w-16 items-center justify-center rounded-full">
            <Loader2 className="text-brand-muted-foreground h-8 w-8 animate-spin" />
          </div>
          <div className="bg-brand/10 absolute inset-0 animate-ping rounded-full" />
        </div>
        <div className="space-y-1 text-center">
          <h2 className="text-text-secondary text-lg font-medium">
            Loading in Game Room
          </h2>
          <p className="text-text-muted text-sm">Setting up your session...</p>
        </div>
      </div>
    </div>
  ),
  errorComponent: ({ error, reset }) => (
    <ErrorFallback error={error} resetErrorBoundary={reset} />
  ),
  validateSearch: zodValidator(gameSearchSchema),
  search: {
    middlewares: [stripSearchParams(defaultValues)],
  },
  params: {
    parse: (params) => gameParamsSchema.parse(params),
  },
})

// Key for storing the return URL after OAuth
const AUTH_RETURN_TO_KEY = 'auth-return-to'

function GameRoomRoute() {
  const { gameId } = Route.useParams()
  const { detector, usePerspectiveWarp, testStream } = Route.useSearch()
  const navigate = useNavigate()
  const { user, isLoading: isAuthLoading, isAuthenticated, signIn } = useAuth()

  const handleLeaveGame = () => {
    sessionStorage.clearGameState()
    navigate({ to: '/', reloadDocument: true }) // reloadDocument: true is needed to ensure the browser releases the camera/mic indicator
  }

  const handleSignIn = async () => {
    // Store the current game room path so we can return after OAuth
    window.sessionStorage.setItem(AUTH_RETURN_TO_KEY, `/game/${gameId}`)
    await signIn()
  }

  const handleClose = () => {
    navigate({ to: '/' })
  }

  // Show loading state while auth is being determined
  if (isAuthLoading) {
    return (
      <div className="bg-surface-0 flex h-screen items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="relative">
            <div className="bg-brand/20 flex h-16 w-16 items-center justify-center rounded-full">
              <Loader2 className="text-brand-muted-foreground h-8 w-8 animate-spin" />
            </div>
            <div className="bg-brand/10 absolute inset-0 animate-ping rounded-full" />
          </div>
          <div className="space-y-1 text-center">
            <h2 className="text-text-secondary text-lg font-medium">
              Checking authentication...
            </h2>
          </div>
        </div>
      </div>
    )
  }

  // Show auth dialog if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="bg-surface-0 h-screen">
        <AuthRequiredDialog
          open={true}
          onSignIn={handleSignIn}
          onClose={handleClose}
          message="You need to sign in with Discord to join this game room."
        />
      </div>
    )
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
          detectorType={detector}
          usePerspectiveWarp={usePerspectiveWarp}
          showTestStream={testStream}
        />
      </Suspense>
    </ErrorBoundary>
  )
}
