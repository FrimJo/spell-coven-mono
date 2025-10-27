import type { WebSocket } from 'ws'
import { verifyJWT } from '@/server/jwt'
import { WSAuthMessageSchema } from '@/server/schemas'
import { wsManager } from '@/server/ws-manager'
import { createFileRoute } from '@tanstack/react-router'

/**
 * WebSocket endpoint for real-time Discord events
 *
 * GET /api/ws (WebSocket upgrade)
 *
 * Authentication flow:
 * 1. Client connects to ws://localhost:3000/api/ws
 * 2. Client sends: { "type": "auth", "token": "<jwt>" }
 * 3. Server verifies JWT and responds: { "v": 1, "type": "ack", "event": "auth.ok", "guildId": "..." }
 * 4. Client receives events: { "v": 1, "type": "event", "event": "room.created", "payload": {...}, "ts": 123 }
 *
 * Note: WebSocket handling requires server-side setup. This route is a placeholder.
 * For production, integrate with Vite's server or use a separate WebSocket server.
 */

export const Route = createFileRoute('/api/ws')({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        // Check if this is a WebSocket upgrade request
        const upgrade = request.headers.get('upgrade')
        const connection = request.headers.get('connection')

        if (upgrade !== 'websocket' || !connection?.includes('Upgrade')) {
          return new Response('Expected WebSocket upgrade', { status: 426 })
        }

        // WebSocket upgrade handling needs to be done at the server level
        // This is a placeholder - actual implementation requires Vite server integration
        return new Response('WebSocket endpoint - requires server-side setup', {
          status: 501,
        })
      },
    },
  },
})

/**
 * Handle WebSocket connection
 *
 * This function should be called by the server when a WebSocket connection is established.
 * In a real TanStack Start setup, this would be integrated with the server's upgrade handler.
 */
export function handleWebSocketConnection(ws: WebSocket): void {
  console.log('[WS] New WebSocket connection')

  let authenticated = false
  let userId: string | null = null
  let guildId: string | null = null

  // Set up authentication timeout (30 seconds)
  const authTimeout = setTimeout(() => {
    if (!authenticated) {
      console.warn('[WS] Authentication timeout')
      ws.close(4401, 'Authentication timeout')
    }
  }, 30000)

  // Handle messages
  ws.on('message', async (data) => {
    try {
      const message = JSON.parse(data.toString())

      // Handle authentication
      if (!authenticated) {
        const parseResult = WSAuthMessageSchema.safeParse(message)

        if (!parseResult.success) {
          ws.send(
            JSON.stringify({
              v: 1,
              type: 'error',
              error: {
                code: 'INVALID_MESSAGE',
                message: 'Expected auth message',
              },
              ts: Date.now(),
            }),
          )
          ws.close(4400, 'Invalid message format')
          return
        }

        // Verify JWT
        const jwtConfig = {
          issuer: process.env.JWT_ISSUER!,
          audience: process.env.JWT_AUDIENCE!,
          jwksUrl: process.env.JWT_PUBLIC_JWK_URL!,
        }

        try {
          const claims = await verifyJWT(parseResult.data.token, jwtConfig)
          userId = claims.sub
          guildId = process.env.PRIMARY_GUILD_ID!
          authenticated = true

          clearTimeout(authTimeout)

          // Register connection
          wsManager.register(ws, userId, guildId)

          // Send ACK
          ws.send(
            JSON.stringify({
              v: 1,
              type: 'ack',
              event: 'auth.ok',
              guildId,
              ts: Date.now(),
            }),
          )

          console.log(`[WS] Client authenticated: ${userId}`)
        } catch (error) {
          console.error('[WS] JWT verification failed:', error)
          ws.send(
            JSON.stringify({
              v: 1,
              type: 'error',
              error: {
                code: 'UNAUTHORIZED',
                message: 'Invalid or expired token',
              },
              ts: Date.now(),
            }),
          )
          ws.close(4401, 'Unauthorized')
        }

        return
      }

      // Handle other messages (currently none defined)
      console.log(`[WS] Received message from ${userId}:`, message)
    } catch (error) {
      console.error('[WS] Failed to parse message:', error)
      ws.send(
        JSON.stringify({
          v: 1,
          type: 'error',
          error: {
            code: 'INVALID_JSON',
            message: 'Failed to parse message',
          },
          ts: Date.now(),
        }),
      )
    }
  })

  // Handle close
  ws.on('close', (code, reason) => {
    clearTimeout(authTimeout)
    console.log(
      `[WS] Connection closed (code: ${code}, reason: ${reason.toString()})`,
    )
  })

  // Handle error
  ws.on('error', (error) => {
    console.error('[WS] WebSocket error:', error)
  })
}
