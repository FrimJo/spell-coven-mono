import { env } from '@/env'
import { createFileRoute } from '@tanstack/react-router'

import { sseManager } from '../../server/managers/sse-manager.js'

/**
 * SSE (Server-Sent Events) Endpoint
 *
 * Streams real-time Discord events to connected clients.
 * Per spec: GET /api/stream with session cookie authentication
 *
 * Protocol:
 * 1. Client connects to /api/stream with session cookie
 * 2. Server verifies session and establishes SSE connection
 * 3. Server streams events as they occur
 * 4. Client receives events via EventSource
 */

function encodeSSE(data: string): Uint8Array {
  return new TextEncoder().encode(data)
}

export const Route = createFileRoute('/api/stream')({
  server: {
    handlers: {
      GET: async () => {
        try {
          // TODO: Verify session from cookie
          // For now, accept all connections (will add auth later)

          const userId = 'user-' + Math.random().toString(36).substr(2, 9)
          const guildId = env.VITE_DISCORD_GUILD_ID

          console.log(`[SSE] Client connecting: user ${userId}`)

          // Create ReadableStream for SSE
          let heartbeatInterval: NodeJS.Timeout | null = null
          let connectionId: string | null = null

          const stream = new ReadableStream({
            start(controller) {
              try {
                // Register connection with SSE manager
                connectionId = sseManager.register(userId, guildId, controller)
                console.log(`[SSE] Client authenticated: ${userId}`)

                // Send initial connection acknowledgment
                const ackMessage = `data: ${JSON.stringify({
                  v: 1,
                  type: 'ack',
                  event: 'connected',
                  ts: Date.now(),
                })}\n\n`
                controller.enqueue(encodeSSE(ackMessage))

                // Heartbeat to keep connection alive (every 15 seconds per spec)
                heartbeatInterval = setInterval(() => {
                  try {
                    controller.enqueue(encodeSSE(': ping\n\n'))
                  } catch (error) {
                    console.error('[SSE] Error sending heartbeat:', error)
                    if (heartbeatInterval) {
                      clearInterval(heartbeatInterval)
                      heartbeatInterval = null
                    }
                  }
                }, 15000)
              } catch (error) {
                console.error('[SSE] Error in stream start:', error)
                controller.error(error)
              }
            },
            cancel() {
              console.log(`[SSE] Stream cancelled for user ${userId}`)
              if (heartbeatInterval) {
                clearInterval(heartbeatInterval)
                heartbeatInterval = null
              }
              if (connectionId) {
                sseManager.unregister(connectionId)
              }
            },
          })

          // Return SSE response with spec-compliant headers
          return new Response(stream, {
            headers: {
              'Content-Type': 'text/event-stream',
              'Cache-Control': 'no-cache, no-transform',
              'X-Accel-Buffering': 'no',
            },
          })
        } catch (error) {
          console.error('[SSE] Unexpected error:', error)
          return new Response('Internal Server Error', { status: 500 })
        }
      },
    },
  },
})
