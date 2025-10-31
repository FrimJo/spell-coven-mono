import { handleInternalEvent } from '@/server/internal-events-handler.server'
import { createFileRoute } from '@tanstack/react-router'

/**
 * POST /api/internal/events
 *
 * Internal webhook endpoint for Discord Gateway Worker to post events
 *
 * Headers:
 *   X-Hub-Timestamp: <unix-timestamp-seconds>
 *   X-Hub-Signature: sha256=<hex-digest>
 *   Content-Type: application/json
 *
 * Body:
 *   {
 *     "event": "room.created" | "room.deleted" | "voice.joined" | "voice.left",
 *     "payload": { ... }
 *   }
 *
 * Response:
 *   { "ok": true }
 */
export const Route = createFileRoute('/api/internal/events')({
  server: {
    handlers: {
      POST: handleInternalEvent,
    },
  },
})
