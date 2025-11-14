import { gameRoomManager } from '@/server/managers/gameroom-manager'
import { createFileRoute } from '@tanstack/react-router'

/**
 * GET /api/gameroom/stream
 *
 * SSE stream for game room events (join/leave).
 * Independent of Discord voice channels.
 */

function encodeSSE(data: string): Uint8Array {
  return new TextEncoder().encode(data)
}

export const Route = createFileRoute('/api/gameroom/stream')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        console.log('[Gameroom SSE] Request URL:', request.url)

        // Parse query params
        const url = new URL(request.url)
        const roomId = url.searchParams.get('roomId')
        const userId = url.searchParams.get('userId')

        console.log('[Gameroom SSE] Parsed params:', { roomId, userId })

        // Validate required params
        if (!roomId) {
          return new Response(
            JSON.stringify({ error: 'roomId query parameter is required' }),
            {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            },
          )
        }

        if (!userId) {
          return new Response(
            JSON.stringify({ error: 'userId query parameter is required' }),
            {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            },
          )
        }

        console.log(
          `[Gameroom SSE] Client connecting: user ${userId} to room ${roomId}`,
        )

        // Create ReadableStream for SSE
        let heartbeatInterval: NodeJS.Timeout | null = null
        let connectionId: string | null = null

        const stream = new ReadableStream({
          start(controller) {
            try {
              // Register SSE connection
              connectionId = gameRoomManager.registerSSE(
                roomId,
                userId,
                controller,
              )
              console.log(
                `[Gameroom SSE] Connection registered: ${connectionId}`,
              )

              // Send initial connection acknowledgment
              const ackMessage = `event: connected\ndata: ${JSON.stringify({
                timestamp: Date.now(),
              })}\n\n`
              controller.enqueue(encodeSSE(ackMessage))

              // Heartbeat to keep connection alive (every 15 seconds)
              heartbeatInterval = setInterval(() => {
                try {
                  controller.enqueue(encodeSSE(': ping\n\n'))
                } catch (error) {
                  console.error(
                    '[Gameroom SSE] Error sending heartbeat:',
                    error,
                  )
                  if (heartbeatInterval) {
                    clearInterval(heartbeatInterval)
                    heartbeatInterval = null
                  }
                }
              }, 15000)
            } catch (error) {
              console.error('[Gameroom SSE] Error in start():', error)
              controller.error(error)
            }
          },

          cancel() {
            console.log(`[Gameroom SSE] Client disconnected: ${userId}`)

            // Clean up heartbeat
            if (heartbeatInterval) {
              clearInterval(heartbeatInterval)
              heartbeatInterval = null
            }

            // Unregister connection (will also remove from room)
            if (connectionId) {
              gameRoomManager.unregisterSSE(connectionId)
              connectionId = null
            }
          },
        })

        // Return SSE response
        return new Response(stream, {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
            'X-Accel-Buffering': 'no', // Disable nginx buffering
          },
        })
      },
    },
  },
})
