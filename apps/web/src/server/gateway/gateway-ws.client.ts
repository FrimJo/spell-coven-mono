import WebSocket, { type ClientOptions as WebSocketClientOptions } from 'ws'

import {
  GATEWAY_SCHEMA_VERSION,
  sanitizeGatewayCommand,
  sanitizeGatewayEvent,
  sanitizeTraceMeta,
  type GatewayCommand,
  type GatewayEvent,
} from '@repo/discord-gateway'

import { EventBus } from './event-bus'
import {
  CommandQueue,
  type CommandDispatcher,
  type CommandQueueOptions,
  type EnqueueResult,
} from './command-queue'
import {
  gatewayMetrics,
  type GatewayMetrics,
} from '../metrics/gateway-metrics'
import { type GatewayEnvironmentConfig, loadGatewayEnvironment } from './config'

export type GatewayClientState =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'stopped'

export interface GatewayWsClientDependencies {
  eventBus?: EventBus
  metrics?: GatewayMetrics
  loadConfig?: () => GatewayEnvironmentConfig
  createWebSocket?: (
    url: string,
    options: WebSocketClientOptions,
  ) => WebSocket
  now?: () => number
  logger?: Pick<typeof console, 'log' | 'error' | 'warn'>
  queueOptions?: CommandQueueOptions
}

function computeReconnectDelay(attempts: number): number {
  const base = 1_000
  const max = 30_000
  const jitterRatio = 0.4
  const exponential = base * 2 ** Math.max(0, attempts - 1)
  const capped = Math.min(exponential, max)
  const jitter = Math.random() * jitterRatio * capped
  return Math.min(max, Math.round(capped + jitter))
}

const defaultWebSocketFactory = (
  url: string,
  options: WebSocketClientOptions,
) => new WebSocket(url, options)

const defaultLogger: Pick<typeof console, 'log' | 'error' | 'warn'> = {
  log: console.log.bind(console),
  error: console.error.bind(console),
  warn: console.warn.bind(console),
}

export class GatewayWsClient {
  private state: GatewayClientState = 'idle'

  private ws: WebSocket | null = null

  private readonly eventBus: EventBus

  private readonly metrics: GatewayMetrics

  private readonly commandQueue: CommandQueue

  private readonly loadConfig: () => GatewayEnvironmentConfig

  private readonly createWebSocket: (
    url: string,
    options: WebSocketClientOptions,
  ) => WebSocket

  private readonly now: () => number

  private readonly logger: Pick<typeof console, 'log' | 'error' | 'warn'>

  private reconnectTimer: NodeJS.Timeout | null = null

  private reconnectAttempts = 0

  private config: GatewayEnvironmentConfig | null = null

  private lastDisconnectAt: number | null = null

  constructor(dependencies: GatewayWsClientDependencies = {}) {
    this.eventBus = dependencies.eventBus ?? new EventBus()
    this.metrics = dependencies.metrics ?? gatewayMetrics
    this.loadConfig = dependencies.loadConfig ?? loadGatewayEnvironment
    this.createWebSocket =
      dependencies.createWebSocket ?? defaultWebSocketFactory
    this.now = dependencies.now ?? Date.now
    this.logger = dependencies.logger ?? defaultLogger

    const dispatcher: CommandDispatcher = async (envelope) => {
      if (!this.ws || this.state !== 'connected') {
        return 'retry'
      }

      const payload = sanitizeGatewayCommand({
        ...envelope.command,
        meta: sanitizeTraceMeta({
          ...envelope.command.meta,
          requestId: envelope.requestId,
          traceId: envelope.traceId,
          sentAt: new Date().toISOString(),
        }),
        version: envelope.command.version ?? GATEWAY_SCHEMA_VERSION,
      })

      if (!payload) {
        this.metrics.commandFailures.increment()
        this.logger.error('[GatewayWsClient] Failed to sanitize command')
        return 'sent'
      }

      try {
        await new Promise<void>((resolve, reject) => {
          this.ws?.send(JSON.stringify(payload), (error) => {
            if (error) {
              reject(error)
              return
            }

            resolve()
          })
        })

        this.metrics.commandsSent.increment()
        this.metrics.commandLatencyMs.record(
          this.now() - envelope.enqueuedAt,
        )
        return 'sent'
      } catch (error) {
        this.metrics.commandFailures.increment()
        this.logger.error('[GatewayWsClient] Failed to send command', error)
        return 'retry'
      }
    }

    const queueOptions = dependencies.queueOptions ?? {}
    this.commandQueue = new CommandQueue(dispatcher, {
      ...queueOptions,
      onSizeChange: (size) => {
        this.metrics.queueDepth.set(size)
        queueOptions.onSizeChange?.(size)
      },
    })
  }

  get currentState(): GatewayClientState {
    return this.state
  }

  get bus(): EventBus {
    return this.eventBus
  }

  get queue(): CommandQueue {
    return this.commandQueue
  }

  async start(): Promise<void> {
    if (this.state === 'connected' || this.state === 'connecting') {
      return
    }

    if (this.state === 'stopped') {
      throw new Error('Gateway client has been stopped and cannot be restarted')
    }

    if (!this.config) {
      this.config = this.loadConfig()
    }

    this.connect()
  }

  stop(): void {
    this.state = 'stopped'
    this.clearReconnectTimer()
    this.commandQueue.clear()
    this.metrics.queueDepth.set(0)
    this.closeSocket()
  }

  enqueue(command: GatewayCommand): EnqueueResult {
    this.metrics.commandsEnqueued.increment()
    const result = this.commandQueue.enqueue(command)

    if (!result.ok) {
      this.metrics.commandFailures.increment()
      this.logger.warn('[GatewayWsClient] Command queue saturated')
    }

    return result
  }

  private connect(): void {
    const config = this.config ?? this.loadConfig()

    this.clearReconnectTimer()
    this.state = 'connecting'
    this.logger.log('[GatewayWsClient] Connecting to gateway...')

    const ws = this.createWebSocket(config.wsUrl, {
      headers: {
        Authorization: `Bearer ${config.linkToken}`,
        'X-Gateway-Version': GATEWAY_SCHEMA_VERSION,
      },
    })

    this.ws = ws

    ws.on('open', () => this.handleOpen())
    ws.on('close', (code, reason) => this.handleClose(code, reason))
    ws.on('error', (error) => this.handleError(error))
    ws.on('message', (data) => this.handleMessage(data))
  }

  private handleOpen(): void {
    this.state = 'connected'
    this.reconnectAttempts = 0
    this.metrics.connectionState.set(1)
    if (this.lastDisconnectAt) {
      this.metrics.reconnectLatencyMs.record(
        this.now() - this.lastDisconnectAt,
      )
      this.lastDisconnectAt = null
    }
    this.logger.log('[GatewayWsClient] Connected to gateway')
    this.commandQueue.markReady()
  }

  private handleMessage(data: WebSocket.RawData): void {
    let parsed: unknown

    try {
      const text =
        typeof data === 'string' ? data : data.toString('utf-8')
      parsed = JSON.parse(text)
    } catch (error) {
      this.logger.error('[GatewayWsClient] Failed to parse message', error)
      return
    }

    const event = sanitizeGatewayEvent(parsed)
    if (!event) {
      this.logger.warn('[GatewayWsClient] Received malformed gateway event')
      return
    }

    this.metrics.eventsReceived.increment()

    const sentAt = Date.parse(event.meta.sentAt)
    if (!Number.isNaN(sentAt)) {
      this.metrics.eventLatencyMs.record(this.now() - sentAt)
    }

    this.eventBus.publish(event as GatewayEvent)
  }

  private handleClose(code: number, reason: Buffer): void {
    this.logger.warn(
      `[GatewayWsClient] Connection closed (${code}) ${reason.toString()}`,
    )
    this.metrics.connectionState.set(0)
    this.lastDisconnectAt = this.now()
    this.ws = null

    if (this.state === 'stopped') {
      return
    }

    this.state = 'reconnecting'
    this.scheduleReconnect()
  }

  private handleError(error: Error): void {
    this.logger.error('[GatewayWsClient] WebSocket error', error)
    if (this.state === 'connecting') {
      this.state = 'reconnecting'
      this.scheduleReconnect()
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer || this.state === 'stopped') {
      return
    }

    this.reconnectAttempts += 1
    const delay = computeReconnectDelay(this.reconnectAttempts)
    this.logger.log(
      `[GatewayWsClient] Scheduling reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`,
    )

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      try {
        this.connect()
      } catch (error) {
        this.logger.error('[GatewayWsClient] Reconnect failed', error)
        this.scheduleReconnect()
      }
    }, delay)
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
  }

  private closeSocket(): void {
    if (!this.ws) {
      return
    }

    try {
      this.ws.removeAllListeners()
      this.ws.close()
    } catch (error) {
      this.logger.error('[GatewayWsClient] Failed to close WebSocket', error)
    } finally {
      this.ws = null
      this.metrics.connectionState.set(0)
    }
  }
}

let singletonClient: GatewayWsClient | null = null
let singletonBus: EventBus | null = null

export function getGatewayEventBus(): EventBus {
  if (!singletonBus) {
    singletonBus = new EventBus()
  }
  return singletonBus
}

export function getGatewayClient(): GatewayWsClient {
  if (!singletonClient) {
    singletonClient = new GatewayWsClient({
      eventBus: getGatewayEventBus(),
    })
  }

  return singletonClient
}

export function resetGatewayClient(): void {
  singletonClient?.stop()
  singletonClient = null
  singletonBus?.clear()
  singletonBus = null
}

export function ensureGatewayStarted(): Promise<void> {
  return getGatewayClient().start()
}
