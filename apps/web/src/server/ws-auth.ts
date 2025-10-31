/**
 * WebSocket authentication server function
 * Token crypto operations are in ws-token-crypto.ts (pure server-only)
 */

import { createServerFn } from '@tanstack/react-start'
import { createWebSocketAuthToken } from './ws-token-crypto'

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
