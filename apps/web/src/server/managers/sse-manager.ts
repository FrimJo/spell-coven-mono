/**
 * SSE (Server-Sent Events) Manager
 *
 * Manages active SSE connections and broadcasts events to clients
 */

import type {
  APIVoiceState,
  GatewayDispatchEvents,
} from '@repo/discord-integration/types'

export interface SSEConnection {
  userId: string
  guildId: string
  controller: ReadableStreamDefaultController<Uint8Array>
  createdAt: number
}

/**
 * Voice state cache: channelId -> Map<userId, APIVoiceState>
 */
class VoiceStateCache {
  private cache = new Map<string, Map<string, APIVoiceState>>()

  /**
   * Update voice state for a user
   */
  update(voiceState: APIVoiceState): void {
    if (!voiceState.channel_id) {
      // User left - remove from all channels
      for (const [channelId, users] of this.cache.entries()) {
        users.delete(voiceState.user_id)
        if (users.size === 0) {
          this.cache.delete(channelId)
        }
      }
      return
    }

    // User joined or updated - add/update in channel
    if (!this.cache.has(voiceState.channel_id)) {
      this.cache.set(voiceState.channel_id, new Map())
    }
    const channelUsers = this.cache.get(voiceState.channel_id)!
    channelUsers.set(voiceState.user_id, voiceState)
  }

  /**
   * Get all voice states for a channel
   */
  getChannelStates(channelId: string): APIVoiceState[] {
    const channelUsers = this.cache.get(channelId)
    if (!channelUsers) {
      return []
    }
    return Array.from(channelUsers.values())
  }

  /**
   * Get all channel IDs that have cached voice states
   */
  getAllChannels(): string[] {
    return Array.from(this.cache.keys())
  }

  /**
   * Clear all cached states (for testing/debugging)
   */
  clear(): void {
    this.cache.clear()
  }
}

class SSEManager {
  private connections = new Map<string, SSEConnection>()
  private voiceStateCache = new VoiceStateCache()
  private syncInterval: NodeJS.Timeout | null = null
  private readonly SYNC_INTERVAL_MS = 30000 // 30 seconds

  /**
   * Register a new SSE connection
   */
  register(
    userId: string,
    guildId: string,
    controller: ReadableStreamDefaultController<Uint8Array>,
  ): string {
    const connectionId = `${userId}-${Date.now()}`
    const wasEmpty = this.connections.size === 0
    
    this.connections.set(connectionId, {
      userId,
      guildId,
      controller,
      createdAt: Date.now(),
    })

    console.log(
      `[SSE] Added connection for user ${userId}. Total: ${this.connections.size}`,
    )

    // Broadcast user connected event to all other connections in the guild
    // This allows clients to track who's online/offline
    const connectedUserIds = this.getConnectedUserIdsForGuild(guildId)
    this.broadcastUserConnectionStatus(guildId, Array.from(connectedUserIds))

    // Start periodic sync if not already running
    if (wasEmpty) {
      this.startPeriodicSync()
    }

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
      if (guildId) {
        const connectedUserIds = this.getConnectedUserIdsForGuild(guildId)
        this.broadcastUserConnectionStatus(guildId, Array.from(connectedUserIds))
      }

      // Stop periodic sync if no connections remain
      if (this.connections.size === 0) {
        this.stopPeriodicSync()
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
   * Broadcast Discord Gateway event to specific guild only
   */
  broadcastDiscordEventToGuild(
    guildId: string,
    event: GatewayDispatchEvents,
    payload: unknown,
  ): void {
    // Track voice states for caching
    if (event === 'VOICE_STATE_UPDATE') {
      const voiceState = payload as APIVoiceState
      this.voiceStateCache.update(voiceState)
      console.log(
        `[SSE] Updated voice state cache: user ${voiceState.user_id} in channel ${voiceState.channel_id}`,
      )
    }

    const message = `data: ${JSON.stringify({
      v: 1,
      type: 'discord.event',
      event,
      payload,
      ts: Date.now(),
    })}\n\n`

    console.log(
      `[SSE] Broadcasting Discord event ${event} to guild ${guildId}. Total connections: ${this.connections.size}`,
    )

    this.sendToGuild(guildId, message)
  }

  /**
   * Broadcast current voice states for a channel to all connections in the guild
   * Called when a user connects to voice channel to sync initial state
   * This ensures all clients see existing members when someone new joins
   */
  broadcastChannelVoiceStates(guildId: string, channelId: string): void {
    const voiceStates = this.voiceStateCache.getChannelStates(channelId)
    if (voiceStates.length === 0) {
      return
    }

    console.log(
      `[SSE] Broadcasting ${voiceStates.length} voice states for channel ${channelId} to guild ${guildId}`,
    )

    // Send each voice state as a separate event so clients can process them
    // This syncs all existing members when someone new connects
    for (const voiceState of voiceStates) {
      const message = `data: ${JSON.stringify({
        v: 1,
        type: 'discord.event',
        event: 'VOICE_STATE_UPDATE',
        payload: voiceState,
        ts: Date.now(),
      })}\n\n`

      this.sendToGuild(guildId, message)
    }
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
   * Broadcast user connection status (online/offline) to all connections in a guild
   * This allows clients to track which users are connected to the backend
   */
  private broadcastUserConnectionStatus(
    guildId: string,
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

    this.sendToGuild(guildId, message)
    
    console.log(
      `[SSE] Broadcasted connection status: ${connectedUserIds.length} users online in guild ${guildId}`,
    )
  }

  /**
   * Start periodic sync of voice states to prevent drift
   * Broadcasts cached voice states for all active channels every SYNC_INTERVAL_MS
   */
  private startPeriodicSync(): void {
    if (this.syncInterval) {
      return // Already running
    }

    console.log(
      `[SSE] Starting periodic voice state sync (every ${this.SYNC_INTERVAL_MS}ms)`,
    )

    this.syncInterval = setInterval(() => {
      this.syncAllVoiceStates()
    }, this.SYNC_INTERVAL_MS)
  }

  /**
   * Stop periodic sync
   */
  private stopPeriodicSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval)
      this.syncInterval = null
      console.log('[SSE] Stopped periodic voice state sync')
    }
  }

  /**
   * Sync all voice states for all active channels
   * Broadcasts cached states to prevent drift from missed events
   */
  private syncAllVoiceStates(): void {
    if (this.connections.size === 0) {
      return
    }

    // Get all unique guild IDs from active connections
    const guildIds = new Set<string>()
    for (const connection of this.connections.values()) {
      guildIds.add(connection.guildId)
    }

    // Get all channels with cached voice states
    const channelsWithStates = this.voiceStateCache.getAllChannels()

    if (channelsWithStates.length === 0) {
      return
    }

    console.log(
      `[SSE] Periodic sync: broadcasting voice states for ${channelsWithStates.length} channels`,
    )

    // Broadcast voice states for each channel to its guild
    for (const channelId of channelsWithStates) {
      const voiceStates = this.voiceStateCache.getChannelStates(channelId)
      if (voiceStates.length === 0) {
        continue
      }

      // Find which guild this channel belongs to
      // We'll broadcast to all guilds since we don't track channel->guild mapping
      // This is safe because clients filter by channelId
      for (const guildId of guildIds) {
        for (const voiceState of voiceStates) {
          const message = `data: ${JSON.stringify({
            v: 1,
            type: 'discord.event',
            event: 'VOICE_STATE_UPDATE',
            payload: voiceState,
            ts: Date.now(),
            sync: true, // Flag to indicate this is a sync event
          })}\n\n`

          this.sendToGuild(guildId, message)
        }
      }
    }
  }
}

// Singleton instance
export const sseManager = new SSEManager()
