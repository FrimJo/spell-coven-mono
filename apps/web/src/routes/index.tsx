import { ErrorFallback } from '@/components/ErrorFallback'
import { LandingPage } from '@/components/LandingPage'
import { useDiscordRooms } from '@/hooks/useDiscordRooms'
import { sessionStorage } from '@/lib/session-storage'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { ErrorBoundary } from 'react-error-boundary'

export const Route = createFileRoute('/')({
  component: LandingPageRoute,
})

function LandingPageRoute() {
  const navigate = useNavigate()
  const { createRoomAsync, isCreating, error: roomError } = useDiscordRooms()
  const [error, setError] = useState<string | null>(null)

  const handleCreateGame = async (playerName: string) => {
    setError(null)
    
    try {
      // Create Discord voice channel using TanStack Query mutation
      const room = await createRoomAsync({
        name: `${playerName}'s Game`,
        userLimit: 10,
      })

      // Use Discord channel ID as game ID
      const gameId = room.channelId
      
      sessionStorage.saveGameState({
        gameId,
        playerName,
        timestamp: Date.now(),
      })
      
      navigate({ to: '/game/$gameId', params: { gameId } })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create game room'
      setError(message)
      console.error('Failed to create Discord room:', err)
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
      {(error || roomError) && (
        <div className="fixed top-4 right-4 z-50 max-w-md rounded-lg bg-red-500/90 p-4 text-white shadow-lg">
          <p className="font-semibold">Error</p>
          <p className="text-sm">{error || roomError?.message}</p>
        </div>
      )}
      <LandingPage
        onCreateGame={handleCreateGame}
        onJoinGame={handleJoinGame}
        isCreatingGame={isCreating}
      />
    </ErrorBoundary>
  )
}
