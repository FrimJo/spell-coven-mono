/**
 * Player Mutations & Queries
 *
 * Handles player joining, leaving, presence heartbeat, and listing.
 *
 * NOTE: These mutations currently accept userId as a parameter for Phase 3
 * (presence migration). In Phase 5 (auth migration), we'll switch to using
 * getAuthUserId from Convex Auth for proper authorization.
 */

import { v } from 'convex/values'

import { internal } from './_generated/api'
import { mutation, query } from './_generated/server'
import { DEFAULT_HEALTH } from './constants'
import {
  BannedFromRoomError,
  MissingUserIdError,
  RoomNotFoundError,
} from './errors'

/**
 * Default starting health for Commander format
 */
/**
 * Presence timeout threshold in milliseconds (30 seconds)
 */
const PRESENCE_THRESHOLD_MS = 30_000

/**
 * Join a room as a player
 *
 * Creates a player record with the given session ID.
 * If the user already has a session in this room, returns that session.
 *
 * NOTE: userId is passed as parameter for Phase 3. In Phase 5, we'll use
 * getAuthUserId from Convex Auth instead.
 */
export const joinRoom = mutation({
  args: {
    roomId: v.string(),
    sessionId: v.string(),
    username: v.string(),
    avatar: v.optional(v.string()),
    userId: v.optional(v.string()), // Optional for backward compat, will use auth in Phase 5
  },
  handler: async (
    ctx,
    { roomId, sessionId, username, avatar, userId: passedUserId },
  ) => {
    // For Phase 3, use passed userId. Phase 5 will use getAuthUserId
    const userId = passedUserId
    if (!userId) {
      throw new MissingUserIdError()
    }

    // Check if room exists
    const room = await ctx.db
      .query('rooms')
      .withIndex('by_roomId', (q) => q.eq('roomId', roomId))
      .first()

    if (!room) {
      throw new RoomNotFoundError()
    }

    // Check if user is banned
    const ban = await ctx.db
      .query('roomBans')
      .withIndex('by_roomId_userId', (q) =>
        q.eq('roomId', roomId).eq('userId', userId),
      )
      .first()

    if (ban) {
      throw new BannedFromRoomError()
    }

    // Check if this session already exists
    const existingSession = await ctx.db
      .query('roomPlayers')
      .withIndex('by_roomId_sessionId', (q) =>
        q.eq('roomId', roomId).eq('sessionId', sessionId),
      )
      .first()

    const now = Date.now()

    if (existingSession) {
      // Update last seen and return
      await ctx.db.patch(existingSession._id, {
        lastSeenAt: now,
        status: 'active',
        username,
        avatar,
        poison: existingSession.poison ?? 0,
        commanders: existingSession.commanders ?? [],
        commanderDamage: existingSession.commanderDamage ?? {},
      })
      return { playerId: existingSession._id }
    }

    // Check if user has other sessions - get their health
    const existingUserSession = await ctx.db
      .query('roomPlayers')
      .withIndex('by_roomId_userId', (q) =>
        q.eq('roomId', roomId).eq('userId', userId),
      )
      .first()

    const health = existingUserSession?.health ?? DEFAULT_HEALTH
    const poison = existingUserSession?.poison ?? 0
    const commanders = existingUserSession?.commanders ?? []
    const commanderDamage = existingUserSession?.commanderDamage ?? {}

    // Create new player session
    const playerId = await ctx.db.insert('roomPlayers', {
      roomId,
      userId,
      sessionId,
      username,
      avatar,
      health,
      poison,
      commanders,
      commanderDamage,
      status: 'active',
      joinedAt: now,
      lastSeenAt: now,
    })

    return { playerId }
  },
})

/**
 * Leave a room
 *
 * Marks the player session as 'left'.
 * If the leaving player is the room owner, transfers ownership to the next
 * active player in join order.
 */
export const leaveRoom = mutation({
  args: {
    roomId: v.string(),
    sessionId: v.string(),
  },
  handler: async (ctx, { roomId, sessionId }) => {
    const player = await ctx.db
      .query('roomPlayers')
      .withIndex('by_roomId_sessionId', (q) =>
        q.eq('roomId', roomId).eq('sessionId', sessionId),
      )
      .first()

    if (player) {
      await ctx.db.patch(player._id, {
        status: 'left',
        lastSeenAt: Date.now(),
      })

      // Check if this user was the owner and transfer if needed
      const room = await ctx.db
        .query('rooms')
        .withIndex('by_roomId', (q) => q.eq('roomId', roomId))
        .first()

      if (room && room.ownerId === player.userId) {
        // Check if user has any other active sessions in this room
        const presenceThreshold = Date.now() - PRESENCE_THRESHOLD_MS
        const otherActiveSessions = await ctx.db
          .query('roomPlayers')
          .withIndex('by_roomId_userId', (q) =>
            q.eq('roomId', roomId).eq('userId', player.userId),
          )
          .filter((q) =>
            q.and(
              q.neq(q.field('status'), 'left'),
              q.gt(q.field('lastSeenAt'), presenceThreshold),
              q.neq(q.field('sessionId'), sessionId),
            ),
          )
          .first()

        // Only transfer if user has no other active sessions
        if (!otherActiveSessions) {
          await ctx.runMutation(internal.rooms.transferOwnerIfNeeded, {
            roomId,
          })
        }
      }
    }
  },
})

/**
 * Heartbeat - Update presence for a player session
 *
 * Call this periodically (e.g., every 10s) to maintain presence.
 * Does NOT resurrect 'left' sessions (kicked/banned players stay gone).
 */
export const heartbeat = mutation({
  args: {
    roomId: v.string(),
    sessionId: v.string(),
  },
  handler: async (ctx, { roomId, sessionId }) => {
    const player = await ctx.db
      .query('roomPlayers')
      .withIndex('by_roomId_sessionId', (q) =>
        q.eq('roomId', roomId).eq('sessionId', sessionId),
      )
      .first()

    // Don't resurrect 'left' sessions - they were kicked/banned
    if (player && player.status !== 'left') {
      await ctx.db.patch(player._id, {
        lastSeenAt: Date.now(),
        status: 'active',
      })
    }
  },
})

/**
 * Get all active players in a room
 *
 * Returns players with lastSeenAt within the presence threshold,
 * deduplicated by userId (returns oldest session per user).
 */
export const listActivePlayers = query({
  args: { roomId: v.string() },
  handler: async (ctx, { roomId }) => {
    const now = Date.now()
    const presenceThreshold = now - PRESENCE_THRESHOLD_MS

    const players = await ctx.db
      .query('roomPlayers')
      .withIndex('by_roomId', (q) => q.eq('roomId', roomId))
      .filter((q) =>
        q.and(
          q.neq(q.field('status'), 'left'),
          q.gt(q.field('lastSeenAt'), presenceThreshold),
        ),
      )
      .collect()

    // Sort by joinedAt
    players.sort((a, b) => a.joinedAt - b.joinedAt)

    // Deduplicate by userId (keep oldest session)
    const uniquePlayersMap = new Map<string, (typeof players)[number]>()
    for (const player of players) {
      if (!uniquePlayersMap.has(player.userId)) {
        uniquePlayersMap.set(player.userId, player)
      }
    }

    return Array.from(uniquePlayersMap.values())
  },
})

/**
 * Get all active player sessions in a room (including duplicates per user)
 *
 * Useful for detecting multi-tab scenarios.
 * Returns only 'active' sessions - Convex is the source of truth.
 * Kick detection: if your session disappears, you were kicked.
 */
export const listAllPlayerSessions = query({
  args: { roomId: v.string() },
  handler: async (ctx, { roomId }) => {
    const presenceThreshold = Date.now() - PRESENCE_THRESHOLD_MS

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

    // Sort by joinedAt
    players.sort((a, b) => a.joinedAt - b.joinedAt)

    return players
  },
})

/**
 * Get a specific player by userId in a room
 */
export const getPlayer = query({
  args: {
    roomId: v.string(),
    userId: v.string(),
  },
  handler: async (ctx, { roomId, userId }) => {
    const player = await ctx.db
      .query('roomPlayers')
      .withIndex('by_roomId_userId', (q) =>
        q.eq('roomId', roomId).eq('userId', userId),
      )
      .first()

    return player
  },
})
