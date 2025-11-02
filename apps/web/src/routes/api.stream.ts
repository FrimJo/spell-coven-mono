import { getServices } from '../server/config/services'

/**
 * SSE Route for Discord Events
 *
 * Streams Discord events to authenticated browser clients using Server-Sent Events (SSE).
 *
 * Protocol:
 * - Content-Type: text/event-stream
 * - Authentication: Session cookie (HTTP-only, secure)
 * - Heartbeat: `: ping\n\n` every 15 seconds
 * - Event format: `event: {eventName}\ndata: {JSON}\n\n`
 */

export async function GET({ request }: { request: Request }) {
  // TODO: Add authentication when session management is implemented
  // For now, allow unauthenticated access for development
  const session = { userId: 'anonymous' }

  console.log(`[SSE] Client connected: ${session.userId}`)

  // Create SSE stream
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder()

      // Helper to write SSE messages
      const write = (event: string, data: unknown) => {
        try {
          const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
          controller.enqueue(encoder.encode(message))
        } catch (error) {
          console.error('[SSE] Failed to write message:', error)
        }
      }

      // Subscribe to event bus
      const services = getServices()
      const unsubscribe = services.eventBus.on((evt) => {
        write(evt.event, evt.payload)
      })

      // Heartbeat to keep connection alive
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': ping\n\n'))
        } catch (error) {
          console.error('[SSE] Heartbeat error:', error)
          clearInterval(heartbeat)
        }
      }, 15000)

      // Cleanup on close
      const cleanup = () => {
        console.log(`[SSE] Client disconnected: ${session.userId}`)
        clearInterval(heartbeat)
        unsubscribe()
      }

      // Handle client disconnect
      request.signal.addEventListener('abort', cleanup)

      // Store cleanup function
      return cleanup
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
    },
  })
}
