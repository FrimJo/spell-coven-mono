import type { GatewayEvent } from '@repo/discord-gateway'

import { ensureGatewayStarted, getGatewayClient } from './gateway-ws.client'
import { gatewayMetrics } from '../metrics/gateway-metrics'

const HEARTBEAT_INTERVAL_MS = 15_000

function formatSseEvent(event: GatewayEvent): string {
  const payload = {
    version: event.version,
    event: event.type,
    data: event.data,
    meta: event.meta,
  }

  const lines = [
    `id: ${event.meta.traceId}`,
    `event: ${event.type}`,
    `data: ${JSON.stringify(payload)}`,
  ]

  return `${lines.join('\n')}\n\n`
}

function encode(data: string): Uint8Array {
  return new TextEncoder().encode(data)
}

export async function createGatewaySseResponse(
  request: Request,
): Promise<Response> {
  await ensureGatewayStarted()

  const client = getGatewayClient()
  let cleanup: (() => void) | undefined

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      gatewayMetrics.sseSubscribers.increment()

      const send = (event: GatewayEvent) => {
        controller.enqueue(encode(formatSseEvent(event)))
      }

      const unsubscribe = client.bus.subscribe(send)

      const heartbeat = setInterval(() => {
        controller.enqueue(encode(': ping\n\n'))
      }, HEARTBEAT_INTERVAL_MS)

      cleanup = () => {
        clearInterval(heartbeat)
        unsubscribe()
        gatewayMetrics.sseSubscribers.decrement()
        try {
          controller.close()
        } catch (error) {
          // Controller may already be closed - ignore
        }
        cleanup = undefined
      }

      request.signal.addEventListener('abort', () => cleanup?.(), {
        once: true,
      })
    },
    cancel() {
      cleanup?.()
      cleanup = undefined
    },
  })

  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
