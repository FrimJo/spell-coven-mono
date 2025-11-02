import type { DetectorType } from '@/lib/detectors'
import { Suspense, useCallback, useEffect, useState } from 'react'
import { DiscordAuthModal } from '@/components/discord/DiscordAuthModal'
import { ErrorFallback } from '@/components/ErrorFallback'
import { GameRoom } from '@/components/GameRoom'
import { useVoiceChannelEvents } from '@/hooks/useVoiceChannelEvents'
import { useWebSocketAuthToken } from '@/hooks/useWebSocketAuthToken'
import { ensureValidDiscordToken, getDiscordClient } from '@/lib/discord-client'
import { sessionStorage } from '@/lib/session-storage'
import { checkRoomExists, joinRoom } from '@/server/handlers/discord-rooms.server'
import {
  createFileRoute,
  redirect,
  stripSearchParams,
  useNavigate,
} from '@tanstack/react-router'
import { createClientOnlyFn, useServerFn } from '@tanstack/react-start'
import { zodValidator } from '@tanstack/zod-adapter'
import { ExternalLink, Loader2 } from 'lucide-react'
import { ErrorBoundary } from 'react-error-boundary'
import { toast } from 'sonner'
import { z } from 'zod'

import { Button } from '@repo/ui/components/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@repo/ui/components/dialog'

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

    // Check if room exists first (before auth check)
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

    return {
      roomName: result.channel?.name || 'Game Room',
    }
  },
  loader: async ({ params }) => {
    const { gameId } = params

    // Get guild ID from session storage (set when room was created)
    const creatorInviteState = sessionStorage.loadCreatorInviteState()
    const guildId =
      creatorInviteState?.guildId || process.env.VITE_DISCORD_GUILD_ID || ''

    // Try to get auth, but don't fail if not authenticated
    // Component will handle showing auth modal
    const token = await ensureValidDiscordToken()

    let auth = null
    if (token) {
      try {
        const client = getDiscordClient()
        const user = await client.fetchUser(token.accessToken)
        auth = {
          accessToken: token.accessToken,
          userId: user.id,
        }
      } catch (error) {
        console.error('Failed to fetch user:', error)
        auth = null
      }
    }

    return {
      gameId,
      guildId,
      auth,
    }
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
  const { auth, guildId } = Route.useLoaderData()
  const [showAuthModal, setShowAuthModal] = useState(!auth)
  const [showJoinDiscordModal, setShowJoinDiscordModal] = useState(false)
  const [userJoinedVoice, setUserJoinedVoice] = useState(false)

  const state = sessionStorage.loadGameState()
  const playerName = state?.playerName ?? 'Guest'

  const joinRoomFn = useServerFn(joinRoom)

  // Get invite token from search params if present (client-side only)
  const getUrlParams = createClientOnlyFn((): URLSearchParams | null => {
    return new URLSearchParams(window.location.search)
  })
  const urlParams = getUrlParams()
  const inviteToken = urlParams?.get('t') || null

  // Generate WebSocket auth token
  const { data: wsTokenData } = useWebSocketAuthToken({ userId: auth?.userId })

  const handleVoiceJoined = useCallback(
    (event: { userId: string }) => {
      if (showJoinDiscordModal && event.userId === auth?.userId) {
        console.log('[GameRoomRoute] User joined voice channel')
        setUserJoinedVoice(true)
      }
    },
    [showJoinDiscordModal, auth?.userId],
  )

  // Listen for voice.joined event to update modal status (only when modal is open)
  useVoiceChannelEvents({
    jwtToken: wsTokenData,
    onVoiceJoined: handleVoiceJoined,
  })

  const handleProceedToGame = () => {
    console.log('[GameRoomRoute] Proceeding to game room')
    setShowJoinDiscordModal(false)
    setUserJoinedVoice(false)
  }

  // Join logic: if token, userId, accessToken
  useEffect(() => {
    console.log('[GameRoomRoute] Join effect triggered', {
      inviteToken: !!inviteToken,
      userId: auth?.userId,
      hasAccessToken: !!auth?.accessToken,
    })

    if (inviteToken && auth?.userId && auth?.accessToken) {
      console.log('[GameRoomRoute] Joining with invite token:', inviteToken)
      joinRoomFn({
        data: {
          token: inviteToken,
          userId: auth.userId,
          accessToken: auth.accessToken,
        },
      })
        .then(() => {
          console.log('[GameRoomRoute] Successfully joined with invite token')
          // Show join Discord modal for friends joining via link
          setShowJoinDiscordModal(true)
        })
        .catch((err) => {
          console.error(
            '[GameRoomRoute] Failed to join with invite token:',
            err,
          )
          toast.error(
            'Failed to join private room: ' + (err?.message || 'Unknown error'),
          )
          void navigate({ to: '/' })
        })
    } else if (!inviteToken && auth?.userId && auth?.accessToken) {
      // Creator joining their own room (no invite token)
      // Get the invite token from session storage and use it to join
      console.log(
        '[GameRoomRoute] No invite token, checking session storage for creator token',
      )
      const creatorInviteState = sessionStorage.loadCreatorInviteState()
      console.log('[GameRoomRoute] Creator invite state:', {
        exists: !!creatorInviteState,
        hasToken: !!creatorInviteState?.token,
        channelId: creatorInviteState?.channelId,
      })

      if (creatorInviteState && creatorInviteState.token) {
        console.log('[GameRoomRoute] Joining creator with stored token')
        joinRoomFn({
          data: {
            token: creatorInviteState.token,
            userId: auth.userId,
            accessToken: auth.accessToken,
          },
        })
          .then(() => {
            console.log('[GameRoomRoute] Creator successfully joined room')
            // User will manually join Discord voice channel
            // Real-time events will show them in the player list when they join
          })
          .catch((err) => {
            console.error('[GameRoomRoute] Creator failed to join room:', err)
            // Don't navigate away - let them continue even if join fails
          })
      } else {
        console.warn(
          '[GameRoomRoute] No creator invite token found in session storage',
        )
      }
    }
  }, [inviteToken, auth?.userId, auth?.accessToken, joinRoomFn, navigate])

  const handleLeaveGame = () => {
    sessionStorage.clearGameState()
    navigate({ to: '/' })
  }

  // Show auth modal if not authenticated
  if (!auth) {
    return (
      <DiscordAuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        returnUrl={`/game/${gameId}`}
      />
    )
  }

  return (
    <ErrorBoundary
      fallbackRender={({ error, resetErrorBoundary }) => (
        <ErrorFallback error={error} resetErrorBoundary={resetErrorBoundary} />
      )}
      onReset={() => window.location.reload()}
    >
      <Suspense
        fallback={
          <div className="flex h-screen items-center justify-center">
            Loading game room...
          </div>
        }
      >
        <GameRoom
          gameId={gameId}
          guildId={guildId}
          playerName={playerName}
          onLeaveGame={handleLeaveGame}
          detectorType={detector as DetectorType | undefined}
          usePerspectiveWarp={usePerspectiveWarp}
        />
      </Suspense>

      {/* Join Discord Modal for friends joining via link */}
      <Dialog
        open={showJoinDiscordModal}
        onOpenChange={setShowJoinDiscordModal}
      >
        <DialogContent className="border-slate-800 bg-slate-900 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">
              🎮 Game Room Ready!
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            {!userJoinedVoice ? (
              <>
                <p className="text-slate-300">
                  To start playing, join the Discord voice channel:
                </p>
                <a
                  href={`https://discord.com/channels/${guildId}/${gameId}`}
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
