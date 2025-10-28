import type { CreatorInviteState } from '@/lib/session-storage'
import { useMemo, useState } from 'react'
import { ErrorFallback } from '@/components/ErrorFallback'
import { LandingPage } from '@/components/LandingPage'
import { useDiscordUser } from '@/hooks/useDiscordUser'
import { sessionStorage } from '@/lib/session-storage'
import { createRoom, refreshRoomInvite } from '@/server/discord-rooms'
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
  const { user } = useDiscordUser()
  const [inviteState, setInviteState] = useState<CreatorInviteState | null>(
    () => sessionStorage.loadCreatorInviteState(),
  )

  const createRoomFn = useServerFn(createRoom)
  const createRoomMutation = useMutation({
    mutationFn: createRoomFn,
  })

  const refreshRoomInviteFn = useServerFn(refreshRoomInvite)
  const refreshRoomInviteMutation = useMutation({
    mutationFn: refreshRoomInviteFn,
  })

  const handleCreateGame = async (playerName: string) => {
    setError(null)

    try {
      if (!user) {
        setError('Your Discord profile is still loading. Please try again.')
        return
      }

      // Generate short unique ID for the game
      const shortId = Math.random().toString(36).substring(2, 6).toUpperCase()

      const result = await createRoomMutation.mutateAsync({
        data: {
          creatorId: user.id,
          name: `🎮 ${playerName}'s Game #${shortId}`,
          userLimit: 4,
          maxSeats: 4,
          tokenTtlSeconds: 30 * 60,
          includeCreatorOverwrite: true,
          shareUrlBase: window.location.origin,
        },
      })

      // Use Discord channel ID as game ID
      const gameId = result.room.channelId

      const nextInvite: CreatorInviteState = {
        channelId: result.room.channelId,
        roleId: result.room.roleId,
        guildId: result.room.guildId,
        creatorId: user.id,
        token: result.invite.token,
        issuedAt: result.invite.issuedAt,
        expiresAt: result.invite.expiresAt,
        shareUrl: result.invite.shareUrl,
        deepLink: result.room.deepLink,
        maxSeats: result.invite.maxSeats,
      }

      sessionStorage.saveCreatorInviteState(nextInvite)
      setInviteState(nextInvite)

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

  const handleRefreshInvite = async () => {
    if (!inviteState) return

    setError(null)

    try {
      const refreshed = await refreshRoomInviteMutation.mutateAsync({
        data: {
          channelId: inviteState.channelId,
          roleId: inviteState.roleId,
          creatorId: inviteState.creatorId,
          shareUrlBase: window.location.origin,
          maxSeats: inviteState.maxSeats,
          tokenTtlSeconds: 30 * 60,
        },
      })

      const updatedInvite: CreatorInviteState = {
        ...inviteState,
        token: refreshed.invite.token,
        issuedAt: refreshed.invite.issuedAt,
        expiresAt: refreshed.invite.expiresAt,
        shareUrl: refreshed.invite.shareUrl,
        deepLink: refreshed.room.deepLink,
        guildId: refreshed.room.guildId,
        maxSeats: refreshed.invite.maxSeats,
      }

      sessionStorage.saveCreatorInviteState(updatedInvite)
      setInviteState(updatedInvite)
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Failed to refresh invite. Please try again.'
      setError(message)
      console.error('Failed to refresh room invite:', err)
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
      {(error ||
        createRoomMutation.error ||
        refreshRoomInviteMutation.error) && (
        <div className="fixed right-4 top-4 z-50 max-w-md rounded-lg bg-red-500/90 p-4 text-white shadow-lg">
          <p className="font-semibold">Error</p>
          <p className="text-sm">
            {error ||
              createRoomMutation.error?.message ||
              refreshRoomInviteMutation.error?.message}
          </p>
        </div>
      )}
      <LandingPage
        onCreateGame={handleCreateGame}
        onJoinGame={handleJoinGame}
        isCreatingGame={createRoomMutation.isPending}
        inviteState={inviteState}
        onRefreshInvite={handleRefreshInvite}
        isRefreshingInvite={refreshRoomInviteMutation.isPending}
      />
    </ErrorBoundary>
  )
}
