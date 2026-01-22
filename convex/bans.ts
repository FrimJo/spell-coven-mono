/**
 * Ban Mutations & Queries
 *
 * Handles banning and kicking players from rooms.
 *
 * NOTE: These mutations currently don't verify caller identity for Phase 3.
 * In Phase 5 (auth migration), we'll use getAuthUserId for proper authorization.
 */

import { v } from 'convex/values'

import { mutation, query } from './_generated/server'

/**
 * Ban a player from a room
 *
 * Only the room owner can ban players.
 * Creates a persistent ban record and marks all player sessions as 'left'.
 *
 * NOTE: Caller identity not verified in Phase 3. Phase 5 will add proper auth.
 */
export const banPlayer = mutation({
  args: {
    roomId: v.string(),
    userId: v.string(),
    reason: v.optional(v.string()),
    callerId: v.optional(v.string()), // For Phase 3, will use auth in Phase 5
  },
  handler: async (ctx, { roomId, userId, reason, callerId }) => {
    // Check room ownership
    const room = await ctx.db
      .query('rooms')
      .withIndex('by_roomId', (q) => q.eq('roomId', roomId))
      .first()

    if (!room) {
      throw new Error('Room not found')
    }

    // Phase 3: Check if caller is owner (when callerId is provided)
    // Phase 5: Use getAuthUserId for proper authorization
    if (callerId && room.ownerId !== callerId) {
      throw new Error('Only the room owner can ban players')
    }

    if (callerId && userId === callerId) {
      throw new Error('Cannot ban yourself')
    }

    // Check if already banned
    const existingBan = await ctx.db
      .query('roomBans')
      .withIndex('by_roomId_userId', (q) =>
        q.eq('roomId', roomId).eq('userId', userId),
      )
      .first()

    const bannedBy = callerId ?? room.ownerId

    if (existingBan) {
      // Already banned, just update
      await ctx.db.patch(existingBan._id, {
        reason: reason ?? 'Banned by room owner',
        bannedBy,
        createdAt: Date.now(),
      })
    } else {
      // Create ban record
      await ctx.db.insert('roomBans', {
        roomId,
        userId,
        bannedBy,
        reason: reason ?? 'Banned by room owner',
        createdAt: Date.now(),
      })
    }

    // Mark all player sessions as 'left'
    const playerSessions = await ctx.db
      .query('roomPlayers')
      .withIndex('by_roomId_userId', (q) =>
        q.eq('roomId', roomId).eq('userId', userId),
      )
      .collect()

    for (const session of playerSessions) {
      await ctx.db.patch(session._id, { status: 'left' })
    }
  },
})

/**
 * Kick a player from a room (temporary, they can rejoin)
 *
 * Only the room owner can kick players.
 * Marks all player sessions as 'left' but does not create a ban record.
 *
 * NOTE: Caller identity not verified in Phase 3. Phase 5 will add proper auth.
 */
export const kickPlayer = mutation({
  args: {
    roomId: v.string(),
    userId: v.string(),
    callerId: v.optional(v.string()), // For Phase 3, will use auth in Phase 5
  },
  handler: async (ctx, { roomId, userId, callerId }) => {
    // Check room ownership
    const room = await ctx.db
      .query('rooms')
      .withIndex('by_roomId', (q) => q.eq('roomId', roomId))
      .first()

    if (!room) {
      throw new Error('Room not found')
    }

    // Phase 3: Check if caller is owner (when callerId is provided)
    // Phase 5: Use getAuthUserId for proper authorization
    if (callerId && room.ownerId !== callerId) {
      throw new Error('Only the room owner can kick players')
    }

    if (callerId && userId === callerId) {
      throw new Error('Cannot kick yourself')
    }

    // Mark all player sessions as 'left'
    const playerSessions = await ctx.db
      .query('roomPlayers')
      .withIndex('by_roomId_userId', (q) =>
        q.eq('roomId', roomId).eq('userId', userId),
      )
      .collect()

    for (const session of playerSessions) {
      await ctx.db.patch(session._id, { status: 'left' })
    }
  },
})

/**
 * Unban a player
 *
 * Only the room owner can unban players.
 *
 * NOTE: Caller identity not verified in Phase 3. Phase 5 will add proper auth.
 */
export const unbanPlayer = mutation({
  args: {
    roomId: v.string(),
    userId: v.string(),
    callerId: v.optional(v.string()), // For Phase 3, will use auth in Phase 5
  },
  handler: async (ctx, { roomId, userId, callerId }) => {
    // Check room ownership
    const room = await ctx.db
      .query('rooms')
      .withIndex('by_roomId', (q) => q.eq('roomId', roomId))
      .first()

    if (!room) {
      throw new Error('Room not found')
    }

    // Phase 3: Check if caller is owner (when callerId is provided)
    if (callerId && room.ownerId !== callerId) {
      throw new Error('Only the room owner can unban players')
    }

    const ban = await ctx.db
      .query('roomBans')
      .withIndex('by_roomId_userId', (q) =>
        q.eq('roomId', roomId).eq('userId', userId),
      )
      .first()

    if (ban) {
      await ctx.db.delete(ban._id)
    }
  },
})

/**
 * Check if a user is banned from a room
 */
export const isBanned = query({
  args: {
    roomId: v.string(),
    userId: v.string(),
  },
  handler: async (ctx, { roomId, userId }) => {
    const ban = await ctx.db
      .query('roomBans')
      .withIndex('by_roomId_userId', (q) =>
        q.eq('roomId', roomId).eq('userId', userId),
      )
      .first()

    return !!ban
  },
})

/**
 * List all bans for a room
 */
export const listBans = query({
  args: { roomId: v.string() },
  handler: async (ctx, { roomId }) => {
    const bans = await ctx.db
      .query('roomBans')
      .withIndex('by_roomId', (q) => q.eq('roomId', roomId))
      .collect()

    return bans
  },
})
