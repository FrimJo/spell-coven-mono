import type { CreatorInviteState } from '@/lib/session-storage'
import { useCallback, useEffect, useState } from 'react'
import { ErrorFallback } from '@/components/ErrorFallback'
import { LandingPage } from '@/components/LandingPage'
import { useDiscordUser } from '@/hooks/useDiscordUser'
import { useVoiceChannelEvents } from '@/hooks/useVoiceChannelEvents'
import { useWebSocketAuthToken } from '@/hooks/useWebSocketAuthToken'
import { sessionStorage } from '@/lib/session-storage'
import {
  createRoom,
  refreshRoomInvite,
} from '@/server/handlers/discord-rooms.server'
import { useMutation } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { zodValidator } from '@tanstack/zod-adapter'
import { ExternalLink, Loader2 } from 'lucide-react'
import { ErrorBoundary } from 'react-error-boundary'
import { z } from 'zod'

import { Button } from '@repo/ui/components/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@repo/ui/components/dialog'

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
  const { user } = useDiscordUser()
  const [inviteState, setInviteState] = useState<CreatorInviteState | null>(
    () => {
      // Only access sessionStorage on the client
      if (typeof window === 'undefined') return null
      return sessionStorage.loadCreatorInviteState()
    },
  )
  const [showJoinDiscordModal, setShowJoinDiscordModal] = useState(false)
  const [pendingGameId, setPendingGameId] = useState<string | null>(null)
  const [pendingInvite, setPendingInvite] = useState<CreatorInviteState | null>(
    null,
  )

  // Server functions for room management
  const createRoomFn = useServerFn(createRoom)
  const createRoomMutation = useMutation({
    mutationFn: createRoomFn,
  })

  const refreshRoomInviteFn = useServerFn(refreshRoomInvite)
  const refreshRoomInviteMutation = useMutation({
    mutationFn: refreshRoomInviteFn,
  })

  const [userJoinedVoice, setUserJoinedVoice] = useState(false)

  const { data: wsTokenData } = useWebSocketAuthToken({ userId: user?.id })

  useEffect(() => {
    console.log('[LandingPage] WebSocket token:', {
      hasToken: !!wsTokenData,
      modalOpen: showJoinDiscordModal,
      pendingGameId,
      userId: user?.id,
    })
  }, [wsTokenData, showJoinDiscordModal, pendingGameId, user?.id])

  const handleVoiceJoined = useCallback(
    (event: { userId: string }) => {
      console.log('[LandingPage] Received voice.joined event:', event, {
        modalOpen: showJoinDiscordModal,
        pendingGameId,
        userId: user?.id,
        eventUserId: event.userId,
        match: event.userId === user?.id,
      })
      if (showJoinDiscordModal && pendingGameId && event.userId === user?.id) {
        console.log('[LandingPage] User joined voice channel - updating state')
        setUserJoinedVoice(true)
      }
    },
    [showJoinDiscordModal, pendingGameId, user?.id],
  )

  // Listen for voice.joined event to update modal status (only when modal is open)
  useVoiceChannelEvents({
    jwtToken: wsTokenData,
    onVoiceJoined: handleVoiceJoined,
  })

  const handleProceedToGame = () => {
    if (!pendingGameId || !user) return

    console.log('[LandingPage] Proceeding to game room')
    sessionStorage.saveGameState({
      gameId: pendingGameId,
      playerName: user.username,
      timestamp: Date.now(),
    })
    setShowJoinDiscordModal(false)
    setPendingGameId(null)
    setUserJoinedVoice(false)
    navigate({ to: '/game/$gameId', params: { gameId: pendingGameId } })
  }

  const handleCreateGame = async () => {
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
          name: `🎮 ${user.username}'s Game #${shortId}`,
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

      // Show join Discord modal instead of navigating immediately
      setPendingGameId(gameId)
      setPendingInvite(nextInvite)
      setShowJoinDiscordModal(true)
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
          maxSeats: inviteState.maxSeats ?? 4,
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

      {/* Join Discord Modal */}
      <Dialog
        open={showJoinDiscordModal}
        onOpenChange={setShowJoinDiscordModal}
      >
        <DialogContent className="border-slate-800 bg-slate-900 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">
              🎮 Your Game Room is Ready!
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            {!userJoinedVoice ? (
              <>
                <p className="text-slate-300">
                  To start playing, join the Discord voice channel:
                </p>
                {pendingInvite && (
                  <a
                    href={pendingInvite.deepLink}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button
                      className="w-full gap-2 bg-indigo-600 text-white hover:bg-indigo-700"
                      size="lg"
                    >
                      <ExternalLink className="h-4 w-4" />
                      Join Discord Voice Channel
                    </Button>
                  </a>
                )}
                <p className="text-center text-sm text-slate-400">
                  Waiting for you to join...
                  <br />
                  <Loader2 className="mt-2 inline h-4 w-4 animate-spin" />
                </p>
              </>
            ) : (
              <>
                <div className="rounded-lg bg-green-500/10 p-4 text-center">
                  <p className="text-lg font-semibold text-green-400">
                    ✓ You&apos;re connected!
                  </p>
                  <p className="mt-2 text-sm text-slate-300">
                    You&apos;ve joined the voice channel. Ready to play?
                  </p>
                </div>
                <Button
                  onClick={handleProceedToGame}
                  className="w-full bg-purple-600 text-white hover:bg-purple-700"
                  size="lg"
                >
                  Enter Game Room
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </ErrorBoundary>
  )
}

function LandingPageRoute() {
  return <LandingPageContent />
}
