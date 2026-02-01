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

import { internal } from './_generated/api'
import { internalMutation, mutation, query } from './_generated/server'
import {
  AuthMismatchError,
  AuthRequiredError,
  NotRoomOwnerError,
  PlayerNotFoundError,
  RoomNotFoundError,
} from './errors'

/**
 * Presence timeout threshold in milliseconds (30 seconds)
 */
const PRESENCE_THRESHOLD_MS = 30_000

/**
 * Room creation throttle (minimum time between room creations)
 */
const ROOM_CREATION_COOLDOWN_MS = 10_000

/**
 * Base-32 character set (excludes confusing chars: 0, O, 1, I)
 */
const BASE32_CHARS = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'

/**
 * Scramble a sequential number to produce a pseudo-random looking value.
 * Uses a Linear Congruential Generator (LCG) for deterministic, collision-free mapping.
 *
 * @param n - Sequential counter value (0, 1, 2, ...)
 * @returns Scrambled number in range [0, 32^6)
 */
function scrambleId(n: number): number {
  const MAX = 32 ** 6 // 1,073,741,824 - max value for 6-digit base-32
  const MULTIPLIER = 1103515245 // LCG multiplier (odd, coprime with 2^30)
  const INCREMENT = 12345 // Offset to avoid 0 → 0

  return (((n * MULTIPLIER + INCREMENT) % MAX) + MAX) % MAX
}

/**
 * Convert a number to base-32 code with minimum length padding
 *
 * @param num - The number to convert (0-indexed, so room #1 uses value 0)
 * @param minLength - Minimum length of the resulting code (default: 6)
 * @returns Base-32 encoded string padded to minLength
 *
 * @example
 * toBase32Code(0) // "K3FVMR" (scrambled)
 * toBase32Code(1) // "5PVS8H" (scrambled)
 * toBase32Code(2) // "RBL5U7" (scrambled)
 */
function toBase32Code(num: number, minLength = 6): string {
  // Scramble the sequential number to look random
  let scrambled = scrambleId(num)

  if (scrambled === 0) {
    return BASE32_CHARS[0]!.repeat(minLength)
  }

  let result = ''
  while (scrambled > 0) {
    result = BASE32_CHARS[scrambled % 32]! + result
    scrambled = Math.floor(scrambled / 32)
  }

  return result.padStart(minLength, BASE32_CHARS[0]!)
}

/**
 * Create a new room
 *
 * Creates the room and adds the creator as the first player.
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

    return {
      ...room,
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
 * Check all rooms with active players for owner presence timeout and transfer if needed.
 *
 * This is called by a cron job to handle cases where the owner disconnects
 * (stops sending heartbeats) without explicitly leaving.
 */
export const checkAllRoomOwners = internalMutation({
  args: {},
  handler: async (ctx) => {
    const presenceThreshold = Date.now() - PRESENCE_THRESHOLD_MS

    // Get all rooms that have at least one active player
    const activePlayers = await ctx.db
      .query('roomPlayers')
      .filter((q) =>
        q.and(
          q.neq(q.field('status'), 'left'),
          q.gt(q.field('lastSeenAt'), presenceThreshold),
        ),
      )
      .collect()

    // Get unique room IDs
    const activeRoomIds = new Set<string>()
    for (const player of activePlayers) {
      activeRoomIds.add(player.roomId)
    }

    // Check each active room for owner transfer
    const results: Array<{
      roomId: string
      transferred: boolean
      newOwnerId?: string
    }> = []

    for (const roomId of activeRoomIds) {
      const result = await ctx.runMutation(
        internal.rooms.transferOwnerIfNeeded,
        { roomId },
      )
      if (result.transferred) {
        results.push({
          roomId,
          transferred: true,
          newOwnerId: result.newOwnerId,
        })
      }
    }

    return { checkedRooms: activeRoomIds.size, transfers: results }
  },
})

/**
 * Transfer room ownership to the next active player if the current owner is inactive.
 *
 * Checks if `room.ownerId` is no longer among active players (filtered by
 * `lastSeenAt > now - PRESENCE_THRESHOLD_MS` and `status !== 'left'`).
 * If so, picks the next owner by ascending `joinedAt` (join order) from active players.
 *
 * This is an internal mutation that can be called from:
 * - `leaveRoom` mutation when owner leaves manually
 * - A scheduled cron job that checks for owner presence timeouts
 *
 * @param roomId - The room ID to check/transfer ownership for
 * @returns Object with `transferred` boolean and optional `newOwnerId`
 */
export const transferOwnerIfNeeded = internalMutation({
  args: {
    roomId: v.string(),
  },
  handler: async (ctx, { roomId }) => {
    const room = await ctx.db
      .query('rooms')
      .withIndex('by_roomId', (q) => q.eq('roomId', roomId))
      .first()

    if (!room) {
      return { transferred: false, reason: 'room_not_found' }
    }

    const now = Date.now()
    const presenceThreshold = now - PRESENCE_THRESHOLD_MS

    // Get all active players (not 'left' and within presence threshold)
    const activePlayers = await ctx.db
      .query('roomPlayers')
      .withIndex('by_roomId', (q) => q.eq('roomId', roomId))
      .filter((q) =>
        q.and(
          q.neq(q.field('status'), 'left'),
          q.gt(q.field('lastSeenAt'), presenceThreshold),
        ),
      )
      .collect()

    // Sort by joinedAt ascending (join order)
    activePlayers.sort((a, b) => a.joinedAt - b.joinedAt)

    // Deduplicate by userId (keep oldest session per user)
    const uniqueActiveUsers = new Map<string, (typeof activePlayers)[number]>()
    for (const player of activePlayers) {
      if (!uniqueActiveUsers.has(player.userId)) {
        uniqueActiveUsers.set(player.userId, player)
      }
    }

    // Check if current owner is still active
    const ownerIsActive = uniqueActiveUsers.has(room.ownerId)

    if (ownerIsActive) {
      return { transferred: false, reason: 'owner_still_active' }
    }

    // No active players remaining
    if (uniqueActiveUsers.size === 0) {
      return { transferred: false, reason: 'no_active_players' }
    }

    // Pick the first active player (by join order) as new owner
    const sortedActiveUsers = Array.from(uniqueActiveUsers.values()).sort(
      (a, b) => a.joinedAt - b.joinedAt,
    )
    const newOwner = sortedActiveUsers[0]!

    // Update room ownership
    await ctx.db.patch(room._id, { ownerId: newOwner.userId })

    return { transferred: true, newOwnerId: newOwner.userId }
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
