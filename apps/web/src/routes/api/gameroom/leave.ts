import { gameRoomManager } from '@/server/managers/gameroom-manager'
import { createFileRoute } from '@tanstack/react-router'

/**
 * POST /api/gameroom/leave
 *
 * Remove presence from a game room.
 * Independent of Discord voice channels.
 */

export const Route = createFileRoute('/api/gameroom/leave')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await request.json()
          const { roomId, userId } = body

          // Validate required fields
          if (!roomId || !userId) {
            return new Response(
              JSON.stringify({
                error: 'Missing required fields: roomId, userId',
              }),
              {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
              },
            )
          }

          console.log(
            `[API /gameroom/leave] User ${userId} leaving room ${roomId}`,
          )

          // Leave the room
          gameRoomManager.leaveRoom(roomId, userId)

          return new Response(
            JSON.stringify({
              success: true,
            }),
            {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            },
          )
        } catch (error) {
          console.error('[API /gameroom/leave] Error:', error)
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
