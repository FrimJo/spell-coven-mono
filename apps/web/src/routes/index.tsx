import { useState } from 'react'
import { ErrorFallback } from '@/components/ErrorFallback'
import { LandingPage } from '@/components/LandingPage'
import { sessionStorage } from '@/lib/session-storage'
import { createRoom } from '@/server/discord-rooms'
import { useMutation } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
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

function LandingPageRoute() {
  const navigate = useNavigate()
  const search = Route.useSearch()
  const [error, setError] = useState<string | null>(search.error || null)

  const createRoomFn = useServerFn(createRoom)
  const createRoomMutation = useMutation({
    mutationFn: createRoomFn,
  })

  const handleCreateGame = async (playerName: string) => {
    setError(null)

    try {
      // Generate short unique ID for the game
      const shortId = Math.random().toString(36).substring(2, 6).toUpperCase()

      // Create Discord voice channel using inline mutation
      // Prefix with 🎮 to identify our game rooms
      const room = await createRoomMutation.mutateAsync({
        data: { name: `🎮 ${playerName}'s Game #${shortId}`, userLimit: 4 },
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
      const message =
        err instanceof Error ? err.message : 'Failed to create game room'
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
      {(error || createRoomMutation.error) && (
        <div className="fixed right-4 top-4 z-50 max-w-md rounded-lg bg-red-500/90 p-4 text-white shadow-lg">
          <p className="font-semibold">Error</p>
          <p className="text-sm">
            {error || createRoomMutation.error?.message}
          </p>
        </div>
      )}
      <LandingPage
        onCreateGame={handleCreateGame}
        onJoinGame={handleJoinGame}
        isCreatingGame={createRoomMutation.isPending}
      />
    </ErrorBoundary>
  )
}
