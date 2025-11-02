import WebSocket from 'ws'

export interface ClientConfig {
  gatewayUrl: string
  linkToken: string
}

export interface GatewayMessage {
  type: 'event' | 'command' | 'ack' | 'error'
  data: unknown
  requestId?: string
  ts: number
}

/**
 * Gateway WebSocket Client
 *
 * Connects to the Discord Gateway service and receives events.
 * Forwards events to the event bus for distribution to SSE streams.
 */
export class GatewayWebSocketClient {
  private config: ClientConfig
  private ws: WebSocket | null = null
  private onEventCallback: ((event: string, payload: unknown) => void) | null =
    null
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectTimeout: NodeJS.Timeout | null = null
  private isConnecting = false

  constructor(config: ClientConfig) {
    this.config = config
  }

  /**
   * Connect to Gateway service
   */
  async connect(): Promise<void> {
    if (this.isConnecting) {
      console.warn('[Gateway Client] Already connecting')
      return
    }

    if (this.ws?.readyState === WebSocket.OPEN) {
      console.warn('[Gateway Client] Already connected')
      return
    }

    this.isConnecting = true

    return new Promise((resolve, reject) => {
      try {
        console.log(
          `[Gateway Client] Connecting to ${this.config.gatewayUrl}...`,
        )

        this.ws = new WebSocket(this.config.gatewayUrl, {
          headers: {
            Authorization: `Bearer ${this.config.linkToken}`,
          },
        })

        this.ws.on('open', () => {
          console.log('[Gateway Client] Connected to Gateway service')
          this.reconnectAttempts = 0
          this.isConnecting = false
          resolve()
        })

        this.ws.on('message', (data) => {
          try {
            const message = JSON.parse(data.toString()) as GatewayMessage
            this.handleMessage(message)
          } catch (error) {
            console.error('[Gateway Client] Failed to parse message:', error)
          }
        })

        this.ws.on('close', (code, reason) => {
          console.log(`[Gateway Client] Disconnected: ${code} ${reason}`)
          this.isConnecting = false
          this.ws = null
          this.handleReconnect()
        })

        this.ws.on('error', (error) => {
          console.error('[Gateway Client] Error:', error)
          this.isConnecting = false
          reject(error)
        })
      } catch (error) {
        this.isConnecting = false
        reject(error)
      }
    })
  }

  /**
   * Handle incoming message from Gateway
   */
  private handleMessage(message: GatewayMessage): void {
    if (message.type === 'event') {
      const { event, payload } = message.data as {
        event: string
        payload: unknown
      }

      if (this.onEventCallback) {
        this.onEventCallback(event, payload)
      }
    } else if (message.type === 'ack') {
      // Acknowledgment received
      console.log('[Gateway Client] Ack received:', message.data)
    } else if (message.type === 'error') {
      console.error('[Gateway Client] Error from Gateway:', message.data)
    }
  }

  /**
   * Handle reconnection with exponential backoff
   */
  private handleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[Gateway Client] Max reconnection attempts reached')
      return
    }

    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 16000)
    this.reconnectAttempts++

    console.log(
      `[Gateway Client] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`,
    )

    this.reconnectTimeout = setTimeout(() => {
      this.connect().catch((error) => {
        console.error('[Gateway Client] Reconnection failed:', error)
      })
    }, delay)
  }

  /**
   * Disconnect from Gateway service
   */
  disconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout)
      this.reconnectTimeout = null
    }

    if (this.ws) {
      this.ws.close(1000, 'Normal closure')
      this.ws = null
    }

    this.reconnectAttempts = 0
    this.isConnecting = false
  }

  /**
   * Register event handler
   */
  onEvent(callback: (event: string, payload: unknown) => void): void {
    this.onEventCallback = callback
  }

  /**
   * Send command to Gateway (future)
   */
  async sendCommand(command: string, payload: unknown): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('Not connected to Gateway')
    }

    const message: GatewayMessage = {
      type: 'command',
      data: { command, payload },
      requestId: `cmd-${Date.now()}`,
      ts: Date.now(),
    }

    this.ws.send(JSON.stringify(message))
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN
  }
}
