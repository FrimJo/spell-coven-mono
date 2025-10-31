import { verifyHmacSignature } from './hmac.server'
import { wsManager } from './managers/ws-manager'
import { InternalEventSchema } from './schemas/schemas'

/**
 * Handle internal webhook events from Discord Gateway Worker
 * This function is server-only and should only be called from server routes
 */
export async function handleInternalEvent({
  request,
}: {
  request: Request
}): Promise<Response> {
  try {
    // Extract headers
    const signature = request.headers.get('X-Hub-Signature')
    const timestampHeader = request.headers.get('X-Hub-Timestamp')

    if (!signature || !timestampHeader) {
      console.warn('[Internal] Missing HMAC headers')
      return new Response(
        JSON.stringify({ error: 'Missing required headers' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      )
    }

    const timestamp = parseInt(timestampHeader, 10)

    if (isNaN(timestamp)) {
      console.warn('[Internal] Invalid timestamp')
      return new Response(JSON.stringify({ error: 'Invalid timestamp' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Get raw body for HMAC verification
    const body = await request.text()

    // Verify HMAC signature
    const hubSecret = process.env.HUB_SECRET
    if (!hubSecret?.length) {
      console.error('[Internal] HUB_SECRET not configured')
      return new Response(JSON.stringify({ error: 'Server misconfigured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const verification = verifyHmacSignature(
      hubSecret,
      signature,
      timestamp,
      body,
    )

    if (!verification.valid) {
      console.warn(`[Internal] HMAC verification failed: ${verification.error}`)
      return new Response(
        JSON.stringify({
          error: 'Invalid signature',
          details: verification.error,
        }),
        { status: 403, headers: { 'Content-Type': 'application/json' } },
      )
    }

    // Parse and validate event
    let event
    try {
      event = JSON.parse(body)
    } catch (error) {
      console.error('[Internal] Failed to parse JSON:', error)
      return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const parseResult = InternalEventSchema.safeParse(event)

    if (!parseResult.success) {
      console.error('[Internal] Invalid event format:', parseResult.error)
      return new Response(
        JSON.stringify({
          error: 'Invalid event format',
          details: parseResult.error.issues,
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      )
    }

    const { event: eventType, payload } = parseResult.data

    // Broadcast event to WebSocket clients
    const guildId = process.env.VITE_DISCORD_GUILD_ID!
    wsManager.broadcastToGuild(guildId, eventType, payload)

    console.log(`[Internal] Event broadcast: ${eventType}`)

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('[Internal] Failed to process event:', error)

    if (error instanceof Error) {
      return new Response(
        JSON.stringify({
          error: 'Failed to process event',
          message: error.message,
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } },
      )
    }

    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
