/**
 * SSE (Server-Sent Events) Manager
 *
 * Manages active SSE connections and broadcasts events to clients
 */

export interface SSEConnection {
  userId: string
  guildId: string
  channelId: string
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
    channelId: string,
    controller: ReadableStreamDefaultController<Uint8Array>,
  ): string {
    const connectionId = `${userId}-${Date.now()}`

    this.connections.set(connectionId, {
      userId,
      guildId,
      channelId,
      controller,
      createdAt: Date.now(),
    })

    console.log(
      `[SSE] Added connection for user ${userId} in channel ${channelId}. Total: ${this.connections.size}`,
    )

    // Broadcast user connected event to all other connections in the channel
    // This allows clients to track who's online/offline
    const connectedUserIds = this.getConnectedUserIdsForChannel(
      guildId,
      channelId,
    )
    this.broadcastUserConnectionStatus(
      guildId,
      channelId,
      Array.from(connectedUserIds),
    )

    return connectionId
  }

  /**
   * Unregister an SSE connection
   */
  unregister(connectionId: string): void {
    if (this.connections.has(connectionId)) {
      const connection = this.connections.get(connectionId)
      const userId = connection?.userId
      const guildId = connection?.guildId

      console.log(`[SSE] Removing connection for user ${userId}`)
      this.connections.delete(connectionId)

      // Broadcast updated connection status to remaining connections
      if (guildId && connection?.channelId) {
        const connectedUserIds = this.getConnectedUserIdsForChannel(
          guildId,
          connection.channelId,
        )
        this.broadcastUserConnectionStatus(
          guildId,
          connection.channelId,
          Array.from(connectedUserIds),
        )
      }
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
   * Send message to all connections in a guild
   */
  private sendToGuild(guildId: string, message: string): void {
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

    console.log(`[SSE] Broadcast complete: sent to ${sentCount} connections`)
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

  /**
   * Send message to a specific user by userId
   * Used for WebRTC signaling - routes messages to target player
   */
  sendToUser(userId: string, message: string): boolean {
    let sent = false
    const failedConnections: string[] = []

    for (const [connectionId, connection] of this.connections) {
      if (connection.userId !== userId) {
        continue
      }

      try {
        const encoder = new TextEncoder()
        connection.controller.enqueue(encoder.encode(message))
        sent = true
      } catch (error) {
        console.error(
          `[SSE] Failed to send message to user ${userId}:`,
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

    if (sent) {
      console.log(`[SSE] Sent message to user ${userId}`)
    } else {
      console.warn(`[SSE] No active connection found for user ${userId}`)
    }

    return sent
  }

  /**
   * Check if a user has an active connection
   */
  hasUserConnection(userId: string): boolean {
    for (const connection of this.connections.values()) {
      if (connection.userId === userId) {
        return true
      }
    }
    return false
  }

  /**
   * Get all connected user IDs (Discord user IDs)
   * Used to determine which users are online/connected to backend
   */
  getConnectedUserIds(): Set<string> {
    const userIds = new Set<string>()
    for (const connection of this.connections.values()) {
      userIds.add(connection.userId)
    }
    return userIds
  }

  /**
   * Get connected user IDs for a specific guild
   */
  getConnectedUserIdsForGuild(guildId: string): Set<string> {
    const userIds = new Set<string>()
    for (const connection of this.connections.values()) {
      if (connection.guildId === guildId) {
        userIds.add(connection.userId)
      }
    }
    return userIds
  }

  /**
   * Get connected user IDs for a specific channel (room)
   */
  getConnectedUserIdsForChannel(
    guildId: string,
    channelId: string,
  ): Set<string> {
    const userIds = new Set<string>()
    for (const connection of this.connections.values()) {
      if (
        connection.guildId === guildId &&
        connection.channelId === channelId
      ) {
        userIds.add(connection.userId)
      }
    }
    console.log({
      userIds,
      userIdsSize: userIds.size,
      connections: Array.from(this.connections.values()),
      guildId,
      channelId,
    })
    return userIds
  }

  /**
   * Broadcast user connection status (online/offline) to all connections in a channel
   * This allows clients to track which users are connected to the backend
   */
  private broadcastUserConnectionStatus(
    guildId: string,
    channelId: string,
    connectedUserIds: string[],
  ): void {
    const message = `data: ${JSON.stringify({
      v: 1,
      type: 'custom.event',
      event: 'users.connection_status',
      payload: {
        connectedUserIds,
        timestamp: Date.now(),
      },
      ts: Date.now(),
    })}\n\n`

    this.sendToChannel(guildId, channelId, message)

    console.log(
      `[SSE] Broadcasted connection status: ${connectedUserIds.length} users online in channel ${channelId}`,
    )
  }

  /**
   * Send message to all connections in a specific channel
   */
  private sendToChannel(
    guildId: string,
    channelId: string,
    message: string,
  ): void {
    let sentCount = 0
    const failedConnections: string[] = []

    for (const [connectionId, connection] of this.connections) {
      if (
        connection.guildId !== guildId ||
        connection.channelId !== channelId
      ) {
        continue
      }

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
      `[SSE] Broadcast complete: sent to ${sentCount} connections in channel ${channelId}`,
    )
  }
}

// Singleton instance
export const sseManager = new SSEManager()
