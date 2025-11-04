import type { DetectorType } from '@/lib/detectors'
import { Suspense, useCallback, useState } from 'react'
import { DiscordAuthModal } from '@/components/discord/DiscordAuthModal'
import { ErrorFallback } from '@/components/ErrorFallback'
import { GameRoom } from '@/components/GameRoom'
import { JoinDiscordModal } from '@/components/JoinDiscordModal'
import { env } from '@/env'
import {
  discordTokenQueryOptions,
  useDiscordAuth,
} from '@/hooks/useDiscordAuth'
import { discordUserQueryOptions } from '@/hooks/useDiscordUser'
import { sessionStorage } from '@/lib/session-storage'
import {
  checkRoomExists,
  ensureUserInGuild,
  ensureUserInVoiceChannel,
} from '@/server/handlers/discord-rooms.server'
import {
  createFileRoute,
  redirect,
  stripSearchParams,
  useNavigate,
} from '@tanstack/react-router'
import { zodValidator } from '@tanstack/zod-adapter'
import { ErrorBoundary } from 'react-error-boundary'
import { z } from 'zod'

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
        initialMembers: [],
      }
    }

    const { error: inGuildError } = await ensureUserInGuild({
      data: { userId: user.id, accessToken: token.accessToken },
    })

    if (inGuildError) {
      console.error('[Game] Error ensuring user in guild:', inGuildError)
      throw redirect({
        to: '/',
        search: { error: inGuildError || 'Failed to ensure user in guild' },
      })
    }

    const { inChannel, error: inChannelError } = await ensureUserInVoiceChannel(
      {
        data: { userId: user.id, targetChannelId: gameId },
      },
    )

    // Don't connect to voice channel here - it causes race condition
    // The VOICE_STATE_UPDATE events arrive before browser connects to SSE
    // Let GameRoom handle connection after SSE is established

    return {
      isAuthenticated: true,
      voiceChannelStatus: {
        inChannel,
        error: inChannelError,
      },
      initialMembers: [],
      userId: user.id,
      gameId, // Pass gameId for GameRoom to use
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
  const { token: discordToken } = useDiscordAuth()
  const guildId = env.VITE_DISCORD_GUILD_ID
  const [showAuthModal, setShowAuthModal] = useState(
    !loaderData.isAuthenticated,
  )
  const [showJoinDiscordModal, setShowJoinDiscordModal] = useState(
    loaderData.isAuthenticated && !loaderData.voiceChannelStatus.inChannel,
  )

  const state = sessionStorage.loadGameState()
  const playerName = state?.playerName ?? 'Guest'

  const handleProceedToGame = useCallback(() => {
    setShowJoinDiscordModal(false)
  }, [])

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
            initialMembers={loaderData.initialMembers}
          />
        </Suspense>
      )}

      {/* Join Discord Modal - shown when user is not in voice channel */}
      <JoinDiscordModal
        open={showJoinDiscordModal}
        onOpenChange={setShowJoinDiscordModal}
        discordUrl={`https://discord.com/channels/${guildId}/${gameId}`}
        onProceedToGame={handleProceedToGame}
        title="🎮 Game Room Ready!"
      />
    </ErrorBoundary>
  )
}
