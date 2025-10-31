import WebSocket from 'ws'

import type { ConnectionState, GatewayConfig, GatewaySession } from './types.js'

type WebSocketData = string | ArrayBuffer | ArrayBufferView | Buffer | Buffer[]

/**
 * Discord Gateway opcodes
 */
const enum GatewayOp {
  Dispatch = 0,
  Heartbeat = 1,
  Identify = 2,
  Resume = 6,
  Reconnect = 7,
  InvalidSession = 9,
  Hello = 10,
  HeartbeatAck = 11,
}

/**
 * Discord Gateway intents
 */
const INTENTS = (1 << 0) | (1 << 7) // GUILDS + GUILD_VOICE_STATES

/**
 * Discord Gateway client
 *
 * Maintains persistent WebSocket connection to Discord Gateway,
 * handles heartbeats, reconnection, and event forwarding.
 */
export class DiscordGatewayClient {
  private config: GatewayConfig
  private ws: WebSocket | null = null
  private state: ConnectionState = 'DISCONNECTED'
  private session: GatewaySession = {
    sessionId: null,
    sequenceNumber: null,
    resumeUrl: null,
  }

  private heartbeatInterval: NodeJS.Timeout | null = null
  private heartbeatAckReceived = false
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5

  // Event handlers
  private onEventCallback: ((event: string, data: unknown) => void) | null =
    null

  constructor(config: GatewayConfig) {
    this.config = config
  }

  /**
   * Connect to Discord Gateway
   */
  async connect(): Promise<void> {
    if (this.state !== 'DISCONNECTED') {
      console.warn('[Gateway] Already connected or connecting')
      return
    }

    this.state = 'CONNECTING'
    console.log('[Gateway] Connecting to Discord Gateway...')

    const gatewayUrl =
      this.session.resumeUrl || 'wss://gateway.discord.gg/?v=10&encoding=json'
    this.ws = new WebSocket(gatewayUrl)

    this.ws.on('open', () => this.handleOpen())
    this.ws.on('message', (data) => this.handleMessage(data))
    this.ws.on('close', (code, reason) => this.handleClose(code, reason))
    this.ws.on('error', (error) => this.handleError(error))
  }

  /**
   * Disconnect from Discord Gateway
   */
  disconnect(): void {
    console.log('[Gateway] Disconnecting...')

    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = null
    }

    if (this.ws) {
      this.ws.close(1000, 'Normal closure')
      this.ws = null
    }

    this.state = 'DISCONNECTED'
  }

  /**
   * Register event handler
   */
  onEvent(callback: (event: string, data: unknown) => void): void {
    this.onEventCallback = callback
  }

  /**
   * Get current connection state
   */
  getState(): ConnectionState {
    return this.state
  }

  // ============================================================================
  // WebSocket Event Handlers
  // ============================================================================

  private handleOpen(): void {
    console.log('[Gateway] WebSocket connection opened')
  }

  private handleMessage(data: WebSocketData): void {
    try {
      const payload = JSON.parse(data.toString())
      const { op, t, s, d } = payload

      // Update sequence number
      if (s !== null && s !== undefined) {
        this.session.sequenceNumber = s
      }

      switch (op) {
        case GatewayOp.Hello:
          this.handleHello(d)
          break

        case GatewayOp.HeartbeatAck:
          this.heartbeatAckReceived = true
          break

        case GatewayOp.Reconnect:
          console.log('[Gateway] Received RECONNECT from Discord')
          this.reconnect()
          break

        case GatewayOp.InvalidSession:
          console.warn('[Gateway] Invalid session, re-identifying...')
          this.session = {
            sessionId: null,
            sequenceNumber: null,
            resumeUrl: null,
          }
          setTimeout(() => this.identify(), 1000 + Math.random() * 4000)
          break

        case GatewayOp.Dispatch:
          this.handleDispatch(t, d)
          break
      }
    } catch (error) {
      console.error('[Gateway] Failed to parse message:', error)
    }
  }

  private handleClose(code: number, reason: Buffer): void {
    console.log(
      `[Gateway] Connection closed (code: ${code}, reason: ${reason.toString()})`,
    )

    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = null
    }

    // Attempt reconnection for recoverable close codes
    if (
      code !== 1000 &&
      code !== 4004 &&
      code !== 4010 &&
      code !== 4011 &&
      code !== 4012 &&
      code !== 4013 &&
      code !== 4014
    ) {
      this.reconnect()
    } else {
      console.error('[Gateway] Non-recoverable close code, not reconnecting')
      this.state = 'DISCONNECTED'
    }
  }

  private handleError(error: Error): void {
    console.error('[Gateway] WebSocket error:', error)
  }

  // ============================================================================
  // Gateway Protocol Handlers
  // ============================================================================

  private handleHello(data: { heartbeat_interval: number }): void {
    console.log(
      `[Gateway] Received HELLO (heartbeat interval: ${data.heartbeat_interval}ms)`,
    )

    // Start heartbeat
    this.startHeartbeat(data.heartbeat_interval)

    // Identify or resume
    if (this.session.sessionId) {
      this.resume()
    } else {
      this.identify()
    }
  }

  private identify(): void {
    console.log('[Gateway] Identifying...')
    this.state = 'IDENTIFYING'

    this.send({
      op: GatewayOp.Identify,
      d: {
        token: this.config.botToken,
        intents: INTENTS,
        properties: {
          os: process.platform,
          browser: 'discord-gateway-worker',
          device: 'discord-gateway-worker',
        },
      },
    })
  }

  private resume(): void {
    console.log('[Gateway] Resuming session...')

    this.send({
      op: GatewayOp.Resume,
      d: {
        token: this.config.botToken,
        session_id: this.session.sessionId,
        seq: this.session.sequenceNumber,
      },
    })
  }

  private handleDispatch(event: string, data: unknown): void {
    // Handle READY event
    if (
      event === 'READY' &&
      data !== null &&
      typeof data === 'object' &&
      'session_id' in data &&
      'resume_gateway_url' in data
    ) {
      this.session.sessionId = data.session_id as GatewaySession['sessionId']
      this.session.resumeUrl =
        data.resume_gateway_url as GatewaySession['resumeUrl']
      this.state = 'CONNECTED'
      this.reconnectAttempts = 0
      console.log(`[Gateway] Connected (session: ${this.session.sessionId})`)
      return
    }

    // Handle RESUMED event
    if (event === 'RESUMED') {
      this.state = 'CONNECTED'
      this.reconnectAttempts = 0
      console.log('[Gateway] Session resumed')
      return
    }

    // Forward events to handler
    if (this.onEventCallback) {
      this.onEventCallback(event, data)
    }
  }

  // ============================================================================
  // Heartbeat
  // ============================================================================

  private startHeartbeat(interval: number): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
    }

    this.heartbeatAckReceived = true

    this.heartbeatInterval = setInterval(() => {
      // Check if previous heartbeat was acknowledged
      if (!this.heartbeatAckReceived) {
        console.warn('[Gateway] Heartbeat not acknowledged, reconnecting...')
        this.reconnect()
        return
      }

      // Send heartbeat
      this.heartbeatAckReceived = false
      this.send({
        op: GatewayOp.Heartbeat,
        d: this.session.sequenceNumber,
      })
    }, interval)

    console.log(`[Gateway] Heartbeat started (interval: ${interval}ms)`)
  }

  // ============================================================================
  // Reconnection
  // ============================================================================

  private reconnect(): void {
    if (this.state === 'RECONNECTING') {
      return
    }

    this.state = 'RECONNECTING'
    this.reconnectAttempts++

    if (this.reconnectAttempts > this.maxReconnectAttempts) {
      console.error('[Gateway] Max reconnection attempts reached, giving up')
      this.state = 'DISCONNECTED'
      return
    }

    // Exponential backoff: 1s, 2s, 4s, 8s, 16s
    const delay = Math.min(
      1000 * Math.pow(2, this.reconnectAttempts - 1),
      16000,
    )
    console.log(
      `[Gateway] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})...`,
    )

    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = null
    }

    if (this.ws) {
      this.ws.removeAllListeners()
      this.ws.close()
      this.ws = null
    }

    setTimeout(() => {
      this.state = 'DISCONNECTED'
      this.connect()
    }, delay)
  }

  // ============================================================================
  // Utilities
  // ============================================================================

  private send(payload: unknown): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('[Gateway] Cannot send, WebSocket not open')
      return
    }

    this.ws.send(JSON.stringify(payload))
  }
}
