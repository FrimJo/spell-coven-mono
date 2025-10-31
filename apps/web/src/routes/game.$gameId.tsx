import type { DetectorType } from '@/lib/detectors'
import { ErrorFallback } from '@/components/ErrorFallback'
import { GameRoom } from '@/components/GameRoom'
import { DiscordAuthModal } from '@/components/discord/DiscordAuthModal'
import { ensureValidDiscordToken, getDiscordClient } from '@/lib/discord-client'
import { sessionStorage } from '@/lib/session-storage'
import { checkRoomExists, joinRoom } from '@/server/discord-rooms'
import {
  createFileRoute,
  redirect,
  stripSearchParams,
  useNavigate,
} from '@tanstack/react-router'
import { zodValidator } from '@tanstack/zod-adapter'
import { ErrorBoundary } from 'react-error-boundary'
import { Suspense } from 'react'
import { z } from 'zod'
import { useEffect, useState } from 'react'
import { useServerFn } from '@tanstack/react-start'
import { toast } from 'sonner'

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
    const guildId = creatorInviteState?.guildId || process.env.VITE_DISCORD_GUILD_ID || ''

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

  const state = sessionStorage.loadGameState()
  const playerName = state?.playerName ?? 'Guest'

  const joinRoomFn = useServerFn(joinRoom)
  // Get invite token from search params if present
  const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null
  const inviteToken = urlParams?.get('t') || null

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
        })
        .catch((err) => {
          console.error('[GameRoomRoute] Failed to join with invite token:', err)
          toast.error(
            'Failed to join private room: ' + (err?.message || 'Unknown error'),
          )
          navigate({ to: '/' })
        })
    } else if (!inviteToken && auth?.userId && auth?.accessToken) {
      // Creator joining their own room (no invite token)
      // Get the invite token from session storage and use it to join
      console.log('[GameRoomRoute] No invite token, checking session storage for creator token')
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
          .then(async () => {
            console.log('[GameRoomRoute] Creator successfully joined room')
            
            // Auto-connect to voice channel
            try {
              const { connectUserToVoiceChannel } = await import('@/server/discord-rooms')
              const connectFn = useServerFn(connectUserToVoiceChannel)
              const result = await connectFn({
                data: {
                  guildId: creatorInviteState.guildId,
                  channelId: creatorInviteState.channelId,
                  userId: auth.userId,
                },
              })
              console.log('[GameRoomRoute] Voice channel connection result:', result)
            } catch (err) {
              console.error('[GameRoomRoute] Failed to auto-connect to voice channel:', err)
            }
          })
          .catch((err) => {
            console.error('[GameRoomRoute] Creator failed to join room:', err)
            // Don't navigate away - let them continue even if join fails
          })
      } else {
        console.warn('[GameRoomRoute] No creator invite token found in session storage')
      }
    }
  }, [inviteToken, auth?.userId, auth?.accessToken, joinRoomFn])

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
      <Suspense fallback={<div className="flex items-center justify-center h-screen">Loading game room...</div>}>
        <GameRoom
          gameId={gameId}
          guildId={guildId}
          playerName={playerName}
          onLeaveGame={handleLeaveGame}
          detectorType={detector as DetectorType | undefined}
          usePerspectiveWarp={usePerspectiveWarp}
        />
      </Suspense>
    </ErrorBoundary>
  )
}
