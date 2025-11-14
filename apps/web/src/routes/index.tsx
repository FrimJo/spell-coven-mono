import { useState } from 'react'
import { ErrorFallback } from '@/components/ErrorFallback'
import { LandingPage } from '@/components/LandingPage'
import { sessionStorage } from '@/lib/session-storage'
import { getTempUser } from '@/lib/temp-user'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { zodValidator } from '@tanstack/zod-adapter'
import { ErrorBoundary } from 'react-error-boundary'
import { z } from 'zod'

const landingSearchSchema = z.object({
  error: z.string().optional(),
})

export const Route = createFileRoute('/')({
  component: LandingPageRoute,
  validateSearch: zodValidator(landingSearchSchema),
})

function LandingPageContent() {
  const navigate = useNavigate()
  const search = Route.useSearch()
  const [error, setError] = useState<string | null>(search.error || null)
  const tempUser = getTempUser()

  const handleCreateGame = async () => {
    setError(null)

    try {
      // Generate short unique ID for the game
      const shortId = Math.random().toString(36).substring(2, 8).toUpperCase()
      const gameId = `game-${shortId}`

      console.log('[LandingPage] Creating new game:', gameId)
      sessionStorage.saveGameState({
        gameId,
        playerName: tempUser.username,
        timestamp: Date.now(),
      })

      // Navigate directly to game room
      navigate({ to: '/game/$gameId', params: { gameId } })
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to create game room'
      setError(message)
      console.error('Failed to create game room:', err)
    }
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
      {error && (
        <div className="fixed right-4 top-4 z-50 max-w-md rounded-lg bg-red-500/90 p-4 text-white shadow-lg">
          <p className="font-semibold">Error</p>
          <p className="text-sm">{error}</p>
        </div>
      )}
      <LandingPage
        onCreateGame={handleCreateGame}
        onJoinGame={handleJoinGame}
        isCreatingGame={false}
        inviteState={null}
        onRefreshInvite={() => {}}
        isRefreshingInvite={false}
      />
    </ErrorBoundary>
  )
}

function LandingPageRoute() {
  return <LandingPageContent />
}
