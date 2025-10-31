import type { Peer } from 'crossws'
import { verifyWebSocketAuthToken } from './ws-token-crypto'
import { WSAuthMessageSchema } from './schemas'
import { wsManager } from './ws-manager'

interface AuthenticatedPeer extends Peer {
  userId?: string
  guildId?: string
  authenticated?: boolean
}

/**
 * Handle WebSocket connection using CrossWS
 */
export function createWebSocketHandler() {
  return {
    hooks: {
      connect: (peer: AuthenticatedPeer) => {
        console.log('[CrossWS] New WebSocket connection')
        peer.authenticated = false
      },

      message: (peer: AuthenticatedPeer, message: Buffer) => {
        try {
          const raw = message.toString('utf8')
          const data = JSON.parse(raw)

          console.log('[CrossWS] Received message:', data.type)

          // Handle authentication
          if (!peer.authenticated) {
            console.log('[CrossWS] Attempting authentication')
            const parseResult = WSAuthMessageSchema.safeParse(data)

            if (!parseResult.success) {
              console.error('[CrossWS] Invalid auth message format')
              peer.send(
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
              peer.close()
              return
            }

            // Verify JWT
            try {
              const claims = verifyWebSocketAuthToken(parseResult.data.token)
              peer.userId = claims.sub
              peer.guildId = process.env.VITE_DISCORD_GUILD_ID!
              peer.authenticated = true

              console.log(`[CrossWS] Client authenticated: ${peer.userId}`)

              // Register connection with manager
              wsManager.registerPeer(peer as any, peer.userId, peer.guildId)

              // Send ACK
              const ackMessage = {
                v: 1,
                type: 'ack',
                event: 'auth.ok',
                guildId: peer.guildId,
                ts: Date.now(),
              }
              peer.send(JSON.stringify(ackMessage))
            } catch (error) {
              console.error('[CrossWS] JWT verification failed:', error)
              peer.send(
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
              peer.close()
            }

            return
          }

          // Handle other messages
          console.log(`[CrossWS] Received message from ${peer.userId}:`, data)
        } catch (error) {
          console.error('[CrossWS] Failed to parse message:', error)
          peer.send(
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
      },

      close: (peer: AuthenticatedPeer) => {
        console.log(`[CrossWS] Connection closed for user ${peer.userId}`)
        if (peer.userId && peer.guildId) {
          wsManager.unregisterPeer(peer as any, peer.userId, peer.guildId)
        }
      },

      error: (peer: AuthenticatedPeer, error: Error) => {
        console.error('[CrossWS] WebSocket error:', error)
      },
    },
  }
}
