import type { WebSocket } from 'ws'
import type { Peer } from 'crossws'

/**
 * WebSocket connection with metadata
 */
export interface WSConnection {
  ws: WebSocket | Peer
  userId: string
  guildId: string
  authenticatedAt: number
}

/**
 * WebSocket registry for managing active connections
 */
class WebSocketManager {
  private connections = new Set<WSConnection>()
  private connectionRefs: Map<WebSocket, WSConnection> = new Map()

  /**
   * Register a new authenticated WebSocket connection
   */
  register(ws: WebSocket, userId: string, guildId: string): WSConnection {
    const connection: WSConnection = {
      ws,
      userId,
      guildId,
      authenticatedAt: Date.now(),
    }

    this.connections.add(connection)
    this.connectionRefs.set(ws, connection)
    console.log(`[WS] Added connection to set. Total: ${this.connections.size}`)

    // Auto-cleanup on close
    ws.on('close', () => {
      console.log(`[WS] Connection closed for user ${userId}. Unregistering.`)
      this.unregister(connection)
      this.connectionRefs.delete(ws)
    })

    return connection
  }

  /**
   * Unregister a WebSocket connection
   */
  unregister(connection: WSConnection): void {
    this.connections.delete(connection)
  }

  /**
   * Register a CrossWS Peer connection
   */
  registerPeer(peer: Peer, userId: string, guildId: string): WSConnection {
    const connection: WSConnection = {
      ws: peer,
      userId,
      guildId,
      authenticatedAt: Date.now(),
    }

    this.connections.add(connection)
    console.log(`[CrossWS] Added connection to set. Total: ${this.connections.size}`)

    return connection
  }

  /**
   * Unregister a CrossWS Peer connection
   */
  unregisterPeer(peer: Peer, userId: string, guildId: string): void {
    const connection = Array.from(this.connections).find(
      (c) => c.ws === peer && c.userId === userId && c.guildId === guildId,
    )
    if (connection) {
      this.unregister(connection)
    }
  }

  /**
   * Broadcast event to all connected clients
   *
   * Implements backpressure handling: closes clients with excessive buffered data
   */
  broadcast(event: string, payload: unknown): void {
    const message = JSON.stringify({
      v: 1,
      type: 'event',
      event,
      payload,
      ts: Date.now(),
    })

    for (const connection of this.connections) {
      try {
        // Check backpressure (close if >1MB buffered)
        if (connection.ws.bufferedAmount > 1024 * 1024) {
          console.warn(
            `[WS] Closing connection for user ${connection.userId} due to backpressure`,
          )
          connection.ws.close(1008, 'Backpressure limit exceeded')
          this.unregister(connection)
          continue
        }

        // Send message
        if (connection.ws.readyState === 1) {
          // OPEN
          connection.ws.send(message)
        }
      } catch (error) {
        console.error(
          `[WS] Failed to send message to user ${connection.userId}:`,
          error,
        )
        // Don't throw - continue broadcasting to other clients
      }
    }
  }

  /**
   * Broadcast event to specific guild only
   */
  broadcastToGuild(guildId: string, event: string, payload: unknown): void {
    const message = JSON.stringify({
      v: 1,
      type: 'event',
      event,
      payload,
      ts: Date.now(),
    })

    console.log(
      `[WS] Broadcasting ${event} to guild ${guildId}. Total connections: ${this.connections.size}`,
    )

    let sentCount = 0
    for (const connection of this.connections) {
      if (connection.guildId !== guildId) {
        continue
      }

      console.log(
        `[WS] Found connection for user ${connection.userId} in guild ${guildId}. Ready state: ${connection.ws.readyState}`,
      )

      try {
        // Check backpressure
        if (connection.ws.bufferedAmount > 1024 * 1024) {
          console.warn(
            `[WS] Closing connection for user ${connection.userId} due to backpressure`,
          )
          connection.ws.close(1008, 'Backpressure limit exceeded')
          this.unregister(connection)
          continue
        }

        // Send message
        if (connection.ws.readyState === 1) {
          // OPEN
          connection.ws.send(message)
          sentCount++
          console.log(
            `[WS] Sent ${event} to user ${connection.userId}`,
          )
        }
      } catch (error) {
        console.error(
          `[WS] Failed to send message to user ${connection.userId}:`,
          error,
        )
      }
    }

    console.log(
      `[WS] Broadcast complete: sent ${event} to ${sentCount} connections`,
    )
  }

  /**
   * Get count of active connections
   */
  getConnectionCount(): number {
    return this.connections.size
  }

  /**
   * Get count of connections for specific guild
   */
  getGuildConnectionCount(guildId: string): number {
    let count = 0
    for (const connection of this.connections) {
      if (connection.guildId === guildId) {
        count++
      }
    }
    return count
  }
}

// Singleton instance
export const wsManager = new WebSocketManager()
