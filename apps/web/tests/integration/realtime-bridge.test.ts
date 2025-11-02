import { TextDecoder } from 'node:util'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { GatewayEvent } from '@repo/discord-gateway'

import { EventBus } from '@/server/gateway/event-bus'

vi.mock('@/server/gateway/gateway-ws.client', () => {
  const bus = new EventBus<GatewayEvent>()
  const client = {
    bus,
    currentState: 'connected' as const,
    enqueue: vi.fn(),
    queue: { markReady: vi.fn() },
    start: vi.fn(),
    stop: vi.fn(),
  }

  return {
    ensureGatewayStarted: vi.fn(() => Promise.resolve()),
    getGatewayClient: vi.fn(() => client),
    resetGatewayClient: vi.fn(),
    getGatewayEventBus: vi.fn(() => bus),
  }
})

import { createGatewaySseResponse } from '@/server/gateway/sse-router.server'
import {
  ensureGatewayStarted,
  getGatewayClient,
} from '@/server/gateway/gateway-ws.client'

const decoder = new TextDecoder()

describe('gateway SSE bridge', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('streams gateway events over SSE', async () => {
    const request = new Request('http://localhost/api/stream')
    const response = await createGatewaySseResponse(request)

    expect(ensureGatewayStarted).toHaveBeenCalled()

    const reader = response.body?.getReader()
    expect(reader).toBeDefined()
    if (!reader) {
      throw new Error('reader unavailable')
    }

    const client = getGatewayClient()
    const eventBus = client.bus as EventBus<GatewayEvent>

    const readPromise = reader.read()

    const event: GatewayEvent = {
      version: '1.0',
      type: 'messageCreate',
      data: { id: 'm1', channelId: 'c1', content: 'hello' },
      meta: {
        traceId: 'trace-123',
        sentAt: new Date().toISOString(),
      },
    }

    eventBus.publish(event)

    const chunk = await readPromise
    expect(chunk.done).toBe(false)
    expect(decoder.decode(chunk.value)).toContain('event: messageCreate')
    expect(decoder.decode(chunk.value)).toContain('"event":"messageCreate"')

    await reader.cancel()
  })
})
