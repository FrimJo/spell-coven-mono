/**
 * Game Room Server Functions
 *
 * Handles game room participant tracking independent of Discord.
 * Uses in-memory state (can be upgraded to Redis/DB later).
 */

import { gameRoomManager } from '@/server/managers/gameroom-manager'
import { createServerFn } from '@tanstack/react-start'

/**
 * Join a game room and get current participants
 */
export const joinGameRoom = createServerFn({ method: 'POST' })
  .inputValidator(
    (data: {
      roomId: string
      userId: string
      username: string
      avatar?: string | null
    }) => data,
  )
  .handler(async ({ data }) => {
    const { roomId, userId, username, avatar } = data

    console.log(
      `[joinGameRoom] User ${username} (${userId}) joining room ${roomId}`,
    )

    try {
      // Join the room and get current participants
      const participants = gameRoomManager.joinRoom(
        roomId,
        userId,
        username,
        avatar,
      )

      console.log(
        `[joinGameRoom] Success! Room ${roomId} now has ${participants.length} participants`,
      )

      return {
        success: true,
        participants,
      }
    } catch (error) {
      console.error('[joinGameRoom] Error:', error)
      throw error
    }
  })

/**
 * Leave a game room
 */
export const leaveGameRoom = createServerFn({ method: 'POST' })
  .inputValidator((data: { roomId: string; userId: string }) => data)
  .handler(async ({ data }) => {
    const { roomId, userId } = data

    console.log(`[leaveGameRoom] User ${userId} leaving room ${roomId}`)

    try {
      gameRoomManager.leaveRoom(roomId, userId)

      console.log(`[leaveGameRoom] Success! User ${userId} left room ${roomId}`)

      return {
        success: true,
      }
    } catch (error) {
      console.error('[leaveGameRoom] Error:', error)
      throw error
    }
  })

/**
 * Get current participants in a game room
 */
export const getGameRoomParticipants = createServerFn({ method: 'GET' })
  .inputValidator((data: { roomId: string }) => data)
  .handler(async ({ data }) => {
    const { roomId } = data

    try {
      const participants = gameRoomManager.getParticipants(roomId)

      return {
        participants,
      }
    } catch (error) {
      console.error('[getGameRoomParticipants] Error:', error)
      throw error
    }
  })
