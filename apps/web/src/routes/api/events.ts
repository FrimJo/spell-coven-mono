import { createFileRoute } from '@tanstack/react-router'

import { sseManager } from '../../server/managers/sse-manager.js'

/**
 * Internal Events Endpoint
 *
 * Receives Discord events from external Gateway service.
 * Broadcasts events to SSE clients.
 *
 * Per spec: POST /api/events with HMAC-signed payload
 */

export const Route = createFileRoute('/api/events')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          console.log('[Events] Received POST request')

          // Parse request body
          const body = (await request.json()) as {
            event?: string
            payload?: unknown
          }

          const { event, payload } = body

          if (!event) {
            console.warn('[Events] Missing event field')
            return new Response(
              JSON.stringify({ error: 'Missing event field' }),
              {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
              },
            )
          }

          console.log(`[Events] Received event: ${event}`)

          // Broadcast to SSE clients
          const guildId = process.env.VITE_DISCORD_GUILD_ID
          if (guildId) {
            sseManager.broadcastToGuild(guildId, event, payload || {})
          }

          return new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        } catch (error) {
          console.error('[Events] Error processing event:', error)
          return new Response(
            JSON.stringify({ error: 'Internal server error' }),
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
