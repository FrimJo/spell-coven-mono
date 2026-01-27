/**
 * Room Mutations & Queries
 *
 * Handles room creation, state management, and ownership.
 *
 * NOTE: These mutations currently accept userId/callerId as parameters for Phase 3.
 * In Phase 5 (auth migration), we'll use getAuthUserId for proper authorization.
 */

import { getAuthUserId } from '@convex-dev/auth/server'
import { v } from 'convex/values'

import { mutation, query } from './_generated/server'
import { DEFAULT_HEALTH } from './constants'

/**
 * Default starting health for Commander format
 * @internal Reserved for Phase 4 game logic
 */
const _DEFAULT_HEALTH = DEFAULT_HEALTH

/**
 * Presence timeout threshold in milliseconds (30 seconds)
 */
const PRESENCE_THRESHOLD_MS = 30_000

/**
 * Generate a short room code (6 uppercase alphanumeric characters)
 */
function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // Removed confusing chars: 0, O, 1, I
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

/**
 * Create a new room
 *
 * Creates the room, initial room state, and adds the creator as the first player.
 *
 * NOTE: ownerId is passed as parameter for Phase 3. Phase 5 will use getAuthUserId.
 *
 * @param ownerId - The user ID of the room creator
 * @param roomId - Optional custom room ID (e.g., 'game-ABC123'). If not provided, one is generated.
 */
export const createRoom = mutation({
  args: {
    ownerId: v.string(), // Discord user ID, will use Convex Auth in Phase 5
    roomId: v.optional(v.string()), // Optional custom room ID
  },
  handler: async (ctx, { ownerId, roomId: customRoomId }) => {
    const userId = ownerId
    if (!userId) {
      throw new Error('ownerId is required')
    }

    let roomId: string

    if (customRoomId) {
      // Use custom room ID - verify it doesn't already exist
      const existing = await ctx.db
        .query('rooms')
        .withIndex('by_roomId', (q) => q.eq('roomId', customRoomId))
        .first()

      if (existing) {
        throw new Error('Room already exists')
      }

      roomId = customRoomId
    } else {
      // Generate unique room code with game- prefix
      let attempts = 0
      do {
        roomId = `game-${generateRoomCode()}`
        const existing = await ctx.db
          .query('rooms')
          .withIndex('by_roomId', (q) => q.eq('roomId', roomId))
          .first()
        if (!existing) break
        attempts++
      } while (attempts < 10)

      if (attempts >= 10) {
        throw new Error('Failed to generate unique room code')
      }
    }

    const now = Date.now()

    // Create room
    await ctx.db.insert('rooms', {
      roomId,
      ownerId: userId,
      status: 'waiting',
      createdAt: now,
    })

    // Create initial room state
    await ctx.db.insert('roomState', {
      roomId,
      currentTurnUserId: userId,
      turnNumber: 1,
      lastUpdatedAt: now,
    })

    return { roomId }
  },
})

/**
 * Get a room by its short code
 */
export const getRoom = query({
  args: { roomId: v.string() },
  handler: async (ctx, { roomId }) => {
    const room = await ctx.db
      .query('rooms')
      .withIndex('by_roomId', (q) => q.eq('roomId', roomId))
      .first()

    if (!room) {
      return null
    }

    const state = await ctx.db
      .query('roomState')
      .withIndex('by_roomId', (q) => q.eq('roomId', roomId))
      .first()

    return {
      ...room,
      state,
    }
  },
})

/**
 * Check if a user can access a room
 *
 * Returns the access status:
 * - 'ok': Room exists and user is not banned
 * - 'not_found': Room does not exist
 * - 'banned': User is banned from this room
 *
 * @param roomId - The room ID to check
 *
 * Uses the authenticated user's ID from the Convex auth context to check for bans.
 */
export const checkRoomAccess = query({
  args: {
    roomId: v.string(),
  },
  handler: async (ctx, { roomId }) => {
    // Check if room exists
    const room = await ctx.db
      .query('rooms')
      .withIndex('by_roomId', (q) => q.eq('roomId', roomId))
      .first()

    if (!room) {
      return { status: 'not_found' as const }
    }

    // Get current user ID from auth context
    const userId = await getAuthUserId(ctx)

    // If user is authenticated, check if they're banned
    if (userId) {
      const ban = await ctx.db
        .query('roomBans')
        .withIndex('by_roomId_userId', (q) =>
          q.eq('roomId', roomId).eq('userId', userId),
        )
        .first()

      if (ban) {
        return { status: 'banned' as const }
      }
    }

    return { status: 'ok' as const }
  },
})

/**
 * Update room status
 *
 * NOTE: callerId is used for Phase 3. Phase 5 will use getAuthUserId.
 */
export const updateRoomStatus = mutation({
  args: {
    roomId: v.string(),
    status: v.union(
      v.literal('waiting'),
      v.literal('playing'),
      v.literal('finished'),
    ),
    callerId: v.optional(v.string()),
  },
  handler: async (ctx, { roomId, status, callerId }) => {
    const room = await ctx.db
      .query('rooms')
      .withIndex('by_roomId', (q) => q.eq('roomId', roomId))
      .first()

    if (!room) {
      throw new Error('Room not found')
    }

    if (callerId && room.ownerId !== callerId) {
      throw new Error('Only the room owner can change room status')
    }

    await ctx.db.patch(room._id, { status })
  },
})

/**
 * Get live activity stats for the landing page
 *
 * Counts unique active users and rooms with active players.
 */
export const getLiveStats = query({
  args: {},
  handler: async (ctx) => {
    const presenceThreshold = Date.now() - PRESENCE_THRESHOLD_MS

    const activePlayers = await ctx.db
      .query('roomPlayers')
      .filter((q) =>
        q.and(
          q.neq(q.field('status'), 'left'),
          q.gt(q.field('lastSeenAt'), presenceThreshold),
        ),
      )
      .collect()

    const uniqueUsers = new Set<string>()
    const activeRooms = new Set<string>()

    for (const player of activePlayers) {
      uniqueUsers.add(player.userId)
      activeRooms.add(player.roomId)
    }

    return {
      onlineUsers: uniqueUsers.size,
      activeRooms: activeRooms.size,
      asOf: Date.now(),
    }
  },
})

/**
 * Set the current turn to a specific player
 *
 * NOTE: callerId is used for Phase 3. Phase 5 will use getAuthUserId.
 */
export const setTurn = mutation({
  args: {
    roomId: v.string(),
    userId: v.string(),
    callerId: v.optional(v.string()),
  },
  handler: async (ctx, { roomId, userId, callerId }) => {
    const room = await ctx.db
      .query('rooms')
      .withIndex('by_roomId', (q) => q.eq('roomId', roomId))
      .first()

    if (!room) {
      throw new Error('Room not found')
    }

    // Only owner can set turn arbitrarily
    if (callerId && room.ownerId !== callerId) {
      throw new Error('Only the room owner can set turn')
    }

    const state = await ctx.db
      .query('roomState')
      .withIndex('by_roomId', (q) => q.eq('roomId', roomId))
      .first()

    if (!state) {
      throw new Error('Room state not found')
    }

    await ctx.db.patch(state._id, {
      currentTurnUserId: userId,
      lastUpdatedAt: Date.now(),
    })
  },
})

/**
 * Advance turn to the next player
 *
 * Cycles through active players in join order.
 *
 * NOTE: callerId is used for Phase 3. Phase 5 will use getAuthUserId.
 */
export const advanceTurn = mutation({
  args: {
    roomId: v.string(),
    callerId: v.optional(v.string()),
  },
  handler: async (ctx, { roomId, callerId }) => {
    const state = await ctx.db
      .query('roomState')
      .withIndex('by_roomId', (q) => q.eq('roomId', roomId))
      .first()

    if (!state) {
      throw new Error('Room state not found')
    }

    // Only current turn player can advance
    if (callerId && state.currentTurnUserId !== callerId) {
      throw new Error('Only the current turn player can advance turn')
    }

    // Get active players sorted by join time
    const presenceThreshold = Date.now() - 30_000 // 30s
    const players = await ctx.db
      .query('roomPlayers')
      .withIndex('by_roomId', (q) => q.eq('roomId', roomId))
      .filter((q) =>
        q.and(
          q.eq(q.field('status'), 'active'),
          q.gt(q.field('lastSeenAt'), presenceThreshold),
        ),
      )
      .collect()

    // Sort by joinedAt to get consistent order
    players.sort((a, b) => a.joinedAt - b.joinedAt)

    // Deduplicate by userId (keep first session per user)
    const uniquePlayers = players.filter(
      (p, i, arr) => arr.findIndex((x) => x.userId === p.userId) === i,
    )

    if (uniquePlayers.length === 0) {
      throw new Error('No active players in room')
    }

    // Find current player index and advance
    const currentIndex = uniquePlayers.findIndex(
      (p) => p.userId === state.currentTurnUserId,
    )
    const nextIndex =
      currentIndex === -1 ? 0 : (currentIndex + 1) % uniquePlayers.length
    const nextPlayer = uniquePlayers[nextIndex]

    if (!nextPlayer) {
      throw new Error('Failed to determine next player')
    }

    await ctx.db.patch(state._id, {
      currentTurnUserId: nextPlayer.userId,
      turnNumber: state.turnNumber + 1,
      lastUpdatedAt: Date.now(),
    })
  },
})

/**
 * Update a player's health
 *
 * NOTE: No auth check for Phase 3. Phase 5 will add proper authorization.
 */
export const updatePlayerHealth = mutation({
  args: {
    roomId: v.string(),
    userId: v.string(),
    delta: v.number(),
  },
  handler: async (ctx, { roomId, userId, delta }) => {
    // Find player record (any active session for this user)
    const player = await ctx.db
      .query('roomPlayers')
      .withIndex('by_roomId_userId', (q) =>
        q.eq('roomId', roomId).eq('userId', userId),
      )
      .first()

    if (!player) {
      throw new Error('Player not found in room')
    }

    // Update health for all sessions of this user
    const allSessions = await ctx.db
      .query('roomPlayers')
      .withIndex('by_roomId_userId', (q) =>
        q.eq('roomId', roomId).eq('userId', userId),
      )
      .collect()

    for (const session of allSessions) {
      await ctx.db.patch(session._id, {
        health: player.health + delta,
      })
    }
  },
})

/**
 * Update a player's poison counters
 *
 * NOTE: No auth check for Phase 3. Phase 5 will add proper authorization.
 */
export const updatePlayerPoison = mutation({
  args: {
    roomId: v.string(),
    userId: v.string(),
    delta: v.number(),
  },
  handler: async (ctx, { roomId, userId, delta }) => {
    const player = await ctx.db
      .query('roomPlayers')
      .withIndex('by_roomId_userId', (q) =>
        q.eq('roomId', roomId).eq('userId', userId),
      )
      .first()

    if (!player) {
      throw new Error('Player not found in room')
    }

    const currentPoison = player.poison ?? 0

    const allSessions = await ctx.db
      .query('roomPlayers')
      .withIndex('by_roomId_userId', (q) =>
        q.eq('roomId', roomId).eq('userId', userId),
      )
      .collect()

    for (const session of allSessions) {
      await ctx.db.patch(session._id, {
        poison: currentPoison + delta,
      })
    }
  },
})

/**
 * Set a player's commander list
 *
 * NOTE: No auth check for Phase 3. Phase 5 will add proper authorization.
 */
export const setPlayerCommanders = mutation({
  args: {
    roomId: v.string(),
    userId: v.string(),
    commanders: v.array(
      v.object({
        id: v.string(),
        name: v.string(),
      }),
    ),
  },
  handler: async (ctx, { roomId, userId, commanders }) => {
    const player = await ctx.db
      .query('roomPlayers')
      .withIndex('by_roomId_userId', (q) =>
        q.eq('roomId', roomId).eq('userId', userId),
      )
      .first()

    if (!player) {
      throw new Error('Player not found in room')
    }

    const allSessions = await ctx.db
      .query('roomPlayers')
      .withIndex('by_roomId_userId', (q) =>
        q.eq('roomId', roomId).eq('userId', userId),
      )
      .collect()

    for (const session of allSessions) {
      await ctx.db.patch(session._id, {
        commanders,
      })
    }
  },
})

/**
 * Update commander damage for a player
 *
 * NOTE: No auth check for Phase 3. Phase 5 will add proper authorization.
 */
export const updateCommanderDamage = mutation({
  args: {
    roomId: v.string(),
    userId: v.string(),
    ownerUserId: v.string(),
    commanderId: v.string(),
    delta: v.number(),
  },
  handler: async (ctx, { roomId, userId, ownerUserId, commanderId, delta }) => {
    const player = await ctx.db
      .query('roomPlayers')
      .withIndex('by_roomId_userId', (q) =>
        q.eq('roomId', roomId).eq('userId', userId),
      )
      .first()

    if (!player) {
      throw new Error('Player not found in room')
    }

    const key = `${ownerUserId}:${commanderId}`
    const currentDamage = player.commanderDamage?.[key] ?? 0
    const nextDamage = currentDamage + delta
    const nextHealth = player.health - delta

    const allSessions = await ctx.db
      .query('roomPlayers')
      .withIndex('by_roomId_userId', (q) =>
        q.eq('roomId', roomId).eq('userId', userId),
      )
      .collect()

    for (const session of allSessions) {
      await ctx.db.patch(session._id, {
        health: nextHealth,
        commanderDamage: {
          ...(session.commanderDamage ?? {}),
          [key]: nextDamage,
        },
      })
    }
  },
})
