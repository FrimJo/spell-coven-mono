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
import {
  AuthMismatchError,
  AuthRequiredError,
  NoActivePlayersError,
  NotCurrentTurnError,
  NotRoomOwnerError,
  PlayerNotFoundError,
  RoomNotFoundError,
  RoomStateNotFoundError,
  TurnAdvanceFailedError,
} from './errors'

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
 * Room creation throttle (minimum time between room creations)
 */
const ROOM_CREATION_COOLDOWN_MS = 5_000

/**
 * Base-32 character set (excludes confusing chars: 0, O, 1, I)
 */
const BASE32_CHARS = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'

/**
 * Convert a number to base-32 code with minimum length padding
 *
 * @param num - The number to convert (0-indexed, so room #1 uses value 0)
 * @param minLength - Minimum length of the resulting code (default: 6)
 * @returns Base-32 encoded string padded to minLength
 *
 * @example
 * toBase32Code(0) // "222222"
 * toBase32Code(9) // "22222B"
 * toBase32Code(99) // "22223B"
 */
function toBase32Code(num: number, minLength = 6): string {
  if (num === 0) {
    return BASE32_CHARS[0].repeat(minLength)
  }

  let result = ''
  while (num > 0) {
    result = BASE32_CHARS[num % 32] + result
    num = Math.floor(num / 32)
  }

  return result.padStart(minLength, BASE32_CHARS[0])
}

/**
 * Create a new room
 *
 * Creates the room, initial room state, and adds the creator as the first player.
 * Room ID is generated server-side.
 *
 * @param ownerId - The user ID of the room creator (must match authenticated user)
 * @returns { roomId, waitMs } - roomId is null if throttled, waitMs indicates retry delay
 */
export const createRoom = mutation({
  args: {
    ownerId: v.string(), // Must match authenticated user ID
  },
  handler: async (ctx, { ownerId }) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) {
      throw new AuthRequiredError()
    }

    if (ownerId !== userId) {
      throw new AuthMismatchError()
    }

    const now = Date.now()

    // Check throttle: find user's most recent room creation
    const lastRoom = await ctx.db
      .query('rooms')
      .withIndex('by_ownerId_createdAt', (q) => q.eq('ownerId', userId))
      .order('desc')
      .first()

    if (lastRoom) {
      const timeSinceLastCreation = now - lastRoom.createdAt
      if (timeSinceLastCreation < ROOM_CREATION_COOLDOWN_MS) {
        const waitMs = ROOM_CREATION_COOLDOWN_MS - timeSinceLastCreation
        return { roomId: null, waitMs }
      }
    }

    // Get or create counter for rooms
    let counter = await ctx.db
      .query('counters')
      .withIndex('by_name', (q) => q.eq('name', 'rooms'))
      .first()

    if (!counter) {
      await ctx.db.insert('counters', { name: 'rooms', count: 0 })
      // Query again to get the full document with _creationTime
      counter = await ctx.db
        .query('counters')
        .withIndex('by_name', (q) => q.eq('name', 'rooms'))
        .first()
      if (!counter) {
        throw new Error('Failed to create counter')
      }
    }

    // Increment counter atomically
    const newCount = counter.count + 1
    await ctx.db.patch(counter._id, { count: newCount })

    // Generate sequential room code (newCount - 1 because we want 0-indexed)
    const roomId = toBase32Code(newCount - 1)

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

    return { roomId, waitMs: null }
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
      throw new RoomNotFoundError()
    }

    if (callerId && room.ownerId !== callerId) {
      throw new NotRoomOwnerError('change room status')
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
      throw new RoomNotFoundError()
    }

    // Only owner can set turn arbitrarily
    if (callerId && room.ownerId !== callerId) {
      throw new NotRoomOwnerError('set turn')
    }

    const state = await ctx.db
      .query('roomState')
      .withIndex('by_roomId', (q) => q.eq('roomId', roomId))
      .first()

    if (!state) {
      throw new RoomStateNotFoundError()
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
      throw new RoomStateNotFoundError()
    }

    // Only current turn player can advance
    if (callerId && state.currentTurnUserId !== callerId) {
      throw new NotCurrentTurnError()
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
      throw new NoActivePlayersError()
    }

    // Find current player index and advance
    const currentIndex = uniquePlayers.findIndex(
      (p) => p.userId === state.currentTurnUserId,
    )
    const nextIndex =
      currentIndex === -1 ? 0 : (currentIndex + 1) % uniquePlayers.length
    const nextPlayer = uniquePlayers[nextIndex]

    if (!nextPlayer) {
      throw new TurnAdvanceFailedError()
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
      throw new PlayerNotFoundError()
    }

    // Update health for all sessions of this user
    const allSessions = await ctx.db
      .query('roomPlayers')
      .withIndex('by_roomId_userId', (q) =>
        q.eq('roomId', roomId).eq('userId', userId),
      )
      .collect()

    const nextHealth = Math.max(0, player.health + delta)
    for (const session of allSessions) {
      await ctx.db.patch(session._id, {
        health: nextHealth,
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
      throw new PlayerNotFoundError()
    }

    const currentPoison = player.poison ?? 0
    const nextPoison = Math.max(0, currentPoison + delta)

    const allSessions = await ctx.db
      .query('roomPlayers')
      .withIndex('by_roomId_userId', (q) =>
        q.eq('roomId', roomId).eq('userId', userId),
      )
      .collect()

    for (const session of allSessions) {
      await ctx.db.patch(session._id, {
        poison: nextPoison,
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
      throw new PlayerNotFoundError()
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
      throw new PlayerNotFoundError()
    }

    const key = `${ownerUserId}:${commanderId}`
    const currentDamage = player.commanderDamage?.[key] ?? 0
    const nextDamage = Math.max(0, currentDamage + delta)
    const actualDamageChange = nextDamage - currentDamage
    const nextHealth = player.health - actualDamageChange

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
