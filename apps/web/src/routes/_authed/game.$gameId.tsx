import type { ReactNode } from 'react'
import { Suspense, useEffect, useRef } from 'react'
import { ErrorFallback } from '@/components/ErrorFallback'
import { GameRoom } from '@/components/GameRoom'
import { NotFoundPage } from '@/components/NotFoundPage'
import { RoomFullDialog } from '@/components/RoomFullDialog'
import { useAuth } from '@/contexts/AuthContext'
import { loadEmbeddingsAndMetaFromPackage } from '@/lib/clip-search'
import { sessionStorage } from '@/lib/session-storage'
import { api } from '@convex/_generated/api'
import * as Sentry from '@sentry/react'
import {
  createFileRoute,
  redirect,
  stripSearchParams,
  useNavigate,
} from '@tanstack/react-router'
import { zodValidator } from '@tanstack/zod-adapter'
import { useQuery } from 'convex/react'
import { Loader2 } from 'lucide-react'
import { ErrorBoundary } from 'react-error-boundary'
import { z } from 'zod'

const defaultValues = {
  usePerspectiveWarp: true, // Use OpenCV quad for precise perspective correction
  testStream: false, // Show a synthetic test stream in an empty slot
}

const GAME_ID_PATTERN = /^[A-Z0-9]{6}$/

const gameSearchSchema = z.object({
  detector: z.enum(['opencv', 'detr', 'owl-vit', 'yolov8']).optional(),
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
      GAME_ID_PATTERN,
      'Game ID must be a 6-character uppercase alphanumeric code',
    ),
})

// Key for localStorage where media device preferences are stored
const MEDIA_DEVICES_KEY = 'mtg-selected-media-devices'

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

/** Reports route-level errors to Sentry once, then renders children (e.g. ErrorFallback). */
function RouteErrorReporter({
  error,
  children,
}: {
  error: Error | unknown
  children: ReactNode
}) {
  const reportedRef = useRef(false)
  useEffect(() => {
    if (error && !reportedRef.current) {
      reportedRef.current = true
      Sentry.captureException(error, {
        tags: { source: 'router_route_error' },
      })
    }
  }, [error])
  return <>{children}</>
}

export const Route = createFileRoute('/_authed/game/$gameId')({
  ssr: false,
  component: GameRoomRoute,
  notFoundComponent: NotFoundPage,
  beforeLoad: async ({ location }) => {
    // Check if media devices are configured before entering game room
    const mediaConfigured = isMediaConfigured()
    if (!mediaConfigured) {
      throw redirect({
        to: '/setup',
        search: { returnTo: location.pathname },
      })
    }
    // Room access (not_found / banned) is handled in the component via useQuery
    // so we avoid router notFound() which can render blank with ssr: false.
  },
  loaderDeps: ({ search }) => ({ detector: search.detector }),
  loader: async ({ deps }) => {
    // Load embeddings database if card detection is enabled (detector param is set)
    if (deps.detector) {
      console.log(
        '[game.$gameId loader] Detector enabled, preloading embeddings database...',
      )
      try {
        await loadEmbeddingsAndMetaFromPackage()
        console.log('[game.$gameId loader] Embeddings database loaded')
      } catch (err) {
        console.error('[game.$gameId loader] Failed to load embeddings:', err)
        // Don't block page load - lazy loading will retry when query runs
      }
    }

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
    <RouteErrorReporter error={error}>
      <ErrorFallback error={error} resetErrorBoundary={reset} />
    </RouteErrorReporter>
  ),
  validateSearch: zodValidator(gameSearchSchema),
  search: {
    middlewares: [stripSearchParams(defaultValues)],
  },
})

function GameRoomRoute() {
  const { gameId } = Route.useParams()
  if (!GAME_ID_PATTERN.test(gameId)) {
    return <NotFoundPage />
  }

  return <ValidatedGameRoomRoute />
}

function ValidatedGameRoomRoute() {
  const { gameId } = Route.useParams()
  const { detector, usePerspectiveWarp, testStream } = Route.useSearch()
  const navigate = useNavigate()
  const { user } = useAuth()

  // Check room access for capacity (reactive query)
  const roomAccess = useQuery(api.rooms.checkRoomAccess, { roomId: gameId })

  const handleLeaveGame = () => {
    sessionStorage.clearGameState()
    navigate({ to: '/', reloadDocument: true }) // reloadDocument: true is needed to ensure the browser releases the camera/mic indicator
  }

  const handleClose = () => {
    navigate({ to: '/' })
  }

  // Show loading state while room access is being checked
  if (roomAccess === undefined) {
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
              Checking room availability...
            </h2>
          </div>
        </div>
      </div>
    )
  }

  // Show 404 for missing or banned room (covers client hydration when beforeLoad skipped on server)
  if (roomAccess.status === 'not_found' || roomAccess.status === 'banned') {
    return <NotFoundPage />
  }

  // Show room full dialog if room is at capacity
  if (roomAccess.status === 'full') {
    return (
      <div className="bg-surface-0 h-screen">
        <RoomFullDialog
          open={true}
          onClose={handleClose}
          message={`Room is full (Room ${gameId})`}
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
