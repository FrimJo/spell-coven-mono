import { EventEmitter } from 'node:events'
import { randomUUID } from 'node:crypto'

import { describe, expect, beforeEach, afterEach, it, vi } from 'vitest'

import type { GatewayCommand, GatewayEvent } from '@repo/discord-gateway'

import {
  GatewayWsClient,
  type GatewayWsClientDependencies,
} from '@/server/gateway/gateway-ws.client'
import { type GatewayMetrics } from '@/server/metrics/gateway-metrics'

class MockWebSocket extends EventEmitter {
  public readonly sent: unknown[] = []

  send(data: unknown, callback?: (error?: Error) => void): void {
    this.sent.push(data)
    callback?.()
  }

  close(): void {
    this.emit('close', 1000, Buffer.alloc(0))
  }

  removeAllListeners(): this {
    super.removeAllListeners()
    return this
  }
}

function createStubMetrics(): GatewayMetrics {
  const counter = () => {
    let value = 0
    return {
      name: 'counter',
      increment(by = 1) {
        value += by
      },
      value() {
        return value
      },
      reset() {
        value = 0
      },
    }
  }

  const gauge = () => {
    let value = 0
    return {
      name: 'gauge',
      set(next: number) {
        value = next
      },
      increment(by = 1) {
        value += by
      },
      decrement(by = 1) {
        value -= by
      },
      value() {
        return value
      },
      reset() {
        value = 0
      },
    }
  }

  const histogram = () => {
    const values: number[] = []
    return {
      name: 'histogram',
      record(value: number) {
        values.push(value)
      },
      values() {
        return values
      },
      reset() {
        values.length = 0
      },
    }
  }

  return {
    eventsReceived: counter(),
    commandsEnqueued: counter(),
    commandsSent: counter(),
    commandFailures: counter(),
    commandRetries: counter(),
    queueDepth: gauge(),
    connectionState: gauge(),
    sseSubscribers: gauge(),
    eventLatencyMs: histogram(),
    commandLatencyMs: histogram(),
    reconnectLatencyMs: histogram(),
  }
}

function createCommand(): GatewayCommand {
  return {
    version: '1.0',
    type: 'sendMessage',
    data: { channelId: '123', content: 'hello world' },
    meta: {
      traceId: randomUUID(),
      sentAt: new Date().toISOString(),
    },
  }
}

describe('GatewayWsClient', () => {
  const sockets: MockWebSocket[] = []
  let dependencies: GatewayWsClientDependencies

  beforeEach(() => {
    vi.useFakeTimers()
    vi.spyOn(Math, 'random').mockReturnValue(0)

    dependencies = {
      metrics: createStubMetrics(),
      loadConfig: () => ({
        wsUrl: 'ws://localhost:1234',
        linkToken: 'token',
        enableLegacyBridge: false,
      }),
      createWebSocket: vi.fn(() => {
        const socket = new MockWebSocket()
        sockets.push(socket)
        return socket as unknown as WebSocket
      }),
      now: () => Date.now(),
      queueOptions: { maxSize: 2 },
    }
  })

  afterEach(() => {
    vi.clearAllTimers()
    vi.clearAllMocks()
    sockets.splice(0, sockets.length)
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('schedules reconnect attempts after close events', async () => {
    const client = new GatewayWsClient(dependencies)
    await client.start()

    const socket = sockets[0]!
    socket.emit('close', 4000, Buffer.from('test'))

    expect((dependencies.createWebSocket as ReturnType<typeof vi.fn>)).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(1_000)

    expect((dependencies.createWebSocket as ReturnType<typeof vi.fn>)).toHaveBeenCalledTimes(2)

    client.stop()
  })

  it('limits the command queue size', async () => {
    const client = new GatewayWsClient({
      ...dependencies,
      queueOptions: { maxSize: 1 },
    })

    await client.start()

    const first = client.enqueue(createCommand())
    expect(first.ok).toBe(true)

    const second = client.enqueue(createCommand())
    expect(second.ok).toBe(false)

    client.stop()
  })

  it('publishes inbound events to the event bus', async () => {
    const events: GatewayEvent[] = []
    const client = new GatewayWsClient(dependencies)

    client.bus.subscribe((event) => {
      events.push(event)
    })

    await client.start()

    const socket = sockets[0]!
    socket.emit('open')

    const payload: GatewayEvent = {
      version: '1.0',
      type: 'voice.joined',
      data: { guildId: '1', channelId: '2', userId: '3' },
      meta: {
        traceId: randomUUID(),
        sentAt: new Date().toISOString(),
      },
    }

    socket.emit('message', JSON.stringify(payload))

    await Promise.resolve()

    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({
      type: 'voice.joined',
      data: payload.data,
    })

    client.stop()
  })
})
