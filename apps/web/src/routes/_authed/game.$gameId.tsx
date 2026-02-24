import type { ReactNode } from 'react'
import { Suspense, useEffect, useRef } from 'react'
import { ErrorFallback } from '@/components/ErrorFallback'
import { GameRoom } from '@/components/GameRoom'
import { NotFoundPage } from '@/components/NotFoundPage'
import { RoomFullDialog } from '@/components/RoomFullDialog'
import { useAuth } from '@/contexts/AuthContext'
import { env } from '@/env'
import { checkRoomAccessServer } from '@/integrations/convex/server-client'
import { loadEmbeddingsAndMetaFromPackage } from '@/lib/clip-search'
import { GAME_ID_PATTERN } from '@/lib/game-id'
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
  component: GameRoomPage,
  beforeLoad: async ({ params, location }) => {
    // notFound() renders blank with ssr: false — validate here only to
    // skip the media-config redirect for malformed IDs.
    if (!GAME_ID_PATTERN.test(params.gameId)) {
      return
    }

    const mediaConfigured = isMediaConfigured()
    if (!mediaConfigured) {
      throw redirect({
        to: '/setup',
        search: { returnTo: location.pathname },
      })
    }
  },
  loaderDeps: ({ search }) => ({ detector: search.detector }),
  loader: async ({ params, deps }) => {
    if (!GAME_ID_PATTERN.test(params.gameId)) {
      return { roomNotFound: true }
    }

    const access = await checkRoomAccessServer(
      env.VITE_CONVEX_URL,
      params.gameId,
    )
    if (access.status === 'not_found') {
      return { roomNotFound: true }
    }

    if (deps.detector) {
      console.log(
        '[game.$gameId loader] Detector enabled, preloading embeddings database...',
      )
      try {
        await loadEmbeddingsAndMetaFromPackage()
        console.log('[game.$gameId loader] Embeddings database loaded')
      } catch (err) {
        console.error('[game.$gameId loader] Failed to load embeddings:', err)
      }
    }

    return { roomNotFound: false }
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

function GameRoomPage() {
  const { gameId } = Route.useParams()
  const { roomNotFound } = Route.useLoaderData()
  const { detector, usePerspectiveWarp, testStream } = Route.useSearch()
  const navigate = useNavigate()
  const { user } = useAuth()

  // Format or room-existence failures are resolved in the loader — render
  // the 404 immediately without firing the authenticated Convex query.
  const skipQuery = !GAME_ID_PATTERN.test(gameId) || roomNotFound
  const roomAccess = useQuery(
    api.rooms.checkRoomAccess,
    skipQuery ? 'skip' : { roomId: gameId },
  )

  const handleLeaveGame = () => {
    sessionStorage.clearGameState()
    navigate({ to: '/', reloadDocument: true }) // reloadDocument: true is needed to ensure the browser releases the camera/mic indicator
  }

  const handleClose = () => {
    navigate({ to: '/' })
  }

  if (skipQuery) {
    return <NotFoundPage />
  }

  // Show loading state while authenticated room access is being checked
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
