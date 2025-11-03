/**
 * WebSocket authentication server function
 */

import { createHmac } from 'node:crypto'
import { env } from '@/env'
import { createServerFn } from '@tanstack/react-start'

// ============================================================================
// Token Generation
// ============================================================================

/**
 * Create a WebSocket authentication token
 */
function createWebSocketAuthToken(
  userId: string,
  expirationSeconds: number,
): string {
  const secret = env.HUB_SECRET
  const issuedAt = Math.floor(Date.now() / 1000)
  const expiresAt = issuedAt + expirationSeconds

  const payload = JSON.stringify({
    userId,
    issuedAt,
    expiresAt,
  })

  const signature = createHmac('sha256', secret).update(payload).digest('hex')

  return `${Buffer.from(payload).toString('base64')}.${signature}`
}

// ============================================================================
// Server Function
// ============================================================================

/**
 * Server function to generate a WebSocket authentication token
 * Called by the frontend to get a token for WebSocket connection
 */
export const generateWebSocketAuthToken = createServerFn({ method: 'POST' })
  .inputValidator((data: { userId: string }) => data)
  .handler(async ({ data: { userId } }): Promise<{ token: string }> => {
    const token = createWebSocketAuthToken(userId, 3600) // 1 hour expiration
    console.log('[WS Auth] Generated token:', token.substring(0, 50) + '...')
    console.log('[WS Auth] Token parts:', token.split('.').length)
    return { token }
  })
