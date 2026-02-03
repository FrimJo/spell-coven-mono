/**
 * Ban Mutations & Queries
 *
 * Handles banning and kicking players from rooms.
 * All mutations require authentication and verify the caller is the room owner.
 */

import { getAuthUserId } from '@convex-dev/auth/server'
import { v } from 'convex/values'

import { mutation, query } from './_generated/server'
import {
  AuthRequiredError,
  CannotTargetSelfError,
  NotRoomOwnerError,
  RoomNotFoundError,
} from './errors'

/**
 * Ban a player from a room
 *
 * Only the room owner can ban players.
 * Creates a persistent ban record and marks all player sessions as 'left'.
 * Requires authentication - caller identity is verified server-side.
 */
export const banPlayer = mutation({
  args: {
    roomId: v.string(),
    userId: v.string(),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, { roomId, userId, reason }) => {
    // Get authenticated user ID from session
    const callerId = await getAuthUserId(ctx)
    if (!callerId) {
      throw new AuthRequiredError()
    }

    // Check room exists and caller is owner
    const room = await ctx.db
      .query('rooms')
      .withIndex('by_roomId', (q) => q.eq('roomId', roomId))
      .first()

    if (!room) {
      throw new RoomNotFoundError()
    }

    if (room.ownerId !== callerId) {
      throw new NotRoomOwnerError('ban players')
    }

    if (userId === callerId) {
      throw new CannotTargetSelfError('ban')
    }

    // Check if already banned
    const existingBan = await ctx.db
      .query('roomBans')
      .withIndex('by_roomId_userId', (q) =>
        q.eq('roomId', roomId).eq('userId', userId),
      )
      .first()

    if (existingBan) {
      // Already banned, just update
      await ctx.db.patch(existingBan._id, {
        reason: reason ?? 'Banned by room owner',
        bannedBy: callerId,
        createdAt: Date.now(),
      })
    } else {
      // Create ban record
      await ctx.db.insert('roomBans', {
        roomId,
        userId,
        bannedBy: callerId,
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

    // Clear the userActiveRooms pointer if it points to this room
    const pointer = await ctx.db
      .query('userActiveRooms')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .first()

    if (pointer && pointer.roomId === roomId) {
      await ctx.db.delete(pointer._id)
    }

    // Update room activity
    await ctx.db.patch(room._id, { lastActivityAt: Date.now() })
  },
})

/**
 * Kick a player from a room (temporary, they can rejoin)
 *
 * Only the room owner can kick players.
 * Marks all player sessions as 'left' but does not create a ban record.
 * Requires authentication - caller identity is verified server-side.
 */
export const kickPlayer = mutation({
  args: {
    roomId: v.string(),
    userId: v.string(),
  },
  handler: async (ctx, { roomId, userId }) => {
    // Get authenticated user ID from session
    const callerId = await getAuthUserId(ctx)
    if (!callerId) {
      throw new AuthRequiredError()
    }

    // Check room exists and caller is owner
    const room = await ctx.db
      .query('rooms')
      .withIndex('by_roomId', (q) => q.eq('roomId', roomId))
      .first()

    if (!room) {
      throw new RoomNotFoundError()
    }

    if (room.ownerId !== callerId) {
      throw new NotRoomOwnerError('kick players')
    }

    if (userId === callerId) {
      throw new CannotTargetSelfError('kick')
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

    // Update room activity
    await ctx.db.patch(room._id, { lastActivityAt: Date.now() })
  },
})

/**
 * Unban a player
 *
 * Only the room owner can unban players.
 * Requires authentication - caller identity is verified server-side.
 */
export const unbanPlayer = mutation({
  args: {
    roomId: v.string(),
    userId: v.string(),
  },
  handler: async (ctx, { roomId, userId }) => {
    // Get authenticated user ID from session
    const callerId = await getAuthUserId(ctx)
    if (!callerId) {
      throw new AuthRequiredError()
    }

    // Check room exists and caller is owner
    const room = await ctx.db
      .query('rooms')
      .withIndex('by_roomId', (q) => q.eq('roomId', roomId))
      .first()

    if (!room) {
      throw new RoomNotFoundError()
    }

    if (room.ownerId !== callerId) {
      throw new NotRoomOwnerError('unban players')
    }

    const ban = await ctx.db
      .query('roomBans')
      .withIndex('by_roomId_userId', (q) =>
        q.eq('roomId', roomId).eq('userId', userId),
      )
      .first()

    if (ban) {
      await ctx.db.delete(ban._id)
      // Update room activity
      await ctx.db.patch(room._id, { lastActivityAt: Date.now() })
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
