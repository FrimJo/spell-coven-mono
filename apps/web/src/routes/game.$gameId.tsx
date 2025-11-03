import type { DetectorType } from '@/lib/detectors'
import { Suspense, useCallback, useState } from 'react'
import { DiscordAuthModal } from '@/components/discord/DiscordAuthModal'
import { ErrorFallback } from '@/components/ErrorFallback'
import { GameRoom } from '@/components/GameRoom'
import {
  discordTokenQueryOptions,
  useDiscordAuth,
} from '@/hooks/useDiscordAuth'
import { discordUserQueryOptions, useDiscordUser } from '@/hooks/useDiscordUser'
import { useVoiceChannelEvents } from '@/hooks/useVoiceChannelEvents'
import { useWebSocketAuthToken } from '@/hooks/useWebSocketAuthToken'
import { sessionStorage } from '@/lib/session-storage'
import {
  checkRoomExists,
  checkUserInVoiceChannel,
  ensureUserInGuild,
} from '@/server/handlers/discord-rooms.server'
import {
  createFileRoute,
  redirect,
  stripSearchParams,
  useNavigate,
} from '@tanstack/react-router'
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

    // VALIDATION STEP 1: Check if room exists
    const result = await checkRoomExists({ data: { channelId: gameId } })

    if (!result.exists) {
      console.warn('[Game] Room does not exist:', result.error)
      throw redirect({
        to: '/',
        search: { error: result.error || 'Game room not found' },
      })
    }

    return {
      roomName: result.channelName || 'Game Room',
    }
  },
  loader: async ({ params, context }) => {
    const { gameId } = params
    let user, token
    try {
      token = await context.queryClient.ensureQueryData(
        discordTokenQueryOptions,
      )

      if (!token) throw new Error('No token available')

      user = await context.queryClient.ensureQueryData(
        discordUserQueryOptions(token.accessToken),
      )
    } catch (error) {
      return {
        isAuthenticated: false,
        voiceChannelStatus: {
          inChannel: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      }
    }

    const { error } = await ensureUserInGuild({
      data: { userId: user.id, accessToken: token.accessToken },
    })

    if (error) {
      console.error('[Game] Error ensuring user in guild:', error)
      throw redirect({
        to: '/',
        search: { error: error || 'Failed to ensure user in guild' },
      })
    }

    const result = await checkUserInVoiceChannel({
      data: {
        userId: user.id,
        channelId: gameId,
      },
    })

    return {
      isAuthenticated: true,
      voiceChannelStatus: result,
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
  const loaderData = Route.useLoaderData()
  const { detector, usePerspectiveWarp } = Route.useSearch()
  const navigate = useNavigate()
  const { user: discordUser } = useDiscordUser()
  const { token: discordToken } = useDiscordAuth()
  const guildId = import.meta.env.VITE_DISCORD_GUILD_ID
  const [showAuthModal, setShowAuthModal] = useState(
    !loaderData.isAuthenticated,
  )
  const [showJoinDiscordModal, setShowJoinDiscordModal] = useState(
    loaderData.isAuthenticated && !loaderData.voiceChannelStatus.inChannel,
  )
  const [userJoinedVoice, setUserJoinedVoice] = useState(!showJoinDiscordModal)

  const state = sessionStorage.loadGameState()
  const playerName = state?.playerName ?? 'Guest'

  // Get invite token from search params if present (client-side only)
  // const getUrlParams = createClientOnlyFn((): URLSearchParams | null => {
  //   return new URLSearchParams(window.location.search)
  // })
  // const urlParams = getUrlParams()
  // const inviteToken = urlParams?.get('t') || null

  // Generate WebSocket auth token
  const { data: wsTokenData } = useWebSocketAuthToken({
    userId: discordUser?.id,
  })

  const handleProceedToGame = useCallback(() => {
    setShowJoinDiscordModal(false)
    setUserJoinedVoice(true)
  }, [])

  const handleVoiceJoined = useCallback(
    (event: { userId: string }) => {
      if (showJoinDiscordModal && event.userId === discordUser?.id) {
        console.log('[GameRoomRoute] User joined voice channel')
        setUserJoinedVoice(true)
      }
    },
    [showJoinDiscordModal, discordUser?.id],
  )

  // Listen for voice.joined event to update modal status (only when modal is open)
  useVoiceChannelEvents({
    jwtToken: wsTokenData,
    onVoiceJoined: handleVoiceJoined,
  })

  const handleLeaveGame = () => {
    sessionStorage.clearGameState()
    navigate({ to: '/' })
  }

  // VALIDATION STEP 2: Show auth modal if not authenticated
  if (!discordToken) {
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
      {/* Only render GameRoom if user is in voice channel (modal is closed) */}
      {!showJoinDiscordModal && (
        <Suspense
          fallback={
            <div className="flex h-screen items-center justify-center">
              Loading game room...
            </div>
          }
        >
          <GameRoom
            gameId={gameId}
            playerName={playerName}
            onLeaveGame={handleLeaveGame}
            detectorType={detector as DetectorType | undefined}
            usePerspectiveWarp={usePerspectiveWarp}
          />
        </Suspense>
      )}

      {/* Join Discord Modal - shown when user is not in voice channel */}
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
