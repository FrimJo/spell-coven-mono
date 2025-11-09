import type { DetectorType } from '@/lib/detectors'
import { Suspense, useCallback, useState } from 'react'
import { DiscordAuthModal } from '@/components/discord/DiscordAuthModal'
import { ErrorFallback } from '@/components/ErrorFallback'
import { GameRoom } from '@/components/GameRoom'
import { JoinDiscordModal } from '@/components/JoinDiscordModal'
import { env } from '@/env'
import { discordTokenQueryOptions } from '@/hooks/useDiscordAuth'
import { discordUserQueryOptions } from '@/hooks/useDiscordUser'
import { sessionStorage } from '@/lib/session-storage'
import {
  checkRoomExists,
  checkUserInVoiceChannel,
  ensureUserHasRole,
  ensureUserInGuild,
  ensureUserInVoiceChannel,
  getConnectedUserIds,
} from '@/server/handlers/discord-rooms.server'
import { queryOptions } from '@tanstack/react-query'
import {
  createFileRoute,
  redirect,
  stripSearchParams,
  useNavigate,
} from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { zodValidator } from '@tanstack/zod-adapter'
import { Loader2 } from 'lucide-react'
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

type GameLoaderData =
  | {
      isAuthenticated: false
      voiceChannelStatus: { inChannel: false }
      initialMembers: never[]
      username: undefined
    }
  | {
      isAuthenticated: true
      voiceChannelStatus: { inChannel: boolean }
      userId: string
      username: string
      gameId: string
      connectedUserIds: string[]
    }

export const connectedUserIdsQueryOptions = (channelId: string) =>
  queryOptions({
    queryKey: ['connectedUserIds', env.VITE_DISCORD_GUILD_ID, channelId],
    queryFn: () =>
      getConnectedUserIds({
        data: { guildId: env.VITE_DISCORD_GUILD_ID, channelId },
      }),
  })

export const Route = createFileRoute('/game/$gameId')({
  beforeLoad: async ({ params, context }) => {
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

    // Validate roleId exists - required for voice channel access
    if (!result.roleId) {
      console.error(
        '[Game] Room has no roleId - cannot grant voice channel access',
      )
      throw redirect({
        to: '/',
        search: {
          error: 'Game room is misconfigured - missing role permissions',
        },
      })
    }

    const { userIds: connectedUserIds } =
      await context.queryClient.ensureQueryData(
        connectedUserIdsQueryOptions(gameId),
      )

    console.log({ connectedUserIds })

    return {
      roomName: result.channelName,
      roleId: result.roleId,
      connectedUserIds: Array.from(connectedUserIds),
    }
  },
  loader: async ({ params, context }): Promise<GameLoaderData> => {
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
      console.error('[Game] Error fetching user:', error)
      return {
        isAuthenticated: false,
        voiceChannelStatus: {
          inChannel: false,
        },
        initialMembers: [],
        username: undefined, // No username when not authenticated
      }
    }

    // Ensure user is in guild
    const guildResult = await ensureUserInGuild({
      data: { userId: user.id, accessToken: token.accessToken },
    })

    if (!guildResult.success) {
      console.error('[Game] Error ensuring user in guild:', guildResult.error)
      throw redirect({
        to: '/',
        search: {
          error: guildResult.error || 'Failed to ensure user in guild',
        },
      })
    } else if (guildResult.alreadyPresent) {
      console.log('[Game] User was already in guild')
    } else {
      console.log('[Game] User was added to guild')
    }

    const roleResult = await ensureUserHasRole({
      data: { userId: user.id, roleId: context.roleId },
    })

    if (!roleResult.success) {
      console.error('[Game] Failed to ensure user has role:', roleResult.error)
      throw redirect({
        to: '/',
        search: {
          error: roleResult.error || 'Failed to grant voice channel access',
        },
      })
    } else if (roleResult.alreadyPresent) {
      console.log('[Game] User already had role')
    } else {
      console.log('[Game] Successfully assigned role to user')
    }

    // Ensure user is in voice channel
    const voiceChannelResult = await ensureUserInVoiceChannel({
      data: { userId: user.id, targetChannelId: gameId },
    })

    if (!voiceChannelResult.success) {
      console.warn(
        '[Game] User is not in target voice channel:',
        voiceChannelResult.error,
      )
      // Don't fail - user might join manually or bot will move them
    } else if (voiceChannelResult.alreadyPresent) {
      console.log('[Game] User is already in target voice channel')
    } else {
      console.log('[Game] User is in a different voice channel')
    }

    return {
      isAuthenticated: true,
      voiceChannelStatus: {
        inChannel:
          voiceChannelResult.success && voiceChannelResult.alreadyPresent,
      },
      userId: user.id,
      username: user.username, // Discord username - required for authenticated users
      gameId, // Pass gameId for GameRoom to use
      connectedUserIds: context.connectedUserIds,
    }
  },
  component: GameRoomRoute,
  pendingComponent: () => (
    <div className="flex h-screen items-center justify-center bg-slate-950">
      <div className="flex flex-col items-center space-y-4">
        <div className="relative">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-purple-500/20">
            <Loader2 className="h-8 w-8 animate-spin text-purple-400" />
          </div>
          <div className="absolute inset-0 animate-ping rounded-full bg-purple-500/10" />
        </div>
        <div className="space-y-1 text-center">
          <h2 className="text-lg font-medium text-slate-200">
            Loading in Game Room
          </h2>
          <p className="text-sm text-slate-400">Setting up your session...</p>
        </div>
      </div>
    </div>
  ),
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
  const guildId = env.VITE_DISCORD_GUILD_ID
  const [showAuthModal, setShowAuthModal] = useState(
    !loaderData.isAuthenticated,
  )
  const [showJoinDiscordModal, setShowJoinDiscordModal] = useState(
    loaderData.isAuthenticated && !loaderData.voiceChannelStatus.inChannel,
  )
  const [isCheckingVoiceChannel, setIsCheckingVoiceChannel] = useState(false)

  const checkVoiceChannelFn = useServerFn(checkUserInVoiceChannel)

  const gameRoomConfig =
    !showAuthModal && !showJoinDiscordModal && loaderData.isAuthenticated
      ? ({ showGameRoom: true, playerName: loaderData.username } as const)
      : ({ showGameRoom: false, playerName: null } as const)

  const handleProceedToGame = useCallback(async () => {
    if (!loaderData.isAuthenticated) return

    setIsCheckingVoiceChannel(true)
    try {
      // Refresh voice channel status after user manually joined Discord
      const result = await checkVoiceChannelFn({
        data: {
          userId: loaderData.userId,
          targetChannelId: gameId,
        },
      })

      console.log('[GameRoomRoute] Voice channel check result:', result)

      if (result.inChannel) {
        // User is now in the voice channel, proceed to game
        setShowJoinDiscordModal(false)
      } else {
        // User still not in voice channel, show error
        console.warn(
          '[GameRoomRoute] User still not in voice channel after joining Discord',
        )
        // Keep modal open and show error message
      }
    } catch (error) {
      console.error('[GameRoomRoute] Error checking voice channel:', error)
      // Keep modal open on error
    } finally {
      setIsCheckingVoiceChannel(false)
    }
  }, [loaderData, gameId, checkVoiceChannelFn])

  const handleLeaveGame = () => {
    sessionStorage.clearGameState()
    navigate({ to: '/' })
  }

  if (showAuthModal) {
    return (
      <DiscordAuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        returnUrl={`/game/${gameId}`}
      />
    )
  }

  if (showJoinDiscordModal) {
    return (
      <JoinDiscordModal
        open={showJoinDiscordModal}
        onOpenChange={setShowJoinDiscordModal}
        discordUrl={`https://discord.com/channels/${guildId}/${gameId}`}
        channelId={gameId}
        onProceedToGame={handleProceedToGame}
        title="🎮 Game Room Ready!"
        isCheckingVoiceChannel={isCheckingVoiceChannel}
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
      {gameRoomConfig.showGameRoom && (
        <Suspense
          fallback={
            <div className="flex h-screen items-center justify-center">
              Loading game room...
            </div>
          }
        >
          <GameRoom
            roomId={gameId}
            playerName={gameRoomConfig.playerName}
            onLeaveGame={handleLeaveGame}
            detectorType={detector as DetectorType | undefined}
            usePerspectiveWarp={usePerspectiveWarp}
          />
        </Suspense>
      )}
    </ErrorBoundary>
  )
}
