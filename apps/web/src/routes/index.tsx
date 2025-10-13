import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { ErrorBoundary } from 'react-error-boundary'
import { LandingPage } from '@/components/LandingPage'
import { ErrorFallback } from '@/components/ErrorFallback'
import { sessionStorage } from '@/lib/session-storage'

export const Route = createFileRoute('/')({
  component: LandingPageRoute,
})

function LandingPageRoute() {
  const navigate = useNavigate()

  const handleCreateGame = (playerName: string) => {
    const gameId = `game-${Math.random().toString(36).substr(2, 9)}`
    sessionStorage.saveGameState({
      gameId,
      playerName,
      timestamp: Date.now(),
    })
    navigate({ to: '/game/$gameId', params: { gameId } })
  }

  const handleJoinGame = (playerName: string, gameId: string) => {
    sessionStorage.saveGameState({
      gameId,
      playerName,
      timestamp: Date.now(),
    })
    navigate({ to: '/game/$gameId', params: { gameId } })
  }

  return (
    <ErrorBoundary
      fallbackRender={({ error, resetErrorBoundary }) => (
        <ErrorFallback error={error} resetErrorBoundary={resetErrorBoundary} />
      )}
      onReset={() => window.location.reload()}
    >
      <LandingPage
        onCreateGame={handleCreateGame}
        onJoinGame={handleJoinGame}
      />
    </ErrorBoundary>
  )
}
