import type { DetectorType } from '@/lib/detectors'
import { ErrorFallback } from '@/components/ErrorFallback'
import { GameRoom } from '@/components/GameRoom'
import { requireDiscordAuth } from '@/lib/discord-client'
import { sessionStorage } from '@/lib/session-storage'
import { checkRoomExists, ensureUserInGuild } from '@/server/discord-rooms'
import {
  createFileRoute,
  redirect,
  stripSearchParams,
  useNavigate,
} from '@tanstack/react-router'
import { zodValidator } from '@tanstack/zod-adapter'
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

export const Route = createFileRoute('/game/$gameId')({
  beforeLoad: async ({ params }) => {
    const { gameId } = params

    const result = await checkRoomExists({ data: { channelId: gameId } })

    if (!result.exists) {
      console.warn(
        `[Game] Room ${gameId} does not exist: ${result.error || 'Unknown reason'}`,
      )
      throw redirect({
        to: '/',
        search: {
          error: result.error || 'Game room not found',
        },
      })
    }

    // Room exists and is valid
    return {
      roomName: result.channel?.name || 'Game Room',
    }
  },
  loader: async () => {
    const auth = await requireDiscordAuth(() => {
      throw redirect({
        to: '/',
        search: {
          error: 'You must sign in with Discord before joining a game.',
        },
      })
    })

    await ensureUserInGuild({
      data: { accessToken: auth.accessToken, userId: auth.userId },
    })

    return { auth }
  },
  component: GameRoomRoute,
  validateSearch: zodValidator(gameSearchSchema),
  search: {
    middlewares: [stripSearchParams(defaultValues)],
  },
})

function GameRoomRoute() {
  const { gameId } = Route.useParams()
  const { detector, usePerspectiveWarp } = Route.useSearch()
  const navigate = useNavigate()

  const state = sessionStorage.loadGameState()
  const playerName = state?.playerName ?? 'Guest'

  const handleLeaveGame = () => {
    sessionStorage.clearGameState()
    navigate({ to: '/' })
  }

  return (
    <ErrorBoundary
      fallbackRender={({ error, resetErrorBoundary }) => (
        <ErrorFallback error={error} resetErrorBoundary={resetErrorBoundary} />
      )}
      onReset={() => window.location.reload()}
    >
      <GameRoom
        gameId={gameId}
        playerName={playerName}
        onLeaveGame={handleLeaveGame}
        detectorType={detector as DetectorType | undefined}
        usePerspectiveWarp={usePerspectiveWarp}
      />
    </ErrorBoundary>
  )
}
