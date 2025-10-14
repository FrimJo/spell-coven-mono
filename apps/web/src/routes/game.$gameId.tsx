import { ErrorFallback } from '@/components/ErrorFallback'
import { GameRoom } from '@/components/GameRoom'
import { sessionStorage } from '@/lib/session-storage'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { ErrorBoundary } from 'react-error-boundary'

export const Route = createFileRoute('/game/$gameId')({
  component: GameRoomRoute,
})

function GameRoomRoute() {
  const { gameId } = Route.useParams()
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
      />
    </ErrorBoundary>
  )
}
