import type { WebSocket } from 'ws'

import { WSAuthMessageSchema } from './schemas.js'
import { wsManager } from './ws-manager.js'
import { verifyWebSocketAuthToken } from './ws-token-crypto.js'

/**
 * Handle WebSocket connection
 *
 * This function is called when a WebSocket connection is established.
 */
export function handleWebSocketConnection(ws: WebSocket): void {
  console.log('[WS] New WebSocket connection established')
  console.log('[WS] WebSocket ready state:', ws.readyState)

  let authenticated = false
  let userId: string | null = null
  let guildId: string | null = null

  // Set up authentication timeout (60 seconds - give client time to send auth)
  const authTimeout = setTimeout(() => {
    if (!authenticated) {
      console.warn('[WS] Authentication timeout - closing connection')
      ws.close(4401, 'Authentication timeout')
    }
  }, 60000)

  // Set up ping/pong to keep connection alive
  const pingInterval = setInterval(() => {
    if (ws.readyState === 1) {
      // OPEN
      ws.ping()
    }
  }, 30000) // Ping every 30 seconds

  ws.on('pong', () => {
    console.log('[WS] Received pong from client')
  })

  // Handle messages
  ws.on('message', (data) => {
    try {
      const raw = typeof data === 'string' ? data : data.toString()
      const message = JSON.parse(raw)

      console.log('[WS] Received message:', message.type)

      // Handle authentication
      if (!authenticated) {
        console.log(
          '[WS] Attempting authentication with message type:',
          message.type,
        )
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
        try {
          const claims = verifyWebSocketAuthToken(parseResult.data.token)
          userId = claims.sub
          guildId = process.env.VITE_DISCORD_GUILD_ID!
          authenticated = true

          clearTimeout(authTimeout)

          // Register connection
          console.log(
            `[WS] Registering connection for user ${userId} in guild ${guildId}`,
          )
          wsManager.register(ws, userId, guildId)
          console.log(
            `[WS] Connection registered. Total connections: ${wsManager.getConnectionCount()}`,
          )

          // Send ACK
          const ackMessage = {
            v: 1,
            type: 'ack',
            event: 'auth.ok',
            guildId,
            ts: Date.now(),
          }
          ws.send(JSON.stringify(ackMessage))

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
    clearInterval(pingInterval)
    console.log(
      `[WS] Connection closed (code: ${code}, reason: ${reason.toString()})`,
    )
  })

  // Handle error
  ws.on('error', (error) => {
    console.error('[WS] WebSocket error:', error)
  })
}
