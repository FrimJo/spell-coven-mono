/**
 * SSE (Server-Sent Events) Manager
 *
 * Manages active SSE connections and broadcasts events to clients
 */

export interface SSEConnection {
  userId: string
  guildId: string
  controller: ReadableStreamDefaultController<Uint8Array>
  createdAt: number
}

class SSEManager {
  private connections = new Map<string, SSEConnection>()

  /**
   * Register a new SSE connection
   */
  register(
    userId: string,
    guildId: string,
    controller: ReadableStreamDefaultController<Uint8Array>,
  ): string {
    const connectionId = `${userId}-${Date.now()}`
    this.connections.set(connectionId, {
      userId,
      guildId,
      controller,
      createdAt: Date.now(),
    })

    console.log(
      `[SSE] Added connection for user ${userId}. Total: ${this.connections.size}`,
    )

    return connectionId
  }

  /**
   * Unregister an SSE connection
   */
  unregister(connectionId: string): void {
    if (this.connections.has(connectionId)) {
      const connection = this.connections.get(connectionId)
      console.log(`[SSE] Removing connection for user ${connection?.userId}`)
      this.connections.delete(connectionId)
    }
  }

  /**
   * Broadcast event to all connected clients
   */
  broadcast(event: string, payload: unknown): void {
    const message = `data: ${JSON.stringify({
      v: 1,
      type: 'event',
      event,
      payload,
      ts: Date.now(),
    })}\n\n`

    let sentCount = 0
    const failedConnections: string[] = []

    for (const [connectionId, connection] of this.connections) {
      try {
        const encoder = new TextEncoder()
        connection.controller.enqueue(encoder.encode(message))
        sentCount++
      } catch (error) {
        console.error(
          `[SSE] Failed to send message to user ${connection.userId}:`,
          error instanceof Error ? error.message : String(error),
        )
        failedConnections.push(connectionId)
      }
    }

    // Clean up failed connections
    for (const connectionId of failedConnections) {
      console.log(`[SSE] Removing failed connection: ${connectionId}`)
      this.connections.delete(connectionId)
    }

    console.log(
      `[SSE] Broadcast complete: sent ${event} to ${sentCount} connections`,
    )
  }

  /**
   * Broadcast event to specific guild only
   */
  broadcastToGuild(guildId: string, event: string, payload: unknown): void {
    const message = `data: ${JSON.stringify({
      v: 1,
      type: 'event',
      event,
      payload,
      ts: Date.now(),
    })}\n\n`

    console.log(
      `[SSE] Broadcasting ${event} to guild ${guildId}. Total connections: ${this.connections.size}`,
    )

    let sentCount = 0
    const failedConnections: string[] = []

    for (const [connectionId, connection] of this.connections) {
      if (connection.guildId !== guildId) {
        continue
      }

      try {
        const encoder = new TextEncoder()
        connection.controller.enqueue(encoder.encode(message))
        sentCount++
        console.log(`[SSE] Sent ${event} to user ${connection.userId}`)
      } catch (error) {
        console.error(
          `[SSE] Failed to send message to user ${connection.userId}:`,
          error instanceof Error ? error.message : String(error),
        )
        failedConnections.push(connectionId)
      }
    }

    // Clean up failed connections
    for (const connectionId of failedConnections) {
      console.log(`[SSE] Removing failed connection: ${connectionId}`)
      this.connections.delete(connectionId)
    }

    console.log(
      `[SSE] Broadcast complete: sent ${event} to ${sentCount} connections`,
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
    for (const connection of this.connections.values()) {
      if (connection.guildId === guildId) {
        count++
      }
    }
    return count
  }
}

// Singleton instance
export const sseManager = new SSEManager()
