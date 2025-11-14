import { gameRoomManager } from '@/server/managers/gameroom-manager'
import { createFileRoute } from '@tanstack/react-router'

/**
 * POST /api/gameroom/join
 *
 * Announce presence in a game room and get current participants.
 * Independent of Discord voice channels.
 */

export const Route = createFileRoute('/api/gameroom/join')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await request.json()
          const { roomId, userId, username, avatar } = body

          // Validate required fields
          if (!roomId || !userId || !username) {
            return new Response(
              JSON.stringify({
                error: 'Missing required fields: roomId, userId, username',
              }),
              {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
              },
            )
          }

          console.log(
            `[API /gameroom/join] User ${username} (${userId}) joining room ${roomId}`,
          )

          // Join the room and get current participants
          const participants = gameRoomManager.joinRoom(
            roomId,
            userId,
            username,
            avatar,
          )

          return new Response(
            JSON.stringify({
              success: true,
              participants,
            }),
            {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            },
          )
        } catch (error) {
          console.error('[API /gameroom/join] Error:', error)
          return new Response(
            JSON.stringify({
              error:
                error instanceof Error
                  ? error.message
                  : 'Internal server error',
            }),
            {
              status: 500,
              headers: { 'Content-Type': 'application/json' },
            },
          )
        }
      },
    },
  },
})
