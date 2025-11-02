import type { IncomingMessage } from 'node:http'
import { WebSocket, WebSocketServer } from 'ws'

export interface ServerConfig {
  port: number
  linkToken: string
}

export interface GatewayMessage {
  type: 'event' | 'command' | 'ack' | 'error'
  data: unknown
  requestId?: string
  ts: number
}

/**
 * WebSocket server for TanStack Start connections
 *
 * Accepts connections from TanStack Start backend with LINK_TOKEN authentication.
 * Broadcasts Discord events to all connected clients.
 */
export class GatewayWebSocketServer {
  private wss: WebSocketServer | null = null
  private config: ServerConfig
  private clients: Set<WebSocket> = new Set()
  private onCommandCallback:
    | ((command: string, payload: unknown) => void)
    | null = null

  constructor(config: ServerConfig) {
    this.config = config
  }

  /**
   * Start the WebSocket server
   */
  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.wss = new WebSocketServer({ port: this.config.port })

        this.wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
          this.handleConnection(ws, req)
        })

        this.wss.on('listening', () => {
          console.log(
            `[Gateway WS] Server listening on port ${this.config.port}`,
          )
          resolve()
        })

        this.wss.on('error', (error) => {
          console.error('[Gateway WS] Server error:', error)
          reject(error)
        })
      } catch (error) {
        reject(error)
      }
    })
  }

  /**
   * Handle new WebSocket connection
   */
  private handleConnection(ws: WebSocket, req: IncomingMessage): void {
    // Verify LINK_TOKEN authentication
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.warn(
        '[Gateway WS] Connection rejected: Missing authorization header',
      )
      ws.close(1008, 'Missing authorization')
      return
    }

    const token = authHeader.substring(7) // Remove 'Bearer ' prefix
    if (token !== this.config.linkToken) {
      console.warn('[Gateway WS] Connection rejected: Invalid LINK_TOKEN')
      ws.close(1008, 'Invalid token')
      return
    }

    console.log('[Gateway WS] Client connected')
    this.clients.add(ws)

    // Send acknowledgment
    this.send(ws, {
      type: 'ack',
      data: { message: 'Connected to Discord Gateway service' },
      ts: Date.now(),
    })

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString()) as GatewayMessage
        this.handleMessage(ws, message)
      } catch (error) {
        console.error('[Gateway WS] Failed to parse message:', error)
      }
    })

    ws.on('close', () => {
      console.log('[Gateway WS] Client disconnected')
      this.clients.delete(ws)
    })

    ws.on('error', (error) => {
      console.error('[Gateway WS] Client error:', error)
      this.clients.delete(ws)
    })
  }

  /**
   * Handle incoming message from client
   */
  private handleMessage(ws: WebSocket, message: GatewayMessage): void {
    if (message.type === 'command') {
      const { command, payload } = message.data as {
        command: string
        payload: unknown
      }
      console.log(`[Gateway WS] Received command: ${command}`)

      if (this.onCommandCallback) {
        this.onCommandCallback(command, payload)
      }

      // Send acknowledgment
      this.send(ws, {
        type: 'ack',
        data: { command },
        requestId: message.requestId,
        ts: Date.now(),
      })
    }
  }

  /**
   * Broadcast Discord event to all connected clients
   */
  broadcast(event: string, payload: unknown): void {
    const message: GatewayMessage = {
      type: 'event',
      data: { event, payload },
      ts: Date.now(),
    }

    const messageStr = JSON.stringify(message)
    let successCount = 0
    let failureCount = 0

    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(messageStr)
          successCount++
        } catch (error) {
          console.error('[Gateway WS] Failed to send to client:', error)
          failureCount++
        }
      }
    }

    if (successCount > 0 || failureCount > 0) {
      console.log(
        `[Gateway WS] Broadcast ${event}: ${successCount} success, ${failureCount} failed`,
      )
    }
  }

  /**
   * Send message to specific client
   */
  private send(ws: WebSocket, message: GatewayMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message))
    }
  }

  /**
   * Register command handler
   */
  onCommand(callback: (command: string, payload: unknown) => void): void {
    this.onCommandCallback = callback
  }

  /**
   * Stop the WebSocket server
   */
  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.wss) {
        // Close all client connections
        for (const client of this.clients) {
          client.close(1000, 'Server shutting down')
        }
        this.clients.clear()

        // Close server
        this.wss.close(() => {
          console.log('[Gateway WS] Server stopped')
          resolve()
        })
      } else {
        resolve()
      }
    })
  }

  /**
   * Get number of connected clients
   */
  getClientCount(): number {
    return this.clients.size
  }
}
