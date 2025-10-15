import { ErrorFallback } from '@/components/ErrorFallback'
import { GameRoom } from '@/components/GameRoom'
import type { DetectorType } from '@/lib/detectors'
import { sessionStorage } from '@/lib/session-storage'
import { createFileRoute, stripSearchParams, useNavigate } from '@tanstack/react-router'
import { zodValidator } from '@tanstack/zod-adapter'
import { ErrorBoundary } from 'react-error-boundary'
import { z } from 'zod'

const defaultValues = {
  detector: 'detr' as const,
}

const gameSearchSchema = z.object({
  detector: z.enum(['opencv', 'detr', 'owl-vit']).default(defaultValues.detector),
})

export const Route = createFileRoute('/game/$gameId')({
  component: GameRoomRoute,
  validateSearch: zodValidator(gameSearchSchema),
  search: {
    middlewares: [stripSearchParams(defaultValues)],
  },
})

function GameRoomRoute() {
  const { gameId } = Route.useParams()
  const { detector } = Route.useSearch()
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
      />
    </ErrorBoundary>
  )
}
