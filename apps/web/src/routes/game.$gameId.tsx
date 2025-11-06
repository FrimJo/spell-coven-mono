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
import { discordUserQueryOptions, useDiscordUser } from '@/hooks/useDiscordUser'
import { sessionStorage } from '@/lib/session-storage'
import {
  assignRoleToUser,
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
      roleId: result.roleId,
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
        username: undefined, // No username when not authenticated
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

    // Get roleId from room check (already validated in beforeLoad, but we need roleId here)
    const roomCheck = await checkRoomExists({ data: { channelId: gameId } })
    const roleId = roomCheck.exists ? roomCheck.roleId : undefined

    // Assign role to user if roleId is available
    if (roleId) {
      console.log('[Game] Assigning role to user:', { userId: user.id, roleId })
      const roleResult = await assignRoleToUser({
        data: { userId: user.id, roleId },
      })
      if (!roleResult.success) {
        console.warn(
          '[Game] Failed to assign role (non-fatal):',
          roleResult.error,
        )
        // Don't fail - user might already have the role or bot might not have permission
      }
    }

    const { inChannel, error: inChannelError } = await ensureUserInVoiceChannel(
      {
        data: { userId: user.id, targetChannelId: gameId },
      },
    )
    return {
      isAuthenticated: true,
      voiceChannelStatus: {
        inChannel,
        error: inChannelError,
      },
      initialMembers: [],
      userId: user.id,
      username: user.username, // Discord username - required for authenticated users
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

  // Get Discord user for username (fallback if loader data doesn't have it)
  const { user: discordUser } = useDiscordUser()
  
  // Use Discord username from loader or hook - never fallback to 'Guest' for authenticated users
  const playerName = loaderData.isAuthenticated
    ? (loaderData.username || discordUser?.username || 'User')
    : (sessionStorage.loadGameState()?.playerName ?? 'Guest')

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
