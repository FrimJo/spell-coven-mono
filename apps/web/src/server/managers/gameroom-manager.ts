/**
 * GameRoomManager - Track active game room participants
 *
 * This is INDEPENDENT of Discord voice channels.
 * Tracks who's currently viewing the game room web page.
 *
 * Participants are stored in memory (could be moved to Redis/DB later).
 */

export interface GameRoomParticipant {
  id: string // User ID
  username: string
  avatar?: string | null
  joinedAt: number // Timestamp
}

interface GameRoomState {
  roomId: string
  participants: Map<string, GameRoomParticipant>
}

class GameRoomManager {
  private rooms: Map<string, GameRoomState> = new Map()
  private sseConnections: Map<
    string,
    {
      roomId: string
      userId: string
      controller: ReadableStreamDefaultController<Uint8Array>
    }
  > = new Map()

  /**
   * Add a participant to a room
   */
  joinRoom(
    roomId: string,
    userId: string,
    username: string,
    avatar?: string | null,
  ): GameRoomParticipant[] {
    // Get or create room state
    let room = this.rooms.get(roomId)
    if (!room) {
      room = {
        roomId,
        participants: new Map(),
      }
      this.rooms.set(roomId, room)
    }

    // Add participant if not already in room
    if (!room.participants.has(userId)) {
      const participant: GameRoomParticipant = {
        id: userId,
        username,
        avatar,
        joinedAt: Date.now(),
      }
      room.participants.set(userId, participant)

      console.log(
        `[GameRoomManager] User ${username} (${userId}) joined room ${roomId}. Total participants: ${room.participants.size}`,
      )

      // Broadcast to other participants
      this.broadcastToRoom(roomId, 'gameroom.joined', {
        roomId,
        userId,
        username,
        avatar,
        timestamp: participant.joinedAt,
      })
    }

    // Return current participants
    return Array.from(room.participants.values())
  }

  /**
   * Remove a participant from a room
   */
  leaveRoom(roomId: string, userId: string): void {
    const room = this.rooms.get(roomId)
    if (!room) {
      return
    }

    const participant = room.participants.get(userId)
    if (participant) {
      room.participants.delete(userId)

      console.log(
        `[GameRoomManager] User ${participant.username} (${userId}) left room ${roomId}. Remaining participants: ${room.participants.size}`,
      )

      // Broadcast to remaining participants
      this.broadcastToRoom(roomId, 'gameroom.left', {
        roomId,
        userId,
        timestamp: Date.now(),
      })

      // Clean up empty rooms
      if (room.participants.size === 0) {
        console.log(
          `[GameRoomManager] Room ${roomId} is now empty, cleaning up`,
        )
        this.rooms.delete(roomId)
      }
    }
  }

  /**
   * Get current participants in a room
   */
  getParticipants(roomId: string): GameRoomParticipant[] {
    const room = this.rooms.get(roomId)
    return room ? Array.from(room.participants.values()) : []
  }

  /**
   * Register an SSE connection for a room
   */
  registerSSE(
    roomId: string,
    userId: string,
    controller: ReadableStreamDefaultController<Uint8Array>,
  ): string {
    const connectionId = `${roomId}-${userId}-${Date.now()}`
    this.sseConnections.set(connectionId, { roomId, userId, controller })

    console.log(
      `[GameRoomManager] Registered SSE connection ${connectionId} for user ${userId} in room ${roomId}`,
    )

    return connectionId
  }

  /**
   * Unregister an SSE connection
   */
  unregisterSSE(connectionId: string): void {
    const connection = this.sseConnections.get(connectionId)
    if (connection) {
      this.sseConnections.delete(connectionId)
      console.log(
        `[GameRoomManager] Unregistered SSE connection ${connectionId}`,
      )

      // Automatically remove user from room when SSE disconnects
      this.leaveRoom(connection.roomId, connection.userId)
    }
  }

  /**
   * Broadcast an event to all participants in a room
   */
  private broadcastToRoom(
    roomId: string,
    event: string,
    payload: unknown,
  ): void {
    const message = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`
    const encoder = new TextEncoder()
    const encoded = encoder.encode(message)

    let sentCount = 0
    const failedConnections: string[] = []

    for (const [connectionId, connection] of this.sseConnections) {
      if (connection.roomId === roomId) {
        try {
          connection.controller.enqueue(encoded)
          sentCount++
        } catch (error) {
          console.error(
            `[GameRoomManager] Failed to send to connection ${connectionId}:`,
            error instanceof Error ? error.message : String(error),
          )
          failedConnections.push(connectionId)
        }
      }
    }

    // Clean up failed connections
    for (const connectionId of failedConnections) {
      this.unregisterSSE(connectionId)
    }

    if (sentCount > 0) {
      console.log(
        `[GameRoomManager] Broadcasted ${event} to ${sentCount} connections in room ${roomId}`,
      )
    }
  }

  /**
   * Get total number of rooms
   */
  getRoomCount(): number {
    return this.rooms.size
  }

  /**
   * Get total number of SSE connections
   */
  getConnectionCount(): number {
    return this.sseConnections.size
  }
}

// Singleton instance
export const gameRoomManager = new GameRoomManager()
